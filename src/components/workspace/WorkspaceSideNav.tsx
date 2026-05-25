// Workspace side nav — Cal.com inspired. Quiet hover, subtle active state.
import { NavLink, useParams } from "react-router-dom";

const SECTIONS: { title: string; items: { to: string; label: string }[] }[] = [
  {
    title: "Workspace",
    items: [
      { to: "", label: "Overview" },
      { to: "members", label: "Members" },
      { to: "invites", label: "Invites" },
      { to: "projects", label: "Projects" },
      { to: "activity", label: "Activity" },
    ],
  },
  {
    title: "Billing",
    items: [
      { to: "billing", label: "Billing" },
      { to: "usage", label: "Usage" },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "general", label: "General" },
      { to: "brand", label: "Brand kit" },
      { to: "notifications", label: "Notifications" },
      { to: "security", label: "Security" },
      { to: "data", label: "Data & privacy" },
      { to: "danger", label: "Danger zone" },
    ],
  },
];

export default function WorkspaceSideNav() {
  const { id } = useParams<{ id: string }>();
  const base = `/settings/workspaces/${id}`;
  return (
    <nav className="space-y-7">
      {SECTIONS.map((sec) => (
        <div key={sec.title}>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 mb-2 px-3">
            {sec.title}
          </h4>
          <div className="flex flex-col">
            {sec.items.map((it) => {
              const path = it.to ? `${base}/${it.to}` : base;
              return (
                <NavLink
                  key={it.label}
                  to={path}
                  end={!it.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-[13.5px] transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`
                  }
                >
                  {it.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
