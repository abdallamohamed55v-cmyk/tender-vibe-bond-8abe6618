import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

export default function ActivityTab() {
  const { ws } = useOutletContext<{ ws: WorkspaceCtx }>();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("workspace_audit_log").select("*").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(100);
      setLogs((data as any) ?? []);
    })();
  }, [ws.id]);

  if (logs.length === 0) {
    return <div className="text-center py-8"><Activity className="w-8 h-8 mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">No activity recorded yet.</p></div>;
  }

  return (
    <div className="space-y-2">
      {logs.map(l => (
        <div key={l.id} className="p-3 rounded-lg border border-border/40 bg-card">
          <p className="text-sm font-medium capitalize">{l.action.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(l.created_at).toLocaleString()}
            {l.target_type && ` · ${l.target_type}`}
          </p>
          {l.metadata && Object.keys(l.metadata).length > 0 && (
            <pre className="text-[10px] text-muted-foreground/80 mt-1 overflow-x-auto">{JSON.stringify(l.metadata, null, 2)}</pre>
          )}
        </div>
      ))}
    </div>
  );
}
