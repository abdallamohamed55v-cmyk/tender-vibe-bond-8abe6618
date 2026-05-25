import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { getRouter, ROUTER_MODELS } from "../_shared/llm-router.ts";
import { getAuthUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function plainExcerpt(html: string, max = 1500): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { prompt = "", title = "", docType = "", html = "" } = await req.json();
    const router = await getRouter();
    if (!router) {
      return new Response(JSON.stringify({ error: "OpenRouter key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const excerpt = plainExcerpt(String(html ?? ""));
    const sys = `You are the document author talking to the user in chat right after delivering their document.
Write a SHORT friendly description (2–4 sentences, max ~55 words) of what you just created for them.
HARD RULES:
- Reply in EXACTLY the same language and dialect as the user's request below. Mirror Arabic dialects precisely (Egyptian, Khaleeji, Shami, Maghrebi, Iraqi, MSA, etc.).
- Be SPECIFIC to this exact document — mention the subject, the angle you took, or the highlights you included. Never use generic filler like "your document is ready".
- Do NOT use any fixed template phrases. Do NOT mention buttons, downloads, PDF, share, or preview — the UI already shows those.
- Plain text only. No markdown headings, no bullets, no code fences. One short paragraph.`;
    const user = `USER REQUEST:\n${prompt}\n\nDOCUMENT TITLE: ${title}\nDOCUMENT TYPE: ${docType}\n\nDOCUMENT TEXT EXCERPT (for grounding):\n${excerpt}`;

    const res = await fetch(router.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${router.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ROUTER_MODELS.docs,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 220,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: `gateway ${res.status}`, detail: text }), {
        status: res.status === 429 || res.status === 402 ? res.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const message = String(data?.choices?.[0]?.message?.content ?? "").trim();
    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});