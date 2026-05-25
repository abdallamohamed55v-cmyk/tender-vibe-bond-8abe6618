// GitHub tools. Require GITHUB_TOKEN in the runtime env. Uses the REST API
// directly to avoid native deps in edge runtimes.

import type { ToolResult } from "../types";

const GH_BASE = "https://api.github.com";

function getToken(): string | null {
  const g = globalThis as unknown as {
    Deno?: { env: { get(k: string): string | undefined } };
    process?: { env: Record<string, string | undefined> };
  };
  return g.Deno?.env.get("GITHUB_TOKEN") ?? g.process?.env?.GITHUB_TOKEN ?? null;
}

async function gh<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<ToolResult<T>> {
  const token = getToken();
  if (!token) return { ok: false, error: "GITHUB_TOKEN is not configured" };
  const res = await fetch(`${GH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) return { ok: false, error: `github_${res.status}: ${text.slice(0, 200)}` };
  return { ok: true, data: data as T };
}

export function ghListRepos(args: { per_page?: number } = {}) {
  return gh(`/user/repos?per_page=${args.per_page ?? 30}&sort=updated`);
}
export function ghGetRepo(args: { owner: string; repo: string }) {
  return gh(`/repos/${args.owner}/${args.repo}`);
}
export function ghListIssues(args: { owner: string; repo: string; state?: "open" | "closed" | "all" }) {
  return gh(`/repos/${args.owner}/${args.repo}/issues?state=${args.state ?? "open"}`);
}
export function ghCreateIssue(args: { owner: string; repo: string; title: string; body?: string }) {
  return gh(`/repos/${args.owner}/${args.repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title: args.title, body: args.body }),
  });
}
export function ghListPRs(args: { owner: string; repo: string; state?: "open" | "closed" | "all" }) {
  return gh(`/repos/${args.owner}/${args.repo}/pulls?state=${args.state ?? "open"}`);
}
export function ghGetFile(args: { owner: string; repo: string; path: string; ref?: string }) {
  const q = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : "";
  return gh(`/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path)}${q}`);
}
export function ghSearchCode(args: { query: string }) {
  return gh(`/search/code?q=${encodeURIComponent(args.query)}`);
}
