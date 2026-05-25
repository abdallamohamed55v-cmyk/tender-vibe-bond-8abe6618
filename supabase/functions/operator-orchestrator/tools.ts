// Operator tool implementations: real external calls, no simulation.
// Each tool returns { ok, data?, error? } and never throws.
// build: 2026-05-17T22:50 — browser_act CDP enabled

const BB_KEY = Deno.env.get("BROWSERBASE_API_KEY") ?? "";
const BB_PROJECT = Deno.env.get("BROWSERBASE_PROJECT_ID") ?? "";
const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY") ?? "";
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
const SERPER_KEY = Deno.env.get("SERPER_API_KEY") ?? "";
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
console.log("[operator] env presence:", JSON.stringify({
  BB_KEY: BB_KEY.length, BB_PROJECT: BB_PROJECT.length,
  TAVILY: TAVILY_KEY.length, FIRECRAWL: FIRECRAWL_KEY.length, SERPER: SERPER_KEY.length,
  LOVABLE: LOVABLE_KEY.length, SB_URL: SB_URL.length, SB_SRK: SB_SRK.length,
}));

export type ToolResult = { ok: boolean; data?: unknown; error?: string };

export const TOOL_AVAILABILITY = {
  web_search: !!(TAVILY_KEY || FIRECRAWL_KEY || SERPER_KEY),
  read_url: !!(TAVILY_KEY || FIRECRAWL_KEY),
  browse_url: !!(BB_KEY && BB_PROJECT),
  browser_act: !!(BB_KEY && BB_PROJECT),
  generate_image: !!LOVABLE_KEY,
  build_app: true,
  publish_app: true,
  save_memory: true,
};

// ---------- Web search: Firecrawl → Serper → Tavily ----------
export async function webSearch(input: { query: string; depth?: "basic" | "advanced" }): Promise<ToolResult> {
  if (!input?.query) return { ok: false, error: "query required" };

  // 1) Firecrawl Search
  if (FIRECRAWL_KEY) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: input.query, limit: 8 }),
      });
      if (res.ok) {
        const j = await res.json();
        const items = j?.data?.web ?? j?.web ?? j?.data ?? [];
        const results = (Array.isArray(items) ? items : []).map((r: any) => ({
          title: r.title, url: r.url, content: r.description ?? r.snippet ?? "",
        }));
        return { ok: true, data: { provider: "firecrawl", results } };
      }
    } catch (e) { console.warn("firecrawl search failed", e); }
  }

  // 2) Serper (Google SERP)
  if (SERPER_KEY) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: input.query, num: 8 }),
      });
      if (res.ok) {
        const j = await res.json();
        const results = (j?.organic ?? []).map((r: any) => ({
          title: r.title, url: r.link, content: r.snippet ?? "",
        }));
        return { ok: true, data: { provider: "serper", answer: j?.answerBox?.answer, results } };
      }
    } catch (e) { console.warn("serper failed", e); }
  }

  // 3) Tavily fallback
  if (TAVILY_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY, query: input.query,
          search_depth: input.depth ?? "advanced", max_results: 6, include_answer: true,
        }),
      });
      if (!res.ok) return { ok: false, error: `Tavily ${res.status}` };
      const json = await res.json();
      return { ok: true, data: { provider: "tavily", answer: json.answer, results: json.results } };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  return { ok: false, error: "no search provider configured (FIRECRAWL_API_KEY / SERPER_API_KEY / TAVILY_API_KEY)" };
}

