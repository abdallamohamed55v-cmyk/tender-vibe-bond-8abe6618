// Cinema Studio — clean redesign aligned with our design system.
// Keeps original elements (camera/lens/focal/aperture pickers, AR/Resolution,
// reference image upload, history grid, fullscreen preview) but rebuilt
// using semantic tokens and mobile-first layout.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ImagePlus,
  X,
  Loader2,
  Maximize2,
  Download,
  Settings2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCredits } from "@/hooks/useCredits";
import AppLayout from "@/layouts/AppLayout";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ─── Constants ──────────────────────────────────────────────────────────────

const CAMERA_MAP: Record<string, string> = {
  "Modular 8K Digital": "modular 8K digital cinema camera",
  "Full-Frame Cine Digital": "full-frame digital cinema camera",
  "Grand Format 70mm Film": "grand format 70mm film camera",
  "Studio Digital S35": "Super 35 studio digital camera",
  "Classic 16mm Film": "classic 16mm film camera",
  "Premium Large Format Digital": "premium large-format digital cinema camera",
};

const LENS_MAP: Record<string, string> = {
  "Creative Tilt Lens": "creative tilt lens effect",
  "Compact Anamorphic": "compact anamorphic lens",
  "Extreme Macro": "extreme macro lens",
  "70s Cinema Prime": "1970s cinema prime lens",
  "Classic Anamorphic": "classic anamorphic lens",
  "Premium Modern Prime": "premium modern prime lens",
  "Warm Cinema Prime": "warm-toned cinema prime lens",
  "Swirl Bokeh Portrait": "swirl bokeh portrait lens",
  "Vintage Prime": "vintage prime lens",
  "Halation Diffusion": "halation diffusion filter",
  "Clinical Sharp Prime": "ultra-sharp clinical prime lens",
};

const FOCAL_PERSPECTIVE: Record<number, string> = {
  8: "ultra-wide",
  14: "wide-angle",
  24: "dynamic wide",
  35: "natural cinematic",
  50: "standard portrait",
  85: "classic portrait",
};

const APERTURE_EFFECT: Record<string, string> = {
  "f/1.4": "shallow depth, creamy bokeh",
  "f/4": "balanced depth",
  "f/11": "deep focus clarity",
};

const ASSET_URLS: Record<string, string> = {
  "Modular 8K Digital": "/assets/cinema/modular_8k_digital.webp",
  "Full-Frame Cine Digital": "/assets/cinema/full_frame_cine_digital.webp",
  "Grand Format 70mm Film": "/assets/cinema/grand_format_70mm_film.webp",
  "Studio Digital S35": "/assets/cinema/studio_digital_s35.webp",
  "Classic 16mm Film": "/assets/cinema/classic_16mm_film.webp",
  "Premium Large Format Digital": "/assets/cinema/premium_large_format_digital.webp",
  "Creative Tilt Lens": "/assets/cinema/creative_tilt_lens.webp",
  "Compact Anamorphic": "/assets/cinema/compact_anamorphic.webp",
  "Extreme Macro": "/assets/cinema/extreme_macro.webp",
  "70s Cinema Prime": "/assets/cinema/70s_cinema_prime.webp",
  "Classic Anamorphic": "/assets/cinema/classic_anamorphic.webp",
  "Premium Modern Prime": "/assets/cinema/premium_modern_prime.webp",
  "Warm Cinema Prime": "/assets/cinema/warm_cinema_prime.webp",
  "Swirl Bokeh Portrait": "/assets/cinema/swirl_bokeh_portrait.webp",
  "Vintage Prime": "/assets/cinema/vintage_prime.webp",
  "Halation Diffusion": "/assets/cinema/halation_diffusion.webp",
  "Clinical Sharp Prime": "/assets/cinema/clinical_sharp_prime.webp",
  "f/1.4": "/assets/cinema/f_1_4.webp",
  "f/4": "/assets/cinema/f_4.webp",
  "f/11": "/assets/cinema/f_11.webp",
};

const ASPECT_RATIOS = ["16:9", "9:16", "1:1"];
const RESOLUTIONS = ["720p", "1080p"];
const DURATIONS = ["5s", "10s"];
const CAMERAS = Object.keys(CAMERA_MAP);
const LENSES = Object.keys(LENS_MAP);
const FOCAL_LENGTHS = Object.keys(FOCAL_PERSPECTIVE).map((k) => parseInt(k));
const APERTURES = Object.keys(APERTURE_EFFECT);

