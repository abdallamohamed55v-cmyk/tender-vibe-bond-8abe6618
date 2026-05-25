// Deep Research background-job client helper.
// Starts a job via the deep-research-job edge function, then subscribes to
// the research_jobs row via Supabase realtime for live progress updates.

import { supabase } from "@/integrations/supabase/client";

export type ResearchJobStatus =
  | "queued"
  | "planning"
  | "searching"
  | "synthesizing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
  query?: string;
}

export interface ResearchJob {
  id: string;
  user_id: string;
  conversation_id: string | null;
  query: string;
  language: string | null;
  status: ResearchJobStatus;
  progress: number;
  stage: string | null;
  plan: string[];
  steps: Array<Record<string, unknown>>;
  sources: ResearchSource[];
  images: string[];
  report: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface StartOptions {
  query: string;
  language?: string | null;
  conversationId?: string | null;
}

export async function startResearchJob(opts: StartOptions): Promise<string> {
  const { data, error } = await supabase.functions.invoke("deep-research-job", {
    body: {
      action: "start",
      query: opts.query,
      language: opts.language ?? null,
      conversationId: opts.conversationId ?? null,
    },
  });
  if (error) throw error;
  const jobId = (data as { jobId?: string })?.jobId;
  if (!jobId) throw new Error("No jobId returned");
  return jobId;
}

export async function cancelResearchJob(jobId: string): Promise<void> {
  await supabase.functions.invoke("deep-research-job", {
    body: { action: "cancel", jobId },
  });
}

export async function getResearchJob(jobId: string): Promise<ResearchJob | null> {
  const { data, error } = await supabase
    .from("research_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ResearchJob) ?? null;
}

/** Subscribe to a job's row changes. Returns an unsubscribe function. */
export function subscribeToResearchJob(
  jobId: string,
  onUpdate: (job: ResearchJob) => void,
): () => void {
  const channel = supabase
    .channel(`research_job_${jobId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "research_jobs", filter: `id=eq.${jobId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as ResearchJob | undefined;
        if (row) onUpdate(row);
      },
    )
    .subscribe();

  // Also fetch the current snapshot immediately
  getResearchJob(jobId).then((j) => j && onUpdate(j));

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Convenience helper: starts a job and resolves with the final job when it
 * reaches a terminal state. Calls onProgress for every intermediate update.
 */
export async function runResearchJob(
  opts: StartOptions & { onProgress?: (job: ResearchJob) => void; signal?: AbortSignal },
): Promise<ResearchJob> {
  const jobId = await startResearchJob(opts);

  return new Promise<ResearchJob>((resolve, reject) => {
    let settled = false;
    const unsubscribe = subscribeToResearchJob(jobId, (job) => {
      opts.onProgress?.(job);
      if (settled) return;
      if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
        settled = true;
        unsubscribe();
        if (job.status === "succeeded") resolve(job);
        else reject(new Error(job.error || `Research ${job.status}`));
      }
    });

    if (opts.signal) {
      opts.signal.addEventListener("abort", () => {
        if (settled) return;
        settled = true;
        unsubscribe();
        cancelResearchJob(jobId).catch(() => {});
        reject(new DOMException("Aborted", "AbortError"));
      });
    }
  });
}
