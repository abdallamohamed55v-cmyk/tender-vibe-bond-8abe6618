import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { WorkspaceCtx } from "@/hooks/useWorkspaceContext";
import WorkspaceImageUpload from "@/components/workspace/WorkspaceImageUpload";

export default function BrandTab() {
  const { ws, isAdmin } = useOutletContext<{ ws: WorkspaceCtx; isAdmin: boolean }>();
  const [brand, setBrand] = useState<any>({
    primary_color: "#000000",
    heading_font: "Inter",
    body_font: "Inter",
    logo_url: "",
    cover_url: "",
    tone_of_voice: "",
    brand_description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("workspace_brand_kit").select("*").eq("workspace_id", ws.id).maybeSingle();
      if (data) setBrand((b: any) => ({ ...b, ...data }));
    })();
  }, [ws.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("workspace_brand_kit").upsert({
      ...brand, workspace_id: ws.id, updated_at: new Date().toISOString(),
    } as any);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Brand kit</h2>
        <p className="text-sm text-muted-foreground mt-1">Logo, color and typography for your workspace.</p>
      </div>

      <div className="space-y-6">
        <WorkspaceImageUpload
          workspaceId={ws.id} value={brand.logo_url}
          onChange={(url) => setBrand((b: any) => ({ ...b, logo_url: url }))}
          kind="logo" label="Logo" shape="rounded" disabled={!isAdmin}
        />
        <WorkspaceImageUpload
          workspaceId={ws.id} value={brand.cover_url}
          onChange={(url) => setBrand((b: any) => ({ ...b, cover_url: url }))}
          kind="cover" label="Cover image" shape="wide" disabled={!isAdmin}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Primary color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={brand.primary_color || "#000000"}
              onChange={(e) => setBrand((b: any) => ({ ...b, primary_color: e.target.value }))}
              disabled={!isAdmin}
              className="w-12 h-10 rounded-md border border-border bg-background cursor-pointer"
            />
            <Input
              value={brand.primary_color || ""}
              onChange={(e) => setBrand((b: any) => ({ ...b, primary_color: e.target.value }))}
              disabled={!isAdmin}
              className="font-mono text-xs flex-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Heading font</label>
            <Input value={brand.heading_font || ""} onChange={(e) => setBrand((b: any) => ({ ...b, heading_font: e.target.value }))} disabled={!isAdmin} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Body font</label>
            <Input value={brand.body_font || ""} onChange={(e) => setBrand((b: any) => ({ ...b, body_font: e.target.value }))} disabled={!isAdmin} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Tone of voice</label>
          <Input value={brand.tone_of_voice || ""} onChange={(e) => setBrand((b: any) => ({ ...b, tone_of_voice: e.target.value }))} disabled={!isAdmin} placeholder="Friendly, professional…" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Brand description</label>
          <Textarea value={brand.brand_description || ""} onChange={(e) => setBrand((b: any) => ({ ...b, brand_description: e.target.value }))} disabled={!isAdmin} rows={3} />
        </div>
      </div>

      {isAdmin && (
        <div className="pt-4 border-t border-border">
          <Button variant="solid" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save brand kit"}
          </Button>
        </div>
      )}
    </div>
  );
}
