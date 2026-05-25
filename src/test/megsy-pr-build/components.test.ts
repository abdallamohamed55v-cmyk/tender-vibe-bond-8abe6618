import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(__dirname, "../../components/megsy-pr");
const read = (f: string) => readFileSync(path.join(DIR, f), "utf8");
const has = (s: string, mod: string) =>
  new RegExp(`from\\s+["']${mod.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']`).test(s);

import { describe, it, expect } from "vitest";

describe("Build › MegsyPrRedirect", () => {
  const src = read("MegsyPrRedirect.tsx");
  it("exists", () => expect(existsSync(path.join(DIR, "MegsyPrRedirect.tsx"))).toBe(true));
  it("imports react-router", () => expect(has(src, "react-router-dom")).toBe(true));
  it("uses Navigate", () => expect(src).toMatch(/Navigate\b/));
  it("has default export", () => expect(src).toMatch(/export default/));
  it("is a tiny shim (<2KB)", () => expect(statSync(path.join(DIR, "MegsyPrRedirect.tsx")).size).toBeLessThan(2048));
});

describe("Build › ChatMarkdown", () => {
  const src = read("ChatMarkdown.tsx");
  it("imports react-markdown", () => expect(has(src, "react-markdown")).toBe(true));
  it("uses remark-gfm plugin", () => expect(has(src, "remark-gfm")).toBe(true));
  it("uses remark-breaks plugin", () => expect(has(src, "remark-breaks")).toBe(true));
  it("renders ReactMarkdown JSX", () => expect(src).toMatch(/<ReactMarkdown\b/));
  it("default export", () => expect(src).toMatch(/export default/));
  it("registers remark plugins", () => expect(src).toMatch(/remarkPlugins=\{\[remarkGfm,\s*remarkBreaks\]\}/));
});

describe("Build › ConnectorsSheet", () => {
  const src = read("ConnectorsSheet.tsx");
  it("non-trivial size", () => expect(statSync(path.join(DIR, "ConnectorsSheet.tsx")).size).toBeGreaterThan(4096));
  it("imports lucide icons", () => expect(has(src, "lucide-react")).toBe(true));
  it("uses sonner toasts", () => expect(has(src, "sonner")).toBe(true));
  it("offers Back navigation", () => expect(src).toContain('"Back"'));
  it("offers Supabase connect", () => expect(src).toContain('"Connect your Supabase project"'));
  it("offers Custom deployment", () => expect(src).toContain('"Custom deployment"'));
  it("references CI/CD audience", () => expect(src).toContain('"CI/CD Friendly"'));
  it("references Branches & PRs feature", () => expect(src).toContain('"Branches & PRs"'));
  it("references Backups feature", () => expect(src).toContain('"Backups"'));
  it("references Dashboards", () => expect(src).toContain('"Dashboards"'));
  it("supports Disable / Disabled states", () => {
    expect(src).toContain('"Disable"');
    expect(src).toContain('"Disabled"');
  });
  it("targets Development teams", () => expect(src).toContain('"Development teams"'));
  it("uses useState", () => expect(src).toMatch(/useState\b/));
  it("default export", () => expect(src).toMatch(/export default/));
});

describe("Build › MobileChatView – wiring", () => {
  const src = read("MobileChatView.tsx");
  it("large composition (>15KB)", () => expect(statSync(path.join(DIR, "MobileChatView.tsx")).size).toBeGreaterThan(15360));
  it("imports MegsyStar", () => expect(has(src, "@/components/files/MegsyStar")).toBe(true));
  it("imports ChatMarkdown", () => expect(has(src, "@/components/megsy-pr/ChatMarkdown")).toBe(true));
  it("imports ConnectorsSheet", () => expect(has(src, "@/components/megsy-pr/ConnectorsSheet")).toBe(true));
  it("imports supabase", () => expect(has(src, "@/integrations/supabase/client")).toBe(true));
  it("imports buildAgentChanges", () => expect(has(src, "@/lib/buildAgentChanges")).toBe(true));
  it("imports Publish page", () => expect(has(src, "@/pages/megsy-pr/MegsyPrPublishPage")).toBe(true));
  it("uses react-router", () => expect(has(src, "react-router-dom")).toBe(true));
  it("uses sonner", () => expect(has(src, "sonner")).toBe(true));
});

describe("Build › MobileChatView – UI surface", () => {
  const src = read("MobileChatView.tsx");
  const labels = [
    "Analytics","Appearance","Applying changes","Bad response",
    "Calling GitHub API","Cloud","Code","Completed successfully",
    "Connectors","Copied",
  ];
  for (const l of labels) {
    it(`renders label "${l}"`, () => expect(src).toContain(`"${l}"`));
  }
  it("uses useState/useEffect/useRef", () => {
    expect(src).toMatch(/useState\b/);
    expect(src).toMatch(/useEffect\b/);
    expect(src).toMatch(/useRef\b/);
  });
  it("invokes supabase API", () => expect(src).toMatch(/supabase[\s\S]{0,80}\.(from|functions|auth|channel|removeChannel|storage)/));
  it("calls toast", () => expect(src).toMatch(/toast\.(success|error|info|message|loading)/));
  it("default export", () => expect(src).toMatch(/export default/));
});

describe("Build › MobilePreviewView", () => {
  const src = read("MobilePreviewView.tsx");
  it("non-trivial size (>6KB)", () => expect(statSync(path.join(DIR, "MobilePreviewView.tsx")).size).toBeGreaterThan(6144));
  it("imports MegsyStar", () => expect(has(src, "@/components/files/MegsyStar")).toBe(true));
  it("imports Publish page", () => expect(has(src, "@/pages/megsy-pr/MegsyPrPublishPage")).toBe(true));
  it("imports react-router", () => expect(has(src, "react-router-dom")).toBe(true));
  it("uses sonner", () => expect(has(src, "sonner")).toBe(true));
  it("offers Publish CTA", () => expect(src).toContain('"Publish"'));
  it("offers Refresh / Refresh preview", () => {
    expect(src).toContain('"Refresh"');
    expect(src).toContain('"Refresh preview"');
  });
  it("confirms Preview refreshed", () => expect(src).toContain('"Preview refreshed"'));
  it("shows Refreshing preview state", () => expect(src).toContain('"Refreshing preview"'));
  it("offers Open page", () => expect(src).toContain('"Open page"'));
  it("lists Pages", () => expect(src).toContain('"Pages"'));
  it("renders Enter hint", () => expect(src).toContain('"Enter"'));
  it("uses useState/useEffect/useRef", () => {
    expect(src).toMatch(/useState\b/);
    expect(src).toMatch(/useEffect\b/);
    expect(src).toMatch(/useRef\b/);
  });
  it("renders an iframe for preview", () => expect(src).toMatch(/<iframe\b/));
  it("default export", () => expect(src).toMatch(/export default/));
});
