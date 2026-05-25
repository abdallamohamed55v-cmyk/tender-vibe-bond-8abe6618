import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom } from "./_helpers";

const FILE = "MegsyPrHomePage.tsx";

describe("Build › Home page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("large composition (>15KB)", () => expect(sizeOf(FILE)).toBeGreaterThan(15360));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports AppSidebar", () => expect(importsFrom(src, "@/components/layout/AppSidebar")).toBe(true));
  it("imports useSidebarCollapsed", () => expect(importsFrom(src, "@/hooks/useSidebarCollapsed")).toBe(true));
  it("imports supabase client", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("imports buildSeedFiles", () => expect(importsFrom(src, "@/lib/buildSeedFiles")).toBe(true));
  it("imports template registry", () => expect(importsFrom(src, "@/lib/codeTemplatesRegistry.json")).toBe(true));
  it("imports framer-motion", () => expect(importsFrom(src, "framer-motion")).toBe(true));
  it("imports react-router", () => expect(importsFrom(src, "react-router-dom")).toBe(true));
  it("imports sonner", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("has Attach action", () => expect(src).toContain('"Attach"'));
  it("offers Connect to Supabase", () => expect(src).toContain('"Connect to Supabase"'));
  it("handles Supabase connect failure", () => expect(src).toContain('"Failed to connect Supabase"'));
  it("includes Database CTA", () => expect(src).toContain('"Database"'));
  it("includes Design CTA", () => expect(src).toContain('"Design"'));
  it("renders Enter key hint", () => expect(src).toContain('"Enter"'));
  it("includes inspirational prompts", () => {
    expect(src).toContain('"Bring an idea to life"');
    expect(src).toContain('"Build something bold"');
    expect(src).toContain('"Build the future"');
  });
  it("uses useNavigate", () => expect(src).toMatch(/useNavigate\b/));
  it("uses useEffect", () => expect(src).toMatch(/useEffect\b/));
  it("uses useState", () => expect(src).toMatch(/useState\b/));
  it("calls supabase auth or session", () => expect(src).toMatch(/supabase\.(auth|from|functions)/));
  it("uses motion.div / AnimatePresence", () => expect(src).toMatch(/motion\.|AnimatePresence/));
});
