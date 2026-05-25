import SEOHead from "@/components/common/SEOHead";
import { useState, useEffect, useRef, type CSSProperties } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { supabase } from "@/integrations/supabase/client";
import { FalModelPickerSheet } from "@/components/fal-models/FalModelPickerSheet";
import { useFalImageModels, useFalVideoModels } from "@/hooks/useFalModels";
import type { ShowcaseItem } from "@/components/showcase/ShowcaseGrid";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "sonner";
import { Loader2, Check, ImagePlus as ImagePlusIcon } from "lucide-react";
import { NavHomeIcon, NavStudioIcon, NavDiscoverIcon } from "@/components/media/ModernNavIcons";
import AnimatedHeadline from "@/components/research/AnimatedHeadline";
import CachedMediaImage, { preloadMediaImage } from "@/components/media/CachedMediaImage";
import {
  DEMO_IMAGE_TEMPLATES,
  DEMO_VIDEO_TEMPLATES,
  TEMPLATE_CATEGORIES,
} from "@/data/mediaTemplates";

// iOS-style icon: photo with a + badge
import {
  MenuIcon,
  PlusIcon,
  CloseIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  
  GridHomeIcon,
  WandStudioIcon,
  CompassIcon,
  SettingsGearIcon,
  ToolBrushIcon,
  ToolShirtIcon,
  ToolPersonIcon,
  ToolFacesIcon,
  ToolEraseIcon,
  ToolPaletteIcon,
  ToolSparklesIcon,
  ToolScissorsIcon,
  ToolPencilIcon,
  ToolBulbIcon,
  ToolMaskIcon,
  ToolFilmIcon,
  ToolHairIcon,
  ToolAvatarIcon,
  ToolBoxIcon,
  ToolLogoIcon,
  ToolPerspectiveIcon,
  ToolMicIcon,
  ToolUpscaleIcon,
  ToolCaptionIcon,
  ToolExtendIcon,
  ToolGreenScreenIcon,
  ToolWatermarkIcon,
  ToolNoiseIcon,
  ToolThumbIcon,
  ToolGridIcon,
} from "@/components/media/MediaIcons";

type Mode = "image" | "video";
type Tab = "home" | "studio" | "community";
type IconCmp = (p: { className?: string; strokeWidth?: number }) => JSX.Element;





const PLACEHOLDERS: Record<Mode, string[]> = {
  image: [
    "Type a prompt…",
    "A futuristic city at sunset, cyberpunk style…",
    "Portrait lit by golden hour…",
    "Anime girl in a magical forest…",
  ],
  video: [
    "Type a prompt…",
    "A cinematic drone shot over mountains…",
    "A cat playing piano in slow motion…",
    "Anime fight scene with epic effects…",
  ],
};

type Tool = { id: string; name: string; route: string; Icon: IconCmp; desc: string };

const IMAGE_TOOLS_LIST: Tool[] = [
  { id: "inpaint", name: "Inpaint", route: "/images/tools/inpaint", Icon: ToolBrushIcon, desc: "Edit parts of an image" },
  { id: "clothes-changer", name: "Clothes", route: "/images/tools/clothes-changer", Icon: ToolShirtIcon, desc: "Change outfits instantly" },
  { id: "headshot", name: "Headshot", route: "/images/tools/headshot", Icon: ToolPersonIcon, desc: "Studio-quality portraits" },
  { id: "face-swap", name: "Face Magic", route: "/images/tools/face-swap", Icon: ToolFacesIcon, desc: "Swap faces in photos" },
  { id: "bg-remover", name: "BG Remove", route: "/images/tools/bg-remover", Icon: ToolEraseIcon, desc: "Clean background removal" },
  { id: "cartoon", name: "Cartoon", route: "/images/tools/cartoon", Icon: ToolMaskIcon, desc: "Cartoonify your photo" },
  { id: "colorizer", name: "Colorize", route: "/images/tools/colorizer", Icon: ToolPaletteIcon, desc: "Color B&W photos" },
  { id: "retouching", name: "Retouch", route: "/images/tools/retouching", Icon: ToolSparklesIcon, desc: "Polish & enhance" },
  { id: "remover", name: "Remove", route: "/images/tools/remover", Icon: ToolScissorsIcon, desc: "Remove unwanted objects" },
  { id: "sketch-to-image", name: "Sketch", route: "/images/tools/sketch-to-image", Icon: ToolPencilIcon, desc: "Sketch to image" },
  { id: "relight", name: "Relight", route: "/images/tools/relight", Icon: ToolBulbIcon, desc: "Change lighting & mood" },
  { id: "character-swap", name: "Character", route: "/images/tools/character-swap", Icon: ToolAvatarIcon, desc: "Swap characters" },
  { id: "storyboard", name: "Storyboard", route: "/images/tools/storyboard", Icon: ToolFilmIcon, desc: "Cinematic panels" },
  { id: "hair-changer", name: "Hair", route: "/images/tools/hair-changer", Icon: ToolHairIcon, desc: "Try new hairstyles" },
  { id: "avatar-generator", name: "Avatar", route: "/images/tools/avatar-generator", Icon: ToolAvatarIcon, desc: "Personal AI avatars" },
  { id: "product-photo", name: "Product", route: "/images/tools/product-photo", Icon: ToolBoxIcon, desc: "Pro product shots" },
  { id: "logo-generator", name: "Logo", route: "/images/tools/logo-generator", Icon: ToolLogoIcon, desc: "Design unique logos" },
  { id: "perspective-correction", name: "Perspective", route: "/images/tools/perspective-correction", Icon: ToolPerspectiveIcon, desc: "Fix tilted angles" },
];

