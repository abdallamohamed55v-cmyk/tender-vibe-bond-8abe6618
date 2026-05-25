// Tracks in-flight deep-research chat jobs in localStorage so that when the
// user closes the tab and comes back we can re-attach to the running job via
// Realtime and finish rendering the answer.
//
// The chat function itself runs on the server (background_jobs row) once the
// page sends `background: true`. The job persists regardless of the tab — we
// just need a pointer to find it again.

export interface ActiveChatJob {
  jobId: string;
  conversationId: string;
  clientId: string;
  userInput: string;
  startedAt: number;
}

const KEY = "chat:activeJobs";
const TTL_MS = 30 * 60 * 1000; // 30 min — jobs older than this are abandoned

function read(): ActiveChatJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr.filter((j: any) => j?.jobId && j?.conversationId && (now - (j.startedAt || 0)) < TTL_MS);
  } catch {
    return [];
  }
}

function write(jobs: ActiveChatJob[]): void {
  try {
    if (jobs.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch { /* ignore */ }
}

export function addActiveChatJob(job: ActiveChatJob): void {
  const all = read().filter((j) => j.jobId !== job.jobId);
  all.push(job);
  write(all);
}

export function removeActiveChatJob(jobId: string): void {
  write(read().filter((j) => j.jobId !== jobId));
}

export function getActiveChatJobs(conversationId: string): ActiveChatJob[] {
  return read().filter((j) => j.conversationId === conversationId);
}
