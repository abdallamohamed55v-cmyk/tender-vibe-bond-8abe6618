import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Globe, ExternalLink, Loader2 } from "lucide-react";

interface DomainWithProject {
  id: string;
  domain: string;
  verification_status: string;
  project_id: string;
  created_at: string;
  projects?: { name: string | null } | null;
}

export default function DomainsSettingsPage() {
  const [domains, setDomains] = useState<DomainWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data } = await supabase
        .from("project_custom_domains")
        .select("id, domain, verification_status, project_id, created_at, projects(name)")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      setDomains((data as DomainWithProject[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen ios26-bg" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/settings"><Button variant="ghost" size="icon" className="rounded-xl"><ArrowRight className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">All domains</h1>
            <p className="text-sm text-muted-foreground mt-1">Custom domains for all your projects</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : domains.length === 0 ? (
          <div className="ios26-glass rounded-2xl p-12 text-center text-muted-foreground">
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="mb-4">No custom domains yet</p>
            <p className="text-xs">Open any project and add a domain from its settings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {domains.map((d) => (
              <div key={d.id} className="ios26-glass rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="font-medium hover:underline flex items-center gap-1" dir="ltr">
                      {d.domain} <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Project: {d.projects?.name || "Untitled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={d.verification_status === "active" ? "default" : "secondary"}>
                    {d.verification_status === "active" ? "Active" : "Verifying"}
                  </Badge>
                  <Link to={`/megsy-pr/${d.project_id}/domains`}>
                    <Button size="sm" variant="outline" className="rounded-xl">Manage</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
