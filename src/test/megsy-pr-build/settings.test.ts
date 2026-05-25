import { describe, it, expect } from "vitest";
import { read, exists, importsFrom } from "./_helpers";

const FILE = "MegsyPrSettingsPage.tsx";

describe("Build › Settings page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists", () => expect(exists(FILE)).toBe(true));
  it("default export", () => expect(src).toMatch(/export default/));
  it("imports react-router", () => expect(importsFrom(src, "react-router-dom")).toBe(true));
  it("uses lucide icons", () => expect(importsFrom(src, "lucide-react")).toBe(true));
  it("renders Back navigation", () => expect(src).toContain('"Back"'));
  it("is currently a placeholder shell", () => expect(src.length).toBeLessThan(4096));
  it("renders JSX content", () => expect(src).toMatch(/<\w+/));
  it("uses useNavigate or Link for back", () => {
    expect(src.match(/useNavigate\b|<Link\b/)).toBeTruthy();
  });
});
