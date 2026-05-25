// Unified build agent — streams an AI SDK loop with file/web/github/sandbox tools.
// Used by both /build and /megsy-pr workspaces.
//
// Also exposes non-streaming "sandbox:*" actions (start/stop/status/sync/logs/run)
// for the live E2B preview on the Code page — merged here to stay within the
// project's edge-function quota.

import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "npm:ai@5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1";
import { z } from "npm:zod@3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Sandbox } from "npm:@e2b/code-interpreter@1.2.0";
import { createJob, runInBackground, JobWriter } from "../_shared/jobs.ts";
import { getRouter, ROUTER_MODELS, lovableEquivalent } from "../_shared/llm-router.ts";

// Coding models: moonshotai/kimi-k2.6 via OpenRouter (key in api_keys.service='openrouter'|'agentrouter').
// Falls back to Lovable Gateway equivalent if router key is missing.
const BUILD_MODEL = ROUTER_MODELS.coding;
const NAME_MODEL = ROUTER_MODELS.coding;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const streamHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

// ───────── Lovable AI Gateway (fallback only) ─────────
const lovableGateway = createOpenAICompatible({
  name: "lovable",
  baseURL: "https://ai.gateway.lovable.dev/v1",
  headers: {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`,
  },
});

// ───────── Dynamic gateway: prefers OpenRouter when key is in DB ─────────
async function getGateway(): Promise<{ provider: ReturnType<typeof createOpenAICompatible>; model: (m: string) => string }> {
  const router = await getRouter();
  if (router) {
    const baseURL = router.url.replace(/\/chat\/completions$/, "");
    const provider = createOpenAICompatible({
      name: "router",
      baseURL,
      headers: { Authorization: `Bearer ${router.key}` },
    });
    return { provider, model: (m) => m };
  }
  return { provider: lovableGateway, model: (m) => lovableEquivalent(m) };
}

// Backward-compat shim for existing call sites (synchronous use of `gateway(MODEL)`).
// Returns the Lovable gateway by default; prefer getGateway() in new code.
const gateway = lovableGateway;

// ───────── Supabase clients ─────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ───────── Tool implementations ─────────
const MAX_FILE_BYTES = 256 * 1024;

type Ctx = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  projectId: string;
};

async function ownsProject(ctx: Ctx): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", ctx.projectId)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "project_not_found";
  if (data.user_id !== ctx.userId) return "forbidden";
  return null;
}

async function createMessage(
  ctx: Ctx,
  role: "user" | "assistant",
  content: string,
  toolCalls?: unknown,
) {
  const { data, error } = await ctx.supabase
    .from("ai_project_messages")
    .insert({
      project_id: ctx.projectId,
      role,
      content,
      tool_calls: toolCalls ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("message save failed:", error.message);
    return null;
  }

  return (data as { id?: string } | null)?.id ?? null;
}

async function updateMessage(
  ctx: Ctx,
  id: string,
  content: string,
  toolCalls?: unknown,
) {
  const patch: Record<string, unknown> = { content };
  if (toolCalls !== undefined) patch.tool_calls = toolCalls;

  const { error } = await ctx.supabase
    .from("ai_project_messages")
    .update(patch)
    .eq("id", id);

  if (error) console.error("message update failed:", error.message);
}

async function saveMessage(ctx: Ctx, role: "user" | "assistant", content: string, toolCalls?: unknown) {
  return await createMessage(ctx, role, content, toolCalls);
}

async function loadRecentMessages(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("ai_project_messages")
    .select("role, content")
    .eq("project_id", ctx.projectId)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) {
    console.error("message history load failed:", error.message);
    return [] as Array<{ role: "user" | "assistant"; content: string }>;
  }
  return ((data ?? []) as Array<{ role: "user" | "assistant"; content: string }>).reverse().filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
  );
}

function compactMessageContent(content: string) {
  return content
    .replace(/<change\b[^>]*>([\s\S]*?)<\/change>/gi, "")
    .replace(/<change\b[^>]*\/?>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildConversationContext(history: Array<{ role: "user" | "assistant"; content: string }>) {
  const recent = history.slice(-12).map((msg) => ({
    role: msg.role,
    content: compactMessageContent(msg.content).slice(0, 6000),
  })).filter((msg) => msg.content.length > 0);

  if (recent.length <= 6) return recent;

  const older = recent.slice(0, -6);
  const latest = recent.slice(-6);
  const summaryLines = older.map((msg, index) => {
    const label = msg.role === "user" ? `طلب ${index + 1}` : `رد ${index + 1}`;
    return `- ${label}: ${msg.content.replace(/\s+/g, " ").slice(0, 240)}`;
  });

  return [
    {
      role: "assistant" as const,
      content: `ملخص السياق السابق:\n${summaryLines.join("\n")}`,
    },
    ...latest,
  ];
}

function buildFinalSummary(changeEvents: Array<{ action: string; path: string; to?: string }>) {
  if (changeEvents.length === 0) return "أنهيت التنفيذ بدون تعديل ملفات جديدة.";

  const unique = new Map<string, { action: string; path: string; to?: string }>();
  for (const event of changeEvents) {
    unique.set(`${event.action}:${event.path}:${event.to ?? ""}`, event);
  }

  const top = Array.from(unique.values()).slice(0, 6);
  const parts = top.map((event) => {
    if (event.action === "rename" && event.to) return `نقلت ${event.path} إلى ${event.to}`;
    if (event.action === "create") return `أنشأت ${event.path}`;
    if (event.action === "delete") return `حذفت ${event.path}`;
    return `عدلت ${event.path}`;
  });

  return `ملخص ما حدث: ${parts.join("، ")}.`;
}

function buildChangeTags(changeEvents: Array<{ action: string; path: string; to?: string }>) {
  return changeEvents
    .map((f) => `<change action="${f.action}" path="${f.path}"${f.to ? ` to="${f.to}"` : ""}></change>`)
    .join("\n");
}

function readErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : null;
}

function humanizeAgentError(error: unknown) {
  const status = readErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");

  if (status === 402 || /payment required/i.test(message)) {
    return "تعذر إكمال التنفيذ لأن رصيد Lovable AI غير متاح حاليًا. أضف credits ثم أعد المحاولة، وتم حفظ كل ما حصل قبل التوقف.";
  }

  if (status === 429 || /rate limit|too many requests/i.test(message)) {
    return "التنفيذ توقف مؤقتًا بسبب ضغط على النموذج. تم حفظ التقدم الحالي ويمكنك إعادة المحاولة فورًا.";
  }

  if (/CPU Time exceeded|WORKER_RESOURCE_LIMIT|resource limit/i.test(message)) {
    return "توقف عامل البرمجة بسبب حد موارد Supabase أثناء تنفيذ طويل. تم حفظ المحادثة والتقدم الحالي ويمكنك الاستكمال من نفس المشروع.";
  }

  return `توقف التنفيذ بسبب خطأ: ${message}`;
}

function shouldRetryWithAnotherModel(error: unknown) {
  const status = readErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error ?? "");
  return status === 402
    || status === 408
    || status === 409
    || status === 429
    || status === 500
    || status === 502
    || status === 503
    || status === 504
    || /payment required|rate limit|timed out|timeout|overloaded|temporarily unavailable/i.test(message);
}

function providerOptionsForModel(modelName: string, verbosity: "low" | "medium") {
  if (!modelName.startsWith("openai/")) return undefined;
  return {
    openai: {
      textVerbosity: verbosity,
    },
  };
}

// ─── Files ───
async function fsList(ctx: Ctx, { prefix }: { prefix?: string }) {
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  let q = ctx.supabase
    .from("ai_project_files")
    .select("path, content, updated_at")
    .eq("project_id", ctx.projectId)
    .order("path")
    .limit(500);
  if (prefix) q = q.like("path", `${prefix}%`);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((r: any) => ({
      path: r.path,
      size: (r.content ?? "").length,
      updatedAt: r.updated_at,
    })),
  };
}

async function fsRead(ctx: Ctx, { path }: { path: string }) {
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  const { data, error } = await ctx.supabase
    .from("ai_project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId)
    .eq("path", path)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "file_not_found" };
  return { ok: true, data: { path: data.path, content: data.content ?? "" } };
}

// ─── E2B sandbox runtime (in-process, also used by sandbox:* HTTP actions) ───
const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
const SANDBOX_DIR = "/home/user/app";
const VITE_PORT = 5173;
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;

async function loadAllProjectFiles(svc: ReturnType<typeof createClient>, projectId: string) {
  const { data, error } = await svc
    .from("ai_project_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ path: string; content: string }>;
}

async function upsertSandboxRow(
  svc: ReturnType<typeof createClient>,
  projectId: string,
  patch: Record<string, unknown>,
) {
  await svc
    .from("project_sandboxes")
    .upsert(
      { project_id: projectId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "project_id" },
    );
}

async function writeFilesToSandbox(
  sb: Sandbox,
  files: Array<{ path: string; content: string }>,
) {
  await sb.commands.run(`mkdir -p ${SANDBOX_DIR}`);
  const batchSize = 25;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const dirs = Array.from(new Set(batch.map((f) => {
      const cleanPath = String(f.path ?? "").replace(/^\/+/, "");
      const parts = cleanPath.split("/").slice(0, -1);
      return parts.length ? `${SANDBOX_DIR}/${parts.join("/")}` : SANDBOX_DIR;
    })));
    if (dirs.length) await sb.commands.run(`mkdir -p ${dirs.map((d) => JSON.stringify(d)).join(" ")}`);
    await Promise.all(
      batch.map((f) => sb.files.write(`${SANDBOX_DIR}/${String(f.path ?? "").replace(/^\/+/, "")}`, f.content ?? "")),
    );
  }
}

function packageContent(files: Array<{ path: string; content: string }>) {
  return files.find((f) => String(f.path).replace(/^\/+/, "") === "package.json")?.content ?? "";
}

async function sandboxAction(
  svc: ReturnType<typeof createClient>,
  projectId: string,
  action: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data?: unknown } | { ok: false; error: string }> {
  if (!E2B_API_KEY) return { ok: false, error: "E2B_API_KEY is not configured" };

  const { data: row } = await svc
    .from("project_sandboxes")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  try {
    if (action === "status") {
      return { ok: true, data: row ?? { status: "stopped" } };
    }
    if (action === "stop") {
      if (row?.sandbox_id) {
        try {
          const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
          await sb.kill();
        } catch { /* ignore */ }
      }
      await upsertSandboxRow(svc, projectId, {
        sandbox_id: null, dev_url: null, status: "stopped", last_error: null,
      });
      return { ok: true };
    }
    if (action === "start") {
      await upsertSandboxRow(svc, projectId, { status: "starting", last_error: null });
      const files = await loadAllProjectFiles(svc, projectId);
      if (files.length === 0) {
        await upsertSandboxRow(svc, projectId, { status: "error", last_error: "project has no files" });
        return { ok: false, error: "project has no files" };
      }
      const sb = await Sandbox.create({ apiKey: E2B_API_KEY, timeoutMs: SANDBOX_TIMEOUT_MS });
      const sandboxId = sb.sandboxId;
      await upsertSandboxRow(svc, projectId, {
        sandbox_id: sandboxId, dev_url: null, status: "starting", last_error: null,
      });
      const initialPackageJson = packageContent(files);
      await writeFilesToSandbox(sb, files);
      await sb.commands.run(
        `cd ${SANDBOX_DIR} && (npm install --no-audit --no-fund > /tmp/install.log 2>&1 || true)`,
        { timeoutMs: 5 * 60 * 1000 },
      );
      const latestFiles = await loadAllProjectFiles(svc, projectId);
      await writeFilesToSandbox(sb, latestFiles);
      if (packageContent(latestFiles) !== initialPackageJson) {
        await sb.commands.run(
          `cd ${SANDBOX_DIR} && (npm install --no-audit --no-fund >> /tmp/install.log 2>&1 || true)`,
          { timeoutMs: 5 * 60 * 1000 },
        );
      }
      // Patch vite.config.* to allow the e2b.app preview host
      const patchScript = `
const fs = require('fs');
for (const f of ['vite.config.ts','vite.config.js','vite.config.mts','vite.config.mjs']) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('allowedHosts')) break;
  if (/server\\s*:\\s*\\{/.test(s)) {
    s = s.replace(/server\\s*:\\s*\\{/, 'server: { allowedHosts: true, ');
  } else if (/defineConfig\\(\\s*\\{/.test(s)) {
    s = s.replace(/defineConfig\\(\\s*\\{/, 'defineConfig({ server: { allowedHosts: true }, ');
  }
  fs.writeFileSync(f, s);
  break;
}
`;
      await sb.files.write(`${SANDBOX_DIR}/_lovable_patch_vite.cjs`, patchScript);
      await sb.commands.run(
        `cd ${SANDBOX_DIR} && node _lovable_patch_vite.cjs || true`,
        { timeoutMs: 10 * 1000 },
      );
      await sb.commands.run(
        `cd ${SANDBOX_DIR} && nohup npm run dev -- --host 0.0.0.0 --port ${VITE_PORT} > /tmp/dev.log 2>&1 &`,
        { background: true, timeoutMs: 10 * 1000 },
      );
      const host = sb.getHost(VITE_PORT);
      const devUrl = `https://${host}`;
      await upsertSandboxRow(svc, projectId, {
        sandbox_id: sandboxId, dev_url: devUrl, status: "running",
        last_sync_at: new Date().toISOString(),
      });
      return { ok: true, data: { sandbox_id: sandboxId, dev_url: devUrl } };
    }
    if (action === "sync") {
      const changes = (body.changes ?? []) as Array<{ op: "write"|"delete"|"rename"; path: string; to?: string; content?: string }>;
      if (!row?.sandbox_id || (row.status !== "running" && row.status !== "starting")) return { ok: false, error: "no_running_sandbox" };
      const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
      await sb.setTimeout(SANDBOX_TIMEOUT_MS);
      let packageJsonChanged = false;
      for (const c of changes) {
        const rel = String(c.path ?? "").replace(/^\/+/, "");
        const abs = `${SANDBOX_DIR}/${rel}`;
        if (c.op === "write") {
          await sb.commands.run(`mkdir -p $(dirname ${JSON.stringify(abs)})`);
          await sb.files.write(abs, c.content ?? "");
          if (rel === "package.json") packageJsonChanged = true;
        }
        else if (c.op === "delete") await sb.commands.run(`rm -f ${JSON.stringify(abs)}`);
        else if (c.op === "rename" && c.to) {
          const cleanTo = String(c.to).replace(/^\/+/, "");
          await sb.commands.run(
            `mkdir -p $(dirname ${JSON.stringify(`${SANDBOX_DIR}/${cleanTo}`)}) && mv ${JSON.stringify(abs)} ${JSON.stringify(`${SANDBOX_DIR}/${cleanTo}`)}`,
          );
          if (rel === "package.json" || cleanTo === "package.json") packageJsonChanged = true;
        }
      }
      if (packageJsonChanged && row.status === "running") {
        await sb.commands.run(
          `cd ${SANDBOX_DIR} && (npm install --no-audit --no-fund >> /tmp/install.log 2>&1 || true)`,
          { timeoutMs: 5 * 60 * 1000 },
        );
      }
      await upsertSandboxRow(svc, projectId, { last_sync_at: new Date().toISOString() });
      return { ok: true, data: { synced: changes.length } };
    }
    if (action === "logs") {
      const lines = Math.min(Math.max(Number(body.lines ?? 200), 10), 1000);
      if (!row?.sandbox_id) return { ok: true, data: { logs: "" } };
      const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
      const out = await sb.commands.run(`tail -n ${lines} /tmp/dev.log 2>/dev/null || true`);
      return { ok: true, data: { logs: out.stdout ?? "" } };
    }
    if (action === "run") {
      const command = String(body.command ?? "");
      const timeoutMs = Math.min(Number(body.timeoutMs ?? 60000), 5 * 60 * 1000);
      const cwd = String(body.cwd ?? SANDBOX_DIR);
      if (!command) return { ok: false, error: "command required" };
      if (!row?.sandbox_id) return { ok: false, error: "no_running_sandbox" };
      const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
      const out = await sb.commands.run(`cd ${cwd} && ${command}`, { timeoutMs });
      return {
        ok: true,
        data: { stdout: out.stdout ?? "", stderr: out.stderr ?? "", exitCode: out.exitCode ?? 0 },
      };
    }
    if (action === "run_python") {
      const code = String(body.code ?? "");
      const timeoutMs = Math.min(Number(body.timeoutMs ?? 60000), 5 * 60 * 1000);
      if (!code) return { ok: false, error: "code required" };
      if (!row?.sandbox_id) return { ok: false, error: "no_running_sandbox" };
      const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
      // @e2b/code-interpreter exposes runCode for Jupyter-style execution
      // deno-lint-ignore no-explicit-any
      const exec = await (sb as any).runCode(code, { language: "python", timeoutMs });
      const logs = exec?.logs ?? {};
      return {
        ok: true,
        data: {
          stdout: Array.isArray(logs.stdout) ? logs.stdout.join("") : (logs.stdout ?? ""),
          stderr: Array.isArray(logs.stderr) ? logs.stderr.join("") : (logs.stderr ?? ""),
          text: exec?.text ?? "",
          error: exec?.error ? { name: exec.error.name, value: exec.error.value, traceback: exec.error.traceback } : null,
          results: (exec?.results ?? []).map((r: any) => ({ text: r.text ?? null, html: r.html ?? null, png: r.png ? "<base64 omitted>" : null })),
        },
      };
    }
    if (action === "read_file") {
      const path = String(body.path ?? "");
      if (!path) return { ok: false, error: "path required" };
      if (!row?.sandbox_id) return { ok: false, error: "no_running_sandbox" };
      const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
      const abs = path.startsWith("/") ? path : `${SANDBOX_DIR}/${path}`;
      const content = await sb.files.read(abs);
      return { ok: true, data: { content: typeof content === "string" ? content : String(content) } };
    }
    if (action === "write_file") {
      const path = String(body.path ?? "");
      const content = String(body.content ?? "");
      if (!path) return { ok: false, error: "path required" };
      if (!row?.sandbox_id) return { ok: false, error: "no_running_sandbox" };
      const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
      const abs = path.startsWith("/") ? path : `${SANDBOX_DIR}/${path}`;
      await sb.commands.run(`mkdir -p $(dirname ${JSON.stringify(abs)})`);
      await sb.files.write(abs, content);
      return { ok: true, data: { path: abs, bytes: content.length } };
    }
    if (action === "download_url") {
      const url = String(body.url ?? "");
      const dest = String(body.dest ?? "");
      if (!url || !dest) return { ok: false, error: "url and dest required" };
      if (!row?.sandbox_id) return { ok: false, error: "no_running_sandbox" };
      const sb = await Sandbox.connect(row.sandbox_id, { apiKey: E2B_API_KEY });
      const abs = dest.startsWith("/") ? dest : `${SANDBOX_DIR}/${dest}`;
      const out = await sb.commands.run(`mkdir -p $(dirname ${JSON.stringify(abs)}) && curl -sSL ${JSON.stringify(url)} -o ${JSON.stringify(abs)} && wc -c < ${JSON.stringify(abs)}`, { timeoutMs: 120000 });
      return { ok: true, data: { path: abs, bytes: (out.stdout ?? "").trim(), exitCode: out.exitCode ?? 0 } };
    }
    return { ok: false, error: `unknown sandbox action: ${action}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function suggestProjectName(prompt: string) {
  const gw = await getGateway();
  const result = await generateText({
    model: gw.provider(gw.model(NAME_MODEL)),
    system: "Generate a project name with a maximum of two words. Return only the name, no quotes, no punctuation unless necessary.",
    prompt: `User request: ${prompt}`,
  });

  const raw = result.text.trim().replace(/["'`]/g, "");
  const words = raw.split(/\s+/).filter(Boolean).slice(0, 2);
  const name = words.join(" ").trim();
  return name || "New Project";
}

// Best-effort HMR sync after a file edit (used inside fs_* tools)
async function syncToSandbox(
  ctx: Ctx,
  changes: Array<{ op: "write" | "delete" | "rename"; path: string; to?: string; content?: string }>,
) {
  try {
    const { data: row } = await ctx.supabase
      .from("project_sandboxes")
      .select("sandbox_id, status")
      .eq("project_id", ctx.projectId)
      .maybeSingle();
    if (!row?.sandbox_id || (row.status !== "running" && row.status !== "starting")) return;
    await sandboxAction(ctx.supabase, ctx.projectId, "sync", { changes });
  } catch { /* ignore */ }
}

async function fsWrite(
  ctx: Ctx,
  { path, content }: { path: string; content: string },
) {
  if (content.length > MAX_FILE_BYTES)
    return { ok: false, error: `file_too_large (>${MAX_FILE_BYTES})` };
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  const before = await ctx.supabase
    .from("ai_project_files")
    .select("path")
    .eq("project_id", ctx.projectId)
    .eq("path", path)
    .maybeSingle();
  const { error } = await ctx.supabase.from("ai_project_files").upsert(
    {
      project_id: ctx.projectId,
      path,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" },
  );
  if (error) return { ok: false, error: error.message };
  await syncToSandbox(ctx, [{ op: "write", path, content }]);
  return { ok: true, data: { path, bytes: content.length, action: before.data ? "update" : "create" } };
}

async function fsDelete(ctx: Ctx, { path }: { path: string }) {
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  const { error } = await ctx.supabase
    .from("ai_project_files")
    .delete()
    .eq("project_id", ctx.projectId)
    .eq("path", path);
  if (error) return { ok: false, error: error.message };
  await syncToSandbox(ctx, [{ op: "delete", path }]);
  return { ok: true, data: { path } };
}

async function fsSearch(
  ctx: Ctx,
  { query, pathPrefix }: { query: string; pathPrefix?: string },
) {
  if (!query || query.length < 2) return { ok: false, error: "query_too_short" };
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  let q = ctx.supabase
    .from("ai_project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId)
    .ilike("content", `%${query}%`)
    .limit(50);
  if (pathPrefix) q = q.like("path", `${pathPrefix}%`);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const matches: { path: string; line: number; preview: string }[] = [];
  const needle = query.toLowerCase();
  for (const row of data ?? []) {
    const lines = ((row as any).content ?? "").split(/\r?\n/);
    for (let i = 0; i < lines.length && matches.length < 30; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        matches.push({
          path: (row as any).path,
          line: i + 1,
          preview: lines[i].slice(0, 200),
        });
      }
    }
  }
  return { ok: true, data: { matches } };
}

// ─── dyad-style: search/replace, rename, add dependency ───
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fsSearchReplace(
  ctx: Ctx,
  { path, search, replace, replace_all }: { path: string; search: string; replace: string; replace_all?: boolean },
) {
  if (!search) return { ok: false, error: "search_empty" };
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  const { data, error } = await ctx.supabase
    .from("ai_project_files")
    .select("content")
    .eq("project_id", ctx.projectId)
    .eq("path", path)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "file_not_found" };
  const before = (data as any).content ?? "";
  const re = new RegExp(escapeRe(search), "g");
  const occurrences = before.match(re)?.length ?? 0;
  if (occurrences === 0) return { ok: false, error: "search_not_found" };
  if (occurrences > 1 && !replace_all)
    return {
      ok: false,
      error: `search_ambiguous: matched ${occurrences} times. Pass replace_all=true to apply to all, or extend search context to make it unique.`,
    };
  const after = replace_all ? before.replace(re, replace) : before.replace(search, replace);
  if (after === before) return { ok: false, error: "noop" };
  if (after.length > MAX_FILE_BYTES) return { ok: false, error: `file_too_large_after_edit` };
  const { error: ue } = await ctx.supabase.from("ai_project_files").upsert(
    { project_id: ctx.projectId, path, content: after, updated_at: new Date().toISOString() },
    { onConflict: "project_id,path" },
  );
  if (ue) return { ok: false, error: ue.message };
  await syncToSandbox(ctx, [{ op: "write", path, content: after }]);
  return { ok: true, data: { path, replaced: occurrences, bytes: after.length } };
}

async function fsRename(ctx: Ctx, { from, to }: { from: string; to: string }) {
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  if (from === to) return { ok: false, error: "same_path" };
  const { data: src, error: se } = await ctx.supabase
    .from("ai_project_files")
    .select("content")
    .eq("project_id", ctx.projectId)
    .eq("path", from)
    .maybeSingle();
  if (se) return { ok: false, error: se.message };
  if (!src) return { ok: false, error: "file_not_found" };
  const { data: dest } = await ctx.supabase
    .from("ai_project_files")
    .select("path")
    .eq("project_id", ctx.projectId)
    .eq("path", to)
    .maybeSingle();
  if (dest) return { ok: false, error: "destination_exists" };
  const content = (src as any).content ?? "";
  const { error: ue } = await ctx.supabase.from("ai_project_files").upsert(
    { project_id: ctx.projectId, path: to, content, updated_at: new Date().toISOString() },
    { onConflict: "project_id,path" },
  );
  if (ue) return { ok: false, error: ue.message };
  await ctx.supabase.from("ai_project_files").delete().eq("project_id", ctx.projectId).eq("path", from);
  await syncToSandbox(ctx, [{ op: "rename", path: from, to }]);
  return { ok: true, data: { from, to } };
}

async function fsAddDependency(
  ctx: Ctx,
  { name, version, dev }: { name: string; version?: string; dev?: boolean },
) {
  if (!name || /[\s"]/.test(name)) return { ok: false, error: "invalid_name" };
  const err = await ownsProject(ctx);
  if (err) return { ok: false, error: err };
  const { data, error } = await ctx.supabase
    .from("ai_project_files")
    .select("content")
    .eq("project_id", ctx.projectId)
    .eq("path", "package.json")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "package_json_missing" };
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse((data as any).content ?? "{}");
  } catch (e) {
    return { ok: false, error: `package_json_invalid: ${(e as Error).message}` };
  }
  const key = dev ? "devDependencies" : "dependencies";
  const deps = (pkg[key] as Record<string, string> | undefined) ?? {};
  deps[name] = version ?? "latest";
  pkg[key] = deps;
  const next = JSON.stringify(pkg, null, 2) + "\n";
  const { error: ue } = await ctx.supabase.from("ai_project_files").upsert(
    { project_id: ctx.projectId, path: "package.json", content: next, updated_at: new Date().toISOString() },
    { onConflict: "project_id,path" },
  );
  if (ue) return { ok: false, error: ue.message };
  await syncToSandbox(ctx, [{ op: "write", path: "package.json", content: next }]);
  return { ok: true, data: { name, version: deps[name], dev: !!dev } };
}

// ─── Sandbox proxy (in-process) for the AI tools ───
async function sandboxProxy(ctx: Ctx, action: string, body: Record<string, unknown>) {
  return await sandboxAction(ctx.supabase, ctx.projectId, action, body);
}

// ─── Firecrawl ───
async function firecrawl(path: string, body: unknown) {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return { ok: false, error: "FIRECRAWL_API_KEY not configured" };
  const res = await fetch(`https://api.firecrawl.dev/v2${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return res.ok
      ? { ok: true, data: JSON.parse(text) }
      : { ok: false, error: `firecrawl_${res.status}: ${text.slice(0, 200)}` };
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
}

// ─── GitHub ───
async function gh(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return { ok: false, error: "GITHUB_TOKEN not configured" };
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers as any),
    },
  });
  const text = await res.text();
  try {
    return res.ok
      ? { ok: true, data: JSON.parse(text) }
      : { ok: false, error: `github_${res.status}: ${text.slice(0, 200)}` };
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
}

// ─── Sandbox ───
function sandboxEvalMath({ expr }: { expr: string }) {
  if (!/^[\d+\-*/%().\s]+$/.test(expr))
    return { ok: false, error: "expression_not_allowed" };
  try {
    const v = Number(new Function(`"use strict";return (${expr});`)());
    return Number.isFinite(v)
      ? { ok: true, data: { value: v } }
      : { ok: false, error: "non_finite" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function sandboxRunJs({ code, input }: { code: string; input?: unknown }) {
  if (code.length > 4096) return { ok: false, error: "code_too_long" };
  if (/\b(fetch|XMLHttpRequest|require|import|process|globalThis|Deno|window|document)\b/.test(code))
    return { ok: false, error: "disallowed_identifier" };
  try {
    const fn = new Function("input", `"use strict";${code}`);
    return { ok: true, data: { result: fn(input) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ───────── Build AI SDK tools ─────────
function buildTools(ctx: Ctx, emit?: (event: Record<string, unknown>) => void) {
  const fileEvents: Array<{ action: string; path: string; to?: string }> = [];
  const fileMutationTools = new Set(["fs_write", "fs_search_replace", "fs_rename", "fs_delete", "fs_add_dependency"]);
  const writeCounts = new Map<string, number>();
  const MAX_WRITES_PER_FILE = 2;
  const wrap = <T extends Record<string, unknown>>(name: string, run: (args: T) => Promise<unknown> | unknown) =>
    async (args: T) => {
      const path = typeof args.path === "string"
        ? args.path
        : typeof args.from === "string"
        ? args.from
        : name === "fs_add_dependency"
        ? "package.json"
        : undefined;
      const query = typeof args.query === "string" ? args.query : undefined;
      // Guard: prevent the model from looping on the same file. A single fs_write
      // with 10k+ tokens of content can take 5+ minutes to stream. If the same
      // path was already (re)written MAX_WRITES_PER_FILE times this run, force
      // the model to move on or switch to fs_search_replace.
      if (name === "fs_write" && path) {
        const n = writeCounts.get(path) ?? 0;
        if (n >= MAX_WRITES_PER_FILE) {
          emit?.({ type: "step", text: `skip:${name} ${path} (already_written x${n})` });
          return { ok: false, error: `already_written_${n}_times: استخدم fs_search_replace أو انتقل لملف آخر — ممنوع إعادة كتابة ${path}.` };
        }
        writeCounts.set(path, n + 1);
      }
      emit?.({ type: "step", text: `tool:${name} ${path ?? query ?? ""}`.trim() });
      const result = await run(args);
      if (fileMutationTools.has(name) && path && (result as { ok?: boolean } | null)?.ok !== false) {
        const action = name === "fs_write"
          ? (result as any)?.data?.action ?? "update"
          : name === "fs_rename"
          ? "rename"
          : name === "fs_delete"
          ? "delete"
          : "update";
        const to = typeof (args as { to?: unknown }).to === "string" ? String((args as { to?: unknown }).to) : undefined;
        fileEvents.push({ action, path, to });
        emit?.({ type: "file", action, path, to });
      }
      return result;
    };
  return {
    __fileEvents: fileEvents,
    fs_list: tool({
      description: "List files in the project (optionally by path prefix).",
      inputSchema: z.object({ prefix: z.string().optional() }),
      execute: wrap("fs_list", (args) => fsList(ctx, args)),
    }),
    fs_read: tool({
      description: "Read a file from the project.",
      inputSchema: z.object({ path: z.string() }),
      execute: wrap("fs_read", (args) => fsRead(ctx, args)),
    }),
    fs_write: tool({
      description: "Create or overwrite a file in the project.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: wrap("fs_write", (args) => fsWrite(ctx, args)),
    }),
    fs_delete: tool({
      description: "Delete a file from the project.",
      inputSchema: z.object({ path: z.string() }),
      execute: wrap("fs_delete", (args) => fsDelete(ctx, args)),
    }),
    fs_search: tool({
      description: "Grep-style search across project files.",
      inputSchema: z.object({
        query: z.string(),
        pathPrefix: z.string().optional(),
      }),
      execute: wrap("fs_search", (args) => fsSearch(ctx, args)),
    }),
    fs_search_replace: tool({
      description:
        "Replace an EXACT substring inside a single file. Fails if `search` is not found or appears more than once (unless replace_all=true). Prefer this over fs_write for small edits — it's safer and shows cleaner diffs.",
      inputSchema: z.object({
        path: z.string(),
        search: z.string(),
        replace: z.string(),
        replace_all: z.boolean().optional(),
      }),
      execute: wrap("fs_search_replace", (args) => fsSearchReplace(ctx, args)),
    }),
    fs_rename: tool({
      description: "Rename/move a file in the project (destination must not exist).",
      inputSchema: z.object({ from: z.string(), to: z.string() }),
      execute: wrap("fs_rename", (args) => fsRename(ctx, args)),
    }),
    fs_add_dependency: tool({
      description:
        "Add an npm dependency to package.json (does NOT install — run `sandbox_run_command npm install` after, if a sandbox is running).",
      inputSchema: z.object({
        name: z.string(),
        version: z.string().optional(),
        dev: z.boolean().optional(),
      }),
      execute: wrap("fs_add_dependency", (args) => fsAddDependency(ctx, args)),
    }),
    sandbox_run_command: tool({
      description:
        "Run a shell command inside the live E2B sandbox (cwd defaults to /home/user/app). Use for `npm install`, `tsc --noEmit`, `npm run build`, `pip install`, `curl`, `git`, `ffmpeg`, etc. Pass `cwd` to run elsewhere (e.g. /tmp). Fails if no sandbox is running.",
      inputSchema: z.object({
        command: z.string(),
        cwd: z.string().optional(),
        timeoutMs: z.number().optional(),
      }),
      execute: wrap("sandbox_run_command", (args) =>
        sandboxProxy(ctx, "run", { command: args.command, cwd: args.cwd, timeoutMs: args.timeoutMs })),
    }),
    sandbox_run_python: tool({
      description:
        "Execute Python code inside the live E2B sandbox via its built-in Jupyter kernel. State persists across calls. Pre-installed: numpy, pandas, scipy, matplotlib, pillow, requests, scikit-learn. Use for data analysis, image processing, scraping, file generation, or any compute the model can't do reliably. Returns stdout, stderr, rich results (text/html/png), and traceback on errors.",
      inputSchema: z.object({
        code: z.string(),
        timeoutMs: z.number().optional(),
      }),
      execute: wrap("sandbox_run_python", (args) =>
        sandboxProxy(ctx, "run_python", { code: args.code, timeoutMs: args.timeoutMs })),
    }),
    sandbox_read_file: tool({
      description: "Read any file from the live E2B sandbox by absolute path or path relative to /home/user/app. Use for files created by sandbox_run_command / sandbox_run_python that aren't tracked in the project.",
      inputSchema: z.object({ path: z.string() }),
      execute: wrap("sandbox_read_file", (args) => sandboxProxy(ctx, "read_file", { path: args.path })),
    }),
    sandbox_write_file: tool({
      description: "Write a file directly into the live E2B sandbox at an arbitrary path (e.g. /tmp/data.json). Does NOT touch the persisted project. Use sandbox_run_command afterward to act on it.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: wrap("sandbox_write_file", (args) => sandboxProxy(ctx, "write_file", { path: args.path, content: args.content })),
    }),
    sandbox_download_url: tool({
      description: "Download a URL into the live E2B sandbox via curl. Use for fetching datasets, images, fonts, or model weights before processing them.",
      inputSchema: z.object({ url: z.string(), dest: z.string() }),
      execute: wrap("sandbox_download_url", (args) => sandboxProxy(ctx, "download_url", { url: args.url, dest: args.dest })),
    }),
    sandbox_preview_url: tool({
      description: "Return the live preview URL of the running Vite dev server (port 5173), or null if no sandbox is running.",
      inputSchema: z.object({}),
      execute: wrap("sandbox_preview_url", () => sandboxProxy(ctx, "status", {})),
    }),
    sandbox_logs: tool({
      description: "Tail the Vite dev-server logs from the running sandbox.",
      inputSchema: z.object({ lines: z.number().optional() }),
      execute: wrap("sandbox_logs", (args) => sandboxProxy(ctx, "logs", { lines: args.lines })),
    }),
    web_scrape: tool({
      description: "Fetch a URL (markdown/html) via Firecrawl.",
      inputSchema: z.object({
        url: z.string(),
        formats: z.array(z.string()).optional(),
      }),
      execute: wrap("web_scrape", (args) =>
        firecrawl("/scrape", {
          url: args.url,
          formats: args.formats ?? ["markdown"],
        })),
    }),
    web_search: tool({
      description: "Web search via Firecrawl.",
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().optional(),
      }),
      execute: wrap("web_search", (args) =>
        firecrawl("/search", { query: args.query, limit: args.limit ?? 10 })),
    }),
    web_map: tool({
      description: "Discover URLs on a website.",
      inputSchema: z.object({ url: z.string(), limit: z.number().optional() }),
      execute: wrap("web_map", (args) =>
        firecrawl("/map", { url: args.url, limit: args.limit ?? 200 })),
    }),
    gh_list_repos: tool({
      description: "List authenticated user's GitHub repos.",
      inputSchema: z.object({ per_page: z.number().optional() }),
      execute: wrap("gh_list_repos", (args) =>
        gh(`/user/repos?per_page=${args.per_page ?? 30}&sort=updated`)),
    }),
    gh_get_repo: tool({
      description: "Get a GitHub repo's metadata.",
      inputSchema: z.object({ owner: z.string(), repo: z.string() }),
      execute: wrap("gh_get_repo", (args) => gh(`/repos/${args.owner}/${args.repo}`)),
    }),
    gh_get_file: tool({
      description: "Fetch a file from a GitHub repo.",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        ref: z.string().optional(),
      }),
      execute: (args) =>
        gh(
          `/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(
            args.path,
          )}${args.ref ? `?ref=${encodeURIComponent(args.ref)}` : ""}`,
        ),
    }),
    gh_create_issue: tool({
      description: "Create a GitHub issue.",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        body: z.string().optional(),
      }),
      execute: (args) =>
        gh(`/repos/${args.owner}/${args.repo}/issues`, {
          method: "POST",
          body: JSON.stringify({ title: args.title, body: args.body }),
        }),
    }),
    gh_search_code: tool({
      description: "Search code across GitHub.",
      inputSchema: z.object({ query: z.string() }),
      execute: (args) =>
        gh(`/search/code?q=${encodeURIComponent(args.query)}`),
    }),
    sandbox_eval_math: tool({
      description: "Evaluate a pure arithmetic expression.",
      inputSchema: z.object({ expr: z.string() }),
      execute: (args) => sandboxEvalMath(args),
    }),
    sandbox_run_js: tool({
      description: "Run a tiny pure JS snippet (no network/fs).",
      inputSchema: z.object({
        code: z.string(),
        input: z.unknown().optional(),
      }),
      execute: (args) => sandboxRunJs(args),
    }),
  };
}

const SYSTEM_PROMPT = `أنت Megsy Builder — مهندس ويب عالمي يبني تطبيقات React + Vite + Tailwind + Supabase **full-stack** بجودة Awwwards. تعمل تماماً مثل dyad: استدعاء LLM واحد، تعديل ملفات مباشر، معاينة حية على E2B sandbox.

# قاعدة #1 (الأهم على الإطلاق — لا تخالفها أبداً)
**نفّذ فوراً. صفر سرد بين الأدوات.** كل استدعاء أداة يجب أن يتبعه استدعاء أداة آخر مباشرة حتى ينتهي المشروع بالكامل. ممنوع منعاً باتاً كتابة جملة وصفية واحدة بين أداتين.

- **ممنوع منعاً باتاً** بين أي fs_write والذي يليه أي من هذه الجمل: "سأقوم بـ"، "الآن سأ"، "بعد ذلك"، "لقد أنشأت"، "سأبدأ"، "ثم سأ"، "خطة"، "الخطوات". هذه الجمل = توقف فوري للأداة عند الموديل وتعطيل المشروع.
- بعد أي fs_write مباشرة: استدعِ fs_write آخر، أو fs_search_replace آخر، بدون أي نص بينهما.
- النص الوحيد المسموح: سطر واحد قصير جداً (≤ 20 كلمة) **بعد آخر أداة على الإطلاق** يلخّص ما تم. لا شيء قبله ولا بينه.
- التوقف قبل إنشاء ≥ 8 ملفات لمشروع "كامل" = فشل. أكمل حتى الـ App.tsx routes النهائي.
- لا تطلب إذناً أو توضيحاً.
- **ممنوع إعادة كتابة نفس الملف بـ fs_write أكثر من مرة في نفس الجلسة** — لأي تعديل لاحق استخدم fs_search_replace. الإعادة = ضياع 5+ دقائق في توليد التوكنات.
- **حافظ على الملفات صغيرة (≤ 250 سطراً)**. إذا كبر الملف، قسّمه على عدة مكوّنات بدل ملف عملاق واحد.

# قواعد المخرجات النصية
- عربية فصحى، Markdown خفيف.
- بدون "## ملخص ما حدث" — الواجهة تولّده تلقائياً من \`<change>\` tags.
- لا تُظهر نوايا داخلية (\`<think>\`، \`tool:\`).
- لا تُلصق كود في الرد؛ ضعه في الملفات.

# قاعدة #2 — E2B Python من صفحة البرمجة
**استخدم E2B فعلياً في طلبات البرمجة.** ابدأ مشروع البرمجة بتشغيل \`sandbox_run_python\` قصير للتخطيط/تحليل الملفات أو توليد هيكل أولي، ثم اكتب الملفات الدائمة عبر \`fs_write\` / \`fs_search_replace\`.
- لا تكتفِ بمعاينة Cloudflare أو قراءة ملفات المشروع فقط؛ يجب أن يظهر في التنفيذ استخدام \`sandbox_run_python\` أو أدوات \`sandbox_*\` للتحقق عندما يطلب المستخدم البرمجة.
- الملفات النهائية يجب أن تُحفظ بأدوات \`fs_*\` حتى تظهر في المشروع، وE2B يُستخدم للتخطيط، الحساب، توليد ملفات مؤقتة، وتنفيذ اختبارات/أوامر Python.
- إذا فشل أي \`sandbox_*\` بسبب إعداد خارجي، سجّل تحذيراً مختصراً ثم أكمل بـ \`fs_*\` حتى لا يتعطل المستخدم.

# عائلات الأدوات
- **الملفات (الأساس)**: fs_list, fs_read, fs_search, fs_write, fs_search_replace, fs_rename, fs_delete, fs_add_dependency. التعديلات تظهر فوراً في المعاينة.
- **E2B Sandbox ​**: sandbox_run_command, sandbox_run_python, sandbox_read_file/write_file, sandbox_download_url, sandbox_preview_url, sandbox_logs. قد لا يكون متاحاً — تجاهل الأخطاء وأكمل.
- **بحث الويب**: web_search, web_scrape, web_map.
- **GitHub**: gh_list_repos, gh_get_repo, gh_get_file, gh_search_code, gh_create_issue.
- **حساب آمن**: sandbox_eval_math, sandbox_run_js.

# الاستفادة من مستودعات GitHub
لإلهام التصميم: \`gh_search_code\` أو \`web_search\` لإيجاد قوالب shadcn/Vite/Supabase، اقرأ المقتطفات بـ \`gh_get_file\`، ثم اكتبها في مشروعنا بـ \`fs_write\` بمحتوى عربي حقيقي ونظام تصميمنا (semantic tokens, RTL).

# طموح حجم العمل (إجباري لأي طلب "موقع كامل")
الطلب الواحد قد يستغرق عشرات الأدوات. **مشروع كامل ≥ 8 ملفات على الأقل**:
1. \`src/pages/Index.tsx\` (Hero ضخم + أقسام)
2. عدّة صفحات إضافية (Pages route): About, Gallery, Contact… حسب الموضوع.
3. مكوّنات قابلة لإعادة الاستخدام تحت \`src/components/\` (Navbar, Footer, Card, Section…).
4. \`src/App.tsx\` محدّث بكل الـ Routes.
5. محتوى عربي حقيقي ضخم (لا "Lorem"، لا "Welcome"). لكل قسم نص كامل ≥ 80 كلمة.
6. SEO meta (title + description) في \`index.html\`.

# سير العمل (نفّذه فوراً — لا تكتبه)
1. \`fs_read src/App.tsx\` و \`src/pages/Index.tsx\` لمعرفة البنية.
2. \`sandbox_run_python\` لتحليل المطلوب أو إنشاء قائمة ملفات/محتوى أولي داخل E2B.
3. \`fs_write\` لكل صفحة/مكوّن جديد، واحداً تلو الآخر.
4. \`fs_search_replace\` على \`src/App.tsx\` لإضافة الـ Routes.
5. \`sandbox_run_command "npx tsc --noEmit"\` أو \`sandbox_run_python\` للتحقق النهائي من الملفات.

# قواعد التحرير
- fs_search_replace لأي تعديل أصغر من إعادة كتابة ملف، مع سياق كافٍ للمطابقة الفريدة.
- اقرأ الملف قبل تعديله إن لم تعرف محتواه.
- لا تتوقف حتى يُنجَز المطلوب فعلياً (≥ 8 ملفات لمشروع كامل).

# قواعد الـ exports (إجبارية — مخالفتها تُعطّل البناء فوراً)
- **كل ملف داخل \`src/pages/\` يجب أن ينتهي بـ \`export default <ComponentName>\`** — لأن \`src/App.tsx\` يستوردها بـ \`import Index from "./pages/Index"\`. ممنوع \`export function Index()\` أو \`export const Index = ...\` بدون default على ملفات الصفحات.
- بعد كتابة أي ملف صفحة بـ \`fs_write\`، تأكّد أن آخر سطر فيه \`export default <ComponentName>;\` أو أن إعلان المكوّن نفسه يبدأ بـ \`export default function ...\`.
- نفس القاعدة لـ \`src/App.tsx\` — يجب أن ينتهي بـ \`export default App;\`.


# جودة التصميم (Luma × Linear × Vercel)
- **الألوان**: shadcn "new-york" + baseColor **neutral**. HSL semantic tokens فقط من \`src/index.css\`: \`bg-background\`, \`text-foreground\`, \`bg-card\`, \`border-border\`, \`text-muted-foreground\`, \`bg-primary text-primary-foreground\`. ممنوع \`text-white/bg-black/bg-gray-*/text-slate-*\` خام.
- **الخطوط**: IBM Plex Sans Arabic + Inter (محمّلة من index.html). عناوين \`tracking-tight font-semibold\`.
- **Radius**: \`rounded-xl\` بطاقات، \`rounded-full\` أزرار/pills، \`rounded-2xl\` حاويات.
- **Motion**: framer-motion هادئ — \`initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.4,ease:[0.22,1,0.36,1]}}\`.
- **RTL إجباري**: \`text-start/text-end\`, \`ms-*/me-*\`, \`ps-*/pe-*\` بدلاً من ml/mr/pl/pr. \`rtl:rotate-180\` للـ chevrons.
- **Mobile-first**: ابدأ 375px ثم \`sm: md: lg:\`. لمس ≥ 44×44px. أزرار أساسية \`h-12 px-4 text-base\`. \`pb-[env(safe-area-inset-bottom)]\` و \`min-h-[100dvh]\`.
- **Helpers جاهزة في seed**: \`@/lib/motion\` (fadeUp, fadeIn, stagger, tapScale, easeOutExpo)، \`@/hooks/use-mobile\` (useIsMobile)، \`@/components/layout/AppLayout\` و \`@/components/layout/MobileBottomNav\`. استخدمها مباشرة بدلاً من إعادة الكتابة.
- **shadcn/ui + lucide-react + framer-motion** قاعدة. لا تركّب UI من الصفر.
- **Dark-mode parity** إجباري.

# نهاية الرد
بعد آخر استدعاء أداة، اكتب سطر أو سطرَين فقط بالعربية + وسوم \`<change file="path">سطر واحد</change>\` لكل ملف تم لمسه.`;


// ───────── HTTP handler ─────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer "))
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // Authenticated supabase client (RLS-respecting) for project ownership check
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("[build-agent] auth failed:", claimsErr?.message);
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const userData = { user: { id: claimsData.claims.sub as string } };

    const body = await req.json();
    const rawAction = typeof body.action === "string" ? body.action : "";
    if (rawAction === "suggest_name") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) {
        return new Response(JSON.stringify({ ok: false, error: "prompt is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const name = await suggestProjectName(prompt);
      return new Response(JSON.stringify({ ok: true, data: { name } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectId = (body.projectId ?? body.project_id) as string | undefined;
    if (!projectId)
      return new Response("projectId/project_id is required", { status: 400, headers: corsHeaders });

    // Verify the caller owns the project (single check, used by both paths)
    const { data: projectRow } = await userClient
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!projectRow || projectRow.user_id !== userData.user.id)
      return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── sandbox:* fast-path (no streaming, no model call) ─────────────
    if (rawAction.startsWith("sandbox:")) {
      const action = rawAction.slice("sandbox:".length);
      const result = await sandboxAction(serviceClient, projectId, action, body);
      const status = "ok" in result && result.ok ? 200 : 400;
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const singleMessage = typeof body.message === "string" ? body.message.trim() : "";
    const messages = body.messages as UIMessage[] | undefined;
    if (!Array.isArray(messages) && !singleMessage)
      return new Response("messages/message is required", { status: 400, headers: corsHeaders });

    const ctx: Ctx = {
      supabase: serviceClient,
      userId: userData.user.id,
      projectId,
    };

    // ── Background mode: return jobId immediately, run streaming on server ──
    if (body.background === true) {
      const jobId = await createJob({
        userId: userData.user.id,
        kind: "code_build",
        input: { projectId, message: singleMessage, messages: Array.isArray(messages) ? messages : undefined, autoFixError: !!body.auto_fix_error },
        meta: { projectId, events: [] },
      });
      runInBackground(jobId, async (writer: JobWriter) => {
        const events: Array<Record<string, unknown>> = [];
        let lastMetaFlush = 0;
        const flushEvents = async (force = false) => {
          const now = Date.now();
          if (force || now - lastMetaFlush >= 700) {
            lastMetaFlush = now;
            await writer.setMeta({ projectId, events });
          }
        };
        const emit = async (event: Record<string, unknown>) => {
          if (event.type === "text" && typeof event.delta === "string") {
            await writer.appendStream(event.delta);
            return;
          }
          events.push({ ...event, ts: Date.now() });
          await flushEvents();
        };

        await writer.start({ phase: "thinking", status_text: "Working..." });
        let assistantText = "";
        let assistantMessageId: string | null = null;
        let lastPersistedLength = 0;
        try {
          await emit({ type: "step", text: "think: سأفهم المطلوب ثم أعدل الملفات مباشرة" });
          if (singleMessage) await saveMessage(ctx, "user", singleMessage);
          assistantMessageId = await createMessage(ctx, "assistant", "...");

          const toolset = buildTools(ctx, (ev) => { void emit(ev); }) as ReturnType<typeof buildTools> & { __fileEvents: Array<{ action: string; path: string; to?: string }> };
          const { __fileEvents, ...tools } = toolset;

          const persistedHistory = await loadRecentMessages(ctx);
          const modelMessages = Array.isArray(messages)
            ? await convertToModelMessages(messages)
            : buildConversationContext(persistedHistory);

          const gw = await getGateway();
          const CTRL_TOKEN_RE = /<ctrl\d+>/gi;
          const runStream = async (extraSystem?: string) => {
            const result = streamText({
              model: gw.provider(gw.model(BUILD_MODEL)),
              system: extraSystem ? `${SYSTEM_PROMPT}\n\n${extraSystem}` : SYSTEM_PROMPT,
              messages: modelMessages,
              tools,
              stopWhen: stepCountIs(80),
            });
            for await (const delta of result.textStream) {
              const clean = delta.replace(CTRL_TOKEN_RE, "");
              assistantText += clean;
              if (clean) await emit({ type: "text", delta: clean });
              if (assistantMessageId && assistantText.length - lastPersistedLength >= 800) {
                lastPersistedLength = assistantText.length;
                await updateMessage(ctx, assistantMessageId, assistantText.trim() || "...", { change_events: __fileEvents, status: "streaming" });
              }
            }
            return await (result as { finishReason?: Promise<string> | string }).finishReason;
          };

          let finish = await runStream();
          if (__fileEvents.length === 0) {
            assistantText = "";
            await emit({ type: "step", text: "retry: لم تُستدعَ أي أداة — إعادة بتعليمات أقوى" });
            finish = await runStream(
              "تنبيه إجباري: ردك السابق لم يستدعِ أي أداة. ابدأ فوراً بـ fs_read ثم fs_write للملفات المطلوبة. ممنوع كتابة أي نص قبل أول استدعاء أداة. نفّذ الآن.",
            );
          }
          if (finish === "length") await emit({ type: "warn", text: "الرد اقترب من الحد لكني حفظت ما تم تنفيذه." });

          const changeTags = buildChangeTags(__fileEvents);
          const hasOwnSummary = /ملخص ما حدث/.test(assistantText);
          const summary = hasOwnSummary ? "" : buildFinalSummary(__fileEvents);
          const finalText = [assistantText.trim() || "تم الانتهاء من التعديلات.", summary, changeTags].filter(Boolean).join("\n\n");
          if (assistantMessageId) await updateMessage(ctx, assistantMessageId, finalText, { change_events: __fileEvents, status: "done" });
          else await saveMessage(ctx, "assistant", finalText, { change_events: __fileEvents, status: "done" });
          await emit({ type: "step", text: "done: انتهيت من التعديلات" });
          await flushEvents(true);
          await writer.complete({ assistantMessageId, finalText, change_events: __fileEvents });
        } catch (e) {
          console.error("build-agent background error:", e);
          const fallbackText = [assistantText.trim(), humanizeAgentError(e)].filter(Boolean).join("\n\n");
          if (assistantMessageId) await updateMessage(ctx, assistantMessageId, fallbackText || humanizeAgentError(e), { status: "error" });
          else await saveMessage(ctx, "assistant", fallbackText || humanizeAgentError(e), { status: "error" });
          await emit({ type: "error", message: humanizeAgentError(e) });
          await flushEvents(true);
          await writer.fail(humanizeAgentError(e));
        }
      });
      return new Response(JSON.stringify({ jobId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const emitSse = (controller: ReadableStreamDefaultController<Uint8Array>, event: Record<string, unknown>) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => emitSse(controller, event);
        let assistantText = "";
        let assistantMessageId: string | null = null;
        let lastPersistedLength = 0;
        const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15000);
        try {
          emit({ type: "step", text: "think: سأفهم المطلوب ثم أعدل الملفات مباشرة" });
          if (singleMessage) await saveMessage(ctx, "user", singleMessage);
          assistantMessageId = await createMessage(ctx, "assistant", "...");

          const toolset = buildTools(ctx, emit) as ReturnType<typeof buildTools> & { __fileEvents: Array<{ action: string; path: string; to?: string }> };
          const { __fileEvents, ...tools } = toolset;

          const persistedHistory = await loadRecentMessages(ctx);
          const modelMessages = Array.isArray(messages)
            ? await convertToModelMessages(messages)
            : buildConversationContext(persistedHistory);

          const gw = await getGateway();
          const CTRL_TOKEN_RE2 = /<ctrl\d+>/gi;
          const runStream2 = async (extraSystem?: string) => {
            const result = streamText({
              model: gw.provider(gw.model(BUILD_MODEL)),
              system: extraSystem ? `${SYSTEM_PROMPT}\n\n${extraSystem}` : SYSTEM_PROMPT,
              messages: modelMessages,
              tools,
              stopWhen: stepCountIs(80),
            });
            for await (const delta of result.textStream) {
              const clean = delta.replace(CTRL_TOKEN_RE2, "");
              assistantText += clean;
              if (clean) emit({ type: "text", delta: clean });
              if (assistantMessageId && assistantText.length - lastPersistedLength >= 800) {
                lastPersistedLength = assistantText.length;
                await updateMessage(ctx, assistantMessageId, assistantText.trim() || "...", { change_events: __fileEvents, status: "streaming" });
              }
            }
            return await (result as { finishReason?: Promise<string> | string }).finishReason;
          };

          let finish = await runStream2();
          if (__fileEvents.length === 0) {
            assistantText = "";
            emit({ type: "step", text: "retry: لم تُستدعَ أي أداة — إعادة بتعليمات أقوى" });
            finish = await runStream2(
              "تنبيه إجباري: ردك السابق لم يستدعِ أي أداة. ابدأ فوراً بـ fs_read ثم fs_write للملفات المطلوبة. ممنوع كتابة أي نص قبل أول استدعاء أداة. نفّذ الآن.",
            );
          }
          if (finish === "length") {
            emit({ type: "warn", text: "الرد اقترب من الحد لكني حفظت ما تم تنفيذه." });
          }

          const changeTags = buildChangeTags(__fileEvents);
          const hasOwnSummary = /ملخص ما حدث/.test(assistantText);
          const summary = hasOwnSummary ? "" : buildFinalSummary(__fileEvents);
          const finalText = [assistantText.trim() || "تم الانتهاء من التعديلات.", summary, changeTags].filter(Boolean).join("\n\n");
          if (assistantMessageId) await updateMessage(ctx, assistantMessageId, finalText, { change_events: __fileEvents, status: "done" });
          else await saveMessage(ctx, "assistant", finalText, { change_events: __fileEvents, status: "done" });
          emit({ type: "step", text: "done: انتهيت من التعديلات" });
          emit({ type: "done" });
        } catch (e) {
          console.error("build-agent stream error:", e);
          const fallbackText = [assistantText.trim(), humanizeAgentError(e)].filter(Boolean).join("\n\n");
          if (assistantMessageId) await updateMessage(ctx, assistantMessageId, fallbackText || humanizeAgentError(e), { status: "error" });
          else await saveMessage(ctx, "assistant", fallbackText || humanizeAgentError(e), { status: "error" });
          emit({ type: "error", message: humanizeAgentError(e) });
          emit({ type: "done" });
        } finally {
          clearInterval(heartbeat);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: streamHeaders });
  } catch (e) {
    console.error("build-agent error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
