import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom } from "./_helpers";

const FILE = "MegsyPrSpeedPage.tsx";

describe("Build › Speed & SEO page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("non-trivial size", () => expect(sizeOf(FILE)).toBeGreaterThan(2048));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports supabase", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("uses sonner", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("renders Speed metric", () => expect(src).toContain('"Speed"'));
  it("renders Accessibility metric", () => expect(src).toContain('"Accessibility"'));
  it("offers Start test CTA", () => expect(src).toContain('"Start test"'));
  it("offers Retest CTA", () => expect(src).toContain('"Retest"'));
  it("handles Test failed state", () => expect(src).toContain('"Test failed"'));
  it("renders Back navigation", () => expect(src).toContain('"Back"'));
  it("uses useNavigate/useParams", () => {
    expect(src).toMatch(/useNavigate\b/);
    expect(src).toMatch(/useParams\b/);
  });
  it("uses useState", () => {
    expect(src).toMatch(/useState\b/);
  });
  it("invokes supabase functions or tables", () => expect(src).toMatch(/supabase\.(from|functions)/));
});
