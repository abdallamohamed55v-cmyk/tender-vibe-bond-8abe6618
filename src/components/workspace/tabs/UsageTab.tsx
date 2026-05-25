import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

export default function UsageTab() {
  const { ws } = useOutletContext<{ ws: WorkspaceCtx }>();
  const [rows, setRows] = useState<any[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("workspace_usage").select("*").eq("workspace_id", ws.id).gte("created_at", since.toISOString()).order("created_at", { ascending: true });
      const list = (data as any) ?? [];
      setRows(list);
      const ids = Array.from(new Set(list.map((r: any) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids as string[]);
        const m: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { m[p.id] = p.display_name || p.id.slice(0, 8); });
        setProfMap(m);
      }
    })();
  }, [ws.id]);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      const k = new Date(r.created_at).toISOString().slice(0, 10);
      map.set(k, (map.get(k) || 0) + Number(r.amount));
    });
    return Array.from(map.entries()).map(([date, amount]) => ({ date: date.slice(5), amount: Number(amount.toFixed(2)) }));
  }, [rows]);

  const perMember = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r.user_id, (map.get(r.user_id) || 0) + Number(r.amount)));
    return Array.from(map.entries()).map(([uid, amount]) => ({ name: profMap[uid] || uid.slice(0, 8), amount: Number(amount.toFixed(2)) })).sort((a, b) => b.amount - a.amount);
  }, [rows, profMap]);

  const perTool = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r.action_type, (map.get(r.action_type) || 0) + Number(r.amount)));
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) })).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [rows]);

  const forecast = useMemo(() => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthRows = rows.filter(r => new Date(r.created_at).getMonth() === now.getMonth());
    const monthTotal = monthRows.reduce((s, r) => s + Number(r.amount), 0);
    const projected = dayOfMonth > 0 ? (monthTotal / dayOfMonth) * daysInMonth : 0;
    return { current: monthTotal, projected };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-border/60 bg-card">
          <p className="text-xs text-muted-foreground">This month</p>
          <p className="text-2xl font-semibold mt-1">{forecast.current.toFixed(0)} <span className="text-xs text-muted-foreground">MC</span></p>
        </div>
        <div className="p-4 rounded-xl border border-border/60 bg-card">
          <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /><p className="text-xs text-muted-foreground">Forecast</p></div>
          <p className="text-2xl font-semibold mt-1">{forecast.projected.toFixed(0)} <span className="text-xs text-muted-foreground">MC</span></p>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-2">Daily usage (30d)</h3>
        <div className="h-48 p-3 rounded-xl border border-border/60 bg-card">
          <ResponsiveContainer>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Per member</h3>
        <div className="h-48 p-3 rounded-xl border border-border/60 bg-card">
          <ResponsiveContainer>
            <BarChart data={perMember}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="amount" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Top actions</h3>
        <div className="space-y-1">
          {perTool.map(t => (
            <div key={t.name} className="flex items-center justify-between p-2 rounded border border-border/40 bg-card text-xs">
              <span className="truncate">{t.name}</span>
              <span className="font-mono">{t.amount}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
