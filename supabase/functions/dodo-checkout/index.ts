// Creates a Dodo Payments checkout session for a workspace subscription
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DODO_BASE = "https://live.dodopayments.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("dodo-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "dodo-key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate caller auth
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const { product_id, plan, metadata } = body as {
      product_id?: string; plan?: string; metadata?: Record<string, unknown>;
    };

    if (!product_id || typeof product_id !== "string") {
      return new Response(JSON.stringify({ error: "product_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://megsyai.com";
    const return_url = `${origin}/suc?checkout_id={CHECKOUT_SESSION_ID}`;

    console.log("[dodo-checkout] creating session", { product_id, plan, user_id: user.id });

    // Use Dodo Checkout Sessions API — collects billing on the payment page
    const dodoRes = await fetch(`${DODO_BASE}/checkouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [{ product_id, quantity: 1 }],
        customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
        return_url,
        metadata: {
          ...(metadata || {}),
          user_id: user.id,
          plan: plan || "",
        },
      }),
    });

    const dodoData = await dodoRes.json();
    if (!dodoRes.ok) {
      console.error("Dodo checkout error", dodoRes.status, dodoData);
      return new Response(JSON.stringify({ error: dodoData?.message || "dodo_error", detail: dodoData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = dodoData.checkout_url || dodoData.payment_link || dodoData.url;
    return new Response(JSON.stringify({ url, session_id: dodoData.session_id || dodoData.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
