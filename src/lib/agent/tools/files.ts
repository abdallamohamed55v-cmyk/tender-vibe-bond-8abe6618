// File tools — operate on `ai_project_files` for a given project.
//
// Every tool checks that the requested project belongs to the caller before
// reading or writing. Pass a user-scoped Supabase client (browser) OR a
// service-role client that has already authenticated the user (edge fn).

import type { AgentContext, ToolResult } from "../types";

const MAX_FILE_BYTES = 256 * 1024; // 256KB per file

async function ownershipError(ctx: AgentContext): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", ctx.projectId)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "project_not_found";
  return null;
}


export async function fsList(
  ctx: AgentContext,
  args: { prefix?: string } = {}
): Promise<ToolResult<{ path: string; size: number; updatedAt: string }[]>> {
  const _err = await ownershipError(ctx);
  if (_err) return { ok: false as const, error: _err };
  let q = ctx.supabase
    .from("ai_project_files")
    .select("path, content, updated_at")
    .eq("project_id", ctx.projectId)
    .order("path", { ascending: true })
    .limit(500);
  if (args.prefix) q = q.like("path", `${args.prefix}%`);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      path: r.path,
      size: (r.content ?? "").length,
      updatedAt: r.updated_at,
    })),
  };
}

export async function fsRead(
  ctx: AgentContext,
  args: { path: string }
): Promise<ToolResult<{ path: string; content: string }>> {
  const _err = await ownershipError(ctx);
  if (_err) return { ok: false as const, error: _err };
  const { data, error } = await ctx.supabase
    .from("ai_project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId)
    .eq("path", args.path)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "file_not_found" };
  return { ok: true, data: { path: data.path, content: data.content ?? "" } };
}

export async function fsWrite(
  ctx: AgentContext,
  args: { path: string; content: string }
): Promise<ToolResult<{ path: string; bytes: number }>> {
  if (typeof args.content !== "string") return { ok: false, error: "content_required" };
  if (args.content.length > MAX_FILE_BYTES)
    return { ok: false, error: `file_too_large (>${MAX_FILE_BYTES} bytes)` };
  const _err = await ownershipError(ctx);
  if (_err) return { ok: false as const, error: _err };
  const { error } = await ctx.supabase
    .from("ai_project_files")
    .upsert(
      {
        project_id: ctx.projectId,
        path: args.path,
        content: args.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,path" }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { path: args.path, bytes: args.content.length } };
}

export async function fsDelete(
  ctx: AgentContext,
  args: { path: string }
): Promise<ToolResult<{ path: string }>> {
  const _err = await ownershipError(ctx);
  if (_err) return { ok: false as const, error: _err };
  const { error } = await ctx.supabase
    .from("ai_project_files")
    .delete()
    .eq("project_id", ctx.projectId)
    .eq("path", args.path);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { path: args.path } };
}

export async function fsRename(
  ctx: AgentContext,
  args: { from: string; to: string }
): Promise<ToolResult<{ from: string; to: string }>> {
  const read = await fsRead(ctx, { path: args.from });
  if (read.ok === false) return read;
  const write = await fsWrite(ctx, { path: args.to, content: read.data.content });
  if (write.ok === false) return write;
  const del = await fsDelete(ctx, { path: args.from });
  if (del.ok === false) return del;
  return { ok: true, data: { from: args.from, to: args.to } };
}

export async function fsSearch(
  ctx: AgentContext,
  args: { query: string; pathPrefix?: string; maxMatches?: number }
): Promise<
  ToolResult<{ matches: { path: string; line: number; preview: string }[] }>
> {
  if (!args.query || args.query.length < 2)
    return { ok: false, error: "query_too_short" };
  const _err = await ownershipError(ctx);
  if (_err) return { ok: false as const, error: _err };
  let q = ctx.supabase
    .from("ai_project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId)
    .ilike("content", `%${args.query}%`)
    .limit(50);
  if (args.pathPrefix) q = q.like("path", `${args.pathPrefix}%`);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const cap = args.maxMatches ?? 30;
  const matches: { path: string; line: number; preview: string }[] = [];
  const needle = args.query.toLowerCase();
  for (const row of data ?? []) {
    const lines = (row.content ?? "").split(/\r?\n/);
    for (let i = 0; i < lines.length && matches.length < cap; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        matches.push({ path: row.path, line: i + 1, preview: lines[i].slice(0, 200) });
      }
    }
    if (matches.length >= cap) break;
  }
  return { ok: true, data: { matches } };
}
