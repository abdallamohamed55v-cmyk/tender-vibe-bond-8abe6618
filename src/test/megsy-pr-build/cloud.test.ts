import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom, usesIcon } from "./_helpers";

const FILE = "MegsyPrCloudPage.tsx";

describe("Build › Cloud page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("non-trivial size", () => expect(sizeOf(FILE)).toBeGreaterThan(4096));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports react-router", () => expect(importsFrom(src, "react-router-dom")).toBe(true));
  it("imports supabase client", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("uses sonner for toasts", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("uses lucide icons", () => expect(importsFrom(src, "lucide-react")).toBe(true));
  it("renders Back control", () => expect(src).toContain('"Back"'));
  it("can link to Supabase", () => expect(src).toContain('"Linked to Supabase"'));
  it("can unlink account", () => expect(src).toContain('"Account disconnected"'));
  it("handles linking error", () => expect(src).toContain('"Failed to link to Supabase"'));
  it("handles unlink error", () => expect(src).toContain('"Failed to unlink"'));
  it("handles connection failure", () => expect(src).toContain('"Connection failed"'));
  it("handles missing authorize URL", () => expect(src).toContain('"Missing authorize URL"'));
  it("handles project list fetch failure", () => expect(src).toContain('"Failed to fetch project list"'));
  it("can add Google Auth", () => expect(src).toContain('"Add Google Auth"'));
  it("can manage secrets", () => expect(src).toContain('"Manage secrets"'));
  it("shows Edge Functions section", () => expect(src).toContain('"Edge Functions"'));
  it("has Refresh action", () => expect(src).toContain('"Refresh"'));
  it("notifies on project linked", () => expect(src).toContain('"Project linked"'));
  it("has Help link", () => expect(src).toContain('"Help"'));
  it("uses useNavigate", () => expect(src).toMatch(/useNavigate\b/));
  it("uses useParams", () => expect(src).toMatch(/useParams\b/));
  it("uses useEffect", () => expect(src).toMatch(/useEffect\b/));
  it("uses useState", () => expect(src).toMatch(/useState\b/));
  it("calls toast()", () => expect(src).toMatch(/toast\.(success|error|message|info)\(/));
  it("uses ChevronLeft icon", () => expect(usesIcon(src, "ChevronLeft")).toBe(true));
  it("calls supabase API", () => expect(src).toMatch(/supabase\.(from|functions|auth|rpc)/));
});