function buildNanoBananaPrompt(
  basePrompt: string,
  camera: string,
  lens: string,
  focalLength: number,
  aperture: string,
) {
  const cameraDesc = CAMERA_MAP[camera] || camera;
  const lensDesc = LENS_MAP[lens] || lens;
  const perspective = FOCAL_PERSPECTIVE[focalLength] || "";
  const depthEffect = APERTURE_EFFECT[aperture] || "";
  const parts = [
    basePrompt,
    `shot on a ${cameraDesc}`,
    `using a ${lensDesc} at ${focalLength}mm${perspective ? ` (${perspective} perspective)` : ""}`,
    `aperture ${aperture}`,
    depthEffect,
    "cinematic lighting, natural color science, high dynamic range, smooth camera motion, 1080p film look",
  ];
  return parts.filter((p) => p && p.trim() !== "").join(", ");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

interface CinemaSettings {
  prompt: string;
  aspect_ratio: string;
  camera: string;
  lens: string;
  focal: number;
  aperture: string;
}

interface HistoryEntry {
  url: string;
  timestamp: number;
  settings: CinemaSettings & { resolution: string };
}

// ─── Option Card (grid item) ────────────────────────────────────────────────

function OptionCard({
  label,
  imageUrl,
  selected,
  onClick,
  caption,
}: {
  label: string;
  imageUrl?: string;
  selected: boolean;
  onClick: () => void;
  caption?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`ios-glass relative flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-all text-left ${
        selected
          ? "!border-primary/60 ring-1 ring-primary/30 shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.45)]"
          : "hover:bg-[color-mix(in_oklab,hsl(var(--foreground))_6%,transparent)]"
      }`}
    >
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-[color-mix(in_oklab,hsl(var(--foreground))_4%,transparent)] border border-[var(--glass-stroke-soft)]">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-muted-foreground">
            {label}
          </div>
        )}
      </div>
      <div className="w-full">
        <p
          className={`text-[11px] font-semibold leading-tight line-clamp-2 ${
            selected ? "text-primary" : "text-foreground"
          }`}
        >
          {label}
        </p>
        {caption ? (
          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{caption}</p>
        ) : null}
      </div>
    </button>
  );
}

// ─── Settings Sheet ─────────────────────────────────────────────────────────