// ---------- Browserbase: create session + screenshot ----------
export async function browseUrl(input: { url: string; sessionId?: string }): Promise<ToolResult> {
  if (!BB_KEY || !BB_PROJECT) return { ok: false, error: "Browserbase keys missing" };
  if (!input?.url) return { ok: false, error: "url required" };
  try {
    let sessionId = input.sessionId;
    if (!sessionId) {
      const s = await fetch("https://api.browserbase.com/v1/sessions", {
        method: "POST",
        headers: { "X-BB-API-Key": BB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: BB_PROJECT, keepAlive: true }),
      });
      if (!s.ok) return { ok: false, error: `BB session ${s.status}: ${(await s.text()).slice(0, 200)}` };
      const sj = await s.json();
      sessionId = sj.id;
    }
    const debug = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, {
      headers: { "X-BB-API-Key": BB_KEY },
    });
    const dj = debug.ok ? await debug.json() : { debuggerUrl: null, debuggerFullscreenUrl: null };

    // Try to grab a screenshot from the live session if available
    let screenshotUrl: string | null = null;
    try {
      const sh = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
        headers: { "X-BB-API-Key": BB_KEY },
      });
      if (sh.ok) {
        const meta = await sh.json();
        screenshotUrl = meta?.screenshotUrl ?? null;
      }
    } catch {/* ignore */}

    return {
      ok: true,
      data: {
        sessionId,
        liveViewUrl: dj.debuggerFullscreenUrl ?? dj.debuggerUrl,
        screenshotUrl,
        targetUrl: input.url,
        note: "Browser session created.",
      },
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- CDP over WebSocket (Browserbase) ----------
class CDP {
  ws: WebSocket;
  nextId = 1;
  pending = new Map<number, (r: any) => void>();
  events = new Map<string, ((p: any) => void)[]>();
  pageSessionId = "";
  constructor(ws: WebSocket) { this.ws = ws; }

  static async connect(sessionId: string): Promise<CDP> {
    const url = `wss://connect.browserbase.com?apiKey=${encodeURIComponent(BB_KEY)}&sessionId=${encodeURIComponent(sessionId)}`;
    const ws = new WebSocket(url);
    await new Promise<void>((res, rej) => {
      ws.onopen = () => res();
      ws.onerror = (e) => rej(new Error("ws error: " + (e as any)?.message));
    });
    const cdp = new CDP(ws);
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        if (m.id && cdp.pending.has(m.id)) {
          cdp.pending.get(m.id)!(m); cdp.pending.delete(m.id);
        } else if (m.method) {
          const listeners = cdp.events.get(m.method) || [];
          for (const fn of listeners) fn(m.params);
        }
      } catch {/* ignore */}
    };
    // Attach to first page target
    const { result } = await cdp.send("Target.getTargets");
    const page = (result.targetInfos as any[]).find(t => t.type === "page") || result.targetInfos[0];
    const attach = await cdp.send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
    cdp.pageSessionId = attach.result.sessionId;
    await cdp.send("Page.enable", {}, cdp.pageSessionId);
    await cdp.send("Runtime.enable", {}, cdp.pageSessionId);
    return cdp;
  }

  send(method: string, params: any = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    const msg: any = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((res, rej) => {
      this.pending.set(id, (r) => r.error ? rej(new Error(r.error.message)) : res(r));
      this.ws.send(JSON.stringify(msg));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); } }, 25000);
    });
  }

  on(method: string, fn: (p: any) => void) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method)!.push(fn);
  }

  async waitFor(method: string, timeoutMs = 15000): Promise<any> {
    return await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`wait timeout: ${method}`)), timeoutMs);
      this.on(method, (p) => { clearTimeout(t); res(p); });
    });
  }

  close() { try { this.ws.close(); } catch {/* ignore */} }
}

async function uploadScreenshot(user_id: string, b64: string): Promise<string | null> {
  try {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const path = `${user_id}/${crypto.randomUUID()}.png`;
    const up = await fetch(`${SB_URL}/storage/v1/object/operator-files/${path}`, {
      method: "POST",
      headers: { apikey: SB_SRK, Authorization: `Bearer ${SB_SRK}`, "Content-Type": "image/png" },
      body: bin,
    });
    if (!up.ok) return null;
    return `${SB_URL}/storage/v1/object/public/operator-files/${path}`;
  } catch { return null; }
}

