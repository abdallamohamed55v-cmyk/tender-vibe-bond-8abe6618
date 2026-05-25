// Memory — luma/neutral redesign. Soft cards, refined empty state.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import { useActiveWorkspaceId } from "@/lib/activeWorkspace";
import { BackIcon, MemoryIcon } from "@/components/settings/SettingsIcons";
import { goBackOr } from "@/lib/navigation";

interface MemoryEntry {
  id: string;
  title: string | null;
  summary: string;
  scope: string;
  created_at: string;
}

const MemoryPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const workspaceId = useActiveWorkspaceId();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadMemories(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspaceId]);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let q = supabase
        .from("user_memory_entries")
        .select("id, title, summary, scope, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      q = workspaceId ? q.eq("workspace_id", workspaceId) : q.is("workspace_id", null);
      const { data } = await q;
      setMemories(data || []);
    } catch (e) {
      console.error("Failed to load memories:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("user_memory_entries").delete().eq("id", id);
      if (error) throw error;
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success("Memory deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Clear ALL memories? This cannot be undone.")) return;
    setIsClearing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let del = supabase.from("user_memory_entries").delete().eq("user_id", user.id);
      del = workspaceId ? del.eq("workspace_id", workspaceId) : del.is("workspace_id", null);
      const { error } = await del;
      if (error) throw error;
      setMemories([]);
      toast.success("All memories cleared");
    } catch {
      toast.error("Failed to clear memories");
    } finally {
      setIsClearing(false);
    }
  };

  const Body = () => (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      {/* Intro */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card mb-6">
        <div className="w-10 h-10 rounded-xl bg-muted grid place-items-center text-foreground shrink-0">
          <MemoryIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">What Megsy remembers</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Important details Megsy has learned about you to personalize replies. These are private and visible only to you.
          </p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
          {memories.length} {memories.length === 1 ? "entry" : "entries"}
        </p>
        {memories.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isClearing}
            className="text-[12px] font-medium text-destructive/80 hover:text-destructive transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 py-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted grid place-items-center text-foreground/60 mx-auto mb-4">
            <MemoryIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-foreground">No memories yet</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            Megsy will gently remember important things from your conversations.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {memories.map((memory, i) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-start justify-between gap-3 px-4 py-4 group first:rounded-t-2xl last:rounded-b-2xl"
            >
              <div className="flex-1 min-w-0">
                {memory.title && <p className="text-sm font-medium text-foreground mb-1">{memory.title}</p>}
                <p className="text-[13px] text-muted-foreground leading-relaxed">{memory.summary}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{memory.scope}</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="text-[10px] text-muted-foreground/60">{new Date(memory.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteOne(memory.id)}
                disabled={deletingId === memory.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                aria-label="Delete memory"
              >
                {deletingId === memory.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout title="Memory" subtitle="Your personalized AI memory">
        <Body />
      </DesktopSettingsLayout>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-2xl mx-auto px-5 pb-16">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => goBackOr(navigate, "/settings")} className="w-9 h-9 grid place-items-center rounded-xl text-foreground/70 hover:bg-muted/50 transition-colors" aria-label="Back">
            <BackIcon className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Memory</h1>
        </div>
        <Body />
      </div>
    </div>
  );
};

export default MemoryPage;