function CameraConfigSheet({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: CinemaSettings;
  onChange: React.Dispatch<React.SetStateAction<CinemaSettings>>;
}) {
  const [tab, setTab] = useState<"camera" | "lens" | "focal" | "aperture">("camera");

  const update = (key: keyof CinemaSettings, val: any) =>
    onChange((p) => ({ ...p, [key]: val }));

  const tabs = [
    { id: "camera" as const, label: "Camera", value: settings.camera },
    { id: "lens" as const, label: "Lens", value: settings.lens },
    { id: "focal" as const, label: "Focal", value: `${settings.focal}mm` },
    { id: "aperture" as const, label: "Aperture", value: settings.aperture },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-3xl p-0 border-t border-[var(--glass-stroke)] bg-[var(--glass-bg-strong)] backdrop-blur-2xl flex flex-col"
        style={{ WebkitBackdropFilter: "var(--glass-blur)", backdropFilter: "var(--glass-blur)" }}
      >
        {/* Grab handle */}
        <div className="pt-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-foreground/15" />
        </div>
        <SheetHeader className="px-5 pt-2 pb-3 text-left">
          <SheetTitle className="text-lg font-bold">Camera Config</SheetTitle>
        </SheetHeader>

        {/* Tab pills */}
        <div className="px-4 pb-3">
          <div className="ios-glass rounded-full p-1 flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 px-1">
            Current: <span className="text-foreground font-medium">{tabs.find((x) => x.id === tab)?.value}</span>
          </p>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {tab === "camera" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CAMERAS.map((c) => (
                <OptionCard
                  key={c}
                  label={c}
                  imageUrl={ASSET_URLS[c]}
                  selected={settings.camera === c}
                  onClick={() => update("camera", c)}
                />
              ))}
            </div>
          )}
          {tab === "lens" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LENSES.map((l) => (
                <OptionCard
                  key={l}
                  label={l}
                  imageUrl={ASSET_URLS[l]}
                  selected={settings.lens === l}
                  onClick={() => update("lens", l)}
                />
              ))}
            </div>
          )}
          {tab === "focal" && (
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {FOCAL_LENGTHS.map((f) => {
                const active = settings.focal === f;
                return (
                  <button
                    key={f}
                    onClick={() => update("focal", f)}
                    className={`ios-glass flex flex-col items-center gap-1 rounded-2xl p-4 transition-all ${
                      active
                        ? "!border-primary/60 ring-1 ring-primary/30 text-primary"
                        : "text-foreground hover:bg-[color-mix(in_oklab,hsl(var(--foreground))_6%,transparent)]"
                    }`}
                  >
                    <span className="text-2xl font-bold tabular-nums">{f}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">mm</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {FOCAL_PERSPECTIVE[f]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {tab === "aperture" && (
            <div className="grid grid-cols-3 gap-2">
              {APERTURES.map((a) => (
                <OptionCard
                  key={a}
                  label={a}
                  imageUrl={ASSET_URLS[a]}
                  selected={settings.aperture === a}
                  onClick={() => update("aperture", a)}
                  caption={APERTURE_EFFECT[a]}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-5 pt-2 border-t border-[var(--glass-stroke-soft)]">
          <button
            onClick={() => onOpenChange(false)}
            className="w-full h-11 rounded-2xl bg-foreground text-background font-semibold text-sm shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.35)]"
          >
            Done
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Tiny pill dropdown ─────────────────────────────────────────────────────

function PillSelect<T extends string>({
  value,
  options,
  onChange,
  icon,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="ios-glass flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-foreground transition-colors hover:bg-[color-mix(in_oklab,hsl(var(--foreground))_6%,transparent)]"
      >
        {icon}
        <span>{value}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="ios-glass-strong absolute bottom-full mb-2 left-0 min-w-[110px] rounded-2xl shadow-[var(--glass-shadow)] p-1 z-50"
          >
            {options.map((o) => (
              <button
                key={o}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-xs font-semibold text-left rounded-xl transition-colors ${
                  o === value ? "text-primary bg-primary/10" : "text-foreground hover:bg-[color-mix(in_oklab,hsl(var(--foreground))_6%,transparent)]"
                }`}
              >
                {o}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Desktop Cinema Studio (Noir & Gold) ────────────────────────────────────

interface DesktopProps {
  settings: CinemaSettings;
  setSettings: React.Dispatch<React.SetStateAction<CinemaSettings>>;
  resolution: string;
  setResolution: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  uploadedImage: string | null;
  setUploadedImage: (v: string | null) => void;
  isUploadingImage: boolean;
  imageInputRef: React.RefObject<HTMLInputElement>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  history: HistoryEntry[];
  fullscreenUrl: string | null;
  setFullscreenUrl: (v: string | null) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  handleGenerate: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

function DesktopCinemaStudio({
  settings, setSettings, resolution, setResolution, duration, setDuration,
  uploadedImage, setUploadedImage, isUploadingImage, imageInputRef, handleImageUpload,
  history, fullscreenUrl, setFullscreenUrl, isGenerating, canGenerate, handleGenerate, navigate,
}: DesktopProps) {
  const [tab, setTab] = useState<"camera" | "lens" | "focal" | "aperture">("camera");
  const update = (key: keyof CinemaSettings, val: any) =>
    setSettings((p) => ({ ...p, [key]: val }));

  const tabs = [
    { id: "camera" as const, label: "Camera", value: settings.camera },
    { id: "lens" as const, label: "Lens", value: settings.lens },
    { id: "focal" as const, label: "Focal", value: `${settings.focal}mm` },
    { id: "aperture" as const, label: "Aperture", value: settings.aperture },
  ];

  const GOLD = "#c9a84c";
  const goldGrad = `linear-gradient(135deg, ${GOLD} 0%, #f0d78c 50%, ${GOLD} 100%)`;

  return (
    <div
      className="theme-fixed hidden md:flex h-full w-full relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 600px at 15% 0%, rgba(201,168,76,0.08), transparent 60%), radial-gradient(900px 500px at 85% 100%, rgba(201,168,76,0.05), transparent 60%), #0a0a0a",
      }}
    >
      {/* Film grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* ── LEFT RAIL — Camera config ── */}
      <aside className="relative z-10 w-[340px] shrink-0 h-full border-r border-white/[0.06] flex flex-col bg-black/40 backdrop-blur-xl">
        <div className="px-6 pt-6 pb-5 border-b border-white/[0.06]">
          <button
            onClick={() => navigate("/media")}
            className="text-[11px] uppercase tracking-[0.22em] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5 mb-5"
          >
            <ArrowLeft className="w-3 h-3" /> Media
          </button>
          <p
            className="text-[10px] uppercase tracking-[0.32em] text-white/40 mb-1.5"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "0.35em" }}
          >
            Reel №
          </p>
          <h1
            className="text-[40px] leading-[0.95] text-white"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
          >
            Cinema
          </h1>
          <div
            className="mt-2 h-px w-12"
            style={{ background: goldGrad }}
          />
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex gap-1 border-b border-white/[0.06]">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative px-2 pb-2.5 text-[11px] uppercase tracking-[0.18em] transition-colors"
                  style={{
                    color: active ? GOLD : "rgba(255,255,255,0.45)",
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    letterSpacing: "0.2em",
                  }}
                >
                  {t.label}
                  {active && (
                    <motion.span
                      layoutId="desk-tab-underline"
                      className="absolute left-0 right-0 -bottom-px h-px"
                      style={{ background: goldGrad }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p
            className="mt-3 text-[11px] text-white/55"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
          >
            <span className="text-white/30">— </span>
            {tabs.find((x) => x.id === tab)?.value}
          </p>
        </div>

        {/* Grids */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {tab === "camera" && (
            <div className="grid grid-cols-2 gap-2">
              {CAMERAS.map((c) => (
                <DeskOption
                  key={c} label={c} imageUrl={ASSET_URLS[c]}
                  selected={settings.camera === c}
                  onClick={() => update("camera", c)}
                />
              ))}
            </div>
          )}
          {tab === "lens" && (
            <div className="grid grid-cols-2 gap-2">
              {LENSES.map((l) => (
                <DeskOption
                  key={l} label={l} imageUrl={ASSET_URLS[l]}
                  selected={settings.lens === l}
                  onClick={() => update("lens", l)}
                />
              ))}
            </div>
          )}
          {tab === "focal" && (
            <div className="grid grid-cols-3 gap-2">
              {FOCAL_LENGTHS.map((f) => {
                const active = settings.focal === f;
                return (
                  <button
                    key={f}
                    onClick={() => update("focal", f)}
                    className="rounded-xl p-3 flex flex-col items-center gap-0.5 transition-all border"
                    style={{
                      borderColor: active ? `${GOLD}55` : "rgba(255,255,255,0.06)",
                      background: active ? `${GOLD}10` : "rgba(255,255,255,0.02)",
                      color: active ? GOLD : "white",
                    }}
                  >
                    <span className="text-xl font-bold tabular-nums" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>{f}</span>
                    <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">mm</span>
                    <span className="text-[9px] text-white/40 text-center leading-tight mt-0.5">
                      {FOCAL_PERSPECTIVE[f]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {tab === "aperture" && (
            <div className="grid grid-cols-3 gap-2">
              {APERTURES.map((a) => (
                <DeskOption
                  key={a} label={a} imageUrl={ASSET_URLS[a]}
                  selected={settings.aperture === a}
                  onClick={() => update("aperture", a)}
                  caption={APERTURE_EFFECT[a]}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── CENTER — Reel ── */}
      <main className="relative z-10 flex-1 h-full overflow-y-auto">
        {/* Header strip */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-10 py-5 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
          <div className="flex items-baseline gap-3">
            <span
              className="text-[11px] uppercase tracking-[0.32em] text-white/35"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              Take · {history.length.toString().padStart(2, "0")}
            </span>
            <span className="h-px w-8" style={{ background: goldGrad }} />
            <span
              className="text-[11px] uppercase tracking-[0.22em]"
              style={{ color: GOLD, fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              {settings.aspect_ratio} · {resolution} · {duration}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-white/35" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: isGenerating ? GOLD : "#3a3a3a" }} />
            {isGenerating ? "Rolling" : "Standby"}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="min-h-[calc(100%-80px)] flex flex-col items-center justify-center px-10 text-center">
            <p
              className="text-[12px] uppercase tracking-[0.4em] text-white/30 mb-6"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              — A Megsy Picture —
            </p>
            <h2
              className="text-[120px] leading-[0.88] text-white max-w-[900px]"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              Shoot it.
              <br />
              <span style={{ fontStyle: "italic", color: GOLD }}>in one shot.</span>
            </h2>
            <div className="mt-8 h-px w-24" style={{ background: goldGrad }} />
            <p
              className="mt-8 max-w-md text-[15px] text-white/55 leading-relaxed"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
            >
              Describe a scene. Dial in camera, lens, focal length & aperture.
              <br />
              We render the shot — in motion.
            </p>
          </div>
        ) : (
          <div className="px-10 py-6">
            <div className="grid grid-cols-3 gap-5">
              {history.map((entry, i) => (
                <motion.div
                  key={entry.timestamp}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.04 }}
                  className="group relative rounded-[3px] overflow-hidden border border-white/[0.08]"
                  style={{ boxShadow: "0 20px 60px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,168,76,0.02)" }}
                >
                  <button
                    onClick={() => setFullscreenUrl(entry.url)}
                    className="block w-full aspect-video bg-black"
                  >
                    <video
                      src={entry.url}
                      muted loop playsInline autoPlay
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span
                      className="text-[9px] uppercase tracking-[0.25em] px-2 py-0.5 border"
                      style={{ color: GOLD, borderColor: `${GOLD}55`, fontFamily: "'Instrument Serif', Georgia, serif" }}
                    >
                      Take {(history.length - i).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setFullscreenUrl(entry.url)}
                      className="w-7 h-7 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white/90 border border-white/10"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                    <a
                      href={entry.url} target="_blank" rel="noreferrer" download
                      className="w-7 h-7 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white/90 border border-white/10"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <p
                      className="text-[13px] text-white/95 leading-snug line-clamp-2 mb-1.5"
                      style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
                    >
                      "{entry.settings.prompt}"
                    </p>
                    <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-white/55" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
                      <span style={{ color: GOLD }}>{entry.settings.focal}mm</span>
                      <span className="text-white/20">·</span>
                      <span>{entry.settings.aperture}</span>
                      <span className="text-white/20">·</span>
                      <span>{entry.settings.aspect_ratio}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT RAIL — Composer ── */}
      <aside className="relative z-10 w-[400px] shrink-0 h-full border-l border-white/[0.06] flex flex-col bg-black/40 backdrop-blur-xl">
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <p
            className="text-[10px] uppercase tracking-[0.32em] text-white/40 mb-1.5"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            The Direction
          </p>
          <h2
            className="text-[28px] leading-none text-white"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
          >
            Write the scene.
          </h2>
        </div>

        {/* Reference image */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[10px] uppercase tracking-[0.28em] text-white/45"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              Reference Frame
            </span>
            {uploadedImage && (
              <button
                onClick={() => setUploadedImage(null)}
                className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={imageInputRef}
            type="file" className="hidden" accept="image/*"
            onChange={handleImageUpload}
          />
          {uploadedImage ? (
            <div className="relative rounded-sm overflow-hidden border border-white/10 aspect-video">
              <img src={uploadedImage} alt="Reference" className="w-full h-full object-cover" />
            </div>
          ) : (
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              className="w-full aspect-video rounded-sm border border-dashed border-white/15 hover:border-[color:var(--g)] transition-colors flex flex-col items-center justify-center gap-2 text-white/40 hover:text-white/80"
              style={{ ["--g" as any]: GOLD }}
            >
              {isUploadingImage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-[0.25em]" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
                    Upload still
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Prompt */}
        <div className="px-6 pt-5 flex-1 flex flex-col min-h-0">
          <span
            className="text-[10px] uppercase tracking-[0.28em] text-white/45 mb-2"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            Screenplay
          </span>
          <div className="flex-1 min-h-0 rounded-sm border border-white/10 bg-black/40 p-4 flex flex-col">
            <textarea
              value={settings.prompt}
              onChange={(e) => setSettings((p) => ({ ...p, prompt: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="A cinematic drone shot over fog-laced mountains at dawn…"
              className="flex-1 w-full bg-transparent text-white text-[15px] leading-relaxed outline-none resize-none placeholder:text-white/25"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", minHeight: "120px" }}
            />
            <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/25" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
              ⌘ + Enter to roll
            </p>
          </div>
        </div>

        {/* Settings row */}
        <div className="px-6 pt-4 pb-3 grid grid-cols-3 gap-2">
          {[
            { label: "Ratio", value: settings.aspect_ratio, options: ASPECT_RATIOS, onChange: (v: string) => update("aspect_ratio", v) },
            { label: "Length", value: duration, options: DURATIONS, onChange: setDuration },
            { label: "Res", value: resolution, options: RESOLUTIONS, onChange: setResolution },
          ].map((s) => (
            <DeskCycle key={s.label} label={s.label} value={s.value} options={s.options} onChange={s.onChange} gold={GOLD} />
          ))}
        </div>

        {/* Action */}
        <div className="px-6 pb-6 pt-2 border-t border-white/[0.06]">
          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -1 }}
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-14 rounded-sm relative overflow-hidden text-black font-semibold text-[13px] uppercase tracking-[0.3em] flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{
              background: goldGrad,
              fontFamily: "'Instrument Serif', Georgia, serif",
              boxShadow: "0 12px 40px -12px rgba(201,168,76,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
            }}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? "Rolling…" : "Action"}
          </motion.button>
          <p
            className="mt-3 text-center text-[10px] uppercase tracking-[0.28em] text-white/30"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            20 credits per take
          </p>
        </div>
      </aside>

      {/* Fullscreen preview */}
      <AnimatePresence>
        {fullscreenUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-8"
            onClick={() => setFullscreenUrl(null)}
          >
            <button
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setFullscreenUrl(null); }}
            >
              <X className="w-5 h-5" />
            </button>
            <motion.video
              initial={{ scale: 0.96 }} animate={{ scale: 1 }}
              src={fullscreenUrl} controls autoPlay loop playsInline
              className="max-w-full max-h-full rounded-sm object-contain shadow-2xl bg-black"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeskOption({
  label, imageUrl, selected, onClick, caption,
}: { label: string; imageUrl?: string; selected: boolean; onClick: () => void; caption?: string }) {
  const GOLD = "#c9a84c";
  return (
    <button
      onClick={onClick}
      className="group relative rounded-sm overflow-hidden text-left transition-all border"
      style={{
        borderColor: selected ? `${GOLD}55` : "rgba(255,255,255,0.06)",
        background: selected ? `${GOLD}08` : "rgba(255,255,255,0.02)",
      }}
    >
      <div className="aspect-square w-full overflow-hidden bg-black">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40">{label}</div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p
          className="text-[10px] leading-tight line-clamp-2"
          style={{
            color: selected ? GOLD : "rgba(255,255,255,0.85)",
            fontFamily: "'Instrument Serif', Georgia, serif",
          }}
        >
          {label}
        </p>
        {caption && (
          <p className="text-[9px] text-white/40 leading-tight line-clamp-1 mt-0.5">{caption}</p>
        )}
      </div>
    </button>
  );
}

function DeskCycle({
  label, value, options, onChange, gold,
}: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; gold: string }) {
  const cycle = () => {
    const i = options.indexOf(value);
    onChange(options[(i + 1) % options.length]);
  };
  return (
    <button
      onClick={cycle}
      className="rounded-sm border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors p-2.5 text-left"
    >
      <p
        className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-0.5"
        style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
      >
        {label}
      </p>
      <p
        className="text-[14px]"
        style={{ color: gold, fontFamily: "'Instrument Serif', Georgia, serif" }}
      >
        {value}
      </p>
    </button>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────


export default function CinemaStudioPage() {
  const PERSIST_KEY = "hg_cinema_studio_persistent";
  const navigate = useNavigate();
  const { userId, hasEnoughCredits, refreshCredits } = useCredits();

  const [settings, setSettings] = useState<CinemaSettings>({
    prompt: "",
    aspect_ratio: "16:9",
    camera: CAMERAS[0],
    lens: LENSES[0],
    focal: 35,
    aperture: "f/1.4",
  });
  const [resolution, setResolution] = useState<string>("1080p");
  const [duration, setDuration] = useState<string>("5s");
  const [configOpen, setConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const CREDITS_COST = 20;

  // Persistence
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.settings) setSettings(data.settings);
        if (data.resolution) setResolution(data.resolution);
        if (data.duration) setDuration(data.duration);
        if (data.history) setHistory(data.history);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify({ settings, resolution, duration, history }));
      } catch { /* noop */ }
    }, 400);
    return () => clearTimeout(t);
  }, [settings, resolution, duration, history]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setUploadedImage(dataUrl);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    setSettings((p) => ({ ...p, prompt: el.value }));
  };

  const handleGenerate = useCallback(async () => {
    const basePrompt = settings.prompt.trim();
    if (!basePrompt || isGenerating) return;
    if (userId && !hasEnoughCredits(CREDITS_COST)) {
      toast.error("Insufficient credits");
      return;
    }
    setIsGenerating(true);
    const finalPrompt = buildNanoBananaPrompt(
      basePrompt, settings.camera, settings.lens, settings.focal, settings.aperture,
    );
    try {
      const model = uploadedImage
        ? "fal-ai/kling-video/v2.1/master/image-to-video"
        : "fal-ai/kling-video/v2.1/master/text-to-video";
      const body: any = {
        prompt: finalPrompt,
        model,
        user_id: userId,
        credits_cost: CREDITS_COST,
        aspect_ratio: settings.aspect_ratio,
        duration: duration.replace("s", ""),
      };
      if (uploadedImage) body.image_url = uploadedImage;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const url: string | undefined = data.video_url;
      if (!url) throw new Error("No video returned");

      const entry: HistoryEntry = {
        url,
        timestamp: Date.now(),
        settings: { ...settings, prompt: basePrompt, resolution },
      };
      setHistory((prev) => [entry, ...prev].slice(0, 50));
      refreshCredits();
    } catch (e: any) {
      console.error(e);
      toast.error("Generation failed: " + (e?.message || "unknown"));
    } finally {
      setIsGenerating(false);
    }
  }, [settings, resolution, duration, isGenerating, uploadedImage, userId, hasEnoughCredits, refreshCredits]);

  const canGenerate = !!settings.prompt.trim() && !isGenerating;

  return (
    <AppLayout>
      {/* ─────────── DESKTOP — Noir & Gold cinema studio ─────────── */}
      <DesktopCinemaStudio
        settings={settings}
        setSettings={setSettings}
        resolution={resolution}
        setResolution={setResolution}
        duration={duration}
        setDuration={setDuration}
        uploadedImage={uploadedImage}
        setUploadedImage={setUploadedImage}
        isUploadingImage={isUploadingImage}
        imageInputRef={imageInputRef}
        handleImageUpload={handleImageUpload}
        history={history}
        fullscreenUrl={fullscreenUrl}
        setFullscreenUrl={setFullscreenUrl}
        isGenerating={isGenerating}
        canGenerate={canGenerate}
        handleGenerate={handleGenerate}
        navigate={navigate}
      />

      {/* ─────────── MOBILE / TABLET — original layout ─────────── */}
      <div className="md:hidden h-full flex flex-col bg-background relative overflow-hidden">
        {/* Ambient aurora backdrop */}
        <div className="ios-aurora" aria-hidden />

        {/* Floating back button */}
        <button
          onClick={() => navigate("/media")}
          className="ios-glass-strong absolute top-4 left-4 z-30 w-10 h-10 flex items-center justify-center rounded-full shadow-[var(--glass-shadow)]"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>


        {/* Scroll body */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-56">
          {history.length === 0 ? (
            <div className="min-h-full flex flex-col items-center justify-center text-center py-10">
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="font-display uppercase leading-[0.92] tracking-tight text-foreground text-[14vw]"
              >
                SHOOT IT.<br />
                <span className="text-primary">IN ONE SHOT.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="mt-4 max-w-xs text-sm text-muted-foreground"
              >
                Describe a scene. Dial in camera, lens, focal length & aperture. We render the shot — in motion.
              </motion.p>
            </div>
          ) : (
            <>
              <div className="px-1 pt-2 pb-3 flex items-baseline justify-between">
                <h2 className="font-display uppercase tracking-tight text-2xl leading-none">
                  Your <span className="text-primary">Reel</span>
                </h2>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {history.length} {history.length === 1 ? "shot" : "shots"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {history.map((entry, i) => (
                  <motion.div
                    key={entry.timestamp}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 6) * 0.04 }}
                    className="ios-card group relative"
                  >
                    <button
                      onClick={() => setFullscreenUrl(entry.url)}
                      className="block w-full aspect-[3/4] bg-black"
                    >
                      <video
                        src={entry.url}
                        muted
                        loop
                        playsInline
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setFullscreenUrl(entry.url)}
                        className="ios-fab p-1.5 rounded-full text-foreground"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="ios-fab p-1.5 rounded-full text-foreground"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-2.5 space-y-1">
                      <p className="text-[11px] text-white/90 line-clamp-2 leading-snug drop-shadow">
                        {entry.settings.prompt}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-semibold text-primary-foreground px-1.5 py-0.5 bg-primary/80 rounded-full">
                          {entry.settings.focal}mm
                        </span>
                        <span className="text-[10px] text-white/70 px-1.5 py-0.5 bg-white/10 rounded-full backdrop-blur">
                          {entry.settings.aperture}
                        </span>
                        <span className="text-[10px] text-white/70 ml-auto">
                          {entry.settings.aspect_ratio}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom prompt bar — floating glass */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="pointer-events-auto space-y-2">
            {/* Camera summary card */}
            <button
              onClick={() => setConfigOpen(true)}
              className="ios-glass-strong w-full flex items-center gap-2 px-3 py-2 rounded-2xl transition-colors hover:bg-[color-mix(in_oklab,hsl(var(--foreground))_4%,transparent)] shadow-[var(--glass-shadow)]"
            >
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                  {settings.camera}
                </p>
                <p className="text-xs font-semibold text-foreground truncate">
                  {settings.lens} · {settings.focal}mm · {settings.aperture}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
            </button>

            <div className="ios-glass-strong rounded-3xl shadow-[var(--glass-shadow)]">
              {uploadedImage && (
                <div className="px-3 pt-3 relative inline-block">
                  <img
                    src={uploadedImage}
                    alt="Reference"
                    className="h-14 w-14 object-cover rounded-xl border border-[var(--glass-stroke)]"
                  />
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="absolute -right-1 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="px-3 pt-3 pb-1">
                <textarea
                  ref={textareaRef}
                  value={settings.prompt}
                  onChange={(e) => setSettings((p) => ({ ...p, prompt: e.target.value }))}
                  onInput={handleTextareaInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="Describe your cinema shot in motion..."
                  rows={1}
                  className="min-h-[36px] max-h-[160px] w-full bg-transparent text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="flex items-center gap-2 px-3 pb-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="ios-glass shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
                  aria-label="Attach reference"
                >
                  {isUploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4" />
                  )}
                </button>
                <PillSelect
                  value={settings.aspect_ratio}
                  options={ASPECT_RATIOS}
                  onChange={(v) => setSettings((p) => ({ ...p, aspect_ratio: v }))}
                />
                <PillSelect value={duration} options={DURATIONS} onChange={setDuration} />
                <div className="flex-1" />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="shrink-0 h-9 px-4 rounded-full bg-foreground text-background text-xs font-semibold flex items-center gap-1.5 disabled:opacity-30 transition-all shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.35)]"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isGenerating ? "Shooting" : "Shoot"}
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Fullscreen preview */}
        <AnimatePresence>
          {fullscreenUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4"
              onClick={() => setFullscreenUrl(null)}
            >
              <button
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-accent text-foreground flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenUrl(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
              <motion.video
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                src={fullscreenUrl}
                controls
                autoPlay
                loop
                playsInline
                className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl bg-black"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <CameraConfigSheet
          open={configOpen}
          onOpenChange={setConfigOpen}
          settings={settings}
          onChange={setSettings}
        />
      </div>
    </AppLayout>
  );
}