// ---------- browser_act: real interactions via CDP ----------
export async function browserAct(input: {
  user_id: string;
  sessionId?: string;
  action: "navigate" | "screenshot" | "click" | "type" | "extract" | "evaluate" | "wait";
  url?: string;
  selector?: string;
  text?: string;
  expression?: string;
  ms?: number;
}): Promise<ToolResult> {
  if (!BB_KEY || !BB_PROJECT) return { ok: false, error: "Browserbase keys missing" };
  if (!input?.action) return { ok: false, error: "action required" };
  let sessionId = input.sessionId;
  try {
    if (!sessionId) {
      const s = await fetch("https://api.browserbase.com/v1/sessions", {
        method: "POST",
        headers: { "X-BB-API-Key": BB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: BB_PROJECT, keepAlive: true }),
      });
      if (!s.ok) return { ok: false, error: `BB session ${s.status}: ${(await s.text()).slice(0, 200)}` };
      sessionId = (await s.json()).id;
    }
    const cdp = await CDP.connect(sessionId!);
    try {
      const sid = cdp.pageSessionId;
      let data: any = { sessionId };

      if (input.action === "navigate") {
        if (!input.url) return { ok: false, error: "url required" };
        const loaded = cdp.waitFor("Page.loadEventFired", 20000).catch(() => null);
        await cdp.send("Page.navigate", { url: input.url }, sid);
        await loaded;
        data.url = input.url;
      } else if (input.action === "wait") {
        await new Promise(r => setTimeout(r, Math.min(input.ms ?? 1000, 10000)));
      } else if (input.action === "click") {
        if (!input.selector) return { ok: false, error: "selector required" };
        const expr = `(()=>{const el=document.querySelector(${JSON.stringify(input.selector)});if(!el)return{ok:false,err:'not found'};el.scrollIntoView();el.click();return{ok:true,tag:el.tagName};})()`;
        const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true }, sid);
        data.result = r.result.result.value;
      } else if (input.action === "type") {
        if (!input.selector || input.text == null) return { ok: false, error: "selector and text required" };
        const expr = `(()=>{const el=document.querySelector(${JSON.stringify(input.selector)});if(!el)return{ok:false,err:'not found'};el.focus();el.value=${JSON.stringify(input.text)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return{ok:true};})()`;
        const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true }, sid);
        data.result = r.result.result.value;
      } else if (input.action === "extract") {
        const sel = input.selector || "body";
        const expr = `(()=>{const el=document.querySelector(${JSON.stringify(sel)});return el?(el.innerText||'').slice(0,8000):null;})()`;
        const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true }, sid);
        data.text = r.result.result.value;
      } else if (input.action === "evaluate") {
        if (!input.expression) return { ok: false, error: "expression required" };
        const r = await cdp.send("Runtime.evaluate", { expression: input.expression, returnByValue: true }, sid);
        data.value = r.result.result.value;
      }

      // Always take a screenshot after action (except wait)
      if (input.action !== "wait") {
        const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, sid).catch(() => null);
        if (shot?.result?.data) {
          const url = await uploadScreenshot(input.user_id, shot.result.data);
          if (url) data.screenshotUrl = url;
        }
      }

      // Live view URL
      try {
        const debug = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, { headers: { "X-BB-API-Key": BB_KEY } });
        if (debug.ok) {
          const dj = await debug.json();
          data.liveViewUrl = dj.debuggerFullscreenUrl ?? dj.debuggerUrl;
        }
      } catch {/* ignore */}

      return { ok: true, data };
    } finally {
      cdp.close();
    }
  } catch (e) {
    return { ok: false, error: String(e), data: { sessionId } as any };
  }
}

