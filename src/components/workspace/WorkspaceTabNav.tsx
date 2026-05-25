import { NavLink, useParams } from "react-router-dom";
import { LayoutDashboard, Users, Mail, CreditCard, BarChart3, FolderKanban, Palette, Activity, Bell, Shield, Key, Settings, Database, AlertTriangle } from "lucide-react";

const TABS = [
  { to: "", icon: LayoutDashboard, label: "Overview" },
  { to: "members", icon: Users, label: "Members" },
  { to: "invites", icon: Mail, label: "Invites" },
  { to: "billing", icon: CreditCard, label: "Billing" },
  { to: "usage", icon: BarChart3, label: "Usage" },
  { to: "projects", icon: FolderKanban, label: "Projects" },
  { to: "brand", icon: Palette, label: "Brand Kit" },
  { to: "activity", icon: Activity, label: "Activity" },
  { to: "notifications", icon: Bell, label: "Notifications" },
  { to: "security", icon: Shield, label: "Security" },
  { to: "integrations", icon: Key, label: "API Keys" },
  { to: "general", icon: Settings, label: "General" },
  { to: "data", icon: Database, label: "Data & Privacy" },
  { to: "danger", icon: AlertTriangle, label: "Danger Zone" },
];

export default function WorkspaceTabNav() {
  const { id } = useParams<{ id: string }>();
  const base = `/settings/workspaces/${id}`;
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
      {TABS.map(t => {
        const path = t.to ? `${base}/${t.to}` : base;
        const Icon = t.icon;
        return (
          <NavLink
            key={t.label}
            to={path}
            end={!t.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border ${
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              }`
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
