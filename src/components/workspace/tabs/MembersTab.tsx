import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Crown, Pause, Play, UserCheck, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/hooks/useWorkspace";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

const ROLES = ["admin", "editor", "member", "viewer", "billing_manager"] as const;

export default function MembersTab() {
  const { ws, isAdmin, isOwner, me } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean; isOwner: boolean; me: string | null }>();
  const { members, refresh } = useWorkspaceMembers(ws.id);
  const [requests, setRequests] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const [r, s] = await Promise.all([
        supabase.from("workspace_join_requests").select("*").eq("workspace_id", ws.id).eq("status", "pending"),
        supabase.from("workspace_member_status").select("user_id, suspended").eq("workspace_id", ws.id),
      ]);
      setRequests((r.data as any) ?? []);
      const m: Record<string, boolean> = {};
      ((s.data as any) ?? []).forEach((x: any) => { m[x.user_id] = x.suspended; });
      setStatusMap(m);
    })();
  }, [ws.id, members.length]);

  const setRole = async (userId: string, role: string) => {
    const { data, error } = await supabase.rpc("workspace_set_member_role" as any, { p_ws: ws.id, p_user: userId, p_role: role });
    if (error || !(data as any)?.success) { toast.error((data as any)?.error || error?.message || "Failed"); return; }
    toast.success("Role updated"); refresh();
  };

  const transferOwnership = async (userId: string) => {
    if (!confirm("Transfer ownership to this member? You will become an admin.")) return;
    const { data, error } = await supabase.rpc("workspace_transfer_ownership" as any, { p_ws: ws.id, p_new_owner: userId });
    if (error || !(data as any)?.success) { toast.error((data as any)?.error || error?.message || "Failed"); return; }
    toast.success("Ownership transferred"); window.location.reload();
  };

  const toggleSuspend = async (userId: string, suspend: boolean) => {
    const { data, error } = await supabase.rpc("workspace_set_member_status" as any, { p_ws: ws.id, p_user: userId, p_suspended: suspend, p_reason: null });
    if (error || !(data as any)?.success) { toast.error((data as any)?.error || error?.message); return; }
    toast.success(suspend ? "Member suspended" : "Member reactivated");
    setStatusMap(s => ({ ...s, [userId]: suspend }));
  };

  const removeMember = async (memberId: string, userId: string) => {
    if (userId === ws.owner_id) { toast.error("Can't remove owner"); return; }
    if (!confirm("Remove this member?")) return;
    await supabase.from("workspace_members").delete().eq("id", memberId);
    refresh();
  };

  const updateLimit = async (memberId: string, val: string) => {
    const v = val.trim() === "" ? null : Number(val);
    await supabase.from("workspace_members").update({ monthly_limit: v } as any).eq("id", memberId);
  };

  const approveRequest = async (id: string) => {
    const { data } = await supabase.rpc("workspace_approve_request" as any, { p_request_id: id });
    if ((data as any)?.success) { toast.success("Approved"); setRequests(r => r.filter(x => x.id !== id)); refresh(); }
  };
  const rejectRequest = async (id: string) => {
    const { data } = await supabase.rpc("workspace_reject_request" as any, { p_request_id: id });
    if ((data as any)?.success) { toast.success("Rejected"); setRequests(r => r.filter(x => x.id !== id)); }
  };

  return (
    <div className="space-y-6">
      {requests.length > 0 && isAdmin && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Pending join requests ({requests.length})</h3>
          {requests.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card">
              <span className="text-xs font-mono truncate">{r.user_id.slice(0, 12)}…</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => approveRequest(r.id)}><UserCheck className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => rejectRequest(r.id)}><UserX className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Members ({members.length})</h3>
        {members.map(m => {
          const suspended = !!statusMap[m.user_id];
          const isOwnerRow = m.user_id === ws.owner_id;
          return (
            <div key={m.id} className={`p-3 rounded-xl border bg-card ${suspended ? "opacity-60 border-orange-500/40" : "border-border/60"}`}>
              <div className="flex items-center gap-3">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {(m.display_name || "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate flex items-center gap-1">
                    {m.display_name || "Member"}
                    {isOwnerRow && <Crown className="w-3 h-3 text-amber-500" />}
                    {m.user_id === me && <span className="text-xs text-muted-foreground">(you)</span>}
                    {suspended && <span className="text-[10px] uppercase text-orange-500">suspended</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(m.monthly_used).toFixed(1)} MC this month
                    {m.monthly_limit ? ` / ${m.monthly_limit}` : ""}
                  </p>
                </div>
              </div>

              {isAdmin && !isOwnerRow && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Select value={m.role} onValueChange={(v) => setRole(m.user_id, v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs capitalize">{r.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Monthly limit"
                    defaultValue={m.monthly_limit ?? ""}
                    onBlur={(e) => updateLimit(m.id, e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => toggleSuspend(m.user_id, !suspended)} className="text-xs">
                    {suspended ? <><Play className="w-3 h-3 mr-1" /> Unsuspend</> : <><Pause className="w-3 h-3 mr-1" /> Suspend</>}
                  </Button>
                  {isOwner && (
                    <Button size="sm" variant="outline" onClick={() => transferOwnership(m.user_id)} className="text-xs">
                      <Crown className="w-3 h-3 mr-1" /> Make owner
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m.id, m.user_id)} className="text-xs col-span-2 text-destructive">
                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
