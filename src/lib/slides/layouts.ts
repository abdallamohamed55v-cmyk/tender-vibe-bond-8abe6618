// Layout registry — 1000+ styled variants generated from a base set of
// renderable primitives. Each variant carries a `base` field pointing back to
// one of the ~46 base layouts that the renderer knows how to draw. Variants
// only differ in styling tokens (accent, alignment, density, ornament), so the
// renderer stays simple while the deck planner gets enormous visual variety.

export type ContentFit =
  | "title" | "section" | "text" | "text+image" | "bullets" | "stats"
  | "comparison" | "timeline" | "process" | "quote" | "gallery" | "definition";

export type LayoutId = string;

export interface LayoutMeta {
  id: LayoutId;
  /** Renderable base primitive (one of BASE_LAYOUTS). */
  base: string;
  fits: ContentFit[];
  hasImage: boolean;
  hasMultiImage: boolean;
  textDensity: "low" | "medium" | "high";
  /** Max bullets that fit cleanly. */
  maxBullets: number;
  /** Max paragraph words that fit cleanly. */
  maxBodyWords: number;
  /** Styling modifiers a renderer/theme can opt into. */
  accent?: string;       // color accent slot
  align?: "left" | "center" | "right";
  density?: "airy" | "balanced" | "dense";
  ornament?: string;     // visual ornament tag (e.g. "ribbon", "grid", "dots")
}

interface BaseDef {
  id: string;
  fits: ContentFit[];
  hasImage: boolean;
  hasMultiImage: boolean;
  textDensity: "low" | "medium" | "high";
  maxBullets: number;
  maxBodyWords: number;
}

