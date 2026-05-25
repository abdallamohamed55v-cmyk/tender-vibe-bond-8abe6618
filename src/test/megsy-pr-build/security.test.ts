import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom } from "./_helpers";

const FILE = "MegsyPrSecurityPage.tsx";

describe("Build › Security page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("non-trivial size", () => expect(sizeOf(FILE)).toBeGreaterThan(4096));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports supabase", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("uses sonner", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("has Run Scan CTA", () => expect(src).toContain('"Run Scan"'));
  it("notifies Scan complete", () => expect(src).toContain('"Scan complete"'));
  it("shows empty-state guidance", () => expect(src).toContain('"Run a scan to see findings"'));
  it("describes all findings list", () => expect(src).toContain('"All findings from the latest scan"'));
  it("has Save action", () => expect(src).toContain('"Save"'));
  it("confirms Saved state", () => expect(src).toContain('"Saved"'));
  it("shows Nothing to fix when clean", () => expect(src).toContain('"Nothing to fix"'));
  it("renders Error severity bucket", () => expect(src).toContain('"Error"'));
  it("renders Info severity bucket", () => expect(src).toContain('"Info"'));
  it("indicates empty severity bucket", () => expect(src).toContain('"No issues at this level"'));
  it("checks exposed files", () => expect(src).toContain('"Exposed file check"'));
  it("checks exposed secrets", () => expect(src).toContain('"Exposed secret check"'));
  it("checks form security", () => expect(src).toContain('"Form security check"'));
  it("checks reachability", () => expect(src).toContain('"Reachability check"'));
  it("renders Back nav", () => expect(src).toContain('"Back"'));
  it("uses useNavigate/useParams", () => {
    expect(src).toMatch(/useNavigate\b/);
    expect(src).toMatch(/useParams\b/);
  });
  it("uses useState/useEffect", () => {
    expect(src).toMatch(/useState\b/);
    expect(src).toMatch(/useEffect\b/);
  });
  it("invokes supabase", () => expect(src).toMatch(/supabase\.(from|functions)/));
});
