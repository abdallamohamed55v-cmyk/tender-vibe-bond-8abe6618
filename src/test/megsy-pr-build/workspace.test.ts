import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom, usesIcon } from "./_helpers";

const FILE = "MegsyPrWorkspacePage.tsx";

describe("Build › Workspace page – core surface", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("very large composition (>40KB)", () => expect(sizeOf(FILE)).toBeGreaterThan(40960));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports AppSidebar", () => expect(importsFrom(src, "@/components/layout/AppSidebar")).toBe(true));
  it("imports MobileChatView", () => expect(importsFrom(src, "@/components/megsy-pr/MobileChatView")).toBe(true));
  it("imports MobilePreviewView", () => expect(importsFrom(src, "@/components/megsy-pr/MobilePreviewView")).toBe(true));
  it("imports use-mobile hook", () => expect(importsFrom(src, "@/hooks/use-mobile")).toBe(true));
  it("imports supabase client", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("imports buildAgentChanges", () => expect(importsFrom(src, "@/lib/buildAgentChanges")).toBe(true));
  it("imports jobs client", () => expect(importsFrom(src, "@/lib/jobs/client")).toBe(true));
  it("imports projectBuildGuards", () => expect(importsFrom(src, "@/lib/projectBuildGuards")).toBe(true));
  it("imports projectSandbox", () => expect(importsFrom(src, "@/lib/projectSandbox")).toBe(true));
  it("uses sonner", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("uses lucide icons", () => expect(importsFrom(src, "lucide-react")).toBe(true));
  it("uses useNavigate/useParams", () => {
    expect(src).toMatch(/useNavigate\b/);
    expect(src).toMatch(/useParams\b/);
  });
  it("uses useEffect/useState/useRef/useMemo", () => {
    expect(src).toMatch(/useEffect\b/);
    expect(src).toMatch(/useState\b/);
    expect(src).toMatch(/useRef\b/);
    expect(src).toMatch(/useMemo\b/);
  });
});

describe("Build › Workspace page – chat & build surface", () => {
  const src = read(FILE);

  it("renders Back control", () => expect(/Back|ChevronLeft|ArrowLeft/.test(src)).toBe(true));
  it("renders Enter key hint", () => expect(src).toContain('"Enter"'));
  it("shows MC usage metric", () => expect(src).toContain('"MC usage"'));
  it("shows Calls metric", () => expect(src).toContain('"Calls"'));
  it("shows Avg time metric", () => expect(src).toContain('"Avg time"'));
  it("renders Desktop preview toggle", () => expect(src).toContain('"Desktop"'));
  it("indicates Everything works state", () => expect(src).toContain('"Everything works"'));
  it("handles FAIL state for checks", () => expect(src).toContain('"FAIL"'));
  it("annotates automatic versions", () => expect(src).toContain('"Automatic version"'));
  it("shows Built with Megsy AI badge", () => expect(src).toContain('"Built with Megsy AI"'));
  it("offers Connect Supabase CTA", () => expect(src).toContain('"Connect Supabase"'));
  it("offers Custom domain CTA", () => expect(/Custom domain|custom-domain|domains/i.test(src)).toBe(true));
  it("mentions GitHub integration", () => expect(src).toContain('"GitHub"'));
  it("handles Import failed state", () => expect(src).toContain('"Import failed"'));
  it("handles Supabase link failure", () => expect(src).toContain('"Failed to link Supabase account"'));
});

describe("Build › Workspace page – data & runtime wiring", () => {
  const src = read(FILE);

  it("calls supabase tables", () => expect(src).toMatch(/supabase\.from\(/));
  it("calls supabase edge functions", () => expect(src).toMatch(/supabase\.functions\.invoke\(/));
  it("calls toast helpers", () => expect(src).toMatch(/toast\.(success|error|info|message|loading)/));
  it("references projectSandbox API", () => expect(src).toMatch(/projectSandbox\./));
  it("references jobs client", () => expect(src).toMatch(/jobs\.|createJob|getJob|streamJob/i));
  it("uses lucide back/menu icons", () => expect(usesIcon(src, "ChevronLeft") || usesIcon(src, "ArrowLeft")).toBe(true));
});
