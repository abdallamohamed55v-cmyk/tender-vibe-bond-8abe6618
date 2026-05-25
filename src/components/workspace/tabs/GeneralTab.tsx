import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";
import WorkspaceImageUpload from "@/components/workspace/WorkspaceImageUpload";

export default function GeneralTab() {
  const { ws, isAdmin } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean }>();
  const [name, setName] = useState(ws.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>((ws as any).avatar_url || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: w } = await supabase.from("workspaces").select("name, avatar_url").eq("id", ws.id).maybeSingle();
      if (w) {
        setName(w.name);
        setAvatarUrl((w as any).avatar_url || null);
      }
    })();
  }, [ws.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim(), avatar_url: avatarUrl } as any)
      .eq("id", ws.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">General</h2>
        <p className="text-[15px] text-muted-foreground">Manage your workspace name and identity.</p>
      </div>

      <section className="space-y-8 pb-10 border-b border-border">
        <div className="space-y-2">
          <h3 className="text-[15px] font-semibold text-foreground">Workspace photo</h3>
          <p className="text-[13px] text-muted-foreground">A square image works best. Visible to all members.</p>
        </div>
        <WorkspaceImageUpload
          workspaceId={ws.id}
          value={avatarUrl}
          onChange={setAvatarUrl}
          kind="avatar"
          label=""
          shape="circle"
          disabled={!isAdmin}
        />
      </section>

      <section className="space-y-4 pb-10 border-b border-border">
        <div className="space-y-2">
          <h3 className="text-[15px] font-semibold text-foreground">Workspace name</h3>
          <p className="text-[13px] text-muted-foreground">This is the name your members will see across the app.</p>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isAdmin}
          className="max-w-md h-11"
          placeholder="Acme Inc."
        />
      </section>

      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="solid" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
