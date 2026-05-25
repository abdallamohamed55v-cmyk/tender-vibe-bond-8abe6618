// Shared E2B sandbox helper for all edge functions.
// Uses E2B Code Interpreter SDK via Deno npm specifier.
// Required env: E2B_API_KEY
import { Sandbox } from "npm:@e2b/code-interpreter@1.2.0";

export type RunResult = {
  stdout: string;
  stderr: string;
  error?: string;
  results: Array<Record<string, unknown>>;
  files: Array<{ path: string; bytes: Uint8Array; size: number }>;
  duration_ms: number;
};

export interface RunOptions {
  code: string;
  language?: "python" | "javascript";
  /** files to upload before run: { path, contentBase64 } */
  inputFiles?: Array<{ path: string; contentBase64: string }>;
  /** files (paths inside sandbox) to download after run */
  outputFiles?: string[];
  /** seconds; default 120 */
  timeoutSec?: number;
}

function getApiKey(): string {
  const key = Deno.env.get("E2B_API_KEY");
  if (!key) throw new Error("E2B_API_KEY is not configured");
  return key;
}

function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function runInSandbox(opts: RunOptions): Promise<RunResult> {
  const apiKey = getApiKey();
  const started = Date.now();
  const sbx = await Sandbox.create({ apiKey, timeoutMs: (opts.timeoutSec ?? 120) * 1000 });
  try {
    // Upload input files
    if (opts.inputFiles?.length) {
      for (const f of opts.inputFiles) {
        await sbx.files.write(f.path, b64decode(f.contentBase64));
      }
    }

    const exec = await sbx.runCode(opts.code, {
      language: opts.language ?? "python",
      timeoutMs: (opts.timeoutSec ?? 120) * 1000,
    });

    const stdout = (exec.logs?.stdout ?? []).join("");
    const stderr = (exec.logs?.stderr ?? []).join("");
    const error = exec.error ? `${exec.error.name}: ${exec.error.value}` : undefined;

    // Collect explicit output files
    const files: RunResult["files"] = [];
    if (opts.outputFiles?.length) {
      for (const path of opts.outputFiles) {
        try {
          const bytes = await sbx.files.read(path, { format: "bytes" }) as Uint8Array;
          files.push({ path, bytes, size: bytes.byteLength });
        } catch (_e) { /* missing — ignore */ }
      }
    }

    // Also collect inline result files (charts/images) returned by code-interpreter
    const results: Array<Record<string, unknown>> = [];
    for (const r of (exec.results ?? [])) {
      const item: Record<string, unknown> = {};
      if (r.text) item.text = r.text;
      if (r.html) item.html = r.html;
      if (r.markdown) item.markdown = r.markdown;
      if (r.png) {
        const bytes = b64decode(r.png);
        const path = `chart_${results.length + 1}.png`;
        files.push({ path, bytes, size: bytes.byteLength });
        item.png = path;
      }
      if (r.svg) item.svg = r.svg;
      results.push(item);
    }

    return { stdout, stderr, error, results, files, duration_ms: Date.now() - started };
  } finally {
    try { await sbx.kill(); } catch (_e) { /* ignore */ }
  }
}
