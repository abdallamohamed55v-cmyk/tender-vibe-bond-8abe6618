// Dodo Payments webhook handler — verifies signature and processes events
// Uses Standard Webhooks spec (Svix-compatible)
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const secret = Deno.env.get("dodo-webhook");
  if (!secret) return new Response("missing webhook secret", { status: 500 });

  const rawBody = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") || "",
    "webhook-signature": req.headers.get("webhook-signature") || "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
  };

  let event: any;
  try {
    // Dodo uses Standard Webhooks. Secret may already be base64; if not, encode it.
    const base64Secret = /^[A-Za-z0-9+/=]+$/.test(secret) && secret.length % 4 === 0
      ? secret
      : btoa(secret);
    const wh = new Webhook(base64Secret);
    event = wh.verify(rawBody, headers);
  } catch (e) {
    console.error("Signature verification failed", e);
    return new Response("invalid signature", { status: 401 });
  }

  console.log("Dodo webhook event:", event.type, JSON.stringify(event.data).slice(0, 500));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const type = event.type as string;
    const data = event.data || {};
    const metadata = data.metadata || {};
    const userId = metadata.user_id as string | undefined;
    const plan = metadata.plan as string | undefined;

    // Map plan → MC credits per cycle
    const PLAN_CREDITS: Record<string, number> = {
      starter: 80, pro: 280, elite: 480, business: 1480,
    };

    if (type === "payment.succeeded" || type === "subscription.active" || type === "subscription.renewed") {
      if (userId && plan && PLAN_CREDITS[plan]) {
        // Find user's primary workspace
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id, credits")
          .eq("owner_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (ws) {
          const add = PLAN_CREDITS[plan];
          await supabase
            .from("workspaces")
            .update({ credits: Number(ws.credits || 0) + add, plan } as any)
            .eq("id", ws.id);

          await supabase.from("workspace_credit_topups").insert({
            workspace_id: ws.id,
            amount_credits: add,
            amount_usd: data.total_amount ? Number(data.total_amount) / 100 : 0,
            status: "paid",
            invoice_number: data.invoice_number || data.payment_id || data.id || `DODO-${Date.now()}`,
            provider: "dodo",
          } as any);
        }
      }
    }

    if (type === "subscription.cancelled" || type === "subscription.expired" || type === "subscription.failed") {
      if (userId) {
        await supabase
          .from("workspaces")
          .update({ plan: "free" } as any)
          .eq("owner_id", userId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook handler error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
