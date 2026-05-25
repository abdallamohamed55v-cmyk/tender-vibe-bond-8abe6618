# Build Agent — Tool Registry

A single, unified tool catalog shared by both build workspaces
(`/build` and `/megsy-pr`). Designed to be runtime-agnostic so it can run:

- **Inside the browser** with a user-scoped Supabase client (for tools that
  only touch `ai_project_files`).
- **Inside a Supabase Edge Function** with the service-role client.
- **Inside a TanStack server route** with the authed Supabase client.

## What's here

| File | Purpose |
|------|---------|
| `types.ts` | `AgentContext`, `ToolResult`, `ToolDescriptor` |
| `toolRegistry.ts` | Catalog + `dispatch(name, args, ctx)` + `toolSearch()` |
| `tools/files.ts` | `fs_list/read/write/delete/rename/search` on `ai_project_files` |
| `tools/firecrawl.ts` | `web_scrape/search/map/crawl` — needs `FIRECRAWL_API_KEY` |
| `tools/github.ts` | `gh_*` REST helpers — needs `GITHUB_TOKEN` |
| `tools/sandbox.ts` | Tiny pure `sandbox_eval_math` + `sandbox_run_js` |

## How an agent loop uses it

### Option A — register every tool eagerly (small catalogs)

```ts
import { TOOL_CATALOG, dispatch } from "@/lib/agent/toolRegistry";

const tools = Object.fromEntries(TOOL_CATALOG.map((t) => [t.name, tool({
  description: t.description,
  inputSchema: /* derive from t.inputPreview or hand-write a Zod schema */,
  execute: (args) => dispatch(t.name, args, ctx),
})]));
```

### Option B — meta-tools (recommended — keeps input tokens small)

Expose ONLY `tool_search` + `tool_invoke` to the model. They proxy to
`toolSearch()` and `dispatch()` respectively. See the
`ai-sdk-tool-deferral` guidance in the system context.

## Streaming step UI

The chat UI (see `src/components/megsy-pr/MobileChatView.tsx` → `stepKind`)
already recognises `tool:<name>` prefixes in step strings. So when the agent
loop emits a status step, prefer:

```
tool:fs_read src/App.tsx
tool:web_search "tanstack router"
tool:gh_create_issue megsy-ai/megsy
```

…and the right icon + title will render automatically.

## Secrets

- `FIRECRAWL_API_KEY` — add via Firecrawl connector or `add_secret`.
- `GITHUB_TOKEN` — add via `add_secret` (Personal Access Token).
- File and sandbox tools need no secrets.

## What's NOT here

- The agent loop / model call. That still lives in the Supabase Edge
  Function (`supabase/functions/chat`) which is deployed remotely and not
  in this repo. To wire these tools in, that function should import this
  registry (or duplicate the catalog) and route tool calls through
  `dispatch()`.
