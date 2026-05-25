import { supabase } from "@/integrations/supabase/client";

/**
 * Project prompt drafts stored in Supabase (table: project_drafts).
 * No localStorage usage — DB is the source of truth.
 */

export async function getProjectDraft(projectId: string): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const { data } = await supabase
      .from("project_drafts")
      .select("content")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .maybeSingle();
    return (data?.content as string) || "";
  } catch {
    return "";
  }
}

export async function saveProjectDraft(projectId: string, content: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("project_drafts")
      .upsert(
        { user_id: user.id, project_id: projectId, content },
        { onConflict: "user_id,project_id" },
      );
  } catch {
    /* noop */
  }
}

// In-memory debounced writer so typing doesn't hammer the DB.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
export function saveProjectDraftDebounced(projectId: string, content: string, delayMs = 600): void {
  const existing = timers.get(projectId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    timers.delete(projectId);
    void saveProjectDraft(projectId, content);
  }, delayMs);
  timers.set(projectId, t);
}