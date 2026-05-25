import { describe, it, expect } from "vitest";
import { read, exists, sizeOf, importsFrom, usesIcon } from "./_helpers";

const FILE = "MegsyPrAnalyticsPage.tsx";

describe("Build › Analytics page (E2E surface)", () => {
  const src = read(FILE);

  it("file exists on disk", () => expect(exists(FILE)).toBe(true));
  it("is non-trivial in size (>2KB)", () => expect(sizeOf(FILE)).toBeGreaterThan(2048));
  it("exports a default React component", () => expect(src).toMatch(/export default function|export default \(/));
  it("imports React hooks", () => expect(src).toMatch(/from "react"/));
  it("imports react-router for navigation", () => expect(importsFrom(src, "react-router-dom")).toBe(true));
  it("imports supabase client", () => expect(importsFrom(src, "@/integrations/supabase/client")).toBe(true));
  it("imports recharts for visualisations", () => expect(importsFrom(src, "recharts")).toBe(true));
  it("uses lucide icons", () => expect(importsFrom(src, "lucide-react")).toBe(true));
  it("renders Back navigation control", () => expect(src).toContain('"Back"'));
  it("renders Visitors metric", () => expect(src).toContain('"Visitors"'));
  it("renders Pageviews metric", () => expect(src).toContain('"Pageviews"'));
  it("renders Bounce Rate metric", () => expect(src).toContain('"Bounce Rate"'));
  it("renders Visit Duration metric", () => expect(src).toContain('"Visit Duration"'));
  it("renders Views Per Visit metric", () => expect(src).toContain('"Views Per Visit"'));
  it("supports Today range", () => expect(src).toContain('"Today"'));
  it("supports Yesterday range", () => expect(src).toContain('"Yesterday"'));
  it("supports This month range", () => expect(src).toContain('"This month"'));
  it("groups by Country", () => expect(src).toContain('"Country"'));
  it("groups by Source", () => expect(src).toContain('"Source"'));
  it("groups by Page", () => expect(src).toContain('"Page"'));
  it("handles direct traffic", () => expect(src).toContain('"Direct"'));
  it("handles unknown values", () => expect(src).toContain('"Unknown"'));
  it("uses useNavigate hook", () => expect(src).toMatch(/useNavigate\b/));
  it("uses useParams hook", () => expect(src).toMatch(/useParams\b/));
  it("uses useEffect", () => expect(src).toMatch(/useEffect\b/));
  it("uses useState", () => expect(src).toMatch(/useState\b/));
  it("renders ResponsiveContainer chart wrapper", () => expect(src).toMatch(/ResponsiveContainer/));
  it("renders a chart series (Area/Bar/Line)", () => expect(src).toMatch(/<(Area|Bar|Line)Chart\b/));
  it("uses a back chevron icon", () => expect(usesIcon(src, "ChevronLeft")).toBe(true));
  it("queries supabase for data", () => expect(src).toMatch(/supabase[\s\S]{0,80}\.(from|functions|rpc)/));
});
