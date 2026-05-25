import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Copy, Trash2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";

export default function InvitesTab() {
  const { ws, isAdmin } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean }>();
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("workspace_invites").select("*").eq("workspace_id", ws.id).order("created_at", { ascending: false });
    setInvites((data as any) ?? []);
  };
  useEffect(() => { load(); }, [ws.id]);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setSending(true);
    const { data, error } = await supabase.rpc("workspace_create_invite" as any, { p_workspace_id: ws.id, p_email: e, p_role: role });
    setSending(false);
    if (error || !(data as any)?.success) { toast.error((data as any)?.error || error?.message); return; }
    const link = `${window.location.origin}/invite/workspace/${(data as any).token}`;
    try {
      await supabase.functions.invoke("workspace-notify", { body: { type: "invite", workspace_id: ws.id, workspace_name: ws.name, to: e, link } });
    } catch {}
    toast.success(`Invite sent to ${e}`);
    setEmail(""); load();
  };

  const copy = (t: string) => { navigator.clipboard.writeText(`${window.location.origin}/invite/workspace/${t}`); toast.success("Copied"); };
  const revoke = async (id: string) => { await supabase.from("workspace_invites").update({ status: "revoked" } as any).eq("id", id); load(); };
  const resend = async (inv: any) => {
    const link = `${window.location.origin}/invite/workspace/${inv.invite_token}`;
    try {
      await supabase.functions.invoke("workspace-notify", { body: { type: "invite", workspace_id: ws.id, workspace_name: ws.name, to: inv.invite_email, link } });
      toast.success("Resent");
    } catch { toast.error("Failed to resend"); }
  };

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only admins can manage invites.</p>;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Invite teammate</h3>
        <div className="flex gap-2">
          <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="billing_manager">Billing</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={send} disabled={sending || !email.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Invites ({invites.length})</h3>
        {invites.length === 0 ? (
          <p className="text-xs text-muted-foreground">No invites yet.</p>
        ) : invites.map(inv => (
          <div key={inv.id} className="flex items-center gap-2 p-3 rounded-lg border border-border/40 bg-card">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{inv.invite_email}</p>
              <p className="text-xs text-muted-foreground">
                {inv.role} · {inv.status}
                {inv.expires_at && ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            {inv.status === "pending" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => copy(inv.invite_token)}><Copy className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => resend(inv)}><Send className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
