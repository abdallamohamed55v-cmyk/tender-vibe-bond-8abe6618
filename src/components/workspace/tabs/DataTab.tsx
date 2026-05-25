import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Database, Download, Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

export default function DataTab() {
  const { ws, isAdmin } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean }>();
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    const { data, error } = await supabase.rpc("workspace_export_gdpr" as any, { p_ws: ws.id });
    setExporting(false);
    if (error || !(data as any)?.success) { toast.error((data as any)?.error || error?.message); return; }
    const blob = new Blob([JSON.stringify((data as any).data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ws.name.replace(/[^a-z0-9]/gi, "_")}_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success("Export downloaded");
  };

  const archive = async () => {
    if (!confirm("Archive this workspace? You can restore it within 30 days.")) return;
    const { data, error } = await supabase.rpc("workspace_archive" as any, { p_ws: ws.id });
    if (error || !(data as any)?.success) { toast.error((data as any)?.error || error?.message); return; }
    toast.success("Archived");
  };

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only admins can manage data & privacy.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Database className="w-4 h-4" /><h3 className="text-sm font-semibold">Data & privacy</h3></div>

      <div className="p-4 rounded-xl border border-border/60 bg-card">
        <p className="text-sm font-medium">GDPR data export</p>
        <p className="text-xs text-muted-foreground mt-1">Download a complete JSON of all workspace data: members, projects, usage, audit log, brand kit, settings.</p>
        <Button onClick={exportData} disabled={exporting} className="mt-3">
          {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
          Export all data
        </Button>
      </div>

      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/5">
        <p className="text-sm font-medium">Archive workspace</p>
        <p className="text-xs text-muted-foreground mt-1">Hides the workspace from members. Recoverable within 30 days; permanently deleted after.</p>
        <Button variant="outline" onClick={archive} className="mt-3"><Archive className="w-4 h-4 mr-1" /> Archive</Button>
      </div>
    </div>
  );
}
