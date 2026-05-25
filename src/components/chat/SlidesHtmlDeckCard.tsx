// Premium HTML template renderer locked to the selected template's design.
//
// Strategy:
//   - Inherit the template's <head> (fonts, base CSS, three.js scripts, canvas setup).
//   - Preserve any background <canvas> element (so 3D / fluid backgrounds keep working).
//   - Preserve the template's section vocabulary and map generated content into it.
//     The AI can change text/images, not the template's visual design language.
//   - Inject only safety/readability fixes and keep template CSS as the authority.
//
// The result reads like a presentation, not a marketing landing page.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { SlideDeck, SlideData } from "./SlidesDeckCard";
import { getTheme, THEMES, type ThemeId } from "@/lib/slides/themes";
import { isStandardSlides } from "@/lib/slidesTemplates";

interface Props {
  deck: SlideDeck & { htmlSlug: string; variant?: string };
}

/** Known visual variants. Keep in sync with src/lib/slidesTemplates.ts. */
type SlidesVariant =
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

const KNOWN_VARIANTS: SlidesVariant[] = [
  "editorial-serif","bold-display","minimal-mono","glass-frost",
  "neon-tech","soft-pastel","luxury-gold","brutalist","aurora-glow",
  "magazine-grid","swiss-modernist","retro-vhs","terminal-green",
  "kinetic-poster","ornate-baroque","blueprint-tech","paper-collage",
  "vapor-y2k","organic-clay","cinematic-letterbox",
];

function normalizeVariant(v?: string): SlidesVariant {
  return (KNOWN_VARIANTS.includes(v as SlidesVariant) ? v : "editorial-serif") as SlidesVariant;
}

/** Per-variant CSS layered on top of SLIDE_BASE_CSS. Each gives the deck a distinct identity. */
const VARIANT_STYLES: Record<SlidesVariant, string> = {
  "editorial-serif": `
    .lov-deck { font-family: 'Cormorant Garamond','Playfair Display',Georgia,serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 600 !important; letter-spacing: -0.025em !important; }
    .lov-deck .lov-h1 { font-style: italic; }
    .lov-deck .lov-kicker { font-family: 'Inter',sans-serif; font-weight: 500 !important; letter-spacing: 0.42em !important; opacity: 0.6; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: 'Inter',sans-serif; font-weight: 400 !important; }
    .lov-deck .lov-section { border-bottom: none !important; padding: 14vh 8vw !important; }
    .lov-deck .lov-content { max-width: 1280px !important; }
    .lov-deck .lov-content::before { content:""; display:block; width:64px; height:1px; background: var(--lov-fg); opacity: 0.5; margin-bottom: 2.5rem; }
    .lov-deck .lov-bullets li::before { background: transparent !important; width: 18px !important; height: 1px !important; top: 0.82em !important; }
    .lov-deck .lov-bullets li { padding-inline-start: 2.4rem !important; }
    .lov-deck .lov-stat-value { font-family: inherit; font-style: italic; font-weight: 500 !important; }
  `,
  "bold-display": `
    .lov-deck { font-family: 'Archivo Black','Bebas Neue',sans-serif; }
    .lov-deck .lov-h1 { font-size: clamp(80px,13vw,240px) !important; line-height: 0.85 !important; letter-spacing: -0.05em !important; font-weight: 900 !important; text-transform: uppercase; }
    .lov-deck .lov-h2 { font-size: clamp(60px,9vw,160px) !important; line-height: 0.9 !important; letter-spacing: -0.04em !important; font-weight: 900 !important; text-transform: uppercase; }
    .lov-deck .lov-kicker { font-size: clamp(14px,1.1vw,20px) !important; opacity: 1; color: var(--lov-fg) !important; background: var(--lov-accent); display: inline-block; padding: 0.4rem 1rem; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: 'Inter',sans-serif; font-weight: 500 !important; }
    .lov-deck .lov-bullets { counter-reset: lovBullet; }
    .lov-deck .lov-bullets li { padding-inline-start: 4.5rem !important; counter-increment: lovBullet; font-size: clamp(22px,1.9vw,34px) !important; }
    .lov-deck .lov-bullets li::before { content: counter(lovBullet, decimal-leading-zero) !important; background: transparent !important; color: var(--lov-accent) !important; font-family: inherit !important; font-weight: 900 !important; font-size: 1.3em !important; width: auto !important; height: auto !important; border-radius: 0 !important; top: 0 !important; }
  `,
  "minimal-mono": `
    .lov-deck { font-family: 'JetBrains Mono','IBM Plex Mono',ui-monospace,monospace; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 500 !important; letter-spacing: -0.03em !important; }
    .lov-deck .lov-kicker { font-family: inherit; opacity: 0.55; letter-spacing: 0.18em !important; }
    .lov-deck .lov-kicker::before { content:"// "; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: inherit; font-weight: 400 !important; opacity: 0.85; }
    .lov-deck .lov-section { padding: 9vh 5vw !important; border-bottom: 1px dashed color-mix(in oklab, var(--lov-fg) 22%, transparent) !important; }
    .lov-deck .lov-bullets li::before { content:"›" !important; background: transparent !important; color: var(--lov-accent) !important; width: auto !important; height: auto !important; border-radius: 0 !important; top: 0 !important; font-weight: 700 !important; }
    .lov-deck .lov-bullets li { padding-inline-start: 1.6rem !important; }
    .lov-deck .lov-stat-value { font-family: inherit; font-weight: 600 !important; }
  `,
  "glass-frost": `
    .lov-deck { font-family: 'Inter','SF Pro Display',sans-serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-weight: 700 !important; letter-spacing: -0.04em !important; }
    .lov-deck .lov-content {
      background: color-mix(in oklab, var(--lov-fg) 6%, transparent);
      backdrop-filter: blur(28px) saturate(140%); -webkit-backdrop-filter: blur(28px) saturate(140%);
      border: 1px solid color-mix(in oklab, var(--lov-fg) 14%, transparent);
      border-radius: 32px; padding: 5vh 5vw !important;
      box-shadow: 0 30px 100px -30px rgba(0,0,0,0.5);
    }
    .lov-deck .lov-section { padding: 8vh 5vw !important; border-bottom: none !important; }
    .lov-deck .lov-stat {
      background: color-mix(in oklab, var(--lov-fg) 8%, transparent);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid color-mix(in oklab, var(--lov-fg) 14%, transparent);
      border-radius: 24px; padding: 1.6rem 1.4rem; text-align: center;
    }
  `,
  "neon-tech": `
    .lov-deck { font-family: 'Space Grotesk','Inter',sans-serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-weight: 700 !important; letter-spacing: -0.035em !important;
      text-shadow: 0 0 40px color-mix(in oklab, var(--lov-accent) 55%, transparent), 0 0 8px color-mix(in oklab, var(--lov-accent) 35%, transparent); }
    .lov-deck .lov-kicker { color: var(--lov-accent) !important; text-shadow: 0 0 20px color-mix(in oklab, var(--lov-accent) 60%, transparent); }
    .lov-deck .lov-section { padding: 11vh 6vw !important; border-bottom: 1px solid color-mix(in oklab, var(--lov-accent) 18%, transparent) !important; }
    .lov-deck .lov-section::before {
      content:""; position:absolute; inset-inline-start:0; top:50%; width:4px; height:60%; transform:translateY(-50%);
      background: linear-gradient(180deg, transparent, var(--lov-accent), transparent);
      box-shadow: 0 0 24px var(--lov-accent);
    }
    .lov-deck .lov-bullets li::before { background: var(--lov-accent) !important;
      box-shadow: 0 0 14px var(--lov-accent), 0 0 28px color-mix(in oklab, var(--lov-accent) 50%, transparent); }
    .lov-deck .lov-stat-value { text-shadow: 0 0 30px color-mix(in oklab, var(--lov-accent) 50%, transparent); }
  `,
  "soft-pastel": `
    .lov-deck { font-family: 'Plus Jakarta Sans','Nunito Sans',sans-serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-weight: 700 !important; letter-spacing: -0.025em !important; }
    .lov-deck .lov-kicker { display: inline-block; padding: 0.45rem 1.1rem;
      background: color-mix(in oklab, var(--lov-accent) 22%, transparent); color: var(--lov-accent) !important; border-radius: 999px; }
    .lov-deck .lov-section { padding: 10vh 6vw !important; border-bottom: none !important; }
    .lov-deck .lov-bullets li::before { width: 0.55rem !important; height: 0.55rem !important; background: var(--lov-accent) !important; }
    .lov-deck .lov-stat, .lov-deck .lov-media, .lov-deck .lov-content { border-radius: 28px; }
    .lov-deck .lov-stat { background: color-mix(in oklab, var(--lov-accent) 8%, var(--lov-bg)); padding: 1.8rem 1.6rem; text-align: center;
      box-shadow: 0 12px 40px -12px color-mix(in oklab, var(--lov-accent) 30%, transparent); }
  `,
  "luxury-gold": `
    .lov-deck { font-family: 'Cormorant Garamond',Georgia,serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 500 !important; letter-spacing: -0.015em !important; }
    .lov-deck .lov-kicker { font-family: 'Inter',sans-serif; font-size: clamp(11px,0.8vw,15px) !important; letter-spacing: 0.55em !important; font-weight: 600 !important; color: var(--lov-accent) !important; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: 'Inter',sans-serif; font-weight: 400 !important; opacity: 0.88; }
    .lov-deck .lov-section { padding: 13vh 7vw !important; border-bottom: none !important; }
    .lov-deck .lov-section::after { content:""; position:absolute; left:50%; bottom:5vh; transform:translateX(-50%); width: 48px; height: 1px; background: var(--lov-accent); opacity: 0.7; }
    .lov-deck .lov-bullets li::before { background: var(--lov-accent) !important; width: 6px !important; height: 6px !important; transform: rotate(45deg); border-radius: 0 !important; top: 0.85em !important; }
    .lov-deck .lov-stat-value { font-family: inherit; font-weight: 400 !important; color: var(--lov-accent) !important; }
    .lov-deck .lov-content::before { content:""; display:block; width: 80px; height: 1px; background: var(--lov-accent); margin-bottom: 2rem; }
  `,
  "brutalist": `
    .lov-deck { font-family: 'Space Mono',ui-monospace,monospace; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: 'Archivo Black',sans-serif; font-weight: 900 !important; letter-spacing: -0.04em !important; text-transform: uppercase; }
    .lov-deck .lov-kicker { background: var(--lov-fg); color: var(--lov-bg) !important; display: inline-block; padding: 0.3rem 0.8rem; letter-spacing: 0.2em !important; border-radius: 0 !important; }
    .lov-deck .lov-section { padding: 9vh 5vw !important; border-bottom: 4px solid var(--lov-fg) !important; }
    .lov-deck .lov-content, .lov-deck .lov-media, .lov-deck .lov-stat { border-radius: 0 !important; }
    .lov-deck .lov-stat { border: 3px solid var(--lov-fg); padding: 1.4rem; background: transparent; }
    .lov-deck .lov-bullets li::before { background: var(--lov-fg) !important; border-radius: 0 !important; width: 1rem !important; height: 0.35rem !important; top: 0.95em !important; }
  `,
  "aurora-glow": `
    .lov-deck { font-family: 'Sora','Inter',sans-serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 {
      font-weight: 800 !important; letter-spacing: -0.04em !important;
      background: linear-gradient(120deg, var(--lov-fg) 0%, var(--lov-accent) 55%, var(--lov-primary) 100%);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent !important;
    }
    .lov-deck .lov-kicker { color: var(--lov-accent) !important; }
    .lov-deck .lov-section { padding: 11vh 6vw !important; border-bottom: none !important; }
    .lov-deck .lov-section::before { content:""; position:absolute; inset:0; pointer-events:none;
      background: radial-gradient(ellipse 60% 40% at 20% 30%, color-mix(in oklab, var(--lov-accent) 18%, transparent), transparent 60%),
                  radial-gradient(ellipse 50% 40% at 80% 70%, color-mix(in oklab, var(--lov-primary) 16%, transparent), transparent 60%);
      z-index: 0; }
    .lov-deck .lov-bullets li::before { background: linear-gradient(135deg, var(--lov-accent), var(--lov-primary)) !important;
      box-shadow: 0 0 18px color-mix(in oklab, var(--lov-accent) 60%, transparent); }
    .lov-deck .lov-stat-value { background: linear-gradient(135deg, var(--lov-accent), var(--lov-primary));
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent !important; }
  `,
  "magazine-grid": `
    .lov-deck { font-family: 'DM Serif Display','Playfair Display',serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 400 !important; letter-spacing: -0.03em !important; line-height: 0.95 !important; }
    .lov-deck .lov-kicker { font-family: 'Work Sans',sans-serif; letter-spacing: 0.32em !important; font-weight: 700 !important; padding-bottom: 0.6rem; border-bottom: 2px solid var(--lov-fg); display: inline-block; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: 'Work Sans','Inter',sans-serif; font-weight: 400 !important; column-fill: balance; }
    .lov-deck .lov-section { padding: 10vh 7vw !important; border-bottom: none !important; }
    .lov-deck .lov-section .lov-body { columns: 2; column-gap: 3rem; max-width: 1200px; }
    @media (max-width: 900px) { .lov-deck .lov-section .lov-body { columns: 1; } }
    .lov-deck .lov-bullets li::before { background: var(--lov-fg) !important; width: 0.5rem !important; height: 0.5rem !important; border-radius: 0 !important; }
  `,
  "swiss-modernist": `
    .lov-deck { font-family: 'Helvetica Neue','Inter','Neue Haas Grotesk',sans-serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-weight: 700 !important; letter-spacing: -0.04em !important; line-height: 0.95 !important; }
    .lov-deck .lov-kicker { font-weight: 700 !important; letter-spacing: 0.04em !important; text-transform: none; opacity: 1; color: var(--lov-accent) !important; }
    .lov-deck .lov-section { padding: 8vh 6vw !important; border-bottom: 1px solid var(--lov-fg) !important; }
    .lov-deck .lov-content { display: grid; grid-template-columns: 1fr 4fr; gap: 3rem; align-items: start; max-width: 1500px !important; }
    .lov-deck .lov-content .lov-kicker { grid-column: 1; align-self: start; padding-top: 0.4rem; }
    .lov-deck .lov-content > :not(.lov-kicker) { grid-column: 2; }
    @media (max-width: 900px) { .lov-deck .lov-content { grid-template-columns: 1fr; } .lov-deck .lov-content > :not(.lov-kicker) { grid-column: 1; } }
    .lov-deck .lov-bullets li::before { background: var(--lov-fg) !important; width: 0.5rem !important; height: 0.5rem !important; border-radius: 0 !important; }
  `,
  "retro-vhs": `
    .lov-deck { font-family: 'VT323','Press Start 2P','Courier New',monospace; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 400 !important; letter-spacing: 0.02em !important; text-transform: uppercase;
      text-shadow: 3px 0 0 #ff00aa, -3px 0 0 #00ffe5, 0 0 18px color-mix(in oklab, var(--lov-accent) 40%, transparent); }
    .lov-deck .lov-kicker { font-family: inherit; letter-spacing: 0.2em !important; color: #ff00aa !important; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: inherit; font-weight: 400 !important; }
    .lov-deck .lov-section { padding: 10vh 6vw !important; border-bottom: 2px dashed color-mix(in oklab, var(--lov-accent) 40%, transparent) !important; position: relative; }
    .lov-deck .lov-section::after { content:""; position:absolute; inset:0; pointer-events:none;
      background: repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 4px); z-index: 0; }
    .lov-deck .lov-bullets li::before { content:"▸" !important; background: transparent !important; color: var(--lov-accent) !important; width: auto !important; height: auto !important; border-radius: 0 !important; top: 0 !important; }
  `,
  "terminal-green": `
    .lov-deck { font-family: 'JetBrains Mono','Fira Code',monospace; background: #050a05 !important; color: #4ade80 !important; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 500 !important; color: #4ade80 !important; letter-spacing: -0.02em !important; }
    .lov-deck .lov-h1::before, .lov-deck .lov-h2::before { content:"$ "; opacity: 0.6; }
    .lov-deck .lov-kicker { font-family: inherit; color: #facc15 !important; }
    .lov-deck .lov-kicker::before { content:"> "; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: inherit; color: #86efac !important; }
    .lov-deck .lov-section { padding: 8vh 5vw !important; border-bottom: 1px solid rgba(74,222,128,0.18) !important; }
    .lov-deck .lov-bullets li::before { content:"#" !important; background: transparent !important; color: #facc15 !important; width:auto !important; height:auto !important; border-radius: 0 !important; top: 0 !important; }
    .lov-deck .lov-stat-value { color: #facc15 !important; }
  `,
  "kinetic-poster": `
    .lov-deck { font-family: 'Anton','Oswald','Archivo Black',sans-serif; }
    .lov-deck .lov-h1 { font-size: clamp(90px,16vw,300px) !important; line-height: 0.82 !important; letter-spacing: -0.04em !important; font-weight: 900 !important; text-transform: uppercase; transform: skewX(-6deg); transform-origin: left; }
    .lov-deck .lov-h2 { font-size: clamp(64px,11vw,180px) !important; line-height: 0.88 !important; font-weight: 900 !important; text-transform: uppercase; }
    .lov-deck .lov-h1:hover { transform: skewX(0); transition: transform .8s ease; }
    .lov-deck .lov-kicker { background: var(--lov-accent); color: var(--lov-bg) !important; padding: 0.35rem 1rem; transform: rotate(-3deg); display: inline-block; }
    .lov-deck .lov-section { padding: 10vh 5vw !important; border-bottom: 8px solid var(--lov-accent) !important; }
    .lov-deck .lov-bullets li { font-weight: 700 !important; text-transform: uppercase; letter-spacing: -0.01em; }
    .lov-deck .lov-bullets li::before { background: var(--lov-accent) !important; width: 1.4rem !important; height: 1.4rem !important; border-radius: 0 !important; transform: rotate(45deg); top: 0.55em !important; }
  `,
  "ornate-baroque": `
    .lov-deck { font-family: 'Cormorant Garamond','EB Garamond','Playfair Display',serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 500 !important; font-style: italic; letter-spacing: -0.01em !important; }
    .lov-deck .lov-kicker { font-family: inherit; font-style: italic; font-weight: 500 !important; letter-spacing: 0.18em !important; text-transform: none; color: var(--lov-accent) !important; }
    .lov-deck .lov-kicker::before { content:"❦ "; }
    .lov-deck .lov-kicker::after { content:" ❦"; }
    .lov-deck .lov-section { padding: 14vh 8vw !important; border-bottom: none !important; }
    .lov-deck .lov-content { text-align: center; max-width: 1100px !important; margin: 0 auto; }
    .lov-deck .lov-content::before { content:"✣"; display:block; font-size: 2rem; color: var(--lov-accent); margin-bottom: 1.5rem; }
    .lov-deck .lov-content::after { content:"✣"; display:block; font-size: 2rem; color: var(--lov-accent); margin-top: 2.5rem; opacity: 0.6; }
    .lov-deck .lov-bullets { text-align: start; }
    .lov-deck .lov-bullets li::before { content:"✦" !important; background: transparent !important; color: var(--lov-accent) !important; width:auto !important; height:auto !important; border-radius:0 !important; top:0 !important; }
  `,
  "blueprint-tech": `
    .lov-deck { font-family: 'IBM Plex Mono','JetBrains Mono',monospace; background: #0c1a2e !important; color: #b4d4ff !important; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: 'IBM Plex Sans','Inter',sans-serif; font-weight: 600 !important; color: #ffffff !important; letter-spacing: -0.02em !important; }
    .lov-deck .lov-kicker { font-family: inherit; color: #7ab8ff !important; letter-spacing: 0.16em !important; }
    .lov-deck .lov-kicker::before { content:"[ "; }
    .lov-deck .lov-kicker::after { content:" ]"; }
    .lov-deck .lov-section { padding: 9vh 6vw !important; border-bottom: 1px dashed rgba(180,212,255,0.25) !important;
      background-image: linear-gradient(rgba(180,212,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(180,212,255,0.05) 1px, transparent 1px);
      background-size: 40px 40px; }
    .lov-deck .lov-bullets li::before { content:"+" !important; background: transparent !important; color: #7ab8ff !important; width:auto !important; height:auto !important; border-radius:0 !important; top:0 !important; font-weight: 700 !important; }
    .lov-deck .lov-stat-value { color: #ffffff !important; }
  `,
  "paper-collage": `
    .lov-deck { font-family: 'Caveat','Patrick Hand','Kalam',cursive; background: #f5efe3 !important; color: #1a1410 !important; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 700 !important; letter-spacing: -0.01em !important; color: #1a1410 !important; transform: rotate(-1.5deg); display: inline-block; }
    .lov-deck .lov-kicker { font-family: 'Kalam',cursive; background: #ffd166; color: #1a1410 !important; padding: 0.3rem 0.9rem; transform: rotate(2deg); display: inline-block; border-radius: 4px; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: 'Patrick Hand','Kalam',cursive; color: #2a2018 !important; }
    .lov-deck .lov-section { padding: 10vh 6vw !important; border-bottom: none !important; }
    .lov-deck .lov-content { padding: 3rem; background: #fffdf6; box-shadow: 0 12px 30px -12px rgba(0,0,0,0.3); transform: rotate(-0.6deg); border-radius: 6px; }
    .lov-deck .lov-bullets li::before { content:"✓" !important; background: transparent !important; color: #d94f4f !important; width:auto !important; height:auto !important; border-radius:0 !important; top:-0.1em !important; font-weight: 700 !important; }
  `,
  "vapor-y2k": `
    .lov-deck { font-family: 'Sora','Outfit','Inter',sans-serif;
      background: linear-gradient(135deg, #1a0033, #4a0080, #0080ff) !important; color: #ffffff !important; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 {
      font-weight: 900 !important; letter-spacing: -0.03em !important;
      background: linear-gradient(180deg, #ffffff 0%, #c4b5fd 40%, #ff6ad5 75%, #ffd166 100%);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent !important;
      text-shadow: 0 0 60px rgba(255,106,213,0.4);
    }
    .lov-deck .lov-kicker { color: #ff6ad5 !important; text-shadow: 0 0 12px #ff6ad5; }
    .lov-deck .lov-section { padding: 11vh 6vw !important; border-bottom: 1px solid rgba(255,106,213,0.3) !important; }
    .lov-deck .lov-bullets li::before { background: linear-gradient(135deg, #ff6ad5, #67e8f9) !important; box-shadow: 0 0 16px #ff6ad5; }
    .lov-deck .lov-stat-value { background: linear-gradient(135deg, #67e8f9, #ff6ad5);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent !important; }
  `,
  "organic-clay": `
    .lov-deck { font-family: 'Fraunces','Lora','Source Serif Pro',serif; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: inherit; font-weight: 500 !important; letter-spacing: -0.025em !important; }
    .lov-deck .lov-kicker { font-family: 'Inter',sans-serif; background: color-mix(in oklab, var(--lov-accent) 18%, transparent); color: var(--lov-accent) !important; padding: 0.5rem 1.2rem; border-radius: 999px; font-weight: 500 !important; letter-spacing: 0.2em !important; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body, .lov-deck .lov-bullets li { font-family: 'Inter','Plus Jakarta Sans',sans-serif; font-weight: 400 !important; }
    .lov-deck .lov-section { padding: 12vh 7vw !important; border-bottom: none !important; }
    .lov-deck .lov-content { max-width: 1280px !important; }
    .lov-deck .lov-stat, .lov-deck .lov-media { border-radius: 36px; }
    .lov-deck .lov-stat { background: color-mix(in oklab, var(--lov-accent) 12%, var(--lov-bg)); padding: 2rem 1.6rem; text-align: center; }
    .lov-deck .lov-bullets li::before { background: var(--lov-accent) !important; width: 0.6rem !important; height: 0.6rem !important; }
  `,
  "cinematic-letterbox": `
    .lov-deck { font-family: 'Inter','Helvetica Neue',sans-serif; }
    .lov-deck .lov-section { padding: 0 !important; min-height: 100vh; border-bottom: none !important; position: relative; }
    .lov-deck .lov-section::before, .lov-deck .lov-section::after {
      content:""; position: absolute; left:0; right:0; height: 80px; background: #000; z-index: 5; pointer-events: none;
    }
    .lov-deck .lov-section::before { top: 0; }
    .lov-deck .lov-section::after { bottom: 0; }
    .lov-deck .lov-content { padding: 12vh 7vw; z-index: 2; }
    .lov-deck .lov-h1, .lov-deck .lov-h2 { font-weight: 800 !important; letter-spacing: -0.04em !important; text-transform: uppercase; }
    .lov-deck .lov-kicker { color: var(--lov-accent) !important; letter-spacing: 0.4em !important; font-size: clamp(11px,0.9vw,16px) !important; }
    .lov-deck .lov-subtitle, .lov-deck .lov-body { font-weight: 300 !important; opacity: 0.88; max-width: 900px; }
    .lov-deck .lov-bullets li::before { background: var(--lov-accent) !important; width: 0.4rem !important; height: 0.4rem !important; }
  `,
};

/** 8-point Pegtop star (our brand) — small spinner used in inline buttons. */
const SpinningStar = ({ size = 14 }: { size?: number }) => (
  <motion.svg
    width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    className="text-fuchsia-500 shrink-0"
    animate={{ rotate: [0, 180, 360], scale: [1, 1.12, 1] }}
    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
  >
    <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor" />
  </motion.svg>
);

/* ------------------------------------------------------------------ */
/* Slide → HTML                                                        */
/* ------------------------------------------------------------------ */

const esc = (s: string | undefined) =>
  (s || "")
    // Strip emoji + decorative symbol glyphs (no icons/emoji allowed in slides).
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{FE0F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 8-point Pegtop star (our brand) — used as image fallback while loading or on error.
const STAR_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="lov-star-svg" aria-hidden="true"><path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor"/></svg>`;

function imgWithFallback(url: string | undefined, cls = "lov-media"): string {
  if (!url) return `<div class="${cls} lov-media-empty"><span class="lov-star">${STAR_SVG}</span></div>`;
  // onerror: replace the parent's content with star fallback so we never show a broken image icon.
  const onerr = "this.parentElement.innerHTML='<span class=\\'lov-star\\'>" + STAR_SVG.replace(/'/g, "\\'") + "</span>';this.parentElement.classList.add('lov-media-empty');";
  return `<div class="${cls}"><img src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="${onerr}" /></div>`;
}

function emphasizeText(text?: string): string {
  const safe = esc(text || "");
  const words = safe.split(/\s+/).filter(Boolean);
  if (words.length < 2) return safe;
  const mid = Math.max(1, Math.floor(words.length / 2));
  return `${words.slice(0, mid).join(" ")}<br><em>${words.slice(mid).join(" ")}</em>`;
}

function bodyText(slide: SlideData, max = 1200): string {
  const text = slide.body || slide.subtitle || slide.focus || slide.bullets?.join(" ") || "";
  return esc(text.length > max ? `${text.slice(0, max).trim()}…` : text);
}

// Strip emoji and pictographic icon characters that the AI sometimes injects.
function stripIcons(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderDigitalOasisDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  // Combinatorial design system → 10 surfaces × 9 accents × 8 tones × 16 layouts × 3 aligns
  // = 34,560 unique slide variants — well above the 500-variant floor.
  const SURFACES = ["clean", "frost", "border", "tint", "glass", "ink", "grad", "noir", "mesh", "wash"];
  const ACCENTS  = ["top", "left", "corner", "underline", "dot", "bar", "num", "ring", "slash"];
  const TONES    = ["lime", "sage", "ivory", "copper", "aqua", "violet", "rose", "gold"];
  // Weighted: high-contrast layouts (split, manifesto, timeline, hero-list, editorial, pills) appear more often than grid/card layouts so decks don't feel like 8 card grids in a row.
  const LAYOUTS  = ["split", "split-rev", "manifesto", "timeline", "hero-list", "editorial", "pills", "callouts", "steps", "split", "manifesto", "hero-list", "editorial", "pills-sq", "bento", "grid3", "grid2", "grid4", "masonry", "mosaic"];
  const ALIGNS   = ["left", "right", "center"];

  const hash = (seed: string, salt: number) => {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  };

  const sections = slides.map((slide, idx) => {
    const stage = idx;
    const title = esc(slide.title || deck.title || "Untitled");
    const kicker = esc(slide.kicker || (idx === 0 ? deck.subtitle || "Presentation" : `${isAr ? "فصل" : "Chapter"} ${String(idx + 1).padStart(2, "0")}`));
    const body = bodyText(slide, 1400);
    const bullets = (slide.bullets?.length ? slide.bullets : slide.left_bullets?.length ? slide.left_bullets : slide.right_bullets || []).slice(0, 6);
    const num = String(idx + 1).padStart(2, "0");

    const seed = `${deck.htmlSlug || "dos"}|${idx}|${slide.title || ""}|${slide.type || ""}`;
    const surface = SURFACES[hash(seed, 1) % SURFACES.length];
    const accent  = ACCENTS [hash(seed, 2) % ACCENTS.length];
    const tone    = TONES   [hash(seed, 3) % TONES.length];
    const layout  = LAYOUTS [hash(seed, 4) % LAYOUTS.length];
    const align   = ALIGNS  [hash(seed, 5) % ALIGNS.length];
    const tintClass = `dos-tone-${tone}`;
    const accClass  = `dos-acc-${accent}`;
    const surfClass = `dos-surf-${surface}`;
    const alignClass = `dos-align-${align}`;

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<section class="section hero dos-slide dos-cover ${tintClass}" id="heroSection" data-stage="${stage}">
        <span class="hero-tag dos-label" data-reveal data-delay="1">${kicker}</span>
        <h1 data-reveal data-delay="2" class="dos-title">${emphasizeText(slide.title || deck.title)}</h1>
        ${slide.subtitle ? `<p class="hero-sub dos-sub" data-reveal data-delay="3">${esc(slide.subtitle)}</p>` : ""}
        <div class="scroll-hint" data-reveal data-delay="4"><span>${isAr ? "اكتشف" : "Explore"}</span><div class="scroll-line"></div></div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<section class="section dos-slide dos-cover ${tintClass}" data-stage="${stage}">
        <blockquote class="dos-quote" data-reveal>"${esc(slide.quote || slide.subtitle || slide.title)}"</blockquote>
        ${slide.attribution ? `<span class="dos-attr" data-reveal data-delay="1">— ${esc(slide.attribution)}</span>` : ""}
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="section dos-slide dos-cover ${tintClass}" data-stage="${stage}">
        <span class="dos-label" data-reveal>${kicker}</span>
        <h2 class="dos-title" data-reveal data-delay="1">${emphasizeText(slide.title || (isAr ? "شكراً" : "Thank You"))}</h2>
        ${slide.subtitle || slide.cta ? `<p class="dos-sub" data-reveal data-delay="2">${esc(slide.subtitle || slide.cta)}</p>` : ""}
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="section dos-slide dos-cover ${tintClass}" data-stage="${stage}">
        <span class="dos-label" data-reveal>${kicker}</span>
        <div class="dos-big" data-reveal data-delay="1">${esc(slide.big_value)}</div>
        <p class="dos-sub" data-reveal data-delay="2" style="margin:18px auto 0">${esc(slide.big_label || slide.title || "")}</p>
        ${body ? `<p class="dos-sub" data-reveal data-delay="3" style="margin:10px auto 0">${body}</p>` : ""}
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return `<section class="section dos-slide ${tintClass} ${alignClass}" data-stage="${stage}">
        <div class="dos-inner">
          <span class="dos-label" data-reveal>${kicker}</span>
          <h2 class="dos-title" data-reveal data-delay="1">${emphasizeText(slide.title || title)}</h2>
          ${body ? `<p class="dos-body" data-reveal data-delay="2">${body}</p>` : ""}
          <div class="dos-stats" data-reveal data-delay="3">${stats.map((s, i) => `<div class="dos-stat ${surfClass} ${accClass}"><div class="dos-stat-v">${esc(s.value)}</div><div class="dos-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      return `<section class="section dos-slide ${tintClass} ${alignClass}" data-stage="${stage}">
        <div class="dos-inner">
          <span class="dos-label" data-reveal>${kicker}</span>
          <h2 class="dos-title" data-reveal data-delay="1">${emphasizeText(slide.title || title)}</h2>
          ${body ? `<p class="dos-body" data-reveal data-delay="2">${body}</p>` : ""}
          <div class="dos-steps ${accClass}" data-reveal data-delay="3">${steps.map((s, i) => `<div class="dos-step"><div class="dos-step-n">${String(i + 1).padStart(2, "0")}</div><div><div class="dos-step-t">${esc(s.title)}</div>${s.desc ? `<div class="dos-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return `<section class="section dos-slide ${tintClass} ${alignClass}" data-stage="${stage}">
        <div class="dos-inner">
          <span class="dos-label" data-reveal>${kicker}</span>
          <h2 class="dos-title" data-reveal data-delay="1">${emphasizeText(slide.title || title)}</h2>
          <div class="dos-tl" data-reveal data-delay="2">${events.map(e => `<div class="dos-tl-item"><div class="dos-tl-k">${esc(e.date)}</div><div class="dos-tl-t">${esc(e.title)}</div>${e.desc ? `<div class="dos-tl-d">${esc(e.desc)}</div>` : ""}</div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      const lt = esc(slide.left_title || "A"); const rt = esc(slide.right_title || "B");
      return `<section class="section dos-slide ${tintClass} ${alignClass}" data-stage="${stage}">
        <div class="dos-inner">
          <span class="dos-label" data-reveal>${kicker}</span>
          <h2 class="dos-title" data-reveal data-delay="1">${emphasizeText(slide.title || title)}</h2>
          <div class="dos-compare" data-reveal data-delay="2">
            <div class="${surfClass}"><h3>${lt}</h3>${slide.left_bullets.slice(0,6).map(b => `<p>${esc(b)}</p>`).join("")}</div>
            <div class="${surfClass}"><h3>${rt}</h3>${slide.right_bullets.slice(0,6).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          </div>
        </div>
      </section>`;
    }

    // Bullets → 16 layouts × surfaces × accents × tones × aligns
    if (bullets.length >= 2) {
      const parsed = bullets.map(b => {
        const parts = b.split(/[:：—-]\s*/, 2);
        return { h: esc(parts[0] || b), d: esc(parts[1] || "") };
      });
      const cardCls = `dos-card ${surfClass} ${accClass}`;
      const cards = (limit = 6) => parsed.slice(0, limit).map((p, i) =>
        `<div class="${cardCls}"><div class="dos-card-n">${String(i + 1).padStart(2, "0")}</div><div class="dos-card-t">${p.h}</div>${p.d ? `<div class="dos-card-d">${p.d}</div>` : ""}</div>`
      ).join("");

      const header = `<span class="dos-label" data-reveal>${kicker}</span>
        <h2 class="dos-title" data-reveal data-delay="1">${emphasizeText(slide.title || title)}</h2>
        ${body ? `<p class="dos-body" data-reveal data-delay="2">${body}</p>` : ""}`;

      const wrap = (extra: string, innerStyle = "") =>
        `<section class="section dos-slide ${tintClass} ${alignClass}" data-stage="${stage}"><div class="dos-inner" style="${innerStyle}">${header}${extra}</div></section>`;

      if (layout === "bento")     return wrap(`<div class="dos-bento" data-reveal data-delay="3">${cards()}</div>`);
      if (layout === "grid3")     return wrap(`<div class="dos-grid-3" data-reveal data-delay="3">${cards()}</div>`);
      if (layout === "grid2")     return wrap(`<div class="dos-grid-2" data-reveal data-delay="3">${cards(4)}</div>`, "max-width:1080px");
      if (layout === "grid4")     return wrap(`<div class="dos-grid-4" data-reveal data-delay="3">${cards()}</div>`);
      if (layout === "masonry")   return wrap(`<div class="dos-masonry" data-reveal data-delay="3">${cards()}</div>`);
      if (layout === "mosaic")    return wrap(`<div class="dos-mosaic" data-reveal data-delay="3">${cards()}</div>`);
      if (layout === "steps")     return wrap(`<div class="dos-steps ${accClass}" data-reveal data-delay="3">${parsed.slice(0,6).map((p,i)=>`<div class="dos-step"><div class="dos-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="dos-step-t">${p.h}</div>${p.d?`<div class="dos-step-d">${p.d}</div>`:""}</div></div>`).join("")}</div>`, "max-width:980px");
      if (layout === "manifesto") return wrap(`<div class="dos-mani" data-reveal data-delay="3">${parsed.slice(0,6).map((p,i)=>`<div class="dos-mani-row"><div class="dos-mani-k">${isAr ? "بند" : "Item"} · ${String(i+1).padStart(2,"0")}</div><div><div class="dos-mani-t">${p.h}</div>${p.d?`<div class="dos-mani-d">${p.d}</div>`:""}</div></div>`).join("")}</div>`, "max-width:1020px");
      if (layout === "split" || layout === "split-rev") {
        return `<section class="section dos-slide ${tintClass}" data-stage="${stage}"><div class="dos-inner"><div class="dos-split ${layout==="split-rev"?"dos-split-rev":""}" data-reveal><div>${header}</div><div class="dos-edit-list">${parsed.slice(0,6).map((p,i)=>`<div class="dos-edit-item"><div class="dos-edit-k">${String(i+1).padStart(2,"0")}</div><div class="dos-edit-t">${p.h}</div>${p.d?`<div class="dos-edit-d">${p.d}</div>`:""}</div>`).join("")}</div></div></div></section>`;
      }
      if (layout === "pills" || layout === "pills-sq") return wrap(`<div class="dos-pills" data-reveal data-delay="3">${parsed.slice(0,8).map(p=>`<span class="dos-pill ${layout==="pills-sq"?"dos-pill-sq":""}">${p.h}</span>`).join("")}</div>`, "max-width:1060px");
      if (layout === "timeline")  return wrap(`<div class="dos-tl" data-reveal data-delay="3">${parsed.slice(0,6).map((p,i)=>`<div class="dos-tl-item"><div class="dos-tl-k">${String(i+1).padStart(2,"0")}</div><div class="dos-tl-t">${p.h}</div>${p.d?`<div class="dos-tl-d">${p.d}</div>`:""}</div>`).join("")}</div>`);
      if (layout === "editorial") return wrap(`<div class="dos-edit-list" data-reveal data-delay="3">${parsed.slice(0,6).map((p,i)=>`<div class="dos-edit-item"><div class="dos-edit-k">${String(i+1).padStart(2,"0")}</div><div class="dos-edit-t">${p.h}</div>${p.d?`<div class="dos-edit-d">${p.d}</div>`:""}</div>`).join("")}</div>`, "max-width:1080px");
      if (layout === "hero-list") return wrap(`<ol class="dos-hero-list" data-reveal data-delay="3">${parsed.slice(0,6).map((p,i)=>`<li><span class="dos-hero-n">${String(i+1).padStart(2,"0")}</span><div><div class="dos-hero-t">${p.h}</div>${p.d?`<div class="dos-hero-d">${p.d}</div>`:""}</div></li>`).join("")}</ol>`, "max-width:1040px");
      // callouts (default)
      return wrap(`<div class="dos-call" data-reveal data-delay="3">${parsed.slice(0,6).map((p,i)=>`<div class="dos-call-box ${surfClass} ${accClass}"><div class="dos-card-n">${String(i+1).padStart(2,"0")}</div><div class="dos-card-t">${p.h}</div>${p.d?`<div class="dos-card-d">${p.d}</div>`:""}</div>`).join("")}</div>`);
    }

    // Plain fallback
    return `<section class="section dos-slide ${tintClass} ${alignClass}" data-stage="${stage}">
      <div class="dos-inner">
        <span class="dos-label" data-reveal>${kicker}</span>
        <h2 class="dos-title" data-reveal data-delay="1">${emphasizeText(slide.title || title)}</h2>
        ${body ? `<p class="dos-body" data-reveal data-delay="2">${body}</p>` : ""}
      </div>
    </section>`;
  }).join("\n");

  return `<div class="progress-bar" id="progressBar"></div>
    <div class="settings-panel" id="settingsPanel"></div>
    <div id="scroll-container">${sections}<section class="section footer" data-stage="${slides.length}"></section></div>`;
}

function renderOceanFlowDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  // Combinatorial design system → ~5,488 unique slide variants.
  const SURFACES = ["clean", "frost", "border", "tint", "glass", "ink", "grad", "abyss"];
  const ACCENTS  = ["top", "left", "corner", "underline", "dot", "bar", "num"];
  const TONES    = ["cyan", "azure", "teal", "indigo", "frost", "abyss", "kelp"];
  const LAYOUTS  = ["bento", "grid3", "grid2", "grid4", "masonry", "steps", "manifesto", "split", "split-rev", "pills", "pills-sq", "timeline", "editorial", "callouts"];

  const hash = (seed: string, salt: number) => {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  };

  const sections = slides.map((slide, idx) => {
    const title = esc(slide.title || deck.title || "Untitled");
    const kicker = esc(slide.kicker || `${isAr ? "فصل" : "Chapter"} ${String(idx + 1).padStart(2, "0")}`);
    const body = esc(slide.body || slide.subtitle || slide.focus || "");
    const bullets = (slide.bullets?.length ? slide.bullets : slide.left_bullets?.length ? slide.left_bullets : slide.right_bullets || []).slice(0, 6);
    const num = String(idx + 1).padStart(2, "0");

    const seed = `${deck.htmlSlug || "of"}|${idx}|${slide.title || ""}|${slide.type || ""}`;
    const surface = SURFACES[hash(seed, 1) % SURFACES.length];
    const accent  = ACCENTS [hash(seed, 2) % ACCENTS.length];
    const tone    = TONES   [hash(seed, 3) % TONES.length];
    const layout  = LAYOUTS [hash(seed, 4) % LAYOUTS.length];
    const surfClass = `of-surf-${surface}`;
    const accClass  = `of-acc-${accent}`;
    const tintClass = `of-tone-${tone}`;

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<section class="splash of-slide of-cover ${tintClass}">
        <span class="of-label">${kicker}</span>
        <h1 class="of-title">${emphasizeText(slide.title || deck.title)}</h1>
        ${slide.subtitle ? `<p class="of-sub">${esc(slide.subtitle)}</p>` : ""}
        <div class="scroll-hint">${isAr ? "اغمر" : "Dive"}</div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="finale of-slide of-cover ${tintClass}">
        <span class="of-label">${kicker}</span>
        <h2 class="of-title">${emphasizeText(slide.title || (isAr ? "شكراً" : "Thank You"))}</h2>
        ${slide.subtitle ? `<p class="of-sub">${esc(slide.subtitle)}</p>` : ""}
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<section class="of-slide of-cover ${tintClass}">
        <blockquote class="of-quote">"${esc(slide.quote || slide.subtitle || slide.title)}"</blockquote>
        ${slide.attribution ? `<span class="of-attr">— ${esc(slide.attribution)}</span>` : ""}
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="of-slide of-cover ${tintClass}">
        <span class="of-label">${kicker}</span>
        <div class="of-big">${esc(slide.big_value)}</div>
        <p class="of-sub" style="margin:18px auto 0">${esc(slide.big_label || slide.title || "")}</p>
        ${body ? `<p class="of-sub" style="margin:10px auto 0">${body}</p>` : ""}
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return `<section class="of-slide ${tintClass}">
        <div class="of-inner">
          <span class="of-label">${kicker}</span>
          <h2 class="of-title">${emphasizeText(slide.title || title)}</h2>
          ${body ? `<p class="of-body">${body}</p>` : ""}
          <div class="of-stats">${stats.map(s => `<div class="of-stat ${surfClass} ${accClass}"><div class="of-stat-v">${esc(s.value)}</div><div class="of-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      return `<section class="of-slide ${tintClass}">
        <div class="of-inner">
          <span class="of-label">${kicker}</span>
          <h2 class="of-title">${emphasizeText(slide.title || title)}</h2>
          ${body ? `<p class="of-body">${body}</p>` : ""}
          <div class="of-steps ${accClass}">${steps.map((s, i) => `<div class="of-step"><div class="of-step-n">${String(i + 1).padStart(2, "0")}</div><div><div class="of-step-t">${esc(s.title)}</div>${s.desc ? `<div class="of-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return `<section class="of-slide ${tintClass}">
        <div class="of-inner">
          <span class="of-label">${kicker}</span>
          <h2 class="of-title">${emphasizeText(slide.title || title)}</h2>
          <div class="of-tl">${events.map(e => `<div class="of-tl-item"><div class="of-tl-k">${esc(e.date)}</div><div class="of-tl-t">${esc(e.title)}</div>${e.desc ? `<div class="of-tl-d">${esc(e.desc)}</div>` : ""}</div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      const lt = esc(slide.left_title || "A"); const rt = esc(slide.right_title || "B");
      return `<section class="of-slide ${tintClass}">
        <div class="of-inner">
          <span class="of-label">${kicker}</span>
          <h2 class="of-title">${emphasizeText(slide.title || title)}</h2>
          <div class="of-compare">
            <div class="${surfClass}"><h3>${lt}</h3>${slide.left_bullets.slice(0,6).map(b => `<p>${esc(b)}</p>`).join("")}</div>
            <div class="${surfClass}"><h3>${rt}</h3>${slide.right_bullets.slice(0,6).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          </div>
        </div>
      </section>`;
    }

    if (bullets.length >= 2) {
      const parsed = bullets.map(b => {
        const parts = b.split(/[:：—-]\s*/, 2);
        return { h: esc(parts[0] || b), d: esc(parts[1] || "") };
      });
      const cardCls = `of-card ${surfClass} ${accClass}`;
      const cards = (limit = 6) => parsed.slice(0, limit).map((p, i) =>
        `<div class="${cardCls}"><div class="of-card-n">${String(i + 1).padStart(2, "0")}</div><div class="of-card-t">${p.h}</div>${p.d ? `<div class="of-card-d">${p.d}</div>` : ""}</div>`
      ).join("");

      const header = `<span class="of-label">${kicker}</span>
        <h2 class="of-title">${emphasizeText(slide.title || title)}</h2>
        ${body ? `<p class="of-body">${body}</p>` : ""}`;

      if (layout === "bento")     return `<section class="of-slide ${tintClass}"><div class="of-inner">${header}<div class="of-bento">${cards()}</div></div></section>`;
      if (layout === "grid3")     return `<section class="of-slide ${tintClass}"><div class="of-inner">${header}<div class="of-grid-3">${cards()}</div></div></section>`;
      if (layout === "grid2")     return `<section class="of-slide ${tintClass}"><div class="of-inner" style="max-width:1080px">${header}<div class="of-grid-2">${cards(4)}</div></div></section>`;
      if (layout === "grid4")     return `<section class="of-slide ${tintClass}"><div class="of-inner">${header}<div class="of-grid-4">${cards()}</div></div></section>`;
      if (layout === "masonry")   return `<section class="of-slide ${tintClass}"><div class="of-inner">${header}<div class="of-masonry">${cards()}</div></div></section>`;
      if (layout === "steps")     return `<section class="of-slide ${tintClass}"><div class="of-inner" style="max-width:980px">${header}<div class="of-steps ${accClass}">${parsed.slice(0,6).map((p,i)=>`<div class="of-step"><div class="of-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="of-step-t">${p.h}</div>${p.d?`<div class="of-step-d">${p.d}</div>`:""}</div></div>`).join("")}</div></div></section>`;
      if (layout === "manifesto") return `<section class="of-slide ${tintClass}"><div class="of-inner" style="max-width:1020px">${header}<div class="of-mani">${parsed.slice(0,6).map((p,i)=>`<div class="of-mani-row"><div class="of-mani-k">${isAr ? "بند" : "Item"} · ${String(i+1).padStart(2,"0")}</div><div><div class="of-mani-t">${p.h}</div>${p.d?`<div class="of-mani-d">${p.d}</div>`:""}</div></div>`).join("")}</div></div></section>`;
      if (layout === "split" || layout === "split-rev")
        return `<section class="of-slide ${tintClass}"><div class="of-inner"><div class="of-split ${layout==="split-rev"?"of-split-rev":""}"><div>${header}</div><div class="of-edit-list">${parsed.slice(0,6).map((p,i)=>`<div class="of-edit-item"><div class="of-edit-k">${String(i+1).padStart(2,"0")}</div><div class="of-edit-t">${p.h}</div>${p.d?`<div class="of-edit-d">${p.d}</div>`:""}</div>`).join("")}</div></div></div></section>`;
      if (layout === "pills" || layout === "pills-sq")
        return `<section class="of-slide ${tintClass}"><div class="of-inner" style="max-width:1060px">${header}<div class="of-pills">${parsed.slice(0,8).map(p=>`<span class="of-pill ${layout==="pills-sq"?"of-pill-sq":""}">${p.h}</span>`).join("")}</div></div></section>`;
      if (layout === "timeline")  return `<section class="of-slide ${tintClass}"><div class="of-inner">${header}<div class="of-tl">${parsed.slice(0,6).map((p,i)=>`<div class="of-tl-item"><div class="of-tl-k">${String(i+1).padStart(2,"0")}</div><div class="of-tl-t">${p.h}</div>${p.d?`<div class="of-tl-d">${p.d}</div>`:""}</div>`).join("")}</div></div></section>`;
      if (layout === "editorial") return `<section class="of-slide ${tintClass}"><div class="of-inner" style="max-width:1080px">${header}<div class="of-edit-list">${parsed.slice(0,6).map((p,i)=>`<div class="of-edit-item"><div class="of-edit-k">${String(i+1).padStart(2,"0")}</div><div class="of-edit-t">${p.h}</div>${p.d?`<div class="of-edit-d">${p.d}</div>`:""}</div>`).join("")}</div></div></section>`;
      // callouts
      return `<section class="of-slide ${tintClass}"><div class="of-inner">${header}<div class="of-call">${parsed.slice(0,6).map((p,i)=>`<div class="of-call-box ${surfClass} ${accClass}"><div class="of-card-n">${String(i+1).padStart(2,"0")}</div><div class="of-card-t">${p.h}</div>${p.d?`<div class="of-card-d">${p.d}</div>`:""}</div>`).join("")}</div></div></section>`;
    }

    // Plain fallback
    return `<section class="of-slide ${tintClass}">
      <div class="of-inner">
        <span class="of-label">${kicker}</span>
        <h2 class="of-title">${emphasizeText(slide.title || title)}</h2>
        ${body ? `<p class="of-body">${body}</p>` : ""}
      </div>
    </section>`;
  }).join("\n");

  return `<div class="of-root">${sections}</div>`;
}

const OCEAN_FLOW_LOCK_CSS = `
  html, body { background: #0b1e3d !important; color: #eaf3ff !important; overflow-x: hidden !important; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  body > canvas { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 0 !important; }
  .of-root { position: relative; z-index: 2; }

  /* Tone variables */
  .of-tone-cyan   { --of-acc: 79,195,247; --of-soft: 8,46,80; }
  .of-tone-azure  { --of-acc: 96,165,250; --of-soft: 14,38,82; }
  .of-tone-teal   { --of-acc: 94,234,212; --of-soft: 6,58,62; }
  .of-tone-indigo { --of-acc: 165,180,252; --of-soft: 30,30,90; }
  .of-tone-frost  { --of-acc: 191,219,254; --of-soft: 18,42,72; }
  .of-tone-abyss  { --of-acc: 56,189,248; --of-soft: 4,22,48; }
  .of-tone-kelp   { --of-acc: 110,231,183; --of-soft: 8,52,52; }

  /* Slide frame */
  .of-slide { min-height: auto; display: flex; align-items: center; padding: clamp(64px, 11vh, 140px) clamp(22px, 6vw, 88px); position: relative; }
  .of-cover { min-height: 92vh; justify-content: center; text-align: center; flex-direction: column; }
  .of-inner { max-width: 1200px; width: 100%; margin: 0 auto; }

  /* Surfaces */
  .of-surf-clean { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); }
  .of-surf-frost { background: rgba(255,255,255,0.05); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.14); }
  .of-surf-border{ background: rgba(11,30,61,0.55); border: 1.5px solid rgba(var(--of-acc),0.55); }
  .of-surf-tint  { background: rgba(var(--of-soft),0.6); border: 1px solid rgba(var(--of-acc),0.22); }
  .of-surf-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(18px) saturate(140%); border: 1px solid rgba(255,255,255,0.16); }
  .of-surf-ink   { background: rgba(4,12,28,0.6); border: 1px solid rgba(255,255,255,0.08); }
  .of-surf-grad  { background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(var(--of-soft),0.5)); border: 1px solid rgba(255,255,255,0.08); }
  .of-surf-abyss { background: #04101f; border: 1px solid rgba(var(--of-acc),0.4); }

  /* Accents */
  .of-acc-top    { box-shadow: inset 0 3px 0 0 rgba(var(--of-acc),0.9); }
  .of-acc-left   { box-shadow: inset 3px 0 0 0 rgba(var(--of-acc),0.9); }
  .of-acc-corner { position: relative; }
  .of-acc-corner::before { content:""; position:absolute; top:0; right:0; width:42px; height:42px; background: rgba(var(--of-acc),0.85); clip-path: polygon(100% 0, 100% 100%, 0 0); }
  .of-acc-underline .of-card-t, .of-acc-underline .of-step-t { box-shadow: 0 2px 0 0 rgba(var(--of-acc),0.85); display: inline-block; padding-bottom: 2px; }
  .of-acc-dot .of-card-t::before, .of-acc-dot .of-step-t::before { content:""; display:inline-block; width:8px; height:8px; border-radius:50%; background: rgba(var(--of-acc),1); margin-inline-end: 10px; vertical-align: middle; }
  .of-acc-bar { border-inline-start: 3px solid rgba(var(--of-acc),0.85); padding-inline-start: 14px; }
  .of-acc-num .of-card-n, .of-acc-num .of-step-n { color: rgba(var(--of-acc),1) !important; }

  /* Typography */
  .of-label { font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(var(--of-acc),0.9); margin-bottom: 24px; display: inline-block; font-weight: 700; }
  .of-title { font-family: 'Anton', 'Inter', sans-serif; font-weight: 400; font-size: clamp(38px, 6vw, 84px); line-height: 1.02; letter-spacing: 0.01em; color: #fafdff; margin-bottom: 26px; overflow-wrap: anywhere; text-transform: uppercase; text-shadow: 0 4px 30px rgba(0,0,0,0.5); }
  .of-cover .of-title { font-size: clamp(52px, 9vw, 132px); }
  .of-sub { font-size: clamp(15px, 1.5vw, 19px); line-height: 1.75; color: rgba(234,243,255,0.82); max-width: 680px; margin-bottom: 22px; }
  .of-cover .of-sub { margin: 0 auto 22px; }
  .of-body { font-size: clamp(15px, 1.35vw, 17.5px); line-height: 1.85; color: rgba(234,243,255,0.78); max-width: 760px; margin-bottom: 18px; }

  .splash .scroll-hint, .finale { color: rgba(var(--of-acc),0.85); }

  /* Quote / big */
  .of-quote { font-family: 'Anton', sans-serif; font-weight: 400; font-size: clamp(28px, 4vw, 60px); line-height: 1.15; letter-spacing: 0.005em; color: #fafdff; max-width: 1000px; margin: 0 auto; text-align: center; text-transform: uppercase; text-shadow: 0 4px 30px rgba(0,0,0,0.5); }
  .of-attr { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(var(--of-acc),0.9); margin-top: 28px; text-align: center; display: block; }
  .of-big { font-family: 'Anton', sans-serif; font-weight: 400; font-size: clamp(110px, 18vw, 280px); line-height: 0.9; letter-spacing: -0.01em; color: rgba(var(--of-acc),1); text-align: center; text-shadow: 0 6px 50px rgba(0,0,0,0.55); }

  /* Stats */
  .of-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 32px; }
  .of-stat { padding: 26px 22px; border-radius: 8px; text-align: center; }
  .of-stat-v { font-family: 'Anton', sans-serif; font-weight: 400; font-size: clamp(36px, 4.4vw, 60px); color: rgba(var(--of-acc),1); line-height: 1; }
  .of-stat-l { margin-top: 10px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(234,243,255,0.7); }

  /* Grids */
  .of-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; margin-top: 32px; }
  .of-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; margin-top: 32px; }
  .of-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-top: 32px; }
  .of-bento  { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(130px, auto); gap: 14px; margin-top: 32px; }
  .of-bento > *:nth-child(1) { grid-column: span 4; grid-row: span 2; }
  .of-bento > *:nth-child(2) { grid-column: span 2; }
  .of-bento > *:nth-child(3) { grid-column: span 2; }
  .of-bento > *:nth-child(4) { grid-column: span 3; }
  .of-bento > *:nth-child(5) { grid-column: span 3; }
  .of-bento > *:nth-child(6) { grid-column: span 2; }
  .of-masonry { columns: 3 240px; column-gap: 16px; margin-top: 32px; }
  .of-masonry > * { break-inside: avoid; margin-bottom: 16px; display: block; }

  .of-card { padding: 26px 24px; border-radius: 8px; }
  .of-card-n { font-size: 10px; letter-spacing: 0.22em; color: rgba(234,243,255,0.45); margin-bottom: 12px; font-weight: 700; }
  .of-card-t { font-family: 'Anton', sans-serif; font-weight: 400; font-size: 16px; letter-spacing: 0.04em; text-transform: uppercase; color: #fafdff; margin-bottom: 10px; line-height: 1.2; }
  .of-card-d { font-size: 13.5px; line-height: 1.7; color: rgba(234,243,255,0.72); }

  /* Steps */
  .of-steps { display: flex; flex-direction: column; margin-top: 32px; }
  .of-step  { display: grid; grid-template-columns: 60px 1fr; gap: 24px; padding: 22px 0; border-bottom: 1px solid rgba(255,255,255,0.12); align-items: start; }
  .of-step:first-child { border-top: 1px solid rgba(255,255,255,0.12); }
  .of-step-n { font-family: 'Anton', sans-serif; font-size: 30px; color: rgba(var(--of-acc),0.8); line-height: 1; }
  .of-step-t { font-family: 'Anton', sans-serif; font-weight: 400; font-size: 19px; margin-bottom: 6px; color: #fafdff; text-transform: uppercase; letter-spacing: 0.02em; }
  .of-step-d { font-size: 13.5px; line-height: 1.7; color: rgba(234,243,255,0.7); }

  /* Manifesto */
  .of-mani { margin-top: 32px; }
  .of-mani-row { display: grid; grid-template-columns: 120px 1fr; gap: 28px; padding: 22px 0; border-bottom: 1px dashed rgba(255,255,255,0.2); }
  .of-mani-k { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(var(--of-acc),0.85); font-weight: 700; }
  .of-mani-t { font-family: 'Anton', sans-serif; font-weight: 400; font-size: 20px; text-transform: uppercase; letter-spacing: 0.02em; color: #fafdff; margin-bottom: 6px; }
  .of-mani-d { font-size: 13.5px; line-height: 1.7; color: rgba(234,243,255,0.72); }

  /* Pills */
  .of-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
  .of-pill  { padding: 12px 22px; border: 1.5px solid rgba(var(--of-acc),0.7); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: #fafdff; background: rgba(4,16,32,0.4); border-radius: 999px; text-transform: uppercase; }
  .of-pill-sq { border-radius: 0; }

  /* Split / editorial */
  .of-split { display: grid; grid-template-columns: 1fr 1.15fr; gap: clamp(28px, 4vw, 68px); align-items: start; }
  .of-split-rev { grid-template-columns: 1.15fr 1fr; }
  .of-edit-list { border-top: 1px solid rgba(255,255,255,0.14); }
  .of-edit-item { padding: 22px 0; border-bottom: 1px solid rgba(255,255,255,0.14); }
  .of-edit-k { font-weight: 800; font-size: 11px; letter-spacing: 0.18em; color: rgba(var(--of-acc),0.9); margin-bottom: 8px; }
  .of-edit-t { font-family: 'Anton', sans-serif; font-weight: 400; font-size: 19px; text-transform: uppercase; letter-spacing: 0.02em; color: #fafdff; margin-bottom: 6px; }
  .of-edit-d { font-size: 13.5px; line-height: 1.7; color: rgba(234,243,255,0.72); }

  /* Callouts */
  .of-call { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 32px; }
  .of-call-box { padding: 24px; border-radius: 8px; }

  /* Timeline */
  .of-tl { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 20px; margin-top: 36px; position: relative; }
  .of-tl::before { content:""; position:absolute; left:8px; right:8px; top: 16px; height: 1px; background: rgba(255,255,255,0.18); }
  .of-tl-item { position: relative; padding-top: 36px; }
  .of-tl-item::before { content:""; position:absolute; left: 0; top: 11px; width: 12px; height: 12px; background: rgba(var(--of-acc),1); border-radius: 50%; border: 2px solid #0b1e3d; }
  .of-tl-k { font-weight: 800; font-size: 11px; letter-spacing: 0.18em; color: rgba(var(--of-acc),0.95); margin-bottom: 8px; }
  .of-tl-t { font-family: 'Anton', sans-serif; font-weight: 400; font-size: 16px; text-transform: uppercase; letter-spacing: 0.02em; color: #fafdff; margin-bottom: 6px; }
  .of-tl-d { font-size: 12.5px; line-height: 1.65; color: rgba(234,243,255,0.7); }

  /* Compare */
  .of-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 32px; }
  .of-compare > div { padding: 30px 26px; border-radius: 8px; }
  .of-compare h3 { font-family: 'Anton', sans-serif; font-size: 18px; font-weight: 400; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(var(--of-acc),0.95); margin-bottom: 14px; }
  .of-compare p { font-size: 13.5px; line-height: 1.7; color: rgba(234,243,255,0.75); padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.1); }

  /* RTL */
  [dir="rtl"] .of-body, [dir="rtl"] .of-card-d, [dir="rtl"] .of-step-d, [dir="rtl"] .of-mani-d, [dir="rtl"] .of-edit-d, [dir="rtl"] .of-tl-d, [dir="rtl"] .of-sub { text-align: right; }
  [dir="rtl"] .of-step, [dir="rtl"] .of-mani-row { direction: rtl; }
  [dir="rtl"] .of-acc-corner::before { left: 0; right: auto; clip-path: polygon(0 0, 0 100%, 100% 0); }

  /* Responsive */
  @media (max-width: 1024px) {
    .of-grid-4, .of-grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .of-bento  { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .of-bento > * { grid-column: span 1 !important; grid-row: span 1 !important; }
    .of-split, .of-split-rev { grid-template-columns: 1fr; gap: 32px; }
    .of-masonry { columns: 2 200px; }
    .of-compare { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .of-slide { padding: 56px 20px; }
    .of-cover { min-height: 82vh; }
    .of-title { font-size: clamp(30px, 9vw, 44px) !important; }
    .of-cover .of-title { font-size: clamp(40px, 12vw, 60px) !important; }
    .of-big { font-size: clamp(80px, 26vw, 120px) !important; }
    .of-quote { font-size: clamp(22px, 7vw, 32px) !important; }
    .of-grid-2, .of-grid-3, .of-grid-4 { grid-template-columns: 1fr; }
    .of-bento { grid-template-columns: 1fr; }
    .of-masonry { columns: 1; }
    .of-stats { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .of-stat { padding: 20px 14px; }
    .of-stat-v { font-size: clamp(30px, 10vw, 44px) !important; }
    .of-step { grid-template-columns: 44px 1fr; gap: 14px; padding: 18px 0; }
    .of-mani-row { grid-template-columns: 80px 1fr; gap: 14px; padding: 18px 0; }
    .of-tl { grid-template-columns: 1fr; }
    .of-tl::before { display: none; }
    .of-call { grid-template-columns: 1fr; }
  }
`;

/* ────────────────────────────────────────────────────────── */
/* Seasonal Scroll renderer                                   */
/* ────────────────────────────────────────────────────────── */

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
const SEASON_LABELS_EN = ["Spring", "Summer", "Autumn", "Winter"];
const SEASON_LABELS_AR = ["الربيع", "الصيف", "الخريف", "الشتاء"];

/* ────────────────────────────────────────────────────────── */
/* Vanta — Digital Atelier renderer                           */
/* ────────────────────────────────────────────────────────── */
function renderVantaAtelierDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const overlays = `
    <div id="three-container"></div>
    <div class="layer-blur"></div>
    <div class="noise-overlay"></div>
    <div class="grain-overlay"></div>`;

  // Wrap last word of a title in <em> for the gold italic accent
  const titleEm = (raw: string): string => {
    const safe = esc(raw);
    const words = safe.split(/\s+/);
    if (words.length < 2) return `<em>${safe}</em>`;
    const last = words.pop();
    return `${words.join(" ")} <em>${last}</em>`;
  };

  // 10 base layouts × 8 surface variants × 7 accents × 7 tones = ~3920 unique combos.
  // Hashed per slide so identical content always renders the same combo.
  const VARIANTS = ["clean", "bordered", "tinted", "glass", "outline", "mono", "gradient", "noir"];
  const ACCENTS  = ["top", "left", "corner", "underline", "side-bar", "dot", "num"];
  const TONES    = ["gold", "bronze", "champagne", "amber", "ivory", "smoke", "ember"];

  const hash = (s: string, salt = 0): number => {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return h >>> 0;
  };

  const sections = slides.map((slide, idx) => {
    const title = slide.title || deck.title || "";
    const body  = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const kicker = esc(slide.kicker || `${isAr ? "فصل" : "Chapter"} · ${num}`);
    const img = slide.image ? `<img class="vt-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = (slide.title || "") + "|" + idx;
    const variant = VARIANTS[hash(seed, 1) % VARIANTS.length];
    const accent  = ACCENTS [hash(seed, 2) % ACCENTS.length];
    const tone    = TONES   [hash(seed, 3) % TONES.length];

    // Pick layout from content shape, rotate among compatible options.
    let layout: string;
    if (idx === 0 || slide.type === "cover") layout = "hero";
    else if (slide.type === "closing") layout = "cta";
    else if (slide.type === "quote" || slide.quote) layout = "quote";
    else if (slide.stats?.length) layout = "stats";
    else if (slide.big_value) layout = "big";
    else if (slide.steps?.length) layout = "process";
    else if (slide.events?.length) layout = "chronology";
    else if (slide.left_bullets?.length && slide.right_bullets?.length) layout = "compare";
    else {
      const opts = bullets.length >= 4
        ? ["cards", "bento", "manifesto", "list", "index", "editorial", "split", "split-rev"]
        : bullets.length >= 2
        ? ["split", "split-rev", "editorial", "manifesto", "list", "cards"]
        : ["split", "split-rev", "editorial"];
      layout = opts[hash(seed, 4) % opts.length];
    }

    const cls = `vt-section vt-l-${layout} vt-v-${variant} vt-a-${accent} vt-tn-${tone}${layout === "split-rev" ? " vt-split-rev" : ""}`;

    if (layout === "hero") {
      return `<section class="vt-hero vt-tn-${tone}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h1 class="vt-hero-title">${titleEm(title)}</h1>
          ${slide.subtitle ? `<p class="vt-lead">${esc(slide.subtitle)}</p>` : ""}
          ${slide.image ? `<img class="vt-img vt-img-hero" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : ""}
        </div>
      </section>`;
    }

    if (layout === "cta") {
      return `<section class="vt-cta vt-tn-${tone}">
        <p class="vt-kicker">${kicker}</p>
        <h2 class="vt-cta-heading">${titleEm(title)}</h2>
        ${slide.subtitle ? `<p class="vt-lead">${esc(slide.subtitle)}</p>` : body ? `<p class="vt-lead">${body}</p>` : ""}
      </section>`;
    }

    if (layout === "quote") {
      return `<section class="${cls} vt-center">
        <div class="vt-inner">
          <div class="vt-quote-mark">"</div>
          <blockquote class="vt-quote">${esc(slide.quote || title)}</blockquote>
          ${slide.attribution ? `<div class="vt-quote-attr">— ${esc(slide.attribution)}</div>` : ""}
        </div>
      </section>`;
    }

    if (layout === "stats") {
      const stats = (slide.stats || []).slice(0, 4);
      return `<section class="${cls}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h2 class="vt-title">${titleEm(title)}</h2>
          ${body ? `<p class="vt-lead">${body}</p>` : ""}
          <div class="vt-stats">${stats.map(s => `<div class="vt-stat"><span class="vt-stat-v">${esc(s.value)}</span><span class="vt-stat-l">${esc(s.label)}</span></div>`).join("")}</div>
          ${img}
        </div>
      </section>`;
    }

    if (layout === "big") {
      return `<section class="${cls} vt-center">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <div class="vt-big-v"><em>${esc(slide.big_value || "")}</em></div>
          <p class="vt-big-l">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="vt-lead" style="margin:1.4rem auto 0">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (layout === "process") {
      const steps = (slide.steps || []).slice(0, 6);
      return `<section class="${cls}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h2 class="vt-title">${titleEm(title)}</h2>
          ${body ? `<p class="vt-lead">${body}</p>` : ""}
          <div class="vt-steps">${steps.map((s, i) => `<div class="vt-step">
            <div class="vt-step-num">${String(i+1).padStart(2,"0")}</div>
            <div><h3 class="vt-step-title">${esc(s.title)}</h3>${s.desc ? `<p class="vt-step-desc">${esc(s.desc)}</p>` : ""}</div>
          </div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (layout === "chronology") {
      const events = (slide.events || []).slice(0, 6);
      return `<section class="${cls}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h2 class="vt-title">${titleEm(title)}</h2>
          <div class="vt-awards">${events.map(e => `<div class="vt-award">
            <div class="vt-award-year">${esc(e.date)}</div>
            <div><h3 class="vt-award-title">${esc(e.title)}</h3>${e.desc ? `<p class="vt-award-org">${esc(e.desc)}</p>` : ""}</div>
          </div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (layout === "compare") {
      return `<section class="${cls}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h2 class="vt-title">${titleEm(title)}</h2>
          <div class="vt-grid">
            <div class="vt-compare-card">
              <h3 class="vt-compare-title">${esc(slide.left_title || "A")}</h3>
              ${(slide.left_bullets || []).slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}
            </div>
            <div class="vt-compare-card">
              <h3 class="vt-compare-title">${esc(slide.right_title || "B")}</h3>
              ${(slide.right_bullets || []).slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}
            </div>
          </div>
        </div>
      </section>`;
    }

    if (layout === "manifesto") {
      return `<section class="${cls}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h2 class="vt-title">${titleEm(title)}</h2>
          ${body ? `<p class="vt-lead">${body}</p>` : ""}
          <div class="vt-list">${bullets.slice(0, 6).map((b, i) => {
            const [h, d = ""] = b.split(/[:：—-]\s*/, 2);
            return `<div class="vt-list-item">
              <div class="vt-list-num">${String(i+1).padStart(2,"0")}</div>
              <div><h3 class="vt-list-title">${esc(h)}</h3>${d ? `<p class="vt-list-desc">${esc(d)}</p>` : ""}</div>
            </div>`;
          }).join("")}</div>
        </div>
      </section>`;
    }

    if (layout === "index" || layout === "list") {
      return `<section class="${cls}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h2 class="vt-title">${titleEm(title)}</h2>
          ${body ? `<p class="vt-lead">${body}</p>` : ""}
          <div class="vt-index">${bullets.slice(0, 7).map((b, i) => `<div class="vt-index-item">
            <span class="vt-index-n">${String(i+1).padStart(3,"0")}</span>
            <span class="vt-index-t">${esc(b)}</span>
            <span class="vt-index-arrow">→</span>
          </div>`).join("")}</div>
        </div>
      </section>`;
    }

    if (layout === "editorial") {
      return `<section class="${cls}">
        <div class="vt-inner">
          <p class="vt-kicker">${kicker}</p>
          <h2 class="vt-title">${titleEm(title)}</h2>
          <div class="vt-grid">
            <div class="vt-inner">
              ${body ? `<p class="vt-body">${body}</p>` : ""}
              ${bullets.length ? `<div class="vt-cells">${bullets.slice(0, 4).map((b, i) => `<div class="vt-cell"><span class="vt-cell-n">${String(i+1).padStart(2,"0")}</span><span class="vt-cell-v">${esc(b.slice(0, 80))}</span></div>`).join("")}</div>` : ""}
            </div>
            <div>${img || `<div class="vt-img" style="height:340px;background:linear-gradient(140deg, rgba(196,168,130,0.18), rgba(60,40,20,0.05));"></div>`}</div>
          </div>
        </div>
      </section>`;
    }

    if (layout === "split" || layout === "split-rev") {
      return `<section class="${cls}">
        <div class="vt-inner">
          <div class="vt-grid">
            <div class="vt-inner">
              <p class="vt-kicker">${kicker}</p>
              <h2 class="vt-title">${titleEm(title)}</h2>
              ${body ? `<p class="vt-body">${body}</p>` : ""}
              ${bullets.length ? `<ul class="vt-bullets">${bullets.slice(0, 5).map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
            </div>
            <div>${img || `<div class="vt-img" style="height:380px;background:linear-gradient(160deg, rgba(196,168,130,0.2), rgba(40,30,20,0.05));"></div>`}</div>
          </div>
        </div>
      </section>`;
    }

    // Cards / Bento (default)
    return `<section class="${cls}">
      <div class="vt-inner">
        <p class="vt-kicker">${kicker}</p>
        <h2 class="vt-title">${titleEm(title)}</h2>
        ${body ? `<p class="vt-lead">${body}</p>` : ""}
        ${img}
        <div class="vt-grid">${bullets.slice(0, layout === "bento" ? 5 : 6).map((b, i) => {
          const [h, d = ""] = b.split(/[:：—-]\s*/, 2);
          return `<div class="vt-card">
            <div class="vt-card-num">${String(i+1).padStart(2,"0")} / ${String(bullets.length).padStart(2,"0")}</div>
            <h3 class="vt-card-title">${esc(h)}</h3>
            ${d ? `<p class="vt-card-desc">${esc(d)}</p>` : ""}
          </div>`;
        }).join("")}</div>
      </div>
    </section>`;
  });

  const contentBody = sections.slice(1).join('<div class="vt-divider"></div>');
  return `${overlays}\n${sections[0] || ""}\n<div class="content-wrapper">${contentBody}</div>`;
}

const VANTA_LOCK_CSS = `
  html, body { background: #0e0e0e !important; color: #e8e4de !important; overflow-x: hidden; font-family: 'Inter', system-ui, sans-serif; }
  #three-container { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
  .layer-blur, .noise-overlay, .grain-overlay { pointer-events: none; }
  .content-wrapper { position: relative; z-index: 10; background: linear-gradient(to bottom, transparent 0%, rgba(14,14,14,0.55) 4%, rgba(14,14,14,0.92) 14%, rgba(14,14,14,0.98) 22%); }

  /* Hide legacy template chrome */
  .hero-tag, .section-tag, .cta-tag, .morph-info, .form-submit,
  .marquee-strip, .marquee-track { display: none !important; }

  .vt-hero {
    position: relative; z-index: 10;
    min-height: 100vh; display: flex; align-items: center;
    padding: clamp(80px, 13vh, 160px) clamp(24px, 6vw, 120px);
    max-width: 1320px; margin: 0 auto;
  }
  .vt-hero .vt-inner { display: flex; flex-direction: column; gap: 1.4rem; max-width: 1100px; }
  .vt-hero-title {
    font-family: 'Playfair Display', 'Cormorant Garamond', serif;
    font-weight: 400; font-size: clamp(2.6rem, 6.6vw, 5.6rem); line-height: 1.05;
    letter-spacing: -0.025em; margin: 0; color: #f5efe4;
  }
  .vt-hero-title em { font-style: italic; color: #c4a882; }

  .vt-section {
    position: relative;
    padding: clamp(80px, 11vh, 140px) clamp(24px, 6vw, 120px);
    max-width: 1320px; margin: 0 auto;
  }
  .vt-section.vt-center { text-align: center; }
  .vt-inner { display: flex; flex-direction: column; gap: 1.6rem; }

  .vt-kicker {
    font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
    font-size: 0.65rem; letter-spacing: 0.32em; text-transform: uppercase;
    color: #c4a882; opacity: 0.85; margin: 0;
    display: inline-flex; align-items: center; gap: 0.8rem;
  }
  .vt-kicker::before { content: ''; display: inline-block; width: 24px; height: 1px; background: #c4a882; opacity: 0.55; }
  .vt-title {
    font-family: 'Playfair Display', 'Cormorant Garamond', serif;
    font-weight: 400; font-size: clamp(2rem, 4.2vw, 3.4rem); line-height: 1.1;
    letter-spacing: -0.02em; margin: 0; color: #f3ede1;
  }
  .vt-title em { font-style: italic; color: #c4a882; }
  .vt-lead { font-size: clamp(1rem, 1.25vw, 1.15rem); line-height: 1.8; color: rgba(232,228,222,0.78); max-width: 760px; margin: 0; }
  .vt-body { font-size: clamp(0.95rem, 1.1vw, 1.05rem); line-height: 1.85; color: rgba(232,228,222,0.72); max-width: 720px; margin: 0; }
  .vt-bullets { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
  .vt-bullets li { font-size: 0.95rem; line-height: 1.65; padding: 0.85rem 0 0.85rem 1.5rem; position: relative; color: rgba(232,228,222,0.75); border-bottom: 1px solid rgba(196,168,130,0.08); }
  .vt-bullets li::before { content: ''; position: absolute; left: 0; top: 1.2rem; width: 6px; height: 6px; border-radius: 50%; background: #c4a882; opacity: 0.7; }
  [dir="rtl"] .vt-bullets li { padding: 0.85rem 1.5rem 0.85rem 0; }
  [dir="rtl"] .vt-bullets li::before { left: auto; right: 0; }

  .vt-img { display: block; width: 100%; max-width: 100%; max-height: 420px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(196,168,130,0.2); margin: 0.6rem 0 0; }
  .vt-img-hero { max-height: 540px; margin-top: 1.4rem; }

  .vt-l-cards .vt-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 2px; margin-top: 0.6rem; }
  .vt-card { padding: 2rem 1.8rem; display: flex; flex-direction: column; gap: 0.6rem; min-height: 220px; transition: border-color 0.4s; }
  .vt-card-num { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.18em; color: rgba(196,168,130,0.6); margin: 0 0 1rem; text-transform: uppercase; }
  .vt-card-title { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 1.25rem; line-height: 1.3; margin: 0; color: #f3ede1; letter-spacing: -0.01em; }
  .vt-card-desc { font-size: 0.88rem; line-height: 1.7; color: rgba(232,228,222,0.65); margin: 0; font-weight: 300; }

  .vt-l-bento .vt-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); grid-auto-rows: minmax(180px, auto); gap: 2px; margin-top: 0.6rem; }
  .vt-l-bento .vt-card:nth-child(1) { grid-column: span 2; grid-row: span 2; }
  .vt-l-bento .vt-card:nth-child(4) { grid-column: span 2; }

  .vt-l-split .vt-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: clamp(2.4rem, 5vw, 4rem); align-items: start; }
  .vt-l-split.vt-split-rev .vt-grid { grid-template-columns: 0.95fr 1.05fr; direction: rtl; }
  .vt-l-split.vt-split-rev .vt-grid > * { direction: ltr; }
  [dir="rtl"] .vt-l-split.vt-split-rev .vt-grid > * { direction: rtl; }

  .vt-list { display: flex; flex-direction: column; margin-top: 0.6rem; }
  .vt-list-item { display: grid; grid-template-columns: 90px 1fr; gap: 1.6rem; padding: 1.6rem 0; border-top: 1px solid rgba(196,168,130,0.1); align-items: start; }
  .vt-list-item:last-child { border-bottom: 1px solid rgba(196,168,130,0.1); }
  .vt-list-num { font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; color: rgba(196,168,130,0.65); }
  .vt-list-title { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 1.2rem; margin: 0 0 0.4rem; color: #f3ede1; letter-spacing: -0.01em; }
  .vt-list-desc { font-size: 0.92rem; line-height: 1.75; color: rgba(232,228,222,0.68); margin: 0; font-weight: 300; }

  .vt-index { display: flex; flex-direction: column; }
  .vt-index-item { display: grid; grid-template-columns: 90px 1fr 44px; gap: 1.6rem; padding: 1.4rem 0; align-items: center; border-top: 1px solid rgba(196,168,130,0.1); transition: background 0.3s; }
  .vt-index-item:last-child { border-bottom: 1px solid rgba(196,168,130,0.1); }
  .vt-index-item:hover { background: rgba(196,168,130,0.03); }
  .vt-index-n { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; color: rgba(196,168,130,0.55); letter-spacing: 0.18em; }
  .vt-index-t { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #f3ede1; }
  .vt-index-arrow { text-align: right; color: rgba(196,168,130,0.5); }
  [dir="rtl"] .vt-index-arrow { text-align: left; transform: scaleX(-1); }

  .vt-l-editorial .vt-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: clamp(2rem, 4vw, 3.6rem); align-items: start; }
  .vt-cells { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin-top: 1rem; }
  .vt-cell { padding: 1.4rem 1.2rem; border: 1px solid rgba(196,168,130,0.1); display: flex; flex-direction: column; justify-content: space-between; min-height: 120px; gap: 1.2rem; }
  .vt-cell-n { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; color: rgba(196,168,130,0.55); letter-spacing: 0.2em; }
  .vt-cell-v { font-family: 'Playfair Display', serif; font-size: 0.95rem; line-height: 1.5; color: rgba(232,228,222,0.85); }

  .vt-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 2.4rem; margin-top: 0.6rem; padding: 2rem 0; border-top: 1px solid rgba(196,168,130,0.12); border-bottom: 1px solid rgba(196,168,130,0.12); }
  .vt-stat { display: flex; flex-direction: column; gap: 0.5rem; }
  .vt-stat-v { font-family: 'Playfair Display', serif; font-size: clamp(2.4rem, 4vw, 3.4rem); font-weight: 400; line-height: 1; color: #c4a882; }
  .vt-stat-l { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(232,228,222,0.55); }

  .vt-steps { display: flex; flex-direction: column; margin-top: 0.6rem; }
  .vt-step { display: grid; grid-template-columns: 80px 1fr; gap: 2rem; padding: 1.8rem 0; border-bottom: 1px solid rgba(196,168,130,0.1); align-items: start; }
  .vt-step-num { font-family: 'Playfair Display', serif; font-style: italic; font-size: 2rem; color: rgba(196,168,130,0.55); line-height: 1; }
  .vt-step-title { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 1.25rem; margin: 0 0 0.4rem; color: #f3ede1; }
  .vt-step-desc { font-size: 0.92rem; line-height: 1.75; color: rgba(232,228,222,0.65); margin: 0; font-weight: 300; max-width: 640px; }

  .vt-awards { display: flex; flex-direction: column; margin-top: 0.6rem; }
  .vt-award { display: grid; grid-template-columns: 130px 1fr; gap: 1.8rem; padding: 1.6rem 0; border-top: 1px solid rgba(196,168,130,0.1); align-items: start; }
  .vt-award:last-child { border-bottom: 1px solid rgba(196,168,130,0.1); }
  .vt-award-year { font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; letter-spacing: 0.18em; color: #c4a882; }
  .vt-award-title { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 1.2rem; margin: 0 0 0.35rem; color: #f3ede1; }
  .vt-award-org { font-size: 0.88rem; color: rgba(232,228,222,0.6); line-height: 1.7; margin: 0; }

  .vt-l-compare .vt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; margin-top: 0.6rem; }
  .vt-compare-card { padding: 2rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .vt-compare-title { font-family: 'Playfair Display', serif; font-weight: 400; font-style: italic; font-size: 1.4rem; color: #c4a882; margin: 0 0 0.6rem; }
  .vt-compare-card p { font-size: 0.92rem; line-height: 1.75; color: rgba(232,228,222,0.72); margin: 0; padding: 0.4rem 0; border-top: 1px solid rgba(196,168,130,0.08); }
  .vt-compare-card p:first-of-type { border-top: 0; }

  .vt-l-quote .vt-inner { max-width: 920px; margin: 0 auto; align-items: center; text-align: center; }
  .vt-quote-mark { font-family: 'Playfair Display', serif; font-size: 5rem; color: #c4a882; opacity: 0.45; line-height: 0.7; }
  .vt-quote { font-family: 'Playfair Display', serif; font-style: italic; font-size: clamp(1.5rem, 3vw, 2.4rem); line-height: 1.4; color: #f3ede1; margin: 0; }
  .vt-quote-attr { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(232,228,222,0.55); }

  .vt-l-big { text-align: center; }
  .vt-l-big .vt-inner { align-items: center; }
  .vt-big-v { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(5rem, 13vw, 11rem); line-height: 0.95; letter-spacing: -0.04em; color: #c4a882; margin: 0; }
  .vt-big-v em { font-style: italic; }
  .vt-big-l { font-size: clamp(1.1rem, 1.6vw, 1.35rem); color: rgba(232,228,222,0.78); margin-top: 1rem; max-width: 720px; }

  .vt-cta { text-align: center; padding: clamp(80px, 12vh, 140px) clamp(24px, 6vw, 120px); max-width: 1320px; margin: 0 auto; }
  .vt-cta-heading { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(2.4rem, 5vw, 4rem); line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 1.4rem; color: #f3ede1; }
  .vt-cta-heading em { font-style: italic; color: #c4a882; }
  .vt-cta .vt-lead { margin: 0 auto; }

  .vt-divider { width: 100%; height: 1px; background: linear-gradient(to right, transparent, rgba(196,168,130,0.18), transparent); margin: 0; }

  /* Surface variants (8) */
  .vt-v-clean    .vt-card, .vt-v-clean    .vt-compare-card { background: rgba(255,255,255,0.015); border: 1px solid rgba(196,168,130,0.08); }
  .vt-v-bordered .vt-card, .vt-v-bordered .vt-compare-card { background: transparent; border: 1px solid rgba(196,168,130,0.28); }
  .vt-v-tinted   .vt-card, .vt-v-tinted   .vt-compare-card { background: rgba(196,168,130,0.06); border: 1px solid rgba(196,168,130,0.14); }
  .vt-v-glass    .vt-card, .vt-v-glass    .vt-compare-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); backdrop-filter: blur(6px); }
  .vt-v-outline  .vt-card, .vt-v-outline  .vt-compare-card { background: transparent; border: 1px dashed rgba(196,168,130,0.32); }
  .vt-v-mono     .vt-card, .vt-v-mono     .vt-compare-card { background: rgba(14,14,14,0.6); border: 1px solid rgba(232,228,222,0.08); }
  .vt-v-gradient .vt-card, .vt-v-gradient .vt-compare-card { background: linear-gradient(140deg, rgba(196,168,130,0.12), rgba(50,40,30,0.04)); border: 1px solid rgba(196,168,130,0.16); }
  .vt-v-noir     .vt-card, .vt-v-noir     .vt-compare-card { background: #060606; border: 1px solid rgba(196,168,130,0.18); }

  /* Accents (7) */
  .vt-a-top      .vt-card { border-top: 2px solid #c4a882; }
  .vt-a-left     .vt-card { border-left: 2px solid #c4a882; }
  .vt-a-corner   .vt-card { position: relative; }
  .vt-a-corner   .vt-card::after { content: ''; position: absolute; top: 0; right: 0; width: 30px; height: 30px; border-top: 1px solid #c4a882; border-right: 1px solid #c4a882; }
  .vt-a-underline .vt-card-title { padding-bottom: 0.6rem; border-bottom: 1px solid rgba(196,168,130,0.3); }
  .vt-a-side-bar  .vt-card { border-left: 3px solid #c4a882; padding-left: 1.6rem; }
  .vt-a-dot       .vt-card-num::after { content: ' •'; color: #c4a882; }
  .vt-a-num       .vt-card-num { font-size: 1.1rem; color: #c4a882; font-family: 'Playfair Display', serif; font-style: italic; letter-spacing: 0; }

  /* Tones (7) */
  .vt-tn-gold       { --vt-acc: #c4a882; }
  .vt-tn-bronze     { --vt-acc: #b08c5c; }
  .vt-tn-champagne  { --vt-acc: #d4bf9a; }
  .vt-tn-amber      { --vt-acc: #d49a5c; }
  .vt-tn-ivory      { --vt-acc: #e6dfca; }
  .vt-tn-smoke      { --vt-acc: #9c907c; }
  .vt-tn-ember      { --vt-acc: #c47a4a; }
  .vt-section[class*="vt-tn-"] .vt-kicker,
  .vt-section[class*="vt-tn-"] .vt-title em,
  .vt-section[class*="vt-tn-"] .vt-list-num,
  .vt-section[class*="vt-tn-"] .vt-stat-v,
  .vt-section[class*="vt-tn-"] .vt-step-num,
  .vt-section[class*="vt-tn-"] .vt-award-year,
  .vt-section[class*="vt-tn-"] .vt-compare-title,
  .vt-section[class*="vt-tn-"] .vt-big-v,
  .vt-section[class*="vt-tn-"] .vt-quote-mark,
  .vt-hero[class*="vt-tn-"] .vt-kicker,
  .vt-hero[class*="vt-tn-"] .vt-hero-title em,
  .vt-cta[class*="vt-tn-"] .vt-kicker,
  .vt-cta[class*="vt-tn-"] .vt-cta-heading em { color: var(--vt-acc); }
  .vt-section[class*="vt-tn-"] .vt-kicker::before,
  .vt-hero[class*="vt-tn-"] .vt-kicker::before,
  .vt-cta[class*="vt-tn-"] .vt-kicker::before { background: var(--vt-acc); }
  .vt-section[class*="vt-tn-"] .vt-a-top .vt-card { border-top-color: var(--vt-acc); }
  .vt-section[class*="vt-tn-"] .vt-a-left .vt-card,
  .vt-section[class*="vt-tn-"] .vt-a-side-bar .vt-card { border-left-color: var(--vt-acc); }
  .vt-section[class*="vt-tn-"] .vt-a-corner .vt-card::after { border-color: var(--vt-acc); }

  /* RTL */
  [dir="rtl"] .vt-section, [dir="rtl"] .vt-hero, [dir="rtl"] .vt-cta { text-align: right; }
  [dir="rtl"] .vt-l-quote .vt-inner, [dir="rtl"] .vt-l-big .vt-inner, [dir="rtl"] .vt-cta { text-align: center; }

  /* Tablet */
  @media (max-width: 1024px) {
    .vt-l-cards .vt-grid     { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .vt-l-bento .vt-grid     { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .vt-l-bento .vt-card:nth-child(1) { grid-column: span 2; grid-row: auto; }
    .vt-l-bento .vt-card:nth-child(4) { grid-column: span 2; }
    .vt-stats                 { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 1.8rem; }
    .vt-l-split .vt-grid,
    .vt-l-editorial .vt-grid  { grid-template-columns: 1fr; gap: 2.4rem; }
    .vt-l-split.vt-split-rev .vt-grid { direction: ltr; }
  }

  /* Mobile */
  @media (max-width: 640px) {
    .vt-hero, .vt-section, .vt-cta { padding: 64px 22px !important; min-height: auto; }
    .vt-hero { min-height: 80vh; }
    .vt-hero-title  { font-size: clamp(2rem, 9vw, 2.8rem) !important; }
    .vt-title       { font-size: clamp(1.8rem, 7vw, 2.4rem) !important; }
    .vt-cta-heading { font-size: clamp(2rem, 8vw, 2.8rem) !important; }
    .vt-l-cards .vt-grid, .vt-l-bento .vt-grid,
    .vt-l-compare .vt-grid { grid-template-columns: 1fr !important; }
    .vt-l-bento .vt-card:nth-child(n) { grid-column: auto; }
    .vt-stats              { grid-template-columns: 1fr 1fr; gap: 1.4rem; padding: 1.4rem 0; }
    .vt-list-item, .vt-step, .vt-award { grid-template-columns: 60px 1fr; gap: 1rem; padding: 1.1rem 0; }
    .vt-index-item         { grid-template-columns: 60px 1fr 28px; gap: 1rem; padding: 1rem 0; }
    .vt-card               { padding: 1.4rem; min-height: auto; }
    .vt-cells              { grid-template-columns: 1fr; }
    .vt-quote              { font-size: clamp(1.2rem, 6vw, 1.7rem) !important; }
    .vt-big-v              { font-size: clamp(4rem, 18vw, 6.4rem) !important; }
    .vt-img, .vt-img-hero  { max-height: 240px; }
  }
`;

/* ────────────────────────────────────────────────────────── */
/* Aquara — Interactive Water renderer                        */
/* ────────────────────────────────────────────────────────── */
const AQUARA_LOCK_CSS = `
  /* ── Base ── */
  html, body { background: #0a0e17 !important; color: #e8edf5 !important; overflow-x: hidden; }
  body { cursor: crosshair; font-family: 'Inter', system-ui, sans-serif; }
  #water-canvas { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; }
  .aq-overlay { position: relative; z-index: 1; }
  .aq-overlay * { pointer-events: auto; overflow-wrap: anywhere; }

  /* Hide leftover decorative elements from the template */
  .scroll-hint, .hero-tag { display: none !important; }

  /* ── Hero ── */
  .aq-hero {
    min-height: 100vh; display: flex; flex-direction: column; justify-content: center;
    padding: clamp(80px, 14vh, 160px) clamp(24px, 6vw, 120px);
    max-width: 1320px; margin: 0 auto;
  }
  .aq-hero .aq-kicker { color: #78b4ff; }
  .aq-hero-title { font-family: 'Syne', 'Inter', sans-serif; font-weight: 700; font-size: clamp(2.6rem, 7vw, 6rem); line-height: 1.02; letter-spacing: -0.035em; margin: 0 0 1.6rem; color: #ffffff; }
  .aq-hero-sub   { font-size: clamp(1.05rem, 1.4vw, 1.3rem); line-height: 1.7; max-width: 720px; color: rgba(207,217,234,0.78); margin: 0; }

  /* ── Universal section frame ── */
  .aq-section {
    position: relative;
    padding: clamp(72px, 11vh, 140px) clamp(24px, 6vw, 120px);
    max-width: 1320px; margin: 0 auto;
  }
  .aq-section.aq-center { text-align: center; }
  .aq-inner { display: flex; flex-direction: column; gap: 1.6rem; }

  /* ── Typography ── */
  .aq-kicker { font-family: 'Syne', sans-serif; font-size: 0.72rem; letter-spacing: 0.32em; text-transform: uppercase; color: rgba(120,180,255,0.7); margin: 0; }
  .aq-title  { font-family: 'Syne', sans-serif; font-weight: 600; font-size: clamp(2rem, 4.2vw, 3.6rem); line-height: 1.08; letter-spacing: -0.022em; margin: 0; color: #f4f7fc; }
  .aq-lead   { font-size: clamp(1.05rem, 1.3vw, 1.25rem); line-height: 1.7; color: rgba(220,228,244,0.82); max-width: 780px; margin: 0; }
  .aq-body   { font-size: clamp(0.95rem, 1.05vw, 1.05rem); line-height: 1.85; color: rgba(200,215,240,0.72); max-width: 720px; margin: 0; }

  /* ── Image ── */
  .aq-img { display: block; width: 100%; max-width: 100%; max-height: 420px; object-fit: cover; border-radius: 10px; border: 1px solid rgba(80,160,255,0.18); margin: 0.6rem 0 0; }
  .aq-img-hero { max-height: 520px; }

  /* ── Layout: cards grid (3-up) ── */
  .aq-l-cards .aq-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 1.6rem; margin-top: 0.6rem; }
  .aq-card { padding: 1.8rem 1.6rem; display: flex; flex-direction: column; gap: 0.6rem; border-radius: 14px; min-height: 200px; }
  .aq-card-num { font-family: 'Syne', sans-serif; font-size: 0.75rem; letter-spacing: 0.18em; color: rgba(120,180,255,0.65); margin: 0 0 0.4rem; }
  .aq-card-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 1.15rem; line-height: 1.3; margin: 0; color: #eaf0fc; }
  .aq-card-desc { font-size: 0.92rem; line-height: 1.7; color: rgba(200,215,240,0.7); margin: 0; }

  /* ── Layout: bento (mixed sizes) ── */
  .aq-l-bento .aq-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); grid-auto-rows: minmax(170px, auto); gap: 1.2rem; margin-top: 0.6rem; }
  .aq-l-bento .aq-card:nth-child(1) { grid-column: span 2; grid-row: span 2; }
  .aq-l-bento .aq-card:nth-child(4) { grid-column: span 2; }

  /* ── Layout: split (text + image) ── */
  .aq-l-split .aq-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: clamp(2rem, 5vw, 4rem); align-items: start; }
  .aq-l-split.aq-split-rev .aq-grid { grid-template-columns: 0.95fr 1.05fr; direction: rtl; }
  .aq-l-split.aq-split-rev .aq-grid > * { direction: ltr; }

  /* ── Layout: numbered manifesto list ── */
  .aq-l-list .aq-list { display: flex; flex-direction: column; margin-top: 0.6rem; }
  .aq-list-item { display: grid; grid-template-columns: 90px 1fr; gap: 1.6rem; align-items: start; padding: 1.4rem 0; border-top: 1px solid rgba(120,180,255,0.18); }
  .aq-list-item:last-child { border-bottom: 1px solid rgba(120,180,255,0.18); }
  .aq-list-num { font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 300; color: #78b4ff; line-height: 1; }
  .aq-list-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 1.2rem; margin: 0 0 0.4rem; color: #eaf0fc; }
  .aq-list-desc { font-size: 0.95rem; line-height: 1.75; color: rgba(200,215,240,0.7); margin: 0; }

  /* ── Layout: pills ── */
  .aq-l-pills .aq-pills { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 0.6rem; }
  .aq-pill { padding: 0.8rem 1.3rem; border: 1px solid rgba(120,180,255,0.35); border-radius: 999px; font-size: 0.9rem; color: #cfd9ea; background: rgba(120,180,255,0.05); }

  /* ── Layout: editorial (2col body) ── */
  .aq-l-editorial .aq-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: clamp(2rem, 4vw, 3.6rem); margin-top: 0.6rem; }
  .aq-side-list { display: flex; flex-direction: column; gap: 0.9rem; padding-left: 1.4rem; border-left: 1px solid rgba(120,180,255,0.22); }
  [dir="rtl"] .aq-side-list { padding-left: 0; padding-right: 1.4rem; border-left: 0; border-right: 1px solid rgba(120,180,255,0.22); }
  .aq-side-list p { margin: 0; font-size: 0.95rem; line-height: 1.7; color: rgba(200,215,240,0.7); }

  /* ── Layout: stats ── */
  .aq-l-stats .aq-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 2rem; margin-top: 0.6rem; }
  .aq-stat { display: flex; flex-direction: column; gap: 0.4rem; }
  .aq-stat-v { font-family: 'Syne', sans-serif; font-size: clamp(2.4rem, 4vw, 3.4rem); font-weight: 600; line-height: 1; color: #78b4ff; }
  .aq-stat-l { font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(200,215,240,0.6); }

  /* ── Layout: process / timeline ── */
  .aq-l-process .aq-steps { display: flex; flex-direction: column; margin-top: 0.6rem; }
  .aq-step { display: grid; grid-template-columns: 130px 1fr; gap: 2rem; align-items: start; padding: 1.6rem 0; border-bottom: 1px solid rgba(120,180,255,0.12); }
  .aq-step-tag { font-family: 'Syne', sans-serif; font-size: 0.85rem; letter-spacing: 0.18em; text-transform: uppercase; color: #78b4ff; }
  .aq-step-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 1.25rem; margin: 0 0 0.4rem; color: #eaf0fc; }
  .aq-step-desc { font-size: 0.95rem; line-height: 1.75; color: rgba(200,215,240,0.65); margin: 0; max-width: 640px; }

  /* ── Layout: compare ── */
  .aq-l-compare .aq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; margin-top: 0.6rem; }
  .aq-compare-card { padding: 1.8rem 1.6rem; border-radius: 14px; display: flex; flex-direction: column; gap: 0.6rem; }
  .aq-compare-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 1.25rem; color: #78b4ff; margin: 0 0 0.4rem; }
  .aq-compare-card p { font-size: 0.95rem; line-height: 1.75; color: rgba(200,215,240,0.72); margin: 0; }

  /* ── Layout: quote ── */
  .aq-l-quote { text-align: center; }
  .aq-quote { font-family: 'Syne', sans-serif; font-style: italic; font-size: clamp(1.5rem, 3vw, 2.4rem); line-height: 1.4; color: #f4f7fc; max-width: 920px; margin: 0 auto; }
  .aq-quote-attr { font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(200,215,240,0.55); margin-top: 1.6rem; }

  /* ── Layout: big number ── */
  .aq-l-big { text-align: center; }
  .aq-big-v { font-family: 'Syne', sans-serif; font-weight: 700; font-size: clamp(5rem, 14vw, 12rem); line-height: 0.95; letter-spacing: -0.04em; color: #78b4ff; margin: 0; }
  .aq-big-l { font-size: clamp(1.1rem, 1.6vw, 1.4rem); color: rgba(220,228,244,0.78); margin-top: 1rem; max-width: 720px; margin-left: auto; margin-right: auto; }

  /* ── CTA / closing ── */
  .aq-cta { text-align: center; padding: clamp(80px, 12vh, 140px) clamp(24px, 6vw, 120px); }
  .aq-cta .aq-title { font-size: clamp(2.4rem, 5vw, 4.2rem); }
  .aq-cta .aq-lead { margin: 1.2rem auto 0; }

  /* ── Surface variants (8) ── */
  .aq-v-clean    .aq-card, .aq-v-clean    .aq-compare-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(120,180,255,0.08); }
  .aq-v-bordered .aq-card, .aq-v-bordered .aq-compare-card { background: transparent; border: 1px solid rgba(120,180,255,0.28); }
  .aq-v-tinted   .aq-card, .aq-v-tinted   .aq-compare-card { background: rgba(120,180,255,0.08); border: 1px solid rgba(120,180,255,0.18); }
  .aq-v-glass    .aq-card, .aq-v-glass    .aq-compare-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(8px); }
  .aq-v-outline  .aq-card, .aq-v-outline  .aq-compare-card { background: transparent; border: 1px dashed rgba(120,180,255,0.4); }
  .aq-v-mono     .aq-card, .aq-v-mono     .aq-compare-card { background: rgba(10,14,23,0.6); border: 1px solid rgba(232,237,245,0.1); }
  .aq-v-gradient .aq-card, .aq-v-gradient .aq-compare-card { background: linear-gradient(140deg, rgba(120,180,255,0.12), rgba(80,200,200,0.04)); border: 1px solid rgba(120,180,255,0.18); }
  .aq-v-noir     .aq-card, .aq-v-noir     .aq-compare-card { background: #060912; border: 1px solid rgba(80,120,180,0.2); }

  /* ── Accents (7) ── */
  .aq-a-top      .aq-card { border-top: 3px solid #78b4ff; }
  .aq-a-left     .aq-card { border-left: 3px solid #78b4ff; }
  .aq-a-corner   .aq-card { position: relative; }
  .aq-a-corner   .aq-card::after { content: ''; position: absolute; top: 0; right: 0; width: 32px; height: 32px; border-top: 2px solid #78b4ff; border-right: 2px solid #78b4ff; }
  .aq-a-underline .aq-card-title { padding-bottom: 0.5rem; border-bottom: 1px solid rgba(120,180,255,0.3); }
  .aq-a-side-bar  .aq-card { border-left: 4px solid #78b4ff; padding-left: 1.4rem; }
  .aq-a-dot       .aq-card-num::before { content: '•'; color: #78b4ff; margin-right: 0.5rem; font-size: 1.3em; }
  .aq-a-num       .aq-card-num { font-size: 1.3rem; color: #78b4ff; }

  /* ── Color tints per slide (7) — adjusts accent color & subtle title hue ── */
  .aq-t-blue    { --aq-acc: #78b4ff; }
  .aq-t-cyan    { --aq-acc: #5ce1e6; }
  .aq-t-teal    { --aq-acc: #4fb8a8; }
  .aq-t-deep    { --aq-acc: #5a8cdc; }
  .aq-t-frost   { --aq-acc: #a8c8f0; }
  .aq-t-glacier { --aq-acc: #9ee0f0; }
  .aq-t-azure   { --aq-acc: #6aa8ff; }
  .aq-section[class*="aq-t-"] .aq-kicker,
  .aq-section[class*="aq-t-"] .aq-list-num,
  .aq-section[class*="aq-t-"] .aq-stat-v,
  .aq-section[class*="aq-t-"] .aq-step-tag,
  .aq-section[class*="aq-t-"] .aq-compare-title,
  .aq-section[class*="aq-t-"] .aq-big-v { color: var(--aq-acc); }
  .aq-section[class*="aq-t-"] .aq-a-top .aq-card { border-top-color: var(--aq-acc); }
  .aq-section[class*="aq-t-"] .aq-a-left .aq-card,
  .aq-section[class*="aq-t-"] .aq-a-side-bar .aq-card { border-left-color: var(--aq-acc); }
  .aq-section[class*="aq-t-"] .aq-a-corner .aq-card::after { border-color: var(--aq-acc); }

  /* ── RTL ── */
  [dir="rtl"] .aq-section, [dir="rtl"] .aq-hero { text-align: right; }
  [dir="rtl"] .aq-l-list .aq-list-item { grid-template-columns: 1fr 90px; direction: rtl; }
  [dir="rtl"] .aq-l-process .aq-step  { grid-template-columns: 1fr 130px; direction: rtl; }

  /* ── Tablet ── */
  @media (max-width: 1024px) {
    .aq-l-cards .aq-grid    { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .aq-l-bento .aq-grid    { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .aq-l-bento .aq-card:nth-child(1) { grid-column: span 2; grid-row: auto; }
    .aq-l-bento .aq-card:nth-child(4) { grid-column: span 2; }
    .aq-l-stats .aq-stats   { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .aq-l-split .aq-grid,
    .aq-l-editorial .aq-grid { grid-template-columns: 1fr; }
    .aq-l-split.aq-split-rev .aq-grid { direction: ltr; }
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .aq-hero, .aq-section, .aq-cta { padding: 60px 22px !important; min-height: auto; }
    .aq-hero { min-height: 80vh; }
    .aq-hero-title { font-size: clamp(2rem, 9vw, 2.8rem) !important; }
    .aq-title { font-size: clamp(1.8rem, 7.5vw, 2.4rem) !important; }
    .aq-l-cards .aq-grid, .aq-l-bento .aq-grid,
    .aq-l-compare .aq-grid { grid-template-columns: 1fr !important; }
    .aq-l-bento .aq-card:nth-child(n) { grid-column: auto; }
    .aq-l-stats .aq-stats { grid-template-columns: 1fr 1fr; gap: 1.4rem; }
    .aq-list-item, .aq-step { grid-template-columns: 60px 1fr; gap: 1rem; padding: 1.1rem 0; }
    [dir="rtl"] .aq-list-item, [dir="rtl"] .aq-step { grid-template-columns: 1fr 60px; }
    .aq-card { padding: 1.4rem; min-height: auto; }
    .aq-img, .aq-img-hero { max-height: 240px; }
    .aq-big-v { font-size: clamp(4rem, 18vw, 6.4rem) !important; }
    .aq-quote { font-size: clamp(1.2rem, 6vw, 1.7rem) !important; }
  }
`;

function renderAquaraWaterDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI
  const canvas = `<canvas id="water-canvas"></canvas>`;

  // 10 base layouts × 8 variants × 7 accents × 7 tints = 3920 unique combos.
  // We constrain to ~500 perceptually-distinct decks by hashing (slide idx + content) into the matrix.
  const BASE_LAYOUTS = ["cards", "bento", "split", "split-rev", "list", "pills", "editorial", "stats", "process", "compare"];
  const VARIANTS = ["clean", "bordered", "tinted", "glass", "outline", "mono", "gradient", "noir"];
  const ACCENTS  = ["top", "left", "corner", "underline", "side-bar", "dot", "num"];
  const TINTS    = ["blue", "cyan", "teal", "deep", "frost", "glacier", "azure"];

  // Deterministic per-slide hash so the same content always picks the same combo.
  const hash = (s: string, salt = 0): number => {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return h >>> 0;
  };

  const sections = slides.map((slide, idx) => {
    const title = esc(slide.title || deck.title || "");
    const body  = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const kicker = esc(slide.kicker || `${num} — ${isAr ? "فصل" : "Chapter"}`);
    const img = slide.image ? `<img class="aq-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = (slide.title || "") + "|" + idx;
    const variant = VARIANTS[hash(seed, 1) % VARIANTS.length];
    const accent  = ACCENTS [hash(seed, 2) % ACCENTS.length];
    const tint    = TINTS   [hash(seed, 3) % TINTS.length];

    // Pick base layout intelligently from the slide's content shape, but rotate within compatible options.
    let layout: string;
    if (idx === 0 || slide.type === "cover") layout = "hero";
    else if (slide.type === "closing") layout = "cta";
    else if (slide.type === "quote" || slide.quote) layout = "quote";
    else if (slide.stats?.length) layout = "stats";
    else if (slide.big_value) layout = "big";
    else if (slide.steps?.length || slide.events?.length) layout = "process";
    else if (slide.left_bullets?.length && slide.right_bullets?.length) layout = "compare";
    else {
      // Rotate among visual layouts for body slides
      const opts = bullets.length >= 4
        ? ["cards", "bento", "list", "editorial", "split", "split-rev", "pills"]
        : bullets.length >= 2
        ? ["split", "split-rev", "list", "editorial", "pills", "cards"]
        : ["split", "split-rev", "editorial"];
      layout = opts[hash(seed, 4) % opts.length];
    }

    const cls = `aq-section aq-l-${layout} aq-v-${variant} aq-a-${accent} aq-t-${tint}${layout === "split-rev" ? " aq-split-rev" : ""}`;

    // ── Hero
    if (layout === "hero") {
      return `<section class="aq-hero aq-t-${tint}">
        <p class="aq-kicker">${kicker}</p>
        <h1 class="aq-hero-title">${title}</h1>
        ${slide.subtitle ? `<p class="aq-hero-sub">${esc(slide.subtitle)}</p>` : ""}
        ${slide.image ? `<img class="aq-img aq-img-hero" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : ""}
      </section>`;
    }

    // ── CTA / closing
    if (layout === "cta") {
      return `<section class="aq-cta aq-t-${tint}">
        <p class="aq-kicker">${kicker}</p>
        <h2 class="aq-title">${title}</h2>
        ${slide.subtitle ? `<p class="aq-lead">${esc(slide.subtitle)}</p>` : body ? `<p class="aq-lead">${body}</p>` : ""}
      </section>`;
    }

    // ── Quote
    if (layout === "quote") {
      return `<section class="${cls} aq-center">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <blockquote class="aq-quote">"${esc(slide.quote || slide.title || "")}"</blockquote>
          ${slide.attribution ? `<div class="aq-quote-attr">— ${esc(slide.attribution)}</div>` : ""}
        </div>
      </section>`;
    }

    // ── Stats
    if (layout === "stats") {
      const stats = (slide.stats || []).slice(0, 4);
      return `<section class="${cls}">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <h2 class="aq-title">${title}</h2>
          ${body ? `<p class="aq-lead">${body}</p>` : ""}
          <div class="aq-stats">${stats.map(s => `<div class="aq-stat"><span class="aq-stat-v">${esc(s.value)}</span><span class="aq-stat-l">${esc(s.label)}</span></div>`).join("")}</div>
          ${img}
        </div>
      </section>`;
    }

    // ── Big value
    if (layout === "big") {
      return `<section class="${cls} aq-center">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <div class="aq-big-v">${esc(slide.big_value || "")}</div>
          <p class="aq-big-l">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="aq-lead" style="margin:1.4rem auto 0">${body}</p>` : ""}
        </div>
      </section>`;
    }

    // ── Process / timeline
    if (layout === "process") {
      const steps = slide.steps?.length
        ? slide.steps.slice(0, 6).map((s, i) => ({ tag: `STEP ${String(i+1).padStart(2,"0")}`, title: s.title, desc: s.desc || "" }))
        : (slide.events || []).slice(0, 6).map(e => ({ tag: e.date, title: e.title, desc: e.desc || "" }));
      return `<section class="${cls}">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <h2 class="aq-title">${title}</h2>
          ${body ? `<p class="aq-lead">${body}</p>` : ""}
          <div class="aq-steps">${steps.map(s => `<div class="aq-step">
            <div class="aq-step-tag">${esc(s.tag)}</div>
            <div><h3 class="aq-step-title">${esc(s.title)}</h3>${s.desc ? `<p class="aq-step-desc">${esc(s.desc)}</p>` : ""}</div>
          </div>`).join("")}</div>
        </div>
      </section>`;
    }

    // ── Compare
    if (layout === "compare") {
      return `<section class="${cls}">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <h2 class="aq-title">${title}</h2>
          ${body ? `<p class="aq-lead">${body}</p>` : ""}
          <div class="aq-grid">
            <div class="aq-compare-card">
              <h3 class="aq-compare-title">${esc(slide.left_title || "A")}</h3>
              ${(slide.left_bullets || []).slice(0,5).map(b => `<p>— ${esc(b)}</p>`).join("")}
            </div>
            <div class="aq-compare-card">
              <h3 class="aq-compare-title">${esc(slide.right_title || "B")}</h3>
              ${(slide.right_bullets || []).slice(0,5).map(b => `<p>— ${esc(b)}</p>`).join("")}
            </div>
          </div>
        </div>
      </section>`;
    }

    // ── Pills
    if (layout === "pills") {
      return `<section class="${cls}">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <h2 class="aq-title">${title}</h2>
          ${body ? `<p class="aq-lead">${body}</p>` : ""}
          ${img}
          <div class="aq-pills">${bullets.slice(0,10).map(b => `<span class="aq-pill">${esc(b)}</span>`).join("")}</div>
        </div>
      </section>`;
    }

    // ── List (numbered manifesto)
    if (layout === "list") {
      return `<section class="${cls}">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <h2 class="aq-title">${title}</h2>
          ${body ? `<p class="aq-lead">${body}</p>` : ""}
          <div class="aq-list">${bullets.slice(0,6).map((b, i) => {
            const [h, d = ""] = b.split(/[:：—-]\s*/, 2);
            return `<div class="aq-list-item">
              <div class="aq-list-num">${String(i+1).padStart(2,"0")}</div>
              <div><h3 class="aq-list-title">${esc(h)}</h3>${d ? `<p class="aq-list-desc">${esc(d)}</p>` : ""}</div>
            </div>`;
          }).join("")}</div>
        </div>
      </section>`;
    }

    // ── Editorial (2-col body + side bullets)
    if (layout === "editorial") {
      return `<section class="${cls}">
        <div class="aq-inner">
          <p class="aq-kicker">${kicker}</p>
          <h2 class="aq-title">${title}</h2>
          <div class="aq-grid">
            <div>${body ? `<p class="aq-body" style="font-size:1.05rem">${body}</p>` : ""}${img}</div>
            <div class="aq-side-list">${bullets.slice(0,6).map(b => `<p>— ${esc(b)}</p>`).join("")}</div>
          </div>
        </div>
      </section>`;
    }

    // ── Split (text + image)
    if (layout === "split" || layout === "split-rev") {
      return `<section class="${cls}">
        <div class="aq-inner">
          <div class="aq-grid">
            <div class="aq-inner">
              <p class="aq-kicker">${kicker}</p>
              <h2 class="aq-title">${title}</h2>
              ${body ? `<p class="aq-body">${body}</p>` : ""}
              ${bullets.length ? `<div class="aq-pills">${bullets.slice(0,5).map(b => `<span class="aq-pill">${esc(b.slice(0, 36))}</span>`).join("")}</div>` : ""}
            </div>
            <div>${img || `<div class="aq-img" style="height:340px;background:linear-gradient(140deg, rgba(120,180,255,0.18), rgba(80,120,180,0.05));"></div>`}</div>
          </div>
        </div>
      </section>`;
    }

    // ── Bento / Cards (default)
    return `<section class="${cls}">
      <div class="aq-inner">
        <p class="aq-kicker">${kicker}</p>
        <h2 class="aq-title">${title}</h2>
        ${body ? `<p class="aq-lead">${body}</p>` : ""}
        ${img}
        <div class="aq-grid">${bullets.slice(0, layout === "bento" ? 5 : 6).map((b, i) => {
          const [h, d = ""] = b.split(/[:：—-]\s*/, 2);
          return `<div class="aq-card">
            <div class="aq-card-num">${String(i+1).padStart(2,"0")}</div>
            <h3 class="aq-card-title">${esc(h)}</h3>
            ${d ? `<p class="aq-card-desc">${esc(d)}</p>` : ""}
          </div>`;
        }).join("")}</div>
      </div>
    </section>`;
  });

  return `${canvas}\n<div class="aq-overlay overlay">\n${sections.join("\n")}\n</div>`;
}

/* ────────────────────────────────────────────────────────── */
/* Landscape as Language renderer                             */
/* ────────────────────────────────────────────────────────── */
const LANDSCAPE_LOCK_CSS = `
  :root {
    --paper: #F5F0E8; --ink: #1a1714; --ink-light: #3a3530;
    --ink-faint: #8a8478; --ink-ghost: #c5bfb4;
    --serif: 'EB Garamond', Georgia, serif;
    --display: 'Playfair Display', Georgia, serif;
    --mono: 'Space Mono', monospace;
  }
  html, body { background: var(--paper) !important; color: var(--ink) !important; font-family: var(--serif); overflow-x: hidden; }
  #canvas-container { position: fixed !important; inset: 0 !important; z-index: 0 !important; }
  #paper-overlay { position: fixed !important; inset: 0 !important; z-index: 1 !important; pointer-events: none; mix-blend-mode: multiply; opacity: 0.28; }
  #loader, #nav-dots, #scroll-spacer { display: none !important; }
  .lds-content { position: relative; z-index: 5; }

  /* ── Tonal palettes (applied per slide via .lds-tone-*) ── */
  .lds-tone-terra  { --lds-acc: 153,76,40;  --lds-soft: 244,229,217; }
  .lds-tone-moss   { --lds-acc: 75,99,53;   --lds-soft: 232,237,221; }
  .lds-tone-sky    { --lds-acc: 56,98,138;  --lds-soft: 222,234,243; }
  .lds-tone-sand   { --lds-acc: 168,134,76; --lds-soft: 244,234,212; }
  .lds-tone-plum   { --lds-acc: 110,55,90;  --lds-soft: 237,224,232; }
  .lds-tone-slate  { --lds-acc: 60,72,82;   --lds-soft: 224,229,233; }
  .lds-tone-ochre  { --lds-acc: 184,128,46; --lds-soft: 247,235,210; }

  /* ── Slide frame ── */
  .lds-slide { min-height: auto; display: flex; align-items: center; padding: clamp(56px, 9vh, 120px) clamp(20px, 6vw, 90px); position: relative; }
  .lds-slide.lds-cover { min-height: 92vh; justify-content: center; text-align: center; flex-direction: column; }
  .lds-inner { max-width: 1180px; width: 100%; margin: 0 auto; }
  .lds-cover .lds-inner { max-width: 980px; text-align: center; }
  .lds-slide.lds-align-left  .lds-inner { margin-left: 6%; margin-right: auto; }
  .lds-slide.lds-align-right .lds-inner { margin-left: auto; margin-right: 6%; }
  .lds-cover .lds-inner { margin: 0 auto !important; }

  /* ── Surface variants ── */
  .lds-surf-clean   { background: rgba(245,240,232,0.82); backdrop-filter: blur(8px); }
  .lds-surf-frost   { background: rgba(255,253,247,0.6); backdrop-filter: blur(14px); border: 1px solid rgba(26,23,20,0.08); }
  .lds-surf-border  { background: rgba(255,253,247,0.92); border: 1.5px solid rgba(26,23,20,0.85); }
  .lds-surf-tint    { background: rgba(var(--lds-soft), 0.88); backdrop-filter: blur(8px); }
  .lds-surf-glass   { background: rgba(255,253,247,0.4); backdrop-filter: blur(18px) saturate(130%); border: 1px solid rgba(255,253,247,0.6); }
  .lds-surf-ink     { background: #1a1714; color: #f5f0e8; }
  .lds-surf-ink *   { color: inherit !important; }
  .lds-surf-grad    { background: linear-gradient(135deg, rgba(255,253,247,0.95), rgba(var(--lds-soft),0.78)); border: 1px solid rgba(26,23,20,0.06); }
  .lds-surf-paper   { background: rgba(255,253,247,0.92); border-top: 4px solid rgba(var(--lds-acc),1); }

  /* ── Accent decorations ── */
  .lds-acc-top    { box-shadow: inset 0 3px 0 0 rgba(var(--lds-acc),0.9); }
  .lds-acc-left   { box-shadow: inset 3px 0 0 0 rgba(var(--lds-acc),0.9); }
  .lds-acc-corner { position: relative; }
  .lds-acc-corner::before { content:""; position:absolute; top:0; right:0; width:44px; height:44px; background: rgba(var(--lds-acc),0.9); clip-path: polygon(100% 0, 100% 100%, 0 0); }
  .lds-acc-underline .lds-card-t, .lds-acc-underline .lds-step-t { box-shadow: 0 2px 0 0 rgba(var(--lds-acc),0.85); display: inline-block; padding-bottom: 2px; }
  .lds-acc-dot::before { content:""; display:inline-block; width:9px; height:9px; border-radius:50%; background: rgba(var(--lds-acc),1); margin-right:10px; vertical-align: middle; }
  .lds-acc-bar { border-left: 3px solid rgba(var(--lds-acc),0.85); padding-left: 16px; }
  .lds-acc-num .lds-card-n, .lds-acc-num .lds-step-n { color: rgba(var(--lds-acc),1) !important; }

  /* ── Typography ── */
  .lds-label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 22px; display: inline-block; }
  .lds-title { font-family: var(--display); font-weight: 400; font-size: clamp(34px, 5.5vw, 78px); line-height: 1.08; letter-spacing: -0.025em; color: var(--ink); margin-bottom: 26px; overflow-wrap: anywhere; }
  .lds-title em { font-style: italic; }
  .lds-cover .lds-title { font-size: clamp(48px, 8.4vw, 124px); margin-bottom: 18px; }
  .lds-sub { font-family: var(--serif); font-style: italic; font-size: clamp(14px, 1.9vw, 20px); color: var(--ink-faint); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 20px; }
  .lds-body { font-family: var(--serif); font-size: clamp(16px, 1.55vw, 19px); line-height: 1.8; color: var(--ink-light); margin-bottom: 16px; max-width: 680px; }
  .lds-cta, .lds-ctas { display: none !important; }

  /* ── Lists / bullets ── */
  .lds-bullets { list-style: none; padding: 0; margin: 1.4rem 0; }
  .lds-bullets li { font-family: var(--serif); font-size: clamp(15px, 1.4vw, 18px); line-height: 1.7; color: var(--ink-light); padding: 14px 0 14px 42px; border-top: 1px solid var(--ink-ghost); position: relative; }
  .lds-bullets li:last-child { border-bottom: 1px solid var(--ink-ghost); }
  .lds-bullets li::before { content: attr(data-n); position: absolute; left: 0; top: 14px; font-family: var(--display); font-style: italic; color: var(--ink-ghost); font-size: 18px; }

  .lds-pills { display: flex; flex-wrap: wrap; gap: 10px; margin: 1.4rem 0; }
  .lds-pill { font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; border: 1px solid var(--ink-ghost); padding: 9px 16px; color: var(--ink-light); border-radius: 999px; }

  /* ── Stats ── */
  .lds-stats { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 40px; margin-top: 36px; }
  .lds-stat-v { font-family: var(--display); font-style: italic; font-size: clamp(40px, 6vw, 80px); line-height: 1; color: var(--ink); }
  .lds-stat-l { font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); margin-top: 10px; }

  /* ── Steps / Timeline ── */
  .lds-steps { display: flex; flex-direction: column; margin: 1.6rem 0; }
  .lds-step { display: flex; gap: 28px; padding: 22px 0; border-bottom: 1px solid var(--ink-ghost); }
  .lds-step:first-child { border-top: 1px solid var(--ink-ghost); }
  .lds-step-n { font-family: var(--display); font-style: italic; font-size: 36px; color: var(--ink-ghost); line-height: 1; min-width: 60px; }
  .lds-step-t { font-family: var(--display); font-size: 22px; font-weight: 600; margin-bottom: 6px; color: var(--ink); }
  .lds-step-d { font-family: var(--serif); font-size: 15px; line-height: 1.7; color: var(--ink-faint); }

  /* ── Cards / Grids ── */
  .lds-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 20px; margin-top: 28px; }
  .lds-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; margin-top: 28px; }
  .lds-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; margin-top: 28px; }
  .lds-bento  { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(120px, auto); gap: 16px; margin-top: 28px; }
  .lds-masonry { columns: 2; column-gap: 18px; margin-top: 28px; }
  .lds-masonry > * { break-inside: avoid; margin-bottom: 18px; display: block; }
  .lds-card { padding: clamp(20px, 2vw, 28px); border-radius: 4px; position: relative; }
  .lds-card-n { font-family: var(--display); font-style: italic; font-size: 24px; color: var(--ink-faint); margin-bottom: 10px; display: block; }
  .lds-card-t { font-family: var(--display); font-size: clamp(17px, 1.7vw, 22px); font-weight: 600; line-height: 1.25; margin-bottom: 10px; color: var(--ink); }
  .lds-card-d { font-family: var(--serif); font-size: 15px; line-height: 1.7; color: var(--ink-light); }
  .lds-bento .lds-card.b-wide  { grid-column: span 4; }
  .lds-bento .lds-card.b-half  { grid-column: span 3; }
  .lds-bento .lds-card.b-third { grid-column: span 2; }
  .lds-bento .lds-card.b-tall  { grid-row: span 2; }

  /* ── Compare ── */
  .lds-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; margin-top: 1.4rem; }
  .lds-compare-col { padding: 28px; }
  .lds-compare h3 { font-family: var(--display); font-style: italic; font-size: 26px; margin-bottom: 16px; color: var(--ink); }
  .lds-compare p { font-family: var(--serif); font-size: 16px; line-height: 1.75; color: var(--ink-light); padding: 8px 0; border-top: 1px solid var(--ink-ghost); }

  /* ── Quote / Big / Manifesto / Editorial ── */
  .lds-quote { font-family: var(--display); font-style: italic; font-size: clamp(24px, 3.4vw, 48px); line-height: 1.28; color: var(--ink); max-width: 880px; margin: 0 auto; text-align: center; }
  .lds-quote::before { content: '“'; font-size: 1.8em; color: var(--ink-ghost); display: block; line-height: 0.4; margin-bottom: 16px; }
  .lds-attr { font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); margin-top: 30px; text-align: center; }
  .lds-big { font-family: var(--display); font-style: italic; font-size: clamp(80px, 15vw, 220px); line-height: 0.95; color: var(--ink); text-align: center; letter-spacing: -0.04em; }
  .lds-manifesto { display: flex; flex-direction: column; gap: 0; margin-top: 1.4rem; }
  .lds-mrow { display: grid; grid-template-columns: 80px 1fr; gap: 28px; padding: 26px 0; border-top: 1px solid var(--ink-ghost); align-items: baseline; }
  .lds-mrow:last-child { border-bottom: 1px solid var(--ink-ghost); }
  .lds-mrow-n { font-family: var(--display); font-style: italic; font-size: 28px; color: rgba(var(--lds-acc),0.85); }
  .lds-mrow-t { font-family: var(--display); font-size: clamp(20px, 2vw, 26px); font-weight: 600; color: var(--ink); }
  .lds-mrow-d { font-family: var(--serif); font-size: 15px; color: var(--ink-faint); margin-top: 8px; line-height: 1.7; }
  .lds-editorial { display: grid; grid-template-columns: 1fr 1.4fr; gap: 56px; align-items: start; }
  .lds-edcol-l h2 { font-family: var(--display); font-style: italic; font-size: clamp(28px, 3.4vw, 44px); line-height: 1.1; color: var(--ink); margin-bottom: 18px; }
  .lds-edcol-r p { font-family: var(--serif); font-size: 16px; line-height: 1.85; color: var(--ink-light); margin-bottom: 16px; }

  /* ── Image ── */
  .lds-img { display: block; width: 100%; max-width: 720px; max-height: 380px; object-fit: cover; margin: 1.6rem 0; filter: grayscale(0.45) sepia(0.08); border: 1px solid var(--ink-ghost); }

  /* ── RTL ── */
  [dir="rtl"] .lds-slide.lds-align-left  .lds-inner { margin-left: auto; margin-right: 6%; text-align: right; }
  [dir="rtl"] .lds-slide.lds-align-right .lds-inner { margin-left: 6%; margin-right: auto; text-align: right; }
  [dir="rtl"] .lds-bullets li { padding: 14px 42px 14px 0; }
  [dir="rtl"] .lds-bullets li::before { left: auto; right: 0; }
  [dir="rtl"] .lds-acc-corner::before { right: auto; left: 0; clip-path: polygon(0 0, 0 100%, 100% 0); }
  [dir="rtl"] .lds-acc-bar { border-left: none; border-right: 3px solid rgba(var(--lds-acc),0.85); padding-left: 0; padding-right: 16px; }
  [dir="rtl"] .lds-mrow { grid-template-columns: 1fr 80px; }
  [dir="rtl"] .lds-editorial { grid-template-columns: 1.4fr 1fr; }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .lds-bento { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .lds-bento .lds-card.b-wide, .lds-bento .lds-card.b-half { grid-column: span 3; }
    .lds-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .lds-editorial { grid-template-columns: 1fr; gap: 32px; }
  }
  @media (max-width: 640px) {
    .lds-slide { padding: 48px 18px; }
    .lds-slide.lds-cover { min-height: 70vh; }
    .lds-title { font-size: 32px !important; }
    .lds-cover .lds-title { font-size: 44px !important; }
    .lds-quote { font-size: 22px !important; }
    .lds-big { font-size: 72px !important; }
    .lds-slide .lds-inner { margin: 0 !important; max-width: 100%; }
    .lds-compare, .lds-grid-2, .lds-grid-3, .lds-masonry { grid-template-columns: 1fr !important; columns: 1 !important; gap: 24px; }
    .lds-stats { gap: 28px; }
    .lds-img { max-height: 220px; }
    .lds-mrow { grid-template-columns: 56px 1fr; gap: 16px; }
  }
`;

const LDS_SURFACES = ["clean","frost","border","tint","glass","ink","grad","paper"] as const;
const LDS_ACCENTS  = ["top","left","corner","underline","dot","bar","num"] as const;
const LDS_TONES    = ["terra","moss","sky","sand","plum","slate","ochre"] as const;
const LDS_LAYOUTS  = ["bento","masonry","grid3","grid4","grid2","steps","manifesto","editorial","split","timeline","pills","bullets","stack","compact"] as const;
const LDS_ALIGNS   = ["left","right","center"] as const;

function ldsHash(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function renderLandscapeLanguageDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const overlays = `<div id="paper-overlay"></div><div id="canvas-container"></div>`;

  const titleEm = (raw: string): string => {
    const safe = esc(raw);
    const words = safe.split(/\s+/);
    if (words.length < 2) return `<em>${safe}</em>`;
    const last = words.pop();
    return `${words.join(" ")} <em>${last}</em>`;
  };

  const sections = slides.map((slide, idx) => {
    const title = slide.title || deck.title || "";
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `${num} — ${isAr ? "فصل" : "Chapter"}`);
    const img = slide.image ? `<img class="lds-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    // Combinatorial seed
    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const surface = LDS_SURFACES[ldsHash(seed, 1) % LDS_SURFACES.length];
    const accent  = LDS_ACCENTS [ldsHash(seed, 2) % LDS_ACCENTS.length];
    const tone    = LDS_TONES   [ldsHash(seed, 3) % LDS_TONES.length];
    const layoutPick = LDS_LAYOUTS[ldsHash(seed, 4) % LDS_LAYOUTS.length];
    const align   = LDS_ALIGNS  [ldsHash(seed, 5) % LDS_ALIGNS.length];

    const slideCls = `lds-slide lds-tone-${tone} lds-align-${align}`;
    const innerCls = `lds-inner lds-surf-${surface} lds-acc-${accent}`;
    const wrap = (inner: string, extra = "") =>
      `<section class="${slideCls} ${extra}"><div class="${innerCls}" style="padding: clamp(28px, 3vw, 48px); border-radius: 4px;">${inner}</div></section>`;

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<section class="${slideCls} lds-cover"><div class="lds-inner">
        <h1 class="lds-title">${titleEm(title)}</h1>
        ${slide.subtitle ? `<div class="lds-sub">${esc(slide.subtitle)}</div>` : ""}
      </div></section>`;
    }

    if (slide.type === "closing") {
      return `<section class="${slideCls} lds-cover"><div class="lds-inner">
        <span class="lds-label">${label}</span>
        <h2 class="lds-title">${titleEm(title)}</h2>
        ${slide.subtitle ? `<div class="lds-sub">${esc(slide.subtitle)}</div>` : body ? `<p class="lds-body" style="margin:0 auto 18px">${body}</p>` : ""}
      </div></section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<section class="${slideCls} lds-cover"><div class="lds-inner">
        <p class="lds-quote">${esc(slide.quote || title)}</p>
        ${slide.attribution ? `<div class="lds-attr">— ${esc(slide.attribution)}</div>` : ""}
      </div></section>`;
    }

    if (slide.big_value) {
      return `<section class="${slideCls} lds-cover"><div class="lds-inner">
        <span class="lds-label">${label}</span>
        <div class="lds-big">${esc(slide.big_value)}</div>
        <p class="lds-body" style="margin:24px auto 0;text-align:center">${esc(slide.big_label || title)}</p>
        ${body ? `<p class="lds-body" style="margin:16px auto 0;text-align:center">${body}</p>` : ""}
      </div></section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return wrap(`
        <span class="lds-label">${label}</span>
        <h2 class="lds-title">${titleEm(title)}</h2>
        ${body ? `<p class="lds-body">${body}</p>` : ""}
        ${img}
        <div class="lds-stats">${stats.map(s => `<div><div class="lds-stat-v">${esc(s.value)}</div><div class="lds-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      const useManifesto = layoutPick === "manifesto";
      if (useManifesto) {
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <div class="lds-manifesto">${steps.map((s,i) => `<div class="lds-mrow"><div class="lds-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="lds-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="lds-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <span class="lds-label">${label}</span>
        <h2 class="lds-title">${titleEm(title)}</h2>
        ${body ? `<p class="lds-body">${body}</p>` : ""}
        <div class="lds-steps">${steps.map((s,i) => `<div class="lds-step"><span class="lds-step-n">${String(i+1)}</span><div><div class="lds-step-t">${esc(s.title)}</div>${s.desc ? `<div class="lds-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return wrap(`
        <span class="lds-label">${label}</span>
        <h2 class="lds-title">${titleEm(title)}</h2>
        <div class="lds-steps">${events.map(e => `<div class="lds-step"><span class="lds-step-n" style="font-size:18px;min-width:90px">${esc(e.date)}</span><div><div class="lds-step-t">${esc(e.title)}</div>${e.desc ? `<div class="lds-step-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return wrap(`
        <span class="lds-label">${label}</span>
        <h2 class="lds-title">${titleEm(title)}</h2>
        <div class="lds-compare">
          <div class="lds-compare-col"><h3>${esc(slide.left_title || "A")}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div class="lds-compare-col"><h3>${esc(slide.right_title || "B")}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    // Bullets-driven layouts: pick from combinatorial set
    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:—–-]\s+/);
        const t = parts[0];
        const d = parts.slice(1).join(" — ");
        return { t, d, n: String(i + 1).padStart(2, "0") };
      });

      if (layoutPick === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <div class="lds-bento">${cards.map((c,i) => `<div class="lds-card ${spans[i % spans.length]}"><span class="lds-card-n">${c.n}</span><div class="lds-card-t">${esc(c.t)}</div>${c.d ? `<div class="lds-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layoutPick === "masonry") {
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <div class="lds-masonry">${cards.map(c => `<div class="lds-card"><span class="lds-card-n">${c.n}</span><div class="lds-card-t">${esc(c.t)}</div>${c.d ? `<div class="lds-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layoutPick === "grid3" || layoutPick === "grid4" || layoutPick === "grid2") {
        const gcls = layoutPick === "grid4" ? "lds-grid-4" : layoutPick === "grid2" ? "lds-grid-2" : "lds-grid-3";
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <div class="${gcls}">${cards.map(c => `<div class="lds-card"><span class="lds-card-n">${c.n}</span><div class="lds-card-t">${esc(c.t)}</div>${c.d ? `<div class="lds-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layoutPick === "steps" || layoutPick === "timeline") {
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <div class="lds-steps">${cards.map(c => `<div class="lds-step"><span class="lds-step-n">${c.n}</span><div><div class="lds-step-t">${esc(c.t)}</div>${c.d ? `<div class="lds-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layoutPick === "manifesto") {
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <div class="lds-manifesto">${cards.map(c => `<div class="lds-mrow"><div class="lds-mrow-n">${c.n}</div><div><div class="lds-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="lds-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layoutPick === "editorial" || layoutPick === "split") {
        return wrap(`
          <span class="lds-label">${label}</span>
          <div class="lds-editorial">
            <div class="lds-edcol-l"><h2>${titleEm(title)}</h2>${img}</div>
            <div class="lds-edcol-r">${body ? `<p>${body}</p>` : ""}${cards.map(c => `<p><strong style="font-family:var(--display);font-style:italic;">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div>
          </div>
        `);
      }
      if (layoutPick === "pills") {
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <div class="lds-pills">${cards.map(c => `<span class="lds-pill">${esc(c.t)}</span>`).join("")}</div>
        `);
      }
      if (layoutPick === "compact") {
        return wrap(`
          <span class="lds-label">${label}</span>
          <h2 class="lds-title">${titleEm(title)}</h2>
          ${body ? `<p class="lds-body">${body}</p>` : ""}
          <ol class="lds-bullets">${cards.map(c => `<li data-n="${c.n}"><strong style="font-family:var(--display);font-style:italic;color:var(--ink);">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</li>`).join("")}</ol>
        `);
      }
      // default 'bullets' / 'stack'
      return wrap(`
        <span class="lds-label">${label}</span>
        <h2 class="lds-title">${titleEm(title)}</h2>
        ${body ? `<p class="lds-body">${body}</p>` : ""}
        ${img}
        <ol class="lds-bullets">${cards.map(c => `<li data-n="${c.n}">${esc(c.t)}${c.d ? ` — ${esc(c.d)}` : ""}</li>`).join("")}</ol>
      `);
    }

    // No bullets — plain editorial card
    return wrap(`
      <span class="lds-label">${label}</span>
      <h2 class="lds-title">${titleEm(title)}</h2>
      ${body ? `<p class="lds-body">${body}</p>` : ""}
      ${img}
    `);
  });

  const fixupScript = `<script>(function(){
    function fix(){ var sp = document.getElementById('scroll-spacer'); if (sp) sp.style.display='none'; }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fix); else fix();
  })();</script>`;

  return `${overlays}\n<div class="lds-content">\n${sections.join("\n")}\n</div>\n${fixupScript}`;
}

/* ────────────────────────────────────────────────────────── */
/* Valence — Molecular Blobs renderer                         */
/* ────────────────────────────────────────────────────────── */
const VALENCE_LOCK_CSS = `
  html, body { background: #d4d4d8 !important; color: #0a0a0a !important; font-family: 'Inter', system-ui, sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > div:not(.vlc-content):not([data-vlc]) { display: none !important; }
  body > canvas { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 0 !important; pointer-events: none; }
  .vlc-content { position: relative; z-index: 20; }

  /* ───── Tonal tint variables (applied per slide via .vlc-tint-*) ───── */
  .vlc-tint-neutral { --vlc-accent: 10,10,10; --vlc-soft: 245,245,245; }
  .vlc-tint-indigo  { --vlc-accent: 67,56,202; --vlc-soft: 238,242,255; }
  .vlc-tint-lime    { --vlc-accent: 77,124,15; --vlc-soft: 247,254,231; }
  .vlc-tint-rose    { --vlc-accent: 190,18,60; --vlc-soft: 255,241,242; }
  .vlc-tint-amber   { --vlc-accent: 180,83,9; --vlc-soft: 254,243,199; }
  .vlc-tint-cyan    { --vlc-accent: 14,116,144; --vlc-soft: 236,254,255; }
  .vlc-tint-plum    { --vlc-accent: 107,33,168; --vlc-soft: 250,245,255; }
  .vlc-tint-forest  { --vlc-accent: 21,94,72; --vlc-soft: 236,253,245; }

  /* ───── Slide frame ───── */
  .vlc-slide { min-height: auto; display: flex; align-items: center; padding: clamp(56px, 9vh, 120px) clamp(20px, 5.5vw, 80px); position: relative; }
  .vlc-cover { min-height: 92vh; justify-content: center; text-align: center; flex-direction: column; }
  .vlc-inner { max-width: 1180px; width: 100%; margin: 0 auto; }
  .vlc-cover .vlc-inner { max-width: 1020px; text-align: center; }

  /* Surface variants (cards/sections) */
  .vlc-surf-clean    { background: rgba(255,255,255,0.85); backdrop-filter: blur(10px); }
  .vlc-surf-frost    { background: rgba(255,255,255,0.55); backdrop-filter: blur(14px); border: 1px solid rgba(0,0,0,0.08); }
  .vlc-surf-border   { background: rgba(255,255,255,0.9); border: 1.5px solid rgba(0,0,0,0.85); }
  .vlc-surf-tint     { background: rgba(var(--vlc-soft), 0.85); backdrop-filter: blur(8px); }
  .vlc-surf-glass    { background: rgba(255,255,255,0.35); backdrop-filter: blur(18px) saturate(140%); border: 1px solid rgba(255,255,255,0.6); }
  .vlc-surf-mono     { background: #0a0a0a; color: #fafafa; }
  .vlc-surf-mono *   { color: inherit; }
  .vlc-surf-grad     { background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(var(--vlc-soft),0.8)); border: 1px solid rgba(0,0,0,0.06); }
  .vlc-surf-ink      { background: rgba(255,255,255,0.92); border-top: 4px solid rgba(var(--vlc-accent),1); }

  /* Accent decorations */
  .vlc-acc-top    { box-shadow: inset 0 3px 0 0 rgba(var(--vlc-accent),0.9); }
  .vlc-acc-left   { box-shadow: inset 3px 0 0 0 rgba(var(--vlc-accent),0.9); }
  .vlc-acc-corner { position: relative; }
  .vlc-acc-corner::before { content:""; position:absolute; top:0; right:0; width:42px; height:42px; background: rgba(var(--vlc-accent),0.9); clip-path: polygon(100% 0, 100% 100%, 0 0); }
  .vlc-acc-underline .vlc-card-t, .vlc-acc-underline .vlc-step-t { box-shadow: 0 2px 0 0 rgba(var(--vlc-accent),0.85); display: inline-block; }
  .vlc-acc-dot::before { content:""; display:inline-block; width:10px; height:10px; border-radius:50%; background: rgba(var(--vlc-accent),1); margin-right:10px; vertical-align: middle; }
  .vlc-acc-bar { border-left: 3px solid rgba(var(--vlc-accent),0.85); padding-left: 14px; }
  .vlc-acc-num .vlc-card-n, .vlc-acc-num .vlc-step-n { color: rgba(var(--vlc-accent),1) !important; }

  /* Typography */
  .vlc-label { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(0,0,0,0.5); margin-bottom: 22px; display: inline-block; font-weight: 600; }
  .vlc-title { font-family: 'Inter', sans-serif; font-weight: 900; font-size: clamp(38px, 6vw, 84px); line-height: 1.02; letter-spacing: -0.04em; color: #000; margin-bottom: 24px; overflow-wrap: anywhere; }
  .vlc-cover .vlc-title { font-size: clamp(48px, 8.5vw, 124px); }
  .vlc-sub { font-size: clamp(15px, 1.55vw, 19px); line-height: 1.65; color: rgba(0,0,0,0.62); max-width: 620px; margin-bottom: 24px; }
  .vlc-cover .vlc-sub { margin: 0 auto 24px; text-align: center; }
  .vlc-body { font-size: clamp(15px, 1.45vw, 17.5px); line-height: 1.8; color: rgba(0,0,0,0.68); max-width: 720px; margin-bottom: 18px; }
  .vlc-ctas, .vlc-cta-p { display: none !important; }

  /* Stats */
  .vlc-stats-bar { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); border-top: 1px solid rgba(0,0,0,0.12); padding: 30px 5vw; background: rgba(255,255,255,0.55); backdrop-filter: blur(6px); margin-top: 4vh; }
  .vlc-stat { text-align: center; padding: 8px 16px; border-right: 1px solid rgba(0,0,0,0.08); }
  .vlc-stat:last-child { border-right: none; }
  .vlc-stat-v { font-weight: 800; font-size: clamp(28px, 3.4vw, 44px); letter-spacing: -0.03em; color: #000; line-height: 1; }
  .vlc-stat-l { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(0,0,0,0.5); margin-top: 8px; }

  /* Generic grids */
  .vlc-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; margin-top: 28px; }
  .vlc-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; margin-top: 28px; }
  .vlc-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-top: 28px; }
  .vlc-bento  { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(120px, auto); gap: 14px; margin-top: 28px; }
  .vlc-bento > *:nth-child(1) { grid-column: span 4; grid-row: span 2; }
  .vlc-bento > *:nth-child(2) { grid-column: span 2; }
  .vlc-bento > *:nth-child(3) { grid-column: span 2; }
  .vlc-bento > *:nth-child(4) { grid-column: span 3; }
  .vlc-bento > *:nth-child(5) { grid-column: span 3; }
  .vlc-bento > *:nth-child(6) { grid-column: span 2; }
  .vlc-masonry { columns: 3 240px; column-gap: 16px; margin-top: 28px; }
  .vlc-masonry > * { break-inside: avoid; margin-bottom: 16px; display: block; }

  .vlc-card { padding: 26px 24px; border-radius: 2px; }
  .vlc-card-n { font-size: 10px; letter-spacing: 0.18em; color: rgba(0,0,0,0.4); margin-bottom: 12px; font-weight: 700; }
  .vlc-card-t { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #000; margin-bottom: 10px; line-height: 1.3; }
  .vlc-card-d { font-size: 13px; line-height: 1.7; color: rgba(0,0,0,0.6); }

  /* Quote / big */
  .vlc-quote { font-family: 'Inter', sans-serif; font-weight: 600; font-size: clamp(24px, 3.2vw, 44px); line-height: 1.25; letter-spacing: -0.025em; color: #000; max-width: 940px; margin: 0 auto; text-align: center; }
  .vlc-attr { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(0,0,0,0.5); margin-top: 26px; text-align: center; }
  .vlc-big { font-weight: 900; font-size: clamp(96px, 16vw, 240px); line-height: 0.92; letter-spacing: -0.06em; color: #000; text-align: center; }

  /* List layouts */
  .vlc-steps { display: flex; flex-direction: column; margin-top: 28px; }
  .vlc-step  { display: grid; grid-template-columns: 60px 1fr; gap: 24px; padding: 20px 0; border-bottom: 1px solid rgba(0,0,0,0.1); align-items: start; }
  .vlc-step:first-child { border-top: 1px solid rgba(0,0,0,0.1); }
  .vlc-step-n { font-weight: 800; font-size: 24px; color: rgba(0,0,0,0.28); line-height: 1; letter-spacing: -0.02em; }
  .vlc-step-t { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: #000; }
  .vlc-step-d { font-size: 13.5px; line-height: 1.7; color: rgba(0,0,0,0.58); }

  /* Manifesto rows */
  .vlc-mani { margin-top: 28px; }
  .vlc-mani-row { display: grid; grid-template-columns: 90px 1fr; gap: 24px; padding: 22px 0; border-bottom: 1px dashed rgba(0,0,0,0.18); }
  .vlc-mani-k { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(0,0,0,0.45); font-weight: 700; }
  .vlc-mani-t { font-size: 18px; font-weight: 700; color: #000; margin-bottom: 6px; }
  .vlc-mani-d { font-size: 13.5px; line-height: 1.7; color: rgba(0,0,0,0.6); }

  /* Pills */
  .vlc-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
  .vlc-pill  { padding: 12px 20px; border: 1.5px solid #000; font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em; color: #000; background: rgba(255,255,255,0.55); border-radius: 999px; }
  .vlc-pill-sq { border-radius: 0; }
  .vlc-pill-dot::before { content:""; display:inline-block; width:6px; height:6px; border-radius:50%; background: rgba(var(--vlc-accent),1); margin-right: 8px; vertical-align: middle; }

  /* Split / editorial */
  .vlc-split { display: grid; grid-template-columns: 1fr 1.15fr; gap: clamp(28px, 4vw, 64px); align-items: start; margin-top: 6px; }
  .vlc-split-rev { grid-template-columns: 1.15fr 1fr; }
  .vlc-edit-list { border-top: 1px solid rgba(0,0,0,0.12); }
  .vlc-edit-item { padding: 20px 0; border-bottom: 1px solid rgba(0,0,0,0.12); }
  .vlc-edit-k { font-weight: 800; font-size: 11px; letter-spacing: 0.16em; color: #888; margin-bottom: 8px; }
  .vlc-edit-t { font-size: 17px; font-weight: 700; color: #000; margin-bottom: 6px; }
  .vlc-edit-d { font-size: 13.5px; line-height: 1.7; color: rgba(0,0,0,0.6); }

  /* Callouts (mixed framed boxes) */
  .vlc-call { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 14px; margin-top: 28px; }
  .vlc-call-box { padding: 22px; border: 1px solid rgba(0,0,0,0.14); position: relative; }
  .vlc-call-box .vlc-card-n { color: rgba(var(--vlc-accent),1); }

  /* Timeline horizontal */
  .vlc-tl { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 18px; margin-top: 32px; position: relative; }
  .vlc-tl::before { content:""; position:absolute; left:8px; right:8px; top: 16px; height: 1px; background: rgba(0,0,0,0.15); }
  .vlc-tl-item { position: relative; padding-top: 32px; }
  .vlc-tl-item::before { content:""; position:absolute; left: 0; top: 11px; width: 12px; height: 12px; background: rgba(var(--vlc-accent),1); border-radius: 50%; border: 2px solid #fff; }
  .vlc-tl-k { font-weight: 800; font-size: 11px; letter-spacing: 0.14em; color: #000; margin-bottom: 8px; }
  .vlc-tl-t { font-size: 14.5px; font-weight: 700; color: #000; margin-bottom: 6px; }
  .vlc-tl-d { font-size: 12.5px; line-height: 1.65; color: rgba(0,0,0,0.6); }

  /* Compare */
  .vlc-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(0,0,0,0.1); margin-top: 28px; }
  .vlc-compare > div { background: rgba(255,255,255,0.85); backdrop-filter: blur(8px); padding: 30px 26px; }
  .vlc-compare h3 { font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px; color: #000; }
  .vlc-compare p { font-size: 13.5px; line-height: 1.7; color: rgba(0,0,0,0.6); padding: 8px 0; border-top: 1px solid rgba(0,0,0,0.08); }

  /* Image */
  .vlc-img { display: block; width: 100%; max-width: 920px; max-height: 380px; object-fit: cover; border-radius: 2px; margin: 28px 0; }
  .vlc-img-wide { max-width: 100%; max-height: 460px; }

  /* RTL */
  [dir="rtl"] .vlc-body, [dir="rtl"] .vlc-card-d, [dir="rtl"] .vlc-step-d, [dir="rtl"] .vlc-mani-d, [dir="rtl"] .vlc-edit-d, [dir="rtl"] .vlc-tl-d { text-align: right; }
  [dir="rtl"] .vlc-step, [dir="rtl"] .vlc-mani-row { direction: rtl; }
  [dir="rtl"] .vlc-acc-left { box-shadow: inset -3px 0 0 0 rgba(var(--vlc-accent),0.9); }
  [dir="rtl"] .vlc-acc-corner::before { left: 0; right: auto; clip-path: polygon(0 0, 0 100%, 100% 0); }

  /* Responsive */
  @media (max-width: 1024px) {
    .vlc-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .vlc-grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .vlc-bento  { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .vlc-bento > * { grid-column: span 1 !important; grid-row: span 1 !important; }
    .vlc-split, .vlc-split-rev { grid-template-columns: 1fr; }
    .vlc-masonry { columns: 2 200px; }
  }
  @media (max-width: 640px) {
    .vlc-slide { padding: 48px 18px; }
    .vlc-cover { min-height: 78vh; }
    .vlc-title { font-size: clamp(28px, 8vw, 40px) !important; }
    .vlc-cover .vlc-title { font-size: clamp(36px, 10vw, 52px) !important; }
    .vlc-big { font-size: clamp(64px, 22vw, 96px) !important; }
    .vlc-quote { font-size: clamp(20px, 5.5vw, 26px) !important; }
    .vlc-grid-2, .vlc-grid-3, .vlc-grid-4 { grid-template-columns: 1fr; }
    .vlc-bento { grid-template-columns: 1fr; }
    .vlc-masonry { columns: 1; }
    .vlc-compare { grid-template-columns: 1fr; }
    .vlc-stats-bar { padding: 22px 16px; grid-template-columns: repeat(2, 1fr); }
    .vlc-stat { border-right: none; border-bottom: 1px solid rgba(0,0,0,0.06); padding: 14px 8px; }
    .vlc-img { max-height: 240px; margin: 20px 0; }
    .vlc-step { grid-template-columns: 44px 1fr; gap: 14px; }
    .vlc-mani-row { grid-template-columns: 64px 1fr; gap: 14px; }
    .vlc-tl { grid-template-columns: 1fr; }
    .vlc-tl::before { display: none; }
  }
`;

function renderValenceBlobsDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  // Deterministic combinatorial design system → thousands of unique slide looks.
  const SURFACES = ["clean", "frost", "border", "tint", "glass", "grad", "ink", "mono"];
  const ACCENTS  = ["top", "left", "corner", "underline", "dot", "bar", "num"];
  const TINTS    = ["neutral", "indigo", "lime", "rose", "amber", "cyan", "plum", "forest"];
  const BULLET_LAYOUTS = ["bento", "grid3", "grid2", "grid4", "masonry", "steps", "manifesto", "split", "split-rev", "pills", "pills-sq", "timeline", "editorial", "callouts"];

  const hash = (seed: string, salt: number) => {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  };

  const sections = slides.map((slide, idx) => {
    const title = esc(slide.title || deck.title || "");
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 6);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `${num} — ${isAr ? "فصل" : "Chapter"}`);

    const seed = `${deck.htmlSlug || "vlc"}|${idx}|${slide.title || ""}|${slide.type || ""}`;
    const surface = SURFACES[hash(seed, 1) % SURFACES.length];
    const accent  = ACCENTS [hash(seed, 2) % ACCENTS.length];
    const tint    = TINTS   [hash(seed, 3) % TINTS.length];
    const layout  = BULLET_LAYOUTS[hash(seed, 4) % BULLET_LAYOUTS.length];

    const cardClass = `vlc-card vlc-surf-${surface} vlc-acc-${accent}`;
    const tintClass = `vlc-tint-${tint}`;
    const img = slide.image
      ? `<img class="vlc-img${hash(seed,5)%3===0 ? " vlc-img-wide" : ""}" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>`
      : "";

    // Cover
    if (idx === 0 || slide.type === "cover") {
      const stats = (slide.stats || []).slice(0, 4);
      return `<section class="vlc-slide vlc-cover ${tintClass}"><div class="vlc-inner">
        <span class="vlc-label">${label}</span>
        <h1 class="vlc-title">${title}</h1>
        ${slide.subtitle ? `<p class="vlc-sub">${esc(slide.subtitle)}</p>` : ""}
      </div>${stats.length ? `<div class="vlc-stats-bar" style="position:absolute;left:0;right:0;bottom:0">${stats.map(s => `<div class="vlc-stat"><div class="vlc-stat-v">${esc(s.value)}</div><div class="vlc-stat-l">${esc(s.label)}</div></div>`).join("")}</div>` : ""}</section>`;
    }

    if (slide.type === "closing") {
      return `<section class="vlc-slide vlc-cover ${tintClass}"><div class="vlc-inner">
        <span class="vlc-label">${label}</span>
        <h2 class="vlc-title">${title}</h2>
        ${slide.subtitle ? `<p class="vlc-sub">${esc(slide.subtitle)}</p>` : body ? `<p class="vlc-sub">${body}</p>` : ""}
      </div></section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<section class="vlc-slide vlc-cover ${tintClass}"><div class="vlc-inner">
        <p class="vlc-quote">"${esc(slide.quote || title)}"</p>
        ${slide.attribution ? `<div class="vlc-attr">— ${esc(slide.attribution)}</div>` : ""}
      </div></section>`;
    }

    if (slide.big_value) {
      return `<section class="vlc-slide vlc-cover ${tintClass}"><div class="vlc-inner">
        <span class="vlc-label">${label}</span>
        <div class="vlc-big">${esc(slide.big_value)}</div>
        <p class="vlc-sub" style="margin:24px auto 0">${esc(slide.big_label || title)}</p>
        ${body ? `<p class="vlc-sub" style="margin:14px auto 0">${body}</p>` : ""}
      </div></section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:1180px">
        <span class="vlc-label">${label}</span>
        <h2 class="vlc-title">${title}</h2>
        ${body ? `<p class="vlc-body">${body}</p>` : ""}
        ${img}
        <div class="vlc-stats-bar" style="margin-top:2rem;position:relative;background:rgba(255,255,255,0.7)">${stats.map(s => `<div class="vlc-stat"><div class="vlc-stat-v">${esc(s.value)}</div><div class="vlc-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      </div></section>`;
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">
        <span class="vlc-label">${label}</span>
        <h2 class="vlc-title">${title}</h2>
        ${body ? `<p class="vlc-body">${body}</p>` : ""}
        <div class="vlc-steps vlc-acc-${accent}">${steps.map((s,i) => `<div class="vlc-step"><div class="vlc-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="vlc-step-t">${esc(s.title)}</div>${s.desc ? `<div class="vlc-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
      </div></section>`;
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">
        <span class="vlc-label">${label}</span>
        <h2 class="vlc-title">${title}</h2>
        <div class="vlc-tl">${events.map(e => `<div class="vlc-tl-item"><div class="vlc-tl-k">${esc(e.date)}</div><div class="vlc-tl-t">${esc(e.title)}</div>${e.desc ? `<div class="vlc-tl-d">${esc(e.desc)}</div>` : ""}</div>`).join("")}</div>
      </div></section>`;
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:1120px">
        <span class="vlc-label">${label}</span>
        <h2 class="vlc-title">${title}</h2>
        <div class="vlc-compare">
          <div><h3>${esc(slide.left_title || "A")}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div><h3>${esc(slide.right_title || "B")}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      </div></section>`;
    }

    // ── Bullets: pick from 14 layouts × surfaces × accents × tints ──
    if (bullets.length >= 2) {
      const parsed = bullets.map(b => {
        const parts = b.split(/[:：—-]\s*/, 2);
        return { h: esc(parts[0] || b), d: esc(parts[1] || "") };
      });

      const cardsHtml = (cls = cardClass, limit = 6) =>
        parsed.slice(0, limit).map((p, i) =>
          `<div class="${cls}"><div class="vlc-card-n">${String(i+1).padStart(2,"0")}</div><div class="vlc-card-t">${p.h}</div>${p.d ? `<div class="vlc-card-d">${p.d}</div>` : ""}</div>`
        ).join("");

      const header = `<span class="vlc-label">${label}</span>
        <h2 class="vlc-title">${title}</h2>
        ${body ? `<p class="vlc-body">${body}</p>` : ""}`;

      if (layout === "bento") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">${header}${img}<div class="vlc-bento">${cardsHtml()}</div></div></section>`;
      }
      if (layout === "grid3") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">${header}${img}<div class="vlc-grid-3">${cardsHtml()}</div></div></section>`;
      }
      if (layout === "grid2") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:1080px">${header}${img}<div class="vlc-grid-2">${cardsHtml(cardClass, 4)}</div></div></section>`;
      }
      if (layout === "grid4") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">${header}${img}<div class="vlc-grid-4">${cardsHtml()}</div></div></section>`;
      }
      if (layout === "masonry") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">${header}${img}<div class="vlc-masonry">${cardsHtml()}</div></div></section>`;
      }
      if (layout === "steps") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:980px">${header}<div class="vlc-steps vlc-acc-${accent}">${parsed.slice(0,6).map((p,i)=>`<div class="vlc-step"><div class="vlc-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="vlc-step-t">${p.h}</div>${p.d?`<div class="vlc-step-d">${p.d}</div>`:""}</div></div>`).join("")}</div></div></section>`;
      }
      if (layout === "manifesto") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:1020px">${header}<div class="vlc-mani">${parsed.slice(0,6).map((p,i)=>`<div class="vlc-mani-row"><div class="vlc-mani-k">${isAr ? "بند" : "Item"} · ${String(i+1).padStart(2,"0")}</div><div><div class="vlc-mani-t">${p.h}</div>${p.d?`<div class="vlc-mani-d">${p.d}</div>`:""}</div></div>`).join("")}</div></div></section>`;
      }
      if (layout === "split" || layout === "split-rev") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:1180px"><div class="vlc-split ${layout==="split-rev"?"vlc-split-rev":""}"><div>${header}${img}</div><div class="vlc-edit-list">${parsed.slice(0,6).map((p,i)=>`<div class="vlc-edit-item"><div class="vlc-edit-k">${String(i+1).padStart(2,"0")}</div><div class="vlc-edit-t">${p.h}</div>${p.d?`<div class="vlc-edit-d">${p.d}</div>`:""}</div>`).join("")}</div></div></div></section>`;
      }
      if (layout === "pills" || layout === "pills-sq") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:1060px">${header}${img}<div class="vlc-pills">${parsed.slice(0,8).map(p=>`<span class="vlc-pill ${layout==="pills-sq"?"vlc-pill-sq":""} vlc-pill-dot">${p.h}</span>`).join("")}</div></div></section>`;
      }
      if (layout === "timeline") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">${header}<div class="vlc-tl">${parsed.slice(0,6).map((p,i)=>`<div class="vlc-tl-item"><div class="vlc-tl-k">${String(i+1).padStart(2,"0")}</div><div class="vlc-tl-t">${p.h}</div>${p.d?`<div class="vlc-tl-d">${p.d}</div>`:""}</div>`).join("")}</div></div></section>`;
      }
      if (layout === "editorial") {
        return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner" style="max-width:1080px">${header}<div class="vlc-edit-list" style="margin-top:24px">${parsed.slice(0,6).map((p,i)=>`<div class="vlc-edit-item"><div class="vlc-edit-k">${String(i+1).padStart(2,"0")}</div><div class="vlc-edit-t">${p.h}</div>${p.d?`<div class="vlc-edit-d">${p.d}</div>`:""}</div>`).join("")}</div></div></section>`;
      }
      // callouts
      return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">${header}${img}<div class="vlc-call">${parsed.slice(0,6).map((p,i)=>`<div class="vlc-call-box vlc-surf-${surface} vlc-acc-${accent}"><div class="vlc-card-n">${String(i+1).padStart(2,"0")}</div><div class="vlc-card-t">${p.h}</div>${p.d?`<div class="vlc-card-d">${p.d}</div>`:""}</div>`).join("")}</div></div></section>`;
    }

    // Default plain
    return `<section class="vlc-slide ${tintClass}"><div class="vlc-inner">
      <span class="vlc-label">${label}</span>
      <h2 class="vlc-title">${title}</h2>
      ${body ? `<p class="vlc-body">${body}</p>` : ""}
      ${img}
    </div></section>`;
  });

  return `<div class="vlc-content" data-vlc>\n${sections.join("\n")}\n</div>`;
}

function renderSeasonalScrollDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  return renderSeasonalScrollDeckImpl(deck);
}

/* ────────────────────────────────────────────────────────── */
/* Synthra — Editorial Cream renderer                          */
/* ────────────────────────────────────────────────────────── */
const SYNTHRA_LOCK_CSS = `
  html, body { background: #fafafa !important; color: #111 !important; font-family: 'Inter', system-ui, sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > *:not(.syn-root):not(.syn-bg) { display: none !important; }
  .syn-bg { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; opacity: 0.5; }
  .syn-bg canvas { width: 100%; height: 100%; }
  .syn-root { position: relative; z-index: 10; }

  /* ── Tonal palettes (per slide via .syn-tone-*) ── */
  .syn-tone-ink     { --syn-acc: 17,17,17;   --syn-soft: 240,240,240; }
  .syn-tone-sand    { --syn-acc: 168,134,76; --syn-soft: 246,238,222; }
  .syn-tone-sage    { --syn-acc: 95,122,86;  --syn-soft: 232,237,225; }
  .syn-tone-blush   { --syn-acc: 190,108,118;--syn-soft: 248,232,232; }
  .syn-tone-cobalt  { --syn-acc: 36,72,128;  --syn-soft: 224,232,244; }
  .syn-tone-rust    { --syn-acc: 168,80,46;  --syn-soft: 246,228,218; }
  .syn-tone-plum    { --syn-acc: 110,60,108; --syn-soft: 236,224,236; }

  /* ── Slide frame ── */
  .syn-slide { min-height: auto; padding: clamp(48px, 7vh, 100px) clamp(18px, 5vw, 64px); max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; justify-content: center; position: relative; }
  .syn-cover { position: relative; min-height: 88vh; }
  .syn-slide.syn-align-left  .syn-inner { margin-right: auto; }
  .syn-slide.syn-align-right .syn-inner { margin-left: auto; }
  .syn-slide.syn-align-center .syn-inner { margin: 0 auto; }
  .syn-inner { width: 100%; max-width: 1200px; }

  /* ── Surface variants ── */
  .syn-surf-clean   { background: rgba(255,255,255,0.85); backdrop-filter: blur(8px); border: 1px solid #ececec; }
  .syn-surf-frost   { background: rgba(255,255,255,0.55); backdrop-filter: blur(14px); border: 1px solid rgba(17,17,17,0.08); }
  .syn-surf-border  { background: #fff; border: 1.5px solid #111; }
  .syn-surf-tint    { background: rgba(var(--syn-soft), 0.85); backdrop-filter: blur(6px); }
  .syn-surf-glass   { background: rgba(255,255,255,0.4); backdrop-filter: blur(18px) saturate(140%); border: 1px solid rgba(255,255,255,0.6); }
  .syn-surf-ink     { background: #111; color: #fafafa; }
  .syn-surf-ink *   { color: inherit !important; }
  .syn-surf-grad    { background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(var(--syn-soft),0.78)); border: 1px solid rgba(17,17,17,0.06); }
  .syn-surf-paper   { background: rgba(255,255,255,0.94); border-top: 4px solid rgba(var(--syn-acc),1); }

  /* ── Accent decorations ── */
  .syn-acc-top    { box-shadow: inset 0 3px 0 0 rgba(var(--syn-acc),0.9); }
  .syn-acc-left   { box-shadow: inset 3px 0 0 0 rgba(var(--syn-acc),0.9); }
  .syn-acc-corner { position: relative; }
  .syn-acc-corner::before { content:""; position:absolute; top:0; right:0; width:42px; height:42px; background: rgba(var(--syn-acc),0.9); clip-path: polygon(100% 0, 100% 100%, 0 0); }
  .syn-acc-underline .syn-card-t, .syn-acc-underline .syn-proc-t { box-shadow: 0 2px 0 0 rgba(var(--syn-acc),0.85); display: inline-block; padding-bottom: 2px; }
  .syn-acc-dot::before { content:""; display:inline-block; width:9px; height:9px; border-radius:50%; background: rgba(var(--syn-acc),1); margin-right:10px; vertical-align: middle; }
  .syn-acc-bar { border-left: 3px solid rgba(var(--syn-acc),0.85); padding-left: 16px; }
  .syn-acc-num .syn-card-n, .syn-acc-num .syn-proc-n { color: rgba(var(--syn-acc),1) !important; }

  /* ── Typography ── */
  .syn-label { font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #999; margin-bottom: 26px; display: inline-block; }
  .syn-brand { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 0.08em; color: #111; margin-bottom: 18px; text-transform: lowercase; }
  .syn-h1 { font-family: 'Space Grotesk', sans-serif; font-weight: 300; line-height: 1.06; letter-spacing: -0.025em; color: #111; font-size: clamp(34px, 6.4vw, 84px); margin-bottom: 22px; overflow-wrap: anywhere; }
  .syn-h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 300; line-height: 1.12; letter-spacing: -0.02em; color: #111; font-size: clamp(28px, 4.6vw, 60px); margin-bottom: 22px; max-width: 920px; overflow-wrap: anywhere; }
  .syn-sub { font-size: clamp(14px, 1.55vw, 17.5px); line-height: 1.75; color: #555; font-weight: 300; max-width: 660px; margin-bottom: 22px; }
  .syn-cta, .syn-cta-btn { display: none !important; }

  /* ── Generic helpers ── */
  .syn-pad { padding: clamp(24px, 3vw, 44px); border-radius: 2px; }
  .syn-tags { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
  .syn-tags span { display: inline-block; font-size: 12px; color: #555; border: 1px solid #e0e0e0; border-radius: 20px; padding: 7px 16px; letter-spacing: 0.02em; background: rgba(255,255,255,0.6); backdrop-filter: blur(4px); }

  /* ── Stats ── */
  .syn-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); border: 1px solid #e0e0e0; margin-top: 2rem; background: #fff; }
  .syn-stat { padding: 32px 28px; border-right: 1px solid #e0e0e0; }
  .syn-stat:last-child { border-right: none; }
  .syn-stat-v { font-family: 'Space Grotesk', sans-serif; font-size: clamp(28px, 3.4vw, 44px); font-weight: 300; line-height: 1; color: #111; margin-bottom: 8px; letter-spacing: -0.02em; }
  .syn-stat-l { font-size: 12px; color: #999; letter-spacing: 0.04em; }

  /* ── Process / Steps ── */
  .syn-process { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: clamp(20px, 3vw, 48px); margin-top: 1rem; }
  .syn-proc-n { font-family: 'Space Grotesk', sans-serif; font-size: clamp(44px, 5.5vw, 64px); font-weight: 300; color: #eee; line-height: 1; margin-bottom: 16px; }
  .syn-proc-t { font-family: 'Space Grotesk', sans-serif; font-size: clamp(17px, 1.8vw, 20px); font-weight: 500; margin-bottom: 10px; color: #111; }
  .syn-proc-d { font-size: 14px; line-height: 1.7; color: #555; font-weight: 300; }
  .syn-timeline { display:flex; flex-direction:column; margin-top: 1rem; }
  .syn-trow { display:grid; grid-template-columns: 120px 1fr; gap: 28px; padding: 22px 0; border-top: 1px solid #e0e0e0; align-items: baseline; }
  .syn-trow:last-child { border-bottom: 1px solid #e0e0e0; }
  .syn-trow-n { font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: rgba(var(--syn-acc),1); letter-spacing: 0.12em; text-transform: uppercase; }
  .syn-trow-t { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 500; color: #111; }
  .syn-trow-d { font-size: 14px; line-height: 1.7; color: #555; margin-top: 6px; }

  /* ── Card grids ── */
  .syn-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; margin-top: 1rem; }
  .syn-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; margin-top: 1rem; }
  .syn-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-top: 1rem; }
  .syn-bento  { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(120px, auto); gap: 14px; margin-top: 1rem; }
  .syn-masonry { columns: 2; column-gap: 16px; margin-top: 1rem; }
  .syn-masonry > * { break-inside: avoid; margin-bottom: 16px; display: block; }
  .syn-card { padding: clamp(20px, 2.4vw, 36px); position: relative; }
  .syn-card-n { font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #999; margin-bottom: 14px; display: inline-block; letter-spacing: 0.08em; }
  .syn-card-t { font-family: 'Space Grotesk', sans-serif; font-size: clamp(15px, 1.7vw, 19px); font-weight: 500; color: #111; margin-bottom: 10px; line-height: 1.25; }
  .syn-card-d { font-size: 13.5px; line-height: 1.7; color: #555; font-weight: 300; }
  .syn-bento .syn-card.b-wide  { grid-column: span 4; }
  .syn-bento .syn-card.b-half  { grid-column: span 3; }
  .syn-bento .syn-card.b-third { grid-column: span 2; }
  .syn-bento .syn-card.b-tall  { grid-row: span 2; }

  /* ── Manifesto ── */
  .syn-manifesto { display:flex; flex-direction:column; margin-top: 1rem; }
  .syn-mrow { display:grid; grid-template-columns: 80px 1fr; gap: 28px; padding: 26px 0; border-top: 1px solid #e0e0e0; align-items: baseline; }
  .syn-mrow:last-child { border-bottom: 1px solid #e0e0e0; }
  .syn-mrow-n { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 300; color: rgba(var(--syn-acc),0.85); }
  .syn-mrow-t { font-family: 'Space Grotesk', sans-serif; font-size: clamp(18px, 2vw, 24px); font-weight: 500; color: #111; }
  .syn-mrow-d { font-size: 14.5px; color: #555; margin-top: 6px; line-height: 1.7; }

  /* ── Editorial split ── */
  .syn-editorial { display:grid; grid-template-columns: 1fr 1.3fr; gap: 56px; align-items: start; }
  .syn-edcol-l h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(28px, 3.4vw, 44px); font-weight: 300; line-height: 1.12; color: #111; margin-bottom: 16px; letter-spacing: -0.02em; }
  .syn-edcol-r p { font-size: 15px; line-height: 1.85; color: #555; margin-bottom: 14px; font-weight: 300; }

  /* ── Quote / Big / FAQ / Image / Compare ── */
  .syn-quote { font-family: 'Space Grotesk', sans-serif; font-size: clamp(26px, 3.6vw, 48px); font-weight: 300; line-height: 1.28; color: #111; max-width: 960px; margin: 0 auto; text-align: center; letter-spacing: -0.02em; }
  .syn-attr { font-size: 12px; color: #999; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 24px; text-align: center; }
  .syn-big { font-family: 'Space Grotesk', sans-serif; font-size: clamp(72px, 15vw, 200px); font-weight: 300; line-height: 0.92; letter-spacing: -0.045em; color: #111; text-align: center; }
  .syn-img { display: block; width: 100%; max-width: 920px; max-height: 380px; object-fit: cover; margin: 1.6rem auto; }
  .syn-faq { max-width: 820px; margin-top: 1rem; }
  .syn-faq-item { border-top: 1px solid #e0e0e0; padding: 20px 0; }
  .syn-faq-item:last-child { border-bottom: 1px solid #e0e0e0; }
  .syn-faq-q { font-family: 'Space Grotesk', sans-serif; font-size: 15.5px; font-weight: 500; color: #111; margin-bottom: 8px; }
  .syn-faq-a { font-size: 13.5px; line-height: 1.75; color: #555; font-weight: 300; }
  .syn-compare { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background:#e0e0e0; border:1px solid #e0e0e0; margin-top:1rem; }
  .syn-compare-col { background:#fff; padding: clamp(24px,3vw,40px); }
  .syn-compare h3 { font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 500; margin-bottom: 14px; color:#111; }
  .syn-compare p { font-size:14.5px; line-height:1.7; color:#555; padding:8px 0; border-top:1px solid #eee; margin:0; font-weight:300; }

  /* ── Cover silhouette ── */
  .syn-silhouette { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: clamp(280px, 50vw, 600px); height: clamp(340px, 60vw, 700px); pointer-events: none; opacity: 0.85; z-index: -1; }
  .syn-silhouette canvas { width: 100%; height: 100%; }

  /* ── RTL ── */
  [dir="rtl"] .syn-sub, [dir="rtl"] .syn-proc-d, [dir="rtl"] .syn-card-d, [dir="rtl"] .syn-mrow-d, [dir="rtl"] .syn-faq-a, [dir="rtl"] .syn-trow-d { text-align: right; }
  [dir="rtl"] .syn-acc-corner::before { right: auto; left: 0; clip-path: polygon(0 0, 0 100%, 100% 0); }
  [dir="rtl"] .syn-acc-bar { border-left: none; border-right: 3px solid rgba(var(--syn-acc),0.85); padding-left: 0; padding-right: 16px; }
  [dir="rtl"] .syn-mrow, [dir="rtl"] .syn-trow { grid-template-columns: 1fr 80px; }
  [dir="rtl"] .syn-editorial { grid-template-columns: 1.3fr 1fr; }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .syn-bento { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .syn-bento .syn-card.b-wide, .syn-bento .syn-card.b-half { grid-column: span 3; }
    .syn-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .syn-editorial { grid-template-columns: 1fr; gap: 32px; }
  }
  @media (max-width: 640px) {
    .syn-slide { padding: 44px 18px; }
    .syn-cover { min-height: 70vh; }
    .syn-h1 { font-size: 32px !important; }
    .syn-h2 { font-size: 26px !important; }
    .syn-quote { font-size: 22px !important; }
    .syn-big { font-size: 72px !important; }
    .syn-stats { grid-template-columns: repeat(2, 1fr); }
    .syn-stat { border-right: none; border-bottom: 1px solid #e0e0e0; padding: 22px 18px; }
    .syn-grid-2, .syn-grid-3, .syn-process, .syn-compare, .syn-masonry { grid-template-columns: 1fr !important; columns: 1 !important; gap: 18px; }
    .syn-silhouette { width: 70vw; height: 70vw; opacity: 0.5; }
    .syn-mrow, .syn-trow { grid-template-columns: 56px 1fr; gap: 16px; }
  }
`;

const SYN_SURFACES = ["clean","frost","border","tint","glass","ink","grad","paper"] as const;
const SYN_ACCENTS  = ["top","left","corner","underline","dot","bar","num"] as const;
const SYN_TONES    = ["ink","sand","sage","blush","cobalt","rust","plum"] as const;
const SYN_LAYOUTS  = ["bento","masonry","grid3","grid4","grid2","process","manifesto","editorial","timeline","faq","pills","compact","split","stack"] as const;
const SYN_ALIGNS   = ["left","right","center"] as const;

function synHash(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function renderSynthraBuilderDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const sections = slides.map((slide, idx) => {
    const title = esc(slide.title || deck.title || "");
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `${num} — ${isAr ? "فصل" : "Section"}`);
    const img = slide.image ? `<img class="syn-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const surface = SYN_SURFACES[synHash(seed, 1) % SYN_SURFACES.length];
    const accent  = SYN_ACCENTS [synHash(seed, 2) % SYN_ACCENTS.length];
    const tone    = SYN_TONES   [synHash(seed, 3) % SYN_TONES.length];
    const layout  = SYN_LAYOUTS [synHash(seed, 4) % SYN_LAYOUTS.length];
    const align   = SYN_ALIGNS  [synHash(seed, 5) % SYN_ALIGNS.length];

    const slideCls = `syn-slide syn-tone-${tone} syn-align-${align}`;
    const innerCls = `syn-inner syn-surf-${surface} syn-acc-${accent} syn-pad`;
    const wrap = (inner: string, extraSlideCls = "") =>
      `<section class="${slideCls} ${extraSlideCls}"><div class="${innerCls}">${inner}</div></section>`;

    if (idx === 0 || slide.type === "cover") {
      const tags = (slide.bullets || []).slice(0, 4);
      return `<section class="${slideCls} syn-cover">
        <div class="syn-silhouette"><canvas id="heroCanvas"></canvas></div>
        <div style="position:relative;z-index:2;max-width:560px">
          <div class="syn-brand">${esc((deck.brandKit as any)?.name || deck.title || (isAr ? "العلامة" : "synthra"))}</div>
          <h1 class="syn-h1">${title}</h1>
          ${slide.subtitle ? `<p class="syn-sub">${esc(slide.subtitle)}</p>` : ""}
          ${tags.length ? `<div class="syn-tags">${tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="${slideCls}" style="justify-content:center;text-align:center">
        <div class="syn-inner syn-surf-ink syn-pad" style="text-align:center">
          <h2 class="syn-h2" style="margin:0 auto 14px">${title}</h2>
          ${slide.subtitle ? `<p class="syn-sub" style="margin:0 auto">${esc(slide.subtitle)}</p>` : body ? `<p class="syn-sub" style="margin:0 auto">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<section class="${slideCls}" style="justify-content:center">
        <p class="syn-quote">"${esc(slide.quote || title)}"</p>
        ${slide.attribution ? `<div class="syn-attr">— ${esc(slide.attribution)}</div>` : ""}
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="${slideCls}" style="justify-content:center;text-align:center">
        <div class="syn-label" style="text-align:center">${label}</div>
        <div class="syn-big">${esc(slide.big_value)}</div>
        <p class="syn-sub" style="margin:24px auto 0;text-align:center">${esc(slide.big_label || title)}</p>
        ${body ? `<p class="syn-sub" style="margin:14px auto 0;text-align:center">${body}</p>` : ""}
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return wrap(`
        <div class="syn-label">${label}</div>
        <h2 class="syn-h2">${title}</h2>
        ${body ? `<p class="syn-sub">${body}</p>` : ""}
        ${img}
        <div class="syn-stats">${stats.map(s => `<div class="syn-stat"><div class="syn-stat-v">${esc(s.value)}</div><div class="syn-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      if (layout === "manifesto") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-manifesto">${steps.map((s,i) => `<div class="syn-mrow"><div class="syn-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="syn-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="syn-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <div class="syn-label">${label}</div>
        <h2 class="syn-h2">${title}</h2>
        ${body ? `<p class="syn-sub">${body}</p>` : ""}
        <div class="syn-process">${steps.map((s,i) => `<div><div class="syn-proc-n">${String(i+1).padStart(2,"0")}</div><div class="syn-proc-t">${esc(s.title)}</div>${s.desc ? `<div class="syn-proc-d">${esc(s.desc)}</div>` : ""}</div>`).join("")}</div>
      `);
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return wrap(`
        <div class="syn-label">${label}</div>
        <h2 class="syn-h2">${title}</h2>
        <div class="syn-timeline">${events.map(e => `<div class="syn-trow"><div class="syn-trow-n">${esc(e.date)}</div><div><div class="syn-trow-t">${esc(e.title)}</div>${e.desc ? `<div class="syn-trow-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return wrap(`
        <div class="syn-label">${label}</div>
        <h2 class="syn-h2">${title}</h2>
        <div class="syn-compare">
          <div class="syn-compare-col"><h3>${esc(slide.left_title || "A")}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div class="syn-compare-col"><h3>${esc(slide.right_title || "B")}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:：—–-]\s+/);
        const t = parts[0];
        const d = parts.slice(1).join(" — ");
        return { t, d, n: String(i + 1).padStart(2, "0") };
      });

      if (layout === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-bento">${cards.map((c,i) => `<div class="syn-card ${spans[i % spans.length]}"><span class="syn-card-n">${c.n}</span><div class="syn-card-t">${esc(c.t)}</div>${c.d ? `<div class="syn-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "masonry") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-masonry">${cards.map(c => `<div class="syn-card"><span class="syn-card-n">${c.n}</span><div class="syn-card-t">${esc(c.t)}</div>${c.d ? `<div class="syn-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "grid2" || layout === "grid3" || layout === "grid4") {
        const gcls = layout === "grid4" ? "syn-grid-4" : layout === "grid2" ? "syn-grid-2" : "syn-grid-3";
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="${gcls}">${cards.map(c => `<div class="syn-card"><span class="syn-card-n">${c.n}</span><div class="syn-card-t">${esc(c.t)}</div>${c.d ? `<div class="syn-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "process") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-process">${cards.slice(0,4).map(c => `<div><div class="syn-proc-n">${c.n}</div><div class="syn-proc-t">${esc(c.t)}</div>${c.d ? `<div class="syn-proc-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "manifesto") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-manifesto">${cards.map(c => `<div class="syn-mrow"><div class="syn-mrow-n">${c.n}</div><div><div class="syn-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="syn-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "editorial" || layout === "split") {
        return wrap(`
          <div class="syn-editorial">
            <div class="syn-edcol-l"><div class="syn-label">${label}</div><h2>${title}</h2>${img}</div>
            <div class="syn-edcol-r">${body ? `<p>${body}</p>` : ""}${cards.map(c => `<p><strong style="font-family:'Space Grotesk',sans-serif;font-weight:500;color:#111;">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div>
          </div>
        `);
      }
      if (layout === "timeline") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-timeline">${cards.map(c => `<div class="syn-trow"><div class="syn-trow-n">${c.n}</div><div><div class="syn-trow-t">${esc(c.t)}</div>${c.d ? `<div class="syn-trow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "faq") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-faq">${cards.map(c => `<div class="syn-faq-item"><div class="syn-faq-q">${esc(c.t)}</div>${c.d ? `<div class="syn-faq-a">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "pills") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <div class="syn-tags" style="margin-top:32px;gap:12px">
            ${cards.map(c => `<span style="font-size:14px;padding:12px 22px">${esc(c.t)}</span>`).join("")}
          </div>
        `);
      }
      if (layout === "compact") {
        return wrap(`
          <div class="syn-label">${label}</div>
          <h2 class="syn-h2">${title}</h2>
          ${body ? `<p class="syn-sub">${body}</p>` : ""}
          <ul style="list-style:none;padding:0;margin:1.2rem 0 0;border-top:1px solid #e0e0e0">
            ${cards.map(c => `<li style="padding:18px 0;border-bottom:1px solid #e0e0e0"><div style="display:flex;gap:18px;align-items:baseline"><span style="font-family:'Space Grotesk',sans-serif;font-size:14px;color:#999;min-width:34px">${c.n}</span><div><div style="font-family:'Space Grotesk',sans-serif;font-size:17px;color:#111;font-weight:500;margin-bottom:4px">${esc(c.t)}</div>${c.d ? `<div style="font-size:14px;line-height:1.7;color:#555">${esc(c.d)}</div>` : ""}</div></div></li>`).join("")}
          </ul>
        `);
      }
      // default 'stack'
      return wrap(`
        <div class="syn-label">${label}</div>
        <h2 class="syn-h2">${title}</h2>
        ${body ? `<p class="syn-sub">${body}</p>` : ""}
        ${img}
        <div class="syn-grid-2">${cards.map(c => `<div class="syn-card"><span class="syn-card-n">${c.n}</span><div class="syn-card-t">${esc(c.t)}</div>${c.d ? `<div class="syn-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
      `);
    }

    return wrap(`
      <div class="syn-label">${label}</div>
      <h2 class="syn-h2">${title}</h2>
      ${body ? `<p class="syn-sub">${body}</p>` : ""}
      ${img}
    `);
  });

  return `<div class="syn-root">\n${sections.join("\n")}\n</div>`;
}

/* ────────────────────────────────────────────────────────── */
/* Kami — Leather Notebook renderer                            */
/* ────────────────────────────────────────────────────────── */
const KAMI_LOCK_CSS = `
  :root { --kami-bg:#09090b; --kami-leather:#8b7355; --kami-leather-light:#a89070; --kami-leather-dark:#6b5840; --kami-parchment:#f5f0e8; --kami-warm-100:#f0ece4; --kami-ink:#2c2825; --kami-zinc-400:#a1a1aa; }
  html, body { background: var(--kami-bg) !important; color: var(--kami-parchment) !important; font-family: 'Crimson Pro', Georgia, serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > *:not(.kmi-root):not(.kmi-noise) { display: none !important; }
  .kmi-root { position: relative; z-index: 10; }
  .kmi-noise { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.04; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }

  /* ── Tonal palettes (per slide via .kmi-tone-*) ── */
  .kmi-tone-leather { --kmi-acc: 168,144,112; --kmi-soft: 90,69,48; }
  .kmi-tone-foxing  { --kmi-acc: 198,118,72;  --kmi-soft: 100,52,28; }
  .kmi-tone-moss    { --kmi-acc: 132,150,90;  --kmi-soft: 56,68,38; }
  .kmi-tone-sangria { --kmi-acc: 170,72,80;   --kmi-soft: 78,30,34; }
  .kmi-tone-ocean   { --kmi-acc: 96,128,160;  --kmi-soft: 36,52,72; }
  .kmi-tone-plum    { --kmi-acc: 140,90,128;  --kmi-soft: 60,36,58; }
  .kmi-tone-amber   { --kmi-acc: 198,148,72;  --kmi-soft: 92,64,28; }

  /* ── Slide frame: layout variants ── */
  .kmi-slide { min-height: auto; display: grid; grid-template-columns: 1fr 1fr; position: relative; }
  .kmi-slide:first-child { min-height: 92vh; }
  .kmi-slide.kmi-full { grid-template-columns: 1fr; }
  .kmi-slide.kmi-rev  { grid-template-columns: 1fr 1fr; direction: ltr; }
  .kmi-slide.kmi-rev > *:first-child { order: 2; }
  .kmi-slide.kmi-rev > *:last-child  { order: 1; }
  .kmi-slide.kmi-third { grid-template-columns: 1fr 2fr; }
  .kmi-slide.kmi-third-rev { grid-template-columns: 2fr 1fr; }

  /* ── Panel surfaces ── */
  .kmi-panel { padding: clamp(44px, 7vh, 96px) clamp(22px, 5vw, 76px); display: flex; flex-direction: column; justify-content: center; position: relative; min-height: 480px; }
  .kmi-slide.kmi-full .kmi-panel { min-height: 60vh; }
  .kmi-panel.kmi-dark { background: var(--kami-bg); color: var(--kami-parchment); }
  .kmi-panel.kmi-leather { background: linear-gradient(135deg, #5a4530 0%, #3a2c1f 50%, #2a1f15 100%); color: var(--kami-warm-100); position: relative; overflow: hidden; }
  .kmi-panel.kmi-leather::after { content: ''; position: absolute; inset: 0; opacity: 0.18; background-image: url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='l'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.4' numOctaves='6'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23l)'/%3E%3C/svg%3E"); pointer-events: none; }
  .kmi-panel.kmi-parchment { background: var(--kami-parchment); color: var(--kami-ink); }
  .kmi-panel.kmi-parchment::after { content: ''; position: absolute; inset: 0; opacity: 0.5; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.05'/%3E%3C/svg%3E"); }
  .kmi-panel.kmi-ink { background: #1a1410; color: var(--kami-warm-100); border-left: 1px solid rgba(168,144,112,0.18); }
  .kmi-panel.kmi-tint { background: rgba(var(--kmi-soft), 0.85); color: var(--kami-warm-100); }
  .kmi-panel.kmi-cream { background: #ebe2cf; color: var(--kami-ink); }

  /* ── Accent decorations ── */
  .kmi-acc-top    { box-shadow: inset 0 3px 0 0 rgba(var(--kmi-acc),0.9); }
  .kmi-acc-left   { box-shadow: inset 4px 0 0 0 rgba(var(--kmi-acc),0.9); }
  .kmi-acc-corner::before { content:""; position:absolute; top:0; right:0; width:44px; height:44px; background: rgba(var(--kmi-acc),0.9); clip-path: polygon(100% 0, 100% 100%, 0 0); z-index: 2; }
  .kmi-acc-underline .kmi-h2, .kmi-acc-underline .kmi-card-t, .kmi-acc-underline .kmi-step-t { box-shadow: 0 2px 0 0 rgba(var(--kmi-acc),0.8); display: inline-block; padding-bottom: 2px; }
  .kmi-acc-bar .kmi-inner { border-left: 3px solid rgba(var(--kmi-acc),0.85); padding-left: 18px; }
  .kmi-acc-frame .kmi-inner { border: 1px solid rgba(var(--kmi-acc),0.6); padding: 26px; }
  .kmi-acc-seal::after { content:""; position:absolute; bottom:32px; right:32px; width:64px; height:64px; border:1.5px solid rgba(var(--kmi-acc),0.7); border-radius:50%; }

  .kmi-inner { position: relative; z-index: 2; max-width: 620px; width: 100%; }
  .kmi-full .kmi-inner { max-width: 1120px; margin: 0 auto; }

  /* ── Typography ── */
  .kmi-label { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--kami-leather); margin-bottom: 28px; display: inline-block; }
  .kmi-parchment .kmi-label, .kmi-cream .kmi-label { color: var(--kami-leather-dark); }
  .kmi-leather .kmi-label, .kmi-dark .kmi-label, .kmi-ink .kmi-label, .kmi-tint .kmi-label { color: #c9b08a; }
  .kmi-h1 { font-family: 'Cinzel Decorative', serif; font-weight: 400; font-size: clamp(36px, 5.8vw, 78px); line-height: 1.08; letter-spacing: 0.02em; margin-bottom: 22px; color: var(--kami-leather-light); overflow-wrap: anywhere; }
  .kmi-parchment .kmi-h1, .kmi-parchment .kmi-h2, .kmi-cream .kmi-h1, .kmi-cream .kmi-h2 { color: var(--kami-ink); }
  .kmi-h2 { font-family: 'Cinzel Decorative', serif; font-weight: 400; font-size: clamp(28px, 4.2vw, 56px); line-height: 1.16; letter-spacing: 0.02em; margin-bottom: 22px; color: var(--kami-leather-light); overflow-wrap: anywhere; }
  .kmi-sub { font-family: 'Crimson Pro', serif; font-size: clamp(15px, 1.5vw, 19px); line-height: 1.75; font-weight: 300; color: var(--kami-warm-100); opacity: 0.85; margin-bottom: 20px; max-width: 640px; }
  .kmi-parchment .kmi-sub, .kmi-cream .kmi-sub { color: var(--kami-ink); opacity: 0.78; }
  .kmi-body { font-family: 'Crimson Pro', serif; font-size: clamp(15px, 1.5vw, 18px); line-height: 1.85; font-weight: 300; margin-bottom: 16px; }
  .kmi-rule { width: 60px; height: 1px; background: currentColor; opacity: 0.4; margin: 18px 0 22px; }
  .kmi-cta { display: none !important; }

  /* ── Cover book ── */
  .kmi-book { width: clamp(180px, 30vw, 320px); height: clamp(240px, 40vw, 420px); margin: 0 auto; background: linear-gradient(140deg, #6b5840 0%, #4a3a28 60%, #2e2418 100%); border-radius: 4px; box-shadow: 0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04), inset 6px 0 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; flex-direction: column; position: relative; }
  .kmi-book::before { content: ''; position: absolute; left: 14px; top: 0; bottom: 0; width: 1px; background: rgba(0,0,0,0.4); }
  .kmi-book-title { font-family: 'Cinzel Decorative', serif; font-size: clamp(22px, 2.8vw, 34px); color: #c9b08a; letter-spacing: 0.12em; margin-bottom: 18px; }
  .kmi-book-year { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.4em; color: #8b7355; }

  /* ── Stats ── */
  .kmi-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 0; margin-top: 1.5rem; border-top: 1px solid rgba(168,144,112,0.25); border-bottom: 1px solid rgba(168,144,112,0.25); }
  .kmi-stat { padding: 22px 18px; border-right: 1px solid rgba(168,144,112,0.18); }
  .kmi-stat:last-child { border-right: none; }
  .kmi-stat-v { font-family: 'Cinzel Decorative', serif; font-size: clamp(28px, 3.4vw, 46px); color: var(--kami-leather-light); line-height: 1; margin-bottom: 8px; }
  .kmi-parchment .kmi-stat-v, .kmi-cream .kmi-stat-v { color: var(--kami-leather-dark); }
  .kmi-stat-l { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.65; }

  /* ── Steps / Timeline / Manifesto ── */
  .kmi-steps { display: flex; flex-direction: column; gap: 0; margin-top: 1.4rem; }
  .kmi-step { display: flex; gap: 28px; padding: 22px 0; border-top: 1px solid rgba(168,144,112,0.22); }
  .kmi-step:last-child { border-bottom: 1px solid rgba(168,144,112,0.22); }
  .kmi-step-n { font-family: 'Cinzel Decorative', serif; font-size: 26px; color: var(--kami-leather); min-width: 60px; line-height: 1.2; }
  .kmi-step-t { font-family: 'Cinzel Decorative', serif; font-size: clamp(17px, 1.9vw, 22px); margin-bottom: 6px; color: var(--kami-leather-light); }
  .kmi-parchment .kmi-step-t, .kmi-cream .kmi-step-t { color: var(--kami-ink); }
  .kmi-step-d { font-family: 'Crimson Pro', serif; font-size: 15px; line-height: 1.7; font-weight: 300; opacity: 0.82; }
  .kmi-manifesto { display:flex; flex-direction:column; margin-top: 1.4rem; }
  .kmi-mrow { display:grid; grid-template-columns: 90px 1fr; gap: 28px; padding: 26px 0; border-top: 1px solid rgba(168,144,112,0.22); align-items: baseline; }
  .kmi-mrow:last-child { border-bottom: 1px solid rgba(168,144,112,0.22); }
  .kmi-mrow-n { font-family: 'Cinzel Decorative', serif; font-size: 32px; color: rgba(var(--kmi-acc),0.9); }
  .kmi-mrow-t { font-family: 'Cinzel Decorative', serif; font-size: clamp(20px, 2.2vw, 26px); color: var(--kami-leather-light); letter-spacing: 0.02em; }
  .kmi-parchment .kmi-mrow-t, .kmi-cream .kmi-mrow-t { color: var(--kami-ink); }
  .kmi-mrow-d { font-family: 'Crimson Pro', serif; font-size: 15px; line-height: 1.75; font-weight: 300; opacity: 0.82; margin-top: 6px; }

  /* ── Quote / Big ── */
  .kmi-quote { font-family: 'Cinzel Decorative', serif; font-style: italic; font-size: clamp(24px, 3.6vw, 48px); line-height: 1.36; color: var(--kami-leather-light); max-width: 880px; margin: 0 auto; text-align: center; font-weight: 400; }
  .kmi-parchment .kmi-quote, .kmi-cream .kmi-quote { color: var(--kami-ink); }
  .kmi-attr { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.6; margin-top: 28px; text-align: center; }
  .kmi-big { font-family: 'Cinzel Decorative', serif; font-size: clamp(72px, 14vw, 200px); line-height: 0.95; letter-spacing: 0.02em; color: var(--kami-leather-light); text-align: center; }
  .kmi-parchment .kmi-big, .kmi-cream .kmi-big { color: var(--kami-leather-dark); }

  /* ── Card grids ── */
  .kmi-grid    { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 1px; background: rgba(168,144,112,0.2); margin-top: 1.5rem; border: 1px solid rgba(168,144,112,0.2); }
  .kmi-grid-2  { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; background: rgba(168,144,112,0.2); margin-top: 1.5rem; border: 1px solid rgba(168,144,112,0.2); }
  .kmi-grid-3  { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1px; background: rgba(168,144,112,0.2); margin-top: 1.5rem; border: 1px solid rgba(168,144,112,0.2); }
  .kmi-grid-4  { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 1px; background: rgba(168,144,112,0.2); margin-top: 1.5rem; border: 1px solid rgba(168,144,112,0.2); }
  .kmi-bento   { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); grid-auto-rows: minmax(120px, auto); gap: 1px; background: rgba(168,144,112,0.2); margin-top: 1.5rem; border: 1px solid rgba(168,144,112,0.2); }
  .kmi-masonry { columns: 2; column-gap: 16px; margin-top: 1.5rem; }
  .kmi-masonry > * { break-inside: avoid; margin-bottom: 16px; display: block; border: 1px solid rgba(168,144,112,0.2); }
  .kmi-card { background: var(--kami-bg); padding: 28px 24px; position: relative; }
  .kmi-parchment .kmi-grid, .kmi-parchment .kmi-grid-2, .kmi-parchment .kmi-grid-3, .kmi-parchment .kmi-grid-4, .kmi-parchment .kmi-bento,
  .kmi-cream    .kmi-grid, .kmi-cream    .kmi-grid-2, .kmi-cream    .kmi-grid-3, .kmi-cream    .kmi-grid-4, .kmi-cream    .kmi-bento { background: rgba(107,88,64,0.25); border-color: rgba(107,88,64,0.25); }
  .kmi-parchment .kmi-card, .kmi-cream .kmi-card { background: var(--kami-parchment); }
  .kmi-leather .kmi-card, .kmi-tint .kmi-card, .kmi-ink .kmi-card { background: rgba(0,0,0,0.25); }
  .kmi-card-n { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.18em; color: var(--kami-leather); margin-bottom: 12px; }
  .kmi-card-t { font-family: 'Cinzel Decorative', serif; font-size: clamp(15px, 1.7vw, 19px); color: var(--kami-leather-light); margin-bottom: 8px; letter-spacing: 0.04em; }
  .kmi-parchment .kmi-card-t, .kmi-cream .kmi-card-t { color: var(--kami-ink); }
  .kmi-card-d { font-family: 'Crimson Pro', serif; font-size: 14.5px; line-height: 1.7; font-weight: 300; opacity: 0.78; }
  .kmi-bento .kmi-card.b-wide  { grid-column: span 4; }
  .kmi-bento .kmi-card.b-half  { grid-column: span 3; }
  .kmi-bento .kmi-card.b-third { grid-column: span 2; }
  .kmi-bento .kmi-card.b-tall  { grid-row: span 2; }

  /* ── Pills ── */
  .kmi-pills { display:flex; flex-wrap:wrap; gap:10px; margin-top: 1.4rem; }
  .kmi-pill { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; border: 1px solid rgba(168,144,112,0.5); padding: 9px 16px; color: var(--kami-leather-light); border-radius: 999px; }
  .kmi-parchment .kmi-pill, .kmi-cream .kmi-pill { color: var(--kami-ink); border-color: rgba(107,88,64,0.5); }

  /* ── Compare ── */
  .kmi-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(168,144,112,0.2); border: 1px solid rgba(168,144,112,0.2); margin-top: 1.4rem; }
  .kmi-compare > div { background: var(--kami-bg); padding: 30px 26px; }
  .kmi-parchment .kmi-compare > div, .kmi-cream .kmi-compare > div { background: var(--kami-parchment); }
  .kmi-compare h3 { font-family: 'Cinzel Decorative', serif; font-size: 17px; color: var(--kami-leather-light); margin-bottom: 14px; letter-spacing: 0.06em; }
  .kmi-parchment .kmi-compare h3, .kmi-cream .kmi-compare h3 { color: var(--kami-ink); }
  .kmi-compare p { font-family: 'Crimson Pro', serif; font-size: 14.5px; line-height: 1.7; font-weight: 300; padding: 8px 0; border-top: 1px solid rgba(168,144,112,0.15); opacity: 0.82; margin: 0; }

  /* ── Editorial ── */
  .kmi-editorial { display:grid; grid-template-columns: 1fr 1.3fr; gap: 56px; align-items: start; margin-top: 1rem; }
  .kmi-editorial .kmi-edcol-l h2 { font-family: 'Cinzel Decorative', serif; font-size: clamp(26px, 3.2vw, 40px); margin-bottom: 16px; }
  .kmi-editorial .kmi-edcol-r p { font-family: 'Crimson Pro', serif; font-size: 15.5px; line-height: 1.85; font-weight: 300; margin-bottom: 14px; opacity: 0.85; }

  /* ── Image ── */
  .kmi-img { display: block; width: 100%; max-width: 560px; max-height: 340px; object-fit: cover; margin: 1.5rem 0; border-radius: 2px; filter: sepia(0.18) brightness(0.94); }

  /* ── Corner + page ── */
  .kmi-corner { position: absolute; top: 28px; left: 28px; font-family: 'Cinzel Decorative', serif; font-size: 14px; letter-spacing: 0.18em; color: var(--kami-leather-light); z-index: 3; }
  .kmi-leather .kmi-corner, .kmi-dark .kmi-corner, .kmi-ink .kmi-corner, .kmi-tint .kmi-corner { color: #c9b08a; }
  .kmi-page { position: absolute; bottom: 28px; right: 28px; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.3em; opacity: 0.5; z-index: 3; }

  /* ── RTL ── */
  [dir="rtl"] .kmi-sub, [dir="rtl"] .kmi-body, [dir="rtl"] .kmi-step-d, [dir="rtl"] .kmi-card-d, [dir="rtl"] .kmi-mrow-d { text-align: right; }
  [dir="rtl"] .kmi-corner { left: auto; right: 28px; }
  [dir="rtl"] .kmi-page { right: auto; left: 28px; }
  [dir="rtl"] .kmi-acc-corner::before { right:auto; left:0; clip-path: polygon(0 0, 0 100%, 100% 0); }
  [dir="rtl"] .kmi-acc-bar .kmi-inner { border-left:none; border-right: 3px solid rgba(var(--kmi-acc),0.85); padding-left:0; padding-right:18px; }
  [dir="rtl"] .kmi-mrow { grid-template-columns: 1fr 90px; }
  [dir="rtl"] .kmi-editorial { grid-template-columns: 1.3fr 1fr; }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .kmi-bento { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .kmi-bento .kmi-card.b-wide, .kmi-bento .kmi-card.b-half { grid-column: span 3; }
    .kmi-grid-4 { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .kmi-editorial { grid-template-columns: 1fr; gap: 32px; }
  }
  @media (max-width: 820px) {
    .kmi-slide, .kmi-slide.kmi-rev, .kmi-slide.kmi-third, .kmi-slide.kmi-third-rev { grid-template-columns: 1fr; }
    .kmi-slide.kmi-rev > *:first-child, .kmi-slide.kmi-rev > *:last-child { order: initial; }
    .kmi-slide:first-child { min-height: auto; }
    .kmi-panel { padding: 40px 20px; min-height: auto; }
    .kmi-slide.kmi-full .kmi-panel { min-height: auto; }
    .kmi-h1 { font-size: 30px !important; }
    .kmi-h2 { font-size: 26px !important; }
    .kmi-quote { font-size: 22px !important; }
    .kmi-big { font-size: 64px !important; }
    .kmi-compare, .kmi-grid-2, .kmi-grid-3, .kmi-masonry { grid-template-columns: 1fr !important; columns: 1 !important; }
    .kmi-stat { border-right: none; border-bottom: 1px solid rgba(168,144,112,0.18); }
    .kmi-book { width: 50vw; height: 65vw; max-height: 280px; }
    .kmi-corner { top: 18px; left: 18px; font-size: 12px; }
    .kmi-page { bottom: 18px; right: 18px; }
    .kmi-mrow { grid-template-columns: 60px 1fr; gap: 16px; }
  }
`;

const KMI_PANELS   = ["leather","parchment","dark","ink","tint","cream"] as const;
const KMI_ACCENTS  = ["top","left","corner","underline","bar","frame","seal","none"] as const;
const KMI_TONES    = ["leather","foxing","moss","sangria","ocean","plum","amber"] as const;
const KMI_LAYOUTS  = ["bento","masonry","grid2","grid3","grid4","steps","manifesto","editorial","compare-look","timeline","pills","compact","stack","gridauto"] as const;
const KMI_FRAMES   = ["split","split-rev","full","third","third-rev"] as const;

function kmiHash(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function renderKamiNotebookDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI
  const brand = (deck.brandKit as any)?.name || deck.title || (isAr ? "كامي" : "Kami");

  const sections = slides.map((slide, idx) => {
    const title = esc(slide.title || deck.title || "");
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const total = String(slides.length).padStart(2, "0");
    const label = esc(slide.kicker || `${isAr ? "فصل" : "Chapter"} ${num}`);
    const corner = `<div class="kmi-corner">${esc(brand)}</div><div class="kmi-page">${num} / ${total}</div>`;
    const img = slide.image ? `<img class="kmi-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const panelA = KMI_PANELS [kmiHash(seed, 1) % KMI_PANELS.length];
    const panelB = KMI_PANELS [kmiHash(seed, 2) % KMI_PANELS.length];
    const accent = KMI_ACCENTS[kmiHash(seed, 3) % KMI_ACCENTS.length];
    const tone   = KMI_TONES  [kmiHash(seed, 4) % KMI_TONES.length];
    const layout = KMI_LAYOUTS[kmiHash(seed, 5) % KMI_LAYOUTS.length];
    const frame  = KMI_FRAMES [kmiHash(seed, 6) % KMI_FRAMES.length];

    // Cover — keep original book panel
    if (idx === 0 || slide.type === "cover") {
      const year = new Date().getFullYear();
      return `<section class="kmi-slide kmi-tone-${tone}">
        <div class="kmi-panel kmi-leather">
          ${corner}
          <div class="kmi-book">
            <div class="kmi-book-title">${esc((brand || "KAMI").toString().slice(0, 6).toUpperCase())}</div>
            <div class="kmi-book-year">${year}</div>
          </div>
        </div>
        <div class="kmi-panel kmi-parchment">
          <div class="kmi-inner">
            <div class="kmi-label">${label}</div>
            <h1 class="kmi-h1">${title}</h1>
            <div class="kmi-rule"></div>
            ${slide.subtitle ? `<p class="kmi-sub">${esc(slide.subtitle)}</p>` : ""}
          </div>
        </div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="kmi-slide kmi-full kmi-tone-${tone}">
        <div class="kmi-panel kmi-${panelA === "parchment" || panelA === "cream" ? "leather" : panelA}" style="text-align:center;align-items:center">
          ${corner}
          <div class="kmi-inner" style="text-align:center">
            <div class="kmi-label">${label}</div>
            <h2 class="kmi-h2">${title}</h2>
            <div class="kmi-rule" style="margin:18px auto 22px"></div>
            ${slide.subtitle ? `<p class="kmi-sub" style="margin-left:auto;margin-right:auto">${esc(slide.subtitle)}</p>` : body ? `<p class="kmi-sub" style="margin-left:auto;margin-right:auto">${body}</p>` : ""}
          </div>
        </div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<section class="kmi-slide kmi-full kmi-tone-${tone}">
        <div class="kmi-panel kmi-${panelA === "parchment" ? "dark" : panelA}" style="align-items:center;justify-content:center">
          ${corner}
          <div class="kmi-inner" style="max-width:920px;text-align:center">
            <p class="kmi-quote">"${esc(slide.quote || title)}"</p>
            ${slide.attribution ? `<div class="kmi-attr">— ${esc(slide.attribution)}</div>` : ""}
          </div>
        </div>
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="kmi-slide kmi-full kmi-tone-${tone}">
        <div class="kmi-panel kmi-${panelA === "dark" || panelA === "ink" ? "parchment" : panelA}" style="align-items:center;justify-content:center;text-align:center">
          ${corner}
          <div class="kmi-inner" style="max-width:920px;text-align:center">
            <div class="kmi-label">${label}</div>
            <div class="kmi-big">${esc(slide.big_value)}</div>
            <div class="kmi-rule" style="margin:24px auto"></div>
            <p class="kmi-sub" style="text-align:center;margin-left:auto;margin-right:auto">${esc(slide.big_label || title)}</p>
            ${body ? `<p class="kmi-body" style="text-align:center;max-width:620px;margin:0 auto">${body}</p>` : ""}
          </div>
        </div>
      </section>`;
    }

    // Helper: split-frame full content renderer
    const renderFull = (inner: string, panel = panelA) =>
      `<section class="kmi-slide kmi-full kmi-tone-${tone}">
        <div class="kmi-panel kmi-${panel} kmi-acc-${accent}">
          ${corner}
          <div class="kmi-inner">${inner}</div>
        </div>
      </section>`;

    const renderSplit = (left: string, right: string, panels: [typeof panelA, typeof panelB] = [panelA, panelB], framecls = frame) => {
      const cls = framecls === "full" ? "kmi-full" : framecls === "split-rev" ? "kmi-rev" : framecls === "third" ? "kmi-third" : framecls === "third-rev" ? "kmi-third-rev" : "";
      return `<section class="kmi-slide ${cls} kmi-tone-${tone}">
        <div class="kmi-panel kmi-${panels[0]} kmi-acc-${accent}">${corner}<div class="kmi-inner">${left}</div></div>
        <div class="kmi-panel kmi-${panels[1]}"><div class="kmi-inner">${right}</div></div>
      </section>`;
    };

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return renderFull(`
        <div class="kmi-label">${label}</div>
        <h2 class="kmi-h2">${title}</h2>
        ${body ? `<p class="kmi-sub">${body}</p>` : ""}
        <div class="kmi-stats">${stats.map(s => `<div class="kmi-stat"><div class="kmi-stat-v">${esc(s.value)}</div><div class="kmi-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      const stepsHtml = layout === "manifesto"
        ? `<div class="kmi-manifesto">${steps.map((s,i) => `<div class="kmi-mrow"><div class="kmi-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="kmi-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="kmi-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>`
        : `<div class="kmi-steps">${steps.map((s,i) => `<div class="kmi-step"><div class="kmi-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="kmi-step-t">${esc(s.title)}</div>${s.desc ? `<div class="kmi-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>`;
      if (frame === "full") {
        return renderFull(`<div class="kmi-label">${label}</div><h2 class="kmi-h2">${title}</h2>${body ? `<p class="kmi-sub">${body}</p>` : ""}${stepsHtml}`);
      }
      return renderSplit(
        `<div class="kmi-label">${label}</div><h2 class="kmi-h2">${title}</h2><div class="kmi-rule"></div>${body ? `<p class="kmi-sub">${body}</p>` : ""}`,
        stepsHtml
      );
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return renderFull(`
        <div class="kmi-label">${label}</div>
        <h2 class="kmi-h2">${title}</h2>
        <div class="kmi-steps">${events.map(e => `<div class="kmi-step"><div class="kmi-step-n" style="font-family:'Space Mono',monospace;font-size:12px;letter-spacing:0.18em;min-width:110px;color:var(--kami-leather)">${esc(e.date)}</div><div><div class="kmi-step-t">${esc(e.title)}</div>${e.desc ? `<div class="kmi-step-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return renderFull(`
        <div class="kmi-label">${label}</div>
        <h2 class="kmi-h2">${title}</h2>
        <div class="kmi-compare">
          <div><h3>${esc(slide.left_title || (isAr ? "أ" : "A"))}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div><h3>${esc(slide.right_title || (isAr ? "ب" : "B"))}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    // Bullets-driven combinatorial layouts
    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:：—–-]\s+/);
        const t = parts[0];
        const d = parts.slice(1).join(" — ");
        return { t, d, n: String(i + 1).padStart(2, "0") };
      });
      const cardHtml = (cls = "kmi-card") => cards.map(c => `<div class="${cls}"><div class="kmi-card-n">${c.n}</div><div class="kmi-card-t">${esc(c.t)}</div>${c.d ? `<div class="kmi-card-d">${esc(c.d)}</div>` : ""}</div>`).join("");

      let body_block = "";
      if (layout === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        body_block = `<div class="kmi-bento">${cards.map((c,i) => `<div class="kmi-card ${spans[i % spans.length]}"><div class="kmi-card-n">${c.n}</div><div class="kmi-card-t">${esc(c.t)}</div>${c.d ? `<div class="kmi-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>`;
      } else if (layout === "masonry") {
        body_block = `<div class="kmi-masonry">${cardHtml()}</div>`;
      } else if (layout === "grid2") {
        body_block = `<div class="kmi-grid-2">${cardHtml()}</div>`;
      } else if (layout === "grid3") {
        body_block = `<div class="kmi-grid-3">${cardHtml()}</div>`;
      } else if (layout === "grid4") {
        body_block = `<div class="kmi-grid-4">${cardHtml()}</div>`;
      } else if (layout === "gridauto") {
        body_block = `<div class="kmi-grid">${cardHtml()}</div>`;
      } else if (layout === "steps") {
        body_block = `<div class="kmi-steps">${cards.map(c => `<div class="kmi-step"><div class="kmi-step-n">${c.n}</div><div><div class="kmi-step-t">${esc(c.t)}</div>${c.d ? `<div class="kmi-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>`;
      } else if (layout === "manifesto") {
        body_block = `<div class="kmi-manifesto">${cards.map(c => `<div class="kmi-mrow"><div class="kmi-mrow-n">${c.n}</div><div><div class="kmi-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="kmi-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>`;
      } else if (layout === "timeline") {
        body_block = `<div class="kmi-steps">${cards.map(c => `<div class="kmi-step"><div class="kmi-step-n" style="font-family:'Space Mono',monospace;font-size:12px;letter-spacing:0.18em;min-width:80px;color:var(--kami-leather)">${c.n}</div><div><div class="kmi-step-t">${esc(c.t)}</div>${c.d ? `<div class="kmi-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>`;
      } else if (layout === "pills") {
        body_block = `<div class="kmi-pills">${cards.map(c => `<span class="kmi-pill">${esc(c.t)}</span>`).join("")}</div>`;
      } else if (layout === "compare-look") {
        body_block = `<div class="kmi-compare">${cards.slice(0,2).map(c => `<div><h3>${esc(c.t)}</h3>${c.d ? `<p>${esc(c.d)}</p>` : ""}</div>`).join("")}</div>`;
      } else if (layout === "editorial") {
        body_block = `<div class="kmi-editorial"><div class="kmi-edcol-l">${img || `<div class="kmi-rule" style="width:80px"></div>`}</div><div class="kmi-edcol-r">${cards.map(c => `<p><strong style="font-family:'Cinzel Decorative',serif;letter-spacing:0.04em;">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div></div>`;
      } else if (layout === "compact") {
        body_block = `<ol style="list-style:none;padding:0;margin:1.2rem 0 0;border-top:1px solid rgba(168,144,112,0.22)">${cards.map(c => `<li style="padding:18px 0;border-bottom:1px solid rgba(168,144,112,0.22);display:flex;gap:18px;align-items:baseline"><span style="font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.14em;min-width:36px;color:var(--kami-leather)">${c.n}</span><div><div style="font-family:'Cinzel Decorative',serif;font-size:17px;margin-bottom:4px">${esc(c.t)}</div>${c.d ? `<div style="font-family:'Crimson Pro',serif;font-size:14.5px;line-height:1.7;opacity:0.82">${esc(c.d)}</div>` : ""}</div></li>`).join("")}</ol>`;
      } else {
        // "stack"
        body_block = `<div class="kmi-grid-2">${cardHtml()}</div>`;
      }

      if (frame === "full") {
        return renderFull(`<div class="kmi-label">${label}</div><h2 class="kmi-h2">${title}</h2>${body ? `<p class="kmi-sub">${body}</p>` : ""}${img}${body_block}`);
      }
      // split: text on one side, content on the other
      return renderSplit(
        `<div class="kmi-label">${label}</div><h2 class="kmi-h2">${title}</h2><div class="kmi-rule"></div>${body ? `<p class="kmi-sub">${body}</p>` : ""}${img}`,
        body_block
      );
    }

    // Plain text fallback
    if (frame === "full") {
      return renderFull(`<div class="kmi-label">${label}</div><h2 class="kmi-h2">${title}</h2>${body ? `<p class="kmi-body">${body}</p>` : ""}${img}`);
    }
    return renderSplit(
      `<div class="kmi-label">${label}</div><h2 class="kmi-h2">${title}</h2><div class="kmi-rule"></div>${img}`,
      `${body ? `<p class="kmi-body">${body}</p>` : ""}`
    );
  });

  return `<div class="kmi-noise"></div><div class="kmi-root">\n${sections.join("\n")}\n</div>`;
}

/* ────────────────────────────────────────────────────────── */
/* Spidey — Web Slinger renderer                              */
/* ────────────────────────────────────────────────────────── */
const SPIDEY_LOCK_CSS = `
  :root {
    --spd-red:#E23636; --spd-dark-red:#B71C1C; --spd-blue:#1565C0; --spd-dark-blue:#0D47A1;
    --spd-black:#0A0A0A; --spd-white:#F5F5F5; --spd-gold:#FFD54F;
  }
  html, body { background: var(--spd-black) !important; color: var(--spd-white) !important; font-family: 'Inter', sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > *:not(.spd-root):not(.spd-web) { display: none !important; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--spd-black); }
  ::-webkit-scrollbar-thumb { background: var(--spd-red); border-radius: 3px; }

  .spd-web { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.06;
    background-image:
      radial-gradient(circle at 50% 50%, transparent 0, transparent 30%, var(--spd-white) 30.5%, transparent 31%),
      conic-gradient(from 0deg at 50% 50%, var(--spd-white) 0deg, transparent 1deg, transparent 30deg, var(--spd-white) 31deg, transparent 32deg, transparent 60deg, var(--spd-white) 61deg, transparent 62deg, transparent 90deg, var(--spd-white) 91deg, transparent 92deg, transparent 120deg, var(--spd-white) 121deg, transparent 122deg, transparent 150deg, var(--spd-white) 151deg, transparent 152deg, transparent 180deg, var(--spd-white) 181deg, transparent 182deg, transparent 210deg, var(--spd-white) 211deg, transparent 212deg, transparent 240deg, var(--spd-white) 241deg, transparent 242deg, transparent 270deg, var(--spd-white) 271deg, transparent 272deg, transparent 300deg, var(--spd-white) 301deg, transparent 302deg, transparent 330deg, var(--spd-white) 331deg, transparent 332deg, transparent 360deg);
    background-size: 600px 600px, 600px 600px; background-position: center center;
  }
  .spd-root { position: relative; z-index: 5; }

  /* ── Tonal palettes (per slide) ── */
  .spd-tone-red    { --spd-acc: 226,54,54;  --spd-acc2: 183,28,28; }
  .spd-tone-blue   { --spd-acc: 21,101,192; --spd-acc2: 13,71,161; }
  .spd-tone-gold   { --spd-acc: 255,213,79; --spd-acc2: 245,158,11; }
  .spd-tone-white  { --spd-acc: 245,245,245;--spd-acc2: 200,200,200; }
  .spd-tone-mix    { --spd-acc: 226,54,54;  --spd-acc2: 21,101,192; }
  .spd-tone-symbiote { --spd-acc: 30,30,30; --spd-acc2: 150,150,150; }

  /* ── Slide frame ── */
  .spd-slide { min-height: auto; padding: clamp(64px, 10vh, 140px) clamp(20px, 6vw, 80px); position: relative; max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; justify-content: center; }
  .spd-cover { min-height: 96vh; align-items: center; text-align: center; }
  .spd-inner { width: 100%; max-width: 1200px; margin: 0 auto; position: relative; z-index: 2; }
  .spd-slide.spd-align-left .spd-inner { margin-left: 4%; margin-right: auto; }
  .spd-slide.spd-align-right .spd-inner { margin-left: auto; margin-right: 4%; }

  /* ── Surface variants ── */
  .spd-surf-void   { background: transparent; }
  .spd-surf-card   { background: rgba(20,20,20,0.6); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08); }
  .spd-surf-red    { background: linear-gradient(135deg, var(--spd-red), var(--spd-dark-red)); color: var(--spd-white); }
  .spd-surf-red *  { color: inherit !important; }
  .spd-surf-blue   { background: linear-gradient(135deg, var(--spd-blue), var(--spd-dark-blue)); color: var(--spd-white); }
  .spd-surf-blue * { color: inherit !important; }
  .spd-surf-split  { background: linear-gradient(120deg, var(--spd-red) 0%, var(--spd-red) 49.9%, var(--spd-blue) 50.1%, var(--spd-blue) 100%); color: var(--spd-white); }
  .spd-surf-split * { color: inherit !important; }
  .spd-surf-comic  { background: rgba(245,245,245,0.96); color: var(--spd-black); }
  .spd-surf-comic * { color: inherit !important; }
  .spd-surf-ink    { background: rgba(0,0,0,0.85); border-top: 4px solid rgba(var(--spd-acc),1); }
  .spd-surf-line   { background: transparent; border: 2px solid rgba(var(--spd-acc),0.85); }

  /* ── Accent decorations ── */
  .spd-acc-bar   { border-left: 4px solid rgba(var(--spd-acc),1); padding-left: 18px; }
  .spd-acc-top   { box-shadow: inset 0 4px 0 0 rgba(var(--spd-acc),1); }
  .spd-acc-corner::before { content:""; position:absolute; top:0; right:0; width:48px; height:48px; background: rgba(var(--spd-acc),1); clip-path: polygon(100% 0, 100% 100%, 0 0); z-index: 2; }
  .spd-acc-web   { position: relative; }
  .spd-acc-web::after { content:""; position:absolute; top:-12px; right:-12px; width:80px; height:80px; pointer-events:none; opacity:0.4;
    background-image:
      radial-gradient(circle at 50% 50%, transparent 0, transparent 18%, rgba(var(--spd-acc),0.9) 18.5%, transparent 19%),
      conic-gradient(from 0deg, rgba(var(--spd-acc),0.9) 0deg, transparent 2deg, transparent 60deg, rgba(var(--spd-acc),0.9) 61deg, transparent 63deg, transparent 120deg, rgba(var(--spd-acc),0.9) 121deg, transparent 123deg, transparent 180deg, rgba(var(--spd-acc),0.9) 181deg, transparent 183deg, transparent 240deg, rgba(var(--spd-acc),0.9) 241deg, transparent 243deg, transparent 300deg, rgba(var(--spd-acc),0.9) 301deg, transparent 303deg, transparent 360deg);
    background-size: 80px 80px;
  }
  .spd-acc-emblem::after { content:""; position:absolute; bottom:20px; right:20px; width:48px; height:48px; background: rgba(var(--spd-acc),1);
    clip-path: polygon(50% 8%, 56% 28%, 78% 18%, 64% 36%, 90% 38%, 64% 46%, 78% 60%, 58% 50%, 60% 76%, 50% 56%, 40% 76%, 42% 50%, 22% 60%, 36% 46%, 10% 38%, 36% 36%, 22% 18%, 44% 28%); opacity: 0.7; }
  .spd-acc-tag::before { content: "//"; font-family: 'Bebas Neue', sans-serif; color: rgba(var(--spd-acc),1); margin-right: 12px; font-size: 1.4em; letter-spacing: 0.1em; }

  /* ── Typography ── */
  .spd-tag   { font-size: 12px; letter-spacing: 0.36em; text-transform: uppercase; color: rgba(var(--spd-acc),1); font-weight: 600; margin-bottom: 22px; display: inline-block; }
  .spd-h1    { font-family: 'Bebas Neue', sans-serif; font-size: clamp(64px, 14vw, 200px); line-height: 0.85; letter-spacing: -0.02em; margin-bottom: 28px; overflow-wrap: anywhere; }
  .spd-h1 .a { color: var(--spd-red); } .spd-h1 .b { color: var(--spd-blue); }
  .spd-h2    { font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px, 8vw, 110px); line-height: 0.9; letter-spacing: 0; margin-bottom: 24px; overflow-wrap: anywhere; }
  .spd-h2 em { font-style: normal; color: var(--spd-red); }
  .spd-sub   { font-size: clamp(14px, 1.5vw, 18px); line-height: 1.75; color: rgba(245,245,245,0.7); font-weight: 300; max-width: 640px; margin-bottom: 20px; letter-spacing: 0.01em; }
  .spd-body  { font-size: clamp(15px, 1.55vw, 18px); line-height: 1.8; color: rgba(245,245,245,0.78); font-weight: 300; max-width: 720px; margin-bottom: 16px; }
  .spd-cta   { display: none !important; }

  /* ── Stats (counter row) ── */
  .spd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 0; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.12); border-bottom: 1px solid rgba(255,255,255,0.12); }
  .spd-stat  { padding: 36px 24px; border-right: 1px solid rgba(255,255,255,0.08); text-align: center; }
  .spd-stat:last-child { border-right: none; }
  .spd-stat-v { font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px, 7vw, 92px); line-height: 1; color: var(--spd-red); letter-spacing: 0; }
  .spd-stat-l { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(245,245,245,0.55); margin-top: 12px; }
  .spd-surf-comic .spd-stat-v { color: var(--spd-red); }
  .spd-surf-comic .spd-stat-l { color: rgba(10,10,10,0.6); }

  /* ── Suit cards / Grids ── */
  .spd-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 20px; margin-top: 2rem; }
  .spd-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; margin-top: 2rem; }
  .spd-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; margin-top: 2rem; }
  .spd-bento  { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(140px, auto); gap: 16px; margin-top: 2rem; }
  .spd-masonry { columns: 2; column-gap: 18px; margin-top: 2rem; }
  .spd-masonry > * { break-inside: avoid; margin-bottom: 18px; display: block; }
  .spd-card { padding: clamp(24px, 3vw, 40px); background: rgba(20,20,20,0.7); border: 1px solid rgba(255,255,255,0.08); position: relative; overflow: hidden; transition: transform 0.3s; }
  .spd-card::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background: linear-gradient(90deg, var(--spd-red), var(--spd-blue)); }
  .spd-surf-comic .spd-card { background: rgba(255,255,255,0.9); border-color: rgba(0,0,0,0.1); }
  .spd-card-n { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: rgba(var(--spd-acc),1); letter-spacing: 0.04em; display: block; margin-bottom: 14px; }
  .spd-card-t { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px, 2.2vw, 30px); letter-spacing: 0.02em; margin-bottom: 10px; color: var(--spd-white); }
  .spd-surf-comic .spd-card-t { color: var(--spd-black); }
  .spd-card-d { font-size: 14px; line-height: 1.7; color: rgba(245,245,245,0.7); font-weight: 300; }
  .spd-surf-comic .spd-card-d { color: rgba(10,10,10,0.7); }
  .spd-bento .spd-card.b-wide  { grid-column: span 4; }
  .spd-bento .spd-card.b-half  { grid-column: span 3; }
  .spd-bento .spd-card.b-third { grid-column: span 2; }
  .spd-bento .spd-card.b-tall  { grid-row: span 2; }

  /* ── Spider emblem decoration on cards ── */
  .spd-emblem { width: 42px; height: 42px; background: var(--spd-red); display: block; margin-bottom: 18px;
    clip-path: polygon(50% 8%, 56% 28%, 78% 18%, 64% 36%, 90% 38%, 64% 46%, 78% 60%, 58% 50%, 60% 76%, 50% 56%, 40% 76%, 42% 50%, 22% 60%, 36% 46%, 10% 38%, 36% 36%, 22% 18%, 44% 28%); }

  /* ── Steps / Timeline / Manifesto ── */
  .spd-steps { display: flex; flex-direction: column; margin-top: 1.6rem; }
  .spd-step { display: flex; gap: 32px; padding: 28px 0; border-top: 1px solid rgba(255,255,255,0.1); align-items: baseline; }
  .spd-step:last-child { border-bottom: 1px solid rgba(255,255,255,0.1); }
  .spd-step-n { font-family: 'Bebas Neue', sans-serif; font-size: 56px; color: rgba(var(--spd-acc),1); line-height: 0.9; min-width: 90px; }
  .spd-step-t { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px, 2.2vw, 28px); letter-spacing: 0.02em; margin-bottom: 8px; color: var(--spd-white); }
  .spd-step-d { font-size: 14.5px; line-height: 1.7; color: rgba(245,245,245,0.72); font-weight: 300; }
  .spd-surf-comic .spd-step-t { color: var(--spd-black); }
  .spd-surf-comic .spd-step-d { color: rgba(10,10,10,0.7); }
  .spd-surf-comic .spd-step { border-color: rgba(0,0,0,0.12); }

  /* ── Manifesto ── */
  .spd-manifesto { display:flex; flex-direction:column; margin-top: 1.6rem; }
  .spd-mrow { display:grid; grid-template-columns: 100px 1fr; gap: 32px; padding: 32px 0; border-top: 1px solid rgba(255,255,255,0.1); align-items: baseline; }
  .spd-mrow:last-child { border-bottom: 1px solid rgba(255,255,255,0.1); }
  .spd-mrow-n { font-family: 'Bebas Neue', sans-serif; font-size: 48px; color: rgba(var(--spd-acc),1); }
  .spd-mrow-t { font-family: 'Bebas Neue', sans-serif; font-size: clamp(26px, 2.6vw, 34px); letter-spacing: 0.02em; color: var(--spd-white); }
  .spd-mrow-d { font-size: 15px; line-height: 1.75; color: rgba(245,245,245,0.72); margin-top: 8px; font-weight: 300; }

  /* ── Quote / Big ── */
  .spd-quote { font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px, 6vw, 84px); line-height: 1.05; letter-spacing: 0.02em; color: var(--spd-white); max-width: 1000px; margin: 0 auto; text-align: center; }
  .spd-quote em { color: var(--spd-red); font-style: normal; }
  .spd-quote::before { content: '"'; font-family: 'Bebas Neue', sans-serif; font-size: 1.4em; color: var(--spd-red); display: block; line-height: 0.6; margin-bottom: 16px; }
  .spd-attr  { font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(245,245,245,0.55); margin-top: 32px; text-align: center; }
  .spd-big   { font-family: 'Bebas Neue', sans-serif; font-size: clamp(120px, 22vw, 320px); line-height: 0.85; letter-spacing: -0.02em; color: var(--spd-red); text-align: center; text-shadow: 0 0 60px rgba(226,54,54,0.4); }

  /* ── Compare ── */
  .spd-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 2rem; }
  .spd-compare-col { padding: clamp(28px,3vw,42px); border: 1px solid rgba(255,255,255,0.1); background: rgba(20,20,20,0.6); }
  .spd-compare-col:first-child { border-top: 4px solid var(--spd-red); }
  .spd-compare-col:last-child  { border-top: 4px solid var(--spd-blue); }
  .spd-compare-col h3 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(26px,2.6vw,34px); letter-spacing: 0.02em; margin-bottom: 18px; color: var(--spd-white); }
  .spd-compare-col p { font-size: 14.5px; line-height: 1.7; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 0; color: rgba(245,245,245,0.78); font-weight: 300; }

  /* ── Editorial split ── */
  .spd-editorial { display:grid; grid-template-columns: 1fr 1.3fr; gap: 56px; align-items: start; margin-top: 1rem; }
  .spd-edcol-l h2 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px,5vw,72px); line-height: 0.95; letter-spacing: 0.01em; margin-bottom: 18px; }
  .spd-edcol-r p { font-size: 15.5px; line-height: 1.85; color: rgba(245,245,245,0.78); margin-bottom: 14px; font-weight: 300; }

  /* ── Pills ── */
  .spd-pills { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 2rem; }
  .spd-pill { font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 0.18em; text-transform: uppercase; padding: 12px 22px; border: 2px solid rgba(var(--spd-acc),0.85); color: rgba(var(--spd-acc),1); background: transparent; border-radius: 2px; }

  /* ── Timeline ── */
  .spd-timeline { display:flex; flex-direction:column; margin-top: 1.6rem; }
  .spd-trow { display:grid; grid-template-columns: 140px 1fr; gap: 32px; padding: 24px 0; border-top: 1px solid rgba(255,255,255,0.1); align-items: baseline; }
  .spd-trow:last-child { border-bottom: 1px solid rgba(255,255,255,0.1); }
  .spd-trow-n { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.16em; color: rgba(var(--spd-acc),1); }
  .spd-trow-t { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px,2vw,28px); color: var(--spd-white); margin-bottom: 6px; }
  .spd-trow-d { font-size: 14.5px; line-height: 1.7; color: rgba(245,245,245,0.72); font-weight: 300; }

  /* ── Image ── */
  .spd-img { display: block; width: 100%; max-width: 920px; max-height: 420px; object-fit: cover; margin: 2rem auto; border: 1px solid rgba(255,255,255,0.1); filter: contrast(1.05) saturate(1.1); }

  /* ── Hero spider emblem ── */
  .spd-hero-emblem { width: clamp(80px,12vw,140px); height: clamp(80px,12vw,140px); background: var(--spd-red); margin: 0 auto 32px;
    clip-path: polygon(50% 8%, 56% 28%, 78% 18%, 64% 36%, 90% 38%, 64% 46%, 78% 60%, 58% 50%, 60% 76%, 50% 56%, 40% 76%, 42% 50%, 22% 60%, 36% 46%, 10% 38%, 36% 36%, 22% 18%, 44% 28%);
    filter: drop-shadow(0 0 30px rgba(226,54,54,0.6)); }

  /* ── RTL ── */
  [dir="rtl"] .spd-sub, [dir="rtl"] .spd-body, [dir="rtl"] .spd-step-d, [dir="rtl"] .spd-card-d, [dir="rtl"] .spd-mrow-d, [dir="rtl"] .spd-trow-d { text-align: right; }
  [dir="rtl"] .spd-acc-bar { border-left: none; border-right: 4px solid rgba(var(--spd-acc),1); padding-left: 0; padding-right: 18px; }
  [dir="rtl"] .spd-acc-corner::before { right:auto; left:0; clip-path: polygon(0 0, 0 100%, 100% 0); }
  [dir="rtl"] .spd-acc-tag::before { margin-right: 0; margin-left: 12px; }
  [dir="rtl"] .spd-mrow, [dir="rtl"] .spd-trow { grid-template-columns: 1fr 100px; }
  [dir="rtl"] .spd-editorial { grid-template-columns: 1.3fr 1fr; }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .spd-bento { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .spd-bento .spd-card.b-wide, .spd-bento .spd-card.b-half { grid-column: span 3; }
    .spd-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .spd-editorial { grid-template-columns: 1fr; gap: 32px; }
  }
  @media (max-width: 640px) {
    .spd-slide { padding: 48px 18px; }
    .spd-cover { min-height: 76vh; }
    .spd-h1 { font-size: 64px !important; }
    .spd-h2 { font-size: 42px !important; }
    .spd-quote { font-size: 32px !important; }
    .spd-big { font-size: 96px !important; }
    .spd-grid-2, .spd-grid-3, .spd-compare, .spd-masonry { grid-template-columns: 1fr !important; columns: 1 !important; gap: 16px; }
    .spd-stat { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 24px 18px; }
    .spd-step-n { font-size: 40px; min-width: 60px; }
    .spd-mrow, .spd-trow { grid-template-columns: 60px 1fr; gap: 16px; }
    .spd-mrow-n { font-size: 32px; }
  }
`;

const SPD_SURFACES = ["void","card","red","blue","split","comic","ink","line"] as const;
const SPD_ACCENTS  = ["bar","top","corner","web","emblem","tag","none"] as const;
const SPD_TONES    = ["red","blue","gold","white","mix","symbiote"] as const;
const SPD_LAYOUTS  = ["bento","masonry","grid2","grid3","grid4","steps","manifesto","editorial","timeline","pills","compact","stack","emblems","split"] as const;
const SPD_ALIGNS   = ["left","right","center"] as const;

function spdHash(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function renderSpideyDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const splitTitle = (raw: string): string => {
    const safe = esc(raw);
    const words = safe.split(/\s+/);
    if (words.length < 2) return `<span class="a">${safe}</span>`;
    const mid = Math.ceil(words.length / 2);
    return `<span class="a">${words.slice(0,mid).join(" ")}</span> <span class="b">${words.slice(mid).join(" ")}</span>`;
  };

  const sections = slides.map((slide, idx) => {
    const title = slide.title || deck.title || "";
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `// ${isAr ? "فصل" : "Chapter"} ${num}`);
    const img = slide.image ? `<img class="spd-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const surface = SPD_SURFACES[spdHash(seed, 1) % SPD_SURFACES.length];
    const accent  = SPD_ACCENTS [spdHash(seed, 2) % SPD_ACCENTS.length];
    const tone    = SPD_TONES   [spdHash(seed, 3) % SPD_TONES.length];
    const layout  = SPD_LAYOUTS [spdHash(seed, 4) % SPD_LAYOUTS.length];
    const align   = SPD_ALIGNS  [spdHash(seed, 5) % SPD_ALIGNS.length];

    const slideCls = `spd-slide spd-tone-${tone} spd-align-${align}`;
    const innerCls = `spd-inner spd-surf-${surface} spd-acc-${accent}`;
    const padStyle = surface === "void" ? "" : "padding: clamp(28px, 3.5vw, 56px); border-radius: 2px;";
    const wrap = (inner: string) =>
      `<section class="${slideCls}"><div class="${innerCls}" style="${padStyle}">${inner}</div></section>`;

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<section class="${slideCls} spd-cover">
        <div class="spd-inner" style="text-align:center">
          <div class="spd-hero-emblem"></div>
          ${slide.subtitle ? `<p class="spd-tag" style="margin:0 auto 16px">${esc(slide.subtitle)}</p>` : ""}
          <h1 class="spd-h1">${splitTitle(title)}</h1>
          ${slide.cta ? `<p class="spd-sub" style="margin:0 auto;text-align:center">${esc(slide.cta)}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="${slideCls} spd-cover">
        <div class="spd-inner spd-surf-red" style="padding:clamp(40px,5vw,72px);text-align:center">
          <p class="spd-tag" style="color:rgba(255,255,255,0.8)">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${slide.subtitle ? `<p class="spd-sub" style="color:rgba(255,255,255,0.85);margin:0 auto">${esc(slide.subtitle)}</p>` : body ? `<p class="spd-sub" style="color:rgba(255,255,255,0.85);margin:0 auto">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<section class="${slideCls} spd-cover">
        <div class="spd-inner" style="text-align:center">
          <p class="spd-quote">${esc(slide.quote || title)}</p>
          ${slide.attribution ? `<div class="spd-attr">— ${esc(slide.attribution)}</div>` : ""}
        </div>
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="${slideCls} spd-cover">
        <div class="spd-inner" style="text-align:center">
          <p class="spd-tag">${label}</p>
          <div class="spd-big">${esc(slide.big_value)}</div>
          <p class="spd-sub" style="margin:24px auto 0;text-align:center">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="spd-body" style="margin:14px auto 0;text-align:center">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return wrap(`
        <p class="spd-tag">${label}</p>
        <h2 class="spd-h2">${esc(title)}</h2>
        ${body ? `<p class="spd-sub">${body}</p>` : ""}
        ${img}
        <div class="spd-stats">${stats.map(s => `<div class="spd-stat"><div class="spd-stat-v">${esc(s.value)}</div><div class="spd-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      if (layout === "manifesto") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-manifesto">${steps.map((s,i) => `<div class="spd-mrow"><div class="spd-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="spd-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="spd-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <p class="spd-tag">${label}</p>
        <h2 class="spd-h2">${esc(title)}</h2>
        ${body ? `<p class="spd-sub">${body}</p>` : ""}
        <div class="spd-steps">${steps.map((s,i) => `<div class="spd-step"><div class="spd-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="spd-step-t">${esc(s.title)}</div>${s.desc ? `<div class="spd-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return wrap(`
        <p class="spd-tag">${label}</p>
        <h2 class="spd-h2">${esc(title)}</h2>
        <div class="spd-timeline">${events.map(e => `<div class="spd-trow"><div class="spd-trow-n">${esc(e.date)}</div><div><div class="spd-trow-t">${esc(e.title)}</div>${e.desc ? `<div class="spd-trow-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return wrap(`
        <p class="spd-tag">${label}</p>
        <h2 class="spd-h2">${esc(title)}</h2>
        <div class="spd-compare">
          <div class="spd-compare-col"><h3>${esc(slide.left_title || (isAr ? "أ" : "A"))}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div class="spd-compare-col"><h3>${esc(slide.right_title || (isAr ? "ب" : "B"))}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:：—–-]\s+/);
        const t = parts[0];
        const d = parts.slice(1).join(" — ");
        return { t, d, n: String(i + 1).padStart(2, "0") };
      });

      if (layout === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-bento">${cards.map((c,i) => `<div class="spd-card ${spans[i % spans.length]}"><span class="spd-card-n">${c.n}</span><div class="spd-card-t">${esc(c.t)}</div>${c.d ? `<div class="spd-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "masonry") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-masonry">${cards.map(c => `<div class="spd-card"><span class="spd-card-n">${c.n}</span><div class="spd-card-t">${esc(c.t)}</div>${c.d ? `<div class="spd-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "grid2" || layout === "grid3" || layout === "grid4") {
        const gcls = layout === "grid4" ? "spd-grid-4" : layout === "grid2" ? "spd-grid-2" : "spd-grid-3";
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="${gcls}">${cards.map(c => `<div class="spd-card"><span class="spd-card-n">${c.n}</span><div class="spd-card-t">${esc(c.t)}</div>${c.d ? `<div class="spd-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "emblems") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-grid-3">${cards.map(c => `<div class="spd-card"><span class="spd-emblem"></span><span class="spd-card-n">${c.n}</span><div class="spd-card-t">${esc(c.t)}</div>${c.d ? `<div class="spd-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "steps") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-steps">${cards.map(c => `<div class="spd-step"><div class="spd-step-n">${c.n}</div><div><div class="spd-step-t">${esc(c.t)}</div>${c.d ? `<div class="spd-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "manifesto") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-manifesto">${cards.map(c => `<div class="spd-mrow"><div class="spd-mrow-n">${c.n}</div><div><div class="spd-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="spd-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "timeline") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-timeline">${cards.map(c => `<div class="spd-trow"><div class="spd-trow-n">EP ${c.n}</div><div><div class="spd-trow-t">${esc(c.t)}</div>${c.d ? `<div class="spd-trow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "editorial" || layout === "split") {
        return wrap(`
          <div class="spd-editorial">
            <div class="spd-edcol-l"><p class="spd-tag">${label}</p><h2>${esc(title)}</h2>${img}</div>
            <div class="spd-edcol-r">${body ? `<p>${body}</p>` : ""}${cards.map(c => `<p><strong style="font-family:'Bebas Neue',sans-serif;font-size:1.3em;letter-spacing:0.02em;color:var(--spd-red);">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div>
          </div>
        `);
      }
      if (layout === "pills") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <div class="spd-pills">${cards.map(c => `<span class="spd-pill">${esc(c.t)}</span>`).join("")}</div>
        `);
      }
      if (layout === "compact") {
        return wrap(`
          <p class="spd-tag">${label}</p>
          <h2 class="spd-h2">${esc(title)}</h2>
          ${body ? `<p class="spd-sub">${body}</p>` : ""}
          <ol style="list-style:none;padding:0;margin:1.6rem 0 0;border-top:1px solid rgba(255,255,255,0.1)">
            ${cards.map(c => `<li style="padding:20px 0;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;gap:24px;align-items:baseline"><span style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--spd-red);min-width:50px">${c.n}</span><div><div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:0.02em;color:var(--spd-white);margin-bottom:4px">${esc(c.t)}</div>${c.d ? `<div style="font-size:14.5px;line-height:1.7;color:rgba(245,245,245,0.7)">${esc(c.d)}</div>` : ""}</div></li>`).join("")}
          </ol>
        `);
      }
      // stack default
      return wrap(`
        <p class="spd-tag">${label}</p>
        <h2 class="spd-h2">${esc(title)}</h2>
        ${body ? `<p class="spd-sub">${body}</p>` : ""}
        ${img}
        <div class="spd-grid-2">${cards.map(c => `<div class="spd-card"><span class="spd-card-n">${c.n}</span><div class="spd-card-t">${esc(c.t)}</div>${c.d ? `<div class="spd-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
      `);
    }

    return wrap(`
      <p class="spd-tag">${label}</p>
      <h2 class="spd-h2">${esc(title)}</h2>
      ${body ? `<p class="spd-body">${body}</p>` : ""}
      ${img}
    `);
  });

  return `<div class="spd-web"></div><div class="spd-root">\n${sections.join("\n")}\n</div>`;
}



/* ────────────────────────────────────────────────────────── */
/* Yash — Designer Folio renderer                             */
/* ~8 surfaces × 7 accents × 7 tones × 14 layouts × 3 aligns  */
/* = 16,464 unique slide variants                             */
/* ────────────────────────────────────────────────────────── */
const YASH_LOCK_CSS = `
  :root {
    --yf-bg:#0e0e10; --yf-text:#f0ece6; --yf-muted:rgba(240,236,230,0.55);
    --yf-line:rgba(240,236,230,0.12);
    --yf-pink:#d94f7a; --yf-purple:#8b5cf6; --yf-blue:#4a6cf7;
  }
  html, body { background: var(--yf-bg) !important; color: var(--yf-text) !important;
    font-family: 'Inter', system-ui, sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > *:not(.yf-root):not(.yf-orbs) { display: none !important; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--yf-bg); }
  ::-webkit-scrollbar-thumb { background: var(--yf-pink); border-radius: 3px; }

  /* Ambient gradient orbs */
  .yf-orbs { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .yf-orbs::before, .yf-orbs::after { content:""; position:absolute; width:60vw; height:60vw;
    border-radius: 50%; filter: blur(120px); opacity: 0.35; }
  .yf-orbs::before { top:-20vw; left:-10vw; background: radial-gradient(circle, var(--yf-pink), transparent 70%); }
  .yf-orbs::after  { bottom:-20vw; right:-15vw; background: radial-gradient(circle, var(--yf-purple), transparent 70%); }
  .yf-root { position: relative; z-index: 2; }

  /* Tonal palettes */
  .yf-tone-pink   { --yf-acc: 217,79,122;  --yf-acc2: 139,92,246; }
  .yf-tone-purple { --yf-acc: 139,92,246;  --yf-acc2: 74,108,247; }
  .yf-tone-blue   { --yf-acc: 74,108,247;  --yf-acc2: 139,92,246; }
  .yf-tone-mix    { --yf-acc: 217,79,122;  --yf-acc2: 139,92,246; }
  .yf-tone-aurora { --yf-acc: 139,92,246;  --yf-acc2: 217,79,122; }
  .yf-tone-mono   { --yf-acc: 240,236,230; --yf-acc2: 240,236,230; }
  .yf-tone-ember  { --yf-acc: 217,79,122;  --yf-acc2: 245,158,11; }

  /* Slide frame */
  .yf-slide { min-height: auto; padding: clamp(64px,10vh,140px) clamp(20px,6vw,80px); position:relative;
    max-width: 1280px; margin: 0 auto; display:flex; flex-direction:column; justify-content:center; }
  .yf-cover { min-height: 96vh; align-items:center; }
  .yf-inner { width:100%; max-width:1200px; margin:0 auto; position:relative; z-index:2; }
  .yf-slide.yf-align-left  .yf-inner { margin-left: 4%; margin-right:auto; text-align:left; }
  .yf-slide.yf-align-right .yf-inner { margin-left:auto; margin-right: 4%; text-align:right; }
  .yf-slide.yf-align-center .yf-inner { text-align:center; }

  /* Surfaces */
  .yf-surf-void    { background: transparent; }
  .yf-surf-card    { background: rgba(20,20,24,0.55); backdrop-filter: blur(12px); border:1px solid var(--yf-line); border-radius: 18px; }
  .yf-surf-pink    { background: linear-gradient(135deg, rgba(217,79,122,0.18), rgba(217,79,122,0.04)); border:1px solid rgba(217,79,122,0.35); border-radius: 18px; }
  .yf-surf-purple  { background: linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.04)); border:1px solid rgba(139,92,246,0.35); border-radius: 18px; }
  .yf-surf-blue    { background: linear-gradient(135deg, rgba(74,108,247,0.18), rgba(74,108,247,0.04)); border:1px solid rgba(74,108,247,0.35); border-radius: 18px; }
  .yf-surf-grad    { background: linear-gradient(135deg, rgba(217,79,122,0.2), rgba(139,92,246,0.2) 50%, rgba(74,108,247,0.2)); border:1px solid var(--yf-line); border-radius: 18px; }
  .yf-surf-mono    { background: rgba(240,236,230,0.04); border:1px solid var(--yf-line); border-radius: 18px; }
  .yf-surf-outline { background: transparent; border:1px solid rgba(var(--yf-acc),0.5); border-radius: 18px; }

  /* Accents */
  .yf-acc-bar    { border-left: 2px solid rgba(var(--yf-acc),1); padding-left: 22px; }
  .yf-acc-top    { box-shadow: inset 0 2px 0 0 rgba(var(--yf-acc),1); }
  .yf-acc-corner::before { content:""; position:absolute; top:0; right:0; width:36px; height:36px;
    background: linear-gradient(135deg, rgba(var(--yf-acc),1), rgba(var(--yf-acc2),0.6));
    clip-path: polygon(100% 0, 100% 100%, 0 0); z-index:2; border-top-right-radius:18px; }
  .yf-acc-dot::before { content:""; position:absolute; top:24px; right:24px; width:12px; height:12px;
    border-radius:50%; background: rgba(var(--yf-acc),1); box-shadow: 0 0 24px rgba(var(--yf-acc),0.8); z-index:2; }
  .yf-acc-halo   { box-shadow: 0 0 80px -20px rgba(var(--yf-acc),0.6); }
  .yf-acc-tag::before { content: "→"; color: rgba(var(--yf-acc),1); font-weight:600; margin-right:10px; }
  .yf-acc-cursor::after { content: ""; position:absolute; bottom:18px; right:18px; width:10px; height:10px;
    background: var(--yf-text); border-radius:50%; mix-blend-mode:difference;
    box-shadow: 0 0 0 1.5px rgba(240,236,230,0.4), 0 0 0 18px transparent; }

  /* Typography */
  .yf-tag  { font-family:'Space Grotesk','Inter',sans-serif; font-size:12px; letter-spacing:0.28em;
    text-transform:uppercase; color: rgba(var(--yf-acc),1); font-weight:500; margin-bottom:22px; display:inline-block; }
  .yf-h1   { font-family:'Space Grotesk','Inter',sans-serif; font-size: clamp(40px,7vw,96px); line-height:1.0;
    letter-spacing:-0.03em; font-weight:600; margin-bottom: 28px; overflow-wrap:anywhere; color: var(--yf-text); }
  .yf-h1 em { font-style: italic; font-weight:400;
    background: linear-gradient(135deg, var(--yf-pink), var(--yf-purple), var(--yf-blue));
    -webkit-background-clip:text; background-clip:text; color: transparent; }
  .yf-h2   { font-family:'Space Grotesk','Inter',sans-serif; font-size: clamp(32px,4.6vw,64px); line-height:1.05;
    letter-spacing:-0.025em; font-weight:500; margin-bottom: 22px; overflow-wrap:anywhere; }
  .yf-sub  { font-family:'Inter',sans-serif; font-size: clamp(15px,1.5vw,19px); line-height:1.7;
    color: rgba(240,236,230,0.7); font-weight:300; max-width: 680px; margin-bottom: 18px; }
  .yf-body { font-family:'Inter',sans-serif; font-size: clamp(15px,1.5vw,18px); line-height:1.75;
    color: rgba(240,236,230,0.78); font-weight:300; max-width: 720px; margin-bottom: 14px; }
  .yf-slide.yf-align-center .yf-sub, .yf-slide.yf-align-center .yf-body { margin-left:auto; margin-right:auto; }

  /* Stats */
  .yf-stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:0;
    margin-top:2rem; border-top:1px solid var(--yf-line); border-bottom:1px solid var(--yf-line); }
  .yf-stat { padding:36px 24px; border-right:1px solid var(--yf-line); }
  .yf-stat:last-child { border-right:none; }
  .yf-stat-v { font-family:'Space Grotesk',sans-serif; font-size: clamp(40px,6vw,72px); line-height:1;
    letter-spacing:-0.02em; font-weight:500;
    background: linear-gradient(135deg, rgba(var(--yf-acc),1), rgba(var(--yf-acc2),1));
    -webkit-background-clip:text; background-clip:text; color: transparent; }
  .yf-stat-l { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color: var(--yf-muted); margin-top:14px; }

  /* Grids */
  .yf-grid-2 { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:20px; margin-top:2rem; }
  .yf-grid-3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:18px; margin-top:2rem; }
  .yf-grid-4 { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:16px; margin-top:2rem; }
  .yf-bento  { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(140px,auto); gap:16px; margin-top:2rem; }
  .yf-masonry { columns:2; column-gap:18px; margin-top:2rem; }
  .yf-masonry > * { break-inside:avoid; margin-bottom:18px; display:block; }
  .yf-card { padding: clamp(22px,2.8vw,36px); background: rgba(240,236,230,0.03); border:1px solid var(--yf-line);
    border-radius: 14px; position:relative; overflow:hidden; transition: transform .35s ease, border-color .35s ease; }
  .yf-card:hover { border-color: rgba(var(--yf-acc),0.5); }
  .yf-card::before { content:""; position:absolute; top:0; left:0; right:0; height:1px;
    background: linear-gradient(90deg, transparent, rgba(var(--yf-acc),0.8), transparent); }
  .yf-card-n { font-family:'Space Grotesk',sans-serif; font-size:13px; letter-spacing:0.22em;
    color: rgba(var(--yf-acc),1); display:block; margin-bottom:14px; font-weight:500; }
  .yf-card-t { font-family:'Space Grotesk',sans-serif; font-size: clamp(20px,2.1vw,26px); letter-spacing:-0.01em;
    font-weight:500; margin-bottom:10px; color: var(--yf-text); }
  .yf-card-d { font-size:14.5px; line-height:1.7; color: rgba(240,236,230,0.7); font-weight:300; }
  .yf-bento .yf-card.b-wide  { grid-column: span 4; }
  .yf-bento .yf-card.b-half  { grid-column: span 3; }
  .yf-bento .yf-card.b-third { grid-column: span 2; }
  .yf-bento .yf-card.b-tall  { grid-row: span 2; }

  /* Steps / Manifesto / Timeline */
  .yf-steps { display:flex; flex-direction:column; margin-top:1.6rem; }
  .yf-step { display:grid; grid-template-columns: 80px 1fr; gap:28px; padding:26px 0;
    border-top:1px solid var(--yf-line); align-items:baseline; }
  .yf-step:last-child { border-bottom:1px solid var(--yf-line); }
  .yf-step-n { font-family:'Space Grotesk',sans-serif; font-size:42px; line-height:0.9; font-weight:300;
    color: rgba(var(--yf-acc),1); }
  .yf-step-t { font-family:'Space Grotesk',sans-serif; font-size: clamp(20px,2.1vw,26px); font-weight:500;
    letter-spacing:-0.01em; margin-bottom:8px; color: var(--yf-text); }
  .yf-step-d { font-size:14.5px; line-height:1.75; color: rgba(240,236,230,0.72); font-weight:300; }

  .yf-manifesto { display:flex; flex-direction:column; margin-top:1.6rem; }
  .yf-mrow { display:grid; grid-template-columns: 100px 1fr; gap:32px; padding:32px 0;
    border-top:1px solid var(--yf-line); align-items:baseline; }
  .yf-mrow:last-child { border-bottom:1px solid var(--yf-line); }
  .yf-mrow-n { font-family:'Space Grotesk',sans-serif; font-size:36px; font-weight:300;
    color: rgba(var(--yf-acc),1); }
  .yf-mrow-t { font-family:'Space Grotesk',sans-serif; font-size: clamp(24px,2.4vw,32px); font-weight:500;
    letter-spacing:-0.015em; color: var(--yf-text); }
  .yf-mrow-d { font-size:15px; line-height:1.75; color: rgba(240,236,230,0.72); margin-top:10px; font-weight:300; }

  .yf-timeline { display:flex; flex-direction:column; margin-top:1.6rem; }
  .yf-trow { display:grid; grid-template-columns: 140px 1fr; gap:32px; padding:24px 0;
    border-top:1px solid var(--yf-line); align-items:baseline; }
  .yf-trow:last-child { border-bottom:1px solid var(--yf-line); }
  .yf-trow-n { font-family:'Space Grotesk',sans-serif; font-size:14px; letter-spacing:0.16em;
    text-transform:uppercase; color: rgba(var(--yf-acc),1); font-weight:500; }
  .yf-trow-t { font-family:'Space Grotesk',sans-serif; font-size: clamp(20px,2vw,26px); font-weight:500;
    color: var(--yf-text); margin-bottom:6px; }
  .yf-trow-d { font-size:14.5px; line-height:1.7; color: rgba(240,236,230,0.72); font-weight:300; }

  /* Quote / Big */
  .yf-quote { font-family:'Space Grotesk',sans-serif; font-size: clamp(32px,5vw,68px); line-height:1.15;
    letter-spacing:-0.025em; font-weight:400; color: var(--yf-text); max-width:1000px; margin:0 auto; }
  .yf-quote em { font-style:italic; font-weight:300;
    background: linear-gradient(135deg, var(--yf-pink), var(--yf-purple));
    -webkit-background-clip:text; background-clip:text; color: transparent; }
  .yf-attr { font-size:12px; letter-spacing:0.28em; text-transform:uppercase; color: var(--yf-muted); margin-top:32px; }
  .yf-big  { font-family:'Space Grotesk',sans-serif; font-size: clamp(96px,18vw,260px); line-height:0.9;
    letter-spacing:-0.04em; font-weight:300;
    background: linear-gradient(135deg, var(--yf-pink), var(--yf-purple), var(--yf-blue));
    -webkit-background-clip:text; background-clip:text; color: transparent; text-align:center; }

  /* Compare */
  .yf-compare { display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-top:2rem; }
  .yf-ccol { padding: clamp(26px,3vw,40px); border:1px solid var(--yf-line); border-radius:14px;
    background: rgba(240,236,230,0.03); }
  .yf-ccol:first-child { border-top:2px solid var(--yf-pink); }
  .yf-ccol:last-child  { border-top:2px solid var(--yf-purple); }
  .yf-ccol h3 { font-family:'Space Grotesk',sans-serif; font-size: clamp(22px,2.4vw,30px); font-weight:500;
    letter-spacing:-0.015em; margin-bottom:18px; color: var(--yf-text); }
  .yf-ccol p { font-size:14.5px; line-height:1.7; padding:10px 0; border-top:1px solid var(--yf-line);
    margin:0; color: rgba(240,236,230,0.78); font-weight:300; }

  /* Editorial */
  .yf-editorial { display:grid; grid-template-columns: 1fr 1.3fr; gap:56px; align-items:start; margin-top:1rem; }
  .yf-ecol-l h2 { font-family:'Space Grotesk',sans-serif; font-size: clamp(32px,4.6vw,60px); line-height:1.0;
    letter-spacing:-0.025em; font-weight:500; margin-bottom:18px; }
  .yf-ecol-r p { font-size:15.5px; line-height:1.85; color: rgba(240,236,230,0.78); margin-bottom:14px; font-weight:300; }

  /* Pills */
  .yf-pills { display:flex; flex-wrap:wrap; gap:10px; margin-top:2rem; }
  .yf-pill  { font-family:'Inter',sans-serif; font-size:13px; letter-spacing:0.08em; padding:10px 18px;
    border:1px solid rgba(var(--yf-acc),0.5); color: rgba(var(--yf-acc),1); border-radius: 999px;
    background: rgba(var(--yf-acc),0.06); }

  /* Image */
  .yf-img { display:block; width:100%; max-width:920px; max-height:420px; object-fit:cover;
    margin:2rem auto; border:1px solid var(--yf-line); border-radius:14px;
    filter: contrast(1.05) saturate(1.05); }

  /* Hero glyph */
  .yf-hero-glyph { width: clamp(80px,12vw,140px); height: clamp(80px,12vw,140px);
    background: conic-gradient(from 180deg, var(--yf-pink), var(--yf-purple), var(--yf-blue), var(--yf-pink));
    border-radius:50%; filter: blur(0.5px) drop-shadow(0 0 40px rgba(217,79,122,0.5));
    margin: 0 auto 32px; opacity: 0.9; }

  /* RTL */
  [dir="rtl"] .yf-sub, [dir="rtl"] .yf-body, [dir="rtl"] .yf-card-d, [dir="rtl"] .yf-step-d,
  [dir="rtl"] .yf-mrow-d, [dir="rtl"] .yf-trow-d { text-align: right; }
  [dir="rtl"] .yf-acc-bar { border-left:none; border-right:2px solid rgba(var(--yf-acc),1); padding-left:0; padding-right:22px; }
  [dir="rtl"] .yf-acc-corner::before { right:auto; left:0; clip-path: polygon(0 0, 0 100%, 100% 0); border-top-right-radius:0; border-top-left-radius:18px; }
  [dir="rtl"] .yf-acc-dot::before, [dir="rtl"] .yf-acc-cursor::after { right:auto; left:24px; }
  [dir="rtl"] .yf-acc-tag::before { margin-right:0; margin-left:10px; content:"←"; }
  [dir="rtl"] .yf-mrow, [dir="rtl"] .yf-trow, [dir="rtl"] .yf-step { grid-template-columns: 1fr 100px; }
  [dir="rtl"] .yf-editorial { grid-template-columns: 1.3fr 1fr; }

  /* Responsive */
  @media (max-width: 1024px) {
    .yf-bento { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .yf-bento .yf-card.b-wide, .yf-bento .yf-card.b-half { grid-column: span 3; }
    .yf-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .yf-editorial { grid-template-columns: 1fr; gap:32px; }
  }
  @media (max-width: 640px) {
    .yf-slide { padding: 48px 18px; }
    .yf-cover { min-height: 76vh; }
    .yf-h1 { font-size: 48px !important; }
    .yf-h2 { font-size: 34px !important; }
    .yf-quote { font-size: 28px !important; }
    .yf-big { font-size: 80px !important; }
    .yf-grid-2, .yf-grid-3, .yf-compare, .yf-masonry { grid-template-columns: 1fr !important; columns: 1 !important; gap: 16px; }
    .yf-stat { border-right: none; border-bottom: 1px solid var(--yf-line); padding: 24px 18px; }
    .yf-mrow, .yf-trow, .yf-step { grid-template-columns: 60px 1fr; gap: 16px; }
    .yf-mrow-n, .yf-step-n { font-size: 28px; }
  }
`;

const YF_SURFACES = ["void","card","pink","purple","blue","grad","mono","outline"] as const;
const YF_ACCENTS  = ["bar","top","corner","dot","halo","tag","cursor","none"] as const;
const YF_TONES    = ["pink","purple","blue","mix","aurora","mono","ember"] as const;
const YF_LAYOUTS  = ["bento","masonry","grid2","grid3","grid4","steps","manifesto","editorial","timeline","pills","compact","stack","split","cards"] as const;
const YF_ALIGNS   = ["left","right","center"] as const;

function yfHash(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function renderYashFolioDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const accentTitle = (raw: string): string => {
    const safe = esc(raw);
    const words = safe.split(/\s+/);
    if (words.length < 2) return safe;
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>`;
  };

  const sections = slides.map((slide, idx) => {
    const title = slide.title || deck.title || "";
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `${num} · ${isAr ? "فصل" : "Chapter"} ${num}`);
    const img = slide.image ? `<img class="yf-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const surface = YF_SURFACES[yfHash(seed, 1) % YF_SURFACES.length];
    const accent  = YF_ACCENTS [yfHash(seed, 2) % YF_ACCENTS.length];
    const tone    = YF_TONES   [yfHash(seed, 3) % YF_TONES.length];
    const layout  = YF_LAYOUTS [yfHash(seed, 4) % YF_LAYOUTS.length];
    const align   = YF_ALIGNS  [yfHash(seed, 5) % YF_ALIGNS.length];

    const slideCls = `yf-slide yf-tone-${tone} yf-align-${align}`;
    const innerCls = `yf-inner yf-surf-${surface} yf-acc-${accent}`;
    const padStyle = surface === "void" ? "" : "padding: clamp(28px,3.5vw,56px);";
    const wrap = (inner: string) =>
      `<section class="${slideCls}"><div class="${innerCls}" style="${padStyle}">${inner}</div></section>`;

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<section class="${slideCls} yf-cover">
        <div class="yf-inner" style="text-align:center">
          <div class="yf-hero-glyph"></div>
          ${slide.subtitle ? `<p class="yf-tag" style="margin:0 auto 18px">${esc(slide.subtitle)}</p>` : ""}
          <h1 class="yf-h1">${accentTitle(title)}</h1>
          ${slide.cta ? `<p class="yf-sub" style="margin:0 auto">${esc(slide.cta)}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="${slideCls} yf-cover">
        <div class="yf-inner yf-surf-grad" style="padding:clamp(40px,5vw,72px);text-align:center;border-radius:18px">
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${slide.subtitle ? `<p class="yf-sub" style="margin:0 auto">${esc(slide.subtitle)}</p>` : body ? `<p class="yf-sub" style="margin:0 auto">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      const q = esc(slide.quote || title);
      const words = q.split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      const quoteHtml = words.length > 3 ? `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>` : q;
      return `<section class="${slideCls} yf-cover">
        <div class="yf-inner" style="text-align:center">
          <p class="yf-quote">"${quoteHtml}"</p>
          ${slide.attribution ? `<div class="yf-attr">— ${esc(slide.attribution)}</div>` : ""}
        </div>
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="${slideCls} yf-cover">
        <div class="yf-inner" style="text-align:center">
          <p class="yf-tag">${label}</p>
          <div class="yf-big">${esc(slide.big_value)}</div>
          <p class="yf-sub" style="margin:28px auto 0">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="yf-body" style="margin:14px auto 0">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return wrap(`
        <p class="yf-tag">${label}</p>
        <h2 class="yf-h2">${esc(title)}</h2>
        ${body ? `<p class="yf-sub">${body}</p>` : ""}
        ${img}
        <div class="yf-stats">${stats.map(s => `<div class="yf-stat"><div class="yf-stat-v">${esc(s.value)}</div><div class="yf-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      if (layout === "manifesto") {
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="yf-manifesto">${steps.map((s,i) => `<div class="yf-mrow"><div class="yf-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="yf-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="yf-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <p class="yf-tag">${label}</p>
        <h2 class="yf-h2">${esc(title)}</h2>
        ${body ? `<p class="yf-sub">${body}</p>` : ""}
        <div class="yf-steps">${steps.map((s,i) => `<div class="yf-step"><div class="yf-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="yf-step-t">${esc(s.title)}</div>${s.desc ? `<div class="yf-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return wrap(`
        <p class="yf-tag">${label}</p>
        <h2 class="yf-h2">${esc(title)}</h2>
        <div class="yf-timeline">${events.map(e => `<div class="yf-trow"><div class="yf-trow-n">${esc(e.date)}</div><div><div class="yf-trow-t">${esc(e.title)}</div>${e.desc ? `<div class="yf-trow-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return wrap(`
        <p class="yf-tag">${label}</p>
        <h2 class="yf-h2">${esc(title)}</h2>
        <div class="yf-compare">
          <div class="yf-ccol"><h3>${esc(slide.left_title || (isAr ? "أ" : "A"))}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div class="yf-ccol"><h3>${esc(slide.right_title || (isAr ? "ب" : "B"))}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:：—–-]\s+/);
        return { t: parts[0], d: parts.slice(1).join(" — "), n: String(i + 1).padStart(2, "0") };
      });

      if (layout === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="yf-bento">${cards.map((c,i) => `<div class="yf-card ${spans[i % spans.length]}"><span class="yf-card-n">${c.n}</span><div class="yf-card-t">${esc(c.t)}</div>${c.d ? `<div class="yf-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "masonry") {
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="yf-masonry">${cards.map(c => `<div class="yf-card"><span class="yf-card-n">${c.n}</span><div class="yf-card-t">${esc(c.t)}</div>${c.d ? `<div class="yf-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "grid2" || layout === "grid3" || layout === "grid4" || layout === "cards") {
        const gcls = layout === "grid4" ? "yf-grid-4" : layout === "grid2" ? "yf-grid-2" : "yf-grid-3";
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="${gcls}">${cards.map(c => `<div class="yf-card"><span class="yf-card-n">${c.n}</span><div class="yf-card-t">${esc(c.t)}</div>${c.d ? `<div class="yf-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "steps") {
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="yf-steps">${cards.map(c => `<div class="yf-step"><div class="yf-step-n">${c.n}</div><div><div class="yf-step-t">${esc(c.t)}</div>${c.d ? `<div class="yf-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "manifesto") {
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="yf-manifesto">${cards.map(c => `<div class="yf-mrow"><div class="yf-mrow-n">${c.n}</div><div><div class="yf-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="yf-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "timeline") {
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="yf-timeline">${cards.map(c => `<div class="yf-trow"><div class="yf-trow-n">${isAr ? "م" : "·"} ${c.n}</div><div><div class="yf-trow-t">${esc(c.t)}</div>${c.d ? `<div class="yf-trow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "editorial" || layout === "split") {
        return wrap(`
          <div class="yf-editorial">
            <div class="yf-ecol-l"><p class="yf-tag">${label}</p><h2>${esc(title)}</h2>${img}</div>
            <div class="yf-ecol-r">${body ? `<p>${body}</p>` : ""}${cards.map(c => `<p><strong style="font-family:'Space Grotesk',sans-serif;font-weight:500;color:rgba(var(--yf-acc),1);">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div>
          </div>
        `);
      }
      if (layout === "pills") {
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <div class="yf-pills">${cards.map(c => `<span class="yf-pill">${esc(c.t)}</span>`).join("")}</div>
        `);
      }
      if (layout === "compact") {
        return wrap(`
          <p class="yf-tag">${label}</p>
          <h2 class="yf-h2">${esc(title)}</h2>
          ${body ? `<p class="yf-sub">${body}</p>` : ""}
          <ol style="list-style:none;padding:0;margin:1.6rem 0 0;border-top:1px solid var(--yf-line)">
            ${cards.map(c => `<li style="padding:20px 0;border-bottom:1px solid var(--yf-line);display:grid;grid-template-columns:60px 1fr;gap:24px;align-items:baseline"><span style="font-family:'Space Grotesk',sans-serif;font-size:22px;color:rgba(var(--yf-acc),1);font-weight:300">${c.n}</span><div><div style="font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:var(--yf-text);margin-bottom:4px">${esc(c.t)}</div>${c.d ? `<div style="font-size:14.5px;line-height:1.7;color:rgba(240,236,230,0.7)">${esc(c.d)}</div>` : ""}</div></li>`).join("")}
          </ol>
        `);
      }
      // stack default
      return wrap(`
        <p class="yf-tag">${label}</p>
        <h2 class="yf-h2">${esc(title)}</h2>
        ${body ? `<p class="yf-sub">${body}</p>` : ""}
        ${img}
        <div class="yf-grid-2">${cards.map(c => `<div class="yf-card"><span class="yf-card-n">${c.n}</span><div class="yf-card-t">${esc(c.t)}</div>${c.d ? `<div class="yf-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
      `);
    }

    return wrap(`
      <p class="yf-tag">${label}</p>
      <h2 class="yf-h2">${esc(title)}</h2>
      ${body ? `<p class="yf-body">${body}</p>` : ""}
      ${img}
    `);
  });

  return `<div class="yf-orbs"></div><div class="yf-root">\n${sections.join("\n")}\n</div>`;
}

/* ================================================================== */
/* Storm to Calm — Editorial Scrolling                                 */
/* Combinatorial system: 10 surfaces × 9 accents × 8 tones × 16 layouts × 4 aligns
/*   = 46,080 unique slide variants                                    */
/* ================================================================== */

const STORM_LOCK_CSS = `
  :root {
    --st-bg:#0a0a12; --st-bg-2:#11121c; --st-text:#f4f1ea; --st-muted:rgba(244,241,234,0.55);
    --st-line:rgba(244,241,234,0.10);
    --st-storm:#3a4a8a; --st-electric:#8ca0ff; --st-calm:#a8c4d8;
    --st-gold:#d8b878; --st-rose:#c98a8a; --st-mist:#cfd6e0; --st-deep:#1a1a2e;
  }
  html, body { background: var(--st-bg) !important; color: var(--st-text) !important;
    font-family: 'Inter', system-ui, sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > *:not(.st-atmos):not(.st-root) { display: none !important; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--st-bg); }
  ::-webkit-scrollbar-thumb { background: var(--st-electric); border-radius: 3px; }

  /* Atmospheric backdrop */
  .st-atmos { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .st-atmos::before { content:""; position:absolute; inset:0;
    background:
      radial-gradient(ellipse at 15% 20%, rgba(58,74,138,0.45), transparent 55%),
      radial-gradient(ellipse at 85% 80%, rgba(168,196,216,0.18), transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(140,160,255,0.08), transparent 70%); }
  .st-atmos::after { content:""; position:absolute; inset:0; opacity:0.4;
    background-image:
      radial-gradient(1px 1px at 12% 18%, rgba(244,241,234,0.5), transparent 50%),
      radial-gradient(1px 1px at 67% 42%, rgba(244,241,234,0.4), transparent 50%),
      radial-gradient(1px 1px at 31% 71%, rgba(244,241,234,0.5), transparent 50%),
      radial-gradient(1px 1px at 88% 14%, rgba(244,241,234,0.35), transparent 50%),
      radial-gradient(1px 1px at 46% 88%, rgba(244,241,234,0.45), transparent 50%); }
  .st-root { position: relative; z-index: 2; }

  /* Tonal palettes */
  .st-tone-storm    { --st-acc: 58,74,138;   --st-acc2: 140,160,255; }
  .st-tone-electric { --st-acc: 140,160,255; --st-acc2: 58,74,138; }
  .st-tone-calm     { --st-acc: 168,196,216; --st-acc2: 207,214,224; }
  .st-tone-gold     { --st-acc: 216,184,120; --st-acc2: 201,138,138; }
  .st-tone-rose     { --st-acc: 201,138,138; --st-acc2: 216,184,120; }
  .st-tone-mist     { --st-acc: 207,214,224; --st-acc2: 168,196,216; }
  .st-tone-deep     { --st-acc: 26,26,46;    --st-acc2: 58,74,138; }
  .st-tone-mono     { --st-acc: 244,241,234; --st-acc2: 244,241,234; }

  /* Slide frame */
  .st-slide { min-height: auto; padding: clamp(72px,11vh,150px) clamp(20px,6vw,80px); position:relative;
    max-width: 1280px; margin: 0 auto; display:flex; flex-direction:column; justify-content:center; }
  .st-cover { min-height: 100vh; align-items:center; }
  .st-inner { width:100%; max-width:1200px; margin:0 auto; position:relative; z-index:2; }
  .st-slide.st-align-left   .st-inner { margin-left: 4%;  margin-right:auto; text-align:left; }
  .st-slide.st-align-right  .st-inner { margin-left:auto; margin-right: 4%;  text-align:right; }
  .st-slide.st-align-center .st-inner { text-align:center; }
  .st-slide.st-align-edge   .st-inner { max-width:100%; padding: 0 2%; text-align:left; }

  /* Surfaces */
  .st-surf-void     { background: transparent; }
  .st-surf-card     { background: rgba(17,18,28,0.65); backdrop-filter: blur(18px); border:1px solid var(--st-line); border-radius: 20px; }
  .st-surf-frost    { background: rgba(244,241,234,0.04); backdrop-filter: blur(14px); border:1px solid rgba(244,241,234,0.10); border-radius: 20px; }
  .st-surf-storm    { background: linear-gradient(155deg, rgba(58,74,138,0.32), rgba(26,26,46,0.10)); border:1px solid rgba(58,74,138,0.45); border-radius: 20px; }
  .st-surf-calm     { background: linear-gradient(155deg, rgba(168,196,216,0.18), rgba(168,196,216,0.02)); border:1px solid rgba(168,196,216,0.32); border-radius: 20px; }
  .st-surf-electric { background: linear-gradient(135deg, rgba(140,160,255,0.20), rgba(58,74,138,0.05)); border:1px solid rgba(140,160,255,0.40); border-radius: 20px; box-shadow: 0 0 60px -20px rgba(140,160,255,0.5); }
  .st-surf-paper    { background: linear-gradient(180deg, rgba(244,241,234,0.05), rgba(244,241,234,0.01)); border:1px solid var(--st-line); border-radius: 4px; }
  .st-surf-ink      { background: linear-gradient(180deg, #050510, #0a0a12); border:1px solid rgba(140,160,255,0.18); border-radius: 20px; }
  .st-surf-outline  { background: transparent; border:1.5px solid rgba(var(--st-acc),0.6); border-radius: 20px; }
  .st-surf-grad     { background: linear-gradient(135deg, rgba(58,74,138,0.25), rgba(168,196,216,0.18) 60%, rgba(216,184,120,0.10)); border:1px solid var(--st-line); border-radius: 20px; }

  /* Accents */
  .st-acc-bar     { border-left: 2px solid rgba(var(--st-acc),1); padding-left: 24px; }
  .st-acc-bar-r   { border-right:2px solid rgba(var(--st-acc),1); padding-right:24px; }
  .st-acc-top     { box-shadow: inset 0 2px 0 0 rgba(var(--st-acc),1); }
  .st-acc-under   { padding-bottom: 18px; border-bottom: 1px solid rgba(var(--st-acc),0.5); }
  .st-acc-corner::before { content:""; position:absolute; top:0; right:0; width:40px; height:40px;
    background: linear-gradient(135deg, rgba(var(--st-acc),1), rgba(var(--st-acc2),0.6));
    clip-path: polygon(100% 0, 100% 100%, 0 0); z-index:2; border-top-right-radius:20px; }
  .st-acc-dot::before  { content:""; position:absolute; top:28px; right:28px; width:10px; height:10px;
    border-radius:50%; background: rgba(var(--st-acc),1); box-shadow: 0 0 32px rgba(var(--st-acc),0.9); z-index:2; }
  .st-acc-halo    { box-shadow: 0 0 90px -20px rgba(var(--st-acc),0.55); }
  .st-acc-tag::before { content: "❋"; color: rgba(var(--st-acc),1); margin-right:12px; font-size:0.85em; }
  .st-acc-rule    { position:relative; }
  .st-acc-rule::after { content:""; position:absolute; left:24px; right:24px; bottom:0; height:1px;
    background: linear-gradient(90deg, transparent, rgba(var(--st-acc),0.7), transparent); }

  /* Typography */
  .st-tag  { font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.36em;
    text-transform:uppercase; color: rgba(var(--st-acc),1); font-weight:400; margin-bottom:28px; display:inline-block; }
  .st-h1   { font-family:'Cormorant Garamond', serif; font-size: clamp(46px,8.4vw,118px); line-height:0.98;
    letter-spacing:-0.025em; font-weight:300; margin-bottom: 32px; overflow-wrap:anywhere; color: var(--st-text);
    text-shadow: 0 0 80px rgba(140,160,255,0.25); }
  .st-h1 em { font-style: italic; font-weight:300;
    background: linear-gradient(135deg, rgba(var(--st-acc),1), rgba(var(--st-acc2),1));
    -webkit-background-clip:text; background-clip:text; color: transparent; }
  .st-h2   { font-family:'Cormorant Garamond', serif; font-size: clamp(34px,5.2vw,72px); line-height:1.05;
    letter-spacing:-0.02em; font-weight:400; margin-bottom: 24px; overflow-wrap:anywhere; }
  .st-h2 em { font-style: italic; color: rgba(var(--st-acc),1); font-weight:400; }
  .st-sub  { font-family:'Inter',sans-serif; font-size: clamp(15px,1.55vw,19px); line-height:1.75;
    color: rgba(244,241,234,0.7); font-weight:300; max-width: 680px; margin-bottom: 18px; letter-spacing:0.005em; }
  .st-body { font-family:'Inter',sans-serif; font-size: clamp(15px,1.5vw,18px); line-height:1.8;
    color: rgba(244,241,234,0.78); font-weight:300; max-width: 720px; margin-bottom: 14px; }
  .st-slide.st-align-center .st-sub, .st-slide.st-align-center .st-body { margin-left:auto; margin-right:auto; }

  /* Stats */
  .st-stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:0;
    margin-top:2rem; border-top:1px solid var(--st-line); border-bottom:1px solid var(--st-line); }
  .st-stat { padding:40px 24px; border-right:1px solid var(--st-line); }
  .st-stat:last-child { border-right:none; }
  .st-stat-v { font-family:'Cormorant Garamond',serif; font-size: clamp(44px,6.4vw,82px); line-height:1;
    letter-spacing:-0.02em; font-weight:300;
    background: linear-gradient(135deg, rgba(var(--st-acc),1), rgba(var(--st-acc2),1));
    -webkit-background-clip:text; background-clip:text; color: transparent; }
  .st-stat-l { font-size:11px; letter-spacing:0.26em; text-transform:uppercase; color: var(--st-muted); margin-top:14px; }

  /* Grids */
  .st-grid-2 { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:22px; margin-top:2rem; }
  .st-grid-3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:20px; margin-top:2rem; }
  .st-grid-4 { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:18px; margin-top:2rem; }
  .st-bento  { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(140px,auto); gap:18px; margin-top:2rem; }
  .st-mosaic { display:grid; grid-template-columns: 2fr 1fr 1fr; gap:18px; margin-top:2rem; }
  .st-masonry { columns:2; column-gap:20px; margin-top:2rem; }
  .st-masonry > * { break-inside:avoid; margin-bottom:20px; display:block; }
  .st-card { padding: clamp(22px,2.8vw,36px); background: rgba(244,241,234,0.025); border:1px solid var(--st-line);
    border-radius: 14px; position:relative; overflow:hidden; transition: transform .4s ease, border-color .4s ease; }
  .st-card:hover { border-color: rgba(var(--st-acc),0.5); transform: translateY(-2px); }
  .st-card::before { content:""; position:absolute; top:0; left:0; right:0; height:1px;
    background: linear-gradient(90deg, transparent, rgba(var(--st-acc),0.8), transparent); }
  .st-card-n { font-family:'Cormorant Garamond',serif; font-size:14px; letter-spacing:0.24em;
    color: rgba(var(--st-acc),1); display:block; margin-bottom:14px; font-weight:400; font-style:italic; }
  .st-card-t { font-family:'Cormorant Garamond',serif; font-size: clamp(22px,2.3vw,30px); letter-spacing:-0.01em;
    font-weight:500; margin-bottom:10px; color: var(--st-text); }
  .st-card-d { font-size:14.5px; line-height:1.75; color: rgba(244,241,234,0.7); font-weight:300; }
  .st-bento .st-card.b-wide   { grid-column: span 4; }
  .st-bento .st-card.b-half   { grid-column: span 3; }
  .st-bento .st-card.b-third  { grid-column: span 2; }
  .st-bento .st-card.b-tall   { grid-row: span 2; }

  /* Steps / Manifesto / Timeline */
  .st-steps { display:flex; flex-direction:column; margin-top:1.8rem; }
  .st-step { display:grid; grid-template-columns: 90px 1fr; gap:32px; padding:28px 0;
    border-top:1px solid var(--st-line); align-items:baseline; }
  .st-step:last-child { border-bottom:1px solid var(--st-line); }
  .st-step-n { font-family:'Cormorant Garamond',serif; font-size:46px; line-height:0.9; font-weight:300; font-style:italic;
    color: rgba(var(--st-acc),1); }
  .st-step-t { font-family:'Cormorant Garamond',serif; font-size: clamp(22px,2.3vw,30px); font-weight:500;
    letter-spacing:-0.01em; margin-bottom:8px; color: var(--st-text); }
  .st-step-d { font-size:14.5px; line-height:1.8; color: rgba(244,241,234,0.72); font-weight:300; }

  .st-manifesto { display:flex; flex-direction:column; margin-top:1.8rem; }
  .st-mrow { display:grid; grid-template-columns: 110px 1fr; gap:36px; padding:34px 0;
    border-top:1px solid var(--st-line); align-items:baseline; }
  .st-mrow:last-child { border-bottom:1px solid var(--st-line); }
  .st-mrow-n { font-family:'Cormorant Garamond',serif; font-size:40px; font-weight:300; font-style:italic;
    color: rgba(var(--st-acc),1); }
  .st-mrow-t { font-family:'Cormorant Garamond',serif; font-size: clamp(26px,2.6vw,36px); font-weight:500;
    letter-spacing:-0.015em; color: var(--st-text); }
  .st-mrow-d { font-size:15px; line-height:1.8; color: rgba(244,241,234,0.72); margin-top:10px; font-weight:300; }

  .st-timeline { display:flex; flex-direction:column; margin-top:1.8rem; }
  .st-trow { display:grid; grid-template-columns: 150px 1fr; gap:36px; padding:26px 0;
    border-top:1px solid var(--st-line); align-items:baseline; }
  .st-trow:last-child { border-bottom:1px solid var(--st-line); }
  .st-trow-n { font-family:'Inter',sans-serif; font-size:12px; letter-spacing:0.22em;
    text-transform:uppercase; color: rgba(var(--st-acc),1); font-weight:500; }
  .st-trow-t { font-family:'Cormorant Garamond',serif; font-size: clamp(22px,2.2vw,28px); font-weight:500;
    color: var(--st-text); margin-bottom:6px; }
  .st-trow-d { font-size:14.5px; line-height:1.75; color: rgba(244,241,234,0.72); font-weight:300; }

  /* Quote / Big */
  .st-quote { font-family:'Cormorant Garamond',serif; font-size: clamp(34px,5.4vw,76px); line-height:1.15;
    letter-spacing:-0.02em; font-weight:300; color: var(--st-text); max-width:1000px; margin:0 auto; font-style:italic; }
  .st-quote em { font-style:normal;
    background: linear-gradient(135deg, rgba(var(--st-acc),1), rgba(var(--st-acc2),1));
    -webkit-background-clip:text; background-clip:text; color: transparent; }
  .st-attr { font-size:11px; letter-spacing:0.32em; text-transform:uppercase; color: var(--st-muted); margin-top:36px; }
  .st-big  { font-family:'Cormorant Garamond',serif; font-size: clamp(110px,20vw,300px); line-height:0.88;
    letter-spacing:-0.04em; font-weight:300; font-style:italic;
    background: linear-gradient(135deg, rgba(var(--st-acc),1), rgba(var(--st-acc2),1));
    -webkit-background-clip:text; background-clip:text; color: transparent; text-align:center; }

  /* Compare */
  .st-compare { display:grid; grid-template-columns: 1fr 1fr; gap:26px; margin-top:2rem; }
  .st-ccol { padding: clamp(28px,3.2vw,44px); border:1px solid var(--st-line); border-radius:16px;
    background: rgba(244,241,234,0.025); }
  .st-ccol:first-child { border-top:2px solid var(--st-storm); }
  .st-ccol:last-child  { border-top:2px solid var(--st-calm); }
  .st-ccol h3 { font-family:'Cormorant Garamond',serif; font-size: clamp(24px,2.6vw,34px); font-weight:500;
    letter-spacing:-0.015em; margin-bottom:20px; color: var(--st-text); font-style:italic; }
  .st-ccol p { font-size:14.5px; line-height:1.75; padding:12px 0; border-top:1px solid var(--st-line);
    margin:0; color: rgba(244,241,234,0.78); font-weight:300; }

  /* Editorial */
  .st-editorial { display:grid; grid-template-columns: 1fr 1.3fr; gap:64px; align-items:start; margin-top:1rem; }
  .st-editorial.st-rev { grid-template-columns: 1.3fr 1fr; }
  .st-ecol-l h2 { font-family:'Cormorant Garamond',serif; font-size: clamp(34px,5vw,68px); line-height:1.0;
    letter-spacing:-0.02em; font-weight:400; margin-bottom:20px; }
  .st-ecol-r p { font-size:15.5px; line-height:1.9; color: rgba(244,241,234,0.78); margin-bottom:14px; font-weight:300; }

  /* Pills */
  .st-pills { display:flex; flex-wrap:wrap; gap:10px; margin-top:2rem; }
  .st-pill  { font-family:'Inter',sans-serif; font-size:13px; letter-spacing:0.08em; padding:11px 20px;
    border:1px solid rgba(var(--st-acc),0.5); color: rgba(var(--st-acc),1); border-radius: 999px;
    background: rgba(var(--st-acc),0.06); }
  .st-pills-sq .st-pill { border-radius: 6px; }

  /* Callouts */
  .st-callouts { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:18px; margin-top:2rem; }
  .st-callout { padding: 28px; border-left:2px solid rgba(var(--st-acc),1); background: rgba(244,241,234,0.02); }
  .st-callout-t { font-family:'Cormorant Garamond',serif; font-size: 22px; font-weight:500; margin-bottom:8px; color: var(--st-text); font-style:italic; }
  .st-callout-d { font-size: 14px; line-height:1.7; color: rgba(244,241,234,0.7); font-weight:300; }

  /* Hero list (oversized typographic list) */
  .st-hero-list { margin-top:2rem; }
  .st-hero-row { display:grid; grid-template-columns: 60px 1fr; gap:24px; padding:22px 0;
    border-bottom:1px solid var(--st-line); align-items:baseline; }
  .st-hero-row-n { font-family:'Inter',sans-serif; font-size:12px; letter-spacing:0.22em; color: var(--st-muted); }
  .st-hero-row-t { font-family:'Cormorant Garamond',serif; font-size: clamp(28px,4vw,56px); font-weight:400;
    letter-spacing:-0.02em; color: var(--st-text); line-height:1.1; }
  .st-hero-row:hover .st-hero-row-t { font-style:italic; color: rgba(var(--st-acc),1); }

  /* Image */
  .st-img { display:block; width:100%; max-width:920px; max-height:440px; object-fit:cover;
    margin:2rem auto; border:1px solid var(--st-line); border-radius:14px;
    filter: contrast(1.05) saturate(0.95) brightness(0.92); }

  /* Hero glyph — storm orb */
  .st-hero-glyph { width: clamp(90px,13vw,160px); height: clamp(90px,13vw,160px);
    background: radial-gradient(circle at 35% 35%, var(--st-electric), var(--st-storm) 55%, var(--st-deep) 100%);
    border-radius:50%; filter: drop-shadow(0 0 60px rgba(140,160,255,0.55));
    margin: 0 auto 40px; opacity: 0.92; }

  /* Scroll-hint footer on cover */
  .st-scroll-hint { margin-top:48px; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .st-scroll-hint span { font-size:10px; letter-spacing:0.32em; text-transform:uppercase; color: rgba(244,241,234,0.35); }
  .st-scroll-hint .st-arrow { width:1px; height:40px; background: linear-gradient(to bottom, rgba(244,241,234,0.4), transparent); }

  /* RTL */
  [dir="rtl"] .st-sub, [dir="rtl"] .st-body, [dir="rtl"] .st-card-d, [dir="rtl"] .st-step-d,
  [dir="rtl"] .st-mrow-d, [dir="rtl"] .st-trow-d, [dir="rtl"] .st-callout-d { text-align: right; }
  [dir="rtl"] .st-acc-bar { border-left:none; border-right:2px solid rgba(var(--st-acc),1); padding-left:0; padding-right:24px; }
  [dir="rtl"] .st-acc-bar-r { border-right:none; border-left:2px solid rgba(var(--st-acc),1); padding-right:0; padding-left:24px; }
  [dir="rtl"] .st-acc-corner::before { right:auto; left:0; clip-path: polygon(0 0, 0 100%, 100% 0); border-top-right-radius:0; border-top-left-radius:20px; }
  [dir="rtl"] .st-acc-dot::before { right:auto; left:28px; }
  [dir="rtl"] .st-acc-tag::before { margin-right:0; margin-left:12px; }
  [dir="rtl"] .st-mrow, [dir="rtl"] .st-trow, [dir="rtl"] .st-step { grid-template-columns: 1fr 110px; }
  [dir="rtl"] .st-editorial, [dir="rtl"] .st-editorial.st-rev { grid-template-columns: 1.3fr 1fr; }
  [dir="rtl"] .st-callout { border-left:none; border-right:2px solid rgba(var(--st-acc),1); }
  [dir="rtl"] .st-hero-row { grid-template-columns: 1fr 60px; }

  /* Responsive */
  @media (max-width: 1024px) {
    .st-bento { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .st-bento .st-card.b-wide, .st-bento .st-card.b-half { grid-column: span 3; }
    .st-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .st-mosaic { grid-template-columns: 1fr 1fr; }
    .st-editorial, .st-editorial.st-rev { grid-template-columns: 1fr; gap:32px; }
  }
  @media (max-width: 640px) {
    .st-slide { padding: 56px 18px; }
    .st-cover { min-height: 84vh; }
    .st-h1 { font-size: 54px !important; }
    .st-h2 { font-size: 36px !important; }
    .st-quote { font-size: 30px !important; }
    .st-big { font-size: 96px !important; }
    .st-grid-2, .st-grid-3, .st-compare, .st-masonry, .st-mosaic { grid-template-columns: 1fr !important; columns: 1 !important; gap: 16px; }
    .st-stat { border-right: none; border-bottom: 1px solid var(--st-line); padding: 24px 18px; }
    .st-mrow, .st-trow, .st-step { grid-template-columns: 60px 1fr; gap: 16px; }
    .st-mrow-n, .st-step-n { font-size: 30px; }
    .st-hero-row-t { font-size: 30px !important; }
  }
`;

const ST_SURFACES = ["void","card","frost","storm","calm","electric","paper","ink","outline","grad"] as const;
const ST_ACCENTS  = ["bar","bar-r","top","under","corner","dot","halo","tag","rule"] as const;
const ST_TONES    = ["storm","electric","calm","gold","rose","mist","deep","mono"] as const;
const ST_LAYOUTS  = ["bento","masonry","mosaic","grid2","grid3","grid4","steps","manifesto","editorial","editorial-rev","timeline","pills","pills-sq","compact","callouts","hero-list"] as const;
const ST_ALIGNS   = ["left","right","center","edge"] as const;

function stHash(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function renderStormToCalmDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const accentTitle = (raw: string): string => {
    const safe = esc(raw);
    const words = safe.split(/\s+/);
    if (words.length < 2) return safe;
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>`;
  };

  const sections = slides.map((slide, idx) => {
    const title = slide.title || deck.title || "";
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `${num} · ${isAr ? "فصل" : "Chapter"} ${num}`);
    const img = slide.image ? `<img class="st-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const surface = ST_SURFACES[stHash(seed, 1) % ST_SURFACES.length];
    const accent  = ST_ACCENTS [stHash(seed, 2) % ST_ACCENTS.length];
    const tone    = ST_TONES   [stHash(seed, 3) % ST_TONES.length];
    const layout  = ST_LAYOUTS [stHash(seed, 4) % ST_LAYOUTS.length];
    const align   = ST_ALIGNS  [stHash(seed, 5) % ST_ALIGNS.length];

    const slideCls = `st-slide st-tone-${tone} st-align-${align}`;
    const innerCls = `st-inner st-surf-${surface} st-acc-${accent}`;
    const padStyle = surface === "void" ? "" : "padding: clamp(30px,3.8vw,60px);";
    const wrap = (inner: string) =>
      `<section class="${slideCls}"><div class="${innerCls}" style="${padStyle}">${inner}</div></section>`;

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<section class="${slideCls} st-cover">
        <div class="st-inner" style="text-align:center">
          <div class="st-hero-glyph"></div>
          ${slide.subtitle ? `<p class="st-tag" style="margin:0 auto 22px">${esc(slide.subtitle)}</p>` : ""}
          <h1 class="st-h1">${accentTitle(title)}</h1>
          ${slide.cta ? `<p class="st-sub" style="margin:0 auto">${esc(slide.cta)}</p>` : ""}
          <div class="st-scroll-hint"><span>${isAr ? "اسحب" : "Scroll"}</span><div class="st-arrow"></div></div>
        </div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="${slideCls} st-cover">
        <div class="st-inner st-surf-grad" style="padding:clamp(44px,5.5vw,80px);text-align:center;border-radius:20px">
          <p class="st-tag">${label}</p>
          <h2 class="st-h2"><em>${esc(title)}</em></h2>
          ${slide.subtitle ? `<p class="st-sub" style="margin:0 auto">${esc(slide.subtitle)}</p>` : body ? `<p class="st-sub" style="margin:0 auto">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      const q = esc(slide.quote || title);
      const words = q.split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      const quoteHtml = words.length > 3 ? `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>` : q;
      return `<section class="${slideCls} st-cover">
        <div class="st-inner" style="text-align:center">
          <p class="st-quote">"${quoteHtml}"</p>
          ${slide.attribution ? `<div class="st-attr">— ${esc(slide.attribution)}</div>` : ""}
        </div>
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="${slideCls} st-cover">
        <div class="st-inner" style="text-align:center">
          <p class="st-tag">${label}</p>
          <div class="st-big">${esc(slide.big_value)}</div>
          <p class="st-sub" style="margin:30px auto 0">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="st-body" style="margin:14px auto 0">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return wrap(`
        <p class="st-tag">${label}</p>
        <h2 class="st-h2">${esc(title)}</h2>
        ${body ? `<p class="st-sub">${body}</p>` : ""}
        ${img}
        <div class="st-stats">${stats.map(s => `<div class="st-stat"><div class="st-stat-v">${esc(s.value)}</div><div class="st-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      const useManifesto = layout === "manifesto" || layout === "editorial-rev";
      if (useManifesto) {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-manifesto">${steps.map((s,i) => `<div class="st-mrow"><div class="st-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="st-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="st-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <p class="st-tag">${label}</p>
        <h2 class="st-h2">${esc(title)}</h2>
        ${body ? `<p class="st-sub">${body}</p>` : ""}
        <div class="st-steps">${steps.map((s,i) => `<div class="st-step"><div class="st-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="st-step-t">${esc(s.title)}</div>${s.desc ? `<div class="st-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return wrap(`
        <p class="st-tag">${label}</p>
        <h2 class="st-h2">${esc(title)}</h2>
        <div class="st-timeline">${events.map(e => `<div class="st-trow"><div class="st-trow-n">${esc(e.date)}</div><div><div class="st-trow-t">${esc(e.title)}</div>${e.desc ? `<div class="st-trow-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return wrap(`
        <p class="st-tag">${label}</p>
        <h2 class="st-h2">${esc(title)}</h2>
        <div class="st-compare">
          <div class="st-ccol"><h3>${esc(slide.left_title || (isAr ? "العاصفة" : "Storm"))}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div class="st-ccol"><h3>${esc(slide.right_title || (isAr ? "الهدوء" : "Calm"))}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:：—–-]\s+/);
        return { t: parts[0], d: parts.slice(1).join(" — "), n: String(i + 1).padStart(2, "0") };
      });

      if (layout === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-bento">${cards.map((c,i) => `<div class="st-card ${spans[i % spans.length]}"><span class="st-card-n">${c.n}</span><div class="st-card-t">${esc(c.t)}</div>${c.d ? `<div class="st-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "masonry") {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-masonry">${cards.map(c => `<div class="st-card"><span class="st-card-n">${c.n}</span><div class="st-card-t">${esc(c.t)}</div>${c.d ? `<div class="st-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "mosaic") {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-mosaic">${cards.map(c => `<div class="st-card"><span class="st-card-n">${c.n}</span><div class="st-card-t">${esc(c.t)}</div>${c.d ? `<div class="st-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "grid2" || layout === "grid3" || layout === "grid4") {
        const gcls = layout === "grid4" ? "st-grid-4" : layout === "grid2" ? "st-grid-2" : "st-grid-3";
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="${gcls}">${cards.map(c => `<div class="st-card"><span class="st-card-n">${c.n}</span><div class="st-card-t">${esc(c.t)}</div>${c.d ? `<div class="st-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "steps") {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-steps">${cards.map(c => `<div class="st-step"><div class="st-step-n">${c.n}</div><div><div class="st-step-t">${esc(c.t)}</div>${c.d ? `<div class="st-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "manifesto") {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-manifesto">${cards.map(c => `<div class="st-mrow"><div class="st-mrow-n">${c.n}</div><div><div class="st-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="st-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "timeline") {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-timeline">${cards.map(c => `<div class="st-trow"><div class="st-trow-n">${isAr ? "م" : "·"} ${c.n}</div><div><div class="st-trow-t">${esc(c.t)}</div>${c.d ? `<div class="st-trow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "editorial" || layout === "editorial-rev") {
        const cls = layout === "editorial-rev" ? "st-editorial st-rev" : "st-editorial";
        return wrap(`
          <div class="${cls}">
            <div class="st-ecol-l"><p class="st-tag">${label}</p><h2>${esc(title)}</h2>${img}</div>
            <div class="st-ecol-r">${body ? `<p>${body}</p>` : ""}${cards.map(c => `<p><strong style="font-family:'Cormorant Garamond',serif;font-weight:500;font-style:italic;color:rgba(var(--st-acc),1);">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div>
          </div>
        `);
      }
      if (layout === "pills" || layout === "pills-sq") {
        const cls = layout === "pills-sq" ? "st-pills st-pills-sq" : "st-pills";
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="${cls}">${cards.map(c => `<span class="st-pill">${esc(c.t)}</span>`).join("")}</div>
        `);
      }
      if (layout === "callouts") {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-callouts">${cards.map(c => `<div class="st-callout"><div class="st-callout-t">${esc(c.t)}</div>${c.d ? `<div class="st-callout-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "hero-list") {
        return wrap(`
          <p class="st-tag">${label}</p>
          <h2 class="st-h2">${esc(title)}</h2>
          ${body ? `<p class="st-sub">${body}</p>` : ""}
          <div class="st-hero-list">${cards.map(c => `<div class="st-hero-row"><div class="st-hero-row-n">${c.n}</div><div><div class="st-hero-row-t">${esc(c.t)}</div>${c.d ? `<div class="st-card-d" style="margin-top:8px">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      // compact default
      return wrap(`
        <p class="st-tag">${label}</p>
        <h2 class="st-h2">${esc(title)}</h2>
        ${body ? `<p class="st-sub">${body}</p>` : ""}
        ${img}
        <ol style="list-style:none;padding:0;margin:1.8rem 0 0;border-top:1px solid var(--st-line)">
          ${cards.map(c => `<li style="padding:22px 0;border-bottom:1px solid var(--st-line);display:grid;grid-template-columns:64px 1fr;gap:24px;align-items:baseline"><span style="font-family:'Cormorant Garamond',serif;font-size:24px;font-style:italic;color:rgba(var(--st-acc),1);font-weight:300">${c.n}</span><div><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:500;letter-spacing:-0.01em;color:var(--st-text);margin-bottom:4px">${esc(c.t)}</div>${c.d ? `<div style="font-size:14.5px;line-height:1.75;color:rgba(244,241,234,0.7);font-weight:300">${esc(c.d)}</div>` : ""}</div></li>`).join("")}
        </ol>
      `);
    }

    return wrap(`
      <p class="st-tag">${label}</p>
      <h2 class="st-h2">${esc(title)}</h2>
      ${body ? `<p class="st-body">${body}</p>` : ""}
      ${img}
    `);
  });

  return `<div class="st-atmos"></div><div class="st-root">\n${sections.join("\n")}\n</div>`;
}

/* ================================================================== */
/* Folio Scatter — Minimal Editorial Portfolio (cream/light)           */
/* Combinatorial system: 10 surfaces × 9 accents × 8 tones × 16 layouts × 4 aligns
/*   = 46,080 unique slide variants                                    */
/* ================================================================== */

const FOLIO_LOCK_CSS = `
  :root {
    --fs-bg:#fafaf8; --fs-bg-2:#f4f2ec; --fs-text:#111111; --fs-muted:#9a958d;
    --fs-line:rgba(17,17,17,0.10);
    --fs-stone:#a89f93; --fs-sand:#d4c9b5; --fs-ink:#1a1a1a; --fs-clay:#b88a6a;
    --fs-sage:#8a9b7e; --fs-bone:#e8e3d8; --fs-paper:#efece4; --fs-rust:#a05a3a;
  }
  html, body { background: var(--fs-bg) !important; color: var(--fs-text) !important;
    font-family: 'DM Sans', system-ui, sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > *:not(.fs-atmos):not(.fs-root) { display: none !important; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--fs-bg); }
  ::-webkit-scrollbar-thumb { background: var(--fs-stone); border-radius: 3px; }

  /* Paper texture backdrop */
  .fs-atmos { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
    background:
      radial-gradient(ellipse at 18% 22%, rgba(168,159,147,0.08), transparent 55%),
      radial-gradient(ellipse at 82% 78%, rgba(212,201,181,0.10), transparent 60%); }
  .fs-atmos::after { content:""; position:absolute; inset:0; opacity:0.5;
    background-image:
      radial-gradient(1px 1px at 11% 17%, rgba(17,17,17,0.06), transparent 50%),
      radial-gradient(1px 1px at 63% 41%, rgba(17,17,17,0.05), transparent 50%),
      radial-gradient(1px 1px at 28% 73%, rgba(17,17,17,0.06), transparent 50%),
      radial-gradient(1px 1px at 87% 16%, rgba(17,17,17,0.04), transparent 50%),
      radial-gradient(1px 1px at 44% 87%, rgba(17,17,17,0.05), transparent 50%); }
  .fs-root { position: relative; z-index: 2; }

  /* Tonal palettes */
  .fs-tone-stone { --fs-acc: 168,159,147; --fs-acc2: 212,201,181; }
  .fs-tone-sand  { --fs-acc: 212,201,181; --fs-acc2: 168,159,147; }
  .fs-tone-ink   { --fs-acc:  26, 26, 26; --fs-acc2: 154,149,141; }
  .fs-tone-clay  { --fs-acc: 184,138,106; --fs-acc2: 160, 90, 58; }
  .fs-tone-sage  { --fs-acc: 138,155,126; --fs-acc2: 168,159,147; }
  .fs-tone-bone  { --fs-acc: 232,227,216; --fs-acc2: 168,159,147; }
  .fs-tone-rust  { --fs-acc: 160, 90, 58; --fs-acc2: 184,138,106; }
  .fs-tone-mono  { --fs-acc:  17, 17, 17; --fs-acc2:  17, 17, 17; }

  /* Slide frame */
  .fs-slide { min-height: auto; padding: clamp(80px,12vh,160px) clamp(20px,6vw,80px); position:relative;
    max-width: 1320px; margin: 0 auto; display:flex; flex-direction:column; justify-content:center; }
  .fs-cover { min-height: 100vh; align-items:flex-start; justify-content:flex-end; padding-bottom:8vh; }
  .fs-inner { width:100%; max-width:1240px; margin:0 auto; position:relative; z-index:2; }
  .fs-slide.fs-align-left   .fs-inner { margin-left: 4%;  margin-right:auto; text-align:left; }
  .fs-slide.fs-align-right  .fs-inner { margin-left:auto; margin-right: 4%;  text-align:right; }
  .fs-slide.fs-align-center .fs-inner { text-align:center; }
  .fs-slide.fs-align-edge   .fs-inner { max-width:100%; padding: 0 2%; text-align:left; }

  /* Surfaces */
  .fs-surf-void    { background: transparent; }
  .fs-surf-card    { background: #ffffff; border:1px solid var(--fs-line); border-radius: 4px;
    box-shadow: 0 1px 2px rgba(17,17,17,0.03), 0 8px 32px rgba(17,17,17,0.04); }
  .fs-surf-paper   { background: var(--fs-paper); border:1px solid var(--fs-line); border-radius: 4px; }
  .fs-surf-bone    { background: var(--fs-bone); border:1px solid var(--fs-line); border-radius: 4px; }
  .fs-surf-tint    { background: linear-gradient(165deg, rgba(var(--fs-acc),0.10), rgba(var(--fs-acc),0.02)); border:1px solid rgba(var(--fs-acc),0.20); border-radius: 4px; }
  .fs-surf-ink     { background: var(--fs-ink); color: var(--fs-bone); border-radius: 4px; }
  .fs-surf-ink .fs-h1, .fs-surf-ink .fs-h2, .fs-surf-ink .fs-card-t, .fs-surf-ink .fs-step-t, .fs-surf-ink .fs-mrow-t, .fs-surf-ink .fs-trow-t, .fs-surf-ink .fs-hero-row-t, .fs-surf-ink .fs-callout-t { color: var(--fs-bone); }
  .fs-surf-ink .fs-sub, .fs-surf-ink .fs-body, .fs-surf-ink .fs-card-d, .fs-surf-ink .fs-step-d, .fs-surf-ink .fs-mrow-d, .fs-surf-ink .fs-trow-d, .fs-surf-ink .fs-callout-d { color: rgba(232,227,216,0.7); }
  .fs-surf-ink .fs-card { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.10); }
  .fs-surf-outline { background: transparent; border:1px solid var(--fs-line); border-radius: 4px; }
  .fs-surf-frame   { background: var(--fs-bg); border:8px solid var(--fs-ink); border-radius: 0; }
  .fs-surf-rule    { background: transparent; border-top:1px solid var(--fs-ink); border-bottom:1px solid var(--fs-ink); border-radius: 0; }
  .fs-surf-grad    { background: linear-gradient(135deg, var(--fs-bone), var(--fs-paper) 60%, #ffffff); border:1px solid var(--fs-line); border-radius: 4px; }

  /* Accents */
  .fs-acc-bar   { border-left: 1px solid var(--fs-ink); padding-left: 26px; }
  .fs-acc-bar-r { border-right:1px solid var(--fs-ink); padding-right:26px; }
  .fs-acc-top   { box-shadow: inset 0 1px 0 0 var(--fs-ink); }
  .fs-acc-under { padding-bottom: 20px; border-bottom: 1px solid var(--fs-ink); }
  .fs-acc-mark::before { content:""; position:absolute; top:24px; right:24px; width:36px; height:36px;
    background: rgba(var(--fs-acc),0.85); border-radius: 50%; z-index:2; }
  .fs-acc-cross::before { content:""; position:absolute; top:24px; right:24px; width:14px; height:14px;
    background: linear-gradient(45deg, transparent 45%, var(--fs-ink) 45%, var(--fs-ink) 55%, transparent 55%),
                linear-gradient(-45deg, transparent 45%, var(--fs-ink) 45%, var(--fs-ink) 55%, transparent 55%); z-index:2; }
  .fs-acc-num::before { content: attr(data-fs-num); position:absolute; top:18px; right:24px; font-family:'Space Mono',monospace;
    font-size: 11px; letter-spacing:0.18em; color: var(--fs-muted); z-index:2; }
  .fs-acc-tag::before { content:"●"; color: rgba(var(--fs-acc),1); font-size: 0.5em; vertical-align: middle; margin-right:12px; }
  .fs-acc-rule  { position:relative; }
  .fs-acc-rule::after { content:""; position:absolute; left:24px; right:24px; bottom:0; height:1px;
    background: linear-gradient(90deg, var(--fs-ink), transparent); }
  .fs-acc-none { }

  /* Typography */
  .fs-tag  { font-family:'Space Mono',monospace; font-size:10px; letter-spacing:0.20em;
    text-transform:uppercase; color: var(--fs-muted); font-weight:400; margin-bottom:36px; display:flex; align-items:center; gap:12px; }
  .fs-tag::before { content:""; width:24px; height:1px; background: var(--fs-muted); }
  .fs-slide.fs-align-center .fs-tag { justify-content:center; }
  .fs-slide.fs-align-right  .fs-tag { justify-content:flex-end; flex-direction:row-reverse; }
  .fs-h1   { font-family:'DM Sans', sans-serif; font-size: clamp(48px,9vw,128px); line-height:0.96;
    letter-spacing:-0.04em; font-weight:300; margin-bottom: 32px; overflow-wrap:anywhere; color: var(--fs-text); }
  .fs-h1 em { font-style: italic; font-weight:300; color: rgba(var(--fs-acc),1); }
  .fs-h2   { font-family:'DM Sans', sans-serif; font-size: clamp(34px,5.4vw,76px); line-height:1.0;
    letter-spacing:-0.035em; font-weight:300; margin-bottom: 28px; overflow-wrap:anywhere; }
  .fs-h2 em { font-style: italic; font-weight:300; color: rgba(var(--fs-acc),1); }
  .fs-sub  { font-family:'DM Sans', sans-serif; font-size: clamp(15px,1.5vw,19px); line-height:1.7;
    color: var(--fs-muted); font-weight:400; max-width: 620px; margin-bottom: 18px; letter-spacing:-0.005em; }
  .fs-body { font-family:'DM Sans', sans-serif; font-size: clamp(15px,1.45vw,18px); line-height:1.75;
    color: #44423d; font-weight:400; max-width: 680px; margin-bottom: 14px; }
  .fs-slide.fs-align-center .fs-sub, .fs-slide.fs-align-center .fs-body { margin-left:auto; margin-right:auto; }

  /* Stats */
  .fs-stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:0;
    margin-top:2rem; border-top:1px solid var(--fs-line); border-bottom:1px solid var(--fs-line); }
  .fs-stat { padding:42px 24px; border-right:1px solid var(--fs-line); }
  .fs-stat:last-child { border-right:none; }
  .fs-stat-v { font-family:'DM Sans',sans-serif; font-size: clamp(44px,6.4vw,84px); line-height:1;
    letter-spacing:-0.04em; font-weight:300; color: var(--fs-text); }
  .fs-stat-v em { font-style: italic; color: rgba(var(--fs-acc),1); }
  .fs-stat-l { font-family:'Space Mono',monospace; font-size:10px; letter-spacing:0.20em; text-transform:uppercase; color: var(--fs-muted); margin-top:14px; }

  /* Grids */
  .fs-grid-2 { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:1px; margin-top:2rem; background: var(--fs-line); border:1px solid var(--fs-line); }
  .fs-grid-3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:1px; margin-top:2rem; background: var(--fs-line); border:1px solid var(--fs-line); }
  .fs-grid-4 { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:1px; margin-top:2rem; background: var(--fs-line); border:1px solid var(--fs-line); }
  .fs-grid-2 > .fs-card, .fs-grid-3 > .fs-card, .fs-grid-4 > .fs-card { background: var(--fs-bg); border:none; border-radius:0; }
  .fs-bento  { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(150px,auto); gap:1px; background: var(--fs-line); border:1px solid var(--fs-line); margin-top:2rem; }
  .fs-bento > .fs-card { background: var(--fs-bg); border:none; border-radius:0; }
  .fs-mosaic { display:grid; grid-template-columns: 2fr 1fr 1fr; gap:1px; background: var(--fs-line); border:1px solid var(--fs-line); margin-top:2rem; }
  .fs-mosaic > .fs-card { background: var(--fs-bg); border:none; border-radius:0; }
  .fs-masonry { columns:2; column-gap:20px; margin-top:2rem; }
  .fs-masonry > * { break-inside:avoid; margin-bottom:20px; display:block; }
  .fs-card { padding: clamp(26px,3vw,40px); background: #ffffff; border:1px solid var(--fs-line);
    border-radius: 0; position:relative; overflow:hidden; transition: background .35s ease; }
  .fs-card:hover { background: var(--fs-paper); }
  .fs-card-n { font-family:'Space Mono',monospace; font-size:10px; letter-spacing:0.20em;
    color: var(--fs-muted); display:block; margin-bottom:18px; font-weight:400; }
  .fs-card-t { font-family:'DM Sans',sans-serif; font-size: clamp(22px,2.3vw,30px); letter-spacing:-0.02em;
    font-weight:400; margin-bottom:10px; color: var(--fs-text); line-height:1.15; }
  .fs-card-d { font-size:14.5px; line-height:1.7; color: var(--fs-muted); font-weight:400; }
  .fs-bento .fs-card.b-wide   { grid-column: span 4; }
  .fs-bento .fs-card.b-half   { grid-column: span 3; }
  .fs-bento .fs-card.b-third  { grid-column: span 2; }
  .fs-bento .fs-card.b-tall   { grid-row: span 2; }

  /* Steps / Manifesto / Timeline */
  .fs-steps { display:flex; flex-direction:column; margin-top:2rem; }
  .fs-step { display:grid; grid-template-columns: 90px 1fr; gap:36px; padding:30px 0;
    border-top:1px solid var(--fs-line); align-items:baseline; }
  .fs-step:last-child { border-bottom:1px solid var(--fs-line); }
  .fs-step-n { font-family:'Space Mono',monospace; font-size:13px; letter-spacing:0.18em; font-weight:400;
    color: var(--fs-muted); }
  .fs-step-t { font-family:'DM Sans',sans-serif; font-size: clamp(22px,2.3vw,30px); font-weight:400;
    letter-spacing:-0.02em; margin-bottom:10px; color: var(--fs-text); }
  .fs-step-d { font-size:14.5px; line-height:1.75; color: var(--fs-muted); font-weight:400; }

  .fs-manifesto { display:flex; flex-direction:column; margin-top:2rem; }
  .fs-mrow { display:grid; grid-template-columns: 90px 1fr; gap:40px; padding:38px 0;
    border-top:1px solid var(--fs-line); align-items:baseline; transition: padding-left .4s ease; }
  .fs-mrow:hover { padding-left: 12px; }
  .fs-mrow:last-child { border-bottom:1px solid var(--fs-line); }
  .fs-mrow-n { font-family:'Space Mono',monospace; font-size:13px; letter-spacing:0.18em; font-weight:400;
    color: var(--fs-muted); }
  .fs-mrow-t { font-family:'DM Sans',sans-serif; font-size: clamp(28px,3vw,42px); font-weight:300;
    letter-spacing:-0.03em; color: var(--fs-text); line-height:1.05; }
  .fs-mrow-t em { font-style: italic; color: rgba(var(--fs-acc),1); }
  .fs-mrow-d { font-size:15px; line-height:1.75; color: var(--fs-muted); margin-top:12px; font-weight:400; }

  .fs-timeline { display:flex; flex-direction:column; margin-top:2rem; }
  .fs-trow { display:grid; grid-template-columns: 140px 1fr; gap:36px; padding:26px 0;
    border-top:1px solid var(--fs-line); align-items:baseline; }
  .fs-trow:last-child { border-bottom:1px solid var(--fs-line); }
  .fs-trow-n { font-family:'Space Mono',monospace; font-size:11px; letter-spacing:0.22em;
    text-transform:uppercase; color: var(--fs-muted); font-weight:400; }
  .fs-trow-t { font-family:'DM Sans',sans-serif; font-size: clamp(20px,2.1vw,26px); font-weight:400;
    color: var(--fs-text); margin-bottom:6px; letter-spacing:-0.015em; }
  .fs-trow-d { font-size:14.5px; line-height:1.75; color: var(--fs-muted); font-weight:400; }

  /* Quote / Big */
  .fs-quote { font-family:'DM Sans',sans-serif; font-size: clamp(34px,5.6vw,80px); line-height:1.1;
    letter-spacing:-0.035em; font-weight:300; color: var(--fs-text); max-width:1100px; margin:0 auto; }
  .fs-quote em { font-style:italic; color: rgba(var(--fs-acc),1); }
  .fs-attr { font-family:'Space Mono',monospace; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color: var(--fs-muted); margin-top:40px; }
  .fs-big  { font-family:'DM Sans',sans-serif; font-size: clamp(120px,22vw,340px); line-height:0.86;
    letter-spacing:-0.06em; font-weight:300; color: var(--fs-text); text-align:center; }
  .fs-big em { font-style:italic; color: rgba(var(--fs-acc),1); }

  /* Compare */
  .fs-compare { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background: var(--fs-line); border:1px solid var(--fs-line); margin-top:2rem; }
  .fs-ccol { padding: clamp(30px,3.4vw,48px); background: var(--fs-bg); }
  .fs-ccol h3 { font-family:'DM Sans',sans-serif; font-size: clamp(22px,2.4vw,30px); font-weight:400;
    letter-spacing:-0.02em; margin-bottom:24px; color: var(--fs-text); }
  .fs-ccol h3::before { content:""; display:inline-block; width:8px; height:8px; background: rgba(var(--fs-acc),1); margin-right:12px; vertical-align:middle; border-radius:50%; }
  .fs-ccol p { font-size:14.5px; line-height:1.75; padding:14px 0; border-top:1px solid var(--fs-line);
    margin:0; color: #44423d; font-weight:400; }

  /* Editorial */
  .fs-editorial { display:grid; grid-template-columns: 1fr 1.4fr; gap:72px; align-items:start; margin-top:1rem; }
  .fs-editorial.fs-rev { grid-template-columns: 1.4fr 1fr; }
  .fs-ecol-l h2 { font-family:'DM Sans',sans-serif; font-size: clamp(36px,5.2vw,72px); line-height:0.98;
    letter-spacing:-0.035em; font-weight:300; margin-bottom:20px; }
  .fs-ecol-l h2 em { font-style:italic; color: rgba(var(--fs-acc),1); }
  .fs-ecol-r p { font-size:15.5px; line-height:1.85; color: #44423d; margin-bottom:14px; font-weight:400; }

  /* Pills */
  .fs-pills { display:flex; flex-wrap:wrap; gap:8px; margin-top:2rem; }
  .fs-pill  { font-family:'Space Mono',monospace; font-size:11px; letter-spacing:0.10em; padding:10px 18px;
    border:1px solid var(--fs-line); color: var(--fs-text); border-radius: 999px;
    background: #ffffff; text-transform:uppercase; }
  .fs-pill:hover { background: var(--fs-ink); color: var(--fs-bone); border-color: var(--fs-ink); }
  .fs-pills-sq .fs-pill { border-radius: 0; }

  /* Callouts */
  .fs-callouts { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:1px;
    background: var(--fs-line); border:1px solid var(--fs-line); margin-top:2rem; }
  .fs-callout { padding: 32px; background: var(--fs-bg); border-top: 2px solid rgba(var(--fs-acc),1); }
  .fs-callout-t { font-family:'DM Sans',sans-serif; font-size: 22px; font-weight:400; margin-bottom:10px; color: var(--fs-text); letter-spacing:-0.015em; }
  .fs-callout-d { font-size: 14px; line-height:1.7; color: var(--fs-muted); font-weight:400; }

  /* Hero list */
  .fs-hero-list { margin-top:2rem; border-top:1px solid var(--fs-line); }
  .fs-hero-row { display:grid; grid-template-columns: 80px 1fr 40px; gap:32px; padding:28px 0;
    border-bottom:1px solid var(--fs-line); align-items:baseline; cursor:default; transition: color .3s ease; }
  .fs-hero-row-n { font-family:'Space Mono',monospace; font-size:11px; letter-spacing:0.20em; color: var(--fs-muted); }
  .fs-hero-row-t { font-family:'DM Sans',sans-serif; font-size: clamp(30px,4.4vw,62px); font-weight:300;
    letter-spacing:-0.035em; color: var(--fs-text); line-height:1.05; }
  .fs-hero-row-a { font-family:'Space Mono',monospace; font-size: 18px; color: var(--fs-muted); text-align:right; transition: color .3s, transform .3s; }
  .fs-hero-row:hover .fs-hero-row-t { font-style:italic; color: rgba(var(--fs-acc),1); }
  .fs-hero-row:hover .fs-hero-row-a { color: rgba(var(--fs-acc),1); transform: translateX(6px); }

  /* Image */
  .fs-img { display:block; width:100%; max-width:920px; max-height:460px; object-fit:cover;
    margin:2rem auto; border:1px solid var(--fs-line); border-radius:0;
    filter: contrast(0.98) saturate(0.92); }

  /* Hero scatter glyph — paper blocks */
  .fs-hero-glyph { position:relative; width: clamp(220px,28vw,340px); height: clamp(120px,16vw,180px); margin: 0 0 64px; }
  .fs-hero-glyph::before, .fs-hero-glyph::after { content:""; position:absolute; background: var(--fs-sand);
    box-shadow: 0 2px 8px rgba(17,17,17,0.08); }
  .fs-hero-glyph::before { width:42%; height:42%; top: 8%; left: 12%; background: var(--fs-stone); transform: rotate(-6deg); }
  .fs-hero-glyph::after  { width:30%; height:60%; top: 24%; left: 56%; background: var(--fs-bone); transform: rotate(4deg); border:1px solid var(--fs-line); }
  .fs-slide.fs-align-center .fs-hero-glyph { margin-left:auto; margin-right:auto; }

  /* Scroll-hint footer on cover */
  .fs-scroll-hint { margin-top:64px; display:flex; align-items:center; gap:12px;
    font-family:'Space Mono',monospace; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color: var(--fs-muted); }
  .fs-scroll-hint .fs-arrow { width:40px; height:1px; background: var(--fs-muted); }

  /* RTL */
  [dir="rtl"] .fs-sub, [dir="rtl"] .fs-body, [dir="rtl"] .fs-card-d, [dir="rtl"] .fs-step-d,
  [dir="rtl"] .fs-mrow-d, [dir="rtl"] .fs-trow-d, [dir="rtl"] .fs-callout-d { text-align: right; }
  [dir="rtl"] .fs-acc-bar { border-left:none; border-right:1px solid var(--fs-ink); padding-left:0; padding-right:26px; }
  [dir="rtl"] .fs-acc-bar-r { border-right:none; border-left:1px solid var(--fs-ink); padding-right:0; padding-left:26px; }
  [dir="rtl"] .fs-acc-mark::before, [dir="rtl"] .fs-acc-cross::before, [dir="rtl"] .fs-acc-num::before { right:auto; left:24px; }
  [dir="rtl"] .fs-acc-tag::before { margin-right:0; margin-left:12px; }
  [dir="rtl"] .fs-tag { flex-direction:row-reverse; }
  [dir="rtl"] .fs-mrow, [dir="rtl"] .fs-trow, [dir="rtl"] .fs-step { grid-template-columns: 1fr 90px; }
  [dir="rtl"] .fs-trow { grid-template-columns: 1fr 140px; }
  [dir="rtl"] .fs-editorial, [dir="rtl"] .fs-editorial.fs-rev { grid-template-columns: 1.4fr 1fr; }
  [dir="rtl"] .fs-hero-row { grid-template-columns: 40px 1fr 80px; }
  [dir="rtl"] .fs-hero-row-a { text-align:left; transform: scaleX(-1); }
  [dir="rtl"] .fs-callout { border-top:2px solid rgba(var(--fs-acc),1); }

  /* Responsive */
  @media (max-width: 1024px) {
    .fs-bento { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .fs-bento .fs-card.b-wide, .fs-bento .fs-card.b-half { grid-column: span 3; }
    .fs-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .fs-mosaic { grid-template-columns: 1fr 1fr; }
    .fs-editorial, .fs-editorial.fs-rev { grid-template-columns: 1fr; gap:32px; }
  }
  @media (max-width: 640px) {
    .fs-slide { padding: 60px 18px; }
    .fs-cover { min-height: 88vh; }
    .fs-h1 { font-size: 56px !important; }
    .fs-h2 { font-size: 38px !important; }
    .fs-quote { font-size: 32px !important; }
    .fs-big { font-size: 104px !important; }
    .fs-grid-2, .fs-grid-3, .fs-compare, .fs-masonry, .fs-mosaic { grid-template-columns: 1fr !important; columns: 1 !important; gap: 1px; }
    .fs-stat { border-right: none; border-bottom: 1px solid var(--fs-line); padding: 24px 18px; }
    .fs-mrow, .fs-trow, .fs-step { grid-template-columns: 60px 1fr; gap: 16px; }
    .fs-mrow-t { font-size: 26px !important; }
    .fs-hero-row { grid-template-columns: 40px 1fr; }
    .fs-hero-row-a { display:none; }
    .fs-hero-row-t { font-size: 30px !important; }
  }
`;

const FS_SURFACES = ["void","card","paper","bone","tint","ink","outline","frame","rule","grad"] as const;
const FS_ACCENTS  = ["bar","bar-r","top","under","mark","cross","num","tag","rule"] as const;
const FS_TONES    = ["stone","sand","ink","clay","sage","bone","rust","mono"] as const;
const FS_LAYOUTS  = ["bento","masonry","mosaic","grid2","grid3","grid4","steps","manifesto","editorial","editorial-rev","timeline","pills","pills-sq","compact","callouts","hero-list"] as const;
const FS_ALIGNS   = ["left","right","center","edge"] as const;

function fsHash(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function renderFolioScatterDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const accentTitle = (raw: string): string => {
    const safe = esc(raw);
    const words = safe.split(/\s+/);
    if (words.length < 2) return safe;
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>`;
  };

  const sections = slides.map((slide, idx) => {
    const title = slide.title || deck.title || "";
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `${num} / ${isAr ? "فصل" : "Chapter"} ${num}`);
    const img = slide.image ? `<img class="fs-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const surface = FS_SURFACES[fsHash(seed, 1) % FS_SURFACES.length];
    const accent  = FS_ACCENTS [fsHash(seed, 2) % FS_ACCENTS.length];
    const tone    = FS_TONES   [fsHash(seed, 3) % FS_TONES.length];
    const layout  = FS_LAYOUTS [fsHash(seed, 4) % FS_LAYOUTS.length];
    const align   = FS_ALIGNS  [fsHash(seed, 5) % FS_ALIGNS.length];

    const slideCls = `fs-slide fs-tone-${tone} fs-align-${align}`;
    const innerCls = `fs-inner fs-surf-${surface} fs-acc-${accent}`;
    const padStyle = surface === "void" || surface === "rule" ? "" : "padding: clamp(32px,4vw,64px);";
    const numAttr  = accent === "num" ? ` data-fs-num="${num}"` : "";
    const wrap = (inner: string) =>
      `<section class="${slideCls}"><div class="${innerCls}" style="${padStyle}"${numAttr}>${inner}</div></section>`;

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<section class="${slideCls} fs-cover">
        <div class="fs-inner">
          <div class="fs-hero-glyph"></div>
          ${slide.subtitle ? `<p class="fs-tag" style="margin-bottom:30px">${esc(slide.subtitle)}</p>` : ""}
          <h1 class="fs-h1">${accentTitle(title)}</h1>
          ${slide.cta ? `<p class="fs-sub">${esc(slide.cta)}</p>` : ""}
          <div class="fs-scroll-hint"><span>${isAr ? "اسحب للأسفل" : "Scroll"}</span><div class="fs-arrow"></div></div>
        </div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="${slideCls} fs-cover" style="justify-content:center;align-items:center">
        <div class="fs-inner fs-surf-grad" style="padding:clamp(48px,6vw,84px);text-align:center;border-radius:4px">
          <p class="fs-tag" style="justify-content:center">${label}</p>
          <h2 class="fs-h2"><em>${esc(title)}</em></h2>
          ${slide.subtitle ? `<p class="fs-sub" style="margin:0 auto">${esc(slide.subtitle)}</p>` : body ? `<p class="fs-sub" style="margin:0 auto">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      const q = esc(slide.quote || title);
      const words = q.split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      const quoteHtml = words.length > 3 ? `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>` : q;
      return `<section class="${slideCls} fs-cover" style="justify-content:center;align-items:center">
        <div class="fs-inner" style="text-align:center">
          <p class="fs-quote">"${quoteHtml}"</p>
          ${slide.attribution ? `<div class="fs-attr">— ${esc(slide.attribution)}</div>` : ""}
        </div>
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="${slideCls} fs-cover" style="justify-content:center;align-items:center">
        <div class="fs-inner" style="text-align:center">
          <p class="fs-tag" style="justify-content:center">${label}</p>
          <div class="fs-big">${esc(slide.big_value)}</div>
          <p class="fs-sub" style="margin:32px auto 0">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="fs-body" style="margin:14px auto 0">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return wrap(`
        <p class="fs-tag">${label}</p>
        <h2 class="fs-h2">${esc(title)}</h2>
        ${body ? `<p class="fs-sub">${body}</p>` : ""}
        ${img}
        <div class="fs-stats">${stats.map(s => `<div class="fs-stat"><div class="fs-stat-v">${esc(s.value)}</div><div class="fs-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      const useManifesto = layout === "manifesto" || layout === "editorial-rev";
      if (useManifesto) {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-manifesto">${steps.map((s,i) => `<div class="fs-mrow"><div class="fs-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="fs-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="fs-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <p class="fs-tag">${label}</p>
        <h2 class="fs-h2">${esc(title)}</h2>
        ${body ? `<p class="fs-sub">${body}</p>` : ""}
        <div class="fs-steps">${steps.map((s,i) => `<div class="fs-step"><div class="fs-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="fs-step-t">${esc(s.title)}</div>${s.desc ? `<div class="fs-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return wrap(`
        <p class="fs-tag">${label}</p>
        <h2 class="fs-h2">${esc(title)}</h2>
        <div class="fs-timeline">${events.map(e => `<div class="fs-trow"><div class="fs-trow-n">${esc(e.date)}</div><div><div class="fs-trow-t">${esc(e.title)}</div>${e.desc ? `<div class="fs-trow-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return wrap(`
        <p class="fs-tag">${label}</p>
        <h2 class="fs-h2">${esc(title)}</h2>
        <div class="fs-compare">
          <div class="fs-ccol"><h3>${esc(slide.left_title || (isAr ? "أ" : "A"))}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div class="fs-ccol"><h3>${esc(slide.right_title || (isAr ? "ب" : "B"))}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:：—–-]\s+/);
        return { t: parts[0], d: parts.slice(1).join(" — "), n: String(i + 1).padStart(2, "0") };
      });

      if (layout === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-bento">${cards.map((c,i) => `<div class="fs-card ${spans[i % spans.length]}"><span class="fs-card-n">${c.n}</span><div class="fs-card-t">${esc(c.t)}</div>${c.d ? `<div class="fs-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "masonry") {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-masonry">${cards.map(c => `<div class="fs-card"><span class="fs-card-n">${c.n}</span><div class="fs-card-t">${esc(c.t)}</div>${c.d ? `<div class="fs-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "mosaic") {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-mosaic">${cards.map(c => `<div class="fs-card"><span class="fs-card-n">${c.n}</span><div class="fs-card-t">${esc(c.t)}</div>${c.d ? `<div class="fs-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "grid2" || layout === "grid3" || layout === "grid4") {
        const gcls = layout === "grid4" ? "fs-grid-4" : layout === "grid2" ? "fs-grid-2" : "fs-grid-3";
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="${gcls}">${cards.map(c => `<div class="fs-card"><span class="fs-card-n">${c.n}</span><div class="fs-card-t">${esc(c.t)}</div>${c.d ? `<div class="fs-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "steps") {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-steps">${cards.map(c => `<div class="fs-step"><div class="fs-step-n">${c.n}</div><div><div class="fs-step-t">${esc(c.t)}</div>${c.d ? `<div class="fs-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "manifesto") {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-manifesto">${cards.map(c => `<div class="fs-mrow"><div class="fs-mrow-n">${c.n}</div><div><div class="fs-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="fs-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "timeline") {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-timeline">${cards.map(c => `<div class="fs-trow"><div class="fs-trow-n">${isAr ? "م" : "·"} ${c.n}</div><div><div class="fs-trow-t">${esc(c.t)}</div>${c.d ? `<div class="fs-trow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "editorial" || layout === "editorial-rev") {
        const cls = layout === "editorial-rev" ? "fs-editorial fs-rev" : "fs-editorial";
        return wrap(`
          <div class="${cls}">
            <div class="fs-ecol-l"><p class="fs-tag">${label}</p><h2>${esc(title)}</h2>${img}</div>
            <div class="fs-ecol-r">${body ? `<p>${body}</p>` : ""}${cards.map(c => `<p><strong style="font-family:'DM Sans',sans-serif;font-weight:500;color:var(--fs-text);">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div>
          </div>
        `);
      }
      if (layout === "pills" || layout === "pills-sq") {
        const cls = layout === "pills-sq" ? "fs-pills fs-pills-sq" : "fs-pills";
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="${cls}">${cards.map(c => `<span class="fs-pill">${esc(c.t)}</span>`).join("")}</div>
        `);
      }
      if (layout === "callouts") {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-callouts">${cards.map(c => `<div class="fs-callout"><div class="fs-callout-t">${esc(c.t)}</div>${c.d ? `<div class="fs-callout-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "hero-list") {
        return wrap(`
          <p class="fs-tag">${label}</p>
          <h2 class="fs-h2">${esc(title)}</h2>
          ${body ? `<p class="fs-sub">${body}</p>` : ""}
          <div class="fs-hero-list">${cards.map(c => `<div class="fs-hero-row"><div class="fs-hero-row-n">${c.n}</div><div><div class="fs-hero-row-t">${esc(c.t)}</div>${c.d ? `<div class="fs-card-d" style="margin-top:10px">${esc(c.d)}</div>` : ""}</div><div class="fs-hero-row-a">→</div></div>`).join("")}</div>
        `);
      }
      // compact default
      return wrap(`
        <p class="fs-tag">${label}</p>
        <h2 class="fs-h2">${esc(title)}</h2>
        ${body ? `<p class="fs-sub">${body}</p>` : ""}
        ${img}
        <ol style="list-style:none;padding:0;margin:2rem 0 0;border-top:1px solid var(--fs-line)">
          ${cards.map(c => `<li style="padding:24px 0;border-bottom:1px solid var(--fs-line);display:grid;grid-template-columns:64px 1fr;gap:28px;align-items:baseline"><span style="font-family:'Space Mono',monospace;font-size:12px;letter-spacing:0.18em;color:var(--fs-muted)">${c.n}</span><div><div style="font-family:'DM Sans',sans-serif;font-size:24px;font-weight:400;letter-spacing:-0.02em;color:var(--fs-text);margin-bottom:6px">${esc(c.t)}</div>${c.d ? `<div style="font-size:14.5px;line-height:1.75;color:var(--fs-muted)">${esc(c.d)}</div>` : ""}</div></li>`).join("")}
        </ol>
      `);
    }

    return wrap(`
      <p class="fs-tag">${label}</p>
      <h2 class="fs-h2">${esc(title)}</h2>
      ${body ? `<p class="fs-body">${body}</p>` : ""}
      ${img}
    `);
  });

  return `<div class="fs-atmos"></div><div class="fs-root">\n${sections.join("\n")}\n</div>`;
}

// ===================== AXIOM — Vector Network =====================
// Combinatorial: 10 surfaces × 9 accents × 8 tones × 16 layouts × 4 aligns = 46,080 unique slide variants.
const AX_SURFACES = ["void","card","paper","tint","ink","outline","frame","rule","grad","mesh"] as const;
const AX_ACCENTS  = ["bar","bar-r","top","under","dot","halo","num","tag","cross"] as const;
const AX_TONES    = ["violet","blue","mono","graphite","mint","rose","amber","duo"] as const;
const AX_LAYOUTS  = ["bento","masonry","mosaic","steps","manifesto","timeline","editorial","editorial-rev","callouts","hero-list","grid2","grid3","grid4","pills","pills-sq","cards-asym"] as const;
const AX_ALIGNS   = ["left","right","center","edge"] as const;

function axHash(seed: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

const AXIOM_LOCK_CSS = `
  :root {
    --ax-bg:#ffffff; --ax-bg-2:#f7f7f5; --ax-text:#0a0a0a; --ax-muted:#888888;
    --ax-line:rgba(10,10,10,0.10); --ax-line-strong:rgba(10,10,10,0.22);
    --ax-violet:#7c3aed; --ax-blue:#2563eb; --ax-mint:#10b981; --ax-rose:#e11d48;
    --ax-amber:#d97706; --ax-graphite:#1f2937; --ax-bone:#f0eeea;
  }
  html, body { background: var(--ax-bg) !important; color: var(--ax-text) !important;
    font-family: 'Inter', system-ui, sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  body > *:not(.ax-atmos):not(.ax-root) { display: none !important; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--ax-bg); }
  ::-webkit-scrollbar-thumb { background: var(--ax-line-strong); border-radius: 3px; }

  /* Vector-network backdrop (pure CSS — no scripts) */
  .ax-atmos { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
    background:
      radial-gradient(circle at 18% 22%, rgba(124,58,237,0.06), transparent 50%),
      radial-gradient(circle at 82% 78%, rgba(37,99,235,0.06), transparent 55%); }
  .ax-atmos::before { content:""; position:absolute; inset:-2px;
    background-image:
      radial-gradient(1.6px 1.6px at 8% 12%, rgba(10,10,10,0.35), transparent 60%),
      radial-gradient(1.4px 1.4px at 22% 38%, rgba(10,10,10,0.30), transparent 60%),
      radial-gradient(1.4px 1.4px at 41% 18%, rgba(124,58,237,0.55), transparent 60%),
      radial-gradient(1.6px 1.6px at 63% 31%, rgba(10,10,10,0.30), transparent 60%),
      radial-gradient(1.4px 1.4px at 78% 14%, rgba(37,99,235,0.55), transparent 60%),
      radial-gradient(1.6px 1.6px at 91% 27%, rgba(10,10,10,0.28), transparent 60%),
      radial-gradient(1.4px 1.4px at 12% 62%, rgba(10,10,10,0.28), transparent 60%),
      radial-gradient(1.6px 1.6px at 34% 73%, rgba(10,10,10,0.30), transparent 60%),
      radial-gradient(1.4px 1.4px at 56% 86%, rgba(124,58,237,0.45), transparent 60%),
      radial-gradient(1.6px 1.6px at 72% 64%, rgba(10,10,10,0.30), transparent 60%),
      radial-gradient(1.4px 1.4px at 88% 82%, rgba(37,99,235,0.45), transparent 60%);
    opacity: 0.85; }
  .ax-atmos::after { content:""; position:absolute; inset:0; opacity:0.5;
    background-image:
      linear-gradient(115deg, transparent 49.6%, rgba(10,10,10,0.07) 49.8%, rgba(10,10,10,0.07) 50%, transparent 50.2%),
      linear-gradient(65deg, transparent 49.7%, rgba(10,10,10,0.05) 49.85%, rgba(10,10,10,0.05) 50%, transparent 50.15%),
      linear-gradient(170deg, transparent 49.8%, rgba(124,58,237,0.10) 49.9%, rgba(124,58,237,0.10) 50%, transparent 50.1%),
      linear-gradient(25deg, transparent 49.8%, rgba(37,99,235,0.10) 49.9%, rgba(37,99,235,0.10) 50%, transparent 50.1%);
    background-size: 260px 260px, 320px 320px, 420px 420px, 380px 380px;
    mix-blend-mode: multiply; }
  .ax-root { position: relative; z-index: 2; }

  /* Tonal palettes */
  .ax-tone-violet   { --ax-acc:124,58,237; --ax-acc2: 37, 99,235; }
  .ax-tone-blue     { --ax-acc: 37, 99,235; --ax-acc2:124, 58,237; }
  .ax-tone-mono     { --ax-acc: 10, 10, 10; --ax-acc2:136,136,136; }
  .ax-tone-graphite { --ax-acc: 31, 41, 55; --ax-acc2:124, 58,237; }
  .ax-tone-mint     { --ax-acc: 16,185,129; --ax-acc2: 37, 99,235; }
  .ax-tone-rose     { --ax-acc:225, 29, 72; --ax-acc2:124, 58,237; }
  .ax-tone-amber    { --ax-acc:217,119,  6; --ax-acc2: 31, 41, 55; }
  .ax-tone-duo      { --ax-acc:124, 58,237; --ax-acc2: 16,185,129; }

  /* Slide frame */
  .ax-slide { min-height:auto; padding: clamp(80px,12vh,160px) clamp(20px,6vw,80px); position:relative;
    max-width:1340px; margin:0 auto; display:flex; flex-direction:column; justify-content:center; }
  .ax-cover { min-height:100vh; align-items:flex-start; justify-content:flex-end; padding-bottom:8vh; }
  .ax-inner { width:100%; max-width:1240px; margin:0 auto; position:relative; z-index:2; }
  .ax-slide.ax-align-left   .ax-inner { margin-left:4%;  margin-right:auto; text-align:left; }
  .ax-slide.ax-align-right  .ax-inner { margin-left:auto; margin-right:4%; text-align:right; }
  .ax-slide.ax-align-center .ax-inner { text-align:center; }
  .ax-slide.ax-align-edge   .ax-inner { max-width:100%; padding:0 2%; text-align:left; }

  /* Surfaces */
  .ax-surf-void    { background:transparent; }
  .ax-surf-card    { background:#ffffff; border:1px solid var(--ax-line); border-radius:6px;
    box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 12px 36px rgba(10,10,10,0.05); }
  .ax-surf-paper   { background: var(--ax-bg-2); border:1px solid var(--ax-line); border-radius:6px; }
  .ax-surf-tint    { background: linear-gradient(160deg, rgba(var(--ax-acc),0.10), rgba(var(--ax-acc),0.02));
    border:1px solid rgba(var(--ax-acc),0.20); border-radius:6px; }
  .ax-surf-ink     { background:#0a0a0a; color:#f7f7f5; border-radius:6px; }
  .ax-surf-ink .ax-h1, .ax-surf-ink .ax-h2, .ax-surf-ink .ax-card-t, .ax-surf-ink .ax-step-t,
  .ax-surf-ink .ax-mrow-t, .ax-surf-ink .ax-trow-t, .ax-surf-ink .ax-hero-row-t, .ax-surf-ink .ax-callout-t { color:#f7f7f5; }
  .ax-surf-ink .ax-sub, .ax-surf-ink .ax-body, .ax-surf-ink .ax-card-d, .ax-surf-ink .ax-step-d,
  .ax-surf-ink .ax-mrow-d, .ax-surf-ink .ax-trow-d, .ax-surf-ink .ax-callout-d { color:rgba(247,247,245,0.7); }
  .ax-surf-ink .ax-card { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.10); }
  .ax-surf-outline { background:transparent; border:1px solid var(--ax-line-strong); border-radius:6px; }
  .ax-surf-frame   { background: var(--ax-bg); border:8px solid #0a0a0a; border-radius:0; }
  .ax-surf-rule    { background:transparent; border-top:1px solid #0a0a0a; border-bottom:1px solid #0a0a0a; border-radius:0; }
  .ax-surf-grad    { background: linear-gradient(135deg, #ffffff, var(--ax-bg-2) 55%, rgba(var(--ax-acc),0.06));
    border:1px solid var(--ax-line); border-radius:6px; }
  .ax-surf-mesh    { background:
      radial-gradient(circle at 20% 20%, rgba(var(--ax-acc),0.10), transparent 55%),
      radial-gradient(circle at 80% 80%, rgba(var(--ax-acc2),0.10), transparent 55%),
      #ffffff;
    border:1px solid var(--ax-line); border-radius:6px; }

  /* Accents */
  .ax-acc-bar    { border-left: 2px solid rgba(var(--ax-acc),1); padding-left:26px; }
  .ax-acc-bar-r  { border-right:2px solid rgba(var(--ax-acc),1); padding-right:26px; }
  .ax-acc-top    { box-shadow: inset 0 2px 0 0 rgba(var(--ax-acc),1); }
  .ax-acc-under  { padding-bottom:20px; border-bottom:2px solid rgba(var(--ax-acc),1); }
  .ax-acc-dot::before { content:""; position:absolute; top:24px; right:24px; width:10px; height:10px;
    background: rgba(var(--ax-acc),1); border-radius:50%; z-index:2; }
  .ax-acc-halo::before { content:""; position:absolute; top:18px; right:18px; width:46px; height:46px;
    border:1px solid rgba(var(--ax-acc),0.55); border-radius:50%; z-index:2; }
  .ax-acc-halo::after  { content:""; position:absolute; top:33px; right:33px; width:16px; height:16px;
    background: rgba(var(--ax-acc),0.85); border-radius:50%; z-index:3; }
  .ax-acc-num::before  { content: attr(data-ax-num); position:absolute; top:18px; right:24px;
    font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.18em; color: var(--ax-muted); z-index:2; }
  .ax-acc-tag::before  { content:"✦"; color: rgba(var(--ax-acc),1); font-size:0.6em; margin-right:12px; vertical-align:middle; }
  .ax-acc-cross::before { content:""; position:absolute; top:24px; right:24px; width:14px; height:14px;
    background: linear-gradient(45deg, transparent 45%, rgba(var(--ax-acc),1) 45%, rgba(var(--ax-acc),1) 55%, transparent 55%),
                linear-gradient(-45deg, transparent 45%, rgba(var(--ax-acc),1) 45%, rgba(var(--ax-acc),1) 55%, transparent 55%); z-index:2; }
  .ax-acc-none { }

  /* Typography */
  .ax-tag { font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.20em; text-transform:uppercase;
    color: var(--ax-muted); font-weight:500; margin-bottom:36px; display:flex; align-items:center; gap:12px; }
  .ax-tag::before { content:"✦"; color: rgba(var(--ax-acc),1); font-size:10px; }
  .ax-slide.ax-align-center .ax-tag { justify-content:center; }
  .ax-slide.ax-align-right  .ax-tag { justify-content:flex-end; flex-direction:row-reverse; }
  .ax-h1 { font-family:'Syne',sans-serif; font-size:clamp(52px,9.5vw,138px); line-height:0.92;
    letter-spacing:-0.04em; font-weight:800; margin-bottom:36px; overflow-wrap:anywhere; color: var(--ax-text); }
  .ax-h1 em { font-style:normal; color:transparent; -webkit-text-stroke:1.5px rgba(var(--ax-acc),1); }
  .ax-h2 { font-family:'Syne',sans-serif; font-size:clamp(36px,5.8vw,82px); line-height:1.0;
    letter-spacing:-0.035em; font-weight:800; margin-bottom:28px; overflow-wrap:anywhere; color: var(--ax-text); }
  .ax-h2 em { font-style:normal; color:transparent; -webkit-text-stroke:1.2px rgba(var(--ax-acc),1); }
  .ax-sub { font-family:'Inter',sans-serif; font-size:clamp(15px,1.5vw,19px); line-height:1.7;
    color:#555; font-weight:300; max-width:620px; margin-bottom:18px; }
  .ax-body { font-family:'Inter',sans-serif; font-size:clamp(15px,1.45vw,18px); line-height:1.75;
    color:#3a3a3a; font-weight:300; max-width:680px; margin-bottom:14px; }
  .ax-slide.ax-align-center .ax-sub, .ax-slide.ax-align-center .ax-body { margin-left:auto; margin-right:auto; }

  /* Stats */
  .ax-stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:0;
    margin-top:2rem; border-top:1px solid var(--ax-line); border-bottom:1px solid var(--ax-line); }
  .ax-stat { padding:42px 24px; border-right:1px solid var(--ax-line); }
  .ax-stat:last-child { border-right:none; }
  .ax-stat-v { font-family:'Syne',sans-serif; font-size:clamp(44px,6.6vw,88px); line-height:1;
    letter-spacing:-0.04em; font-weight:800; color: var(--ax-text); }
  .ax-stat-v em { font-style:normal; color:transparent; -webkit-text-stroke:1.2px rgba(var(--ax-acc),1); }
  .ax-stat-l { font-family:'Inter',sans-serif; font-size:10px; letter-spacing:0.20em; text-transform:uppercase; color: var(--ax-muted); margin-top:14px; font-weight:500; }

  /* Grids */
  .ax-grid-2 { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:1px; margin-top:2rem; background: var(--ax-line); border:1px solid var(--ax-line); }
  .ax-grid-3 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:1px; margin-top:2rem; background: var(--ax-line); border:1px solid var(--ax-line); }
  .ax-grid-4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:1px; margin-top:2rem; background: var(--ax-line); border:1px solid var(--ax-line); }
  .ax-grid-2 > .ax-card, .ax-grid-3 > .ax-card, .ax-grid-4 > .ax-card { background: var(--ax-bg); border:none; border-radius:0; }
  .ax-bento { display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(160px,auto); gap:14px; margin-top:2rem; }
  .ax-mosaic { display:grid; grid-template-columns:2fr 1fr 1fr; gap:14px; margin-top:2rem; }
  .ax-masonry { columns:2; column-gap:20px; margin-top:2rem; }
  .ax-masonry > * { break-inside:avoid; margin-bottom:20px; display:block; }
  .ax-cards-asym { display:grid; grid-template-columns:1.6fr 1fr; gap:14px; margin-top:2rem; }
  .ax-cards-asym > .ax-card:nth-child(3n) { grid-column: span 2; }
  .ax-card { padding:clamp(26px,3vw,40px); background:#ffffff; border:1px solid var(--ax-line);
    border-radius:6px; position:relative; overflow:hidden; transition: transform .35s ease, border-color .35s ease; }
  .ax-card:hover { transform: translateY(-2px); border-color: rgba(var(--ax-acc),0.55); }
  .ax-card-n { font-family:'Inter',sans-serif; font-size:10px; letter-spacing:0.20em;
    color: var(--ax-muted); display:block; margin-bottom:18px; font-weight:500; }
  .ax-card-t { font-family:'Syne',sans-serif; font-size:clamp(22px,2.3vw,30px); letter-spacing:-0.02em;
    font-weight:700; margin-bottom:10px; color: var(--ax-text); line-height:1.15; }
  .ax-card-d { font-size:14.5px; line-height:1.7; color:#666; font-weight:300; }
  .ax-bento .ax-card.b-wide   { grid-column: span 4; }
  .ax-bento .ax-card.b-half   { grid-column: span 3; }
  .ax-bento .ax-card.b-third  { grid-column: span 2; }
  .ax-bento .ax-card.b-tall   { grid-row: span 2; }

  /* Steps / Manifesto / Timeline */
  .ax-steps { display:flex; flex-direction:column; margin-top:2rem; }
  .ax-step { display:grid; grid-template-columns:90px 1fr; gap:36px; padding:30px 0;
    border-top:1px solid var(--ax-line); align-items:baseline; }
  .ax-step:last-child { border-bottom:1px solid var(--ax-line); }
  .ax-step-n { font-family:'Syne',sans-serif; font-size:18px; letter-spacing:-0.02em; font-weight:800; color: rgba(var(--ax-acc),1); }
  .ax-step-t { font-family:'Syne',sans-serif; font-size:clamp(22px,2.3vw,30px); font-weight:700; letter-spacing:-0.02em; margin-bottom:10px; color: var(--ax-text); }
  .ax-step-d { font-size:14.5px; line-height:1.75; color:#666; font-weight:300; }

  .ax-manifesto { display:flex; flex-direction:column; margin-top:2rem; }
  .ax-mrow { display:grid; grid-template-columns:90px 1fr; gap:40px; padding:38px 0;
    border-top:1px solid var(--ax-line); align-items:baseline; transition: padding-left .4s ease; }
  .ax-mrow:hover { padding-left:12px; }
  .ax-mrow:last-child { border-bottom:1px solid var(--ax-line); }
  .ax-mrow-n { font-family:'Inter',sans-serif; font-size:12px; letter-spacing:0.20em; color: var(--ax-muted); font-weight:500; }
  .ax-mrow-t { font-family:'Syne',sans-serif; font-size:clamp(28px,3.2vw,46px); font-weight:800;
    letter-spacing:-0.035em; color: var(--ax-text); line-height:1.05; }
  .ax-mrow-t em { font-style:normal; color:transparent; -webkit-text-stroke:1.2px rgba(var(--ax-acc),1); }
  .ax-mrow-d { font-size:15px; line-height:1.75; color:#666; margin-top:12px; font-weight:300; }

  .ax-timeline { display:flex; flex-direction:column; margin-top:2rem; }
  .ax-trow { display:grid; grid-template-columns:140px 1fr; gap:36px; padding:26px 0;
    border-top:1px solid var(--ax-line); align-items:baseline; }
  .ax-trow:last-child { border-bottom:1px solid var(--ax-line); }
  .ax-trow-n { font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.22em;
    text-transform:uppercase; color: rgba(var(--ax-acc),1); font-weight:600; }
  .ax-trow-t { font-family:'Syne',sans-serif; font-size:clamp(20px,2.1vw,26px); font-weight:700;
    color: var(--ax-text); margin-bottom:6px; letter-spacing:-0.015em; }
  .ax-trow-d { font-size:14.5px; line-height:1.75; color:#666; font-weight:300; }

  /* Quote / Big */
  .ax-quote { font-family:'Syne',sans-serif; font-size:clamp(34px,5.8vw,84px); line-height:1.1;
    letter-spacing:-0.035em; font-weight:700; color: var(--ax-text); max-width:1100px; margin:0 auto; }
  .ax-quote em { font-style:normal; color:transparent; -webkit-text-stroke:1.4px rgba(var(--ax-acc),1); }
  .ax-attr { font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color: var(--ax-muted); margin-top:40px; font-weight:500; }
  .ax-big { font-family:'Syne',sans-serif; font-size:clamp(120px,23vw,360px); line-height:0.86;
    letter-spacing:-0.06em; font-weight:800; color: var(--ax-text); text-align:center; }
  .ax-big em { font-style:normal; color:transparent; -webkit-text-stroke:2px rgba(var(--ax-acc),1); }

  /* Compare */
  .ax-compare { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:2rem; }
  .ax-ccol { padding:clamp(30px,3.4vw,48px); background:#ffffff; border:1px solid var(--ax-line); border-radius:6px; }
  .ax-ccol h3 { font-family:'Syne',sans-serif; font-size:clamp(22px,2.4vw,30px); font-weight:800;
    letter-spacing:-0.02em; margin-bottom:24px; color: var(--ax-text); }
  .ax-ccol h3::before { content:""; display:inline-block; width:10px; height:10px; background: rgba(var(--ax-acc),1); margin-right:12px; vertical-align:middle; border-radius:50%; }
  .ax-ccol p { font-size:14.5px; line-height:1.75; padding:14px 0; border-top:1px solid var(--ax-line);
    margin:0; color:#3a3a3a; font-weight:300; }

  /* Editorial */
  .ax-editorial { display:grid; grid-template-columns:1fr 1.4fr; gap:72px; align-items:start; margin-top:1rem; }
  .ax-editorial.ax-rev { grid-template-columns:1.4fr 1fr; }
  .ax-ecol-l h2 { font-family:'Syne',sans-serif; font-size:clamp(38px,5.6vw,78px); line-height:0.98;
    letter-spacing:-0.035em; font-weight:800; margin-bottom:20px; }
  .ax-ecol-l h2 em { font-style:normal; color:transparent; -webkit-text-stroke:1.4px rgba(var(--ax-acc),1); }
  .ax-ecol-r p { font-size:15.5px; line-height:1.85; color:#3a3a3a; margin-bottom:14px; font-weight:300; }

  /* Pills */
  .ax-pills { display:flex; flex-wrap:wrap; gap:8px; margin-top:2rem; }
  .ax-pill { font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.10em; padding:10px 18px;
    border:1px solid var(--ax-line-strong); color: var(--ax-text); border-radius:999px;
    background:#ffffff; text-transform:uppercase; font-weight:500; transition: all .25s; }
  .ax-pill:hover { background: rgba(var(--ax-acc),1); color:#fff; border-color: rgba(var(--ax-acc),1); }
  .ax-pills-sq .ax-pill { border-radius:0; }

  /* Callouts */
  .ax-callouts { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px,1fr)); gap:14px; margin-top:2rem; }
  .ax-callout { padding:32px; background:#ffffff; border:1px solid var(--ax-line); border-radius:6px;
    border-top:3px solid rgba(var(--ax-acc),1); }
  .ax-callout-t { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; margin-bottom:10px; color: var(--ax-text); letter-spacing:-0.015em; }
  .ax-callout-d { font-size:14px; line-height:1.7; color:#666; font-weight:300; }

  /* Hero list */
  .ax-hero-list { margin-top:2rem; border-top:1px solid var(--ax-line); }
  .ax-hero-row { display:grid; grid-template-columns:80px 1fr 40px; gap:32px; padding:28px 0;
    border-bottom:1px solid var(--ax-line); align-items:baseline; cursor:default; transition: color .3s ease; }
  .ax-hero-row-n { font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.20em; color: var(--ax-muted); font-weight:500; }
  .ax-hero-row-t { font-family:'Syne',sans-serif; font-size:clamp(30px,4.6vw,66px); font-weight:800;
    letter-spacing:-0.035em; color: var(--ax-text); line-height:1.05; transition: -webkit-text-stroke .3s, color .3s; }
  .ax-hero-row-a { font-family:'Inter',sans-serif; font-size:18px; color: var(--ax-muted); text-align:right; transition: color .3s, transform .3s; }
  .ax-hero-row:hover .ax-hero-row-t { color:transparent; -webkit-text-stroke:1.5px rgba(var(--ax-acc),1); }
  .ax-hero-row:hover .ax-hero-row-a { color: rgba(var(--ax-acc),1); transform: translateX(6px); }

  /* Image */
  .ax-img { display:block; width:100%; max-width:920px; max-height:460px; object-fit:cover;
    margin:2rem auto; border:1px solid var(--ax-line); border-radius:6px; }

  /* Hero glyph — vector network node cluster */
  .ax-hero-glyph { position:relative; width:clamp(220px,28vw,340px); height:clamp(140px,18vw,200px); margin:0 0 64px; }
  .ax-hero-glyph::before { content:""; position:absolute; inset:0;
    background-image:
      radial-gradient(3px 3px at 18% 22%, rgba(var(--ax-acc),1), transparent 60%),
      radial-gradient(3px 3px at 70% 14%, rgba(var(--ax-acc2),1), transparent 60%),
      radial-gradient(2.5px 2.5px at 44% 56%, rgba(10,10,10,0.85), transparent 60%),
      radial-gradient(2.5px 2.5px at 86% 70%, rgba(var(--ax-acc),0.9), transparent 60%),
      radial-gradient(2.5px 2.5px at 12% 84%, rgba(var(--ax-acc2),0.9), transparent 60%); }
  .ax-hero-glyph::after { content:""; position:absolute; inset:0;
    background-image:
      linear-gradient(110deg, transparent 49.4%, rgba(10,10,10,0.30) 49.7%, rgba(10,10,10,0.30) 50.3%, transparent 50.6%),
      linear-gradient(160deg, transparent 49.5%, rgba(var(--ax-acc),0.40) 49.8%, rgba(var(--ax-acc),0.40) 50.2%, transparent 50.5%),
      linear-gradient(40deg, transparent 49.5%, rgba(var(--ax-acc2),0.40) 49.8%, rgba(var(--ax-acc2),0.40) 50.2%, transparent 50.5%);
    background-size: 100% 100%, 100% 100%, 100% 100%; }
  .ax-slide.ax-align-center .ax-hero-glyph { margin-left:auto; margin-right:auto; }

  /* Scroll hint */
  .ax-scroll-hint { margin-top:64px; display:flex; align-items:center; gap:12px;
    font-family:'Inter',sans-serif; font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color: var(--ax-muted); font-weight:500; }
  .ax-scroll-hint .ax-arrow { width:40px; height:1px; background: var(--ax-muted); }

  /* RTL */
  [dir="rtl"] .ax-sub, [dir="rtl"] .ax-body, [dir="rtl"] .ax-card-d, [dir="rtl"] .ax-step-d,
  [dir="rtl"] .ax-mrow-d, [dir="rtl"] .ax-trow-d, [dir="rtl"] .ax-callout-d { text-align:right; }
  [dir="rtl"] .ax-step, [dir="rtl"] .ax-mrow { grid-template-columns: 1fr 90px; }
  [dir="rtl"] .ax-trow { grid-template-columns: 1fr 140px; }
  [dir="rtl"] .ax-hero-row { grid-template-columns: 40px 1fr 80px; }
  [dir="rtl"] .ax-hero-row-a { text-align:left; }
  [dir="rtl"] .ax-editorial { grid-template-columns: 1.4fr 1fr; }
  [dir="rtl"] .ax-editorial.ax-rev { grid-template-columns: 1fr 1.4fr; }
  [dir="rtl"] .ax-acc-bar { border-left:none; border-right:2px solid rgba(var(--ax-acc),1); padding-left:0; padding-right:26px; }
  [dir="rtl"] .ax-acc-bar-r { border-right:none; border-left:2px solid rgba(var(--ax-acc),1); padding-right:0; padding-left:26px; }
  [dir="rtl"] .ax-acc-dot::before, [dir="rtl"] .ax-acc-halo::before, [dir="rtl"] .ax-acc-num::before, [dir="rtl"] .ax-acc-cross::before { right:auto; left:24px; }
  [dir="rtl"] .ax-acc-halo::after { right:auto; left:33px; }

  @media (max-width: 1024px) {
    .ax-editorial, .ax-editorial.ax-rev { grid-template-columns: 1fr; gap:36px; }
    .ax-bento, .ax-cards-asym { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .ax-bento .ax-card.b-wide, .ax-bento .ax-card.b-half, .ax-bento .ax-card.b-third { grid-column: span 2; }
    .ax-mosaic { grid-template-columns: 1fr 1fr; }
    .ax-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 640px) {
    .ax-bento, .ax-cards-asym, .ax-mosaic, .ax-grid-2, .ax-grid-3, .ax-grid-4, .ax-compare, .ax-callouts { grid-template-columns: 1fr; }
    .ax-masonry { columns: 1; }
    .ax-step, .ax-mrow, .ax-trow, .ax-hero-row { grid-template-columns: 1fr; gap:10px; }
  }
`;

function renderAxiomDeck(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI

  const accentTitle = (raw: string): string => {
    const safe = esc(raw);
    const words = safe.split(/\s+/);
    if (words.length < 2) return safe;
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>`;
  };

  const sections = slides.map((slide, idx) => {
    const title = slide.title || deck.title || "";
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets || []).slice(0, 8);
    const num = String(idx + 1).padStart(2, "0");
    const label = esc(slide.kicker || `${num} / ${isAr ? "فصل" : "Chapter"} ${num}`);
    const img = slide.image ? `<img class="ax-img" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    const seed = `${deck.htmlSlug}|${idx}|${title}`;
    const surface = AX_SURFACES[axHash(seed, 1) % AX_SURFACES.length];
    const accent  = AX_ACCENTS [axHash(seed, 2) % AX_ACCENTS.length];
    const tone    = AX_TONES   [axHash(seed, 3) % AX_TONES.length];
    const layout  = AX_LAYOUTS [axHash(seed, 4) % AX_LAYOUTS.length];
    const align   = AX_ALIGNS  [axHash(seed, 5) % AX_ALIGNS.length];

    const slideCls = `ax-slide ax-tone-${tone} ax-align-${align}`;
    const innerCls = `ax-inner ax-surf-${surface} ax-acc-${accent}`;
    const padStyle = surface === "void" || surface === "rule" ? "" : "padding: clamp(32px,4vw,64px);";
    const numAttr  = accent === "num" ? ` data-ax-num="${num}"` : "";
    const wrap = (inner: string) =>
      `<section class="${slideCls}"><div class="${innerCls}" style="${padStyle}"${numAttr}>${inner}</div></section>`;

    if (idx === 0 || slide.type === "cover") {
      return `<section class="${slideCls} ax-cover">
        <div class="ax-inner">
          <div class="ax-hero-glyph"></div>
          ${slide.subtitle ? `<p class="ax-tag" style="margin-bottom:30px">${esc(slide.subtitle)}</p>` : ""}
          <h1 class="ax-h1">${accentTitle(title)}</h1>
          ${slide.cta ? `<p class="ax-sub">${esc(slide.cta)}</p>` : ""}
          <div class="ax-scroll-hint"><span>${isAr ? "اسحب للأسفل" : "Scroll"}</span><div class="ax-arrow"></div></div>
        </div>
      </section>`;
    }

    if (slide.type === "closing") {
      return `<section class="${slideCls} ax-cover" style="justify-content:center;align-items:center">
        <div class="ax-inner ax-surf-grad" style="padding:clamp(48px,6vw,84px);text-align:center;border-radius:6px">
          <p class="ax-tag" style="justify-content:center">${label}</p>
          <h2 class="ax-h2"><em>${esc(title)}</em></h2>
          ${slide.subtitle ? `<p class="ax-sub" style="margin:0 auto">${esc(slide.subtitle)}</p>` : body ? `<p class="ax-sub" style="margin:0 auto">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.type === "quote" || slide.quote) {
      const q = esc(slide.quote || title);
      const words = q.split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      const quoteHtml = words.length > 3 ? `${words.slice(0,mid).join(" ")} <em>${words.slice(mid).join(" ")}</em>` : q;
      return `<section class="${slideCls} ax-cover" style="justify-content:center;align-items:center">
        <div class="ax-inner" style="text-align:center">
          <p class="ax-quote">"${quoteHtml}"</p>
          ${slide.attribution ? `<div class="ax-attr">— ${esc(slide.attribution)}</div>` : ""}
        </div>
      </section>`;
    }

    if (slide.big_value) {
      return `<section class="${slideCls} ax-cover" style="justify-content:center;align-items:center">
        <div class="ax-inner" style="text-align:center">
          <p class="ax-tag" style="justify-content:center">${label}</p>
          <div class="ax-big">${esc(slide.big_value)}</div>
          <p class="ax-sub" style="margin:32px auto 0">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="ax-body" style="margin:14px auto 0">${body}</p>` : ""}
        </div>
      </section>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return wrap(`
        <p class="ax-tag">${label}</p>
        <h2 class="ax-h2">${esc(title)}</h2>
        ${body ? `<p class="ax-sub">${body}</p>` : ""}
        ${img}
        <div class="ax-stats">${stats.map(s => `<div class="ax-stat"><div class="ax-stat-v">${esc(s.value)}</div><div class="ax-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
      `);
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      const useManifesto = layout === "manifesto" || layout === "editorial-rev";
      if (useManifesto) {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-manifesto">${steps.map((s,i) => `<div class="ax-mrow"><div class="ax-mrow-n">${String(i+1).padStart(2,"0")}</div><div><div class="ax-mrow-t">${esc(s.title)}</div>${s.desc ? `<div class="ax-mrow-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <p class="ax-tag">${label}</p>
        <h2 class="ax-h2">${esc(title)}</h2>
        ${body ? `<p class="ax-sub">${body}</p>` : ""}
        <div class="ax-steps">${steps.map((s,i) => `<div class="ax-step"><div class="ax-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="ax-step-t">${esc(s.title)}</div>${s.desc ? `<div class="ax-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return wrap(`
        <p class="ax-tag">${label}</p>
        <h2 class="ax-h2">${esc(title)}</h2>
        <div class="ax-timeline">${events.map(e => `<div class="ax-trow"><div class="ax-trow-n">${esc(e.date)}</div><div><div class="ax-trow-t">${esc(e.title)}</div>${e.desc ? `<div class="ax-trow-d">${esc(e.desc)}</div>` : ""}</div></div>`).join("")}</div>
      `);
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      return wrap(`
        <p class="ax-tag">${label}</p>
        <h2 class="ax-h2">${esc(title)}</h2>
        <div class="ax-compare">
          <div class="ax-ccol"><h3>${esc(slide.left_title || (isAr ? "أ" : "A"))}</h3>${slide.left_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          <div class="ax-ccol"><h3>${esc(slide.right_title || (isAr ? "ب" : "B"))}</h3>${slide.right_bullets.slice(0,5).map(b => `<p>${esc(b)}</p>`).join("")}</div>
        </div>
      `);
    }

    if (bullets.length) {
      const cards = bullets.map((b, i) => {
        const parts = String(b).split(/[:：—–-]\s+/);
        return { t: parts[0], d: parts.slice(1).join(" — "), n: String(i + 1).padStart(2, "0") };
      });

      if (layout === "bento") {
        const spans = ["b-wide","b-third","b-third","b-half","b-half","b-third","b-third","b-wide"];
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-bento">${cards.map((c,i) => `<div class="ax-card ${spans[i % spans.length]}"><span class="ax-card-n">${c.n}</span><div class="ax-card-t">${esc(c.t)}</div>${c.d ? `<div class="ax-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "masonry") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-masonry">${cards.map(c => `<div class="ax-card"><span class="ax-card-n">${c.n}</span><div class="ax-card-t">${esc(c.t)}</div>${c.d ? `<div class="ax-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "mosaic") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-mosaic">${cards.map(c => `<div class="ax-card"><span class="ax-card-n">${c.n}</span><div class="ax-card-t">${esc(c.t)}</div>${c.d ? `<div class="ax-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "cards-asym") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-cards-asym">${cards.map(c => `<div class="ax-card"><span class="ax-card-n">${c.n}</span><div class="ax-card-t">${esc(c.t)}</div>${c.d ? `<div class="ax-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "grid2" || layout === "grid3" || layout === "grid4") {
        const gcls = layout === "grid4" ? "ax-grid-4" : layout === "grid2" ? "ax-grid-2" : "ax-grid-3";
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="${gcls}">${cards.map(c => `<div class="ax-card"><span class="ax-card-n">${c.n}</span><div class="ax-card-t">${esc(c.t)}</div>${c.d ? `<div class="ax-card-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "steps") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-steps">${cards.map(c => `<div class="ax-step"><div class="ax-step-n">${c.n}</div><div><div class="ax-step-t">${esc(c.t)}</div>${c.d ? `<div class="ax-step-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "manifesto") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-manifesto">${cards.map(c => `<div class="ax-mrow"><div class="ax-mrow-n">${c.n}</div><div><div class="ax-mrow-t">${esc(c.t)}</div>${c.d ? `<div class="ax-mrow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "timeline") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-timeline">${cards.map(c => `<div class="ax-trow"><div class="ax-trow-n">${isAr ? "م" : "·"} ${c.n}</div><div><div class="ax-trow-t">${esc(c.t)}</div>${c.d ? `<div class="ax-trow-d">${esc(c.d)}</div>` : ""}</div></div>`).join("")}</div>
        `);
      }
      if (layout === "editorial" || layout === "editorial-rev") {
        const cls = layout === "editorial-rev" ? "ax-editorial ax-rev" : "ax-editorial";
        return wrap(`
          <div class="${cls}">
            <div class="ax-ecol-l"><p class="ax-tag">${label}</p><h2>${esc(title)}</h2>${img}</div>
            <div class="ax-ecol-r">${body ? `<p>${body}</p>` : ""}${cards.map(c => `<p><strong style="font-family:'Syne',sans-serif;font-weight:700;color:var(--ax-text);">${esc(c.t)}</strong>${c.d ? ` — ${esc(c.d)}` : ""}</p>`).join("")}</div>
          </div>
        `);
      }
      if (layout === "pills" || layout === "pills-sq") {
        const cls = layout === "pills-sq" ? "ax-pills ax-pills-sq" : "ax-pills";
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="${cls}">${cards.map(c => `<span class="ax-pill">${esc(c.t)}</span>`).join("")}</div>
        `);
      }
      if (layout === "callouts") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-callouts">${cards.map(c => `<div class="ax-callout"><div class="ax-callout-t">${esc(c.t)}</div>${c.d ? `<div class="ax-callout-d">${esc(c.d)}</div>` : ""}</div>`).join("")}</div>
        `);
      }
      if (layout === "hero-list") {
        return wrap(`
          <p class="ax-tag">${label}</p>
          <h2 class="ax-h2">${esc(title)}</h2>
          ${body ? `<p class="ax-sub">${body}</p>` : ""}
          <div class="ax-hero-list">${cards.map(c => `<div class="ax-hero-row"><div class="ax-hero-row-n">${c.n}</div><div><div class="ax-hero-row-t">${esc(c.t)}</div>${c.d ? `<div class="ax-card-d" style="margin-top:10px">${esc(c.d)}</div>` : ""}</div><div class="ax-hero-row-a">→</div></div>`).join("")}</div>
        `);
      }
      return wrap(`
        <p class="ax-tag">${label}</p>
        <h2 class="ax-h2">${esc(title)}</h2>
        ${body ? `<p class="ax-sub">${body}</p>` : ""}
        ${img}
        <ol style="list-style:none;padding:0;margin:2rem 0 0;border-top:1px solid var(--ax-line)">
          ${cards.map(c => `<li style="padding:24px 0;border-bottom:1px solid var(--ax-line);display:grid;grid-template-columns:64px 1fr;gap:28px;align-items:baseline"><span style="font-family:'Inter',sans-serif;font-size:12px;letter-spacing:0.18em;color:var(--ax-muted);font-weight:500">${c.n}</span><div><div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:var(--ax-text);margin-bottom:6px">${esc(c.t)}</div>${c.d ? `<div style="font-size:14.5px;line-height:1.75;color:#666">${esc(c.d)}</div>` : ""}</div></li>`).join("")}
        </ol>
      `);
    }

    return wrap(`
      <p class="ax-tag">${label}</p>
      <h2 class="ax-h2">${esc(title)}</h2>
      ${body ? `<p class="ax-body">${body}</p>` : ""}
      ${img}
    `);
  });

  return `<div class="ax-atmos"></div><div class="ax-root">\n${sections.join("\n")}\n</div>`;
}







function renderSeasonalScrollDeckImpl(deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const slides = deck.slides.length ? deck.slides : [{ type: "cover", title: deck.title, subtitle: deck.subtitle }];
  const isAr = false; // Forced English UI
  const labels = isAr ? SEASON_LABELS_AR : SEASON_LABELS_EN;

  // Combinatorial design system → 4 seasons × 8 surfaces × 7 accents × 14 layouts = 3,136 unique slide variants.
  const SURFACES = ["clean", "frost", "border", "tint", "glass", "ink", "grad", "paper"];
  const ACCENTS  = ["top", "left", "corner", "underline", "dot", "bar", "num"];
  const LAYOUTS  = ["bento", "grid3", "grid2", "grid4", "masonry", "steps", "manifesto", "split", "split-rev", "pills", "pills-sq", "timeline", "editorial", "callouts"];

  const hash = (seed: string, salt: number) => {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  };

  const parts = slides.map((slide, idx) => {
    const seasonIdx = idx % 4;
    const season = SEASONS[seasonIdx];
    const seasonLabel = labels[seasonIdx];
    const num = String(idx + 1).padStart(2, "0");
    const kicker = `${num} — ${seasonLabel}${slide.kicker ? ` / ${esc(slide.kicker)}` : ""}`;
    const title = esc(slide.title || deck.title || "");
    const body = esc(slide.body || slide.subtitle || "");
    const bullets = (slide.bullets?.length ? slide.bullets : slide.left_bullets?.length ? slide.left_bullets : slide.right_bullets || []).slice(0, 6);

    const seed = `${deck.htmlSlug || "ss"}|${idx}|${slide.title || ""}|${slide.type || ""}`;
    const surface = SURFACES[hash(seed, 1) % SURFACES.length];
    const accent  = ACCENTS [hash(seed, 2) % ACCENTS.length];
    const layout  = LAYOUTS [hash(seed, 4) % LAYOUTS.length];
    const surfClass = `ss2-surf-${surface}`;
    const accClass  = `ss2-acc-${accent}`;
    const seasonClass = `section section-${season} ss2-slide`;
    const img = slide.image ? `<img class="ss2-img${hash(seed,5)%3===0 ? " ss2-img-wide" : ""}" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : "";

    // Cover
    if (idx === 0 || slide.type === "cover") {
      return `<div class="${seasonClass} ss2-cover">
        ${slide.image ? `<img class="ss2-cover-bg" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'"/>` : ""}
        <div class="ss2-inner">
          <span class="ss2-label">${kicker}</span>
          <h1 class="ss2-title">${title}</h1>
          ${slide.subtitle ? `<p class="ss2-sub">${esc(slide.subtitle)}</p>` : ""}
        </div>
      </div>`;
    }

    if (slide.type === "closing") {
      return `<div class="${seasonClass} ss2-cover">
        <div class="ss2-inner">
          <span class="ss2-label">${kicker}</span>
          <h2 class="ss2-title">${title || (isAr ? "شكراً" : "Thank You")}</h2>
          ${body ? `<p class="ss2-sub">${body}</p>` : ""}
        </div>
      </div>`;
    }

    if (slide.type === "quote" || slide.quote) {
      return `<div class="${seasonClass} ss2-cover">
        <div class="ss2-inner">
          <blockquote class="ss2-quote">"${esc(slide.quote || slide.title || "")}"</blockquote>
          ${slide.attribution ? `<span class="ss2-attr">— ${esc(slide.attribution)}</span>` : ""}
        </div>
      </div>`;
    }

    if (slide.big_value) {
      return `<div class="${seasonClass} ss2-cover">
        <div class="ss2-inner">
          <span class="ss2-label">${kicker}</span>
          <div class="ss2-big">${esc(slide.big_value)}</div>
          <p class="ss2-sub" style="margin:18px auto 0">${esc(slide.big_label || title)}</p>
          ${body ? `<p class="ss2-sub" style="margin:10px auto 0">${body}</p>` : ""}
        </div>
      </div>`;
    }

    if (slide.stats?.length) {
      const stats = slide.stats.slice(0, 4);
      return `<div class="${seasonClass}">
        <div class="ss2-inner">
          <span class="ss2-label">${kicker}</span>
          <h2 class="ss2-title">${title}</h2>
          ${body ? `<p class="ss2-body">${body}</p>` : ""}
          ${img}
          <div class="ss2-stats">${stats.map(s => `<div class="ss2-stat ${surfClass} ${accClass}"><div class="ss2-stat-v">${esc(s.value)}</div><div class="ss2-stat-l">${esc(s.label)}</div></div>`).join("")}</div>
        </div>
      </div>`;
    }

    if (slide.steps?.length) {
      const steps = slide.steps.slice(0, 6);
      return `<div class="${seasonClass}">
        <div class="ss2-inner">
          <span class="ss2-label">${kicker}</span>
          <h2 class="ss2-title">${title}</h2>
          ${body ? `<p class="ss2-body">${body}</p>` : ""}
          <div class="ss2-steps ${accClass}">${steps.map((s, i) => `<div class="ss2-step"><div class="ss2-step-n">${String(i + 1).padStart(2, "0")}</div><div><div class="ss2-step-t">${esc(s.title)}</div>${s.desc ? `<div class="ss2-step-d">${esc(s.desc)}</div>` : ""}</div></div>`).join("")}</div>
        </div>
      </div>`;
    }

    if (slide.events?.length) {
      const events = slide.events.slice(0, 6);
      return `<div class="${seasonClass}">
        <div class="ss2-inner">
          <span class="ss2-label">${kicker}</span>
          <h2 class="ss2-title">${title}</h2>
          <div class="ss2-tl">${events.map(e => `<div class="ss2-tl-item"><div class="ss2-tl-k">${esc(e.date)}</div><div class="ss2-tl-t">${esc(e.title)}</div>${e.desc ? `<div class="ss2-tl-d">${esc(e.desc)}</div>` : ""}</div>`).join("")}</div>
        </div>
      </div>`;
    }

    if (slide.left_bullets?.length && slide.right_bullets?.length) {
      const lt = esc(slide.left_title || "A"); const rt = esc(slide.right_title || "B");
      return `<div class="${seasonClass}">
        <div class="ss2-inner">
          <span class="ss2-label">${kicker}</span>
          <h2 class="ss2-title">${title}</h2>
          <div class="ss2-compare">
            <div class="${surfClass}"><h3>${lt}</h3>${slide.left_bullets.slice(0,6).map(b => `<p>${esc(b)}</p>`).join("")}</div>
            <div class="${surfClass}"><h3>${rt}</h3>${slide.right_bullets.slice(0,6).map(b => `<p>${esc(b)}</p>`).join("")}</div>
          </div>
        </div>
      </div>`;
    }

    if (bullets.length >= 2) {
      const parsed = bullets.map(b => {
        const parts2 = b.split(/[:：—-]\s*/, 2);
        return { h: esc(parts2[0] || b), d: esc(parts2[1] || "") };
      });
      const cardCls = `ss2-card ${surfClass} ${accClass}`;
      const cards = (limit = 6) => parsed.slice(0, limit).map((p, i) =>
        `<div class="${cardCls}"><div class="ss2-card-n">${String(i + 1).padStart(2, "0")}</div><div class="ss2-card-t">${p.h}</div>${p.d ? `<div class="ss2-card-d">${p.d}</div>` : ""}</div>`
      ).join("");

      const header = `<span class="ss2-label">${kicker}</span>
        <h2 class="ss2-title">${title}</h2>
        ${body ? `<p class="ss2-body">${body}</p>` : ""}`;

      if (layout === "bento")     return `<div class="${seasonClass}"><div class="ss2-inner">${header}${img}<div class="ss2-bento">${cards()}</div></div></div>`;
      if (layout === "grid3")     return `<div class="${seasonClass}"><div class="ss2-inner">${header}${img}<div class="ss2-grid-3">${cards()}</div></div></div>`;
      if (layout === "grid2")     return `<div class="${seasonClass}"><div class="ss2-inner" style="max-width:1080px">${header}${img}<div class="ss2-grid-2">${cards(4)}</div></div></div>`;
      if (layout === "grid4")     return `<div class="${seasonClass}"><div class="ss2-inner">${header}${img}<div class="ss2-grid-4">${cards()}</div></div></div>`;
      if (layout === "masonry")   return `<div class="${seasonClass}"><div class="ss2-inner">${header}${img}<div class="ss2-masonry">${cards()}</div></div></div>`;
      if (layout === "steps")     return `<div class="${seasonClass}"><div class="ss2-inner" style="max-width:980px">${header}<div class="ss2-steps ${accClass}">${parsed.slice(0,6).map((p,i)=>`<div class="ss2-step"><div class="ss2-step-n">${String(i+1).padStart(2,"0")}</div><div><div class="ss2-step-t">${p.h}</div>${p.d?`<div class="ss2-step-d">${p.d}</div>`:""}</div></div>`).join("")}</div></div></div>`;
      if (layout === "manifesto") return `<div class="${seasonClass}"><div class="ss2-inner" style="max-width:1020px">${header}<div class="ss2-mani">${parsed.slice(0,6).map((p,i)=>`<div class="ss2-mani-row"><div class="ss2-mani-k">${isAr ? "بند" : "Item"} · ${String(i+1).padStart(2,"0")}</div><div><div class="ss2-mani-t">${p.h}</div>${p.d?`<div class="ss2-mani-d">${p.d}</div>`:""}</div></div>`).join("")}</div></div></div>`;
      if (layout === "split" || layout === "split-rev")
        return `<div class="${seasonClass}"><div class="ss2-inner"><div class="ss2-split ${layout==="split-rev"?"ss2-split-rev":""}"><div>${header}${img}</div><div class="ss2-edit-list">${parsed.slice(0,6).map((p,i)=>`<div class="ss2-edit-item"><div class="ss2-edit-k">${String(i+1).padStart(2,"0")}</div><div class="ss2-edit-t">${p.h}</div>${p.d?`<div class="ss2-edit-d">${p.d}</div>`:""}</div>`).join("")}</div></div></div></div>`;
      if (layout === "pills" || layout === "pills-sq")
        return `<div class="${seasonClass}"><div class="ss2-inner" style="max-width:1060px">${header}${img}<div class="ss2-pills">${parsed.slice(0,8).map(p=>`<span class="ss2-pill ${layout==="pills-sq"?"ss2-pill-sq":""}">${p.h}</span>`).join("")}</div></div></div>`;
      if (layout === "timeline")  return `<div class="${seasonClass}"><div class="ss2-inner">${header}<div class="ss2-tl">${parsed.slice(0,6).map((p,i)=>`<div class="ss2-tl-item"><div class="ss2-tl-k">${String(i+1).padStart(2,"0")}</div><div class="ss2-tl-t">${p.h}</div>${p.d?`<div class="ss2-tl-d">${p.d}</div>`:""}</div>`).join("")}</div></div></div>`;
      if (layout === "editorial") return `<div class="${seasonClass}"><div class="ss2-inner" style="max-width:1080px">${header}<div class="ss2-edit-list">${parsed.slice(0,6).map((p,i)=>`<div class="ss2-edit-item"><div class="ss2-edit-k">${String(i+1).padStart(2,"0")}</div><div class="ss2-edit-t">${p.h}</div>${p.d?`<div class="ss2-edit-d">${p.d}</div>`:""}</div>`).join("")}</div></div></div>`;
      // callouts
      return `<div class="${seasonClass}"><div class="ss2-inner">${header}${img}<div class="ss2-call">${parsed.slice(0,6).map((p,i)=>`<div class="ss2-call-box ${surfClass} ${accClass}"><div class="ss2-card-n">${String(i+1).padStart(2,"0")}</div><div class="ss2-card-t">${p.h}</div>${p.d?`<div class="ss2-card-d">${p.d}</div>`:""}</div>`).join("")}</div></div></div>`;
    }

    // Plain fallback
    return `<div class="${seasonClass}">
      <div class="ss2-inner">
        <span class="ss2-label">${kicker}</span>
        <h2 class="ss2-title">${title}</h2>
        ${body ? `<p class="ss2-body">${body}</p>` : ""}
        ${img}
      </div>
    </div>`;
  }).join("\n");

  return parts + `<div class="section-indicator" id="indicators"></div>`;
}

const SEASONAL_LOCK_CSS = `
  body > canvas { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 0 !important; pointer-events: none; }
  .section-indicator, #indicators { display: none !important; }

  /* Per-season palettes (locked) */
  .section-spring { background: #c8dbbe !important; color: #2d3a25 !important; --ss-acc: 80,110,60;  --ss-soft: 240,246,222; }
  .section-summer { background: #e8d4b0 !important; color: #4a3820 !important; --ss-acc: 158,98,40; --ss-soft: 248,236,212; }
  .section-autumn { background: #d4bfaa !important; color: #3d2820 !important; --ss-acc: 168,82,46; --ss-soft: 240,224,206; }
  .section-winter { background: #b8c8dc !important; color: #1d2a3a !important; --ss-acc: 56,90,140; --ss-soft: 226,234,246; }

  /* Slide frame */
  .ss2-slide { position: relative; z-index: 1; width: 100%; min-height: 100vh; height: auto !important; display: flex; align-items: center !important; justify-content: flex-start; padding: clamp(64px, 11vh, 140px) clamp(28px, 6vw, 110px) !important; box-sizing: border-box; }
  .ss2-cover { align-items: center !important; justify-content: center !important; text-align: center; min-height: 96vh; }
  .ss2-inner { position: relative; z-index: 20; width: 100%; max-width: 1200px; margin: 0 auto; }
  .ss2-cover .ss2-inner { max-width: 880px; text-align: center; }

  /* Surfaces (cards) */
  .ss2-surf-clean  { background: rgba(255,255,255,0.45); border: 1px solid rgba(0,0,0,0.10); }
  .ss2-surf-frost  { background: rgba(255,255,255,0.35); backdrop-filter: blur(12px); border: 1px solid rgba(0,0,0,0.08); }
  .ss2-surf-border { background: rgba(255,255,255,0.55); border: 1.5px solid currentColor; }
  .ss2-surf-tint   { background: rgba(var(--ss-soft),0.7); border: 1px solid rgba(var(--ss-acc),0.2); }
  .ss2-surf-glass  { background: rgba(255,255,255,0.2); backdrop-filter: blur(18px) saturate(140%); border: 1px solid rgba(255,255,255,0.5); }
  .ss2-surf-ink    { background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.14); }
  .ss2-surf-grad   { background: linear-gradient(135deg, rgba(255,255,255,0.6), rgba(var(--ss-soft),0.6)); border: 1px solid rgba(0,0,0,0.08); }
  .ss2-surf-paper  { background: rgba(255,253,245,0.7); border-top: 4px solid rgba(var(--ss-acc),0.85); }

  /* Accents */
  .ss2-acc-top    { box-shadow: inset 0 3px 0 0 rgba(var(--ss-acc),0.85); }
  .ss2-acc-left   { box-shadow: inset 3px 0 0 0 rgba(var(--ss-acc),0.85); }
  .ss2-acc-corner { position: relative; }
  .ss2-acc-corner::before { content:""; position:absolute; top:0; right:0; width:42px; height:42px; background: rgba(var(--ss-acc),0.85); clip-path: polygon(100% 0, 100% 100%, 0 0); }
  .ss2-acc-underline .ss2-card-t, .ss2-acc-underline .ss2-step-t { box-shadow: 0 2px 0 0 rgba(var(--ss-acc),0.85); display: inline-block; padding-bottom: 2px; }
  .ss2-acc-dot .ss2-card-t::before, .ss2-acc-dot .ss2-step-t::before { content:""; display:inline-block; width:8px; height:8px; border-radius:50%; background: rgba(var(--ss-acc),1); margin-inline-end: 10px; vertical-align: middle; }
  .ss2-acc-bar { border-inline-start: 3px solid rgba(var(--ss-acc),0.85); padding-inline-start: 14px; }
  .ss2-acc-num .ss2-card-n, .ss2-acc-num .ss2-step-n { color: rgba(var(--ss-acc),1) !important; }

  /* Typography */
  .ss2-label { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(var(--ss-acc),0.85); margin-bottom: 24px; display: inline-block; font-weight: 700; }
  .ss2-title { font-family: 'Playfair Display', serif; font-weight: 500; font-size: clamp(34px, 5vw, 64px); line-height: 1.1; letter-spacing: -0.015em; margin-bottom: 22px; overflow-wrap: anywhere; }
  .ss2-cover .ss2-title { font-size: clamp(46px, 7.5vw, 108px); }
  .ss2-sub { font-size: clamp(15px, 1.4vw, 18px); line-height: 1.75; opacity: 0.78; max-width: 660px; margin-bottom: 20px; }
  .ss2-cover .ss2-sub { margin: 0 auto 20px; }
  .ss2-body { font-size: clamp(15px, 1.3vw, 17.5px); line-height: 1.85; opacity: 0.78; max-width: 760px; margin-bottom: 18px; }

  /* Quote / big */
  .ss2-quote { font-family: 'Playfair Display', serif; font-style: italic; font-weight: 500; font-size: clamp(26px, 3.6vw, 52px); line-height: 1.25; letter-spacing: -0.015em; max-width: 960px; margin: 0 auto; text-align: center; }
  .ss2-attr { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.7; margin-top: 28px; text-align: center; display: block; }
  .ss2-big { font-family: 'Playfair Display', serif; font-weight: 500; font-size: clamp(100px, 17vw, 260px); line-height: 0.92; letter-spacing: -0.04em; color: rgba(var(--ss-acc),0.9); text-align: center; }

  /* Stats */
  .ss2-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 32px; }
  .ss2-stat { padding: 26px 22px; border-radius: 6px; text-align: center; }
  .ss2-stat-v { font-family: 'Playfair Display', serif; font-weight: 500; font-size: clamp(34px, 4vw, 56px); color: rgba(var(--ss-acc),1); line-height: 1; }
  .ss2-stat-l { margin-top: 10px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.65; }

  /* Grids */
  .ss2-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; margin-top: 32px; }
  .ss2-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; margin-top: 32px; }
  .ss2-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-top: 32px; }
  .ss2-bento  { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(130px, auto); gap: 14px; margin-top: 32px; }
  .ss2-bento > *:nth-child(1) { grid-column: span 4; grid-row: span 2; }
  .ss2-bento > *:nth-child(2) { grid-column: span 2; }
  .ss2-bento > *:nth-child(3) { grid-column: span 2; }
  .ss2-bento > *:nth-child(4) { grid-column: span 3; }
  .ss2-bento > *:nth-child(5) { grid-column: span 3; }
  .ss2-bento > *:nth-child(6) { grid-column: span 2; }
  .ss2-masonry { columns: 3 240px; column-gap: 16px; margin-top: 32px; }
  .ss2-masonry > * { break-inside: avoid; margin-bottom: 16px; display: block; }

  .ss2-card { padding: 26px 24px; border-radius: 6px; }
  .ss2-card-n { font-size: 10px; letter-spacing: 0.2em; opacity: 0.5; margin-bottom: 12px; font-weight: 700; }
  .ss2-card-t { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 18px; margin-bottom: 10px; line-height: 1.25; }
  .ss2-card-d { font-size: 13.5px; line-height: 1.7; opacity: 0.72; }

  /* Steps */
  .ss2-steps { display: flex; flex-direction: column; margin-top: 32px; }
  .ss2-step  { display: grid; grid-template-columns: 60px 1fr; gap: 24px; padding: 22px 0; border-bottom: 1px solid rgba(0,0,0,0.12); align-items: start; }
  .ss2-step:first-child { border-top: 1px solid rgba(0,0,0,0.12); }
  .ss2-step-n { font-family: 'Playfair Display', serif; font-style: italic; font-size: 30px; color: rgba(var(--ss-acc),0.7); line-height: 1; }
  .ss2-step-t { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 19px; margin-bottom: 6px; }
  .ss2-step-d { font-size: 13.5px; line-height: 1.7; opacity: 0.72; }

  /* Manifesto */
  .ss2-mani { margin-top: 32px; }
  .ss2-mani-row { display: grid; grid-template-columns: 120px 1fr; gap: 28px; padding: 22px 0; border-bottom: 1px dashed rgba(0,0,0,0.18); }
  .ss2-mani-k { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--ss-acc),0.85); font-weight: 700; }
  .ss2-mani-t { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 20px; margin-bottom: 6px; }
  .ss2-mani-d { font-size: 13.5px; line-height: 1.7; opacity: 0.72; }

  /* Pills */
  .ss2-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
  .ss2-pill  { padding: 12px 22px; border: 1.5px solid rgba(var(--ss-acc),0.7); font-size: 12.5px; font-weight: 600; letter-spacing: 0.05em; background: rgba(255,255,255,0.45); border-radius: 999px; }
  .ss2-pill-sq { border-radius: 0; }

  /* Split / editorial */
  .ss2-split { display: grid; grid-template-columns: 1fr 1.15fr; gap: clamp(28px, 4vw, 68px); align-items: start; }
  .ss2-split-rev { grid-template-columns: 1.15fr 1fr; }
  .ss2-edit-list { border-top: 1px solid rgba(0,0,0,0.14); }
  .ss2-edit-item { padding: 22px 0; border-bottom: 1px solid rgba(0,0,0,0.14); }
  .ss2-edit-k { font-weight: 800; font-size: 11px; letter-spacing: 0.18em; color: rgba(var(--ss-acc),0.85); margin-bottom: 8px; }
  .ss2-edit-t { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 19px; margin-bottom: 6px; }
  .ss2-edit-d { font-size: 13.5px; line-height: 1.7; opacity: 0.72; }

  /* Callouts */
  .ss2-call { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 32px; }
  .ss2-call-box { padding: 24px; border-radius: 6px; }

  /* Timeline */
  .ss2-tl { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 20px; margin-top: 36px; position: relative; }
  .ss2-tl::before { content:""; position:absolute; left:8px; right:8px; top: 16px; height: 1px; background: rgba(0,0,0,0.18); }
  .ss2-tl-item { position: relative; padding-top: 36px; }
  .ss2-tl-item::before { content:""; position:absolute; left: 0; top: 11px; width: 12px; height: 12px; background: rgba(var(--ss-acc),1); border-radius: 50%; border: 2px solid currentColor; }
  .ss2-tl-k { font-weight: 800; font-size: 11px; letter-spacing: 0.16em; color: rgba(var(--ss-acc),0.9); margin-bottom: 8px; }
  .ss2-tl-t { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 16px; margin-bottom: 6px; }
  .ss2-tl-d { font-size: 12.5px; line-height: 1.65; opacity: 0.7; }

  /* Compare */
  .ss2-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 32px; }
  .ss2-compare > div { padding: 30px 26px; border-radius: 6px; }
  .ss2-compare h3 { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 500; color: rgba(var(--ss-acc),0.95); margin-bottom: 14px; }
  .ss2-compare p { font-size: 13.5px; line-height: 1.7; opacity: 0.75; padding: 8px 0; border-top: 1px solid rgba(0,0,0,0.1); }

  /* Images */
  .ss2-img { display: block; width: 100%; max-width: 920px; max-height: 380px; object-fit: cover; border-radius: 8px; margin: 24px 0; box-shadow: 0 22px 60px -28px rgba(0,0,0,0.45); }
  .ss2-img-wide { max-width: 100%; max-height: 460px; }
  .ss2-cover-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.22; z-index: 1; pointer-events: none; mix-blend-mode: multiply; }

  /* RTL */
  [dir="rtl"] .ss2-body, [dir="rtl"] .ss2-card-d, [dir="rtl"] .ss2-step-d, [dir="rtl"] .ss2-mani-d, [dir="rtl"] .ss2-edit-d, [dir="rtl"] .ss2-tl-d, [dir="rtl"] .ss2-sub { text-align: right; }
  [dir="rtl"] .ss2-step, [dir="rtl"] .ss2-mani-row { direction: rtl; }
  [dir="rtl"] .ss2-acc-corner::before { left: 0; right: auto; clip-path: polygon(0 0, 0 100%, 100% 0); }

  /* Responsive */
  @media (max-width: 1024px) {
    .ss2-grid-4, .ss2-grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .ss2-bento  { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .ss2-bento > * { grid-column: span 1 !important; grid-row: span 1 !important; }
    .ss2-split, .ss2-split-rev { grid-template-columns: 1fr; gap: 32px; }
    .ss2-masonry { columns: 2 200px; }
    .ss2-compare { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .ss2-slide { padding: 56px 22px !important; min-height: auto; }
    .ss2-cover { min-height: 80vh; }
    .ss2-title { font-size: clamp(28px, 8vw, 40px) !important; }
    .ss2-cover .ss2-title { font-size: clamp(36px, 10vw, 52px) !important; }
    .ss2-big { font-size: clamp(72px, 24vw, 110px) !important; }
    .ss2-quote { font-size: clamp(20px, 6vw, 28px) !important; }
    .ss2-grid-2, .ss2-grid-3, .ss2-grid-4 { grid-template-columns: 1fr; }
    .ss2-bento { grid-template-columns: 1fr; }
    .ss2-masonry { columns: 1; }
    .ss2-stats { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .ss2-stat { padding: 20px 14px; }
    .ss2-stat-v { font-size: clamp(28px, 9vw, 40px) !important; }
    .ss2-step { grid-template-columns: 44px 1fr; gap: 14px; padding: 18px 0; }
    .ss2-mani-row { grid-template-columns: 80px 1fr; gap: 14px; padding: 18px 0; }
    .ss2-tl { grid-template-columns: 1fr; }
    .ss2-tl::before { display: none; }
    .ss2-call { grid-template-columns: 1fr; }
    .ss2-img { max-height: 240px; margin: 18px 0; }
  }
`;

const TEMPLATE_3D_IMPORT_MAP = `<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.webgpu.js",
    "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.webgpu.js",
    "three/tsl": "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.tsl.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/",
    "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/",
    "stats-gl": "https://cdn.jsdelivr.net/npm/stats-gl@4.1.0/+esm"
  }
}
</script>`;

const TEMPLATE_SAFETY_SCRIPT = `<script>
(function () {
  function revealTemplateText() {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('revealed');
    });
  }
  function keepProgressAlive() {
    var bar = document.getElementById('progressBar');
    if (!bar) return;
    var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bar.style.width = Math.min(100, Math.max(0, (scrollY / max) * 100)) + '%';
  }
  revealTemplateText();
  keepProgressAlive();
  addEventListener('DOMContentLoaded', revealTemplateText, { once: true });
  addEventListener('load', revealTemplateText, { once: true });
  addEventListener('scroll', keepProgressAlive, { passive: true });
  setTimeout(revealTemplateText, 250);
  setTimeout(revealTemplateText, 1200);
})();
</script>`;

// Map the AI's 40-layout vocabulary onto our internal renderer types.
// Each alias resolves to an existing handler — many AI layouts share a base renderer
// but get unique visuals via `variant` (8 surface styles) + `accent` (6 decorations).
// Effective combinations: ~40 layouts × 8 variants × 6 accents ≈ 1900 distinct designs.
const LAYOUT_ALIASES: Record<string, string> = {
  // text+image
  "image-bottom": "image-top", "image-side-card": "split-right",
  "focus-image": "centered", "magazine-cover": "image-full",
  "diagonal-split": "image-full", "polaroid": "image-top",
  // text-only
  "centered-narrow": "centered", "left-aligned-hero": "centered",
  "right-aligned-hero": "centered", "definition": "callout",
  "manifesto": "callout", "poster-typo": "callout", "pull-quote": "callout",
  // grid/columns
  "four-col": "three-col", "bento": "three-col", "masonry-cards": "gallery",
  "pillars": "three-col", "icon-grid": "three-col", "ribbon-cards": "three-col",
  // compare
  "before-after": "comparison", "vs-split": "comparison", "table-compare": "comparison",
  // data
  "stat-cluster": "big-number", "stat-circles": "stats", "kpi-strip": "stats",
  // narrative
  "numbered-list": "process", "step-vertical": "process",
  "timeline-horizontal": "timeline", "story-rows": "timeline",
  // media
  "image-grid-2": "gallery", "image-grid-4": "gallery", "carousel-strip": "gallery",
};

function normalizeLayout(l?: string): string {
  if (!l) return "";
  const k = l.toLowerCase().trim();
  return LAYOUT_ALIASES[k] || k;
}

const VARIANTS = new Set(["glass","outline","filled","gradient","neon","paper","mono"]);
const ACCENTS = new Set(["top","left","corner","underline","side-bar"]);

function injectClasses(html: string, slide: SlideData): string {
  const v = (slide.variant || "").toLowerCase();
  const a = (slide.accent || "").toLowerCase();
  const vCls = VARIANTS.has(v) ? ` lov-v-${v}` : "";
  const aCls = ACCENTS.has(a) ? ` lov-a-${a}` : "";
  // Carry the original layout name onto the section as a data attribute so CSS
  // can target specific micro-variations (e.g. magazine-cover vs image-full).
  const orig = (slide.layout || "").toLowerCase().trim();
  const dataLayout = orig ? ` data-layout="${orig}"` : "";
  if (!vCls && !aCls && !dataLayout) return html;
  return html.replace(/class="lov-section([^"]*)"/, (m, rest) => `class="lov-section${rest}${vCls}${aCls}"${dataLayout}`);
}

function slideHtml(slide: SlideData, idx: number, palette: SlideDeck["palette"], total: number): string {
  // Alias normalization — let the AI pick any of 40 layout names; we map to base renderers.
  if (slide.layout) slide = { ...slide, layout: normalizeLayout(slide.layout) };
  return injectClasses(_slideHtmlBase(slide, idx, palette, total), slide);
}

/** Inline-SVG chart renderer — bar / line / donut. No JS runtime needed. */
function chartSlideHtml(
  slide: SlideData,
  idx: number,
  palette: SlideDeck["palette"],
  total: number,
  kicker: string,
  idxLabel: string,
): string {
  const kind = slide.chart?.kind || "bar";
  const data = (slide.chart?.data || []).slice(0, 10);
  const W = 1200, H = 520, PAD = 80;
  const max = Math.max(1, ...data.map(d => Number(d.value) || 0));
  let svgInner = "";

  if (kind === "donut") {
    const cx = W / 2, cy = H / 2, R = 180, r = 110;
    const totalVal = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
    let acc = 0;
    const arcs = data.map((d, i) => {
      const v = Number(d.value) || 0;
      const a0 = (acc / totalVal) * Math.PI * 2 - Math.PI / 2;
      acc += v;
      const a1 = (acc / totalVal) * Math.PI * 2 - Math.PI / 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
      const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      const ix0 = cx + r * Math.cos(a1), iy0 = cy + r * Math.sin(a1);
      const ix1 = cx + r * Math.cos(a0), iy1 = cy + r * Math.sin(a0);
      const op = 0.55 + (0.45 * (i % 3) / 2);
      return `<path d="M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${ix0} ${iy0} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z" fill="var(--lov-accent)" fill-opacity="${op}" />`;
    }).join("");
    const legend = data.map((d, i) => `<div style="display:flex;align-items:center;gap:.6rem;margin:.35rem 0;"><span style="width:14px;height:14px;border-radius:3px;background:var(--lov-accent);opacity:${0.55 + (0.45 * (i % 3) / 2)}"></span><span class="lov-body" style="font-size:1.05rem;">${esc(d.label)} — <strong>${esc(String(d.value))}</strong></span></div>`).join("");
    svgInner = `<g>${arcs}</g>`;
    return `
<section class="lov-section lov-chart-section" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    <div style="display:grid;grid-template-columns: 1.2fr .8fr;gap:3rem;align-items:center;margin-top:2rem;">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:520px;">${svgInner}</svg>
      <div>${legend}</div>
    </div>
    ${slide.body ? `<p class="lov-body" style="margin-top:1.5rem;opacity:.85">${esc(slide.body)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  if (kind === "line") {
    const step = (W - PAD * 2) / Math.max(1, data.length - 1);
    const pts = data.map((d, i) => {
      const x = PAD + step * i;
      const y = H - PAD - ((Number(d.value) || 0) / max) * (H - PAD * 2);
      return `${x},${y}`;
    }).join(" ");
    const dots = data.map((d, i) => {
      const x = PAD + step * i;
      const y = H - PAD - ((Number(d.value) || 0) / max) * (H - PAD * 2);
      return `<circle cx="${x}" cy="${y}" r="6" fill="var(--lov-accent)" /><text x="${x}" y="${H - PAD + 28}" text-anchor="middle" font-size="18" fill="var(--lov-fg)" opacity=".7">${esc(d.label)}</text>`;
    }).join("");
    svgInner = `
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--lov-fg)" stroke-opacity=".25" />
      <polyline points="${pts}" fill="none" stroke="var(--lov-accent)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />
      ${dots}`;
  } else {
    // bar
    const bw = (W - PAD * 2) / Math.max(1, data.length) * 0.7;
    const gap = (W - PAD * 2) / Math.max(1, data.length) * 0.3;
    const bars = data.map((d, i) => {
      const x = PAD + i * (bw + gap) + gap / 2;
      const h = ((Number(d.value) || 0) / max) * (H - PAD * 2);
      const y = H - PAD - h;
      return `
        <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="var(--lov-accent)" />
        <text x="${x + bw / 2}" y="${y - 12}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--lov-fg)">${esc(String(d.value))}</text>
        <text x="${x + bw / 2}" y="${H - PAD + 28}" text-anchor="middle" font-size="18" fill="var(--lov-fg)" opacity=".7">${esc(d.label)}</text>`;
    }).join("");
    svgInner = `<line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--lov-fg)" stroke-opacity=".25" />${bars}`;
  }

  return `
<section class="lov-section lov-chart-section" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:560px;margin-top:1.6rem;">${svgInner}</svg>
    ${slide.body ? `<p class="lov-body" style="margin-top:1.5rem;opacity:.85">${esc(slide.body)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
}

function _slideHtmlBase(slide: SlideData, idx: number, palette: SlideDeck["palette"], total: number): string {
  const kicker = slide.kicker ? `<div class="lov-kicker">${esc(slide.kicker)}</div>` : "";
  const idxLabel = `<div class="lov-index">${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>`;
  const img = slide.image ? imgWithFallback(slide.image) : "";

  if (slide.type === "cover") {
    return `
<section class="lov-section lov-cover" data-slide="${idx}">
  ${slide.image ? `<img class="lov-cover-bg" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'" />` : ""}
  <div class="lov-cover-veil"></div>
  <div class="lov-content lov-content-center">
    ${kicker}
    <h1 class="lov-h1">${esc(slide.title)}</h1>
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  if (slide.type === "quote") {
    return `
<section class="lov-section lov-quote-section" data-slide="${idx}">
  <div class="lov-content lov-content-center">
    <div class="lov-quote-mark">"</div>
    <blockquote class="lov-quote">${esc(slide.quote)}</blockquote>
    ${slide.attribution ? `<cite class="lov-cite">— ${esc(slide.attribution)}</cite>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  if (slide.type === "stats" && slide.stats?.length) {
    const items = slide.stats.map((s) => `
      <div class="lov-stat">
        <div class="lov-stat-value">${esc(s.value)}</div>
        <div class="lov-stat-label">${esc(s.label)}</div>
      </div>`).join("");
    return `
<section class="lov-section lov-stats-section" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    <div class="lov-stats-grid">${items}</div>
  </div>
  ${idxLabel}
</section>`;
  }

  if ((slide.type === "chart" || (slide.layout || "").startsWith("chart")) && slide.chart?.data?.length) {
    return chartSlideHtml(slide, idx, palette, total, kicker, idxLabel);
  }

  if (slide.type === "closing") {
    return `
<section class="lov-section lov-closing" data-slide="${idx}">
  <div class="lov-content lov-content-center">
    ${kicker}
    <h1 class="lov-h1">${esc(slide.title)}</h1>
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
    ${slide.body ? `<p class="lov-body">${esc(slide.body)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  // ── Custom layouts for content slides ─────────────────────────────
  const layout = (slide.layout || "").toLowerCase();
  const bulletsList = (arr?: string[]) =>
    arr?.length ? `<ul class="lov-bullets">${arr.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
  const bullets = bulletsList(slide.bullets);

  if (layout === "big-number") {
    return `
<section class="lov-section lov-bignum" data-slide="${idx}">
  <div class="lov-content lov-content-center">
    ${kicker}
    <div class="lov-bignum-value">${esc(slide.big_value || slide.title || "")}</div>
    ${slide.big_label ? `<div class="lov-bignum-label">${esc(slide.big_label)}</div>` : ""}
    ${slide.body ? `<p class="lov-body" style="max-width:900px;text-align:center;margin:2rem auto 0">${esc(slide.body)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "callout") {
    return `
<section class="lov-section lov-callout" data-slide="${idx}">
  <div class="lov-content lov-content-center">
    ${kicker}
    <h2 class="lov-callout-text">${esc(slide.title || "")}</h2>
    ${slide.subtitle ? `<p class="lov-subtitle" style="text-align:center">${esc(slide.subtitle)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "comparison") {
    const lb = bulletsList(slide.left_bullets);
    const rb = bulletsList(slide.right_bullets);
    return `
<section class="lov-section lov-compare" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    <div class="lov-compare-grid">
      <div class="lov-compare-col">
        ${slide.left_title ? `<h3 class="lov-compare-title">${esc(slide.left_title)}</h3>` : ""}
        ${lb}
      </div>
      <div class="lov-compare-divider"></div>
      <div class="lov-compare-col">
        ${slide.right_title ? `<h3 class="lov-compare-title" style="color:var(--lov-accent)">${esc(slide.right_title)}</h3>` : ""}
        ${rb}
      </div>
    </div>
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "process" && slide.steps?.length) {
    const steps = slide.steps.map((st, i) => `
      <div class="lov-step">
        <div class="lov-step-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="lov-step-body">
          <h4 class="lov-step-title">${esc(st.title)}</h4>
          ${st.desc ? `<p class="lov-step-desc">${esc(st.desc)}</p>` : ""}
        </div>
      </div>`).join("");
    return `
<section class="lov-section lov-process" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    <div class="lov-steps">${steps}</div>
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "timeline" && slide.events?.length) {
    const events = slide.events.map((ev) => `
      <div class="lov-event">
        <div class="lov-event-date">${esc(ev.date)}</div>
        <div class="lov-event-body">
          <h4 class="lov-event-title">${esc(ev.title)}</h4>
          ${ev.desc ? `<p class="lov-event-desc">${esc(ev.desc)}</p>` : ""}
        </div>
      </div>`).join("");
    return `
<section class="lov-section lov-timeline" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    <div class="lov-events">${events}</div>
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "gallery" && slide.images?.length) {
    const imgs = slide.images.slice(0, 4).map((u) => `<div class="lov-gal-item">${imgWithFallback(u, "lov-media")}</div>`).join("");
    return `
<section class="lov-section lov-gallery" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
    <div class="lov-gallery-grid lov-gal-${Math.min(slide.images.length, 4)}">${imgs}</div>
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "two-col") {
    const lb = bulletsList(slide.left_bullets) || `<p class="lov-body">${esc(slide.body || "")}</p>`;
    const rb = bulletsList(slide.right_bullets) || bullets;
    return `
<section class="lov-section lov-twocol" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
    <div class="lov-twocol-grid">
      <div>${lb}</div>
      <div>${rb}</div>
    </div>
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "three-col" && slide.bullets?.length) {
    const cards = slide.bullets.slice(0, 3).map((b, i) => `
      <div class="lov-tri-card">
        <div class="lov-tri-num">${String(i + 1).padStart(2, "0")}</div>
        <p class="lov-tri-text">${esc(b)}</p>
      </div>`).join("");
    return `
<section class="lov-section lov-three" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
    <div class="lov-three-grid">${cards}</div>
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "image-full" && slide.image) {
    return `
<section class="lov-section lov-imgfull" data-slide="${idx}">
  <img class="lov-imgfull-bg" src="${esc(slide.image)}" alt="" onerror="this.style.display='none'" />
  <div class="lov-imgfull-veil"></div>
  <div class="lov-content">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h1" style="font-size:clamp(48px,7vw,128px)">${esc(slide.title)}</h2>` : ""}
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
    ${slide.body ? `<p class="lov-body">${esc(slide.body)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "image-top" && slide.image) {
    return `
<section class="lov-section lov-imgtop" data-slide="${idx}">
  <div class="lov-content">
    ${kicker}
    <div class="lov-media lov-imgtop-media">${imgWithFallback(slide.image, "lov-media")}</div>
    ${slide.title ? `<h2 class="lov-h2" style="margin-top:2rem">${esc(slide.title)}</h2>` : ""}
    ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
    ${slide.body ? `<p class="lov-body">${esc(slide.body)}</p>` : ""}
    ${bullets}
  </div>
  ${idxLabel}
</section>`;
  }

  if (layout === "centered") {
    return `
<section class="lov-section lov-centered" data-slide="${idx}">
  <div class="lov-content lov-content-center">
    ${kicker}
    ${slide.title ? `<h2 class="lov-h2" style="text-align:center">${esc(slide.title)}</h2>` : ""}
    ${slide.subtitle ? `<p class="lov-subtitle" style="text-align:center">${esc(slide.subtitle)}</p>` : ""}
    ${slide.body ? `<p class="lov-body" style="text-align:center;margin-left:auto;margin-right:auto">${esc(slide.body)}</p>` : ""}
  </div>
  ${idxLabel}
</section>`;
  }

  // split-left / split-right (and default)
  const flipImage = layout === "split-left";
  const gridStyle = flipImage ? "grid-template-columns: 1fr 1.2fr;" : "";
  const textOrder = flipImage ? "order:2;" : "";
  const imgOrder = flipImage ? "order:1;" : "";
  return `
<section class="lov-section lov-content-slide" data-slide="${idx}">
  <div class="lov-grid" style="${gridStyle}">
    <div class="lov-text" style="${textOrder}">
      ${kicker}
      ${slide.title ? `<h2 class="lov-h2">${esc(slide.title)}</h2>` : ""}
      ${slide.subtitle ? `<p class="lov-subtitle">${esc(slide.subtitle)}</p>` : ""}
      ${slide.body ? `<p class="lov-body">${esc(slide.body)}</p>` : ""}
      ${bullets}
    </div>
    ${img ? `<div style="${imgOrder}">${img}</div>` : ""}
  </div>
  ${idxLabel}
</section>`;
}

/* ------------------------------------------------------------------ */
/* Build full document                                                 */
/* ------------------------------------------------------------------ */

const SLIDE_BASE_CSS = (p: SlideDeck["palette"]) => `
  :root {
    --lov-bg: ${p.bg};
    --lov-fg: ${p.fg};
    --lov-primary: ${p.primary};
    --lov-accent: ${p.accent};
  }
  /* Reset chrome */
  nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"],
  .nav, .navbar, .header, .footer, .menu, .topbar, .navigation,
  [class*="navigation"], [class*="navbar"], [class*="topbar"],
  [id*="nav-"], [id*="header-"], [id*="footer-"] { display: none !important; }
  button, [role="button"], .btn, .button, .cta, [class*="cta-"], [class*="-cta"],
  a[href^="#contact"], a[href^="mailto:"], form, .social, [class*="social-"] { display: none !important; }
  *[style*="position: fixed"][style*="top: 0"],
  *[style*="position:fixed"][style*="top:0"] { display: none !important; }

  html, body {
    background: var(--lov-bg) !important; color: var(--lov-fg) !important;
    margin: 0 !important; padding: 0 !important;
    width: 100% !important; min-height: 100% !important; height: auto !important;
    overflow-x: hidden !important; overflow-y: auto !important;
    -webkit-overflow-scrolling: touch; touch-action: pan-y;
  }
  body { font-size: 18px; position: static !important; }

  /* Background canvas — let the template's three.js / animated bg keep running */
  body > canvas, body > #bg, body > .bg, body > .background, body > [class*="canvas"] {
    position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
    z-index: 0 !important; pointer-events: none !important;
  }

  /* ── Lov slide content ─────────────────────────────────────────── */
  .lov-deck { position: relative; z-index: 1; min-height: 100vh; height: auto !important; overflow: visible !important; }
  .lov-section {
    position: relative; min-height: 100vh; padding: 9vh 6vw;
    display: flex; align-items: center; justify-content: center;
    border-bottom: 1px solid color-mix(in oklab, var(--lov-fg) 8%, transparent);
  }
  .lov-content { width: 100%; max-width: 1680px; position: relative; z-index: 2; }
  .lov-content-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1.2rem; }
  .lov-kicker {
    font-size: clamp(13px, 1vw, 18px); letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--lov-accent); font-weight: 700; margin-bottom: 1.2rem;
  }
  .lov-h1 {
    font-size: clamp(64px, 9vw, 168px); line-height: 0.95; letter-spacing: -0.02em;
    font-weight: 800; margin: 0; color: var(--lov-fg);
  }
  .lov-h2 {
    font-size: clamp(44px, 6.2vw, 112px); line-height: 1.0; letter-spacing: -0.01em;
    font-weight: 800; margin: 0 0 1.5rem; color: var(--lov-fg);
  }
  .lov-subtitle {
    font-size: clamp(22px, 2.2vw, 36px); line-height: 1.4; opacity: 0.85; margin: 0.5rem 0 0; max-width: 1100px;
  }
  .lov-body {
    font-size: clamp(20px, 1.6vw, 28px); line-height: 1.55; margin: 1.5rem 0; max-width: 980px; opacity: 0.92;
  }
  .lov-bullets {
    list-style: none; padding: 0; margin: 1.5rem 0; display: grid; gap: 1rem;
  }
  .lov-bullets li {
    font-size: clamp(20px, 1.6vw, 28px); line-height: 1.5; padding-inline-start: 1.6rem; position: relative;
  }
  .lov-bullets li::before {
    content: ""; position: absolute; inset-inline-start: 0; top: 0.7em; width: 0.7rem; height: 0.7rem;
    background: var(--lov-accent); border-radius: 999px;
  }
  .lov-grid {
    display: grid; grid-template-columns: 1.2fr 1fr; gap: 4vw; align-items: center; width: 100%; max-width: 1680px;
  }
  @media (max-width: 900px) { .lov-grid { grid-template-columns: 1fr; } }
  .lov-text { min-width: 0; }
  .lov-media { position: relative; aspect-ratio: 4/3; border-radius: 24px; overflow: hidden;
    box-shadow: 0 30px 80px -20px rgba(0,0,0,0.55);
  }
  .lov-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

  /* Cover */
  .lov-cover { min-height: 100vh; }
  .lov-cover-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.42; z-index: 0; }
  .lov-cover-veil {
    position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(180deg, transparent, color-mix(in oklab, var(--lov-bg) 75%, transparent));
  }

  /* Quote */
  .lov-quote-mark {
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(120px, 16vw, 280px); line-height: 0.6; color: var(--lov-accent);
    margin-bottom: -1rem;
  }
  .lov-quote {
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(36px, 4.2vw, 84px); line-height: 1.18; font-weight: 500; max-width: 1400px; margin: 0;
  }
  .lov-cite {
    margin-top: 1.6rem; font-size: clamp(18px, 1.4vw, 26px); letter-spacing: 0.18em;
    text-transform: uppercase; opacity: 0.7; font-style: normal;
  }

  /* Stats */
  .lov-stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2.4rem; margin-top: 2.5rem;
  }
  .lov-stat { text-align: start; }
  .lov-stat-value {
    font-size: clamp(56px, 8vw, 144px); line-height: 0.95; font-weight: 800;
    color: var(--lov-accent); letter-spacing: -0.02em;
  }
  .lov-stat-label {
    margin-top: 0.6rem; font-size: clamp(15px, 1.1vw, 20px); letter-spacing: 0.18em;
    text-transform: uppercase; opacity: 0.75;
  }

  /* Index */
  .lov-index {
    position: absolute; bottom: 4vh; inset-inline-end: 4vw;
    font-size: clamp(13px, 0.9vw, 16px); letter-spacing: 0.32em; opacity: 0.55; z-index: 3;
  }

  /* ── Star fallback for missing/broken images ──────────────────── */
  .lov-media-empty {
    background: linear-gradient(135deg, color-mix(in oklab, var(--lov-primary) 18%, var(--lov-bg)),
      color-mix(in oklab, var(--lov-accent) 12%, var(--lov-bg)));
    display: flex; align-items: center; justify-content: center;
  }
  .lov-star {
    color: var(--lov-accent); width: 22%; aspect-ratio: 1; display: block;
    filter: drop-shadow(0 8px 24px color-mix(in oklab, var(--lov-accent) 35%, transparent));
    animation: lovSpin 14s linear infinite;
  }
  .lov-star-svg { width: 100%; height: 100%; }
  @keyframes lovSpin { to { transform: rotate(360deg); } }

  /* ── Scroll-in animations on every section ───────────────────── */
  .lov-deck .lov-section > * { will-change: transform, opacity; }
  .lov-section .lov-content,
  .lov-section .lov-grid,
  .lov-section .lov-stats-grid,
  .lov-section .lov-quote,
  .lov-section .lov-cite,
  .lov-section .lov-quote-mark,
  .lov-section .lov-media {
    opacity: 0; transform: translateY(48px);
    transition: opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1);
  }
  .lov-section.lov-in .lov-content,
  .lov-section.lov-in .lov-grid,
  .lov-section.lov-in .lov-stats-grid,
  .lov-section.lov-in .lov-quote,
  .lov-section.lov-in .lov-cite,
  .lov-section.lov-in .lov-quote-mark,
  .lov-section.lov-in .lov-media { opacity: 1; transform: none; }
  /* Stagger headline → body → list/bullets */
  .lov-section.lov-in .lov-kicker { animation: lovUp 0.7s 0.05s cubic-bezier(0.22,1,0.36,1) backwards; }
  .lov-section.lov-in .lov-h1,
  .lov-section.lov-in .lov-h2 { animation: lovUp 0.9s 0.15s cubic-bezier(0.22,1,0.36,1) backwards; }
  .lov-section.lov-in .lov-subtitle { animation: lovUp 0.9s 0.28s cubic-bezier(0.22,1,0.36,1) backwards; }
  .lov-section.lov-in .lov-body { animation: lovUp 0.9s 0.4s cubic-bezier(0.22,1,0.36,1) backwards; }
  .lov-section.lov-in .lov-bullets li {
    animation: lovUp 0.7s cubic-bezier(0.22,1,0.36,1) backwards;
  }
  .lov-section.lov-in .lov-bullets li:nth-child(1) { animation-delay: 0.45s; }
  .lov-section.lov-in .lov-bullets li:nth-child(2) { animation-delay: 0.55s; }
  .lov-section.lov-in .lov-bullets li:nth-child(3) { animation-delay: 0.65s; }
  .lov-section.lov-in .lov-bullets li:nth-child(4) { animation-delay: 0.75s; }
  .lov-section.lov-in .lov-bullets li:nth-child(5) { animation-delay: 0.85s; }
  .lov-section.lov-in .lov-bullets li:nth-child(n+6) { animation-delay: 0.95s; }
  .lov-section.lov-in .lov-stat { animation: lovUp 0.7s cubic-bezier(0.22,1,0.36,1) backwards; }
  .lov-section.lov-in .lov-stat:nth-child(1) { animation-delay: 0.25s; }
  .lov-section.lov-in .lov-stat:nth-child(2) { animation-delay: 0.4s; }
  .lov-section.lov-in .lov-stat:nth-child(3) { animation-delay: 0.55s; }
  .lov-section.lov-in .lov-stat:nth-child(4) { animation-delay: 0.7s; }
  @keyframes lovUp {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lov-section .lov-content, .lov-section .lov-grid, .lov-section .lov-stats-grid,
    .lov-section .lov-media, .lov-section .lov-quote, .lov-section .lov-cite,
    .lov-section .lov-quote-mark { opacity: 1 !important; transform: none !important; transition: none !important; }
    .lov-section.lov-in * { animation: none !important; }
  }

  /* RTL */
  [dir="rtl"] .lov-grid { grid-template-columns: 1fr 1.2fr; }
  [dir="rtl"] .lov-bullets li { padding-inline-start: 1.6rem; }

  /* ── Mobile design (custom) ───────────────────────────────────── */
  @media (max-width: 768px) {
    body { font-size: 16px; }
    .lov-section { min-height: auto; padding: 64px 22px; }
    .lov-content { gap: 0.8rem; }
    .lov-h1 { font-size: clamp(40px, 11vw, 64px) !important; line-height: 1.0; }
    .lov-h2 { font-size: clamp(32px, 8.5vw, 52px) !important; line-height: 1.05; margin-bottom: 1rem; }
    .lov-subtitle { font-size: clamp(17px, 4.5vw, 22px) !important; }
    .lov-body { font-size: clamp(15px, 4vw, 18px) !important; line-height: 1.6; margin: 1rem 0; }
    .lov-bullets { gap: 0.6rem; margin: 1rem 0; }
    .lov-bullets li { font-size: clamp(15px, 4vw, 18px) !important; padding-inline-start: 1.2rem; }
    .lov-bullets li::before { width: 0.5rem; height: 0.5rem; top: 0.55em; }
    .lov-grid { grid-template-columns: 1fr !important; gap: 1.5rem; }
    .lov-media { aspect-ratio: 16/10; border-radius: 16px; }
    .lov-quote { font-size: clamp(24px, 6.5vw, 34px) !important; line-height: 1.25; }
    .lov-quote-mark { font-size: clamp(80px, 22vw, 120px) !important; }
    .lov-cite { font-size: 13px !important; }
    .lov-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 1.4rem; margin-top: 1.5rem; }
    .lov-stat-value { font-size: clamp(36px, 12vw, 56px) !important; }
    .lov-stat-label { font-size: 11px !important; letter-spacing: 0.14em; }
    .lov-kicker { font-size: 11px !important; letter-spacing: 0.22em; margin-bottom: 0.6rem; }
    .lov-index { bottom: 16px; inset-inline-end: 18px; font-size: 11px !important; letter-spacing: 0.22em; }
    .lov-cover-bg { opacity: 0.32; }
  }
  @media (max-width: 480px) {
    .lov-section { padding: 56px 18px; }
    .lov-stats-grid { grid-template-columns: 1fr; }
  }

  /* ── New custom layouts ───────────────────────────────────────── */
  .lov-bignum-value {
    font-size: clamp(120px, 22vw, 360px); line-height: 0.85; font-weight: 900;
    color: var(--lov-accent); letter-spacing: -0.04em; margin: 0;
    background: linear-gradient(135deg, var(--lov-accent), color-mix(in oklab, var(--lov-primary) 70%, var(--lov-accent)));
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }
  .lov-bignum-label {
    margin-top: 1rem; font-size: clamp(20px, 2vw, 32px); letter-spacing: 0.16em;
    text-transform: uppercase; opacity: 0.78; font-weight: 600;
  }
  @media (max-width: 768px) {
    .lov-bignum-value { font-size: clamp(80px, 32vw, 160px) !important; }
    .lov-bignum-label { font-size: 14px !important; letter-spacing: 0.12em; }
  }

  .lov-callout { background: linear-gradient(135deg, color-mix(in oklab, var(--lov-primary) 14%, var(--lov-bg)), var(--lov-bg)); }
  .lov-callout-text {
    font-size: clamp(40px, 6vw, 96px); line-height: 1.1; font-weight: 800;
    max-width: 1400px; margin: 0 auto; text-align: center;
    background: linear-gradient(135deg, var(--lov-fg), var(--lov-accent));
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }
  @media (max-width: 768px) { .lov-callout-text { font-size: clamp(28px, 7.5vw, 44px) !important; } }

  .lov-compare-grid { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 3vw; margin-top: 2rem; align-items: start; }
  .lov-compare-divider { background: linear-gradient(180deg, transparent, var(--lov-accent), transparent); width: 1px; min-height: 60vh; }
  .lov-compare-title { font-size: clamp(22px, 2.4vw, 36px); font-weight: 700; margin: 0 0 1.5rem; letter-spacing: -0.01em; }
  @media (max-width: 768px) {
    .lov-compare-grid { grid-template-columns: 1fr; gap: 1.5rem; }
    .lov-compare-divider { width: 100%; min-height: 1px; height: 1px; background: linear-gradient(90deg, transparent, var(--lov-accent), transparent); }
  }

  .lov-steps { display: grid; gap: 1.4rem; margin-top: 2.2rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .lov-step {
    background: color-mix(in oklab, var(--lov-fg) 5%, transparent);
    border: 1px solid color-mix(in oklab, var(--lov-fg) 10%, transparent);
    border-radius: 20px; padding: 1.8rem 1.6rem;
  }
  .lov-step-num { font-size: clamp(40px, 4vw, 64px); font-weight: 900; line-height: 1; color: var(--lov-accent); opacity: 0.85; margin-bottom: 0.8rem; }
  .lov-step-title { font-size: clamp(18px, 1.6vw, 24px); font-weight: 700; margin: 0 0 0.5rem; }
  .lov-step-desc { font-size: clamp(14px, 1.1vw, 17px); opacity: 0.82; margin: 0; line-height: 1.55; }

  .lov-events { margin-top: 2rem; display: grid; gap: 1.4rem; position: relative; }
  .lov-events::before { content: ""; position: absolute; inset-inline-start: 110px; top: 0.4rem; bottom: 0.4rem; width: 2px; background: color-mix(in oklab, var(--lov-accent) 40%, transparent); }
  .lov-event { display: grid; grid-template-columns: 110px 1fr; gap: 1.5rem; align-items: start; position: relative; }
  .lov-event::before { content: ""; position: absolute; inset-inline-start: 104px; top: 0.55rem; width: 14px; height: 14px; border-radius: 999px; background: var(--lov-accent); box-shadow: 0 0 0 4px color-mix(in oklab, var(--lov-accent) 25%, transparent); }
  .lov-event-date { font-size: clamp(14px, 1.1vw, 18px); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--lov-accent); padding-top: 0.2rem; }
  .lov-event-title { font-size: clamp(18px, 1.7vw, 26px); font-weight: 700; margin: 0 0 0.4rem; }
  .lov-event-desc { font-size: clamp(14px, 1.1vw, 17px); opacity: 0.85; margin: 0; line-height: 1.55; }
  @media (max-width: 640px) {
    .lov-events::before { inset-inline-start: 8px; }
    .lov-event { grid-template-columns: 1fr; gap: 0.4rem; padding-inline-start: 28px; }
    .lov-event::before { inset-inline-start: 2px; top: 0.3rem; }
  }

  .lov-gallery-grid { margin-top: 2rem; display: grid; gap: 1.2rem; }
  .lov-gal-2 { grid-template-columns: 1fr 1fr; }
  .lov-gal-3 { grid-template-columns: 2fr 1fr 1fr; grid-auto-rows: minmax(220px, 1fr); }
  .lov-gal-3 .lov-gal-item:first-child { grid-row: span 2; }
  .lov-gal-4 { grid-template-columns: repeat(2, 1fr); }
  .lov-gal-item .lov-media { aspect-ratio: auto; height: 100%; min-height: 220px; }
  @media (max-width: 768px) {
    .lov-gallery-grid { grid-template-columns: 1fr 1fr !important; gap: 0.6rem; }
    .lov-gal-3 .lov-gal-item:first-child { grid-row: auto; }
    .lov-gal-item .lov-media { min-height: 140px; aspect-ratio: 1; }
  }

  .lov-twocol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3vw; margin-top: 2rem; }
  @media (max-width: 768px) { .lov-twocol-grid { grid-template-columns: 1fr; gap: 1rem; } }

  .lov-three-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6rem; margin-top: 2rem; }
  .lov-tri-card {
    background: color-mix(in oklab, var(--lov-fg) 5%, transparent);
    border: 1px solid color-mix(in oklab, var(--lov-fg) 10%, transparent);
    border-radius: 24px; padding: 2.2rem 1.8rem;
  }
  .lov-tri-num { font-size: clamp(36px, 3.4vw, 56px); font-weight: 900; line-height: 1; color: var(--lov-accent); margin-bottom: 1rem; }
  .lov-tri-text { font-size: clamp(16px, 1.3vw, 22px); line-height: 1.5; margin: 0; opacity: 0.92; }
  @media (max-width: 900px) { .lov-three-grid { grid-template-columns: 1fr; } }

  .lov-imgfull { padding: 0; min-height: 100vh; }
  .lov-imgfull-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
  .lov-imgfull-veil { position: absolute; inset: 0; z-index: 1; background: linear-gradient(135deg, color-mix(in oklab, var(--lov-bg) 88%, transparent), color-mix(in oklab, var(--lov-bg) 40%, transparent)); }
  .lov-imgfull .lov-content { padding: 9vh 6vw; max-width: 1200px; }

  .lov-imgtop .lov-imgtop-media { aspect-ratio: 21/9; width: 100%; max-height: 60vh; }

  /* ── Surface variants — applied to all card-like children ─────── */
  .lov-v-glass .lov-step, .lov-v-glass .lov-tri-card {
    background: color-mix(in oklab, var(--lov-fg) 6%, transparent);
    backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid color-mix(in oklab, var(--lov-fg) 14%, transparent);
    box-shadow: inset 0 1px 0 color-mix(in oklab, var(--lov-fg) 12%, transparent);
  }
  .lov-v-outline .lov-step, .lov-v-outline .lov-tri-card {
    background: transparent; box-shadow: none;
    border: 1.5px solid color-mix(in oklab, var(--lov-accent) 45%, transparent);
  }
  .lov-v-filled .lov-step, .lov-v-filled .lov-tri-card {
    background: color-mix(in oklab, var(--lov-accent) 14%, var(--lov-bg));
    border: 1px solid color-mix(in oklab, var(--lov-accent) 22%, transparent);
  }
  .lov-v-gradient .lov-step, .lov-v-gradient .lov-tri-card {
    background: linear-gradient(135deg, color-mix(in oklab, var(--lov-accent) 18%, var(--lov-bg)), color-mix(in oklab, var(--lov-primary) 10%, var(--lov-bg)));
    border: 1px solid color-mix(in oklab, var(--lov-accent) 25%, transparent);
  }
  .lov-v-neon .lov-step, .lov-v-neon .lov-tri-card {
    background: color-mix(in oklab, var(--lov-bg) 92%, transparent);
    border: 1.5px solid var(--lov-accent);
    box-shadow: 0 0 24px -4px color-mix(in oklab, var(--lov-accent) 55%, transparent), inset 0 0 14px -6px color-mix(in oklab, var(--lov-accent) 35%, transparent);
  }
  .lov-v-paper .lov-step, .lov-v-paper .lov-tri-card {
    background: color-mix(in oklab, #f5f0e6 88%, var(--lov-bg) 12%);
    color: #1a1714;
    border: 1px solid color-mix(in oklab, #c9a84c 30%, transparent);
    box-shadow: 0 14px 40px -16px rgba(0,0,0,0.35), 0 2px 6px -2px rgba(0,0,0,0.18);
  }
  .lov-v-mono .lov-step, .lov-v-mono .lov-tri-card {
    background: var(--lov-fg); color: var(--lov-bg); border: none;
  }
  .lov-v-mono .lov-step .lov-step-num,
  .lov-v-mono .lov-tri-card .lov-tri-num { color: var(--lov-bg); opacity: 0.7; }

  /* ── Accent decorations — applied at section level ────────────── */
  .lov-a-top .lov-content::before {
    content: ""; display: block; width: 80px; height: 4px; border-radius: 4px;
    background: var(--lov-accent); margin-bottom: 1.6rem;
  }
  .lov-a-underline .lov-content > .lov-h2,
  .lov-a-underline .lov-content > .lov-h1 {
    display: inline-block; padding-bottom: 0.5rem; border-bottom: 4px solid var(--lov-accent);
  }
  .lov-a-left .lov-content { padding-inline-start: 2.4rem; position: relative; }
  .lov-a-left .lov-content::before {
    content: ""; position: absolute; inset-inline-start: 0; top: 0.4rem; bottom: 0.4rem;
    width: 5px; border-radius: 4px; background: var(--lov-accent);
  }
  .lov-a-corner::before {
    content: ""; position: absolute; top: 0; inset-inline-end: 0; pointer-events: none; z-index: 1;
    width: 180px; height: 180px;
    background: radial-gradient(circle at top right, color-mix(in oklab, var(--lov-accent) 55%, transparent), transparent 65%);
  }
  .lov-a-side-bar::after {
    content: ""; position: absolute; inset-inline-start: 0; top: 8%; bottom: 8%;
    width: 6px; border-radius: 4px; z-index: 1;
    background: linear-gradient(180deg, transparent, var(--lov-accent), transparent);
  }
  @media (max-width: 768px) {
    .lov-a-corner::before { width: 120px; height: 120px; }
    .lov-a-left .lov-content { padding-inline-start: 1.4rem; }
  }

  /* ── Layout micro-variations via data-layout ──────────────────── */
  [data-layout="magazine-cover"] .lov-imgfull-veil {
    background: linear-gradient(0deg, color-mix(in oklab, var(--lov-bg) 95%, transparent) 0%, transparent 60%);
  }
  [data-layout="diagonal-split"] .lov-imgfull-veil {
    background: linear-gradient(115deg, color-mix(in oklab, var(--lov-bg) 95%, transparent) 45%, transparent 55%);
  }
  [data-layout="polaroid"] .lov-imgtop-media {
    transform: rotate(-2deg); border: 14px solid #fafaf7;
    box-shadow: 0 30px 60px -20px rgba(0,0,0,0.5); max-width: 70%; margin: 0 auto;
  }
  [data-layout="image-bottom"] .lov-content { display: flex; flex-direction: column-reverse; }
  [data-layout="centered-narrow"] .lov-content { max-width: 780px; }
  [data-layout="left-aligned-hero"] .lov-content { text-align: start !important; align-items: flex-start; }
  [data-layout="left-aligned-hero"] .lov-content > * { text-align: start !important; margin-left: 0; margin-right: 0; }
  [data-layout="right-aligned-hero"] .lov-content { text-align: end !important; align-items: flex-end; }
  [data-layout="right-aligned-hero"] .lov-content > * { text-align: end !important; }
  [data-layout="definition"] .lov-callout-text { font-family: Georgia, "Times New Roman", serif; font-style: italic; }
  [data-layout="poster-typo"] .lov-callout-text {
    font-size: clamp(56px, 9vw, 180px); line-height: 0.95; font-weight: 900;
  }
  [data-layout="manifesto"] .lov-callout-text {
    text-transform: uppercase; letter-spacing: -0.02em; font-weight: 900;
  }
  [data-layout="four-col"] .lov-three-grid { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 1100px) { [data-layout="four-col"] .lov-three-grid { grid-template-columns: repeat(2, 1fr); } }
  [data-layout="bento"] .lov-three-grid {
    grid-template-columns: 2fr 1fr 1fr; grid-auto-rows: minmax(180px, 1fr);
  }
  [data-layout="bento"] .lov-three-grid > :first-child { grid-row: span 2; }
  @media (max-width: 900px) {
    [data-layout="bento"] .lov-three-grid { grid-template-columns: 1fr; }
    [data-layout="bento"] .lov-three-grid > :first-child { grid-row: auto; }
  }
  [data-layout="pillars"] .lov-tri-card {
    border-top: 4px solid var(--lov-accent); border-radius: 0; padding-top: 1.6rem;
  }
  [data-layout="icon-grid"] .lov-tri-num {
    width: 64px; height: 64px; border-radius: 999px; font-size: 26px;
    background: color-mix(in oklab, var(--lov-accent) 22%, transparent);
    display: inline-flex; align-items: center; justify-content: center;
  }
  [data-layout="ribbon-cards"] .lov-tri-card { border-radius: 999px 24px 24px 24px; }
  [data-layout="before-after"] .lov-compare-title::before { content: "BEFORE — "; opacity: 0.5; font-weight: 400; }
  [data-layout="before-after"] .lov-compare-col:last-child .lov-compare-title::before {
    content: "AFTER — "; color: var(--lov-accent); opacity: 1; font-weight: 700;
  }
  [data-layout="vs-split"] .lov-compare-divider { position: relative; }
  [data-layout="vs-split"] .lov-compare-divider::after {
    content: "VS"; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    background: var(--lov-bg); color: var(--lov-accent); padding: 0.5rem 0.8rem;
    border: 2px solid var(--lov-accent); border-radius: 999px;
    font-weight: 900; font-size: 14px; letter-spacing: 0.1em;
  }
  [data-layout="table-compare"] .lov-compare-col {
    background: color-mix(in oklab, var(--lov-fg) 5%, transparent);
    padding: 1.4rem; border-radius: 18px;
    border: 1px solid color-mix(in oklab, var(--lov-fg) 10%, transparent);
  }
  [data-layout="stat-circles"] .lov-stat {
    width: clamp(140px, 16vw, 220px); aspect-ratio: 1; border-radius: 999px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 2px solid var(--lov-accent); text-align: center;
  }
  [data-layout="stat-circles"] .lov-stats-grid { justify-items: center; }
  [data-layout="kpi-strip"] .lov-stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); padding: 1.8rem 2rem;
    background: linear-gradient(90deg, color-mix(in oklab, var(--lov-accent) 14%, transparent), transparent);
    border-radius: 24px; border: 1px solid color-mix(in oklab, var(--lov-accent) 22%, transparent);
  }
  [data-layout="numbered-list"] .lov-steps { grid-template-columns: 1fr; gap: 0; }
  [data-layout="numbered-list"] .lov-step {
    border-radius: 0; border-left: none; border-right: none; border-top: none;
    background: transparent; padding: 1.4rem 0;
    display: grid; grid-template-columns: 80px 1fr; align-items: baseline;
  }
  [data-layout="numbered-list"] .lov-step-num { margin: 0; font-size: clamp(28px, 2.6vw, 44px); }
  [data-layout="step-vertical"] .lov-steps { grid-template-columns: 1fr; }
  [data-layout="step-vertical"] .lov-step {
    display: grid; grid-template-columns: 80px 1fr; gap: 1.4rem; align-items: start;
  }
  [data-layout="step-vertical"] .lov-step-num { margin: 0; }
  [data-layout="timeline-horizontal"] .lov-events {
    grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); overflow-x: auto; padding-bottom: 1rem;
  }
  [data-layout="timeline-horizontal"] .lov-events::before {
    inset-inline-start: 0; inset-inline-end: 0; top: 24px; bottom: auto;
    height: 2px; width: auto; background: color-mix(in oklab, var(--lov-accent) 40%, transparent);
  }
  [data-layout="timeline-horizontal"] .lov-event { grid-template-columns: 1fr; padding-top: 48px; position: relative; }
  [data-layout="timeline-horizontal"] .lov-event::before { top: 17px; inset-inline-start: 50%; transform: translateX(-50%); }
  [data-layout="story-rows"] .lov-event {
    grid-template-columns: 1fr; padding: 1.6rem 0;
    border-bottom: 1px solid color-mix(in oklab, var(--lov-fg) 10%, transparent);
  }
  [data-layout="story-rows"] .lov-events::before,
  [data-layout="story-rows"] .lov-event::before { display: none; }
  [data-layout="image-grid-2"] .lov-gallery-grid { grid-template-columns: 1fr 1fr; }
  [data-layout="image-grid-2"] .lov-gallery-grid > :nth-child(n+3) { display: none; }
  [data-layout="image-grid-4"] .lov-gallery-grid { grid-template-columns: repeat(2, 1fr); }
  [data-layout="carousel-strip"] .lov-gallery-grid {
    grid-auto-flow: column; grid-auto-columns: 60%; overflow-x: auto; gap: 1rem;
  }
  [data-layout="masonry-cards"] .lov-gallery-grid {
    grid-template-columns: repeat(3, 1fr); grid-auto-rows: 180px;
  }
  [data-layout="masonry-cards"] .lov-gal-item:nth-child(2n) { grid-row: span 2; }
  [data-layout="focus-image"] .lov-content { display: grid; gap: 1.5rem; justify-items: center; }
`;

const DIGITAL_OASIS_LOCK_CSS = `
  html, body { background: #000 !important; color: #e8ece4 !important; overflow-x: hidden !important; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  body > canvas { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 0 !important; }
  #scroll-container { position: relative !important; z-index: 1 !important; }

  /* Tonal accent variables per slide */
  .dos-tone-lime    { --dos-accent: 230,245,120; --dos-soft: 60,72,28; }
  .dos-tone-sage    { --dos-accent: 168,196,150; --dos-soft: 36,52,40; }
  .dos-tone-ivory   { --dos-accent: 240,232,210; --dos-soft: 60,55,44; }
  .dos-tone-copper  { --dos-accent: 218,150,108; --dos-soft: 68,42,28; }
  .dos-tone-aqua    { --dos-accent: 130,210,210; --dos-soft: 24,58,60; }
  .dos-tone-violet  { --dos-accent: 196,170,232; --dos-soft: 52,38,72; }
  .dos-tone-rose    { --dos-accent: 230,168,180; --dos-soft: 68,32,42; }

  /* Slide frame */
  .dos-slide { min-height: auto !important; display: flex; align-items: center; padding: clamp(64px, 11vh, 140px) clamp(22px, 6vw, 88px); position: relative; }
  .dos-cover { min-height: 92vh !important; justify-content: center; text-align: center; flex-direction: column; }
  .dos-inner { max-width: 1200px; width: 100%; margin: 0 auto; }
  .dos-cover .dos-label, .dos-cover .dos-title, .dos-cover .dos-sub, .dos-cover .dos-big, .dos-cover .dos-quote, .dos-cover .dos-attr { text-align: center; }

  /* Surface variants */
  .dos-surf-clean  { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); }
  .dos-surf-frost  { background: rgba(255,255,255,0.04); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.12); }
  .dos-surf-border { background: rgba(0,0,0,0.35); border: 1.5px solid rgba(var(--dos-accent),0.55); }
  .dos-surf-tint   { background: rgba(var(--dos-soft),0.55); border: 1px solid rgba(var(--dos-accent),0.18); }
  .dos-surf-glass  { background: rgba(255,255,255,0.05); backdrop-filter: blur(18px) saturate(140%); border: 1px solid rgba(255,255,255,0.14); }
  .dos-surf-ink    { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); }
  .dos-surf-grad   { background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(var(--dos-soft),0.4)); border: 1px solid rgba(255,255,255,0.08); }
  .dos-surf-noir   { background: #0a0a0a; border: 1px solid rgba(var(--dos-accent),0.35); }

  /* Accent decorations */
  .dos-acc-top    { box-shadow: inset 0 3px 0 0 rgba(var(--dos-accent),0.9); }
  .dos-acc-left   { box-shadow: inset 3px 0 0 0 rgba(var(--dos-accent),0.9); }
  .dos-acc-corner { position: relative; }
  .dos-acc-corner::before { content:""; position:absolute; top:0; right:0; width:42px; height:42px; background: rgba(var(--dos-accent),0.85); clip-path: polygon(100% 0, 100% 100%, 0 0); }
  .dos-acc-underline .dos-card-t, .dos-acc-underline .dos-step-t { box-shadow: 0 2px 0 0 rgba(var(--dos-accent),0.85); display: inline-block; padding-bottom: 2px; }
  .dos-acc-dot .dos-card-t::before, .dos-acc-dot .dos-step-t::before { content:""; display:inline-block; width:8px; height:8px; border-radius:50%; background: rgba(var(--dos-accent),1); margin-inline-end: 10px; vertical-align: middle; }
  .dos-acc-bar { border-inline-start: 3px solid rgba(var(--dos-accent),0.85); padding-inline-start: 14px; }
  .dos-acc-num .dos-card-n, .dos-acc-num .dos-step-n { color: rgba(var(--dos-accent),1) !important; }

  /* Typography */
  .dos-label { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(var(--dos-accent), 0.85); margin-bottom: 24px; display: inline-block; font-weight: 600; }
  .dos-title { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(32px, 5vw, 68px); line-height: 1.1; letter-spacing: -0.015em; color: #f8fcf0; margin-bottom: 24px; overflow-wrap: anywhere; text-shadow: 0 2px 24px rgba(0,0,0,0.55); }
  .dos-cover .dos-title { font-size: clamp(44px, 7.5vw, 108px); }
  .dos-sub { font-size: clamp(15px, 1.4vw, 18px); line-height: 1.75; color: rgba(232,236,228,0.78); max-width: 660px; margin-bottom: 22px; }
  .dos-cover .dos-sub { margin: 0 auto 22px; }
  .dos-body { font-size: clamp(15px, 1.3vw, 17.5px); line-height: 1.85; color: rgba(232,236,228,0.78); max-width: 760px; margin-bottom: 18px; }

  /* Quote / big */
  .dos-quote { font-family: 'Playfair Display', serif; font-style: italic; font-weight: 400; font-size: clamp(26px, 3.6vw, 52px); line-height: 1.25; letter-spacing: -0.02em; color: #f8fcf0; max-width: 960px; margin: 0 auto; text-align: center; text-shadow: 0 2px 24px rgba(0,0,0,0.55); }
  .dos-attr { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(var(--dos-accent),0.85); margin-top: 28px; text-align: center; display: block; }
  .dos-big { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(100px, 17vw, 260px); line-height: 0.92; letter-spacing: -0.04em; color: rgba(var(--dos-accent),0.95); text-align: center; text-shadow: 0 4px 40px rgba(0,0,0,0.6); }

  /* Stats */
  .dos-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 32px; }
  .dos-stat { padding: 26px 22px; border-radius: 6px; text-align: center; }
  .dos-stat-v { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(32px, 4vw, 52px); color: rgba(var(--dos-accent),1); line-height: 1; letter-spacing: -0.02em; }
  .dos-stat-l { margin-top: 10px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(232,236,228,0.65); }

  /* Generic grids */
  .dos-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; margin-top: 32px; }
  .dos-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; margin-top: 32px; }
  .dos-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-top: 32px; }
  .dos-bento  { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); grid-auto-rows: minmax(130px, auto); gap: 14px; margin-top: 32px; }
  .dos-bento > *:nth-child(1) { grid-column: span 4; grid-row: span 2; }
  .dos-bento > *:nth-child(2) { grid-column: span 2; }
  .dos-bento > *:nth-child(3) { grid-column: span 2; }
  .dos-bento > *:nth-child(4) { grid-column: span 3; }
  .dos-bento > *:nth-child(5) { grid-column: span 3; }
  .dos-bento > *:nth-child(6) { grid-column: span 2; }
  .dos-masonry { columns: 3 240px; column-gap: 16px; margin-top: 32px; }
  .dos-masonry > * { break-inside: avoid; margin-bottom: 16px; display: block; }

  .dos-card { padding: 26px 24px; border-radius: 6px; }
  .dos-card-n { font-size: 10px; letter-spacing: 0.2em; color: rgba(232,236,228,0.4); margin-bottom: 12px; font-weight: 700; }
  .dos-card-t { font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #f8fcf0; margin-bottom: 10px; line-height: 1.3; }
  .dos-card-d { font-size: 13.5px; line-height: 1.7; color: rgba(232,236,228,0.7); }

  /* Steps */
  .dos-steps { display: flex; flex-direction: column; margin-top: 32px; }
  .dos-step  { display: grid; grid-template-columns: 60px 1fr; gap: 24px; padding: 22px 0; border-bottom: 1px solid rgba(255,255,255,0.1); align-items: start; }
  .dos-step:first-child { border-top: 1px solid rgba(255,255,255,0.1); }
  .dos-step-n { font-family: 'Playfair Display', serif; font-style: italic; font-size: 26px; color: rgba(var(--dos-accent),0.7); line-height: 1; }
  .dos-step-t { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: #f8fcf0; }
  .dos-step-d { font-size: 13.5px; line-height: 1.7; color: rgba(232,236,228,0.65); }

  /* Manifesto */
  .dos-mani { margin-top: 32px; }
  .dos-mani-row { display: grid; grid-template-columns: 120px 1fr; gap: 28px; padding: 22px 0; border-bottom: 1px dashed rgba(255,255,255,0.18); }
  .dos-mani-k { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(var(--dos-accent),0.8); font-weight: 700; }
  .dos-mani-t { font-size: 18px; font-weight: 700; color: #f8fcf0; margin-bottom: 6px; }
  .dos-mani-d { font-size: 13.5px; line-height: 1.7; color: rgba(232,236,228,0.7); }

  /* Pills */
  .dos-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
  .dos-pill  { padding: 12px 22px; border: 1.5px solid rgba(var(--dos-accent),0.7); font-size: 12.5px; font-weight: 600; letter-spacing: 0.05em; color: #f8fcf0; background: rgba(0,0,0,0.3); border-radius: 999px; }
  .dos-pill-sq { border-radius: 0; }

  /* Split / editorial */
  .dos-split { display: grid; grid-template-columns: 1fr 1.15fr; gap: clamp(28px, 4vw, 68px); align-items: start; }
  .dos-split-rev { grid-template-columns: 1.15fr 1fr; }
  .dos-edit-list { border-top: 1px solid rgba(255,255,255,0.12); }
  .dos-edit-item { padding: 22px 0; border-bottom: 1px solid rgba(255,255,255,0.12); }
  .dos-edit-k { font-weight: 800; font-size: 11px; letter-spacing: 0.18em; color: rgba(var(--dos-accent),0.8); margin-bottom: 8px; }
  .dos-edit-t { font-size: 17px; font-weight: 700; color: #f8fcf0; margin-bottom: 6px; }
  .dos-edit-d { font-size: 13.5px; line-height: 1.7; color: rgba(232,236,228,0.7); }

  /* Callouts */
  .dos-call { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 32px; }
  .dos-call-box { padding: 24px; border-radius: 6px; }

  /* Timeline */
  .dos-tl { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 20px; margin-top: 36px; position: relative; }
  .dos-tl::before { content:""; position:absolute; left:8px; right:8px; top: 16px; height: 1px; background: rgba(255,255,255,0.15); }
  .dos-tl-item { position: relative; padding-top: 36px; }
  .dos-tl-item::before { content:""; position:absolute; left: 0; top: 11px; width: 12px; height: 12px; background: rgba(var(--dos-accent),1); border-radius: 50%; border: 2px solid #000; }
  .dos-tl-k { font-weight: 800; font-size: 11px; letter-spacing: 0.16em; color: rgba(var(--dos-accent),0.9); margin-bottom: 8px; }
  .dos-tl-t { font-size: 15px; font-weight: 700; color: #f8fcf0; margin-bottom: 6px; }
  .dos-tl-d { font-size: 12.5px; line-height: 1.65; color: rgba(232,236,228,0.65); }

  /* Compare */
  .dos-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 32px; }
  .dos-compare > div { padding: 30px 26px; border-radius: 6px; }
  .dos-compare h3 { font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(var(--dos-accent),0.9); margin-bottom: 14px; }
  .dos-compare p { font-size: 13.5px; line-height: 1.7; color: rgba(232,236,228,0.72); padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.1); }

  /* RTL */
  [dir="rtl"] .dos-body, [dir="rtl"] .dos-card-d, [dir="rtl"] .dos-step-d, [dir="rtl"] .dos-mani-d, [dir="rtl"] .dos-edit-d, [dir="rtl"] .dos-tl-d, [dir="rtl"] .dos-sub { text-align: right; }
  [dir="rtl"] .dos-step, [dir="rtl"] .dos-mani-row { direction: rtl; }
  [dir="rtl"] .dos-acc-corner::before { left: 0; right: auto; clip-path: polygon(0 0, 0 100%, 100% 0); }
  [dir="rtl"] .dos-acc-slash::before { left: auto; right: 0; transform: scaleX(-1); }

  /* ── Extended tones ── */
  .dos-tone-gold { --dos-accent: 232,196,120; --dos-soft: 72,56,28; }

  /* ── Extended surfaces ── */
  .dos-surf-mesh {
    background:
      radial-gradient(circle at 1px 1px, rgba(var(--dos-accent),0.18) 1px, transparent 1.5px) 0 0 / 14px 14px,
      rgba(0,0,0,0.4);
    border: 1px solid rgba(var(--dos-accent),0.22);
  }
  .dos-surf-wash {
    background: radial-gradient(circle at 30% 0%, rgba(var(--dos-accent),0.22), transparent 65%), rgba(0,0,0,0.45);
    border: 1px solid rgba(255,255,255,0.08);
  }

  /* ── Extended accents ── */
  .dos-acc-ring { position: relative; }
  .dos-acc-ring .dos-card-n, .dos-acc-ring .dos-step-n, .dos-acc-ring .dos-stat-l {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 28px; padding: 0 8px;
    border: 1px solid rgba(var(--dos-accent),0.7);
    border-radius: 999px; color: rgba(var(--dos-accent),1) !important;
  }
  .dos-acc-slash { position: relative; overflow: hidden; }
  .dos-acc-slash::before {
    content: ""; position: absolute; top: 0; left: 0; width: 36px; height: 100%;
    background: linear-gradient(110deg, rgba(var(--dos-accent),0.85) 0 14px, transparent 16px),
                linear-gradient(110deg, rgba(var(--dos-accent),0.5) 18px 26px, transparent 28px);
    pointer-events: none;
  }

  /* ── Alignment variants ── */
  .dos-align-left  .dos-inner { margin-left: 0; margin-right: auto; text-align: left; }
  .dos-align-right .dos-inner { margin-left: auto; margin-right: 0; text-align: right; }
  .dos-align-right .dos-label, .dos-align-right .dos-pills, .dos-align-right .dos-stats { justify-content: flex-end; }
  .dos-align-center .dos-inner { margin: 0 auto; text-align: center; }
  .dos-align-center .dos-pills, .dos-align-center .dos-stats { justify-content: center; }
  .dos-align-center .dos-label, .dos-align-center .dos-title, .dos-align-center .dos-body, .dos-align-center .dos-sub { margin-left: auto; margin-right: auto; }
  [dir="rtl"] .dos-align-left .dos-inner { text-align: right; }
  [dir="rtl"] .dos-align-right .dos-inner { text-align: left; }

  /* ── Extended layouts ── */
  .dos-mosaic { display: grid; grid-template-columns: repeat(12, 1fr); gap: 14px; margin-top: 32px; }
  .dos-mosaic > *:nth-child(6n+1) { grid-column: span 7; }
  .dos-mosaic > *:nth-child(6n+2) { grid-column: span 5; }
  .dos-mosaic > *:nth-child(6n+3) { grid-column: span 4; }
  .dos-mosaic > *:nth-child(6n+4) { grid-column: span 4; }
  .dos-mosaic > *:nth-child(6n+5) { grid-column: span 4; }
  .dos-mosaic > *:nth-child(6n)   { grid-column: span 12; }

  .dos-hero-list { list-style: none; padding: 0; margin: 32px 0 0; }
  .dos-hero-list li {
    display: grid; grid-template-columns: 90px 1fr; gap: 28px;
    padding: 26px 0; border-bottom: 1px solid rgba(255,255,255,0.12); align-items: baseline;
  }
  .dos-hero-list li:first-child { border-top: 1px solid rgba(255,255,255,0.12); }
  .dos-hero-n {
    font-family: 'Playfair Display', serif; font-style: italic;
    font-size: clamp(40px, 4.5vw, 64px); line-height: 0.9;
    color: rgba(var(--dos-accent),0.85);
  }
  .dos-hero-t { font-size: clamp(20px, 2vw, 26px); font-weight: 700; color: #f8fcf0; margin-bottom: 8px; letter-spacing: -0.01em; }
  .dos-hero-d { font-size: 14.5px; line-height: 1.75; color: rgba(232,236,228,0.72); }
  [dir="rtl"] .dos-hero-list li { grid-template-columns: 1fr 90px; }
  @media (max-width: 640px) {
    .dos-hero-list li { grid-template-columns: 60px 1fr; gap: 16px; padding: 18px 0; }
    .dos-hero-n { font-size: 34px; }
    .dos-mosaic > * { grid-column: span 12 !important; }
  }



  /* Brand badge */
  .lov-brand-logo { position: fixed; top: 24px; inset-inline-end: 24px; z-index: 50; height: 40px; width: auto; opacity: 0.9; pointer-events: none; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15)); }

  /* Responsive */
  @media (max-width: 1024px) {
    .dos-grid-4, .dos-grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .dos-bento  { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .dos-bento > * { grid-column: span 1 !important; grid-row: span 1 !important; }
    .dos-split, .dos-split-rev { grid-template-columns: 1fr; gap: 32px; }
    .dos-masonry { columns: 2 200px; }
    .dos-compare { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .dos-slide { padding: 56px 20px !important; }
    .dos-cover { min-height: 82vh !important; }
    .dos-title { font-size: clamp(26px, 8vw, 38px) !important; }
    .dos-cover .dos-title { font-size: clamp(34px, 10vw, 50px) !important; }
    .dos-big { font-size: clamp(72px, 24vw, 110px) !important; }
    .dos-quote { font-size: clamp(20px, 6vw, 28px) !important; }
    .dos-grid-2, .dos-grid-3, .dos-grid-4 { grid-template-columns: 1fr; }
    .dos-bento { grid-template-columns: 1fr; }
    .dos-masonry { columns: 1; }
    .dos-stats { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .dos-stat { padding: 20px 14px; }
    .dos-stat-v { font-size: clamp(28px, 9vw, 40px) !important; }
    .dos-step { grid-template-columns: 44px 1fr; gap: 14px; padding: 18px 0; }
    .dos-mani-row { grid-template-columns: 80px 1fr; gap: 14px; padding: 18px 0; }
    .dos-tl { grid-template-columns: 1fr; }
    .dos-tl::before { display: none; }
    .dos-call { grid-template-columns: 1fr; }
  }
`;

const SCROLL_OBSERVER_SCRIPT = `
(function () {
  function arm() {
    var sections = document.querySelectorAll('.lov-section');
    if (!sections.length) return;
    function unlockScroll() {
      document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
      document.documentElement.style.setProperty('height', 'auto', 'important');
      document.body.style.setProperty('overflow-y', 'auto', 'important');
      document.body.style.setProperty('height', 'auto', 'important');
      document.body.style.setProperty('position', 'static', 'important');
    }
    unlockScroll();
    window.addEventListener('load', unlockScroll);
    setTimeout(unlockScroll, 250);
    setTimeout(unlockScroll, 1000);
    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (s) { s.classList.add('lov-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('lov-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    sections.forEach(function (s) { io.observe(s); });
    // First section: trigger immediately so cover never waits.
    if (sections[0]) sections[0].classList.add('lov-in');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else { arm(); }
})();
`;

/** Parse the template HTML and return its <head>, body attributes, original body shell, and scripts. */
function extractTemplateScaffold(rawHtml: string): { headInner: string; bodyAttr: string; templateBody: string; bgMarkup: string; bgScripts: string } {
  // <head>...</head>
  const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headInner = headMatch ? headMatch[1] : "";

  // <body ...>
  const bodyOpen = rawHtml.match(/<body([^>]*)>/i);
  const bodyAttr = bodyOpen ? bodyOpen[1] : "";

  // body inner
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyInner = bodyMatch ? bodyMatch[1] : "";

  // Pull only background-flavored canvases + scripts for fallback templates.
  const bgCanvases = (bodyInner.match(/<canvas\b[^>]*><\/canvas>/gi) || []).join("\n");
  const bgScripts = (bodyInner.match(/<script\b[\s\S]*?<\/script>/gi) || []).join("\n");
  const templateBody = bodyInner.replace(/<script\b[\s\S]*?<\/script>/gi, "").trim();

  return { headInner, bodyAttr, templateBody, bgMarkup: bgCanvases, bgScripts };
}

/** Build CSS overrides from optional theme + brandKit. Layered AFTER variant styles. */
function themeAndBrandCss(deck: SlideDeck & { variant?: string }): string {
  const themeId = deck.theme && (deck.theme in THEMES) ? (deck.theme as ThemeId) : null;
  const theme = themeId ? getTheme(themeId) : null;
  const bk = deck.brandKit || {};

  const rules: string[] = [];
  const rootVars: string[] = [];

  if (theme) {
    rootVars.push(`--lov-bg: hsl(${theme.palette.bg})`);
    rootVars.push(`--lov-fg: hsl(${theme.palette.fg})`);
    rootVars.push(`--lov-primary: hsl(${theme.palette.primary})`);
    rootVars.push(`--lov-accent: hsl(${theme.palette.accent})`);
    rules.push(`.lov-deck, .lov-deck * { font-family: ${theme.typography.bodyFamily}; }`);
    rules.push(`.lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: ${theme.typography.headingFamily}; letter-spacing: ${theme.typography.headingTracking} !important; }`);
  }
  // Brand kit takes precedence over theme defaults
  if (bk.primaryColor) rootVars.push(`--lov-primary: ${bk.primaryColor}`);
  if (bk.accentColor) rootVars.push(`--lov-accent: ${bk.accentColor}`);
  if (bk.fontFamily) {
    rules.push(`.lov-deck, .lov-deck * { font-family: ${bk.fontFamily}, system-ui, sans-serif; }`);
    rules.push(`.lov-deck .lov-h1, .lov-deck .lov-h2 { font-family: ${bk.fontFamily}, system-ui, sans-serif; }`);
  }
  if (rootVars.length) rules.unshift(`:root { ${rootVars.join("; ")}; }`);

  // Brand logo badge (fixed top-end corner of each slide)
  if (bk.logoUrl) {
    rules.push(`
      .lov-brand-logo {
        position: fixed; top: 24px; inset-inline-end: 24px; z-index: 50;
        height: 40px; width: auto; opacity: 0.9; pointer-events: none;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
      }
    `);
  }
  return rules.join("\n");
}

function buildDocument(rawTemplateHtml: string, deck: SlideDeck & { htmlSlug: string; variant?: string }): string {
  const { headInner, bodyAttr, templateBody, bgMarkup, bgScripts } = extractTemplateScaffold(rawTemplateHtml);
  const lang = (deck.language || "en").toLowerCase();
  const isRtl = lang.startsWith("ar") || lang.startsWith("he") || lang.startsWith("fa") || lang.startsWith("ur");
  const dir = isRtl ? "rtl" : "ltr";

  // Re-base relative asset URLs (fonts, images, scripts) to /templates/{slug}/
  const base = `/templates/${deck.htmlSlug}/`;

  const isDigitalOasis = deck.htmlSlug === "remix-3d-website-the-digital-o";
  const isOceanFlow = deck.htmlSlug === "remix-ocean-flow-fish";
  const isSeasonal = deck.htmlSlug === "remix-seasonal-scroll-experien";
  const isVanta = deck.htmlSlug === "remix-vanta-digital-atelier";
  const isAquara = deck.htmlSlug === "remix-aquara-water";
  const isLandscape = deck.htmlSlug === "remix-landscape-design";
  const isValence = deck.htmlSlug === "remix-valence-blobs";
  const isSynthra = deck.htmlSlug === "remix-synthra-builder";
  const isKami = deck.htmlSlug === "remix-kami-notebook";
  const isSpidey = deck.htmlSlug === "remix-cool-spiderman-website-d";
  const isYash = deck.htmlSlug === "remix-yash-designer-folio";
  const isStorm = deck.htmlSlug === "remix-storm-to-calm-scrolling";
  const isFolio = deck.htmlSlug === "remix-interactive-3d-portfolio";
  const isAxiom = deck.htmlSlug === "remix-abstract-vector-network";
  const isTemplate3D = isDigitalOasis || isOceanFlow || isSeasonal || isVanta || isAquara || isLandscape || isValence || isSynthra || isKami || isSpidey || isYash || isStorm || isFolio || isAxiom;
  const slidesMarkup = isDigitalOasis
    ? renderDigitalOasisDeck(deck)
    : isOceanFlow
    ? renderOceanFlowDeck(deck)
    : isSeasonal
    ? renderSeasonalScrollDeck(deck)
    : isVanta
    ? renderVantaAtelierDeck(deck)
    : isAquara
    ? renderAquaraWaterDeck(deck)
    : isLandscape
    ? renderLandscapeLanguageDeck(deck)
    : isValence
    ? renderValenceBlobsDeck(deck)
    : isSynthra
    ? renderSynthraBuilderDeck(deck)
    : isKami
    ? renderKamiNotebookDeck(deck)
    : isSpidey
    ? renderSpideyDeck(deck)
    : isYash
    ? renderYashFolioDeck(deck)
    : isStorm
    ? renderStormToCalmDeck(deck)
    : isFolio
    ? renderFolioScatterDeck(deck)
    : isAxiom
    ? renderAxiomDeck(deck)
    : deck.slides.map((s, i) => slideHtml(s, i, deck.palette, deck.slides.length)).join("\n");
  const bodyMarkup = isTemplate3D
    ? slidesMarkup
    : `${bgMarkup || templateBody}\n<main class="lov-deck">${slidesMarkup}</main>`;
  const templateScripts = bgScripts.replace(/\b(src|href)=(['"])\/(?!\/|templates\/)([^'"]+)\2/g, (_m, attr, quote, path) => `${attr}=${quote}${base}${path}${quote}`);

  // For Arabic / RTL languages, the template's chosen Latin display font almost
  // never has Arabic shaping — letters render disconnected. Inject Cairo +
  // Noto Naskh Arabic and force them everywhere inside .lov-deck so the deck
  // is always readable, regardless of which template was picked.
  const arabicFontLink = isRtl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
       <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
       <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;500;700&display=swap" rel="stylesheet" />`
    : "";
  const arabicFontCss = isRtl
    ? `<style id="lov-arabic-fonts">
      .lov-deck, .lov-deck *,
      .lov-h1, .lov-h2, .lov-subtitle, .lov-body, .lov-bullets li,
      .lov-kicker, .lov-index, .lov-quote, .lov-stats, .lov-cta {
        font-family: "Cairo", "Noto Naskh Arabic", "Tajawal", system-ui, -apple-system, "Segoe UI", sans-serif !important;
        font-feature-settings: "kern", "liga", "calt";
      }
      .lov-deck { direction: rtl; text-align: right; }
      .lov-bullets li { padding-inline-start: 0; padding-inline-end: 1.6rem; }
      .lov-bullets li::before { inset-inline-start: auto; inset-inline-end: 0; }
    </style>`
    : "";

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="${base}" />
    <title>${esc(deck.title)}</title>
    ${headInner}
    ${isTemplate3D ? TEMPLATE_3D_IMPORT_MAP : ""}
    ${arabicFontLink}
    ${isDigitalOasis
      ? `<style id="lov-template-lock">${DIGITAL_OASIS_LOCK_CSS}</style>`
      : isOceanFlow
      ? `<style id="lov-template-lock">${OCEAN_FLOW_LOCK_CSS}</style>`
      : isSeasonal
      ? `<style id="lov-template-lock">${SEASONAL_LOCK_CSS}</style>`
      : isVanta
      ? `<style id="lov-template-lock">${VANTA_LOCK_CSS}</style>`
      : isAquara
      ? `<style id="lov-template-lock">${AQUARA_LOCK_CSS}</style>`
      : isLandscape
      ? `<style id="lov-template-lock">${LANDSCAPE_LOCK_CSS}</style>`
      : isValence
      ? `<style id="lov-template-lock">${VALENCE_LOCK_CSS}</style>`
      : isSynthra
      ? `<style id="lov-template-lock">${SYNTHRA_LOCK_CSS}</style>`
      : isKami
      ? `<style id="lov-template-lock">${KAMI_LOCK_CSS}</style>`
      : isSpidey
      ? `<style id="lov-template-lock">${SPIDEY_LOCK_CSS}</style>`
      : isYash
      ? `<style id="lov-template-lock">${YASH_LOCK_CSS}</style>`
      : isStorm
      ? `<style id="lov-template-lock">${STORM_LOCK_CSS}</style>`
      : isFolio
      ? `<style id="lov-template-lock">${FOLIO_LOCK_CSS}</style>`
      : isAxiom
      ? `<style id="lov-template-lock">${AXIOM_LOCK_CSS}</style>`
      : `<style id="lov-overrides">${SLIDE_BASE_CSS(deck.palette)}</style>\n    <style id="lov-variant">${VARIANT_STYLES[normalizeVariant(deck.variant)]}</style>\n    <style id="lov-theme">${themeAndBrandCss(deck)}</style>`}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bebas+Neue&family=Caveat:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Serif+Display&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&family=Kalam:wght@400;700&family=Lora:wght@400;500;600&family=Outfit:wght@400;600;800;900&family=Oswald:wght@500;700&family=Patrick+Hand&family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Sora:wght@300;400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=VT323&family=Work+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
    ${arabicFontCss}
  </head>
  <body${bodyAttr} data-lov-variant="${esc(normalizeVariant(deck.variant))}">
    ${deck.brandKit?.logoUrl ? `<img class="lov-brand-logo" src="${esc(deck.brandKit.logoUrl)}" alt="brand logo" />` : ""}
    ${bodyMarkup}
    ${templateScripts}
    ${isTemplate3D ? TEMPLATE_SAFETY_SCRIPT : `<script>${SCROLL_OBSERVER_SCRIPT}</script>`}
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const SlidesHtmlDeckCard = ({ deck }: Props) => {
  // Default orientation reflects the picked template's category:
  //  - "standard" → horizontal slide-by-slide deck with nav buttons
  //  - "premium"  → vertical landing-page scroll (current behaviour)
  const defaultOrientation: "horizontal" | "vertical" =
    isStandardSlides((deck as SlideDeck & { templateId?: string }).templateId) ? "horizontal" : "vertical";
  const isStandardDeck = defaultOrientation === "horizontal";
  const [open, setOpen] = useState(false);
  const orientation = defaultOrientation;
  const [rawHtml, setRawHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadMenu, setDownloadMenu] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // Scroll the embedded deck to a specific slide. In horizontal mode we track
  // an explicit index so smooth + scroll-snap-stop:always doesn't get stuck
  // between snap points (which was causing the Next button to do nothing).
  const slideIndexRef = useRef(0);
  const getDeckEl = (): HTMLElement | null => {
    const win = previewIframeRef.current?.contentWindow;
    if (!win) return null;
    try {
      const doc = win.document;
      return (
        (doc.querySelector(".lov-deck") as HTMLElement | null) ||
        (doc.scrollingElement as HTMLElement | null) ||
        doc.documentElement
      );
    } catch {
      return null;
    }
  };
  const scrollDeck = (dir: "prev" | "next") => {
    const deckEl = getDeckEl();
    if (!deckEl) return;
    const isHorizontal = orientation === "horizontal";
    const sections = deckEl.querySelectorAll<HTMLElement>(".lov-section");
    const total = sections.length || deck.slides.length || 1;
    const next = Math.max(0, Math.min(total - 1, slideIndexRef.current + (dir === "next" ? 1 : -1)));
    slideIndexRef.current = next;
    if (isHorizontal) {
      const target = sections[next];
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      } else {
        const step = deckEl.clientWidth || 1;
        deckEl.scrollTo({ left: next * step, behavior: "smooth" });
      }
    } else {
      const step = deckEl.clientHeight || 1;
      deckEl.scrollTo({ top: next * step, behavior: "smooth" });
    }
  };

  // Listen for arrow-key / wheel events bubbled from the iframe so keyboard
  // navigation works after the user clicks inside the preview.
  useEffect(() => {
    if (!open) {
      slideIndexRef.current = 0;
      return;
    }
    if (orientation !== "horizontal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        scrollDeck("next");
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        scrollDeck("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orientation]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/templates/${deck.htmlSlug}/index.html`);
        if (!r.ok) throw new Error(`status ${r.status}`);
        const t = await r.text();
        if (!cancelled) setRawHtml(t);
      } catch (e) {
        console.error("Template fetch failed", e);
        if (!cancelled) setRawHtml(""); // fall back to bare doc
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [deck.htmlSlug]);

  const finalHtml = useMemo(() => {
    if (rawHtml === null) return "";
    return buildDocument(rawHtml, deck);
  }, [rawHtml, deck]);

  const presentationHtml = useMemo(() => {
    if (!finalHtml) return "";
    const orientationCss = orientation === "horizontal"
      ? `
        html,body{height:100%!important;overflow:hidden!important;touch-action:pan-x!important;max-width:100vw!important}
        .lov-deck{height:100vh!important;min-height:100vh!important;width:100vw!important;max-width:100vw!important;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory!important;scroll-behavior:smooth!important;-webkit-overflow-scrolling:touch}
        .lov-deck::-webkit-scrollbar{display:none}
        .lov-section{width:100vw!important;min-width:100vw!important;max-width:100vw!important;height:100vh!important;min-height:100vh!important;flex:0 0 100vw!important;scroll-snap-align:start!important;scroll-snap-stop:always!important;border-bottom:none!important;border-inline-end:1px solid color-mix(in oklab,var(--lov-fg) 8%,transparent);overflow:hidden!important;padding:5vh 5vw!important;box-sizing:border-box!important}
        .lov-section .lov-content,.lov-section .lov-grid,.lov-section .lov-stats-grid{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
        .lov-section .lov-grid{grid-template-columns:1fr!important;gap:2vh 0!important}
        .lov-section .lov-h1,.lov-section .lov-h2,.lov-section .lov-subtitle,.lov-section .lov-body,.lov-section .lov-quote,.lov-section .lov-bullets li,.lov-section .lov-stat-value,.lov-section .lov-cite{max-width:100%!important;overflow-wrap:break-word!important;word-break:normal!important;hyphens:auto!important;min-width:0!important}
        /* Aggressively cap headline size so long titles never bleed past the slide edge. */
        .lov-section .lov-h1{font-size:clamp(28px,6.4vw,72px)!important;line-height:1.08!important;letter-spacing:-0.015em!important;text-transform:none!important;transform:none!important;text-shadow:none!important}
        .lov-section .lov-h2{font-size:clamp(24px,5.2vw,56px)!important;line-height:1.12!important;letter-spacing:-0.01em!important;text-transform:none!important;transform:none!important}
        .lov-section .lov-subtitle{font-size:clamp(15px,2.4vw,24px)!important;line-height:1.4!important;max-width:90%!important}
        .lov-section .lov-body,.lov-section .lov-bullets li{font-size:clamp(14px,2vw,20px)!important;line-height:1.55!important}
        .lov-section .lov-kicker{font-size:clamp(10px,1.4vw,14px)!important;letter-spacing:0.22em!important}
        .lov-section .lov-stat-value{font-size:clamp(32px,7vw,80px)!important;line-height:1!important}
        .lov-section .lov-quote{font-size:clamp(20px,3.6vw,40px)!important;line-height:1.25!important}
        .lov-section .lov-quote-mark{font-size:clamp(60px,10vw,120px)!important}
        .lov-section .lov-media{max-height:32vh!important;aspect-ratio:16/10!important}
        .lov-section img{max-width:100%!important;max-height:32vh!important;object-fit:cover!important}
        .lov-section .lov-stats-grid{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))!important;gap:1.2rem!important;margin-top:1rem!important}
        .lov-deck .lov-section.lov-cover .lov-cover-bg{opacity:0.35!important}
      `
      : `html,body{overflow-x:hidden!important;overflow-y:auto!important;touch-action:pan-y!important}.lov-deck{display:block!important;overflow:visible!important}.lov-section{scroll-snap-align:start}`;
    return finalHtml.replace("</head>", `<style id="lov-orientation-mode">${orientationCss}</style></head>`);
  }, [finalHtml, orientation]);

  const portableHtml = useMemo(() => {
    if (!presentationHtml) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return presentationHtml.replace(`<base href="/templates/`, `<base href="${origin}/templates/`);
  }, [presentationHtml]);

  const handleDownloadHtml = async () => {
    if (!portableHtml) return;
    setDownloading(true);
    try {
      const blob = new Blob([portableHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.title.replace(/[^\p{Letter}\p{Number}\-_ ]+/gu, "").slice(0, 60) || "presentation"}.html`;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      toast.success("HTML downloaded");
    } catch (e) {
      console.error(e); toast.error("Download failed");
    } finally { setDownloading(false); }
  };

  const handleOpenTab = () => {
    if (!portableHtml) return;
    const blob = new Blob([portableHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const safeFileName = (ext: string) =>
    `${(deck.title || "presentation").replace(/[^\p{Letter}\p{Number}\-_ ]+/gu, "").slice(0, 60) || "presentation"}.${ext}`;

  const handleDownloadPptx = async () => {
    setExporting(true);
    setDownloadMenu(false);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      const bg = deck.palette?.bg || "0a0a0a";
      const fg = deck.palette?.fg || "f5f5f5";
      const accent = deck.palette?.accent || "c9a84c";
      const hex = (c: string) => (c || "").replace("#", "").slice(0, 6) || "000000";
      const isRtl = /[\u0600-\u06FF]/.test(deck.title || "") || deck.language === "ar";

      deck.slides.forEach((s, i) => {
        const slide = pptx.addSlide();
        slide.background = { color: hex(bg) };
        if (s.kicker) {
          slide.addText(s.kicker, { x: 0.5, y: 0.4, w: 12, h: 0.4, fontSize: 12, bold: true, color: hex(accent), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left" });
        }
        if (s.type === "cover" || s.type === "closing") {
          slide.addText(s.title || "", { x: 0.5, y: 2.5, w: 12, h: 2.5, fontSize: 60, bold: true, color: hex(fg), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left" });
          if (s.subtitle) slide.addText(s.subtitle, { x: 0.5, y: 5.2, w: 12, h: 1, fontSize: 22, color: hex(fg), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left" });
        } else if (s.type === "quote") {
          slide.addText(`"${s.quote || ""}"`, { x: 1, y: 2, w: 11, h: 3.5, fontSize: 36, italic: true, color: hex(fg), fontFace: "Calibri", rtlMode: isRtl, align: "center" });
          if (s.attribution) slide.addText(`— ${s.attribution}`, { x: 1, y: 5.8, w: 11, h: 0.6, fontSize: 18, color: hex(accent), fontFace: "Calibri", align: "center" });
        } else if (s.type === "stats" && s.stats?.length) {
          slide.addText(s.title || "", { x: 0.5, y: 0.9, w: 12, h: 1, fontSize: 36, bold: true, color: hex(fg), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left" });
          const cols = Math.min(s.stats.length, 4);
          const w = 12 / cols;
          s.stats.slice(0, 8).forEach((st, k) => {
            const col = k % cols; const row = Math.floor(k / cols);
            slide.addText(st.value, { x: 0.5 + col * w, y: 2.4 + row * 2.2, w, h: 1.2, fontSize: 54, bold: true, color: hex(accent), fontFace: "Calibri", align: "center" });
            slide.addText(st.label, { x: 0.5 + col * w, y: 3.6 + row * 2.2, w, h: 0.6, fontSize: 14, color: hex(fg), fontFace: "Calibri", align: "center" });
          });
        } else {
          slide.addText(s.title || "", { x: 0.5, y: 0.9, w: 12, h: 1, fontSize: 36, bold: true, color: hex(fg), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left" });
          let y = 2.2;
          if (s.subtitle) { slide.addText(s.subtitle, { x: 0.5, y, w: 12, h: 0.6, fontSize: 18, color: hex(accent), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left" }); y += 0.7; }
          if (s.body) { slide.addText(s.body, { x: 0.5, y, w: s.image ? 7.5 : 12, h: 4, fontSize: 14, color: hex(fg), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left", valign: "top" }); y += 4.1; }
          if (s.bullets?.length) {
            slide.addText(s.bullets.map((b) => ({ text: b, options: { bullet: true } })), { x: 0.5, y: s.body ? 6 : y, w: s.image ? 7.5 : 12, h: 1.5, fontSize: 14, color: hex(fg), fontFace: "Calibri", rtlMode: isRtl, align: isRtl ? "right" : "left" });
          }
        }
        slide.addText(`${String(i + 1).padStart(2, "0")} / ${String(deck.slides.length).padStart(2, "0")}`, { x: 11, y: 7, w: 2, h: 0.3, fontSize: 10, color: hex(accent), fontFace: "Calibri", align: "right" });
      });

      await pptx.writeFile({ fileName: safeFileName("pptx") });
      toast.success("PPTX downloaded");
    } catch (e) {
      console.error(e); toast.error("PPTX export failed");
    } finally { setExporting(false); }
  };

  const handleShare = async () => {
    if (!portableHtml) return;
    try {
      const blob = new Blob([portableHtml], { type: "text/html;charset=utf-8" });
      const file = new File([blob], safeFileName("html"), { type: "text/html" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: deck.title, text: deck.subtitle || deck.title });
        return;
      }
      // Fallback: share link / copy
      const url = URL.createObjectURL(blob);
      if (navigator.share) {
        await navigator.share({ title: deck.title, text: deck.subtitle || deck.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        console.error(e); toast.error("Share failed");
      }
    }
  };

  const cover = deck.slides[0];

  return (
    <>
      <div className="mt-3 group relative max-w-[420px] rounded-[2rem] overflow-hidden bg-zinc-950 border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all duration-700 hover:border-white/10">
        <button
          onClick={() => setOpen(true)}
          className="relative block w-full aspect-[16/9] overflow-hidden bg-zinc-900"
          style={{ containerType: "inline-size" } as React.CSSProperties}
          aria-label="Open presentation preview"
        >
          {loading || !finalHtml ? (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: deck.palette.bg }}>
              {cover?.image && <img src={cover.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 scale-110 group-hover:scale-100 transition-transform duration-1000" />}
            </div>
          ) : (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <iframe
                title={`${deck.title} preview`}
                srcDoc={presentationHtml || finalHtml}
                sandbox="allow-scripts allow-same-origin"
                scrolling="no"
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  width: "1600px",
                  height: "900px",
                  border: 0,
                  transform: "scale(calc(100cqw / 1600))",
                  transformOrigin: "top left",
                }}
              />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent pointer-events-none" />

          <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-black/50 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition">
            <Maximize2 className="w-3 h-3" /> Open
          </div>
        </button>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-3">
          <button
            onClick={() => setOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black font-semibold rounded-2xl transition-all active:scale-[0.97] hover:bg-zinc-100 shadow-lg text-[14px] tracking-tight"
          >
            <Maximize2 className="w-4 h-4" />
            Open in preview
          </button>
          <button
            onClick={handleOpenTab}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-900 text-zinc-400 hover:text-white font-medium rounded-2xl border border-white/5 transition-all hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-50 text-[14px] tracking-tight"
          >
            Open in web
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/95 backdrop-blur flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <header className="flex items-center gap-3 px-4 py-3 shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full text-white/80 hover:text-white flex items-center justify-center shrink-0 transition"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-white truncate">
                {deck.title || "—"}
              </span>
              <span className="ms-auto rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 shrink-0">
                {isStandardDeck ? "العادي" : "المميز"}
              </span>
            </header>

            <div className="flex-1 px-3 sm:px-6 min-h-0">
              <div className={`w-full h-full rounded-2xl overflow-hidden bg-white shadow-2xl relative overscroll-contain ${orientation === "horizontal" ? "touch-pan-x" : "touch-pan-y"}`}>
                {loading || !finalHtml ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-background via-background to-muted">
                    <motion.svg
                      width="64" height="64" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
                      className="text-fuchsia-500 drop-shadow-[0_0_24px_rgba(217,70,239,0.6)]"
                      animate={{ rotate: [0, 180, 360], scale: [1, 1.15, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor" />
                    </motion.svg>
                    <span className="text-sm font-semibold text-foreground/80">Preparing your slides…</span>
                  </div>
                ) : (
                  <iframe
                    ref={previewIframeRef}
                    title={deck.title}
                    srcDoc={presentationHtml}
                    sandbox="allow-scripts allow-same-origin"
                    scrolling="yes"
                    className={`w-full h-full border-0 bg-white ${orientation === "horizontal" ? "touch-pan-x" : "touch-pan-y"}`}
                  />
                )}

                {/* Slide nav buttons — visible in horizontal "standard" mode */}
                {!loading && finalHtml && orientation === "horizontal" && (
                  <>
                    <button
                      onClick={() => scrollDeck("prev")}
                      aria-label="Previous slide"
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur text-white flex items-center justify-center shadow-lg transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => scrollDeck("next")}
                      aria-label="Next slide"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur text-white flex items-center justify-center shadow-lg transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <footer className="shrink-0 px-4 py-4 flex items-center justify-center gap-3" dir="ltr">
              <div className="relative">
                <button
                  onClick={() => setDownloadMenu((v) => !v)}
                  disabled={loading || downloading || exporting}
                  className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-white text-black text-sm font-medium tracking-wide hover:bg-white/90 disabled:opacity-50 transition"
                >
                  {downloading || exporting ? "Preparing…" : "Download"}
                </button>
                <AnimatePresence>
                  {downloadMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-12 left-1/2 -translate-x-1/2 min-w-[160px] rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-2xl p-1.5 z-10"
                    >
                      <button
                        onClick={() => { setDownloadMenu(false); handleDownloadHtml(); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10 transition"
                      >
                        <span>HTML</span>
                        <span className="text-[10px] text-white/40">.html</span>
                      </button>
                      <button
                        onClick={() => { setDownloadMenu(false); handleDownloadPptx(); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10 transition"
                      >
                        <span>PowerPoint</span>
                        <span className="text-[10px] text-white/40">.pptx</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleShare}
                disabled={loading}
                className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium tracking-wide disabled:opacity-50 transition"
              >
                Share
              </button>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SlidesHtmlDeckCard;
