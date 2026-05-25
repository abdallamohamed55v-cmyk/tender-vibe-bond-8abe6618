import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wallet, Users, FolderKanban, Activity, Plus, ListTodo } from "lucide-react";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

export default function WorkspaceOverviewTab() {
  const { ws, isAdmin } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ members: 0, projects: 0, tasks: 0, monthlyUsage: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [m, p, t, u, a] = await Promise.all([
        supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
        supabase.from("workspace_tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
        supabase.from("workspace_usage").select("amount").eq("workspace_id", ws.id).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from("workspace_audit_log").select("*").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        members: m.count ?? 0,
        projects: p.count ?? 0,
        tasks: t.count ?? 0,
        monthlyUsage: (u.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0),
      });
      setRecent((a.data as any) ?? []);
    })();
  }, [ws.id]);

  const cards = [
    { label: "Shared credits", value: Number(ws.credits).toFixed(0), icon: Wallet, color: "text-emerald-500" },
    { label: "Members", value: stats.members, icon: Users, color: "text-blue-500" },
    { label: "Projects", value: stats.projects, icon: FolderKanban, color: "text-purple-500" },
    { label: "This month", value: stats.monthlyUsage.toFixed(0) + " MC", icon: Activity, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="p-4 rounded-xl border border-border/60 bg-card">
            <c.icon className={`w-4 h-4 ${c.color}`} />
            <p className="text-xs text-muted-foreground mt-2">{c.label}</p>
            <p className="text-xl font-semibold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => navigate(`/workspaces/${ws.id}/tasks`)}>
          <ListTodo className="w-4 h-4 mr-1" /> Tasks
        </Button>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => navigate(`/settings/workspaces/${ws.id}/billing`)}>
            <Plus className="w-4 h-4 mr-1" /> Top up credits
          </Button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Recent activity</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(a => (
              <div key={a.id} className="p-3 rounded-lg border border-border/40 bg-card text-xs">
                <p className="font-medium capitalize">{a.action.replace(/_/g, " ")}</p>
                <p className="text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
