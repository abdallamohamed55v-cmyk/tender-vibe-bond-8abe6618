// Firecrawl tools. Require FIRECRAWL_API_KEY in the runtime env.
// Designed to run server-side (edge function / server route); never call from
// browser code because the API key would be exposed.

import type { ToolResult } from "../types";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

function getKey(): string | null {
  // Works in Deno edge functions (Deno.env) and Node/Workers (process.env).
  const g = globalThis as unknown as {
    Deno?: { env: { get(k: string): string | undefined } };
    process?: { env: Record<string, string | undefined> };
  };
  return g.Deno?.env.get("FIRECRAWL_API_KEY") ?? g.process?.env?.FIRECRAWL_API_KEY ?? null;
}

async function call(path: string, body: unknown): Promise<ToolResult<unknown>> {
  const key = getKey();
  if (!key) return { ok: false, error: "FIRECRAWL_API_KEY is not configured" };
  const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) return { ok: false, error: `firecrawl_${res.status}: ${text.slice(0, 200)}` };
  return { ok: true, data };
}

export function webScrape(args: { url: string; formats?: string[] }) {
  return call("/scrape", { url: args.url, formats: args.formats ?? ["markdown"] });
}
export function webSearch(args: { query: string; limit?: number }) {
  return call("/search", { query: args.query, limit: args.limit ?? 10 });
}
export function webMap(args: { url: string; limit?: number }) {
  return call("/map", { url: args.url, limit: args.limit ?? 200 });
}
export function webCrawl(args: { url: string; limit?: number; maxDepth?: number }) {
  return call("/crawl", { url: args.url, limit: args.limit ?? 25, maxDepth: args.maxDepth ?? 2 });
}
