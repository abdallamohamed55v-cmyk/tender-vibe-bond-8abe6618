import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Lock, ArrowRightLeft, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaces } from "@/hooks/useWorkspace";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

export default function ProjectsTab() {
  const { ws, isAdmin, me } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean; me: string | null }>();
  const { workspaces } = useWorkspaces();
  const [projects, setProjects] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("projects").select("id,name,is_private,user_id,created_at,workspace_id").eq("workspace_id", ws.id).order("created_at", { ascending: false });
    setProjects((data as any) ?? []);
  };
  useEffect(() => { load(); }, [ws.id]);

  const togglePrivate = async (p: any, v: boolean) => {
    if (p.user_id !== me) { toast.error("Only owner can toggle"); return; }
    await supabase.from("projects").update({ is_private: v } as any).eq("id", p.id);
    setProjects(ps => ps.map(x => x.id === p.id ? { ...x, is_private: v } : x));
  };

  const transfer = async (p: any) => {
    const target = prompt("Target workspace ID (leave empty for personal):") ?? null;
    const { data, error } = await supabase.rpc("workspace_transfer_project" as any, { p_project_id: p.id, p_target_ws: target?.trim() || null });
    if (error || !(data as any)?.success) { toast.error((data as any)?.error || error?.message); return; }
    toast.success("Project transferred");
    load();
  };

  if (projects.length === 0) {
    return <div className="text-center py-8"><FolderKanban className="w-8 h-8 mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">No projects in this workspace yet.</p></div>;
  }

  return (
    <div className="space-y-3">
      {projects.map(p => (
        <div key={p.id} className="p-3 rounded-xl border border-border/60 bg-card">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
            <p className="font-medium text-sm flex-1 truncate">{p.name}</p>
            {p.is_private && <Lock className="w-3 h-3 text-amber-500" />}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={!!p.is_private} onCheckedChange={(v) => togglePrivate(p, v)} disabled={p.user_id !== me} />
              <span className="text-xs text-muted-foreground">Private</span>
            </div>
            {p.user_id === me && (
              <Button size="sm" variant="ghost" onClick={() => transfer(p)} className="text-xs">
                <ArrowRightLeft className="w-3 h-3 mr-1" /> Transfer
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
