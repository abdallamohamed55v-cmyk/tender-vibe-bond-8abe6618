import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom } from "./_helpers";

const FILE = "MegsyPrVersionsPage.tsx";

describe("Build › Versions page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("non-trivial size", () => expect(sizeOf(FILE)).toBeGreaterThan(2048));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports supabase", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("uses sonner", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("renders Back navigation", () => expect(src).toContain('"Back"'));
  it("has Delete control", () => expect(src).toContain('"Delete"'));
  it("confirms Deleted state", () => expect(src).toContain('"Deleted"'));
  it("uses useNavigate/useParams", () => {
    expect(src).toMatch(/useNavigate\b/);
    expect(src).toMatch(/useParams\b/);
  });
  it("uses useEffect", () => expect(src).toMatch(/useEffect\b/));
  it("uses useState", () => expect(src).toMatch(/useState\b/));
  it("queries snapshots from supabase", () => expect(src).toMatch(/supabase\.from\(/));
  it("calls toast on actions", () => expect(src).toMatch(/toast\.(success|error|info|message)/));
});