/** Renderable base primitives. Renderer must understand each of these. */
const BASE_LAYOUTS: BaseDef[] = [
  // text+image
  { id: "split-right",      fits: ["text+image", "bullets", "text"], hasImage: true,  hasMultiImage: false, textDensity: "medium", maxBullets: 5, maxBodyWords: 100 },
  { id: "split-left",       fits: ["text+image", "bullets", "text"], hasImage: true,  hasMultiImage: false, textDensity: "medium", maxBullets: 5, maxBodyWords: 100 },
  { id: "image-full",       fits: ["text+image", "title"],           hasImage: true,  hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 30  },
  { id: "image-top",        fits: ["text+image", "bullets"],         hasImage: true,  hasMultiImage: false, textDensity: "medium", maxBullets: 4, maxBodyWords: 80  },
  { id: "image-bottom",     fits: ["text+image", "bullets"],         hasImage: true,  hasMultiImage: false, textDensity: "medium", maxBullets: 4, maxBodyWords: 80  },
  { id: "image-side-card",  fits: ["text+image"],                    hasImage: true,  hasMultiImage: false, textDensity: "medium", maxBullets: 4, maxBodyWords: 80  },
  { id: "focus-image",      fits: ["text+image", "title"],           hasImage: true,  hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 40  },
  { id: "magazine-cover",   fits: ["title", "section"],              hasImage: true,  hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 25  },
  { id: "diagonal-split",   fits: ["text+image"],                    hasImage: true,  hasMultiImage: false, textDensity: "medium", maxBullets: 4, maxBodyWords: 70  },
  { id: "polaroid",         fits: ["text+image"],                    hasImage: true,  hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 50  },
  // text-only
  { id: "centered",          fits: ["text", "title"],                hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 4, maxBodyWords: 60  },
  { id: "centered-narrow",   fits: ["text", "definition"],           hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 60  },
  { id: "left-aligned-hero", fits: ["title", "text"],                hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 3, maxBodyWords: 50  },
  { id: "right-aligned-hero",fits: ["title", "text"],                hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 3, maxBodyWords: 50  },
  { id: "definition",        fits: ["definition"],                   hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 60  },
  { id: "manifesto",         fits: ["title", "quote"],               hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 25  },
  { id: "poster-typo",       fits: ["title", "section"],             hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 12  },
  { id: "pull-quote",        fits: ["quote"],                        hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 40  },
  { id: "callout",           fits: ["title", "definition"],          hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 25  },
  // grid
  { id: "two-col",      fits: ["bullets", "comparison"],   hasImage: false, hasMultiImage: false, textDensity: "high",   maxBullets: 8, maxBodyWords: 0 },
  { id: "three-col",    fits: ["bullets"],                 hasImage: false, hasMultiImage: false, textDensity: "high",   maxBullets: 9, maxBodyWords: 0 },
  { id: "four-col",     fits: ["bullets"],                 hasImage: false, hasMultiImage: false, textDensity: "high",   maxBullets: 8, maxBodyWords: 0 },
  { id: "bento",        fits: ["bullets", "text+image"],   hasImage: false, hasMultiImage: false, textDensity: "high",   maxBullets: 6, maxBodyWords: 0 },
  { id: "masonry-cards",fits: ["bullets", "gallery"],      hasImage: false, hasMultiImage: true,  textDensity: "medium", maxBullets: 6, maxBodyWords: 0 },
  { id: "pillars",      fits: ["bullets"],                 hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 4, maxBodyWords: 0 },
  { id: "icon-grid",    fits: ["bullets"],                 hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 6, maxBodyWords: 0 },
  { id: "ribbon-cards", fits: ["bullets"],                 hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 4, maxBodyWords: 0 },
  // compare
  { id: "comparison",   fits: ["comparison"], hasImage: false, hasMultiImage: false, textDensity: "high",   maxBullets: 5, maxBodyWords: 0 },
  { id: "before-after", fits: ["comparison"], hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 4, maxBodyWords: 0 },
  { id: "vs-split",     fits: ["comparison"], hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 5, maxBodyWords: 0 },
  { id: "table-compare",fits: ["comparison"], hasImage: false, hasMultiImage: false, textDensity: "high",   maxBullets: 6, maxBodyWords: 0 },
  // data
  { id: "big-number",   fits: ["stats"], hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 60 },
  { id: "stat-cluster", fits: ["stats"], hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 0, maxBodyWords: 30 },
  { id: "stat-circles", fits: ["stats"], hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 0  },
  { id: "kpi-strip",    fits: ["stats"], hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 0  },
  // narrative
  { id: "process",            fits: ["process"],  hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 0, maxBodyWords: 0 },
  { id: "timeline",           fits: ["timeline"], hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 0, maxBodyWords: 0 },
  { id: "timeline-horizontal",fits: ["timeline"], hasImage: false, hasMultiImage: false, textDensity: "low",    maxBullets: 0, maxBodyWords: 0 },
  { id: "numbered-list",      fits: ["bullets", "process"], hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 6, maxBodyWords: 0 },
  { id: "step-vertical",      fits: ["process"],  hasImage: false, hasMultiImage: false, textDensity: "medium", maxBullets: 0, maxBodyWords: 0 },
  { id: "story-rows",         fits: ["timeline", "bullets"], hasImage: false, hasMultiImage: false, textDensity: "high", maxBullets: 0, maxBodyWords: 0 },
  // media
  { id: "gallery",        fits: ["gallery"], hasImage: false, hasMultiImage: true, textDensity: "low", maxBullets: 0, maxBodyWords: 30 },
  { id: "image-grid-2",   fits: ["gallery"], hasImage: false, hasMultiImage: true, textDensity: "low", maxBullets: 0, maxBodyWords: 30 },
  { id: "image-grid-4",   fits: ["gallery"], hasImage: false, hasMultiImage: true, textDensity: "low", maxBullets: 0, maxBodyWords: 20 },
  { id: "carousel-strip", fits: ["gallery"], hasImage: false, hasMultiImage: true, textDensity: "low", maxBullets: 0, maxBodyWords: 20 },
];

// Style-modifier vocabularies. Each combination produces a unique variant id.
const ACCENTS = [
  "indigo", "violet", "rose", "amber", "emerald", "teal", "cyan", "sky",
  "fuchsia", "lime", "orange", "slate", "stone", "gold", "ruby", "mint",
] as const;
const ALIGNS: Array<NonNullable<LayoutMeta["align"]>> = ["left", "center", "right"];
const DENSITIES: Array<NonNullable<LayoutMeta["density"]>> = ["airy", "balanced", "dense"];
const ORNAMENTS = [
  "plain", "ribbon", "grid", "dots", "noise", "gradient", "frame",
  "underline", "corner-mark", "rule",
] as const;

