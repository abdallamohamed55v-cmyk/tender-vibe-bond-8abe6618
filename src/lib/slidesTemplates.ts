// Templates available in chat-mode slide generation.
// All previous templates were removed — new templates will be added one by one
// from user-provided references.

export type SlidesCategory = "premium" | "standard";

export type SlidesVariant =
  | "editorial-serif"
  | "bold-display"
  | "minimal-mono"
  | "glass-frost"
  | "neon-tech"
  | "soft-pastel"
  | "luxury-gold"
  | "brutalist"
  | "aurora-glow"
  | "magazine-grid"
  | "swiss-modernist"
  | "retro-vhs"
  | "terminal-green"
  | "kinetic-poster"
  | "ornate-baroque"
  | "blueprint-tech"
  | "paper-collage"
  | "vapor-y2k"
  | "organic-clay"
  | "cinematic-letterbox";

export interface SlidesTemplate {
  id: string;
  name: string;
  description: string;
  colors: [string, string];
  category: SlidesCategory;
  htmlSlug: string;
  variant: SlidesVariant;
  cover: string;
}

import digitalOasisCover from "@/assets/slide-templates/digital-oasis.jpg";
import oceanFlowCover from "@/assets/slide-templates/ocean-flow.jpg";
import seasonalScrollCover from "@/assets/slide-templates/seasonal-scroll.jpg";
import vantaAtelierCover from "@/assets/slide-templates/vanta-atelier.jpg";
import aquaraWaterCover from "@/assets/slide-templates/aquara-water.jpg";
import landscapeLanguageCover from "@/assets/slide-templates/landscape-language.jpg";
import valenceBlobsCover from "@/assets/slide-templates/valence-blobs.jpg";
import synthraBuilderCover from "@/assets/slide-templates/synthra-builder.jpg";
import kamiNotebookCover from "@/assets/slide-templates/kami-notebook.jpg";
import spideyWebCover from "@/assets/slide-templates/spidey-web.jpg";
import yashFolioCover from "@/assets/slide-templates/yash-folio.jpg";
import stormToCalmCover from "@/assets/slide-templates/storm-to-calm.jpg";
import folioScatterCover from "@/assets/slide-templates/folio-scatter.jpg";
import axiomVectorCover from "@/assets/slide-templates/axiom-vector.jpg";

