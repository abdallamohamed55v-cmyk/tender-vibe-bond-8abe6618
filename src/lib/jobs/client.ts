// Frontend client for background jobs (server-side execution).
// Continues even if the user closes the tab. On return we resume via Realtime.

import { supabase } from "@/integrations/supabase/client";

export type JobKind = "chat" | "docs" | "slides" | "deep_research" | "code_build" | "image" | "video";
export type JobStatus = "queued" | "running" | "needs_input" | "done" | "error" | "canceled";

export interface JobRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  kind: JobKind;
  status: JobStatus;
  phase: string | null;
  progress: number;
  status_text: string | null;
  input: any;
  output: any;
  stream_text: string;
  meta: any;
  clarify: any;
  error: string | null;
  last_heartbeat_at?: string | null;
  updated_at?: string | null;
}

const STALE_JOB_MS = 90_000;

export function isJobStale(row: Pick<JobRow, "status" | "last_heartbeat_at" | "updated_at">, staleMs = STALE_JOB_MS): boolean {
  if (row.status !== "running" && row.status !== "queued") return false;
  const stamp = row.last_heartbeat_at || row.updated_at;
  if (!stamp) return false;
  return Date.now() - new Date(stamp).getTime() > staleMs;
}

export interface JobHandlers {
  onStatus?: (text: string) => void;
  onProgress?: (progress: number, phase?: string | null) => void;
  onMeta?: (meta: any) => void;
  onDelta?: (chunk: string, fullSoFar: string) => void;
  onClarify?: (clarify: any) => void;
  onOutput?: (output: any) => void;
  onDone?: (row: JobRow) => void;
  onError?: (message: string) => void;
  onStale?: (row: JobRow) => void;
}

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const KIND_TO_PATH: Record<JobKind, string> = {
  chat: "/chat",
  docs: "/docs-generate",
  slides: "/chat-slides-stream",
  deep_research: "/deep-research-job",
  code_build: "/build-agent",
  image: "/generate-image",
  video: "/generate-video",
};

/** Start a background job by calling the matching edge function. Returns { jobId }. */
export async function startJob(kind: JobKind, payload: any): Promise<{ jobId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const path = KIND_TO_PATH[kind];
  const resp = await fetch(`${FN_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(t || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if (!data?.jobId) throw new Error("Server did not return jobId");
  return { jobId: data.jobId as string };
}

/** Read a job row once. */
export async function getJob(jobId: string): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("background_jobs" as any)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

/** List the current user's still-running jobs for a given kind (newest first). */
export async function listActiveJobs(kind: JobKind, limit = 5): Promise<JobRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("background_jobs" as any)
    .select("*")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data as any) || []) as JobRow[];
}

export async function failStaleJob(jobId: string, message = "Job stopped unexpectedly. Progress was saved."): Promise<void> {
  await supabase.from("background_jobs" as any).update({
    status: "error",
    error: message,
    status_text: "Stopped",
    progress: 100,
    finished_at: new Date().toISOString(),
  }).eq("id", jobId).in("status", ["queued", "running"]);
}

/** Subscribe to a job row via Realtime. Returns an unsubscribe function. */
export function subscribeJob(jobId: string, handlers: JobHandlers): () => void {
  let lastStreamLen = 0;
  let lastMetaJson = "";
  let lastClarifyJson = "";
  let lastOutputJson = "";
  let lastStatus: JobStatus | null = null;
  let cleanup: () => void = () => {};

  const emit = (row: JobRow) => {
    // status text
    if (row.status_text) handlers.onStatus?.(row.status_text);
    // progress
    if (typeof row.progress === "number") handlers.onProgress?.(row.progress, row.phase);
    // meta
    if (row.meta && Object.keys(row.meta).length) {
      const j = JSON.stringify(row.meta);
      if (j !== lastMetaJson) {
        lastMetaJson = j;
        handlers.onMeta?.(row.meta);
      }
    }
    // delta
    const cur = row.stream_text ?? "";
    if (cur.length > lastStreamLen) {
      const chunk = cur.slice(lastStreamLen);
      lastStreamLen = cur.length;
      handlers.onDelta?.(chunk, cur);
    }
    // clarify
    if (row.clarify) {
      const j = JSON.stringify(row.clarify);
      if (j !== lastClarifyJson) {
        lastClarifyJson = j;
        handlers.onClarify?.(row.clarify);
      }
    }
    // output
    if (row.output && Object.keys(row.output).length) {
      const j = JSON.stringify(row.output);
      if (j !== lastOutputJson) {
        lastOutputJson = j;
        handlers.onOutput?.(row.output);
      }
    }
    // stale running jobs: the edge worker likely died after saving partial state.
    if (isJobStale(row, row.kind === "slides" ? 15 * 60_000 : STALE_JOB_MS)) {
      if (handlers.onStale) handlers.onStale(row);
      else handlers.onError?.("The job stopped unexpectedly. Please try again.");
      cleanup();
      return;
    }
    // terminal
    if (row.status !== lastStatus) {
      lastStatus = row.status;
      if (row.status === "done" || row.status === "needs_input") { handlers.onDone?.(row); cleanup(); }
      else if (row.status === "error") { handlers.onError?.(row.error || "Unknown error"); cleanup(); }
      else if (row.status === "canceled") { handlers.onError?.("canceled"); cleanup(); }
    }
  };

  // Initial fetch + then subscribe
  let unsubscribed = false;
  let pollId: ReturnType<typeof setInterval> | null = null;
  const channel = supabase
    .channel(`job:${jobId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "background_jobs", filter: `id=eq.${jobId}` },
      (payload) => {
        if (unsubscribed) return;
        emit(payload.new as JobRow);
      },
    )
    .subscribe();

  // Hydrate current state immediately so we don't miss anything before subscription.
  getJob(jobId).then((row) => { if (row && !unsubscribed) emit(row); }).catch(() => {});
  pollId = setInterval(() => {
    getJob(jobId).then((row) => { if (row && !unsubscribed) emit(row); }).catch(() => {});
  }, 5000);

  cleanup = () => {
    unsubscribed = true;
    if (pollId) clearInterval(pollId);
    try { supabase.removeChannel(channel); } catch { /* ignore */ }
  };

  return cleanup;
}

/** Resume a job: read current state immediately and subscribe for the rest. */
export function resumeJob(jobId: string, handlers: JobHandlers): () => void {
  return subscribeJob(jobId, handlers);
}

/** Mark a job canceled. The runner will exit at its next checkpoint. */
export async function cancelJob(jobId: string): Promise<void> {
  await supabase.from("background_jobs" as any).update({ status: "canceled" }).eq("id", jobId);
}
