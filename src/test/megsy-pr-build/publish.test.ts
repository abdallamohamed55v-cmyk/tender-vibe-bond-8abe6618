import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom } from "./_helpers";

const FILE = "MegsyPrPublishPage.tsx";

describe("Build › Publish page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("large size (>10KB)", () => expect(sizeOf(FILE)).toBeGreaterThan(10240));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports supabase", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("imports projectBuildGuards", () => expect(importsFrom(src, "@/lib/projectBuildGuards")).toBe(true));
  it("imports react-router", () => expect(importsFrom(src, "react-router-dom")).toBe(true));
  it("uses sonner", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("renders Publish CTA", () => expect(src).toContain('"Publish"'));
  it("renders Published state", () => expect(src).toContain('"Published"'));
  it("offers public visibility", () => expect(src).toContain('"Anyone with the URL"'));
  it("offers workspace-only visibility", () => expect(src).toContain('"Only this workspace"'));
  it("has Public label", () => expect(src).toContain('"Public"'));
  it("has Continue CTA", () => expect(src).toContain('"Continue"'));
  it("supports icon upload", () => expect(src).toContain('"Icon uploaded"'));
  it("supports image upload", () => expect(src).toContain('"Image uploaded"'));
  it("validates missing info", () => expect(src).toContain('"Missing info"'));
  it("references default workspace", () => expect(src).toContain('"My Workspace"'));
  it("offers free security scan", () => expect(src).toContain('"Run security scan for free"'));
  it("brands default project", () => expect(src).toContain('"Megsy Generated Project"'));
  it("references Megsy app", () => expect(src.toLowerCase()).toContain("megsy app"));
  it("uses useNavigate", () => expect(src).toMatch(/useNavigate\b/));
  it("uses useParams", () => expect(src).toMatch(/useParams\b/));
  it("uses useEffect", () => expect(src).toMatch(/useEffect\b/));
  it("uses useState", () => expect(src).toMatch(/useState\b/));
  it("invokes supabase APIs", () => expect(src).toMatch(/supabase\.(from|functions|storage|auth)/));
  it("toasts on success/error", () => expect(src).toMatch(/toast\.(success|error|info|message)/));
});