const VIDEO_TOOLS_LIST: Tool[] = [
  { id: "talking-photo", name: "Talking", route: "/videos/tools/talking-photo", Icon: ToolAvatarIcon, desc: "Animate a photo" },
  { id: "upscale", name: "Upscale", route: "/videos/tools/upscale", Icon: ToolUpscaleIcon, desc: "Boost resolution" },
  { id: "auto-caption", name: "Caption", route: "/videos/tools/auto-caption", Icon: ToolCaptionIcon, desc: "Auto subtitles" },
  { id: "lip-sync", name: "Voice Sync", route: "/videos/tools/lip-sync", Icon: ToolMicIcon, desc: "Sync lip motion to your voice" },
  { id: "video-extender", name: "Extend", route: "/videos/tools/video-extender", Icon: ToolExtendIcon, desc: "Extend video length" },
  { id: "green-screen", name: "Green", route: "/videos/tools/green-screen", Icon: ToolGreenScreenIcon, desc: "Pro green screen" },
  { id: "video-watermark", name: "Watermark", route: "/videos/tools/video-watermark", Icon: ToolWatermarkIcon, desc: "Add watermark" },
  { id: "video-intro", name: "Intro", route: "/videos/tools/video-intro", Icon: ToolFilmIcon, desc: "Cinematic intros" },
  { id: "thumbnail-generator", name: "Thumbnail", route: "/videos/tools/thumbnail-generator", Icon: ToolThumbIcon, desc: "Stunning thumbnails" },
];

// Templates are loaded from `showcase_items` via Telegram bot uploads.
const MOCK_FEATURED_IMAGES: any[] = [];
const MOCK_FEATURED_VIDEOS: any[] = [];

const modeFromPath = (p: string): Mode => (p.startsWith("/videos") ? "video" : "image");

const TOOL_IMAGES: Record<string, string> = {
  "inpaint": new URL("@/assets/tool-landing/inpaint.webp", import.meta.url).href,
  "clothes-changer": new URL("@/assets/tool-landing/clothes-changer.webp", import.meta.url).href,
  "headshot": new URL("@/assets/tool-landing/headshot.webp", import.meta.url).href,
  "face-swap": new URL("@/assets/tool-landing/face-swap.webp", import.meta.url).href,
  "bg-remover": new URL("@/assets/tool-landing/bg-remover.webp", import.meta.url).href,
  "cartoon": new URL("@/assets/tool-landing/cartoon.webp", import.meta.url).href,
  "colorizer": new URL("@/assets/tool-landing/colorizer.webp", import.meta.url).href,
  "retouching": new URL("@/assets/tool-landing/retouching.webp", import.meta.url).href,
  "remover": new URL("@/assets/tool-landing/remover.webp", import.meta.url).href,
  "sketch-to-image": new URL("@/assets/tool-landing/sketch-to-image.webp", import.meta.url).href,
  "relight": new URL("@/assets/tool-landing/relight.webp", import.meta.url).href,
  "character-swap": new URL("@/assets/tool-landing/character-swap.webp", import.meta.url).href,
  "storyboard": new URL("@/assets/tool-landing/storyboard.webp", import.meta.url).href,
  "hair-changer": new URL("@/assets/tool-landing/hair-changer.webp", import.meta.url).href,
  "avatar-generator": new URL("@/assets/tool-landing/avatar-generator.webp", import.meta.url).href,
  "product-photo": new URL("@/assets/tool-landing/product-photo.webp", import.meta.url).href,
  "logo-generator": new URL("@/assets/tool-landing/logo-generator.webp", import.meta.url).href,
  "perspective-correction": new URL("@/assets/tool-landing/perspective-correction.webp", import.meta.url).href,
  "swap-characters": new URL("@/assets/tool-landing/video-swap-v9.webp", import.meta.url).href,
  "talking-photo": new URL("@/assets/tool-landing/talking-photo-v9.webp", import.meta.url).href,
  "upscale": new URL("@/assets/tool-landing/video-upscale-v9.webp", import.meta.url).href,
  "auto-caption": new URL("@/assets/tool-landing/auto-caption-v9.webp", import.meta.url).href,
  "lip-sync": new URL("@/assets/tool-landing/lip-sync-v9.webp", import.meta.url).href,
  "video-extender": new URL("@/assets/tool-landing/video-extender-v9.webp", import.meta.url).href,
  "green-screen": new URL("@/assets/tool-landing/green-screen-v9.webp", import.meta.url).href,
  "video-colorizer": new URL("@/assets/tool-landing/video-colorizer-v9.webp", import.meta.url).href,
  "video-watermark": new URL("@/assets/tool-landing/video-watermark-v9.webp", import.meta.url).href,
  "video-bg-replacer": new URL("@/assets/tool-landing/video-bg-replacer-v9.webp", import.meta.url).href,
  "video-intro": new URL("@/assets/tool-landing/video-intro-v9.webp", import.meta.url).href,
  "video-denoise": new URL("@/assets/tool-landing/video-denoise-v9.webp", import.meta.url).href,
  "thumbnail-generator": new URL("@/assets/tool-landing/thumbnail-generator-v9.webp", import.meta.url).href,
};

