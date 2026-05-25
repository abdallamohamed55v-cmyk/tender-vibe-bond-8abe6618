import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom } from "./_helpers";

const FILE = "MegsyPrPublishFlowPage.tsx";

describe("Build › Publish flow page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("non-trivial size", () => expect(sizeOf(FILE)).toBeGreaterThan(5120));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports MegsyStar", () => expect(importsFrom(src, "@/components/files/MegsyStar")).toBe(true));
  it("imports useUserPlan", () => expect(importsFrom(src, "@/hooks/useUserPlan")).toBe(true));
  it("imports supabase", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("imports projectBuildGuards", () => expect(importsFrom(src, "@/lib/projectBuildGuards")).toBe(true));
  it("uses sonner", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("describes public audience", () => expect(src).toContain('"Anyone with the link can visit the site"'));
  it("describes workspace-only audience", () => expect(src).toContain('"Only people in this workspace"'));
  it("describes premium-only gating", () => expect(src).toContain('"Available to Premium subscribers only"'));
  it("offers custom domain", () => expect(src).toContain('"Connect your own domain"'));
  it("has Audience selector", () => expect(src).toContain('"Audience"'));
  it("has Description field", () => expect(src).toContain('"Description"'));
  it("has Continue CTA", () => expect(src).toContain('"Continue"'));
  it("has Copied feedback", () => expect(src).toContain('"Copied"'));
  it("can toggle search preview", () => expect(src).toContain('"Hide search preview"'));
  it("explains discoverability", () => expect(src).toContain('"Improve discoverability"'));
  it("renders Lovable App label", () => expect(src).toContain('"Lovable App"'));
  it("renders workspace access description", () => expect(src).toContain('"Only workspace members have access"'));
  it("shows search preview", () => expect(src).toContain('"Preview how it looks in search"'));
  it("uses useNavigate/useParams", () => {
    expect(src).toMatch(/useNavigate\b/);
    expect(src).toMatch(/useParams\b/);
  });
  it("uses useState/useEffect", () => {
    expect(src).toMatch(/useState\b/);
    expect(src).toMatch(/useEffect\b/);
  });
  it("calls supabase", () => expect(src).toMatch(/supabase\.(from|functions|auth)/));
});
