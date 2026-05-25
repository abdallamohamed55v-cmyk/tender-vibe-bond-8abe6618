// Client wrapper for the sandbox:* actions on the build-agent edge function.
// Used by the Code page Run/Preview/Terminal tabs.

import { supabase } from "@/integrations/supabase/client";

export type SandboxStatus = "starting" | "running" | "stopped" | "error";

export interface SandboxRow {
  project_id: string;
  sandbox_id: string | null;
  dev_url: string | null;
  status: SandboxStatus;
  last_error: string | null;
  last_sync_at: string | null;
  updated_at: string;
  created_at: string;
}

type Ok<T> = { ok: true; data?: T; error?: undefined };
type Err = { ok: false; error: string; data?: undefined };

async function call<T>(projectId: string, action: string, extra: Record<string, unknown> = {}): Promise<Ok<T> | Err> {
  const { data, error } = await supabase.functions.invoke("build-agent", {
    body: { projectId, action: `sandbox:${action}`, ...extra },
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "empty_response" }) as Ok<T> | Err;
}

export const projectSandbox = {
  status: (projectId: string) => call<SandboxRow>(projectId, "status"),
  start:  (projectId: string) => call<{ sandbox_id: string; dev_url: string }>(projectId, "start"),
  stop:   (projectId: string) => call(projectId, "stop"),
  logs:   (projectId: string, lines = 200) => call<{ logs: string }>(projectId, "logs", { lines }),
  run:    (projectId: string, command: string, timeoutMs = 60000) =>
    call<{ stdout: string; stderr: string; exitCode: number }>(projectId, "run", { command, timeoutMs }),
  runPython: (projectId: string, code: string, timeoutMs = 120000) =>
    call<{ stdout: string; stderr: string; results?: unknown[]; error?: string | null }>(projectId, "run_python", { code, timeoutMs }),
};
