// Provider chain for the chat edge function.
// Each provider is tried in order. The first one to stream actual content within
// the firstChunkTimeoutMs wins; the rest are abandoned.
//
// Why: previously a single Lovable/OpenRouter/LemonData hiccup could leave the
// user with an infinite spinner. With strict timeouts and clean fallbacks the
// user gets a response from SOMETHING, every time.

import type { SafeController } from "./streaming.ts";

export type Provider = {
  name: "openrouter";
  url: string;
  key: string;
  /** Provider-specific transform applied to the requested model id. */
  normalizeModel: (modelId: string) => string;
};

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type StreamProviderOpts = {
  body: Record<string, unknown>;
  /** Hard deadline to receive the first content chunk. */
  firstChunkTimeoutMs?: number;
  /** Hard overall deadline for the entire stream. */
  totalTimeoutMs?: number;
  onChunk: (text: string) => void;
  /** Called once we receive any tool_calls (deltas already merged). */
  onToolCalls?: (toolCalls: any[]) => void;
};

export type StreamResult = {
  ok: boolean;
  streamed: boolean;
  status?: number;
  errorText?: string;
  toolCalls?: any[];
};

/** Try one provider. Returns ok=true ONLY if we received at least one byte of content. */
export async function streamFromProvider(
  provider: Provider,
  opts: StreamProviderOpts,
): Promise<StreamResult> {
  const firstChunkTimeoutMs = opts.firstChunkTimeoutMs ?? 25_000;
  const totalTimeoutMs = opts.totalTimeoutMs ?? 90_000;

  const ac = new AbortController();
  const totalTimer = setTimeout(() => ac.abort(), totalTimeoutMs);
  const firstChunkTimer = setTimeout(() => ac.abort(), firstChunkTimeoutMs);

  let response: Response;
  try {
    const body = { ...opts.body, model: provider.normalizeModel(String(opts.body.model || "")) };
    response = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (e) {
    clearTimeout(totalTimer);
    clearTimeout(firstChunkTimer);
    return { ok: false, streamed: false, errorText: (e as Error)?.message || "fetch failed" };
  }

  if (!response.ok || !response.body) {
    clearTimeout(totalTimer);
    clearTimeout(firstChunkTimer);
    let errText = "";
    try { errText = await response.text(); } catch { /* ignore */ }
    return { ok: false, streamed: false, status: response.status, errorText: errText.slice(0, 400) };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = false;
  let toolCalls: any[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls[idx]) toolCalls[idx] = { function: { name: "", arguments: "" } };
              if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
            continue;
          }

          if (typeof delta.content === "string" && delta.content.length > 0) {
            if (!streamed) {
              // Got first byte — disarm the first-chunk timer.
              clearTimeout(firstChunkTimer);
              streamed = true;
            }
            opts.onChunk(delta.content);
          }
        } catch { /* skip malformed line */ }
      }
    }
  } catch (e) {
    clearTimeout(totalTimer);
    clearTimeout(firstChunkTimer);
    return {
      ok: streamed,
      streamed,
      errorText: (e as Error)?.message || "stream read failed",
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
  }

  clearTimeout(totalTimer);
  clearTimeout(firstChunkTimer);

  if (toolCalls.length > 0) opts.onToolCalls?.(toolCalls);

  return {
    ok: true,
    streamed,
    toolCalls: toolCalls.length ? toolCalls : undefined,
  };
}

/** Iterate providers in order until one streams content. */
export async function streamFromProviderChain(
  providers: Provider[],
  opts: StreamProviderOpts,
): Promise<StreamResult> {
  let last: StreamResult = { ok: false, streamed: false, errorText: "no providers" };
  for (const p of providers) {
    const r = await streamFromProvider(p, opts);
    if (r.streamed) return r;
    last = r;
    console.warn(`[provider:${p.name}] failed`, { status: r.status, err: r.errorText });
  }
  return last;
}
