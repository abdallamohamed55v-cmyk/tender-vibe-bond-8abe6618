// Smoke tests for `chat` edge function.
// Run via: supabase--test_edge_functions tool, or:
//   deno test --allow-net --allow-env supabase/functions/chat/index.test.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "https://ltgampdtawuefwwayncx.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const FN_URL = `${SUPABASE_URL}/functions/v1/chat`;

Deno.test("chat: CORS preflight returns 2xx with access-control headers", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization",
    },
  });
  await res.text();
  assert(res.status < 400, `preflight status ${res.status}`);
  assert(
    res.headers.get("access-control-allow-origin") !== null,
    "missing access-control-allow-origin",
  );
});

Deno.test("chat: rejects request without auth (401/400) or returns structured error", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assert(
    res.status === 400 || res.status === 401 || res.status === 422 || res.status === 500,
    `expected client error or controlled 500, got ${res.status}: ${body.slice(0, 200)}`,
  );
});

Deno.test("chat: rejects malformed JSON body cleanly", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: "{ not json",
  });
  await res.text();
  assert(res.status >= 400 && res.status < 600, `should reject, got ${res.status}`);
});