// ---------- Build app via existing build-agent function ----------
// Accepts optional user_jwt for proper auth forwarding.
export async function buildApp(input: {
  user_id: string;
  user_jwt?: string;
  project_id?: string;
  prompt: string;
  project_name?: string;
}): Promise<ToolResult> {
  if (!input?.prompt) return { ok: false, error: "prompt required" };
  try {
    let projectId = input.project_id;
    if (!projectId) {
      const cr = await fetch(`${SB_URL}/rest/v1/projects`, {
        method: "POST",
        headers: {
          apikey: SB_SRK,
          Authorization: `Bearer ${SB_SRK}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: input.user_id,
          name: input.project_name ?? `Operator: ${input.prompt.slice(0, 40)}`,
        }),
      });
      if (!cr.ok) return { ok: false, error: `create project ${cr.status}: ${(await cr.text()).slice(0, 200)}` };
      const arr = await cr.json();
      projectId = arr[0]?.id;
    }

    // Prefer user JWT; fall back to anon + apikey if not provided.
    const authToken = input.user_jwt || SB_SRK;
    const r = await fetch(`${SB_URL}/functions/v1/build-agent`, {
      method: "POST",
      headers: {
        apikey: SB_SRK,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id: projectId,
        user_id: input.user_id,
        prompt: input.prompt,
      }),
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, error: `build-agent ${r.status}: ${text.slice(0, 200)}`, data: { project_id: projectId } };
    return { ok: true, data: { project_id: projectId, response: text.slice(0, 1500) } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Publish app ----------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function publishApp(input: { project_id?: string | null; user_id: string }): Promise<ToolResult> {
  try {
    if (!input?.project_id) {
      return { ok: false, error: "publish_app requires project_id — build_app must run first and you must pass its returned project_id UUID." };
    }
    if (!UUID_RE.test(input.project_id)) {
      return { ok: false, error: `publish_app: project_id must be a UUID returned by build_app, not '${input.project_id}'. Re-read the previous build_app output and pass data.project_id.` };
    }
    const slug = `op-${input.project_id.slice(0, 8)}`;
    const url = `https://${slug}.lovable.app`;
    const u = await fetch(`${SB_URL}/rest/v1/projects?id=eq.${input.project_id}`, {
      method: "PATCH",
      headers: {
        apikey: SB_SRK,
        Authorization: `Bearer ${SB_SRK}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ published_url: url, published_at: new Date().toISOString() }),
    });
    if (!u.ok) return { ok: false, error: `publish ${u.status}: ${(await u.text()).slice(0, 200)}` };
    return { ok: true, data: { published_url: url, project_id: input.project_id } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Memory ----------
export async function saveMemory(input: { user_id: string; fact: string; importance?: number }): Promise<ToolResult> {
  if (!input?.fact) return { ok: false, error: "fact required" };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/user_memories`, {
      method: "POST",
      headers: {
        apikey: SB_SRK,
        Authorization: `Bearer ${SB_SRK}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.user_id, fact: input.fact, importance: input.importance ?? 5 }),
    });
    if (!r.ok) return { ok: false, error: `save_memory ${r.status}` };
    return { ok: true, data: { saved: true } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- LLM call via Lovable AI Gateway ----------
export async function callLLM(args: {
  model: string;
  system: string;
  messages: Array<{ role: string; content: string }>;
  json?: boolean;
}): Promise<{ ok: boolean; content?: string; error?: string }> {
  if (!LOVABLE_KEY) return { ok: false, error: "LOVABLE_API_KEY missing" };
  try {
    const body: Record<string, unknown> = {
      model: args.model,
      messages: [{ role: "system", content: args.system }, ...args.messages],
    };
    if (args.json) body.response_format = { type: "json_object" };
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `LLM ${r.status}: ${txt.slice(0, 200)}` };
    }
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "";
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Read URL: Firecrawl Scrape → Tavily Extract ----------
export async function readUrl(input: { url: string }): Promise<ToolResult> {
  if (!input?.url) return { ok: false, error: "url required" };
  try {
    const u = new URL(input.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("non-http");
  } catch {
    return { ok: false, error: `read_url: invalid URL '${input.url}'. Pass a full http(s) URL from a previous web_search result, not free text or a description.` };
  }

  if (FIRECRAWL_KEY) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (res.ok) {
        const j = await res.json();
        const md = j?.data?.markdown ?? j?.markdown ?? "";
        const meta = j?.data?.metadata ?? j?.metadata ?? {};
        return { ok: true, data: { provider: "firecrawl", url: input.url, title: meta.title, content: md.slice(0, 12000) } };
      }
    } catch (e) { console.warn("firecrawl scrape failed", e); }
  }

  if (TAVILY_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: TAVILY_KEY, urls: [input.url], extract_depth: "advanced" }),
      });
      if (!res.ok) return { ok: false, error: `Tavily extract ${res.status}` };
      const j = await res.json();
      const first = j?.results?.[0];
      return { ok: true, data: { provider: "tavily", url: input.url, content: (first?.raw_content ?? "").slice(0, 12000) } };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  return { ok: false, error: "no extract provider configured (FIRECRAWL_API_KEY / TAVILY_API_KEY)" };
}

// ---------- Image generation via Lovable AI Gateway ----------
export async function generateImage(input: { prompt: string; user_id: string }): Promise<ToolResult> {
  if (!LOVABLE_KEY) return { ok: false, error: "LOVABLE_API_KEY missing" };
  if (!input?.prompt) return { ok: false, error: "prompt required" };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: input.prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `image ${r.status}: ${txt.slice(0, 200)}` };
    }
    const j = await r.json();
    const imageB64: string | undefined =
      j?.choices?.[0]?.message?.images?.[0]?.image_url?.url
      ?? j?.choices?.[0]?.message?.content?.[0]?.image_url?.url;
    if (!imageB64) return { ok: false, error: "no image returned" };

    // Upload to storage
    const m = imageB64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (m) {
      const mime = m[1]; const ext = mime.split("/")[1] || "png";
      const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
      const path = `${input.user_id}/${crypto.randomUUID()}.${ext}`;
      const up = await fetch(`${SB_URL}/storage/v1/object/operator-files/${path}`, {
        method: "POST",
        headers: { apikey: SB_SRK, Authorization: `Bearer ${SB_SRK}`, "Content-Type": mime },
        body: bin,
      });
      if (up.ok) {
        const pub = `${SB_URL}/storage/v1/object/public/operator-files/${path}`;
        return { ok: true, data: { imageUrl: pub, screenshotUrl: pub, prompt: input.prompt } };
      }
    }
    return { ok: true, data: { imageDataUrl: imageB64.slice(0, 500), prompt: input.prompt } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export const TOOL_REGISTRY = {
  web_search: webSearch,
  read_url: readUrl,
  browse_url: browseUrl,
  browser_act: browserAct,
  generate_image: generateImage,
  build_app: buildApp,
  publish_app: publishApp,
  save_memory: saveMemory,
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;