const ToolCard = ({
  tool,
  idx,
  image,
  onClick,
  variant = "scroll",
}: {
  tool: Tool;
  idx: number;
  image?: string;
  onClick: () => void;
  variant?: "scroll" | "grid";
}) => {
  const isGrid = variant === "grid";
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`group relative overflow-hidden rounded-2xl bg-foreground/[0.04] ring-1 ring-foreground/[0.08] hover:ring-foreground/25 transition-all text-left shrink-0 ${
        isGrid ? "w-full" : "w-[180px]"
      }`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {image ? (
          <CachedMediaImage
            src={image}
            alt={tool.name}
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/10 to-foreground/[0.02] flex items-center justify-center">
            <tool.Icon className="w-10 h-10 text-foreground/60" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="text-[13.5px] font-semibold leading-tight drop-shadow-sm" style={{ color: 'white' }}>{tool.name}</div>
          <div className="text-[11px] font-medium leading-snug mt-1 line-clamp-2 drop-shadow-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{tool.desc}</div>
        </div>
      </div>
    </motion.button>
  );
};


const MediaHubPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(modeFromPath(location.pathname));
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [prompt, setPrompt] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { models: falImageModels } = useFalImageModels();
  const { models: falVideoModels } = useFalVideoModels();
  const [imageModelSlug, setImageModelSlug] = useState<string | null>(null);
  const [videoModelSlug, setVideoModelSlug] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  useEffect(() => {
    if (!imageModelSlug && falImageModels.length) {
      setImageModelSlug((falImageModels.find(m => m.is_featured) ?? falImageModels[0]).slug);
    }
  }, [falImageModels, imageModelSlug]);
  useEffect(() => {
    if (!videoModelSlug && falVideoModels.length) {
      setVideoModelSlug((falVideoModels.find(m => m.is_featured) ?? falVideoModels[0]).slug);
    }
  }, [falVideoModels, videoModelSlug]);

  const currentModel = mode === "image"
    ? falImageModels.find(m => m.slug === imageModelSlug)
    : falVideoModels.find(m => m.slug === videoModelSlug);
  const [attached, setAttached] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const [imageShowcase, setImageShowcase] = useState<ShowcaseItem[]>([]);
  const [videoShowcase, setVideoShowcase] = useState<ShowcaseItem[]>([]);
  const [studioItems, setStudioItems] = useState<any[]>([]);
  const [communityItems, setCommunityItems] = useState<ShowcaseItem[]>([]);
  const [communityCategory, setCommunityCategory] = useState<string>("All");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAllTools, setShowAllTools] = useState(false);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSub, setSettingsSub] = useState<null | "aspect" | "style" | "duration" | "improve">(null);
  const [imgAspect, setImgAspect] = useState("1:1");
  const [imgStyle, setImgStyle] = useState("Dynamic");
  const [vidAspect, setVidAspect] = useState("16:9");
  const [vidDuration, setVidDuration] = useState("6s");
  const [improveText, setImproveText] = useState("");
  const [improving, setImproving] = useState(false);
  
  const { credits } = useCredits();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeTab]);

  // Sync aspect / duration defaults to the selected model
  useEffect(() => {
    const m: any = currentModel;
    if (!m) return;
    if (mode === "image") {
      if (m.default_aspect && !m.supported_aspects?.includes(imgAspect)) setImgAspect(m.default_aspect);
    } else {
      if (m.default_aspect && !m.supported_aspects?.includes(vidAspect)) setVidAspect(m.default_aspect);
      if (m.default_duration && !m.supported_durations?.map((d: number) => `${d}s`).includes(vidDuration)) {
        setVidDuration(`${m.default_duration}s`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageModelSlug, videoModelSlug, mode]);


  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: Event) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
        setSettingsSub(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    setMode(modeFromPath(location.pathname));
  }, [location.pathname]);

  // Receive reused prompt or tab from template preview page
  useEffect(() => {
    const state = location.state as { reusePrompt?: string; tab?: Tab; attachedImage?: string } | null;
    const reuse = state?.reusePrompt;
    const tab = state?.tab;
    const att = state?.attachedImage;
    if (reuse) {
      setPrompt(reuse);
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
    if (att) setAttached(att);
    if (tab) setActiveTab(tab);
    if (reuse || tab || att) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    setPhIdx(0);
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS[mode].length), 3500);
    return () => clearInterval(id);
  }, [mode]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [prompt]);

  useEffect(() => {
    // Hydrate showcase from cache. Only refetch if cache is missing or stale (>7d).
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
    let hasFreshCache = false;
    try {
      const raw = localStorage.getItem("megsy_cache_showcase_v1");
      const tsRaw = localStorage.getItem("megsy_cache_showcase_v1_ts");
      if (raw) {
        const items = JSON.parse(raw) as ShowcaseItem[];
        const imgs = items.filter((i) => i.media_type !== "video").slice(0, 12);
        const vids = items.filter((i) => i.media_type === "video").slice(0, 12);
        if (imgs.length) setImageShowcase(imgs as any);
        if (vids.length) setVideoShowcase(vids as any);
        const ts = tsRaw ? parseInt(tsRaw, 10) : 0;
        if (items.length && Date.now() - ts < CACHE_TTL) hasFreshCache = true;
      }
    } catch {}

    if (hasFreshCache) return;

    (async () => {
      const { data } = await supabase
        .from("showcase_items" as any)
        .select("*")
        .order("is_trending", { ascending: false })
        .order("trending_at", { ascending: false, nullsFirst: false })
        .order("display_order", { ascending: true })
        .limit(60);
      const items = (data as any as ShowcaseItem[]) || [];
      const imgs = items.filter((i) => i.media_type !== "video").slice(0, 12);
      const vids = items.filter((i) => i.media_type === "video").slice(0, 12);
      setImageShowcase(imgs as any);
      setVideoShowcase(vids as any);
      try {
        localStorage.setItem("megsy_cache_showcase_v1", JSON.stringify(items));
        localStorage.setItem("megsy_cache_showcase_v1_ts", Date.now().toString());
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const urls = [
      ...Object.values(TOOL_IMAGES),
      ...imageShowcase.map((item) => (item as any).media_url),
      ...videoShowcase.map((item) => (item as any).thumbnail_url || (item as any).media_url),
      ...communityItems.slice(0, 48).map((item: any) => item.thumbnail_url || item.media_url),
    ].filter(Boolean) as string[];

    urls.forEach((url) => preloadMediaImage(url));
  }, [imageShowcase, videoShowcase, communityItems]);

  useEffect(() => {
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
    if (activeTab === "studio") {
      try {
        const c = localStorage.getItem("megsy_cache_studio_v1");
        if (c) setStudioItems(JSON.parse(c));
      } catch {}
      // Studio is user-specific, always refresh
      loadStudio();
    }
    if (activeTab === "community") {
      let hasFresh = false;
      try {
        const c = localStorage.getItem("megsy_cache_community_v1");
        const tsRaw = localStorage.getItem("megsy_cache_community_v1_ts");
        if (c) {
          const parsed = JSON.parse(c);
          setCommunityItems(parsed);
          const ts = tsRaw ? parseInt(tsRaw, 10) : 0;
          if (parsed.length && Date.now() - ts < CACHE_TTL) hasFresh = true;
        }
      } catch {}
      if (!hasFresh) loadCommunity();
    }
  }, [activeTab]);

  const loadStudio = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setStudioItems([]);
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .in("mode", ["images", "videos"]);
    if (!convs?.length) return setStudioItems([]);
    const ids = convs.map((c) => c.id);
    const { data } = await supabase
      .from("messages")
      .select("content, images, created_at")
      .eq("role", "assistant")
      .not("images", "is", null)
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return;
    const items = data.flatMap((m: any) =>
      (m.images || []).map((url: string) => {
        const isVid = url.includes(".mp4") || url.includes("video");
        return {
          url,
          type: isVid ? "video" : "image",
          prompt: (m.content || "").slice(0, 200),
          created_at: m.created_at,
        };
      }),
    );
    setStudioItems(items);
    try { localStorage.setItem("megsy_cache_studio_v1", JSON.stringify(items)); } catch {}
  };

  const loadCommunity = async () => {
    const { data } = await supabase
      .from("showcase_items" as any)
      .select("*")
      .in("media_type", ["image", "video"])
      .order("is_trending", { ascending: false })
      .order("trending_at", { ascending: false, nullsFirst: false })
      .order("display_order", { ascending: true })
      .limit(120);
    const dbItems = ((data as any[]) || []).map((it) => ({ ...it, category: it.category || "All" }));
    setCommunityItems(dbItems as any);
    try {
      localStorage.setItem("megsy_cache_community_v1", JSON.stringify(dbItems));
      localStorage.setItem("megsy_cache_community_v1_ts", Date.now().toString());
    } catch {}
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setShowAllTools(false);
    const target = m === "image" ? "/images" : "/videos";
    if (location.pathname !== target) navigate(target, { replace: true });
  };

  
  const tools = mode === "image" ? IMAGE_TOOLS_LIST : VIDEO_TOOLS_LIST;
  const showcase = mode === "image" ? imageShowcase : videoShowcase;

  const handleGenerate = () => {
    const p = prompt.trim();
    if (!p && !attached) return;
    if (mode === "image") {
      navigate("/images/studio", { state: { prompt: p, attachedImage: attached, modelSlug: imageModelSlug } });
    } else {
      navigate("/videos/studio", { state: { prompt: p, attachedImage: attached, modelSlug: videoModelSlug } });
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setAttached(r.result as string);
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const canGenerate = !!(prompt.trim() || attached);

  const [sidebarCollapsed] = useSidebarCollapsed();

  const seoTitle = mode === "image" ? "Image Hub" : mode === "video" ? "Video Hub" : "Media Hub";
  const seoDesc = mode === "image"
    ? "Generate, edit and organize AI images. Browse community showcases and jump into the Image Studio."
    : mode === "video"
    ? "Generate AI videos, browse cinematic showcases and launch the Video Studio."
    : "All your AI-generated images and videos in one hub — generate, browse and manage media.";
  const seoPath = mode === "image" ? "/images" : mode === "video" ? "/videos" : "/media";
  return (
    <>
    <SEOHead title={seoTitle} description={seoDesc} path={seoPath} noindex />
    <div className="h-[100dvh] flex bg-background overflow-hidden">
      {/* Desktop persistent sidebar — same as chat */}
      <aside
        style={{ width: sidebarCollapsed ? 60 : 280 }}
        className="hidden md:flex shrink-0 overflow-hidden border-r border-border/70 bg-sidebar transition-[width] duration-200 ease-out"
      >
        <AppSidebar
          inline
          open
          onClose={() => {}}
          onNewChat={() => {}}
          currentMode={mode === "image" ? "images" : "videos"}
        />
      </aside>

      {/* Mobile drawer sidebar */}
      <div className="md:hidden">
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewChat={() => {}}
          currentMode={mode === "image" ? "images" : "videos"}
        />
      </div>

      <div
        className="flex-1 min-w-0 flex flex-col relative overflow-hidden"
        style={{
          ['--primary' as any]: '252 88% 64%',
          ['--primary-foreground' as any]: '0 0% 100%',
          background: 'hsl(var(--background))',
        }}
      >
        {/* Single subtle ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] rounded-full opacity-25 blur-[120px]"
          style={{
            background:
              'radial-gradient(ellipse at center, hsl(252 80% 50% / 0.35) 0%, hsl(270 70% 40% / 0.15) 40%, transparent 70%)',
          }}
        />




        {/* Mobile top bar — hidden on desktop */}
        <div className="md:hidden relative z-30 flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="ios-fab w-11 h-11 rounded-full flex items-center justify-center text-foreground"
            aria-label="Open menu"
          >
            <ChevronRightIcon className="w-[22px] h-[22px] mobile-header-icon-black" strokeWidth={2.25} />
          </button>

          <div />

          <button
            onClick={() => navigate("/pricing")}
            className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.1] border border-foreground/[0.08] text-[12.5px] font-semibold text-foreground transition-colors"
            aria-label="Credits"
          >
            <span className="text-indigo-300 text-[13px] leading-none">✦</span>
            <span className="tabular-nums">{credits ?? "—"}</span>
          </button>
        </div>

        {/* Desktop secondary tab strip — clean horizontal pills */}
        <div className="hidden md:flex items-center justify-center pt-6 pb-1 relative z-20">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-foreground/[0.04] border border-foreground/[0.06]">
            {[
              { key: "home" as Tab, label: "Home" },
              { key: "studio" as Tab, label: "Studio" },
              { key: "community" as Tab, label: "Discover" },
            ].map(({ key, label }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`relative flex items-center gap-2 px-5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto pb-28 md:pb-12">
          <div className="md:max-w-[1240px] md:mx-auto md:px-8">
          {activeTab === "home" && (
            <>
              {/* Hero — clean editorial on desktop, compact on mobile */}
              <div className="px-5 pt-8 pb-5 relative md:px-0 md:pt-20 md:pb-10 md:text-center">
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="text-[34px] font-semibold leading-[1.05] tracking-[-0.025em] text-foreground md:text-[64px] md:tracking-[-0.035em]"
                >
                  What will you{" "}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={mode}
                      initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="inline-block italic font-normal text-foreground/95 md:!text-[72px]"
                      style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "40px", lineHeight: "1" }}
                    >
                      {mode === "image" ? "create" : "direct"}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-foreground/40">?</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="mt-2.5 text-[13.5px] leading-relaxed text-foreground/55 md:mt-5 md:text-[16px]"
                >
                  {mode === "image"
                    ? "Premium image models. One prompt away."
                    : "Cinematic video models. Ready to direct."}
                </motion.p>
              </div>


              <div className="px-4 relative z-40 md:px-0 md:max-w-[820px] md:mx-auto">
                <div className="rounded-[22px] p-[1px] bg-gradient-to-b from-foreground/[0.12] to-foreground/[0.04] md:rounded-[26px]">
                <div ref={settingsRef} className="bg-card rounded-[21px] p-2.5 relative z-40 border border-foreground/[0.02] md:rounded-[25px] md:p-3.5">
                  {attached && (
                    <div className="mb-2 inline-flex items-center gap-1.5 ios26-chip !pl-1 !py-1">
                      <img src={attached} alt="" className="w-6 h-6 rounded-full object-cover" />
                      <button
                        onClick={() => setAttached(null)}
                        className="text-foreground/70 hover:text-foreground pr-1.5"
                      >
                        <CloseIcon className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="relative flex items-start gap-2 px-1 pt-1 pb-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-10 h-10 flex items-center justify-center rounded-2xl ios26-glass text-foreground/85 hover:text-foreground transition-colors"
                      aria-label="Attach image"
                    >
                      <ImagePlusIcon className="w-[20px] h-[20px]" />
                    </button>
                    <div className="relative flex-1 min-w-0">
                      <AnimatePresence mode="wait">
                        {!prompt && (
                          <motion.span
                            key={phIdx}
                            initial={false}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35 }}
                            className="pointer-events-none absolute left-2 top-2.5 text-sm font-medium text-muted-foreground"
                          >
                            {PLACEHOLDERS[mode][phIdx]}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={1}
                        className="block w-full max-w-full bg-transparent outline-none resize-none text-sm text-foreground placeholder:text-transparent px-2 py-2 overflow-y-auto break-words"
                        style={{ wordBreak: "break-word", maxHeight: "140px" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerate();
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Bottom controls */}
                  <div className="flex items-center justify-between gap-y-2 gap-x-2 flex-wrap min-w-0">
                    {/* Mode pill — text only. Cinema only when video is active */}
                    <div className="relative ios26-glass rounded-full p-1 flex items-center shrink-0 max-w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {(["image", "video", ...(mode === "video" ? ["cinema" as const] : [])] as const).map((m) => {
                        const active = m !== "cinema" && mode === m;
                        return (
                          <button
                            key={m}
                            onClick={() => {
                              if (m === "cinema") navigate("/cinema");
                              else switchMode(m as Mode);
                            }}
                            className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors duration-300 ${
                              active ? "text-primary-foreground" : "text-foreground/60 hover:text-foreground"
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="hub-mode-bg"
                                transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.7 }}
                                className="absolute inset-0 rounded-full overflow-hidden"
                                style={{
                                  background:
                                    "linear-gradient(180deg, color-mix(in oklab, hsl(var(--primary)) 92%, white 8%), hsl(var(--primary)))",
                                  boxShadow:
                                    "inset 0 1px 0 color-mix(in oklab, white 28%, transparent), 0 6px 18px -6px hsl(var(--primary) / 0.55)",
                                }}
                              >
                                <motion.span
                                  aria-hidden
                                  className="absolute inset-y-0 -left-1/2 w-1/2"
                                  initial={{ x: 0 }}
                                  animate={{ x: "300%" }}
                                  transition={{ duration: 1.1, ease: "easeOut" }}
                                  style={{
                                    background:
                                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                                    filter: "blur(6px)",
                                  }}
                                />
                              </motion.span>
                            )}
                            <span className="relative">
                              {m === "image" ? "Image" : m === "video" ? "Video" : "Cinema"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      <button
                        ref={settingsBtnRef}
                        onClick={() => {
                          setSettingsOpen((v) => !v);
                          setSettingsSub(null);
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-2xl ios26-glass text-foreground/80 hover:text-foreground transition-colors ${settingsOpen ? "ring-1 ring-primary/40" : ""}`}
                        aria-label="Settings"
                      >
                        <SettingsGearIcon className="w-[18px] h-[18px]" />
                      </button>
                      <button
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        className="ios26-button h-10 px-4 rounded-full text-xs flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                        Generate
                      </button>
                    </div>
                  </div>


                  {/* Inline settings panel — opens inside the card */}
                  <AnimatePresence>
                    {settingsOpen && (
                      <motion.div
                        key="settings-pop"
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute left-0 right-0 top-full mt-2 z-50"
                      >
                        <div className="bg-popover/85 backdrop-blur-3xl backdrop-saturate-200 border border-border rounded-3xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.08),0_20px_60px_-20px_hsl(var(--foreground)/0.35)] p-2 max-h-[65vh] overflow-y-auto">
                          <AnimatePresence mode="wait" initial={false}>
                          {(() => {
                            const m: any = currentModel;
                            const modelAspects: string[] = m?.supported_aspects ?? (mode === "image"
                              ? ["1:1", "2:3", "3:2", "4:3", "4:5", "16:9", "9:16"]
                              : ["1:1", "16:9", "9:16"]);
                            const modelDurations: number[] = m?.supported_durations ?? [6, 10];
                            const modelRow = {
                              key: "model" as const,
                              label: "Model",
                              value: currentModel?.display_name ?? "—",
                            };
                            const rows = mode === "image"
                              ? [
                                  modelRow,
                                  { key: "aspect" as const, label: "Aspect Ratio", value: imgAspect },
                                  { key: "style" as const, label: "Style", value: imgStyle },
                                  { key: "improve" as const, label: "Improve Your Prompt", value: "" },
                                ]
                              : [
                                  modelRow,
                                  { key: "aspect" as const, label: "Aspect Ratio", value: vidAspect },
                                  { key: "duration" as const, label: "Duration", value: vidDuration },
                                  { key: "improve" as const, label: "Improve Your Prompt", value: "" },
                                ];
                            const subOptions: Record<string, string[]> = {
                              aspect: modelAspects,
                              style: ["Cinematic", "Creative", "Dynamic", "Fashion", "Portrait", "Stock Photo", "Vibrant", "None"],
                              duration: modelDurations.map(d => `${d}s`),
                            };



                            // Inline IMPROVE WITH AI
                            if (settingsSub === "improve") {
                              const runImprove = async () => {
                                const seed = (improveText.trim() || prompt.trim());
                                if (!seed) { toast.error("Type an idea or prompt first"); return; }
                                setImproving(true);
                                try {
                                  const { data, error } = await supabase.functions.invoke("enhance-prompt", {
                                    body: { prompt: seed, type: mode === "image" ? "image" : "video" },
                                  });
                                  if (error) throw error;
                                  const enhanced = (data as any)?.enhanced;
                                  if (!enhanced) throw new Error("No prompt returned");
                                  setPrompt(enhanced);
                                  setImproveText("");
                                  setSettingsSub(null);
                                  setSettingsOpen(false);
                                   toast.success("Prompt enhanced ✨");
                                 } catch (e: any) {
                                   toast.error(e?.message || "Failed to enhance prompt");
                                } finally {
                                  setImproving(false);
                                }
                              };
                              return (
                                <motion.div
                                  key="improve"
                                  initial={{ opacity: 0, x: 12 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 12 }}
                                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                >
                                  <button
                                    onClick={() => setSettingsSub(null)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 mb-2"
                                  >
                                    <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" />
                                    Back
                                  </button>
                                  <div className="px-1 pb-1">
                                    <textarea
                                      value={improveText}
                                      onChange={(e) => setImproveText(e.target.value)}
                                      rows={3}
                                      placeholder="Write your prompt or describe your idea — we'll enhance it with AI…"
                                      className="w-full resize-none rounded-xl ios26-glass px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-1 focus:ring-primary/40"
                                      style={{ maxHeight: 160 }}
                                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runImprove(); }}
                                    />
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <span className="text-[10.5px] text-muted-foreground">The result will be inserted into the input automatically</span>
                                      <button
                                        onClick={runImprove}
                                        disabled={improving}
                                        className="ios26-button h-9 px-4 rounded-full text-xs flex items-center gap-1.5 disabled:opacity-50"
                                      >
                                        {improving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                        {improving ? "Improving…" : "Improve"}
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            }

                            if (settingsSub) {
                              const opts = subOptions[settingsSub] || [];
                              const current =
                                settingsSub === "aspect" ? (mode === "image" ? imgAspect : vidAspect)
                                : settingsSub === "style" ? imgStyle
                                : settingsSub === "duration" ? vidDuration
                                : "";
                              return (
                                <motion.div
                                  key={`sub-${settingsSub}`}
                                  initial={{ opacity: 0, x: 12 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 12 }}
                                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                >
                                  <button
                                    onClick={() => setSettingsSub(null)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 mb-1.5"
                                  >
                                    <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" />
                                    Back
                                  </button>
                                  <div className="flex flex-col gap-1 px-1 pb-1">
                                    {opts.map((opt) => {
                                      const active = opt === current;
                                      return (
                                        <button
                                          key={opt}
                                          onClick={() => {
                                            if (settingsSub === "aspect") {
                                              if (mode === "image") setImgAspect(opt); else setVidAspect(opt);
                                            } else if (settingsSub === "style") setImgStyle(opt);
                                            else if (settingsSub === "duration") setVidDuration(opt);
                                            setSettingsSub(null);
                                          }}
                                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                            active
                                              ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                                              : "text-foreground/85 hover:bg-accent"
                                          }`}
                                        >
                                          <span>{opt}</span>
                                          {active && <Check className="w-3.5 h-3.5 text-primary" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              );
                            }

                            return (
                              <motion.div
                                key="main"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="grid grid-cols-1 gap-0.5"
                              >
                                {rows.map((r) => (
                                  <button
                                    key={r.key}
                                    onClick={() => {
                                      if (r.key === "model") {
                                        setSettingsOpen(false);
                                        setModelPickerOpen(true);
                                      } else {
                                        setSettingsSub(r.key as any);
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent transition-colors ${r.key === "model" ? "bg-foreground/[0.04]" : ""}`}
                                  >
                                    <span className="font-medium">{r.label}</span>
                                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                      {r.key === "model" && currentModel && (
                                        <span className="text-[10px] font-bold text-indigo-300 tabular-nums">
                                          {mode === "image"
                                            ? `${(currentModel as any).credits} MC`
                                            : `${(currentModel as any).credits_per_second ?? (currentModel as any).credits_per_video} MC`}
                                        </span>
                                      )}
                                      {r.value && <span className="truncate max-w-[140px]">{r.value}</span>}
                                      <ChevronRightIcon className="w-3.5 h-3.5" />
                                    </span>
                                  </button>
                                ))}
                              </motion.div>
                            );
                          })()}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                </div>
              </div>

              {/* Tools — image cards with name + description */}
              <div className="mt-9 relative z-10 md:mt-20">
                <div className="flex items-center justify-between mb-3 px-4 md:px-2 md:mb-6">
                  <h3 className="text-[15px] font-semibold text-foreground/90 md:text-[22px] md:tracking-tight">Tools</h3>
                  <button
                    onClick={() => setShowAllTools((v) => !v)}
                    className="flex items-center gap-0.5 text-[12px] font-medium text-foreground/55 hover:text-foreground transition-colors md:text-[13px]"
                  >
                    {showAllTools ? "Show less" : "View all"}
                    {!showAllTools && <ChevronRightIcon className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div>
                    {showAllTools ? (
                      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:gap-6 md:px-2">
                        {tools.map((t, idx) => (
                          <ToolCard
                            key={t.id}
                            tool={t}
                            idx={idx}
                            image={TOOL_IMAGES[t.id]}
                            onClick={() => navigate(t.route)}
                            variant="grid"
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Mobile: horizontal scroll */}
                        <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
                          {tools.map((t, idx) => (
                            <ToolCard
                              key={t.id}
                              tool={t}
                              idx={idx}
                              image={TOOL_IMAGES[t.id]}
                              onClick={() => navigate(t.route)}
                            />
                          ))}
                        </div>
                        {/* Desktop: clean 6-col grid (first row only) */}
                        <div className="hidden md:grid md:grid-cols-4 md:gap-6 md:px-2">
                          {tools.slice(0, 4).map((t, idx) => (
                            <ToolCard
                              key={t.id}
                              tool={t}
                              idx={idx}
                              image={TOOL_IMAGES[t.id]}
                              onClick={() => navigate(t.route)}
                              variant="grid"
                            />
                          ))}
                        </div>
                      </>
                    )}
                </div>
              </div>

              {/* Featured — Templates */}
              <div className="mt-10 px-4 md:mt-20 md:px-2">
                <div className="flex items-center justify-between mb-3 md:mb-6">
                  <h3 className="text-[15px] font-semibold text-foreground/90 md:text-[22px] md:tracking-tight">Templates</h3>
                  <button
                    onClick={() => setActiveTab("community")}
                    className="flex items-center gap-0.5 text-[12px] font-medium text-foreground/55 hover:text-foreground transition-colors md:text-[13px]"
                  >
                    View all <ChevronRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showcase.length === 0 ? (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 md:grid md:grid-cols-4 md:gap-6 md:mx-0 md:px-1 md:overflow-visible">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="shrink-0 w-[150px] aspect-[3/4] rounded-2xl bg-foreground/[0.04] animate-pulse md:w-full"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Mobile: horizontal scroll */}
                    <div dir="ltr" className="flex gap-2.5 overflow-x-auto overflow-y-visible scrollbar-hide snap-x scroll-px-4 -mr-4 pr-4 pb-2 md:hidden">
                      {showcase.slice(0, 12).map((it, idx) => (
                        <motion.button
                          key={it.id}
                          onClick={() => navigate(`/template/${it.id}`, { state: { item: it } })}
                          className="relative shrink-0 w-[150px] aspect-[3/4] snap-start overflow-hidden group rounded-2xl bg-foreground/[0.04] ring-1 ring-foreground/[0.06] hover:ring-foreground/20 transition-all"
                        >
                          {it.media_type === "video" ? (
                            <video src={(it as any).media_url} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" muted playsInline preload="none" />
                          ) : (
                            <CachedMediaImage src={(it as any).media_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" loading={idx < 3 ? "eager" : "lazy"} fetchPriority={idx < 2 ? "high" : "low"} thumbWidth={400} />
                          )}
                          {it.media_type === "video" && (
                            <span className="theme-fixed absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center bg-black/55 backdrop-blur-md text-white text-[9px] font-bold">▶</span>
                          )}
                        </motion.button>
                      ))}
                      <div className="shrink-0 w-1" aria-hidden="true" />
                    </div>
                    {/* Desktop: clean 4-col grid */}
                    <div className="hidden md:grid md:grid-cols-4 md:gap-6 md:px-1">
                      {showcase.slice(0, 12).map((it, idx) => (
                        <motion.button
                          key={it.id}
                          onClick={() => navigate(`/template/${it.id}`, { state: { item: it } })}
                          className="relative w-full aspect-[3/4] overflow-hidden group rounded-2xl bg-foreground/[0.04] ring-1 ring-foreground/[0.06] hover:ring-foreground/25 transition-all"
                        >
                          {it.media_type === "video" ? (
                            <video src={(it as any).media_url} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" muted playsInline preload="none" />
                          ) : (
                            <CachedMediaImage src={(it as any).media_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" loading={idx < 4 ? "eager" : "lazy"} fetchPriority={idx < 4 ? "high" : "low"} thumbWidth={500} />
                          )}
                          {it.media_type === "video" && (
                            <span className="theme-fixed absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center bg-black/55 backdrop-blur-md text-white text-[9px] font-bold">▶</span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </div>

            </>
          )}

          {activeTab === "studio" && (
            <div className="px-4 pt-6 pb-32">
              {studioItems.length === 0 ? (
                <div className="mx-auto max-w-md mt-10 px-6 py-10 rounded-3xl bg-foreground/[0.05] backdrop-blur-3xl backdrop-saturate-200 border border-foreground/10 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_20px_50px_-20px_rgba(0,0,0,0.5)]">
                  <p className="text-foreground/80 text-sm">
                    Nothing in your studio yet
                  </p>
                  <button
                    onClick={() =>
                      navigate(mode === "image" ? "/images/studio" : "/videos/studio")
                    }
                    className="mt-3 px-4 py-2 rounded-full bg-primary text-primary-foreground border border-primary/30 text-sm font-semibold"
                  >
                    Start creating
                  </button>
                </div>
              ) : (
                <div className="rounded-3xl bg-foreground/[0.04] backdrop-blur-3xl backdrop-saturate-200 border border-foreground/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_20px_60px_-25px_rgba(0,0,0,0.55)] p-2.5">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
                    {studioItems.map((it: any, i) => {
                      const isVid = it.type === "video";
                      const previewItem = { url: it.url, type: isVid ? "video" : "image", prompt: it.prompt, created_at: it.created_at };
                      return (
                        <motion.button
                          key={i}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => navigate(`/preview/${isVid ? "video" : "image"}`, { state: { item: previewItem } })}
                          className="theme-fixed relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black/30 border border-foreground/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] block"
                        >
                          {isVid ? (
                            <>
                              <video src={it.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                              <div className="theme-fixed absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="theme-fixed w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-2xl border border-white/30">
                                  <span className="theme-fixed text-white text-[11px] ml-0.5">▶</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <CachedMediaImage src={it.url} alt="" className="w-full h-full object-cover" loading={i < 4 ? "eager" : "lazy"} thumbWidth={500} />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "community" && (
            <div className="pb-6">
              {/* Minimal editorial header */}
              <div className="px-5 pt-8 pb-6 md:px-2 md:pt-16 md:pb-10 md:text-center">
                <h1 className="font-display uppercase text-[34px] sm:text-[44px] leading-[0.9] tracking-tight text-foreground break-words md:text-[72px]">
                  Discover{" "}
                  <span className="bg-gradient-to-r from-indigo-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Templates
                  </span>
                </h1>
              </div>

              {(() => {
                const filtered = communityItems;

                if (filtered.length === 0) {
                  return (
                    <p className="text-center py-20 text-muted-foreground text-sm">
                      Templates gallery coming soon
                    </p>
                  );
                }

                const chunk = (n: number, size = 8) => filtered.slice(n * size, n * size + size);
                const sections = [
                  { title: "Trending", items: filtered.slice(0, 6), big: true },
                  { title: "Create", items: chunk(1) },
                  { title: "Refine & Scale", items: chunk(2) },
                  { title: "Motion", items: chunk(3) },
                  { title: "Editorial", items: chunk(4) },
                  { title: "Experimental", items: chunk(5) },
                ].filter((s) => s.items.length > 0);

                const renderCard = (item: any, big: boolean) => {
                  const cardSize = big ? "w-[228px] aspect-[4/5]" : "w-40 aspect-[3/4]";
                  return (
                    <div
                      key={item.id}
                      className={`relative shrink-0 ${cardSize} rounded-2xl overflow-hidden bg-muted snap-start group`}
                    >
                      <button
                        onClick={() => navigate(`/template/${item.id}`, { state: { item } })}
                        className="absolute inset-0 w-full h-full"
                      >
                        {item.media_type === "video" ? (
                          <video
                            src={item.media_url}
                            poster={item.thumbnail_url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <CachedMediaImage
                            src={item.media_url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="eager"
                            decoding="async"
                          />
                        )}
                        {item.media_type === "video" && (
                          <span className="theme-fixed absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md text-white text-[10px] font-bold">
                            ▶
                          </span>
                        )}
                      </button>
                    </div>
                  );
                };

                const renderGridCard = (item: any) => (
                  <div
                    key={item.id}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted"
                  >
                    <button
                      onClick={() => navigate(`/template/${item.id}`, { state: { item } })}
                      className="absolute inset-0 w-full h-full"
                    >
                      {item.media_type === "video" ? (
                        <video
                          src={item.media_url}
                          poster={item.thumbnail_url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <CachedMediaImage
                          src={item.media_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="eager"
                          decoding="async"
                        />
                      )}
                      {item.media_type === "video" && (
                        <span className="theme-fixed absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md text-white text-[10px] font-bold">
                          ▶
                        </span>
                      )}
                    </button>
                  </div>
                );

                const iosEase = [0.32, 0.72, 0, 1] as const;

                return (
                  <AnimatePresence mode="wait" initial={false}>
                    {expandedSection ? (() => {
                      const section = sections.find((s) => s.title === expandedSection);
                      if (!section) return null;
                      return (
                        <div>
                          <div className="flex items-center gap-3 mb-5 px-4">
                            <button
                              onClick={() => setExpandedSection(null)}
                              aria-label="Back"
                              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-foreground/[0.06] border border-foreground/10 text-foreground hover:bg-foreground/[0.12] active:scale-95 transition"
                            >
                              <ChevronRightIcon className="w-5 h-5 rotate-180" />
                            </button>
                            <h3 className="font-display uppercase tracking-tight text-foreground text-[26px]">
                              {section.title}
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 px-4 md:grid-cols-5 md:gap-3 md:px-0">
                            {section.items.map((it, i) => (
                              <div
                                key={it.id}
                              >
                                {renderGridCard(it)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })() : (
                      <motion.div
                        key="sections"
                        className="space-y-7"
                        initial={{ opacity: 0, y: 14, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.99 }}
                        transition={{ duration: 0.55, ease: iosEase }}
                      >
                        {sections.map((section, sIdx) => (
                          <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.5,
                              ease: iosEase,
                              delay: sIdx * 0.07,
                            }}
                          >
                            <div className="flex items-center justify-between mb-3 px-4 md:px-2 md:mb-5">
                              <h3
                                className={`font-display uppercase tracking-tight text-foreground ${
                                  section.big ? "text-[28px] md:text-[34px]" : "text-[22px] md:text-[26px]"
                                }`}
                              >
                                {section.title}
                              </h3>
                              <button
                                onClick={() => setExpandedSection(section.title)}
                                className="flex items-center gap-1 text-sm font-medium text-foreground/85 hover:text-foreground"
                              >
                                View More <ChevronRightIcon className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Mobile: horizontal scroll */}
                            <div className="flex gap-2.5 overflow-x-auto overflow-y-visible scrollbar-hide pb-2 snap-x scroll-px-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:hidden">
                              {section.items.map((it, i) => (
                                <motion.div
                                  key={it.id}
                                  className="shrink-0"
                                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  transition={{
                                    duration: 0.5,
                                    ease: iosEase,
                                    delay: sIdx * 0.07 + i * 0.04,
                                  }}
                                >
                                  {renderCard(it, !!section.big)}
                                </motion.div>
                              ))}
                              <div className="shrink-0 w-1" aria-hidden="true" />
                            </div>
                            {/* Desktop: clean grid */}
                            <div className="hidden md:grid md:grid-cols-6 md:gap-3 md:px-2">
                              {section.items.map((it) => (
                                <div key={it.id} className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-muted group">
                                  <button
                                    onClick={() => navigate(`/template/${it.id}`, { state: { item: it } })}
                                    className="absolute inset-0 w-full h-full"
                                  >
                                    {it.media_type === "video" ? (
                                      <video src={(it as any).media_url} poster={(it as any).thumbnail_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" muted playsInline />
                                    ) : (
                                      <CachedMediaImage src={(it as any).media_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" loading="eager" decoding="async" />
                                    )}
                                    {it.media_type === "video" && (
                                      <span className="theme-fixed absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md text-white text-[10px] font-bold">▶</span>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                );
              })()}
            </div>
          )}
          </div>
        </div>


        {/* Bottom floating pill nav — mobile only */}
        <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
                <div className="theme-fixed flex items-center gap-1 p-1.5 rounded-full bg-zinc-900/85 backdrop-blur-3xl backdrop-saturate-200 border border-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),inset_0_-1px_0_0_rgba(255,255,255,0.05),0_20px_50px_-15px_rgba(0,0,0,0.6)]">
            {[
              { key: "home" as Tab, Icon: NavHomeIcon },
              { key: "studio" as Tab, Icon: NavStudioIcon },
              { key: "community" as Tab, Icon: NavDiscoverIcon },
            ].map(({ key, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`relative flex items-center justify-center w-14 h-11 rounded-full transition-all duration-300 text-white [&_svg]:text-white [&_svg_*]:stroke-white [&_svg_*]:fill-white ${
                    isActive ? "" : "opacity-100"
                  }`}
                >
                  <Icon
                    className="w-[22px] h-[22px] transition-colors"
                    active={isActive}
                    strokeWidth={isActive ? 2 : 1.8}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={mode === "image" ? "image/*" : "image/*,video/*"}
          className="hidden"
          onChange={handleFile}
        />

        {mode === "image" ? (
          <FalModelPickerSheet
            kind="image"
            open={modelPickerOpen}
            onClose={() => setModelPickerOpen(false)}
            selectedSlug={imageModelSlug}
            onSelect={(m) => { setImageModelSlug(m.slug); setModelPickerOpen(false); }}
          />
        ) : (
          <FalModelPickerSheet
            kind="video"
            open={modelPickerOpen}
            onClose={() => setModelPickerOpen(false)}
            selectedSlug={videoModelSlug}
            onSelect={(m) => { setVideoModelSlug(m.slug); setModelPickerOpen(false); }}
          />
        )}
      </div>
    </div>
    </>
  );
};

export default MediaHubPage;
