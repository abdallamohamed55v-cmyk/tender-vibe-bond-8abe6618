// SSE streaming helpers used by the chat edge function.
// Goal: never let a closed/cancelled stream propagate an error and kill the response.
// Every enqueue is wrapped; heartbeats keep proxies from cutting long-lived connections.

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

export const sseHeaders = (cors: Record<string, string>) => ({ ...cors, ...SSE_HEADERS });

export function makeSafeController(controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();
  let closed = false;

  const safeEnqueue = (chunk: string | Uint8Array) => {
    if (closed) return;
    try {
      const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
      controller.enqueue(bytes);
    } catch {
      // Stream cancelled by client. Mark closed so further calls are no-ops.
      closed = true;
    }
  };

  return {
    /** Send a parsed delta as an OpenAI-style SSE chat completion chunk. */
    sendContent(text: string) {
      if (!text) return;
      safeEnqueue(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
    },
    /** Send an arbitrary JSON event (status, images, products, custom events). */
    sendEvent(payload: Record<string, unknown>) {
      safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
    },
    /** SSE comment line — used as heartbeat to keep proxies alive. */
    sendKeepAlive() {
      safeEnqueue(`: keep-alive ${Date.now()}\n\n`);
    },
    /** Send the terminating [DONE] marker and close the controller. */
    done() {
      if (closed) return;
      safeEnqueue("data: [DONE]\n\n");
      try { controller.close(); } catch { /* already closed */ }
      closed = true;
    },
    isClosed() { return closed; },
    /** Allow callers to inject a raw SSE line (already-formed) safely. */
    raw(line: string) { safeEnqueue(line); },
  };
}

export type SafeController = ReturnType<typeof makeSafeController>;

/** Fire SSE comments at a fixed interval. Returns a stop fn. */
export function startHeartbeat(safe: SafeController, intervalMs = 10_000): { stop: () => void } {
  const id = setInterval(() => safe.sendKeepAlive(), intervalMs);
  return { stop: () => clearInterval(id) };
}
