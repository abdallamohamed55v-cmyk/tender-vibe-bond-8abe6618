import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Download, Wallet } from "lucide-react";
import { toast } from "sonner";
import { openWorkspaceCheckout } from "@/lib/workspaceCheckout";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

const TOPUP_PACKS = [
  { credits: 100, usd: 12 },
  { credits: 500, usd: 50 },
  { credits: 1500, usd: 130 },
];

export default function BillingTab() {
  const { ws, isAdmin, canBilling } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean; canBilling: boolean }>();
  const [topups, setTopups] = useState<any[]>([]);
  const [defaultLimit, setDefaultLimit] = useState<string>(ws.default_member_monthly_limit?.toString() ?? "");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("workspace_credit_topups").select("*").eq("workspace_id", ws.id).order("created_at", { ascending: false });
      setTopups((data as any) ?? []);
    })();
  }, [ws.id]);

  const buyPack = async (credits: number) => {
    toast.info(`Redirecting to checkout for ${credits} credits…`);
    const r = await openWorkspaceCheckout("starter", "monthly");
    if (!r.ok) { toast.error(r.reason); return; }
    window.location.href = r.url;
  };

  const downloadInvoice = (t: any) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${t.invoice_number}</title>
      <style>body{font-family:Inter,Arial;padding:40px;max-width:600px}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:8px;border-bottom:1px solid #ddd}.r{text-align:right}</style>
      </head><body>
      <h1>Invoice</h1>
      <p>${t.invoice_number}</p>
      <p>Date: ${new Date(t.created_at).toLocaleDateString()}</p>
      <p>Workspace: ${ws.name}</p>
      <table>
        <tr><td>Credits top-up</td><td class="r">${t.amount_credits} MC</td></tr>
        <tr><td><strong>Total</strong></td><td class="r"><strong>$${Number(t.amount_usd).toFixed(2)}</strong></td></tr>
      </table>
      <p style="margin-top:40px;color:#888;font-size:12px">Thank you for your business.</p>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${t.invoice_number}.html`;
    a.click();
  };

  const updateDefault = async () => {
    const v = defaultLimit.trim() === "" ? null : Number(defaultLimit);
    await supabase.from("workspaces").update({ default_member_monthly_limit: v } as any).eq("id", ws.id);
    toast.success("Default limit saved");
  };

  return (
    <div className="space-y-6">
      <section className="p-4 rounded-xl border border-border/60 bg-card">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-500" />
          <p className="text-sm font-semibold">Workspace balance</p>
        </div>
        <p className="text-3xl font-semibold mt-2">{Number(ws.credits).toFixed(0)} <span className="text-sm text-muted-foreground">MC</span></p>
      </section>

      {canBilling && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Top up credits</h3>
          <div className="grid grid-cols-3 gap-2">
            {TOPUP_PACKS.map(p => (
              <button key={p.credits} onClick={() => buyPack(p.credits)}
                className="p-3 rounded-xl border border-border/60 bg-card hover:border-foreground transition text-center">
                <p className="text-lg font-semibold">{p.credits}</p>
                <p className="text-xs text-muted-foreground">MC</p>
                <p className="text-sm mt-1">${p.usd}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Default monthly limit per member</h3>
          <div className="flex gap-2">
            <Input type="number" placeholder="No limit" value={defaultLimit} onChange={(e) => setDefaultLimit(e.target.value)} />
            <Button onClick={updateDefault}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">Applied to new members. Existing limits unchanged.</p>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Invoices</h3>
        {topups.length === 0 ? (
          <p className="text-xs text-muted-foreground">No invoices yet.</p>
        ) : topups.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.invoice_number || "—"}</p>
              <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()} · {t.amount_credits} MC · ${Number(t.amount_usd).toFixed(2)} · {t.status}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => downloadInvoice(t)}><Download className="w-4 h-4" /></Button>
          </div>
        ))}
      </section>
    </div>
  );
}
