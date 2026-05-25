// Central tool registry for the build agent. Both the Megsy PR workspace
// and the generic /build workspace consume this single registry so they
// share identical tool capabilities.
//
// The registry is intentionally agent-runtime-agnostic: it exposes a
// catalog (name + description + group + input preview) and a `dispatch`
// function. A backend agent loop can either:
//   1) register the catalog as native AI SDK tools, OR
//   2) expose only meta-tools (tool_search / tool_invoke) and call
//      `dispatch` on demand to keep input tokens small.
//
// See .lovable/plan.md for the full architecture.

import type { AgentContext, ToolDescriptor, ToolResult } from "./types";
import * as files from "./tools/files";
import * as firecrawl from "./tools/firecrawl";
import * as github from "./tools/github";
import * as sandbox from "./tools/sandbox";

export const TOOL_CATALOG: ToolDescriptor[] = [
  // Files
  { name: "fs_list",   group: "files", description: "List files in the project (optionally filtered by path prefix)", inputPreview: { prefix: "string?" } },
  { name: "fs_read",   group: "files", description: "Read the content of a file at the given path", inputPreview: { path: "string" } },
  { name: "fs_write",  group: "files", description: "Create or overwrite a file with new content", inputPreview: { path: "string", content: "string" } },
  { name: "fs_delete", group: "files", description: "Delete a file from the project", inputPreview: { path: "string" } },
  { name: "fs_rename", group: "files", description: "Rename / move a file", inputPreview: { from: "string", to: "string" } },
  { name: "fs_search", group: "files", description: "Grep-style search across project file contents", inputPreview: { query: "string", pathPrefix: "string?" } },

  // Web (Firecrawl)
  { name: "web_scrape", group: "web", description: "Fetch a URL and return its content (markdown/html)", inputPreview: { url: "string", formats: "string[]?" } },
  { name: "web_search", group: "web", description: "Web search via Firecrawl", inputPreview: { query: "string", limit: "number?" } },
  { name: "web_map",    group: "web", description: "Discover all URLs on a website", inputPreview: { url: "string" } },
  { name: "web_crawl",  group: "web", description: "Recursively crawl a website (use sparingly)", inputPreview: { url: "string", limit: "number?", maxDepth: "number?" } },

  // GitHub
  { name: "gh_list_repos",   group: "github", description: "List the authenticated user's repositories", inputPreview: { per_page: "number?" } },
  { name: "gh_get_repo",     group: "github", description: "Get a repository's metadata", inputPreview: { owner: "string", repo: "string" } },
  { name: "gh_list_issues",  group: "github", description: "List issues in a repo", inputPreview: { owner: "string", repo: "string", state: "string?" } },
  { name: "gh_create_issue", group: "github", description: "Create an issue", inputPreview: { owner: "string", repo: "string", title: "string", body: "string?" } },
  { name: "gh_list_prs",     group: "github", description: "List pull requests", inputPreview: { owner: "string", repo: "string", state: "string?" } },
  { name: "gh_get_file",     group: "github", description: "Fetch a file from a repo", inputPreview: { owner: "string", repo: "string", path: "string", ref: "string?" } },
  { name: "gh_search_code",  group: "github", description: "Search code across GitHub", inputPreview: { query: "string" } },

  // Sandbox (limited)
  { name: "sandbox_eval_math", group: "shell", description: "Evaluate a pure math expression", inputPreview: { expr: "string" } },
  { name: "sandbox_run_js",    group: "shell", description: "Run a tiny pure JS snippet (no network/fs)", inputPreview: { code: "string", input: "any?" } },
];

type Args = Record<string, unknown>;

export async function dispatch(
  name: string,
  args: Args,
  ctx: AgentContext | null
): Promise<ToolResult<unknown>> {
  switch (name) {
    // files (need ctx)
    case "fs_list":   if (!ctx) return needCtx(name); return files.fsList(ctx, args as { prefix?: string });
    case "fs_read":   if (!ctx) return needCtx(name); return files.fsRead(ctx, args as { path: string });
    case "fs_write":  if (!ctx) return needCtx(name); return files.fsWrite(ctx, args as { path: string; content: string });
    case "fs_delete": if (!ctx) return needCtx(name); return files.fsDelete(ctx, args as { path: string });
    case "fs_rename": if (!ctx) return needCtx(name); return files.fsRename(ctx, args as { from: string; to: string });
    case "fs_search": if (!ctx) return needCtx(name); return files.fsSearch(ctx, args as { query: string; pathPrefix?: string });

    // web
    case "web_scrape": return firecrawl.webScrape(args as { url: string; formats?: string[] });
    case "web_search": return firecrawl.webSearch(args as { query: string; limit?: number });
    case "web_map":    return firecrawl.webMap(args as { url: string; limit?: number });
    case "web_crawl":  return firecrawl.webCrawl(args as { url: string; limit?: number; maxDepth?: number });

    // github
    case "gh_list_repos":   return github.ghListRepos(args as { per_page?: number });
    case "gh_get_repo":     return github.ghGetRepo(args as { owner: string; repo: string });
    case "gh_list_issues":  return github.ghListIssues(args as { owner: string; repo: string; state?: "open" | "closed" | "all" });
    case "gh_create_issue": return github.ghCreateIssue(args as { owner: string; repo: string; title: string; body?: string });
    case "gh_list_prs":     return github.ghListPRs(args as { owner: string; repo: string; state?: "open" | "closed" | "all" });
    case "gh_get_file":     return github.ghGetFile(args as { owner: string; repo: string; path: string; ref?: string });
    case "gh_search_code":  return github.ghSearchCode(args as { query: string });

    // sandbox
    case "sandbox_eval_math": return sandbox.sandboxEvalMath(args as { expr: string });
    case "sandbox_run_js":    return sandbox.sandboxRunJs(args as { code: string; input?: unknown });

    default:
      return { ok: false, error: `unknown_tool:${name}` };
  }
}

function needCtx(name: string): ToolResult<never> {
  return { ok: false, error: `${name} requires a project context (projectId + userId)` };
}

// Meta-tools for token-efficient agents: tool_search + tool_invoke.
export function toolSearch(args: { query?: string; group?: string; limit?: number }) {
  const q = (args.query ?? "").toLowerCase();
  const grp = (args.group ?? "").toLowerCase();
  const limit = args.limit ?? 8;
  const matches = TOOL_CATALOG
    .filter((t) => (!grp || t.group === grp))
    .filter((t) => !q || t.name.includes(q) || t.description.toLowerCase().includes(q))
    .slice(0, limit);
  return { ok: true as const, data: { matches } };
}
