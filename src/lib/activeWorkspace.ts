// Active workspace selection — tiny synchronous helpers + a change event so
// every subscriber (sidebar, pages) can refilter when the user switches.
import { useEffect, useState } from "react";

const KEY = "megsy_active_workspace_id";
export const WORKSPACE_CHANGED_EVENT = "megsy:workspace-changed";

export function getActiveWorkspaceId(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setActiveWorkspaceId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {}
  // Bust per-workspace cached lists so stale data from previous workspace disappears.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith("megsy_cache_") ||
        k.startsWith("megsy_conv_cache_") ||
        k.startsWith("megsy_sidebar_conv_")
      ) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT, { detail: { id } }));
  } catch {}
}

// React hook: returns the current active workspace id and re-renders when it changes.
export function useActiveWorkspaceId(): string | null {
  const [id, setId] = useState<string | null>(() => getActiveWorkspaceId());
  useEffect(() => {
    const onChange = () => setId(getActiveWorkspaceId());
    window.addEventListener(WORKSPACE_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return id;
}
