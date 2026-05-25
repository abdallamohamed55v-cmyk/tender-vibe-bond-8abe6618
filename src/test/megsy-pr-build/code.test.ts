import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom, usesIcon } from "./_helpers";

const FILE = "MegsyPrCodePage.tsx";

describe("Build › Code page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("non-trivial size (>10KB)", () => expect(sizeOf(FILE)).toBeGreaterThan(10240));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports react-router", () => expect(importsFrom(src, "react-router-dom")).toBe(true));
  it("imports supabase client", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("imports projectSandbox lib", () => expect(importsFrom(src, "@/lib/projectSandbox")).toBe(true));
  it("uses sonner toasts", () => expect(importsFrom(src, "sonner")).toBe(true));
  it("uses lucide icons", () => expect(importsFrom(src, "lucide-react")).toBe(true));
  it("declares FileRow interface", () => expect(src).toMatch(/interface FileRow/));
  it("declares TreeNode type", () => expect(src).toMatch(/type TreeNode/));
  it("implements buildTree(files)", () => expect(src).toMatch(/function buildTree/));
  it("detects file language", () => expect(src).toMatch(/function langOf/));
  it("formats byte sizes", () => expect(src).toMatch(/function fmtBytes/));
  it("supports TypeScript files", () => expect(src).toContain('"TypeScript"'));
  it("supports JavaScript files", () => expect(src).toContain('"JavaScript"'));
  it("supports JSON files", () => expect(src).toContain('"JSON"'));
  it("supports HTML files", () => expect(src).toContain('"HTML"'));
  it("supports Markdown files", () => expect(src).toContain('"Markdown"'));
  it("renders a TreeView component", () => expect(src).toMatch(/function TreeView/));
  it("renders Live preview tab", () => expect(src).toContain('"Live preview"'));
  it("has Open preview action", () => expect(src).toContain('"Open preview"'));
  it("has Open in new tab action", () => expect(src).toContain('"Open in new tab"'));
  it("has Close action", () => expect(src).toContain('"Close"'));
  it("has Copied feedback", () => expect(src).toContain('"Copied"'));
  it("handles sandbox start failure", () => expect(src).toContain('"Failed to start sandbox"'));
  it("handles sandbox stop failure", () => expect(src).toContain('"Failed to stop sandbox"'));
  it("uses Folder icon", () => expect(usesIcon(src, "Folder")).toBe(true));
  it("uses FileText icon", () => expect(usesIcon(src, "FileText")).toBe(true));
  it("uses Search icon", () => expect(usesIcon(src, "Search")).toBe(true));
  it("uses Play / Square sandbox controls", () => expect(usesIcon(src, "Play") && usesIcon(src, "Square")).toBe(true));
  it("uses Copy icon", () => expect(usesIcon(src, "Copy")).toBe(true));
  it("uses Monitor / Terminal icons", () => expect(usesIcon(src, "Monitor")).toBe(true));
  it("uses RefreshCcw icon", () => expect(usesIcon(src, "RefreshCcw")).toBe(true));
  it("uses ExternalLink icon", () => expect(usesIcon(src, "ExternalLink")).toBe(true));
  it("uses useNavigate", () => expect(src).toMatch(/useNavigate\b/));
  it("uses useParams", () => expect(src).toMatch(/useParams\b/));
  it("uses useEffect/useState/useRef/useMemo", () => {
    expect(src).toMatch(/useEffect\b/);
    expect(src).toMatch(/useState\b/);
    expect(src).toMatch(/useRef\b/);
    expect(src).toMatch(/useMemo\b/);
  });
  it("queries supabase tables", () => expect(src).toMatch(/supabase[\s\S]{0,80}\.(from|channel|removeChannel)\(/));
});
