import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight, Globe, Star, MoreHorizontal, ShoppingBag, Link2, Pencil,
  Loader2, Trash2, RefreshCw, Copy, X, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DomainRecord {
  id: string;
  project_id: string;
  domain: string;
  verification_status: string;
  ssl_status: string | null;
  is_primary?: boolean;
  error_message: string | null;
  verification_records: Array<{ type: string; name: string; value: string; purpose?: string }>;
  last_checked_at: string | null;
}

export default function ProjectDomainsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [defaultUrl, setDefaultUrl] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slug, setSlug] = useState("");
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const invoke = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Operation failed");
    return data;
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [{ data: p }, list] = await Promise.all([
        supabase.from("projects").select("publish_settings, published_url").eq("id", projectId).single(),
        invoke("list", { projectId }).catch(() => ({ domains: [] })),
      ]);
      const ps = (p as any)?.publish_settings || {};
      const s = ps.slug || `app-${projectId.slice(0, 8)}`;
      setSlug(s);
      const real = (p as any)?.published_url as string | null;
      setDefaultUrl(real || `https://${s}.megsy.app`);
      setDomains((list as any).domains || []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, invoke]);

  useEffect(() => { load(); }, [load]);

  const saveSlug = async () => {
    if (!projectId) return;
    const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    const { data: p } = await supabase.from("projects").select("publish_settings, published_url").eq("id", projectId).single();
    const next = { ...((p as any)?.publish_settings || {}), slug: safe };
    const { error } = await supabase.from("projects").update({ publish_settings: next }).eq("id", projectId);
    if (error) return toast.error(error.message);
    setSlug(safe);
    const real = (p as any)?.published_url as string | null;
    setDefaultUrl(real || `https://${safe}.megsy.app`);
    setEditingSlug(false);
    toast.success("Saved");
  };

  const setPrimary = async (id: string) => {
    setBusyId(id);
    setOpenMenu(null);
    try {
      await invoke("set_primary", { domainId: id });
      setDomains((xs) => xs.map((d) => ({ ...d, is_primary: d.id === id })));
      toast.success("Primary updated");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const verify = async (id: string) => {
    setBusyId(id);
    try {
      await invoke("verify", { domainId: id });
      toast.success("Re-checked");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    setOpenMenu(null);
    if (!confirm("Remove this domain?")) return;
    setBusyId(id);
    try {
      await invoke("remove", { domainId: id });
      setDomains((xs) => xs.filter((d) => d.id !== id));
      toast.success("Removed");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const addDomain = async () => {
    if (!projectId || !newDomain.trim()) return;
    setAdding(true);
    try {
      await invoke("add", { domain: newDomain.trim(), projectId });
      toast.success("Domain added — follow DNS instructions");
      setNewDomain("");
      setConnectOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setAdding(false); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const detail = domains.find((d) => d.id === detailsId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10">
        <div className="absolute inset-0 backdrop-blur-2xl backdrop-saturate-150 bg-background/60" />
        <div className="relative grid grid-cols-[auto_1fr_auto] items-center px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 -ms-2 rounded-full bg-foreground/[0.06] grid place-items-center"
            aria-label="Back"
          >
            <ChevronRight className="w-5 h-5 rtl:rotate-180 ltr:rotate-180" />
          </button>
          <h1 className="text-base font-semibold text-center">Domains</h1>
          <span className="w-10" />
        </div>
      </header>

      <main className="px-4 pt-4 pb-20 max-w-2xl mx-auto">
        {/* Default URL card */}
        <GlassCard className="px-3 py-3 mb-6">
          {editingSlug ? (
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-foreground/70 shrink-0" />
              <input
                autoFocus
                value={slug}
                onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                className="flex-1 min-w-0 h-9 rounded-lg bg-foreground/[0.05] px-2.5 text-[14px] outline-none"
                dir="ltr"
              />
              <button onClick={saveSlug} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold">Save</button>
              <button onClick={() => setEditingSlug(false)} className="h-9 w-9 rounded-lg bg-foreground/[0.06] grid place-items-center"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-foreground/70 shrink-0" />
              <a href={defaultUrl} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate text-[14.5px] underline decoration-foreground/30 underline-offset-2" dir="ltr">
                {defaultUrl}
              </a>
              <button
                onClick={() => setEditingSlug(true)}
                className="shrink-0 h-9 px-3 rounded-xl backdrop-blur-xl bg-foreground/[0.05] hover:bg-foreground/[0.08] border border-foreground/[0.08] text-[13.5px] font-medium inline-flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit URL
              </button>
            </div>
          )}
        </GlassCard>

        {/* Custom domains */}
        <h2 className="text-[20px] font-bold mb-3">Custom domains</h2>

        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>
        ) : (
          <>
            {domains.length > 0 && (
              <GlassCard className="mb-4 overflow-hidden">
                <div className="divide-y divide-foreground/[0.06]">
                  {domains.map((d) => {
                    const ok = d.verification_status === "active";
                    const showInline = !ok && (d.verification_records?.length ?? 0) > 0;
                    return (
                      <div key={d.id} className="relative">
                        <div className="px-4 h-14 flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? "bg-emerald-500" : d.verification_status === "failed" ? "bg-rose-500" : "bg-amber-500"}`} />
                          <button
                            onClick={() => setDetailsId(d.id)}
                            className="flex-1 min-w-0 text-start truncate text-[14.5px] underline decoration-foreground/30 underline-offset-2"
                            dir="ltr"
                          >
                            {d.domain}
                          </button>
                          <button
                            onClick={() => setOpenMenu(openMenu === d.id ? null : d.id)}
                            className="w-9 h-9 grid place-items-center rounded-full hover:bg-foreground/[0.06]"
                            aria-label="Menu"
                            disabled={busyId === d.id}
                          >
                            {busyId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                          </button>

                          {openMenu === d.id && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                              <div className="absolute end-2 top-12 z-30 min-w-[180px] rounded-2xl border border-foreground/10 backdrop-blur-2xl backdrop-saturate-150 shadow-xl overflow-hidden"
                                   style={{ background: "color-mix(in oklab, hsl(var(--background)) 75%, transparent)" }}>
                                {!d.is_primary && (
                                  <MenuItem onClick={() => setPrimary(d.id)} icon={<Star className="w-4 h-4" />} label="Set as primary" />
                                )}
                                <MenuItem onClick={() => verify(d.id)} icon={<RefreshCw className="w-4 h-4" />} label="Re-check status" />
                                <MenuItem onClick={() => { setDetailsId(d.id); setOpenMenu(null); }} icon={<Globe className="w-4 h-4" />} label="DNS instructions" />
                                <MenuItem onClick={() => remove(d.id)} icon={<Trash2 className="w-4 h-4" />} label="Remove" danger />
                              </div>
                            </>
                          )}
                        </div>

                        {showInline && (
                          <div className="px-4 pb-4 -mt-1">
                            <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[12.5px] font-medium">Add these DNS records at your registrar</div>
                                {d.last_checked_at && (
                                  <span className="text-[11px] text-muted-foreground">checked {new Date(d.last_checked_at).toLocaleTimeString()}</span>
                                )}
                              </div>
                              {d.error_message && (
                                <div className="rounded-lg bg-destructive/10 text-destructive text-[12px] p-2 mb-2">{d.error_message}</div>
                              )}
                              <div className="space-y-2">
                                {d.verification_records.map((r, i) => (
                                  <div key={i} className="rounded-lg bg-background/40 border border-foreground/[0.06] p-2.5">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[10.5px] font-semibold uppercase tracking-wide bg-foreground/10 px-1.5 py-0.5 rounded">{r.type}</span>
                                      <button onClick={() => copy(r.value)} className="text-[11.5px] inline-flex items-center gap-1 text-foreground/70 hover:text-foreground">
                                        <Copy className="w-3 h-3" /> Copy
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-[60px_1fr] gap-y-0.5 text-[12px]" dir="ltr">
                                      <span className="text-muted-foreground">Name</span><code className="break-all">{r.name}</code>
                                      <span className="text-muted-foreground">Value</span><code className="break-all text-foreground/80">{r.value}</code>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => verify(d.id)}
                                disabled={busyId === d.id}
                                className="mt-3 w-full h-10 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] font-semibold text-[13px] inline-flex items-center justify-center gap-2 disabled:opacity-60"
                              >
                                {busyId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                Re-check now
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}

            {/* Buy + Connect */}
            <GlassCard className="overflow-hidden">
              <ActionBlock
                title="Connect existing domain"
                desc="Connect a domain you already own from any provider."
                cta="Connect domain"
                icon={<Link2 className="w-4 h-4" />}
                onClick={() => setConnectOpen(true)}
              />
            </GlassCard>
          </>
        )}
      </main>

      {/* Connect domain sheet */}
      {connectOpen && (
        <Sheet onClose={() => setConnectOpen(false)} title="Connect domain">
          <p className="text-[13.5px] text-muted-foreground mb-3">
            Enter the domain you own (e.g. <span dir="ltr">example.com</span>). You will receive DNS records to add at your registrar.
          </p>
          <input
            autoFocus
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="example.com"
            dir="ltr"
            className="w-full h-12 rounded-xl bg-foreground/[0.05] border border-foreground/[0.08] px-3.5 text-[15px] outline-none mb-3"
          />
          <button
            onClick={addDomain}
            disabled={adding || !newDomain.trim()}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Connect
          </button>
        </Sheet>
      )}

      {/* DNS details sheet */}
      {detail && (
        <Sheet onClose={() => setDetailsId(null)} title={detail.domain}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${detail.verification_status === "active" ? "bg-emerald-500" : detail.verification_status === "failed" ? "bg-rose-500" : "bg-amber-500"}`} />
            <span className="text-[13.5px] font-medium capitalize">{detail.verification_status}</span>
            {detail.last_checked_at && (
              <span className="text-[12px] text-muted-foreground">· last check {new Date(detail.last_checked_at).toLocaleString()}</span>
            )}
          </div>

          {detail.error_message && (
            <div className="rounded-xl bg-destructive/10 text-destructive text-[13px] p-3 mb-3">{detail.error_message}</div>
          )}

          {detail.verification_records?.length ? (
            <>
              <div className="text-[13px] font-medium mb-2">Add these DNS records at your registrar:</div>
              <div className="space-y-2">
                {detail.verification_records.map((r, i) => (
                  <div key={i} className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide bg-foreground/10 px-2 py-0.5 rounded">{r.type}</span>
                      <button onClick={() => copy(r.value)} className="text-[12px] inline-flex items-center gap-1 text-foreground/70 hover:text-foreground">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-y-1 text-[12.5px]" dir="ltr">
                      <span className="text-muted-foreground">Name</span><code className="break-all">{r.name}</code>
                      <span className="text-muted-foreground">Value</span><code className="break-all text-foreground/80">{r.value}</code>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => verify(detail.id)}
                className="mt-4 w-full h-11 rounded-xl bg-foreground/[0.06] hover:bg-foreground/[0.1] font-semibold text-[14px] inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Re-check now
              </button>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground">Domain is active. No DNS changes required.</div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-2xl border border-foreground/[0.08] backdrop-blur-2xl backdrop-saturate-150 ${className}`}
      style={{ background: "color-mix(in oklab, hsl(var(--background)) 55%, transparent)" }}
    >
      {children}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 h-11 text-[14px] text-start hover:bg-foreground/[0.06] ${danger ? "text-destructive" : ""}`}
    >
      <span className="opacity-80">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

function ActionBlock({ title, desc, cta, icon, onClick }: { title: string; desc: string; cta: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <div className="p-4">
      <div className="font-semibold text-[15px] mb-1">{title}</div>
      <div className="text-[13.5px] text-muted-foreground mb-3 leading-relaxed">{desc}</div>
      <button
        onClick={onClick}
        className="w-full h-11 rounded-xl backdrop-blur-xl bg-foreground/[0.05] hover:bg-foreground/[0.08] border border-foreground/[0.08] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
      >
        {icon}
        {cta}
      </button>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-md" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[101] rounded-t-[28px] border-t border-foreground/[0.08] backdrop-blur-2xl backdrop-saturate-150 max-h-[85vh] overflow-y-auto"
        style={{
          background: "color-mix(in oklab, hsl(var(--background)) 70%, transparent)",
          boxShadow: "0 -20px 60px -20px rgba(0,0,0,0.35), inset 0 1px 0 0 hsl(var(--foreground) / 0.08)",
        }}
      >
        <div className="grid place-items-center pt-2.5 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-foreground/20" />
        </div>
        <div className="flex items-center justify-between px-5 pt-1 pb-3">
          <span className="font-bold text-[18px] truncate">{title}</span>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </>
  );
}
