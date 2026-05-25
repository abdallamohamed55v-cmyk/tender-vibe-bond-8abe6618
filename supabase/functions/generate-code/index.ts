// Edge function: generate-code
// Provider: Vercel v0 (OpenAI-compatible chat completions API)
// - Resolves pricing dynamically from public.model_pricing (kind='code')
// - Computes credits from in/out tokens (50% margin, clamped min_credits..max_credits)
// - Deducts credits via deduct_credits RPC

import {
  adminClient,
  getModelPricing,
  computeChatCredits,
} from "../_shared/media-storage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ReqBody {
  prompt?: string;
  messages?: ChatMessage[];
  model: string; // model_pricing.id e.g. "v0:v0-1.5-md"
  user_id?: string;
  workspace_id?: string | null;
  system?: string;
  temperature?: number;
  max_tokens?: number;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const admin = adminClient();
    const { data } = await admin.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!body.model) return jsonResponse({ error: "Missing model" }, 400);
  if (!body.prompt && !body.messages?.length) {
    return jsonResponse({ error: "Provide prompt or messages" }, 400);
  }

  const userId = await getUserId(req);
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("V0_API_KEY");
  if (!apiKey) return jsonResponse({ error: "V0_API_KEY not configured" }, 500);

  const admin = adminClient();
  const pricing = await getModelPricing(admin, body.model);
  if (!pricing) return jsonResponse({ error: `Unknown model: ${body.model}` }, 400);
  if (pricing.provider !== "v0") {
    return jsonResponse({ error: `Model ${body.model} is not a v0 model` }, 400);
  }

  const messages: ChatMessage[] = body.messages?.length
    ? body.messages
    : [
        ...(body.system ? [{ role: "system" as const, content: body.system }] : []),
        { role: "user", content: body.prompt! },
      ];

  // Call v0 (OpenAI-compatible)
  let v0Resp: Response;
  try {
    v0Resp = await fetch("https://api.v0.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: pricing.endpoint,
        messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens,
        stream: false,
      }),
    });
  } catch (err) {
    return jsonResponse({ error: `v0 request failed: ${(err as Error).message}` }, 502);
  }

  if (!v0Resp.ok) {
    const text = await v0Resp.text();
    return jsonResponse({ error: `v0 error ${v0Resp.status}`, details: text }, v0Resp.status);
  }

  const data = await v0Resp.json();
  const choice = data?.choices?.[0];
  const content: string = choice?.message?.content ?? "";
  const inTok = Number(data?.usage?.prompt_tokens ?? 0);
  const outTok = Number(data?.usage?.completion_tokens ?? 0);

  const credits = computeChatCredits(
    { ...pricing, metadata: { ...(pricing.metadata ?? {}), min_credits: (pricing as any).min_credits ?? 0.5, max_credits: (pricing as any).max_credits ?? 8 } },
    inTok,
    outTok,
  );

  // Deduct credits
  const { data: deduct, error: dedErr } = await admin.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: credits,
    p_action_type: "generate_code",
    p_description: `${pricing.label || pricing.id} • ${inTok}/${outTok} tokens`,
  });
  if (dedErr) {
    return jsonResponse({ error: "Failed to deduct credits", details: dedErr.message }, 500);
  }
  if (deduct && (deduct as any).success === false) {
    return jsonResponse({ error: (deduct as any).error ?? "Insufficient credits", credits: (deduct as any).credits ?? 0 }, 402);
  }

  return jsonResponse({
    success: true,
    content,
    model: body.model,
    usage: { input_tokens: inTok, output_tokens: outTok },
    credits_charged: credits,
    credits_remaining: (deduct as any)?.credits ?? null,
  });
});
