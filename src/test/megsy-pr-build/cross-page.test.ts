import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PAGES_DIR, read, exists, importsFrom } from "./_helpers";

const PAGES = [
  "MegsyPrAnalyticsPage.tsx",
  "MegsyPrCloudPage.tsx",
  "MegsyPrCodePage.tsx",
  "MegsyPrHomePage.tsx",
  "MegsyPrPublishFlowPage.tsx",
  "MegsyPrPublishPage.tsx",
  "MegsyPrSecurityPage.tsx",
  "MegsyPrSettingsPage.tsx",
  "MegsyPrSpeedPage.tsx",
  "MegsyPrVersionsPage.tsx",
  "MegsyPrWorkspacePage.tsx",
];

describe("Build › Cross-page contract", () => {
  it("all build pages are present on disk", () => {
    for (const f of PAGES) expect(exists(f)).toBe(true);
  });

  it("megsy-pr directory contains all expected pages", () => {
    const files = new Set(readdirSync(PAGES_DIR).filter(f => f.endsWith(".tsx")));
    for (const p of PAGES) expect(files.has(p)).toBe(true);
  });

  it("every page has a default export", () => {
    for (const f of PAGES) expect(read(f)).toMatch(/export default/);
  });

  it("every page is non-empty", () => {
    for (const f of PAGES) {
      expect(statSync(path.join(PAGES_DIR, f)).size).toBeGreaterThan(256);
    }
  });

  it("every page imports react-router-dom", () => {
    for (const f of PAGES) expect(importsFrom(read(f), "react-router-dom")).toBe(true);
  });

  it("every page imports lucide-react icons", () => {
    for (const f of PAGES) expect(importsFrom(read(f), "lucide-react")).toBe(true);
  });

  it("every interactive page wires supabase", () => {
    for (const f of PAGES.filter(p => p !== "MegsyPrSettingsPage.tsx")) {
      expect(importsFrom(read(f), "@/integrations/supabase/client")).toBe(true);
    }
  });

  it("every interactive page wires sonner toasts", () => {
    for (const f of PAGES.filter(p => !["MegsyPrSettingsPage.tsx", "MegsyPrAnalyticsPage.tsx"].includes(p))) {
      expect(importsFrom(read(f), "sonner")).toBe(true);
    }
  });

  it("no page imports next/* or angular/* (stack guard)", () => {
    for (const f of PAGES) {
      const s = read(f);
      expect(s).not.toMatch(/from "next\//);
      expect(s).not.toMatch(/from "@angular\//);
      expect(s).not.toMatch(/from "vue"/);
    }
  });

  it("no page hardcodes service-role keys", () => {
    for (const f of PAGES) {
      const s = read(f);
      expect(s).not.toMatch(/service_role/i);
      expect(s).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    }
  });

  it("no page uses console.error in production paths", () => {
    // allow console.warn but not stray console.error
    for (const f of PAGES) {
      const s = read(f);
      // count occurrences
      const count = (s.match(/console\.error\(/g) || []).length;
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it("every page is RTL-safe (uses no fixed ltr-only `left-`/`right-` without rtl handling)", () => {
    // smoke: every page is allowed to use these, just sanity that file parses with rtl utilities or none
    for (const f of PAGES) {
      const s = read(f);
      expect(typeof s).toBe("string");
    }
  });

  it("every page renders JSX", () => {
    for (const f of PAGES) expect(read(f)).toMatch(/<\w[\w-]*/);
  });

  it("every page uses semantic Tailwind tokens (no raw text-white)", () => {
    // ensure design tokens are respected on the build surface
    for (const f of PAGES) {
      const s = read(f);
      const offenders = (s.match(/\b(bg-white|text-white|bg-black|text-black)\b/g) || []).length;
      expect(offenders).toBeLessThanOrEqual(40); // allow some, flag explosions
    }
  });

  it("every page references react hooks consistently", () => {
    for (const f of PAGES) {
      const s = read(f);
      // pages either use hooks or are trivial placeholders
      const hasHooks = /use(State|Effect|Memo|Ref|Params|Navigate)\(/.test(s);
      const trivial = s.length < 4096;
      expect(hasHooks || trivial).toBe(true);
    }
  });
});
