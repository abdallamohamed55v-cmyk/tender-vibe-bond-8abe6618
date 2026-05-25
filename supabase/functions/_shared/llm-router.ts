// Shared helper: route AI calls to OpenRouter only.
// Key source: public.api_keys service=openrouter (preferred) or OpenRouter env secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_SERVICE_NAMES = ["openrouter", "open_router", "open router", "Open Router", "OPENROUTER"];

let cached: { url: string; key: string; expiry: number } | null = null;
const TTL_MS = 5 * 60_000;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Returns { url, key } for the best available LLM endpoint for OpenRouter-style models. */
export async function getRouter(): Promise<{ url: string; key: string } | null> {
  if (cached && Date.now() < cached.expiry) return { url: cached.url, key: cached.key };

  // Only use OpenRouter — agentrouter.org is blocked by Aliyun WAF and returns
  // HTML captcha pages instead of JSON, which breaks the AI SDK parser.
  try {
    const sb = admin();
    const { data } = await sb
      .from("api_keys")
      .select("service, api_key")
      .in("service", OPENROUTER_SERVICE_NAMES)
      .eq("is_active", true)
      .eq("is_blocked", false)
      .limit(1);
    if (data && data.length) {
      const or = data[0];
      cached = { url: OPENROUTER_URL, key: or.api_key, expiry: Date.now() + TTL_MS };
      return { url: OPENROUTER_URL, key: or.api_key };
    }
  } catch (e) {
    console.warn("[llm-router] getRouter db error:", (e as Error).message);
  }

  const env = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("OPEN_ROUTER_API_KEY") || Deno.env.get("OPEN_ROUTER_KEY");
  if (env) {
    cached = { url: OPENROUTER_URL, key: env, expiry: Date.now() + TTL_MS };
    return { url: OPENROUTER_URL, key: env };
  }
  return null;
}

/** Default model assignments (centralized). All cheap OpenRouter models. */
export const ROUTER_MODELS = {
  chat:          "google/gemini-2.5-flash-lite",
  learning:      "google/gemini-2.5-flash-lite",
  slides:        "google/gemini-2.5-flash-lite",
  // Slides pipeline — cost-first routing (all flash-lite/flash, no pro):
  slidesOutline: "google/gemini-2.5-flash-lite",  // cheap planning
  slidesExpand:  "google/gemini-2.5-flash",       // cheap but decent writing
  slidesCritic:  "google/gemini-2.5-flash",       // cheap review pass
  slidesVision:  "google/gemini-2.5-flash",        // cheap vision
  slidesNarrate: "google/gemini-2.5-flash-lite",  // streaming voice (cheap is fine)
  docs:          "google/gemini-2.5-flash-lite",
  deepResearch:  "google/gemini-2.5-flash-lite",
  coding:        "google/gemini-2.5-flash-lite",
} as const;

/** Map an OpenRouter model id to the closest equivalent on the Lovable AI Gateway.
 *  Lovable Gateway only exposes a small whitelist (mostly Gemini Flash family),
 *  so any non-google model collapses to gemini-2.5-flash. */
export function lovableEquivalent(model: string): string {
  const m = (model || "").toLowerCase();
  if (m.includes("flash-lite")) return "google/gemini-2.5-flash-lite";
  if (m.includes("gemini-2.5-pro") || m.includes("/pro")) return "google/gemini-2.5-pro";
  if (m.includes("gemini") || m.includes("flash")) return "google/gemini-2.5-flash";
  // Fallback for anything else (claude/gpt/llama/etc.) — gateway only has Gemini.
  return "google/gemini-2.5-flash";
}