/** Deterministically generate >1000 variants. Order: base × accent × align ×
 *  density × ornament — sorted so the registry is stable across runs. */
function generateLayouts(): LayoutMeta[] {
  const out: LayoutMeta[] = [];
  // First: every base layout is itself a valid id (back-compat with existing
  // pickers and any LLM that emits a base name directly).
  for (const b of BASE_LAYOUTS) {
    out.push({ ...b, base: b.id });
  }
  // Then: styled variants. Use interleaved (round-robin) sampling so every
  // dimension is represented even when we cap the registry size — earlier
  // nested loops biased the output to a single density/ornament.
  const TARGET = 1100;
  const dims = {
    base: BASE_LAYOUTS,
    accent: ACCENTS,
    align: ALIGNS,
    density: DENSITIES,
    ornament: ORNAMENTS,
  };
  const total =
    dims.base.length * dims.accent.length * dims.align.length *
    dims.density.length * dims.ornament.length;
  const stride = Math.max(1, Math.floor(total / TARGET));
  let count = out.length;
  for (let i = 0; i < total && count < TARGET; i += stride) {
    let n = i;
    const b = dims.base[n % dims.base.length]; n = Math.floor(n / dims.base.length);
    const accent = dims.accent[n % dims.accent.length]; n = Math.floor(n / dims.accent.length);
    const align = dims.align[n % dims.align.length]; n = Math.floor(n / dims.align.length);
    const density = dims.density[n % dims.density.length]; n = Math.floor(n / dims.density.length);
    const ornament = dims.ornament[n % dims.ornament.length];
    const id = `${b.id}--${accent}-${align}-${density}-${ornament}`;
    out.push({ ...b, id, base: b.id, accent, align, density, ornament });
    count++;
  }
  return out;
}

export const LAYOUTS: LayoutMeta[] = generateLayouts();
export const LAYOUT_IDS = LAYOUTS.map((l) => l.id);
export const BASE_LAYOUT_IDS = BASE_LAYOUTS.map((b) => b.id);

const LAYOUT_INDEX = new Map(LAYOUTS.map((l) => [l.id, l]));

export function getLayoutMeta(id: string | undefined | null): LayoutMeta | undefined {
  if (!id) return undefined;
  const direct = LAYOUT_INDEX.get(id);
  if (direct) return direct;
  // Tolerate variants the renderer hasn't seen by stripping the suffix.
  const base = id.split("--")[0];
  return LAYOUT_INDEX.get(base);
}

/** Resolve any layout id (variant or base) to a renderable base id. */
export function resolveBaseLayout(id: string | undefined | null): string {
  const meta = getLayoutMeta(id);
  return meta?.base ?? "centered";
}

/** Pick a layout for a given content shape (rule-based, no LLM). */
export function suggestLayout(
  shape: {
    contentType: ContentFit;
    bulletsCount?: number;
    bodyWords?: number;
    hasImage?: boolean;
    statsCount?: number;
  },
  forbid: Set<string> = new Set(),
): string {
  // Score only against base layouts to keep this fast.
  const candidates = BASE_LAYOUTS.filter((l) => l.fits.includes(shape.contentType) && !forbid.has(l.id));
  if (candidates.length === 0) return "centered";
  const scored = candidates.map((l) => {
    let score = 100;
    if (shape.hasImage && !l.hasImage && !l.hasMultiImage) score -= 30;
    if (!shape.hasImage && l.hasImage) score -= 15;
    if (shape.bulletsCount && shape.bulletsCount > l.maxBullets && l.maxBullets > 0) score -= 40;
    if (shape.bodyWords && l.maxBodyWords > 0 && shape.bodyWords > l.maxBodyWords) score -= 35;
    return { id: l.id, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].id;
}
