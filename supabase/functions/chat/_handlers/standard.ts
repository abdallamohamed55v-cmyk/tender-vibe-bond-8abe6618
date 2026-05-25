// Standard chat fast-path.
// Used when the request does NOT need tools (no search, no shopping, no deep
// research, no media generation, no browser, no integrations, no files).
//
// Skips: router decision, skill loading, persona analysis, tool building.
// Goal: first chunk to user in 1-3 seconds, robust fallback across providers.

import { makeSafeController, startHeartbeat, sseHeaders } from "../_lib/streaming.ts";
import {
  type Provider,
  streamFromProviderChain,
} from "../_lib/providers.ts";
import { buildChatFallback } from "../_lib/fallback.ts";

export type StandardChatInput = {
  messages: any[];
  model: string;
  systemPrompt: string;
  isCasual: boolean;
  latestUserText: string;
  providers: Provider[];
  corsHeaders: Record<string, string>;
};

export function handleStandardChat(input: StandardChatInput): Response {
  const { messages, model, systemPrompt, isCasual, latestUserText, providers, corsHeaders } = input;

  // Trim aggressively for speed.
  const maxHistory = isCasual ? 4 : 8;
  const trimmed = Array.isArray(messages) && messages.length > maxHistory
    ? messages.slice(-maxHistory)
    : messages;

  // Drop empty assistant messages (some providers reject them).
  const cleaned = trimmed.filter((m: any) => {
    if (m?.role !== "assistant") return true;
    if (typeof m.content !== "string") return true;
    return m.content.trim().length > 0;
  });

  const body = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...cleaned],
    stream: true,
    temperature: isCasual ? 0.3 : 0.6,
    max_tokens: isCasual ? 256 : 2048,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const safe = makeSafeController(controller);
      const heartbeat = startHeartbeat(safe, 10_000);

      try {
        const result = await streamFromProviderChain(providers, {
          body,
          firstChunkTimeoutMs: isCasual ? 12_000 : 25_000,
          totalTimeoutMs: 90_000,
          onChunk: (text) => safe.sendContent(text),
        });

        if (!result.streamed) {
          // Every provider failed before producing content — give the user
          // a clear, localized message instead of a blank screen.
          const hint = result.errorText || (result.status ? `HTTP ${result.status}` : "");
          safe.sendContent(buildChatFallback(latestUserText, hint));
        }
      } catch (e) {
        console.error("[standard-chat] uncaught", e);
        safe.sendContent(buildChatFallback(latestUserText, (e as Error)?.message));
      } finally {
        heartbeat.stop();
        safe.done();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders(corsHeaders) });
}
