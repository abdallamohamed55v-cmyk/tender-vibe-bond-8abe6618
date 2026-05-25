import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Trash2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

export default function DangerTab() {
  const { ws, isOwner, me } = useOutletContext<{ ws: WorkspaceCtx; isOwner: boolean; me: string | null }>();
  const navigate = useNavigate();

  const leave = async () => {
    if (isOwner) { toast.error("Owner can't leave. Transfer ownership first."); return; }
    if (!confirm("Leave this workspace?")) return;
    await supabase.from("workspace_members").delete().eq("workspace_id", ws.id).eq("user_id", me!);
    try { if (localStorage.getItem("megsy_active_workspace_id") === ws.id) localStorage.removeItem("megsy_active_workspace_id"); } catch {}
    toast.success("Left");
    navigate("/settings/workspaces");
  };

  const del = async () => {
    if (!confirm(`Permanently delete "${ws.name}" and all data? This cannot be undone.`)) return;
    const { error } = await supabase.from("workspaces").delete().eq("id", ws.id);
    if (error) { toast.error(error.message); return; }
    try { if (localStorage.getItem("megsy_active_workspace_id") === ws.id) localStorage.removeItem("megsy_active_workspace_id"); } catch {}
    toast.success("Deleted");
    navigate("/settings/workspaces");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /><h3 className="text-sm font-semibold text-destructive">Danger zone</h3></div>

      <div className="p-4 rounded-xl border border-border/60 bg-card flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Workspace ID</p>
          <p className="text-xs text-muted-foreground font-mono">{ws.id}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(ws.id); toast.success("Copied"); }}><Copy className="w-4 h-4" /></Button>
      </div>

      {!isOwner && (
        <Button variant="outline" onClick={leave} className="w-full"><LogOut className="w-4 h-4 mr-1" /> Leave workspace</Button>
      )}

      {isOwner && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">Delete workspace</p>
          <p className="text-xs text-muted-foreground mt-1">All members, projects, tasks, and history will be permanently deleted.</p>
          <Button variant="destructive" onClick={del} className="mt-3"><Trash2 className="w-4 h-4 mr-1" /> Delete forever</Button>
        </div>
      )}
    </div>
  );
}