export const PREMIUM_HTML_TEMPLATES: SlidesTemplate[] = [
  {
    id: "digital-oasis",
    name: "Digital Oasis",
    description:
      "Cinematic 3D scroll experience with a living grass field, editorial serif headlines, and lime-on-black palette.",
    colors: ["#000000", "#e6f578"],
    category: "premium",
    htmlSlug: "remix-3d-website-the-digital-o",
    variant: "editorial-serif",
    cover: digitalOasisCover,
  },
  {
    id: "ocean-flow",
    name: "Into the Deep",
    description:
      "Editorial ocean scroll — bold Anton headlines, indigo-to-cyan palette, deep-sea storytelling sections.",
    colors: ["#1565d8", "#4fc3f7"],
    category: "premium",
    htmlSlug: "remix-ocean-flow-fish",
    variant: "bold-display",
    cover: oceanFlowCover,
  },
  {
    id: "seasonal-scroll",
    name: "Solstice — Seasonal Scroll",
    description:
      "Editorial Playfair scroll across spring/summer/autumn/winter palettes with a living 3D torus and varied layouts.",
    colors: ["#c8dbbe", "#b8c8dc"],
    category: "premium",
    htmlSlug: "remix-seasonal-scroll-experien",
    variant: "editorial-serif",
    cover: seasonalScrollCover,
  },
  {
    id: "vanta-atelier",
    name: "Vanta — Digital Atelier",
    description:
      "Dark luxury editorial deck with golden particle 3D scene, Playfair italics, and refined atelier sections.",
    colors: ["#0e0e0e", "#c4a882"],
    category: "premium",
    htmlSlug: "remix-vanta-digital-atelier",
    variant: "luxury-gold",
    cover: vantaAtelierCover,
  },
  {
    id: "aquara-water",
    name: "Aquara — Interactive Water",
    description:
      "Immersive dark deck with a live WebGL water canvas, Syne display headlines, and editorial blue accents.",
    colors: ["#0a0e17", "#78b4ff"],
    category: "premium",
    htmlSlug: "remix-aquara-water",
    variant: "bold-display",
    cover: aquaraWaterCover,
  },
  {
    id: "landscape-language",
    name: "Landscape as Language",
    description:
      "Cream-paper editorial scroll with hand-drawn ink botanicals in 3D, Playfair italics, and Napa-quiet pacing.",
    colors: ["#F5F0E8", "#1a1714"],
    category: "premium",
    htmlSlug: "remix-landscape-design",
    variant: "editorial-serif",
    cover: landscapeLanguageCover,
  },
  {
    id: "valence-blobs",
    name: "Valence — Molecular Blobs",
    description:
      "Soft pastel raymarched blob in 3D behind clean editorial sections with bold Inter Black headlines.",
    colors: ["#d4d4d8", "#000000"],
    category: "premium",
    htmlSlug: "remix-valence-blobs",
    variant: "bold-display",
    cover: valenceBlobsCover,
  },
  {
    id: "synthra-builder",
    name: "Synthra — Editorial Cream",
    description:
      "Minimal cream editorial deck with a living silhouette canvas, Space Grotesk headlines, and refined section cards.",
    colors: ["#fafafa", "#111111"],
    category: "premium",
    htmlSlug: "remix-synthra-builder",
    variant: "minimal-mono",
    cover: synthraBuilderCover,
  },
  {
    id: "kami-notebook",
    name: "Kami — Leather Notebook",
    description:
      "Dark leather + parchment editorial split layouts with Cinzel Decorative display, Crimson Pro body, and Space Mono labels.",
    colors: ["#09090b", "#a89070"],
    category: "premium",
    htmlSlug: "remix-kami-notebook",
    variant: "editorial-serif",
    cover: kamiNotebookCover,
  },
  {
    id: "spidey-web",
    name: "Spidey — Web Slinger",
    description:
      "Comic-book brutalist deck with Bebas Neue display, red & blue split palette, animated web pattern, and spider-emblem cards.",
    colors: ["#0A0A0A", "#E23636"],
    category: "premium",
    htmlSlug: "remix-cool-spiderman-website-d",
    variant: "kinetic-poster",
    cover: spideyWebCover,
  },
  {
    id: "yash-folio",
    name: "Yash — Designer Folio",
    description:
      "Dark editorial designer folio with pink/purple/blue gradient orbs, Space Grotesk display + Inter body, and a high-variety combinatorial layout system.",
    colors: ["#0e0e10", "#d94f7a"],
    category: "premium",
    htmlSlug: "remix-yash-designer-folio",
    variant: "editorial-serif",
    cover: yashFolioCover,
  },
  {
    id: "storm-to-calm",
    name: "Storm to Calm — Editorial Scroll",
    description:
      "Cinematic editorial scroll from stormy navy to calm mist — Cormorant Garamond italics, electric-blue accents, atmospheric starfield, and a 46k+ combinatorial layout system.",
    colors: ["#0a0a12", "#8ca0ff"],
    category: "premium",
    htmlSlug: "remix-storm-to-calm-scrolling",
    variant: "editorial-serif",
    cover: stormToCalmCover,
  },
  {
    id: "folio-scatter",
    name: "Folio — Paper Scatter",
    description:
      "Minimal cream editorial portfolio — DM Sans display with Space Mono labels, paper-scatter glyph, hairline grid surfaces, and a 46k+ combinatorial layout system.",
    colors: ["#fafaf8", "#111111"],
    category: "premium",
    htmlSlug: "remix-interactive-3d-portfolio",
    variant: "minimal-mono",
    cover: folioScatterCover,
  },
  {
    id: "axiom-vector",
    name: "Axiom — Vector Network",
    description:
      "Editorial white-paper deck with a live vector-network constellation, massive Syne display + Inter body, violet & electric-blue accents, and a 46k+ combinatorial layout system.",
    colors: ["#ffffff", "#7c3aed"],
    category: "premium",
    htmlSlug: "remix-abstract-vector-network",
    variant: "bold-display",
    cover: axiomVectorCover,
  },
];

/**
 * Standard templates mirror the premium catalogue 1:1 — same visual designs,
 * same content scaffolding — but they're rendered as a classic slide-by-slide
 * presentation with horizontal nav buttons (set by SlidesHtmlDeckCard based
 * on `category`). IDs use a `-standard` suffix so callers can switch modes
 * without disturbing existing premium decks.
 */
export const STANDARD_HTML_TEMPLATES: SlidesTemplate[] = PREMIUM_HTML_TEMPLATES.map((t) => ({
  ...t,
  id: `${t.id}-standard`,
  category: "standard",
  description: `${t.description} Classic slide deck with side navigation buttons.`,
}));

export const SLIDES_TEMPLATES: SlidesTemplate[] = [
  ...STANDARD_HTML_TEMPLATES,
  ...PREMIUM_HTML_TEMPLATES,
];

export const DEFAULT_SLIDES_TEMPLATE = "digital-oasis-standard";

/** Strip the `-standard` suffix to find the underlying premium definition. */
function baseTemplateId(id?: string | null): string | null {
  if (!id) return null;
  return id.endsWith("-standard") ? id.slice(0, -"-standard".length) : id;
}

export function findSlidesTemplate(id?: string | null): SlidesTemplate {
  const direct = SLIDES_TEMPLATES.find((t) => t.id === id);
  if (direct) return direct;
  const base = baseTemplateId(id);
  const fallback = base ? PREMIUM_HTML_TEMPLATES.find((t) => t.id === base) : null;
  return fallback || (PREMIUM_HTML_TEMPLATES[0] as SlidesTemplate);
}

export function isPremiumHtml(id?: string | null): boolean {
  const t = findSlidesTemplate(id);
  return !!(t && t.htmlSlug);
}

/** True when the picked template should render as a classic slide-by-slide deck. */
export function isStandardSlides(id?: string | null): boolean {
  return findSlidesTemplate(id).category === "standard";
}

