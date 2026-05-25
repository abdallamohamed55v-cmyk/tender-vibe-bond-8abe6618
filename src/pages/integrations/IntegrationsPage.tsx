// Integrations — luma/neutral. Grouped by category, clean list, detail modal on tap.
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import { integrations, INTEGRATION_CATEGORIES, type Integration } from "@/lib/integrationsData";
import IntegrationDetailModal from "@/components/integrations/IntegrationDetailModal";

const ICON_BASE = "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons";

const ICON_MAP: Record<string, string> = {
  gmail: "gmail", outlook: "microsoftoutlook", slack: "slack", discord: "discord",
  microsoftteams: "microsoftteams", zoom: "zoom", telegram: "telegram",
  whatsapp: "whatsapp", notion: "notion", googlecalendar: "googlecalendar",
  todoist: "todoist", trello: "trello", asana: "asana", clickup: "clickup",
  github: "github", gitlab: "gitlab", jira: "jira", linear: "linear",
  vercel: "vercel", salesforce: "salesforce", hubspot: "hubspot",
  stripe: "stripe", paypal: "paypal", shopify: "shopify",
  instagram: "instagram", twitter: "x", facebook: "facebook", linkedin: "linkedin",
  youtube: "youtube", pinterest: "pinterest", reddit: "reddit",
  googledrive: "googledrive", dropbox: "dropbox", figma: "figma", canva: "canva",
  zendesk: "zendesk", wordpress: "wordpress",
  firebase: "firebase", supabase: "supabase", airtable: "airtable",
  openai: "openai", googlesheets: "googlesheets",
};

