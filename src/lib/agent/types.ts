// Shared types for the build agent tool layer.
// These types are runtime-agnostic so the same tool implementations can run
// inside the browser (using the user-scoped Supabase client) OR inside a
// Supabase Edge Function / TanStack server route (using the service-role
// client). Both expose the same `from(...)` API surface used here.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentContext = {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
};

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ToolDescriptor = {
  /** Stable tool name, namespaced (e.g. "fs_read", "web_search", "gh_get_repo"). */
  name: string;
  /** Family the tool belongs to — used by the UI for icon/title resolution. */
  group: "files" | "web" | "github" | "shell" | "meta";
  /** Short description surfaced to the model via tool_search. */
  description: string;
  /** Lightweight JSON-schema-ish preview for tool_search results. */
  inputPreview: Record<string, string>;
};