function getIcon(app: string): string | null {
  return ICON_MAP[app] ? `${ICON_BASE}/${ICON_MAP[app]}.svg` : null;
}

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [connectedApps, setConnectedApps] = useState<Record<string, string>>({});
  const [loadingApp, setLoadingApp] = useState<string | null>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => { loadConnections(); }, []);

  const loadConnections = async () => {
    try {
      // Backend is the source of truth — no localStorage.
      const next: Record<string, string> = {};
      const [githubStatus, supabaseStatus] = await Promise.all([
        supabase.functions.invoke("github-push", { body: { action: "status" } }),
        supabase.functions.invoke("supabase-link-manager", { body: { action: "status" } }),
      ]);
      if (!githubStatus.error && githubStatus.data?.connected) next.github = "linked";
      else delete next.github;
      if (!supabaseStatus.error && supabaseStatus.data?.connected) next.supabase = "linked";
      else delete next.supabase;
      setConnectedApps(next);
    } catch {
      // ignore
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const persist = (next: Record<string, string>) => {
    setConnectedApps(next);
  };

  const handleConnect = async (integration: Integration) => {
    if (integration.app !== "github" && integration.app !== "supabase") {
      toast.error(`${integration.name} is not available yet`);
      return;
    }
    setLoadingApp(integration.id);
    const popup = window.open("about:blank", `${integration.app}-oauth`, "width=600,height=750");
    try {
      const statusFn = integration.app === "github" ? "github-push" : "supabase-link-manager";
      const startFn = integration.app === "github" ? "oauth-github-connect" : "supabase-oauth-start";
      const { data: status } = await supabase.functions.invoke(statusFn, { body: { action: "status" } });
      if (status?.connected) {
        if (popup && !popup.closed) popup.close();
        persist({ ...connectedApps, [integration.app]: "linked" });
        toast.success(`${integration.name} connected`);
        setSelectedIntegration(null);
        return;
      }
      const { data, error } = await supabase.functions.invoke(startFn, { body: { redirect_to: window.location.href } });
      if (error || data?.error || !data?.authorize_url) throw new Error(data?.error || error?.message || "OAuth is not configured");
      if (!popup) throw new Error("Allow popups to complete the connection");
      popup.location.href = data.authorize_url;
      const listener = (ev: MessageEvent) => {
        if (ev.data?.type !== `${integration.app}-oauth`) return;
        window.removeEventListener("message", listener);
        window.clearInterval(poll);
        if (ev.data?.ok === false) {
          toast.error(ev.data?.message || `${integration.name} connection failed`);
          setLoadingApp(null);
          return;
        }
        persist({ ...connectedApps, [integration.app]: "linked" });
        toast.success(`${integration.name} connected`);
        setSelectedIntegration(null);
        setLoadingApp(null);
      };
      window.addEventListener("message", listener);
      const poll = window.setInterval(async () => {
        if (!popup.closed) return;
        window.clearInterval(poll);
        window.removeEventListener("message", listener);
        await loadConnections();
        setLoadingApp(null);
      }, 1200);
    } catch (err) {
      if (popup && !popup.closed) popup.close();
      toast.error(err instanceof Error ? err.message : `${integration.name} connection failed`);
      setLoadingApp(null);
    } finally {
      if (!integration.app.includes("github") && !integration.app.includes("supabase")) setLoadingApp(null);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    setLoadingApp(integration.id);
    try {
      if (integration.app === "github") {
        await supabase.functions.invoke("github-push", { body: { action: "disconnect" } });
      }
      if (integration.app === "supabase") {
        await supabase.functions.invoke("supabase-link-manager", { body: { action: "disconnect" } });
      }
      const next = { ...connectedApps };
      delete next[integration.app];
      persist(next);
      toast.success(`${integration.name} disconnected`);
    } finally {
      setLoadingApp(null);
    }
  };


  const isConnected = (app: string) => !!connectedApps[app];

  const grouped = useMemo(() => {
    const out: { category: string; items: Integration[] }[] = [];
    INTEGRATION_CATEGORIES.filter(c => c !== "All").forEach(cat => {
      const items = integrations.filter(i => i.category === cat);
      if (items.length) out.push({ category: cat, items });
    });
    return out;
  }, []);

  const connectedCount = Object.keys(connectedApps).length;

  const Card = ({ integration }: { integration: Integration }) => {
    const connected = isConnected(integration.app);
    const iconUrl = getIcon(integration.app);
    return (
      <button
        onClick={() => setSelectedIntegration(integration)}
        className="group relative bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border/60 grid place-items-center shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
            {iconUrl ? (
              <img src={iconUrl} alt="" className="w-6 h-6 dark:invert" loading="lazy" />
            ) : (
              <span className="text-[14px] font-semibold text-foreground/70">{integration.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-[14px] font-semibold text-foreground truncate">{integration.name}</h3>
              {connected && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase shrink-0 inline-flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Linked
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">{integration.description}</p>
            <div
              className={`mt-4 w-full py-2 px-4 rounded-xl border text-[13px] font-semibold text-center transition-colors ${
                connected
                  ? "border-primary/20 bg-primary/5 text-primary"
                  : "border-border text-foreground/80 group-hover:bg-muted"
              }`}
            >
              {connected ? "Manage" : "Connect"}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const Content = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="max-w-4xl"
    >
      {/* Header & Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg">Supercharge your workflow with your favorite tools.</p>
        </div>
        <div className="flex items-center gap-3 bg-card p-1.5 pr-4 rounded-2xl border border-border shadow-sm self-start md:self-auto">
          <div className="h-10 px-4 flex items-center bg-primary/10 text-primary rounded-xl font-semibold text-sm">
            {connectedCount} Connected
          </div>
          <span className="text-sm font-medium text-muted-foreground">{integrations.length} Available</span>
        </div>
      </div>

      {isLoadingConnections ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-12">
          {grouped.map(group => (
            <section key={group.category}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  {group.category}
                </h2>
                <div className="h-px flex-1 bg-border/60"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map(i => <Card key={i.id} integration={i} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <IntegrationDetailModal
        integration={selectedIntegration}
        isConnected={selectedIntegration ? isConnected(selectedIntegration.app) : false}
        isLoading={selectedIntegration ? loadingApp === selectedIntegration.id : false}
        onConnect={() => selectedIntegration && handleConnect(selectedIntegration)}
        onDisconnect={() => selectedIntegration && handleDisconnect(selectedIntegration)}
        onClose={() => setSelectedIntegration(null)}
      />
    </motion.div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout title="Integrations" subtitle={`${integrations.length} apps · grouped by category`}>
        <Content />
      </DesktopSettingsLayout>
    );
  }

  return (
    <div className="h-[100dvh] bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 pb-16">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate("/settings")}
            className="w-9 h-9 grid place-items-center rounded-xl text-foreground/70 hover:bg-muted/50 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Integrations</h1>
        </div>
        <div className="pt-2">
          <Content />
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
