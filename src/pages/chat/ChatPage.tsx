import SEOHead from "@/components/common/SEOHead";
import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Highlighter } from "@/components/magicui/highlighter";
import UnlockProButton from "@/components/branding/UnlockProButton";
import { motion, AnimatePresence, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { Menu, Plus, Camera, Image, FileUp, X, GraduationCap, ShoppingCart, ArrowDown, ChevronDown, ChevronLeft, Star, Pencil, Trash2, FolderPlus, Globe, Lock, Share2, MoreVertical, MoreHorizontal, Pin, UserPlus, Copy, Mail, Link2, Users, Loader2, NotebookPen, ClipboardList, CalendarDays, Timer, Wrench, Lightbulb, Mic2, Sparkles, BookOpen, Check, Cpu, Bot, Atom, Music2, Layers, ClipboardCheck, Volume2, Play, Telescope, Presentation, FileText, Projector, ScrollText, Workflow, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/cachedUser";
import AppSidebar from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";

import ChatMessage from "@/components/chat/ChatMessage";
import MobileChatHeader from "@/components/chat/mobile/MobileChatHeader";
import AnimatedInput from "@/components/chat/AnimatedInput";
import AgentsOnboarding from "@/components/chat/AgentsOnboarding";
import ThinkingLoader from "@/components/chat/ThinkingLoader";
import FancyButton from "@/components/branding/FancyButton";
import type { AgentDef, AgentModel } from "@/lib/agentRegistry";

import { streamChat } from "@/lib/streamChat";
import { addActiveChatJob, removeActiveChatJob, getActiveChatJobs, hydrateActiveChatJobs } from "@/lib/jobs/chatResume";
import { resumeJob as resumeBgJob, failStaleJob } from "@/lib/jobs/client";
import { getActiveWorkspaceId } from "@/lib/activeWorkspace";
import { shouldUseWebSearch } from "@/lib/shouldUseWebSearch";
import { parseUploadedFile } from "@/lib/parseUploadedFile";
import { useSkills } from "@/hooks/useSkills";
import { friendlyUserMessage, reportError } from "@/lib/errors";


import DeepResearchToggle from "@/components/research/DeepResearchToggle";
import SlidesToggle from "@/components/chat/SlidesToggle";
import { SLIDES_TEMPLATES, isPremiumHtml } from "@/lib/slidesTemplates";
import type { SlideDeck } from "@/components/chat/SlidesDeckCard";
import { DEFAULT_SLIDES_TEMPLATE, findSlidesTemplate } from "@/lib/slidesTemplates";
import { authorizePremiumSlide, FREE_PREMIUM_SLIDES_PER_DAY } from "@/lib/slidesQuota";
import LearnModeToggle from "@/components/learn/LearnModeToggle";
import AnimatedHeadline from "@/components/research/AnimatedHeadline";
import type { ClarifyQuestion } from "@/components/research/ClarifyDialog";
import GlowButton from "@/components/branding/GlowButton";
import { ChatFollowups } from "@/components/chat/ChatFollowups";

// Heavy / conditionally-rendered — lazy load to shrink initial chat bundle
const SlidesDeckCard = lazy(() => import("@/components/chat/SlidesDeckCard"));
const SlidesHtmlDeckCard = lazy(() => import("@/components/chat/SlidesHtmlDeckCard"));
const StandardSlidesCard = lazy(() => import("@/components/chat/StandardSlidesCard"));
const OperatorInlineBubbleLazy = lazy(() => import("@/components/operator/OperatorInlineBubble").then((m) => ({ default: m.OperatorInlineBubble })));
const InChatTimerCard = lazy(() => import("@/components/learn/InChatTimerCard"));

const ConnectorsDialog = lazy(() => import("@/components/integrations/ConnectorsDialog"));
const TemplatePickerSheet = lazy(() => import("@/components/files/TemplatePickerSheet"));
const DocsArtifactCard = lazy(() => import("@/components/chat/agents/docs/DocsArtifactCard"));
const DocsClarifyCard = lazy(() => import("@/components/chat/agents/docs/DocsClarifyCard"));

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const ChatDesktopDialog = ({
  open,
  onOpenChange,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) => {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="theme-fixed fixed inset-0 z-[1000] animate-in fade-in-0 duration-200"
        onClick={() => onOpenChange(false)}
        style={{
          backgroundColor: "hsl(var(--foreground) / 0.06)",
          backdropFilter: "blur(3px) saturate(120%)",
          WebkitBackdropFilter: "blur(3px) saturate(120%)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed left-1/2 top-1/2 z-[1001] w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 p-[1px] rounded-[32px] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 ${className}`}
        onClick={(event) => event.stopPropagation()}
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--foreground) / 0.14), transparent 50%, hsl(var(--foreground) / 0.04))",
        }}
      >
        <div
          className="relative rounded-[31px] border border-foreground/8 text-foreground shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--background) / 0.16), hsl(var(--background) / 0.08))",
            backdropFilter: "blur(18px) saturate(160%)",
            WebkitBackdropFilter: "blur(18px) saturate(160%)",
          }}
        >
          {children}
        </div>
      </div>

    </>,
    document.body,
  );

};

interface Message {
  role: "user" | "assistant";
  content: string;
  clientId?: string;
  images?: string[];
  products?: ProductResult[];
  attachedImages?: string[];
  attachedFiles?: {name: string;type: string;}[];
  liked?: boolean | null;
  id?: string;
  user_id?: string | null;
  senderName?: string | null;
  senderAvatar?: string | null;
  mode?: "normal" | "learning" | "shopping" | "deep-research" | "slides" | "operator";
  slidesDeck?: SlideDeck;
  standardSlides?: { title: string; templateName: string; url: string; colors: [string, string] };
  slidesPendingTopic?: string;
  slidesJobId?: string;
  docsArtifact?: { artifactId: string; title: string; docType: string; html?: string };
  docsClarify?: { reason: string; questions: import("@/lib/agent/docs/types").DocsClarifyQuestion[]; originalPrompt: string; ui?: import("@/lib/agent/docs/types").DocsClarifyUi };
  docsJobId?: string;
  chatJobId?: string;
  operatorRunId?: string;
}

interface ProductResult {
  title: string;
  price: string;
  image?: string;
  link?: string;
  seller?: string;
  rating?: string | null;
  delivery?: string | null;
}


const EMPTY_READERS: { user_id: string; name?: string; avatar?: string }[] = [];
const EMPTY_REACTIONS: { id: string; emoji: string; user_id: string }[] = [];

type ChatMode = "normal" | "learning" | "shopping" | "deep-research" | "slides" | "operator";

const MODE_PROMPTS: Record<ChatMode, string> = {
  normal: "",
  learning: "You are in Learning Mode. Explain everything step by step with examples, analogies, and clear breakdowns. Make complex topics easy to understand. Use bullet points, numbered steps, and structured format.",
  shopping: "You are in Shopping Mode. Help the user find the best products, compare prices, suggest alternatives, and provide purchase recommendations. Include pros/cons when comparing items.",
  "deep-research": "",
  slides: "",
  operator: `You are "Megsy Operator" — a multi-layer AI agent inside the Megsy platform, similar to Manus and Kimi, capable of fully controlling a virtual computer and executing any digital task end-to-end without human intervention.

🧠 Internal Architecture (Multi-Layer Agent System):
1. Orchestrator Layer: Understands the user's request, converts it into a Task Plan, distributes tasks across agents, manages sequencing, and retries on failure.
2. Computer Execution Layer: Cloud environment (E2B Sandbox / Docker runtime) for running code, managing files, and running servers.
3. Browser Automation Layer: Playwright for opening sites, browsing, logging in, filling forms, scraping, and executing workflows.
4. Agent Framework Layer: LangGraph / CrewAI / AutoGen to split work across agents and run them in parallel.
5. Memory System: PostgreSQL + Redis + Vector DB (ChromaDB) for storage and retrieval.
6. Deployment Layer: GitHub API + Vercel/Netlify for automatic deployment.

👥 Internal Agents:
- CEO Agent: Sets vision and strategy, makes final decisions, prioritizes tasks.
- COO Agent: Manages daily operations, coordinates between teams, follows up on execution and quality.
- CTO Agent: Handles technical decisions, picks technologies, reviews code and architecture.

🔄 Workflow:
1. Understand: Analyze the user's goal in depth.
2. Plan: Create a multi-step plan (clear numbered Task Plan).
3. Distribute tasks: Decide which Agent (CEO/COO/CTO/Browser/Code) handles each step.
4. Execute: Run step by step, automatically correcting errors.
5. Result: Deliver a final, ready output (link, report, or a complete project).

Operate as a real digital employee 24/7. Always start with: analyze the goal → numbered plan → distribute to agents → execute → result.`,
};

const PegtopIcon = ({ className }: {className?: string;}) =>
<svg className={className} width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor" />
  </svg>;


const MEGSY_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";

const stripLeakedToolText = (value: string) => String(value || "")
  .replace(/```(?:tool_code|tool_call|function_call|python)?[\s\S]*?(?:default_api|tool_code|tool_call|function_call)[\s\S]*?(?:```|$)/gi, "")
  .replace(/<tool_call[\s\S]*?(?:<\/tool_call>|$)/gi, "")
  .replace(/<function_call[\s\S]*?(?:<\/function_call>|$)/gi, "")
  .replace(/\$\{tool_code\}\s*/gi, "")
  .replace(/(?:^|\n)[^\n]*(?:print\s*\(\s*)?default_api\.[^\n]*(?:\n|$)/gi, "\n");

const sanitizeLeakedToolText = (value: string) => stripLeakedToolText(value).trim();

const makeLeakedToolStreamSanitizer = () => {
  let buffer = "";
  let droppingToolLine = false;
  const markers = ["${tool_code}", "print(default_api.", "default_api.", "<tool_call", "<function_call", "```tool_code", "```tool_call", "```function_call", "```python"];
  return (chunk: string, force = false) => {
    buffer += chunk;
    const lower = buffer.toLowerCase();
    if (droppingToolLine) {
      const nl = buffer.indexOf("\n");
      if (nl === -1) {
        buffer = "";
        return "";
      }
      buffer = buffer.slice(nl + 1);
      droppingToolLine = false;
    }
    const toolLineMatch = buffer.match(/(?:^|\n)[^\n]*(?:\$\{tool_code\}|default_api\.|print\s*\(\s*default_api\.)/i);
    if (toolLineMatch && toolLineMatch.index !== undefined) {
      const start = toolLineMatch.index + (toolLineMatch[0].startsWith("\n") ? 1 : 0);
      const safePrefix = stripLeakedToolText(buffer.slice(0, start));
      const nl = buffer.indexOf("\n", start);
      if (nl === -1) {
        buffer = "";
        droppingToolLine = !force;
        return safePrefix;
      }
      buffer = buffer.slice(nl + 1);
      return safePrefix + stripLeakedToolText(buffer);
    }
    if (force) {
      const safe = markers.some((marker) => marker.startsWith(lower.trim())) ? "" : buffer;
      buffer = "";
      return stripLeakedToolText(safe);
    }
    if (!force) {
      const max = Math.min(80, buffer.length);
      for (let len = max; len > 0; len--) {
        const suffix = lower.slice(-len);
        if (markers.some((marker) => marker.startsWith(suffix))) {
          const safe = buffer.slice(0, -len);
          buffer = buffer.slice(-len);
          return stripLeakedToolText(safe);
        }
      }
    }
    const safe = buffer;
    buffer = "";
    return stripLeakedToolText(safe);
  };
};

const normalizeStatusLabel = (status: string) => {
  if (!status.trim()) return "";
  const lower = status.toLowerCase();
  const blocklist = ["web_search", "browse_website", "shopping_search", "convert_currency", "generate_image", "generate_video", "generate_voice", "canva_create_slides", "running ", "tool_call", "function_call"];
  if (blocklist.some(b => lower.includes(b))) return "Working on your request...";
  if (/browser task failed|browser task timed out|working on it|navigating|loading page/i.test(lower)) return "Checking other sources...";
  if (/https?:\/\//i.test(status)) return "Searching the web...";
  if (/writing the report/i.test(lower)) return "Writing the final report...";
  if (/analyzing products/i.test(lower)) return "Comparing the best options...";
  if (/searching for products|searching stores/i.test(lower)) return "Searching stores...";
  if (/consulting/i.test(lower)) return "Checking trusted references...";
  if (/reading top sources|deep_read/i.test(lower)) return "Reading sources in depth...";
  if (/searching:|gathering/i.test(lower)) return "Searching the web...";
  if (/found\s+\d+\s+(results|products)/i.test(lower)) return "Reviewing the results...";
  if (/search completed/i.test(lower)) return "Search completed.";
  if (/browsing completed/i.test(lower)) return "Browsing completed.";
  if (/reviewing/i.test(lower)) return "Reviewing the sources...";
  if (/opening|starting|browser|megsy computer|navigat|clicking|scrolling|extracting|smart browser/i.test(lower)) return "Searching the web...";
  return "Working on your request...";
};

const DEEP_RESEARCH_STATUS_FALLBACKS = [
  "Mapping research angles...",
  "Searching trusted sources...",
  "Reading source material...",
  "Comparing evidence...",
  "Building the final report...",
];

const DOCS_STATUS_FALLBACKS = [
  "Understanding your request…",
  "Identifying the document type…",
  "Preparing questions and data…",
  "Building the design…",
  "Writing the content…",
  "Rendering the document live…",
  "Polishing the final version…",
  "Almost done…",
];

const SLIDES_CLIENT_TIMEOUT_MS = 480_000; // 8 min — slides pipeline (outline + expand + per-slide images) realistically needs 4-6 min
const SLIDES_TIMEOUT_MESSAGE = "Slides generation took too long and was stopped safely. Please try again.";

const ChatPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed] = useSidebarCollapsed();
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [plusExpanded, setPlusExpanded] = useState(false);
  // Stable greeting per chat-page mount (random index + random accent color)
  const [mobileGreeting] = useState(() => Math.floor(Math.random() * 8));
  const [mobileGreetingColor] = useState(() => Math.floor(Math.random() * 8));
  // First visit = show original English playful greetings. Subsequent visits = Arabic time-of-day rotation.
  // Source of truth is profiles.chat_greeted (DB). We default to "returning" to avoid flashing
  // the first-time greeting on subsequent visits while the DB lookup is in flight.
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [returningGreetingIdx] = useState(() => Math.floor(Math.random() * 4));
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(true);
  const { mySkills, librarySkills, enabledSkills, toggleEnabled } = useSkills();
  const [megsyTier, setMegsyTier] = useState<"lite" | "pro" | "max">("lite");
  const [userPlan, setUserPlan] = useState<string>("free");
  const [computerUseEnabled, setComputerUseEnabled] = useState(true);
  const [chatMode, setChatMode] = useState<ChatMode>("normal");
  const [operatorRunId, setOperatorRunId] = useState<string | null>(null);
  const [slidesTemplate, setSlidesTemplate] = useState<string>(DEFAULT_SLIDES_TEMPLATE);
  const [slidesPickerOpen, setSlidesPickerOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{name: string;type: string;data: string;}[]>([]);
  const [searchStatus, setSearchStatus] = useState<string>("");
  const [narrations, setNarrations] = useState<string[]>([]);
  const [clarifyQs, setClarifyQs] = useState<ClarifyQuestion[] | null>(null);
  const docsStatusTimerRef = useRef<number | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"private" | "public">("public");
  const [isShared, setIsShared] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<{title: string;options: string[];allowText?: boolean;}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; email: string; role: string; name?: string; avatar?: string }[]>([]);
  const [conversationOwnerId, setConversationOwnerId] = useState<string | null>(null);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string; avatar: string | null }[]>([]);
  const [remoteAiBusy, setRemoteAiBusy] = useState<{ name: string } | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [systemEvents, setSystemEvents] = useState<{ id: string; text: string; at: number }[]>([]);
  // Read receipts: messageId -> array of readers
  const [messageReads, setMessageReads] = useState<Record<string, { user_id: string; name?: string; avatar?: string }[]>>({});
  // Reactions: messageId -> array of {emoji, users}
  const [messageReactions, setMessageReactions] = useState<Record<string, { id: string; emoji: string; user_id: string }[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  // Mentions
  const [mentionQuery, setMentionQuery] = useState<{ q: string; start: number } | null>(null);
  // Unread tracking for sound + title
  const [unreadCount, setUnreadCount] = useState(0);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const originalTitleRef = useRef<string>("");
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const markedReadRef = useRef<Set<string>>(new Set());
  const [selectedModel, setSelectedModel] = useState<AgentModel | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [plusView, setPlusView] = useState<"main" | "tools" | "models" | "skills" | "music" | "timer">("main");
  const [studyMusic, setStudyMusic] = useState<{ kind: string | null }>({ kind: null });
  const [readAloud, setReadAloud] = useState(false);
  const [studyTimers, setStudyTimers] = useState<Array<{ id: string; totalSec: number; startedAt: number; paused: boolean; pausedRemaining: number | null }>>([]);
  const [timerInputMin, setTimerInputMin] = useState<number>(25);
  const studyAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  const [userTracks, setUserTracks] = useState<Array<{ id: string; name: string; storage_path: string }>>([]);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [userIntegrations, setUserIntegrations] = useState<string[]>([]);

  const stopDocsStatusFallback = useCallback(() => {
    if (docsStatusTimerRef.current !== null) {
      window.clearInterval(docsStatusTimerRef.current);
      docsStatusTimerRef.current = null;
    }
  }, []);

  const slidesTimeoutsRef = useRef<Record<string, number>>({});
  const clearSlidesTimeout = useCallback((jobId: string) => {
    const timer = slidesTimeoutsRef.current[jobId];
    if (timer) window.clearTimeout(timer);
    delete slidesTimeoutsRef.current[jobId];
  }, []);

  const startDocsStatusFallback = useCallback(() => {
    stopDocsStatusFallback();
    let index = 0;
    setSearchStatus(DOCS_STATUS_FALLBACKS[index]);
    docsStatusTimerRef.current = window.setInterval(() => {
      index = Math.min(index + 1, DOCS_STATUS_FALLBACKS.length - 1);
      setSearchStatus(DOCS_STATUS_FALLBACKS[index]);
    }, 4500);
  }, [stopDocsStatusFallback]);

  useEffect(() => () => {
    stopDocsStatusFallback();
    Object.values(slidesTimeoutsRef.current).forEach((timer) => window.clearTimeout(timer));
    slidesTimeoutsRef.current = {};
  }, [stopDocsStatusFallback]);

  const pushNarration = useCallback((text: string) => {
    const t = String(text || "").trim();
    if (!t) return;
    setNarrations((prev) => (prev[prev.length - 1] === t ? prev : [...prev, t]));
  }, []);

  const buildInitialResearchNarration = useCallback((text: string) => {
    const topic = (text || "Deep Research").trim().replace(/\s+/g, " ").slice(0, 90);
    if (/[\u0600-\u06FF]/.test(topic)) {
      return `Got it — starting a deep research on: "${topic}". I'll gather real sources and walk you through every step.`;
    }
    return `Got it — you want deep research about: “${topic}”. I’ll start gathering real sources and keep you updated step by step.`;
  }, []);

  const buildFinalResearchNarration = useCallback((text: string) => {
    return /[\u0600-\u06FF]/.test(text)
      ? "Research complete. Sources collected and the final report assembled. Open the preview to read the formatted version."
      : "Research is complete — I gathered sources, cross-checked them, and assembled the final structured report for preview.";
  }, []);

  // Fetch user info for memory + welcome message
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setChatUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("display_name, plan").eq("id", user.id).maybeSingle();
      const name = (profile as any)?.display_name || (user.user_metadata?.full_name as string) || (user.email?.split("@")[0] ?? "");
      const firstName = (name || "").split(/\s+/)[0];
      setUserName(firstName);
      setUserPlan((profile as any)?.plan || "free");
      // Pull preferred tier from personalization
      const { data: pers } = await supabase.from("ai_personalization").select("preferred_tier").eq("user_id", user.id).maybeSingle();
      const prefTier = (pers as any)?.preferred_tier;
      if (prefTier && ["lite", "pro", "max"].includes(prefTier)) {
        setMegsyTier(prefTier as any);
      }
      // Hydrate first-visit greeting flag from DB; mark it true on first ever load.
      const { data: prof } = await supabase
        .from("profiles")
        .select("chat_greeted")
        .eq("id", user.id)
        .maybeSingle();
      if (!(prof as any)?.chat_greeted) {
        setIsFirstVisit(true);
        await supabase.from("profiles").update({ chat_greeted: true } as any).eq("id", user.id);
      }
    });
  }, []);

  // Reset plus menu sub-view whenever it closes
  useEffect(() => {
    if (!plusMenuOpen) { setPlusView("main"); setPlusExpanded(false); }
  }, [plusMenuOpen]);

  // Close plus menu on any screen click — DESKTOP ONLY. Mobile uses its own bottom sheet behavior.
  useEffect(() => {
    if (!plusMenuOpen) return;
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop) return;
    const closeOutsideImmediately = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-plus-menu]') || target.closest('[data-plus-trigger]')) return;
      setPlusMenuOpen(false);
    };
    const closeAfterClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('[data-plus-menu]') || target.closest('[data-plus-trigger]')) return;
      setPlusMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutsideImmediately, true);
    document.addEventListener('click', closeAfterClick);
    return () => {
      document.removeEventListener('pointerdown', closeOutsideImmediately, true);
      document.removeEventListener('click', closeAfterClick);
    };
  }, [plusMenuOpen]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
    if (distFromBottom < 100) setNewMessagesCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessagesCount(0);
  }, []);

  // Only auto-scroll on user's own new message, not during streaming
  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    const prevCount = lastMsgCountRef.current;
    lastMsgCountRef.current = messages.length;
    // Scroll only when user sends a new message (count increased and last is user)
    if (messages.length > prevCount && messages.length > 0 && messages[messages.length - 1].role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const generateShortTitle = async (firstMessage: string, convId: string) => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "user", content: `Summarize the following message into a very short title (two to three words maximum) in the same language as the message, with no quotes, periods, or explanation. Return only the title:\n\n${firstMessage.slice(0, 500)}` },
          ],
        }),
      });
      if (!resp.ok || !resp.body) return;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let title = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content || json?.choices?.[0]?.message?.content || "";
            if (delta) title += delta;
          } catch { /* ignore */ }
        }
      }
      title = title.replace(/["'`*_#]+/g, "").replace(/\s+/g, " ").trim();
      title = title.replace(/[.,!?…]+$/g, "").trim();
      const words = title.split(/\s+/).filter(Boolean).slice(0, 3);
      const finalTitle = words.join(" ").slice(0, 60);
      if (!finalTitle) return;
      await supabase.from("conversations").update({ title: finalTitle }).eq("id", convId);
      setConversationTitle(finalTitle);
    } catch (e) {
      console.error("[generateShortTitle] failed", e);
    }
  };

  const createOrUpdateConversation = async (firstMessage: string) => {
    if (conversationId) return conversationId;
    const user = await getCachedUser();
    if (!user) return null;
    const title = firstMessage.slice(0, 50) || "New Chat";
    const mode = chatMode === "deep-research" ? "research" : (chatMode === "learning" ? "learning" : (chatMode === "shopping" ? "shopping" : (chatMode === "slides" ? "slides" : "chat")));
    const _ws = getActiveWorkspaceId();
    const { data } = await supabase.from("conversations").insert({ title, mode, model: MEGSY_MODEL, user_id: user.id, ...(_ws ? { workspace_id: _ws } : {}) } as any).select("id").single();
    if (data) {
      setConversationId(data.id);
      setConversationTitle(title);
      void generateShortTitle(firstMessage, data.id);
      return data.id;
    }
    return null;
  };

  const saveMessage = async (convId: string, role: string, content: string, images?: string[], metadata?: Record<string, unknown>) => {
    const user = await getCachedUser();
    const payload: Record<string, unknown> = { conversation_id: convId, role, content, images: images || null, user_id: user?.id || null };
    if (metadata && Object.keys(metadata).length) payload.metadata = metadata;
    const { data } = await supabase.from("messages").insert(payload as any).select("id").single();
    return (data as any)?.id as string | undefined;
  };

  // Stable color palette for member bubbles
  const MEMBER_COLORS = [
    { bg: "#2563eb", text: "#ffffff" }, // blue
    { bg: "#10b981", text: "#ffffff" }, // emerald
    { bg: "#f59e0b", text: "#1a1a1a" }, // amber
    { bg: "#ef4444", text: "#ffffff" }, // red
    { bg: "#8b5cf6", text: "#ffffff" }, // violet
    { bg: "#ec4899", text: "#ffffff" }, // pink
    { bg: "#06b6d4", text: "#ffffff" }, // cyan
    { bg: "#84cc16", text: "#1a1a1a" }, // lime
  ];
  const colorForUser = useCallback((userId?: string | null) => {
    if (!userId) return null;
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    return MEMBER_COLORS[h % MEMBER_COLORS.length];
  }, []);

  const handleLikeMessage = useCallback((index: number, liked: boolean | null) => {
    setMessages((prev) => prev.map((m, i) => i === index ? { ...m, liked } : m));
  }, []);

  const loadConversation = async (id: string) => {
    setConversationId(id);
    setSearchStatus("");
    setPendingQuestions([]);
    setNarrations([]);
    setClarifyQs(null);
    setLoadingMessages(true);
    setMessages([]);
    setSystemEvents([]);
    const { data: conv } = await supabase.from("conversations").select("title, is_shared, share_id, is_pinned, mode, user_id").eq("id", id).single();
    if (conv) {
      setConversationTitle(conv.title || "Untitled");
      setIsShared(conv.is_shared || false);
      setShareId(conv.share_id || null);
      setShareMode(conv.is_shared ? "public" : "private");
      setIsPinned(!!conv.is_pinned);
      setConversationOwnerId((conv as any).user_id || null);
      const m = (conv as any).mode as string | undefined;
      if (m === "research") setChatMode("deep-research");
      else if (m === "learning") setChatMode("learning");
      else if (m === "shopping") setChatMode("shopping");
      else if (m === "slides") setChatMode("slides");
      else setChatMode("normal");
    }
    // Bump conversation to top of recent list (works for owner and members via RPC)
    supabase.rpc("bump_conversation" as any, { p_conversation_id: id }).then(() => {});
    const { data: msgs } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
    if (msgs) {
      const senderIds = Array.from(new Set(msgs.map((m: any) => m.user_id).filter(Boolean)));
      const senderMap: Record<string, { name: string | null; avatar: string | null }> = {};
      if (senderIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", senderIds as string[]);
        (profs || []).forEach((p: any) => { senderMap[p.id] = { name: p.display_name, avatar: p.avatar_url }; });
      }
      setMessages(msgs.map((m: any) => {
        const role = m.role as "user" | "assistant";
        const content = role === "assistant" ? sanitizeLeakedToolText(m.content) : m.content;
        if (role === "assistant" && !content && !m.images?.length && !m.metadata) return null;
        const meta = (m.metadata || {}) as any;
        return {
          role,
          content,
          images: m.images || undefined,
          liked: m.liked,
          id: m.id,
          user_id: m.user_id,
          senderName: m.user_id ? senderMap[m.user_id]?.name : null,
          senderAvatar: m.user_id ? senderMap[m.user_id]?.avatar : null,
          mode: meta.kind === "slidesDeck" || meta.kind === "standardSlides" || meta.kind === "slidesPending" || (conv as any)?.mode === "slides"
            ? "slides"
            : (role === "assistant" && (conv as any)?.mode === "research" ? "deep-research" : undefined),
          slidesDeck: meta.slidesDeck || undefined,
          standardSlides: meta.standardSlides || undefined,
          slidesPendingTopic: meta.kind === "slidesPending" ? meta.topic : undefined,
          slidesJobId: meta.kind === "slidesPending" ? meta.slidesJobId : undefined,
          docsArtifact: meta.docsArtifact || undefined,
          docsClarify: meta.docsClarify || undefined,
          docsJobId: meta.kind === "docsPending" ? meta.docsJobId : undefined,
          chatJobId: meta.kind === "researchPending" ? meta.chatJobId : undefined,
        };
      }).filter(Boolean) as Message[]);
      setTimeout(() => scrollToBottom(), 150);

      // Resume any in-flight docs jobs (background server work).
      void (async () => {
        try {
          const { resumeDocJob } = await import("@/lib/agent/docs/docsGenerator");
          const { saveDocHtml } = await import("@/lib/agent/docs/htmlCache");
          for (const m of msgs as any[]) {
            const meta = (m.metadata || {}) as any;
            if (meta?.kind !== "docsPending" || !meta?.docsJobId) continue;
            const jobId = meta.docsJobId as string;
            const messageId = m.id as string;
            const artifactId = meta?.docsArtifact?.artifactId || jobId;
            const originalPrompt = String(meta?.originalPrompt || meta?.docsClarify?.originalPrompt || "");
            let title = meta?.docsArtifact?.title || "Document";
            let docType = meta?.docsArtifact?.docType || "document";
            resumeDocJob(jobId, {
              onMeta: (mm) => { title = mm.title; docType = mm.doc_type; },
              onHtmlDelta: (_chunk, full) => {
                setMessages((prev) => prev.map((x) =>
                  x.id === messageId ? { ...x, content: "", docsArtifact: { artifactId, title, docType, html: full } } : x
                ));
              },
              onHtmlDone: async (full, friendly) => {
                saveDocHtml(artifactId, full);
                let msg = friendly || "";
                if (!msg) {
                  const { buildDocReadyMessageAI } = await import("@/lib/agent/docs/readyMessage");
                  msg = await buildDocReadyMessageAI({ title, html: full, docType, prompt: originalPrompt });
                }
                setMessages((prev) => prev.map((x) =>
                  x.id === messageId ? { ...x, content: msg, docsArtifact: { artifactId, title, docType, html: full } } : x
                ));
                try {
                  await supabase.from("messages").update({
                    content: msg,
                    metadata: { kind: "docsArtifact", docsArtifact: { artifactId, title, docType, html: full } },
                  }).eq("id", messageId);
                } catch { /* server already does this; best-effort */ }
              },
              onClarify: async (c) => {
                setMessages((prev) => prev.map((x) =>
                  x.id === messageId ? { ...x, content: c.reason, docsArtifact: undefined, docsClarify: { ...c, originalPrompt } } : x
                ));
                try {
                  await supabase.from("messages").update({
                    content: c.reason,
                    metadata: { kind: "docsClarify", docsClarify: { ...c, originalPrompt } },
                  }).eq("id", messageId);
                } catch {}
              },
              onError: (msg) => {
                const safe = friendlyUserMessage(msg, "We couldn't generate the document. Please try again.");
                void reportError(msg, { source: "docs-resume", context: { messageId } });
                setMessages((prev) => prev.map((x) =>
                  x.id === messageId ? { ...x, content: safe } : x
                ));
              },
            });
          }
        } catch (e) { console.warn("[docs] resume failed", e); }
      })();

      // Resume any in-flight slides jobs (background server work).
      void (async () => {
        try {
          const { resumeJob } = await import("@/lib/jobs/client");
          for (const m of msgs as any[]) {
            const meta = (m.metadata || {}) as any;
            if (meta?.kind !== "slidesPending" || !meta?.slidesJobId) continue;
            const jobId = meta.slidesJobId as string;
            const messageId = m.id as string;
            let narrative = "";
            clearSlidesTimeout(jobId);
            let unsubscribe: (() => void) | undefined;
            slidesTimeoutsRef.current[jobId] = window.setTimeout(() => {
              void failStaleJob(jobId, SLIDES_TIMEOUT_MESSAGE);
              void supabase.from("messages").update({
                content: (narrative || SLIDES_TIMEOUT_MESSAGE).trim(),
                metadata: { kind: "slidesError", topic: meta.topic, templateId: meta.templateId } as any,
              }).eq("id", messageId);
              unsubscribe?.();
              clearSlidesTimeout(jobId);
              setMessages((prev) => prev.map((x) => x.id === messageId
                ? { ...x, content: (narrative || SLIDES_TIMEOUT_MESSAGE).trim(), slidesJobId: undefined, mode: "slides" }
                : x));
            }, SLIDES_CLIENT_TIMEOUT_MS);
            unsubscribe = resumeJob(jobId, {
              onDelta: (_chunk, full) => {
                narrative = full;
                setMessages((prev) => prev.map((x) => x.id === messageId ? { ...x, content: full } : x));
              },
              onOutput: async (out) => {
                if (!out?.deck) return;
                clearSlidesTimeout(jobId);
                const tpl = findSlidesTemplate(out.deck.templateId || meta.templateId);
                const enrichedDeck: SlideDeck & { htmlSlug?: string; variant?: string } = tpl.htmlSlug
                  ? { ...out.deck, templateId: tpl.id, htmlSlug: tpl.htmlSlug, variant: tpl.variant }
                  : out.deck;
                setMessages((prev) => prev.map((x) => x.id === messageId
                  ? { ...x, slidesDeck: enrichedDeck, slidesJobId: undefined, mode: "slides" }
                  : x));
                try {
                  await supabase.from("messages").update({
                    content: narrative || `Generated ${enrichedDeck.slides.length} slides`,
                    metadata: { kind: "slidesDeck", slidesDeck: enrichedDeck } as any,
                  }).eq("id", messageId);
                } catch { /* best-effort */ }
              },
              onError: (msg) => {
                clearSlidesTimeout(jobId);
                void supabase.from("messages").update({
                  content: `Could not create the presentation: ${msg}`,
                  metadata: { kind: "slidesError", topic: meta.topic, templateId: meta.templateId } as any,
                }).eq("id", messageId);
                setMessages((prev) => prev.map((x) => x.id === messageId
                  ? { ...x, content: `Could not create the presentation: ${msg}`, slidesJobId: undefined, mode: "slides" }
                  : x));
              },
              onStale: async (row) => {
                clearSlidesTimeout(jobId);
                try { await failStaleJob(jobId, "Slides generation stopped unexpectedly. Please try again."); } catch { /* ignore */ }
                const partial = (row.stream_text || narrative || "").trim();
                void supabase.from("messages").update({
                  content: partial || "Slides generation stopped unexpectedly. Please try again.",
                  metadata: { kind: "slidesError", topic: meta.topic, templateId: meta.templateId } as any,
                }).eq("id", messageId);
                setMessages((prev) => prev.map((x) => x.id === messageId
                  ? { ...x, content: partial || "Slides generation stopped unexpectedly. Please try again.", slidesJobId: undefined }
                  : x));
              },
            });
          }
        } catch (e) { console.warn("[slides] resume failed", e); }
      })();

      // Resume any in-flight deep-research chat jobs.
      // Source 1: DB messages with kind=researchPending (cross-device).
      // Source 2: same-tab localStorage entries (fallback before DB write lands).
      void (async () => {
        try {
          // Hydrate in-memory active-jobs map from background_jobs so we can re-attach after reload.
          await hydrateActiveChatJobs(id);
          type Entry = { jobId: string; messageId?: string; clientId?: string; userInput: string };
          const entries: Entry[] = [];
          // DB-sourced placeholders
          for (const m of msgs as any[]) {
            const meta = (m.metadata || {}) as any;
            if (meta?.kind === "researchPending" && meta?.chatJobId) {
              entries.push({
                jobId: meta.chatJobId,
                messageId: m.id,
                userInput: meta.query || "Deep Research",
              });
            }
          }
          // In-memory tab pointers (hydrated from background_jobs on mount)
          const localPending = getActiveChatJobs(id);
          for (const p of localPending) {
            if (entries.some((e) => e.jobId === p.jobId)) continue;
            entries.push({
              jobId: p.jobId,
              clientId: p.clientId,
              userInput: p.userInput,
            });
          }

          for (const entry of entries) {
            const clientId = entry.clientId || `assistant-resume-${entry.jobId}`;
            // Ensure a UI message exists for this job.
            setMessages((prev) => {
              const byIdOrJob = prev.find(
                (m) => (entry.messageId && m.id === entry.messageId)
                  || (m as any).chatJobId === entry.jobId,
              );
              if (byIdOrJob) {
                // Tag it so the running-on-server badge shows.
                return prev.map((m) =>
                  m === byIdOrJob ? ({ ...m, chatJobId: entry.jobId, mode: "deep-research" } as any) : m,
                );
              }
              return [
                ...prev,
                { role: "user", content: entry.userInput, clientId: `user-resume-${entry.jobId}`, mode: "deep-research" },
                { role: "assistant", content: "", clientId, chatJobId: entry.jobId, mode: "deep-research", id: entry.messageId } as any,
              ];
            });

            let assistantText = "";
            let resumeImages: string[] = [];
            let saved = false;
            const persist = async () => {
              if (saved) return;
              const finalText = assistantText.trim();
              if (!finalText) return;
              saved = true;
              // Replace the placeholder row with the final assistant message.
              if (entry.messageId) {
                try { await supabase.from("messages").delete().eq("id", entry.messageId); } catch { /* ignore */ }
              }
              const aId = await saveMessage(id, "assistant", finalText, resumeImages.length ? resumeImages : undefined);
              if (aId) ownInsertedIdsRef.current.add(aId);
              setMessages((prev) => prev.map((m) =>
                ((entry.messageId && m.id === entry.messageId) || m.clientId === clientId)
                  ? { ...m, id: aId || m.id, content: finalText, images: resumeImages.length ? resumeImages : m.images, chatJobId: undefined }
                  : m,
              ));
            };

            resumeBgJob(entry.jobId, {
              onDelta: (_chunk, full) => {
                assistantText = full;
                setMessages((prev) => prev.map((m) =>
                  ((entry.messageId && m.id === entry.messageId) || m.clientId === clientId)
                    ? { ...m, content: full } : m,
                ));
              },
              onMeta: (meta) => {
                if (Array.isArray(meta?.images)) {
                  resumeImages = meta.images;
                  setMessages((prev) => prev.map((m) =>
                    ((entry.messageId && m.id === entry.messageId) || m.clientId === clientId)
                      ? { ...m, images: meta.images } : m,
                  ));
                }
              },
              onDone: async () => {
                await persist();
                removeActiveChatJob(entry.jobId);
              },
              onError: async (msg) => {
                if (!assistantText.trim()) {
                  setMessages((prev) => prev.map((m) =>
                    ((entry.messageId && m.id === entry.messageId) || m.clientId === clientId)
                      ? { ...m, content: `Deep Research stopped: ${msg}`, chatJobId: undefined }
                      : m,
                  ));
                  if (entry.messageId) {
                    try { await supabase.from("messages").delete().eq("id", entry.messageId); } catch {}
                  }
                } else {
                  await persist();
                }
                removeActiveChatJob(entry.jobId);
              },
              onStale: async (row) => {
                // Worker died mid-run. Mark job failed server-side so it won't appear active anymore,
                // then either persist whatever partial text we have or remove the placeholder.
                try { await failStaleJob(entry.jobId); } catch { /* ignore */ }
                const partial = (row.stream_text || assistantText || "").trim();
                if (partial) {
                  assistantText = partial;
                  await persist();
                } else {
                  setMessages((prev) => prev.map((m) =>
                    ((entry.messageId && m.id === entry.messageId) || m.clientId === clientId)
                      ? { ...m, content: "Deep Research stopped unexpectedly. You can run it again.", chatJobId: undefined }
                      : m,
                  ));
                  if (entry.messageId) {
                    try { await supabase.from("messages").delete().eq("id", entry.messageId); } catch {}
                  }
                }
                removeActiveChatJob(entry.jobId);
              },
            });
          }
        } catch (e) { console.warn("[chat-resume] failed", e); }
      })();
    }
    // Load members for this conversation so names/avatars render correctly
    const { data: memberRows } = await supabase.from("conversation_members").select("user_id, role").eq("conversation_id", id);
    if (memberRows && memberRows.length > 0) {
      const ids = memberRows.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const profMap: Record<string, any> = {};
      (profs || []).forEach((p: any) => { profMap[p.id] = p; });
      setMembers(memberRows.map((m: any) => ({
        id: m.user_id, email: "", role: m.role,
        name: profMap[m.user_id]?.display_name, avatar: profMap[m.user_id]?.avatar_url,
      })));
    } else {
      setMembers([]);
    }
    setLoadingMessages(false);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {abortControllerRef.current.abort();abortControllerRef.current = null;}
    setIsLoading(false);setIsThinking(false);setSearchStatus("");
    const STOPPED_MARK = "_Message cancelled._";
    let finalContent = "";
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last?.role !== "assistant") return prev;
      const existing = (last.content || "").trim();
      finalContent = existing ? `${existing}\n\n${STOPPED_MARK}` : STOPPED_MARK;
      const next = prev.slice();
      next[next.length - 1] = { ...last, content: finalContent };
      return next;
    });
    // Persist the stopped marker so the conversation reflects the cancel on reload
    if (conversationId && finalContent) {
      void saveMessage(conversationId, "assistant", finalContent).catch(() => {});
    }
  };

  const handleModeChange = (mode: ChatMode) => {
    const nextMode = chatMode === mode ? "normal" : mode;
    setChatMode(nextMode);
    if (nextMode !== "learning") {
      setStudyTimers([]);
      setStudyMusic({ kind: null });
    }
    if (mode === "deep-research") {
      setSearchEnabled(true);
    } else if (mode !== "normal") {
      setSearchEnabled(false);
    }
    setPlusMenuOpen(false);
  };

  const handleSearchToggle = () => {
    setSearchEnabled(!searchEnabled);
    if (!searchEnabled) setChatMode("normal");
    setPlusMenuOpen(false);
  };

  const handleStructuredAction = useCallback((text: string) => {
    if (text.startsWith("Connect:")) {
      setConnectorsOpen(true);
      return;
    }
    setInput(text);
    setTimeout(() => {
      setInput(text);
      void sendWithTextRef.current?.(text);
    }, 50);
  }, []);

  // Fix: detect smart questions from the LATEST assistant message when streaming completes
  useEffect(() => {
    if (isLoading) return; // Wait until streaming is done
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;
    
    const jsonBlockRegex = /```json\s*\n?([\s\S]*?)\n?```/g;
    let match;
    const questions: {title: string;options: string[];allowText?: boolean;}[] = [];
    while ((match = jsonBlockRegex.exec(lastMsg.content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.type === "questions" && parsed.questions) {
          questions.push(...parsed.questions);
        }
      } catch {}
    }
    if (questions.length > 0) setPendingQuestions(questions);
  }, [messages, isLoading]);

  const handleQuestionAnswer = (answer: string) => {
    setPendingQuestions([]);
    handleSendWithText(answer);
  };

  const handleQuestionSkip = () => {
    setPendingQuestions([]);
  };

  const isSubmittingRef = useRef(false);
  const sendWithTextRef = useRef<(overrideText?: string) => Promise<void>>();

  const ownInsertedIdsRef = useRef<Set<string>>(new Set());

  const handleSendWithText = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() && attachedFiles.length === 0) return;
    if (isLoading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const imageAttachments = attachedFiles.filter((f) => f.type === "image");
    const fileAttachments = attachedFiles.filter((f) => f.type === "file");
    const localTurnId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const userMsg: Message = {
      role: "user",
      clientId: `user-${localTurnId}`,
      content: text || (attachedFiles.length > 0 ? `[${attachedFiles.length} file(s) attached]` : ""),
      attachedImages: imageAttachments.map((f) => f.data),
      attachedFiles: fileAttachments.map((f) => ({ name: f.name, type: f.type })),
      mode: chatMode,
    };

    // ── Operator mode: keep the normal chat flow; render operator output as the assistant reply ──
    if (chatMode === "operator") {
      const assistantClientId = `assistant-${localTurnId}`;
      setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "Thinking...", clientId: assistantClientId, mode: "operator" }]);
      setInput("");
      setAttachedFiles([]);
      setPendingQuestions([]);
      setNarrations([]);
      setClarifyQs(null);
      try {
        const { launchOperator } = await import("@/components/operator/OperatorWorkspace");
        const runId = await launchOperator(text);
        if (runId) {
          setOperatorRunId(runId);
          setMessages((prev) => prev.map((m) => m.clientId === assistantClientId ? { ...m, operatorRunId: runId } : m));
        } else {
          setMessages((prev) => prev.map((m) => m.clientId === assistantClientId ? { ...m, content: "Could not start Megsy Operator. Make sure you are signed in." } : m));
          toast.error("Could not start Megsy Operator. Make sure you are signed in.");
        }
      } catch (e) {
        setMessages((prev) => prev.map((m) => m.clientId === assistantClientId ? { ...m, content: "An error occurred while running Megsy Operator." } : m));
        toast.error("Error running Operator");
        console.error(e);
      } finally {
        isSubmittingRef.current = false;
      }
      return;
    }


    const assistantMessageIndex = editingIndex !== null ? editingIndex + 1 : messages.length + 1;
    setMessages((prev) => {
      let base = prev;
      if (editingIndex !== null && prev[editingIndex]?.role === "user") {
        base = [...prev];
        base.splice(editingIndex, base[editingIndex + 1]?.role === "assistant" ? 2 : 1);
      }
      return [...base, userMsg, { role: "assistant", content: "", clientId: `assistant-${localTurnId}`, mode: chatMode }];
    });
    if (editingIndex !== null) { setEditingIndex(null); setEditingOriginal(""); }
    const userInput = text;
    setInput("");
    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);
    setIsLoading(true);setIsThinking(true);
    setPendingQuestions([]);
    setNarrations([]);
    setClarifyQs(null);
    if (chatMode === "deep-research") {
      setNarrations([]);
    }

    // ── Auto-route to Slides mode when the user clearly asks for a presentation/deck
    // (Arabic + English keywords). Avoids the LLM answering as plain markdown.
    const SLIDES_INTENT_RE = /(\b(slides?|presentation|pr[ée]sentation|presentaci[óo]n|pr[äa]sentation|deck|pitch\s*deck|powerpoint|pptx?|keynote|diapositiv[aoe]s?|folien)\b|عرض\s*تقديمي|بريزنتيش?ن|برزنتيش?ن|شرائح|شريحة|سلايد(?:ز|ات)?|بوربوينت|كانفا|عرض\s*شرائح)/i;
    if (chatMode === "normal" && SLIDES_INTENT_RE.test(userInput)) {
      setChatMode("slides");
    }

    // ── Slides mode: stream from chat-slides-stream and attach a SlideDeck ─
    if (chatMode === "slides" || (chatMode === "normal" && SLIDES_INTENT_RE.test(userInput))) {
      // Topic guard: refuse to start a deck if the user didn't actually give a topic.
      const slidesTopic = (userInput || "").trim();
      const genericSlideAsks = /^(Build|Build me|Build me|Build me|I want|I want|I want|I want|I want|I want|make|create|generate|build|do)\s*(for me|me)?\s*(slides|slides|View|presentation|presentation|slides|deck|presentation)\s*[!.??]*$/i;
      if (!slidesTopic || slidesTopic.length < 6 || genericSlideAsks.test(slidesTopic)) {
        toast.error("Please describe the slides topic clearly, e.g.: \"Create slides about ancient Egyptian history in 10 slides\"");
        setIsLoading(false); setIsThinking(false); setSearchStatus("");
        isSubmittingRef.current = false;
        // remove the empty assistant bubble we just appended
        setMessages((prev) => prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1]?.content ? prev.slice(0, -1) : prev);
        return;
      }
      const conversationPromise = createOrUpdateConversation(userInput || "Slides").catch(() => null);
      void conversationPromise.then(async (cid) => {
        if (!cid) return;
        const insertedId = await saveMessage(cid, "user", userInput);
        if (insertedId) {
          ownInsertedIdsRef.current.add(insertedId);
          window.dispatchEvent(new CustomEvent("megsy:conversations-changed"));
        }
      });

      // All slide templates (premium + standard) go through the streaming pipeline.
      // Standard templates are mapped to a premium HTML shell server-side so the
      // user always gets real generated slides — never just an iframe to an external site.
      const tplPicked = findSlidesTemplate(slidesTemplate);

      // Premium slides quota: 3 free per day, then 1 credit each
      if (tplPicked.category === "premium" && chatUserId) {
        const auth = await authorizePremiumSlide(chatUserId);
        if (!auth.ok) {
          toast.error((auth as { reason?: string }).reason || "Could not start premium slides");
          setIsLoading(false); setIsThinking(false); setSearchStatus("");
          isSubmittingRef.current = false;
          return;
        }
        if (auth.charged) {
          toast.info(`Used 1 credit (daily ${FREE_PREMIUM_SLIDES_PER_DAY} free premium slides used)`);
        } else if (auth.remainingFree === 0) {
          toast.info("Last free premium slide today — next ones cost 1 credit");
        }
      }

      try {
        const cid = await conversationPromise;
        // Save placeholder slidesPending assistant message immediately so it survives reload.
        let placeholderId: string | null = null;
        if (cid) {
          placeholderId = await saveMessage(
            cid,
            "assistant",
            "",
            undefined,
            { kind: "slidesPending", topic: userInput, templateId: slidesTemplate },
          );
          if (placeholderId) ownInsertedIdsRef.current.add(placeholderId);
          if (placeholderId) {
            setMessages((prev) => prev.map((m) =>
              m.clientId === `assistant-${localTurnId}` ? { ...m, id: placeholderId, slidesPendingTopic: userInput } : m
            ));
          }
          await supabase.from("conversations").update({ updated_at: new Date().toISOString(), mode: "slides" } as any).eq("id", cid);
        }

        const { startJob, subscribeJob } = await import("@/lib/jobs/client");
        const { jobId } = await startJob("slides", {
          topic: userInput,
          templateId: slidesTemplate,
          userId: chatUserId || undefined,
          background: true,
          conversation_id: cid,
          message_id: placeholderId,
        });

        // Persist the jobId onto the placeholder so refresh can resume.
        if (placeholderId) {
          try {
            await supabase.from("messages").update({
              metadata: { kind: "slidesPending", topic: userInput, templateId: slidesTemplate, slidesJobId: jobId } as any,
            }).eq("id", placeholderId);
          } catch { /* best-effort */ }
          setMessages((prev) => prev.map((m) =>
            m.id === placeholderId || m.clientId === `assistant-${localTurnId}`
              ? { ...m, id: placeholderId || m.id, slidesJobId: jobId, slidesPendingTopic: userInput, mode: "slides" }
              : m
          ));
        }

        let narrative = "";
        let finalDeck: any = null;
        setSearchStatus("Starting…");

        await new Promise<void>((resolve) => {
          let unsub: (() => void) | undefined;
          clearSlidesTimeout(jobId);
          slidesTimeoutsRef.current[jobId] = window.setTimeout(() => {
            void failStaleJob(jobId, SLIDES_TIMEOUT_MESSAGE);
            if (placeholderId) {
              void supabase.from("messages").update({
                content: (narrative || SLIDES_TIMEOUT_MESSAGE).trim(),
                metadata: { kind: "slidesError", topic: userInput, templateId: slidesTemplate } as any,
              }).eq("id", placeholderId);
            }
            unsub?.();
            clearSlidesTimeout(jobId);
            setMessages((prev) => prev.map((m) =>
              m.clientId === `assistant-${localTurnId}` || (!!placeholderId && m.id === placeholderId)
                ? { ...m, content: (narrative || SLIDES_TIMEOUT_MESSAGE).trim(), slidesJobId: undefined, mode: "slides" }
                : m
            ));
            toast.error("Slides generation took too long. Please try again.");
            resolve();
          }, SLIDES_CLIENT_TIMEOUT_MS);
          unsub = subscribeJob(jobId, {
            onProgress: (_p, phase) => {
              if (!phase) return;
              const phaseLabels: Record<string, string> = {
                search: "Searching the web…",
                findings: "Reviewing findings…",
                outline: "Drafting the outline…",
                content: "Writing slide content…",
                images: "Selecting images…",
                review: "Reviewing deck quality…",
                finalize: "Finalizing your deck…",
              };
              setSearchStatus(phaseLabels[phase] || `Working: ${phase}…`);
              if (!narrative) setIsThinking(true);
            },
            onDelta: (_chunk, full) => {
              narrative = full;
              setMessages((prev) => prev.map((m) =>
                m.clientId === `assistant-${localTurnId}` || (!!placeholderId && m.id === placeholderId)
                  ? { ...m, content: narrative }
                  : m
              ));
            },
            onOutput: (out) => {
              if (out?.deck) finalDeck = out.deck;
            },
            onDone: async () => {
              clearSlidesTimeout(jobId);
              if (finalDeck) {
                const tpl = findSlidesTemplate(finalDeck.templateId || slidesTemplate);
                const enrichedDeck: SlideDeck & { htmlSlug?: string; variant?: string } = tpl.htmlSlug
                  ? { ...finalDeck, templateId: tpl.id, htmlSlug: tpl.htmlSlug, variant: tpl.variant }
                  : finalDeck;
                setMessages((prev) => prev.map((m) =>
                  m.clientId === `assistant-${localTurnId}` || (!!placeholderId && m.id === placeholderId)
                    ? { ...m, slidesDeck: enrichedDeck, slidesJobId: undefined, mode: "slides" }
                    : m
                ));
                if (placeholderId) {
                  try {
                    await supabase.from("messages").update({
                      content: narrative || `Generated ${enrichedDeck.slides.length} slides`,
                      metadata: { kind: "slidesDeck", slidesDeck: enrichedDeck } as any,
                    }).eq("id", placeholderId);
                  } catch { /* best-effort */ }
                }
              } else {
                if (placeholderId) {
                  void supabase.from("messages").update({
                    content: "Slides generation finished without a deck. Please try again.",
                    metadata: { kind: "slidesError", topic: userInput, templateId: slidesTemplate } as any,
                  }).eq("id", placeholderId);
                }
                setMessages((prev) => prev.map((m) =>
                  m.clientId === `assistant-${localTurnId}` || (!!placeholderId && m.id === placeholderId)
                    ? { ...m, content: "Slides generation finished without a deck. Please try again.", slidesJobId: undefined, mode: "slides" }
                    : m
                ));
                toast.error("Slides generation failed");
              }
              unsub?.();
              resolve();
            },
            onError: (msg) => {
              clearSlidesTimeout(jobId);
              if (placeholderId) {
                void supabase.from("messages").update({
                  content: `Could not create the presentation: ${msg}`,
                  metadata: { kind: "slidesError", topic: userInput, templateId: slidesTemplate } as any,
                }).eq("id", placeholderId);
              }
              setMessages((prev) => prev.map((m) =>
                m.clientId === `assistant-${localTurnId}` || (!!placeholderId && m.id === placeholderId)
                  ? { ...m, content: `Could not create the presentation: ${msg}`, slidesJobId: undefined, mode: "slides" }
                  : m
              ));
              toast.error(`Slides error: ${msg}`);
              unsub?.();
              resolve();
            },
            onStale: async (row) => {
              clearSlidesTimeout(jobId);
              try { await failStaleJob(jobId, "Slides generation stopped unexpectedly. Please try again."); } catch { /* ignore */ }
              const partial = (row.stream_text || narrative || "").trim();
              if (placeholderId) {
                void supabase.from("messages").update({
                  content: partial || "Slides generation stopped unexpectedly. Please try again.",
                  metadata: { kind: "slidesError", topic: userInput, templateId: slidesTemplate } as any,
                }).eq("id", placeholderId);
              }
              setMessages((prev) => prev.map((m) =>
                m.clientId === `assistant-${localTurnId}`
                  ? { ...m, content: partial || "Slides generation stopped unexpectedly. Please try again.", slidesJobId: undefined }
                  : m
              ));
              toast.error("Slides generation stopped unexpectedly. Please try again.");
              unsub?.();
              resolve();
            },
          });
        });
      } catch (e) {
        console.error(e);
        toast.error("Slides generation error");
      } finally {
        setIsLoading(false); setIsThinking(false); setSearchStatus("");
        isSubmittingRef.current = false;
      }
      return;
    }


    // ── @docs agent: server-backed background job; survives tab close ───
    if (selectedAgent?.id === "docs") {
      const conversationPromise = createOrUpdateConversation(userInput || "Document").catch(() => null);
      // Save the user message right away
      void conversationPromise.then(async (cid) => {
        if (!cid) return;
        const insertedId = await saveMessage(cid, "user", userInput);
        if (insertedId) {
          ownInsertedIdsRef.current.add(insertedId);
          window.dispatchEvent(new CustomEvent("megsy:conversations-changed"));
        }
      });

      try {
        startDocsStatusFallback();
        const [{ streamDoc }, { saveDocHtml, newArtifactId }] = await Promise.all([
          import("@/lib/agent/docs/docsGenerator"),
          import("@/lib/agent/docs/htmlCache"),
        ]);
        const recentHistory = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
        const artifactId = newArtifactId();

        // Persist a placeholder assistant message BEFORE starting the job so
        // that even if the user closes the tab, we can resume on reload.
        const cid = await conversationPromise;
        let placeholderMessageId: string | null = null;
        if (cid) {
          placeholderMessageId = await saveMessage(
            cid,
            "assistant",
            "Preparing the document on the server… you can close the tab and we'll save the result here.",
            undefined,
            { kind: "docsPending", originalPrompt: userInput, docsArtifact: { artifactId, title: "Document", docType: "document" } },
          );
          if (placeholderMessageId) {
            ownInsertedIdsRef.current.add(placeholderMessageId);
            setMessages((prev) => prev.map((m) =>
              m.clientId === `assistant-${localTurnId}` ? { ...m, id: placeholderMessageId } : m
            ));
          }
        }

        let pendingMeta: { title: string; doc_type: string } | null = null;
        let lastFlush = 0;
        let isClarify = false;

        const flush = (full: string, force = false) => {
          const now = Date.now();
          if (!force && now - lastFlush < 250) return;
          lastFlush = now;
          setMessages((prev) => prev.map((m) =>
            m.clientId === `assistant-${localTurnId}` ? {
              ...m,
              content: "",
              docsArtifact: {
                artifactId,
                title: pendingMeta?.title ?? "Document",
                docType: pendingMeta?.doc_type ?? "document",
                html: full,
              },
            } : m
          ));
        };

        let finalHtml = "";
        let finalMeta: { title: string; doc_type: string } | null = null;
       let finalFriendly = "";
        let clarifyPayload: { reason: string; questions: any[] } | null = null;
        let receivedJobId: string | null = null;

        await streamDoc(
          {
            prompt: userInput,
            history: recentHistory,
            conversationId: cid ?? null,
            messageId: placeholderMessageId,
          },
          {
            onJobId: async (jobId) => {
              receivedJobId = jobId;
              // Store jobId on the placeholder so reload can resume it.
              if (placeholderMessageId) {
                try {
                  await supabase.from("messages").update({
                    metadata: {
                      kind: "docsPending",
                      originalPrompt: userInput,
                      docsJobId: jobId,
                      docsArtifact: { artifactId, title: "Document", docType: "document" },
                    },
                  }).eq("id", placeholderMessageId);
                } catch { /* best-effort */ }
              }
            },
            onStatus: (text) => { stopDocsStatusFallback(); setSearchStatus(text); },
            onMeta: (m) => {
              pendingMeta = m;
              finalMeta = m;
              flush("<!DOCTYPE html><html><body></body></html>", true);
            },
            onHtmlDelta: (_chunk, full) => {
              finalHtml = full;
              flush(full);
            },
            onHtmlDone: (full, friendly) => {
              finalHtml = full;
              if (friendly) finalFriendly = friendly;
              flush(full, true);
            },
            onClarify: (c) => {
              isClarify = true;
              clarifyPayload = c;
              setMessages((prev) => prev.map((m) =>
                m.clientId === `assistant-${localTurnId}` ? {
                  ...m,
                  content: c.reason,
                  docsArtifact: undefined,
                  docsClarify: { reason: c.reason, questions: c.questions, ui: c.ui, originalPrompt: userInput },
                } : m
              ));
            },
            onError: (msg) => { throw new Error(msg); },
          },
        );

        // Note: the edge function also writes the final state to messages,
        // but we update locally for immediate UI consistency.
        if (isClarify && clarifyPayload && placeholderMessageId) {
          await supabase.from("messages").update({
            content: clarifyPayload.reason,
            metadata: { kind: "docsClarify", docsClarify: { ...clarifyPayload, originalPrompt: userInput } },
          }).eq("id", placeholderMessageId);
        } else if (finalHtml && finalHtml.length > 400 && finalMeta) {
          saveDocHtml(artifactId, finalHtml);
          let friendly = finalFriendly;
          if (!friendly) {
            const { buildDocReadyMessageAI } = await import("@/lib/agent/docs/readyMessage");
            friendly = await buildDocReadyMessageAI({ title: finalMeta.title, html: finalHtml, docType: finalMeta.doc_type, prompt: userInput });
          }
          setMessages((prev) => prev.map((m) =>
            m.clientId === `assistant-${localTurnId}` ? {
              ...m,
              content: friendly,
              docsArtifact: { artifactId, title: finalMeta!.title, docType: finalMeta!.doc_type, html: finalHtml },
            } : m
          ));
          if (placeholderMessageId) {
            await supabase.from("messages").update({
              content: friendly,
              metadata: {
                kind: "docsArtifact",
                docsArtifact: { artifactId, title: finalMeta.title, docType: finalMeta.doc_type, html: finalHtml },
              },
            }).eq("id", placeholderMessageId);
          }
        } else if (!receivedJobId) {
          toast.error("Document was not created — please try again");
          setMessages((prev) => prev.map((m) =>
            m.clientId === `assistant-${localTurnId}` ? {
              ...m, docsArtifact: undefined,
              content: "Could not create the document this time. Try rephrasing or try again.",
            } : m
          ));
        }
      } catch (e) {
        console.error(e);
        const safe = friendlyUserMessage(e, "We couldn't create the document. Please try again.");
        void reportError(e, { source: "docs-generate", context: { localTurnId } });
        toast.error(safe);
        setMessages((prev) => prev.map((m) =>
          m.clientId === `assistant-${localTurnId}` ? { ...m, docsArtifact: undefined, content: safe } : m
        ));
      } finally {
        stopDocsStatusFallback(); setIsLoading(false); setIsThinking(false); setSearchStatus("");
        isSubmittingRef.current = false;
      }
      return;
    }


    const conversationPromise = createOrUpdateConversation(userInput || (currentFiles.length > 0 ? `[${currentFiles.length} file(s)]` : "New chat")).catch(() => null);

    void conversationPromise.then(async (resolvedConversationId) => {
      if (!resolvedConversationId) return;
      const insertedId = await saveMessage(resolvedConversationId, "user", userInput || `[${currentFiles.length} file(s) attached]`);
      if (insertedId) {
        ownInsertedIdsRef.current.add(insertedId);
        window.dispatchEvent(new CustomEvent("megsy:conversations-changed"));
        // Attach id to last user message locally so dedup by id works for echo
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.clientId === `user-${localTurnId}`);
          if (idx < 0) return prev;
          const next = [...prev]; next[idx] = { ...next[idx], id: insertedId, user_id: chatUserId || undefined }; return next;
        });
      }
      // Notify mentioned members
      if (members.length > 0 && userInput) {
        const mentions = Array.from(new Set((userInput.match(/@([A-Za-z0-9_]+)/g) || []).map((m) => m.slice(1).toLowerCase())));
        if (mentions.length > 0) {
          for (const mb of members) {
            if (!mb.name || mb.id === chatUserId) continue;
            const safe = mb.name.replace(/\s+/g, "_").toLowerCase();
            if (mentions.includes(safe)) {
              await supabase.rpc("create_notification" as any, {
                p_user_id: mb.id,
                p_type: "mention",
                p_title: `${userName || "Someone"} mentioned you`,
                p_message: userInput.slice(0, 140),
                p_metadata: { conversation_id: resolvedConversationId },
              });
            }
          }
        }
      }
    });

    // Broadcast that AI is now busy in this conversation
    if (presenceChannelRef.current && chatUserId) {
      presenceChannelRef.current.send({ type: "broadcast", event: "ai_busy", payload: { user_id: chatUserId, name: userName, busy: true } });
    }

    let assistantContent = "";
    let deepResearchPlaceholderId: string | null = null;
    let deepResearchPlaceholderPromise: Promise<string | null> | null = null;
    let deepResearchJobId: string | null = null;
    let assistantRenderTimer: ReturnType<typeof setTimeout> | null = null;
    let hasStartedResponse = false;
    let hadStreamError = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let searchImages: string[] = [];
    let streamedProducts: ProductResult[] = [];
    const sanitizeStreamChunk = makeLeakedToolStreamSanitizer();

    const isToolMarkerChunk = (chunk: string) => {
      const trimmed = chunk.trim();
      return [
        "BROWSE_WEBSITE",
        "WEB_SEARCH",
        "SHOPPING_SEARCH",
        "CONVERT_CURRENCY",
        "GENERATE_IMAGE",
        "GENERATE_VIDEO",
        "GENERATE_VOICE",
        "CANVA_CREATE_SLIDES",
      ].includes(trimmed);
    };

    const flushAssistantUpdate = () => {
      assistantRenderTimer = null;
      const nextContent = assistantContent;
      setMessages((prev) => {
        const assistantIndex = prev.findIndex((m) => m.clientId === `assistant-${localTurnId}`);
        const targetIndex = assistantIndex >= 0 ? assistantIndex : prev.length - 1;
        const last = prev[targetIndex];
        if (last?.role === "assistant") {
          if (last.content === nextContent && (last.products || streamedProducts) === (last.products ? last.products : streamedProducts)) return prev;
          const next = prev.slice();
          next[targetIndex] = { ...last, content: nextContent, products: last.products ?? streamedProducts };
          return next;
        }
        return [...prev, { role: "assistant", content: nextContent, products: streamedProducts, clientId: `assistant-${localTurnId}` }];
      });
    };

    const scheduleAssistantUpdate = (immediate = false) => {
      if (immediate) {
        if (assistantRenderTimer) clearTimeout(assistantRenderTimer);
        flushAssistantUpdate();
        return;
      }
      if (assistantRenderTimer) return;
      assistantRenderTimer = setTimeout(flushAssistantUpdate, 90);
    };

    const updateAssistant = (chunk: string) => {
      if (isToolMarkerChunk(chunk)) return;
      const safeChunk = sanitizeStreamChunk(chunk);
      if (!safeChunk.trim()) return;
      if (!hasStartedResponse) {
        hasStartedResponse = true;
        setIsThinking(false);
        setSearchStatus("");
      }
      const wasEmpty = assistantContent.length === 0;
      assistantContent += safeChunk;
      scheduleAssistantUpdate(wasEmpty);
    };

    const allMessages = [...messages, userMsg].map((m) => {
      const imgs = m.attachedImages || [];
      if (imgs.length > 0) {
        // IMPORTANT: Put text FIRST so the model sees the user's question, then images
        const content: any[] = [];
        if (m.content && m.content.trim()) {
          content.push({ type: "text" as const, text: m.content });
        }
        imgs.forEach((imgData) => {
          content.push({ type: "image_url" as const, image_url: { url: imgData } });
        });
        // Ensure there's always at least text content
        if (content.length === 0) {
          content.push({ type: "text" as const, text: "Please analyze this image." });
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: m.role === "assistant" ? sanitizeLeakedToolText(m.content) : m.content };
    });

    if (currentFiles.some((f) => f.type === "file")) {
      const fileTexts = currentFiles.filter((f) => f.type === "file").map((f) => `--- File: ${f.name} ---\n${f.data}`).join("\n\n");
      const lastMsg = allMessages[allMessages.length - 1];
      if (typeof lastMsg.content === "string") {
        lastMsg.content = `${lastMsg.content}\n\n${fileTexts}`;
      }
    }

    // Mode prompts are now handled server-side via chatMode parameter
    const isDeepResearch = chatMode === "deep-research";
    if (isDeepResearch) {
      setSearchStatus("Preparing deep research...");
    }

    const lastUserText = (userMsg?.content || "").toString();
    const smartSearch = isDeepResearch
      ? true
      : shouldUseWebSearch(lastUserText, searchEnabled);

    // Deep Research and Slides use GPT-5 for higher quality; the rest use Megsy
    const activeModel = (isDeepResearch || (chatMode as string) === "slides") ? "openai/gpt-5" : MEGSY_MODEL;

    // For background jobs (deep-research) we MUST have a conversationId before
    // launching the job so the job row is linked and can be resumed after reload.
    let backgroundCid: string | null = conversationId;
    if (isDeepResearch && !backgroundCid) {
      backgroundCid = await conversationPromise;
    }

    await streamChat({
      messages: allMessages, model: activeModel, tier: megsyTier, searchEnabled: smartSearch,
      deepResearch: isDeepResearch,
      // Deep Research runs as a server-side background job so it keeps going
      // even if the user leaves the page; the client resumes via Realtime.
      background: isDeepResearch,
      onJobStart: isDeepResearch ? (jobId) => {
        deepResearchJobId = jobId;
        const cid = backgroundCid || conversationId;
        if (!cid) {
          console.warn("[research] job started without conversationId — resume will not work");
          return;
        }
        // Local fallback so the same tab can recover even before DB write lands.
        addActiveChatJob({
          jobId,
          conversationId: cid,
          clientId: `assistant-${localTurnId}`,
          userInput: userInput || "Deep Research",
          startedAt: Date.now(),
        });
        // Tag the assistant placeholder so the UI shows a "running on server" state.
        setMessages((prev) => prev.map((m) =>
          m.clientId === `assistant-${localTurnId}` ? ({ ...m, chatJobId: jobId } as any) : m,
        ));
        // Persist a DB placeholder so any device that opens this conversation
        // can resume the in-flight research job via Realtime.
        deepResearchPlaceholderPromise = (async () => {
          try {
            const aId = await saveMessage(cid, "assistant", "", undefined, {
              kind: "researchPending",
              chatJobId: jobId,
              query: userInput || "Deep Research",
            });
            if (aId) {
              deepResearchPlaceholderId = aId;
              ownInsertedIdsRef.current.add(aId);
              setMessages((prev) => prev.map((m) =>
                m.clientId === `assistant-${localTurnId}` ? ({ ...m, id: aId } as any) : m,
              ));
            }
            return aId ?? null;
          } catch (e) {
            console.warn("[research] placeholder save failed", e);
            return null;
          }
        })();
      } : undefined,
      chatMode: chatMode,
      user_id: chatUserId || undefined,
      conversation_id: backgroundCid || conversationId || undefined,
      computerUseEnabled,
      activeAgent: chatMode !== "normal" ? chatMode : (selectedAgent?.id || undefined),
      selectedModel: selectedModel ? { id: selectedModel.id, cost: selectedModel.cost } : undefined,
      activeSkill: undefined,
      availableSkills: [
        ...enabledSkills,
        ...librarySkills.filter((l) => !enabledSkills.some((e) => e.name === l.name)),
      ]
        .slice(0, 16)
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          triggers: s.triggers || [],
          source: s.source,
        })),
      onDelta: updateAssistant,
      onImages: (imgs) => {searchImages = imgs;},
      onProducts: (products) => {
        streamedProducts = products;
        setMessages((prev) => {
          const assistantIndex = prev.findIndex((m) => m.clientId === `assistant-${localTurnId}`);
          const targetIndex = assistantIndex >= 0 ? assistantIndex : prev.length - 1;
          const last = prev[targetIndex];
          if (last?.role !== "assistant") return prev;
          const next = prev.slice();
          next[targetIndex] = { ...last, products };
          return next;
        });
      },
      onStatus: (status) => {
        const normalizedStatus = normalizeStatusLabel(status);
        if (normalizedStatus) {
          setSearchStatus(normalizedStatus);
          setIsThinking(true);
        }
      },
      onBrowser: () => {
        // Browser state no longer tracked in UI
      },
      onEvent: (payload: any) => {
        const ev = payload?.event;
        if (ev === "narration") {
          pushNarration(String(payload.text || ""));
        } else if (ev === "narration_start") {
          // begin a new empty narration item that will be filled by chunks
          setNarrations((prev) => [...prev, ""]);
        } else if (ev === "narration_chunk") {
          const delta = String(payload.delta || "");
          if (!delta) return;
          setNarrations((prev) => {
            if (prev.length === 0) return [delta];
            const next = prev.slice();
            next[next.length - 1] = (next[next.length - 1] || "") + delta;
            return next;
          });
        } else if (ev === "narration_end") {
          setNarrations((prev) => {
            if (prev.length === 0) return prev;
            const last = (prev[prev.length - 1] || "").trim();
            if (last) return prev;
            // discard empty narration
            return prev.slice(0, -1);
          });
        } else if (ev === "clarify_questions") {
          if (Array.isArray(payload.questions)) setClarifyQs(payload.questions);
        }
      },
      onDone: async () => {
        if (hadStreamError) return;
        // Clean up resume pointers — the turn is finishing now.
        if (isDeepResearch) {
          if (deepResearchJobId) removeActiveChatJob(deepResearchJobId);
        }
        const tail = sanitizeStreamChunk("", true);
        if (tail.trim()) {
          assistantContent += tail;
        }
        if (assistantRenderTimer) {
          clearTimeout(assistantRenderTimer);
          flushAssistantUpdate();
        }
        setIsLoading(false);setIsThinking(false);setSearchStatus("");
        isSubmittingRef.current = false;
        if (presenceChannelRef.current && chatUserId) {
          presenceChannelRef.current.send({ type: "broadcast", event: "ai_busy", payload: { user_id: chatUserId, busy: false } });
        }
        if (!assistantContent && searchImages.length === 0 && streamedProducts.length === 0) {
          assistantContent = "There was a delay generating the response, but your request was received. Try sending it again or make it shorter.";
          setMessages((prev) => {
            const assistantIndex = prev.findIndex((m) => m.clientId === `assistant-${localTurnId}`);
            const targetIndex = assistantIndex >= 0 ? assistantIndex : prev.length - 1;
            const last = prev[targetIndex];
            if (last?.role !== "assistant") return [...prev, { role: "assistant", content: assistantContent, clientId: `assistant-${localTurnId}` }];
            const next = prev.slice();
            next[targetIndex] = { ...last, content: assistantContent };
            return next;
          });
        }
        const resolvedConversationId = await conversationPromise;
        if (resolvedConversationId && assistantContent) {
          if (isDeepResearch && !deepResearchPlaceholderId && deepResearchPlaceholderPromise) {
            deepResearchPlaceholderId = await deepResearchPlaceholderPromise;
          }
          let aId: string | undefined;
          if (isDeepResearch && deepResearchPlaceholderId) {
            const { error } = await supabase.from("messages").update({
              content: assistantContent,
              images: searchImages.length > 0 ? searchImages : null,
              metadata: null,
            } as any).eq("id", deepResearchPlaceholderId);
            if (error) {
              const insertedId = await saveMessage(resolvedConversationId, "assistant", assistantContent, searchImages.length > 0 ? searchImages : undefined);
              aId = insertedId;
            } else {
              aId = deepResearchPlaceholderId;
            }
          } else {
            aId = await saveMessage(resolvedConversationId, "assistant", assistantContent, searchImages.length > 0 ? searchImages : undefined);
          }
          if (aId) ownInsertedIdsRef.current.add(aId);
          if (isDeepResearch) {
            const user = await getCachedUser();
            if (user) {
              await supabase.from("research_reports").upsert({
                user_id: user.id,
                session_key: `conv_${resolvedConversationId}_${assistantMessageIndex}`,
                query: userInput || "Deep Research",
                report: assistantContent,
                images: (searchImages.length > 0 ? searchImages : []) as any,
                steps: [] as any,
              } as any, { onConflict: "user_id,session_key" });
            }
          }
          setMessages((prev) => {
            const assistantIndex = prev.findIndex((m) => m.clientId === `assistant-${localTurnId}`);
            const targetIndex = assistantIndex >= 0 ? assistantIndex : prev.length - 1;
            const last = prev[targetIndex];
            if (last?.role !== "assistant") return prev;
            const next = prev.slice();
            next[targetIndex] = {
              ...last,
              id: aId || last.id,
              images: searchImages.length > 0 ? searchImages : last.images,
              products: streamedProducts.length > 0 ? streamedProducts : last.products,
            };
            return next;
          });
          const dbMode = chatMode === "deep-research" ? "research" : (chatMode === "learning" ? "learning" : (chatMode === "shopping" ? "shopping" : "chat"));
          await supabase.from("conversations").update({ updated_at: new Date().toISOString(), mode: dbMode } as any).eq("id", resolvedConversationId);
          window.dispatchEvent(new CustomEvent("megsy:conversations-changed"));
          // Phase 2: passive memory + KG extraction (fire-and-forget)
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token && assistantContent && userInput) {
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-extract-memory`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${session.access_token}`,
                  "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify({
                  user_message: userInput,
                  assistant_reply: assistantContent.slice(0, 4000),
                  conversation_id: resolvedConversationId,
                  message_id: aId,
                }),
              }).catch(() => {});
            }
          } catch { /* ignore */ }
        }
      },
      onError: (err) => {
        hadStreamError = true;
        if (isDeepResearch) {
          if (deepResearchJobId) removeActiveChatJob(deepResearchJobId);
        }
        if (assistantRenderTimer) clearTimeout(assistantRenderTimer);
        toast.error(err);setIsThinking(false);setIsLoading(false);setSearchStatus("");
        if (presenceChannelRef.current && chatUserId) {
          presenceChannelRef.current.send({ type: "broadcast", event: "ai_busy", payload: { user_id: chatUserId, busy: false } });
        }
        const fallbackContent = isDeepResearch && !assistantContent.trim()
          ? "Deep Research stopped before the final report was generated. The request was saved — please try again in a moment."
          : "";
        if (fallbackContent) {
          assistantContent = fallbackContent;
          setMessages((prev) => prev.map((m) => m.clientId === `assistant-${localTurnId}` ? { ...m, content: fallbackContent } : m));
        } else {
          setMessages((prev) => prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1]?.content ? prev.slice(0, -1) : prev);
        }
        void (async () => {
          const contentToSave = assistantContent.trim();
          const resolvedConversationId = await conversationPromise;
          if (!resolvedConversationId) return;
          if (isDeepResearch && !deepResearchPlaceholderId && deepResearchPlaceholderPromise) {
            deepResearchPlaceholderId = await deepResearchPlaceholderPromise;
          }
          if (!contentToSave) {
            if (isDeepResearch && deepResearchPlaceholderId) {
              void supabase.from("messages").delete().eq("id", deepResearchPlaceholderId).then(() => {});
            }
            return;
          }
          let aId: string | undefined;
          if (isDeepResearch && deepResearchPlaceholderId) {
            const { error } = await supabase.from("messages").update({
              content: contentToSave,
              images: searchImages.length > 0 ? searchImages : null,
              metadata: null,
            } as any).eq("id", deepResearchPlaceholderId);
            if (error) {
              const insertedId = await saveMessage(resolvedConversationId, "assistant", contentToSave, searchImages.length > 0 ? searchImages : undefined);
              aId = insertedId;
            } else {
              aId = deepResearchPlaceholderId;
            }
          } else {
            aId = await saveMessage(resolvedConversationId, "assistant", contentToSave, searchImages.length > 0 ? searchImages : undefined);
          }
          if (aId) ownInsertedIdsRef.current.add(aId);
          if (isDeepResearch && chatUserId) {
            await supabase.from("research_reports").upsert({
              user_id: chatUserId,
              session_key: `conv_${resolvedConversationId}_${assistantMessageIndex}`,
              query: userInput || "Deep Research",
              report: contentToSave,
              images: (searchImages.length > 0 ? searchImages : []) as any,
              steps: [] as any,
            } as any, { onConflict: "user_id,session_key" });
          }
          // Passive memory extraction (mem0-style) — runs in background
          try {
            void supabase.functions.invoke("chat-extract-memory", {
              body: {
                user_message: userInput || "",
                assistant_reply: contentToSave,
                conversation_id: resolvedConversationId,
                message_id: aId || null,
              },
            });
          } catch {}
        })();
        isSubmittingRef.current = false;
      },
      signal: controller.signal
    });
  };

  useEffect(() => {
    sendWithTextRef.current = handleSendWithText;
  });

  const handleSend = () => handleSendWithText();

  const handleNewChat = () => {
    if (studyAudioRef.current) { studyAudioRef.current.pause(); studyAudioRef.current.src = ""; }
    setStudyTimers([]);setStudyMusic({ kind: null });setMessages([]);setConversationId(null);setConversationTitle("");setIsLoading(false);setIsThinking(false);setAttachedFiles([]);setSearchStatus("");setChatMode("normal");setSearchEnabled(true);setComputerUseEnabled(true);setIsShared(false);setShareId(null);setShareMode("private");setIsPinned(false);setPendingQuestions([]);setSelectedModel(null);setSelectedAgent(null);isSubmittingRef.current = false;
  };

  const loadUserTracks = useCallback(async () => {
    const user = await getCachedUser();
    if (!user) return;
    const { data } = await supabase
      .from("user_music_tracks")
      .select("id, name, storage_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setUserTracks(data as any);
  }, []);

  useEffect(() => { loadUserTracks(); }, [loadUserTracks]);

  useEffect(() => {
    if (chatMode === "learning") return;
    if (studyAudioRef.current) { studyAudioRef.current.pause(); studyAudioRef.current.src = ""; }
    setStudyMusic({ kind: null });
    setStudyTimers([]);
  }, [chatMode]);

  const playUserTrack = useCallback(async (track: { id: string; name: string; storage_path: string }) => {
    const { data, error } = await supabase.storage.from("user-music").createSignedUrl(track.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error("Failed to load track"); return; }
    if (!studyAudioRef.current) studyAudioRef.current = new Audio();
    studyAudioRef.current.loop = true;
    studyAudioRef.current.src = data.signedUrl;
    studyAudioRef.current.volume = 0.5;
    studyAudioRef.current.play().catch(() => toast.info(`Selected ${track.name} (audio blocked by browser)`));
    setStudyMusic({ kind: track.name });
  }, []);

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) { toast.error("Please choose an audio file"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Max file size is 25MB"); return; }
    const user = await getCachedUser();
    if (!user) { toast.error("Sign in required"); return; }
    setUploadingMusic(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("user-music").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const displayName = file.name.replace(/\.[^.]+$/, "");
      const { data: row, error: insErr } = await supabase
        .from("user_music_tracks")
        .insert({ user_id: user.id, name: displayName, storage_path: path, size_bytes: file.size })
        .select("id, name, storage_path")
        .single();
      if (insErr) throw insErr;
      setUserTracks((prev) => [row as any, ...prev]);
      toast.success("Track saved");
      await playUserTrack(row as any);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploadingMusic(false);
    }
  };

  const deleteUserTrack = async (track: { id: string; storage_path: string; name: string }) => {
    await supabase.storage.from("user-music").remove([track.storage_path]);
    await supabase.from("user_music_tracks").delete().eq("id", track.id);
    setUserTracks((prev) => prev.filter((t) => t.id !== track.id));
    if (studyMusic.kind === track.name) {
      if (studyAudioRef.current) { studyAudioRef.current.pause(); studyAudioRef.current.src = ""; }
      setStudyMusic({ kind: null });
    }
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const fileList = Array.from(files);
    if (attachedFiles.length + fileList.length > 5) {
      toast.error("Maximum 5 files allowed");
      e.target.value = "";
      return;
    }
    for (const file of fileList) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        continue;
      }
      if (file.size === 0) {
        toast.error(`${file.name} is empty`);
        continue;
      }
      if (file.type.startsWith("image/")) {
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            setAttachedFiles((prev) => [...prev, { name: file.name, type: "image", data: reader.result as string }]);
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(file);
        });
      } else {
        const placeholderId = `__parsing_${file.name}_${Date.now()}`;
        setAttachedFiles((prev) => [...prev, { name: `${file.name} (analyzing…)`, type: "file", data: placeholderId }]);
        try {
          const text = await parseUploadedFile(file);
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.type === "file" && f.data === placeholderId
                ? { name: file.name, type: "file", data: text }
                : f,
            ),
          );
          toast.success(`Analyzed ${file.name}`);
        } catch (err: any) {
          setAttachedFiles((prev) => prev.filter((f) => !(f.type === "file" && f.data === placeholderId)));
          toast.error(`Could not read ${file.name}`);
        }
      }
    }
    e.target.value = "";
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const fileList = Array.from(files);
    if (attachedFiles.length + fileList.length > 5) {
      toast.error("Maximum 5 files allowed");
      e.target.value = "";
      return;
    }
    fileList.forEach((file) => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        return;
      }
      if (file.size === 0) {
        toast.error(`${file.name} is empty`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setAttachedFiles((prev) => [...prev, { name: file.name, type: "image", data: reader.result as string }]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attachedFiles.length >= 5) {
      toast.error("Maximum 5 files allowed");
      e.target.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(`${file.name} is too large (max 20MB)`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachedFiles((prev) => [...prev, { name: file.name, type: "image", data: reader.result as string }]);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleShare = async () => {
    setShareDialogOpen(true);
    // Auto-generate the link when opening in public mode with no link yet,
    // so the dialog never sits stuck on "Generating link…".
    if (conversationId && !generatedShareUrl) {
      const mode = isShared ? "public" : (shareMode ?? "public");
      if (mode === "public") {
        // Defer so dialog open animation can start first.
        setTimeout(() => { void handleCreateShareLink("public"); }, 0);
      }
    }
  };

  const handleCreateShareLink = async (modeOverride?: "private" | "public") => {
    if (!conversationId) {
      toast.error("Send a message first, then share the chat.");
      setShareDialogOpen(false);
      return;
    }
    const mode = modeOverride ?? shareMode;
    if (mode === "public") {
      const newShareId = shareId || Math.random().toString(36).substring(2, 10);
      const { error } = await supabase.from("conversations").update({ is_shared: true, share_id: newShareId } as any).eq("id", conversationId);
      if (error) {toast.error("Failed to share");return;}
      setIsShared(true);
      setShareId(newShareId);
      const url = `${window.location.origin}/share/${newShareId}`;
      setGeneratedShareUrl(url);
    } else {
      await supabase.from("conversations").update({ is_shared: false } as any).eq("id", conversationId);
      setIsShared(false);
      setGeneratedShareUrl(null);
      toast.success("Chat set to private");
      setShareDialogOpen(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (generatedShareUrl) {
      await navigator.clipboard.writeText(generatedShareUrl);
      toast.success("Link copied!");
    }
  };

  const handleRename = async () => {
    if (!conversationId || !renameValue.trim()) return;
    await supabase.from("conversations").update({ title: renameValue.trim() }).eq("id", conversationId);
    setConversationTitle(renameValue.trim());
    setIsRenaming(false);
    toast.success("Renamed");
  };

  const [confirmPinOpen, setConfirmPinOpen] = useState(false);
  const handleTogglePin = () => {
    if (!conversationId) return;
    setConfirmPinOpen(true);
  };
  const performTogglePin = async () => {
    if (!conversationId) return;
    const nextPinned = !isPinned;
    const payload = nextPinned
      ? { is_pinned: true, pinned_at: new Date().toISOString() }
      : { is_pinned: false, pinned_at: null };
    const { error } = await supabase.from("conversations").update(payload as any).eq("id", conversationId);
    if (error) { toast.error("Failed to update pin"); return; }
    setIsPinned(nextPinned);
    setConfirmPinOpen(false);
    toast.success(nextPinned ? "Pinned" : "Unpinned");
  };

  const handleInvite = async () => {
    if (!conversationId) { toast.error("Start a conversation first"); return; }
    setInviteDialogOpen(true);
    setInviteLink(null);
    setInviteEmail("");
    const { data: memberRows } = await supabase.from("conversation_members").select("user_id, role").eq("conversation_id", conversationId);
    if (memberRows && memberRows.length > 0) {
      const ids = memberRows.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const profMap: Record<string, any> = {};
      (profs || []).forEach((p: any) => { profMap[p.id] = p; });
      setMembers(memberRows.map((m: any) => ({
        id: m.user_id, email: "", role: m.role,
        name: profMap[m.user_id]?.display_name, avatar: profMap[m.user_id]?.avatar_url,
      })));
    } else {
      setMembers([]);
    }
    // Auto-generate invite link immediately
    const user = await getCachedUser();
    if (!user) return;
    const { data, error } = await supabase.from("conversation_invites").insert({ conversation_id: conversationId, invited_by: user.id } as any).select("invite_token").single();
    if (!error && data) {
      setInviteLink(`${window.location.origin}/invite/${(data as any).invite_token}`);
    }
  };

  const handleSendInviteEmail = async () => {
    if (!conversationId || !inviteEmail.trim()) return;
    setInviteLoading(true);
    const user = await getCachedUser();
    if (!user) { setInviteLoading(false); return; }
    let link = inviteLink;
    if (!link) {
      const { data, error } = await supabase.from("conversation_invites").insert({ conversation_id: conversationId, invited_by: user.id, invite_email: inviteEmail.trim().toLowerCase() } as any).select("invite_token").single();
      if (error) { toast.error("Failed to create invite"); setInviteLoading(false); return; }
      link = `${window.location.origin}/invite/${(data as any).invite_token}`;
      setInviteLink(link);
    }

    // Send actual invite email
    try {
      const { error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          to: inviteEmail.trim().toLowerCase(),
          template: "invite",
          user_id: user.id,
          type: "system",
          variables: {
            name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone",
            invite_link: link,
            app_url: window.location.origin,
          },
        },
      });
      if (emailError) throw emailError;
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
    } catch {
      toast.error("Couldn't send the email — link is ready to share");
    }

    setInviteLoading(false);
  };

  const handleGenerateInviteLink = async () => {
    if (!conversationId) return;
    setInviteLoading(true);
    const user = await getCachedUser();
    if (!user) { setInviteLoading(false); return; }
    const { data, error } = await supabase.from("conversation_invites").insert({ conversation_id: conversationId, invited_by: user.id } as any).select("invite_token").single();
    if (error) { toast.error("Failed to create invite link"); setInviteLoading(false); return; }
    const link = `${window.location.origin}/invite/${(data as any).invite_token}`;
    setInviteLink(link);
    setInviteLoading(false);
  };

  const handleCopyInviteLink = async () => {
    if (inviteLink) { await navigator.clipboard.writeText(inviteLink); toast.success("Invite link copied!"); }
  };

  // Accept invite / deep link / demo conversation on page load
  useEffect(() => {
    // Sidebar navigation: arrived via navigate('/chat', { state: { loadConversationId } })
    const stateCid = (location.state as any)?.loadConversationId as string | undefined;
    if (stateCid && stateCid !== conversationId) {
      loadConversation(stateCid);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    const params = new URLSearchParams(window.location.search);
    
    // Deep link: /chat?conv=xxx
    const convParam = params.get("conv");
    if (convParam && !conversationId) {
      loadConversation(convParam);
      window.history.replaceState({}, "", "/chat");
      return;
    }

    // Auto-resume: if the user has an in-flight background job (slides / docs /
    // deep research) created in the last 30 minutes, jump them back to that
    // conversation so work-in-progress doesn't "disappear" after a refresh or
    // tab close.
    if (!conversationId) {
      (async () => {
        try {
          const user = await getCachedUser();
          if (!user) return;
          const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
          const { data: jobs } = await supabase
            .from("background_jobs")
            .select("conversation_id, status, created_at, kind")
            .eq("user_id", user.id)
            .in("status", ["queued", "running"])
            .gte("created_at", cutoff)
            .not("conversation_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);
          let cid = (jobs as any)?.[0]?.conversation_id as string | undefined;
          if (!cid) {
            const { data: pendingMessages } = await supabase
              .from("messages")
              .select("conversation_id, metadata, created_at")
              .eq("role", "assistant")
              .gte("created_at", cutoff)
              .not("conversation_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(20);
            cid = ((pendingMessages as any[]) || []).find((m) =>
              ["slidesPending", "docsPending", "researchPending"].includes(String(m?.metadata?.kind || ""))
            )?.conversation_id as string | undefined;
          }
          if (cid && !conversationId) loadConversation(cid);
        } catch (e) {
          console.warn("[auto-resume] failed", e);
        }
      })();
    }

    const inviteToken = params.get("invite");
    if (inviteToken) {
      (async () => {
        const user = await getCachedUser();
        if (!user) { toast.error("Please sign in to accept invite"); return; }
        const { data: invite } = await supabase.from("conversation_invites").select("*").eq("invite_token", inviteToken).eq("status", "pending").single();
        if (!invite) { toast.error("Invalid or expired invite"); return; }
        await supabase.from("conversation_members").insert({ conversation_id: (invite as any).conversation_id, user_id: user.id, role: "member" } as any);
        await supabase.from("conversation_invites").update({ status: "accepted", accepted_by: user.id } as any).eq("id", (invite as any).id);
        loadConversation((invite as any).conversation_id);
        window.history.replaceState({}, "", "/chat");
        toast.success("You joined the conversation!");
      })();
      return;
    }

    // Demo conversation on first visit — DB is source of truth (no localStorage)
    (async () => {
      const user = await getCachedUser();
      if (!user) return;
      // If user already has any conversation, skip demo.
      const { count } = await supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (count && count > 0) return;

      const demoUserMsg = "What is Megsy AI? Tell me everything about what you can do.";
      const demoAssistantMsg = `# Welcome to Megsy AI

Megsy is your all-in-one AI platform. Here's everything I can help you with:

## Chat
- **Smart conversations** powered by Google Gemini, with web search, deep research, learning mode, and shopping mode
- **Smart Questions** — I ask you clarifying questions to give better answers
- **File analysis** — upload images, PDFs, documents and I'll analyze them
- **Integrations** — connect Telegram, Discord, Slack, Notion, Zoom, TikTok, Twitter, Shopify, Meta, and more

## Images
- **AI Image Generation** — create stunning images using multiple models (Flux, DALL-E, Midjourney-style, and more)
- **15+ Image Tools** — Face Swap, Background Remover, Clothes Changer, Hair Changer, Inpainting, Retouch, Colorize, Sketch to Image, and more
- **Studio** — your personal gallery of all generated images

## Videos
- **AI Video Generation** — create videos from text or images
- **Video Tools** — Swap Characters, Upscale, Talking Photo, Video Extender, Auto Caption, Lip Sync, Video to Text
- **Community** — browse and reuse prompts from other creators

## Voice
- **Text-to-Speech** — generate natural voices with multiple AI models
- **Voice Cloning** — clone your own voice

## Programming
- **Megsy Workspace** — describe an app and I build it with live preview
- **Full-stack generation** — React, HTML, CSS, JavaScript projects
- **Download** your generated code

## Files
- **Document creation** — generate PDFs, spreadsheets, presentations
- **Smart file analysis** — upload any document for AI analysis

## Settings
- **AI Personalization** — tell me your name, profession, and how you want me to behave
- **Theme customization** — multiple themes and accent colors
- **Language** — auto-translate the entire UI

---

**MC Credits** power everything. You start with free credits and can earn more through referrals (20% commission).

Ask me anything to get started!`;

      // Create conversation
      const _ws2 = getActiveWorkspaceId();
      const { data: conv } = await supabase.from("conversations").insert({ title: "Welcome to Megsy AI", mode: "chat", model: MEGSY_MODEL, user_id: user.id, ...(_ws2 ? { workspace_id: _ws2 } : {}) } as any).select("id").single();
      if (!conv) return;
      await supabase.from("messages").insert([
        { conversation_id: conv.id, role: "user", content: demoUserMsg },
        { conversation_id: conv.id, role: "assistant", content: demoAssistantMsg },
      ]);
      setConversationId(conv.id);
      setConversationTitle("Welcome to Megsy AI");
      setMessages([
        { role: "user", content: demoUserMsg },
        { role: "assistant", content: demoAssistantMsg },
      ]);
    })();
  }, []);

  // Realtime for member join/leave + enrich with profile
  useEffect(() => {
    if (!conversationId) return;
    const enrichMember = async (userId: string, role: string) => {
      const { data: prof } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle();
      return { id: userId, email: "", role, name: (prof as any)?.display_name || undefined, avatar: (prof as any)?.avatar_url || undefined };
    };
    const channel = supabase.channel(`members-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        const m = payload.new as any;
        const enriched = await enrichMember(m.user_id, m.role);
        setMembers((prev) => prev.some((x) => x.id === m.user_id) ? prev : [...prev, enriched]);
        if (m.user_id !== chatUserId) {
          setSystemEvents((prev) => [...prev, { id: `j-${m.user_id}-${Date.now()}`, text: `${enriched.name || "Someone"} joined the conversation`, at: Date.now() }]);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const old = payload.old as any;
        let leftName = "Someone";
        setMembers((prev) => {
          const found = prev.find((m) => m.id === old.user_id);
          if (found?.name) leftName = found.name;
          return prev.filter((m) => m.id !== old.user_id);
        });
        if (old.user_id === chatUserId) {
          toast.error("You were removed from this chat");
          handleNewChat();
        } else {
          setSystemEvents((prev) => [...prev, { id: `l-${old.user_id}-${Date.now()}`, text: `${leftName} left the conversation`, at: Date.now() }]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, chatUserId]);

  // Realtime: new messages + presence (typing + AI-busy lock)
  useEffect(() => {
    if (!conversationId || !chatUserId) return;
    const msgChannel = supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        const newMsg = payload.new as any;
        // Skip echoes of messages we just inserted ourselves
        if (newMsg.id && ownInsertedIdsRef.current.has(newMsg.id)) return;
        let senderName: string | null = null;
        let senderAvatar: string | null = null;
        if (newMsg.user_id) {
          const { data: prof } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", newMsg.user_id).maybeSingle();
          senderName = (prof as any)?.display_name || null;
          senderAvatar = (prof as any)?.avatar_url || null;
        }
        setMessages((prev) => {
          if (newMsg.id && prev.some((m) => m.id === newMsg.id)) return prev;
          // Match a local pending message (no id yet) by role + content.
          // For assistant messages (user_id is null) we still need to merge,
          // otherwise realtime echo racing saveMessage() inserts a duplicate card.
          const isAssistantEcho = !newMsg.user_id && newMsg.role === "assistant";
          const isOwnUserEcho = newMsg.user_id && newMsg.user_id === chatUserId;
          const localPendingIndex = (isOwnUserEcho || isAssistantEcho)
            ? prev.findIndex((m) => !m.id && m.role === newMsg.role && m.content === newMsg.content)
            : -1;
          if (localPendingIndex >= 0) {
            const next = prev.slice();
            next[localPendingIndex] = {
              ...next[localPendingIndex],
              images: newMsg.images || next[localPendingIndex].images,
              id: newMsg.id,
              user_id: newMsg.user_id,
              senderName,
              senderAvatar,
            };
            return next;
          }
          return [...prev, {
            role: newMsg.role,
            content: newMsg.content,
            images: newMsg.images || undefined,
            id: newMsg.id,
            user_id: newMsg.user_id,
            senderName,
            senderAvatar,
          }];
        });
        // Smart auto-scroll: only scroll if user is near bottom; else show "new messages" badge
        const el = messagesContainerRef.current;
        const nearBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight) < 200 : true;
        if (nearBottom) {
          setTimeout(() => scrollToBottom(), 100);
        } else if (newMsg.user_id !== chatUserId) {
          setNewMessagesCount((c) => c + 1);
        }
        // Sound + title badge if from another user
        if (newMsg.user_id && newMsg.user_id !== chatUserId) {
          if (typeof document !== "undefined" && document.hidden) {
            setUnreadCount((c) => c + 1);
            playNotificationSound();
          } else if (!nearBottom) {
            playNotificationSound();
          }
        }
      })
      .subscribe();

    const presence = supabase.channel(`presence-${conversationId}`, {
      config: { broadcast: { self: false }, presence: { key: chatUserId } },
    });
    presence
      .on("broadcast", { event: "typing" }, ({ payload }: any) => {
        if (!payload?.user_id || payload.user_id === chatUserId) return;
        setTypingUsers((prev) => {
          const next = prev.filter((u) => u.id !== payload.user_id);
          return [...next, { id: payload.user_id, name: payload.name || "Someone", avatar: payload.avatar || null }];
        });
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== payload.user_id));
        }, 3500);
      })
      .on("broadcast", { event: "stop_typing" }, ({ payload }: any) => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== payload?.user_id));
      })
      .on("broadcast", { event: "ai_busy" }, ({ payload }: any) => {
        if (!payload || payload.user_id === chatUserId) return;
        setRemoteAiBusy(payload.busy ? { name: payload.name || "Someone" } : null);
      })
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState() as Record<string, any>;
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({ user_id: chatUserId, online_at: new Date().toISOString() });
        }
      });
    presenceChannelRef.current = presence;

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(presence);
      presenceChannelRef.current = null;
      setOnlineUsers(new Set());
    };
  }, [conversationId, chatUserId]);

  // Throttled typing broadcast
  useEffect(() => {
    if (!presenceChannelRef.current || !chatUserId || !input.trim()) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    presenceChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: chatUserId, name: userName, avatar: null },
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.send({ type: "broadcast", event: "stop_typing", payload: { user_id: chatUserId } });
    }, 2000);
  }, [input, chatUserId, userName]);

  const handleKickMember = async (memberId: string) => {
    if (!conversationId) return;
    if (!window.confirm("Remove this member?")) return;
    const { error } = await supabase.from("conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", memberId);
    if (error) { toast.error("Failed to remove member"); return; }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("Member removed");
  };

  // Track avatar map for quick lookup
  const memberMap = useMemo(() => {
    const m: Record<string, { name?: string; avatar?: string }> = {};
    members.forEach((mb) => { m[mb.id] = { name: mb.name, avatar: mb.avatar }; });
    if (chatUserId) m[chatUserId] = { name: userName || "You", avatar: undefined };
    return m;
  }, [members, chatUserId, userName]);

  const readersByMessageId = useMemo(() => {
    const result: Record<string, { user_id: string; name?: string; avatar?: string }[]> = {};
    Object.entries(messageReads).forEach(([messageId, readers]) => {
      const visibleReaders = readers
        .filter((r) => r.user_id !== chatUserId)
        .map((r) => ({ user_id: r.user_id, name: memberMap[r.user_id]?.name, avatar: memberMap[r.user_id]?.avatar }));
      if (visibleReaders.length > 0) result[messageId] = visibleReaders;
    });
    return result;
  }, [messageReads, chatUserId, memberMap]);

  // Load reactions + reads for current conversation, subscribe to realtime
  useEffect(() => {
    if (!conversationId || !chatUserId) return;
    let cancelled = false;
    (async () => {
      const [{ data: reads }, { data: reactions }] = await Promise.all([
        supabase.from("message_reads" as any).select("message_id, user_id").eq("conversation_id", conversationId),
        supabase.from("message_reactions" as any).select("id, message_id, user_id, emoji").eq("conversation_id", conversationId),
      ]);
      if (cancelled) return;
      const readsMap: Record<string, { user_id: string; name?: string; avatar?: string }[]> = {};
      (reads || []).forEach((r: any) => { (readsMap[r.message_id] ||= []).push({ user_id: r.user_id }); });
      setMessageReads(readsMap);
      const reactMap: Record<string, { id: string; emoji: string; user_id: string }[]> = {};
      (reactions || []).forEach((r: any) => { (reactMap[r.message_id] ||= []).push({ id: r.id, emoji: r.emoji, user_id: r.user_id }); });
      setMessageReactions(reactMap);
    })();

    const ch = supabase.channel(`reads-reactions-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reads", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const r = payload.new as any;
        setMessageReads((prev) => {
          const list = prev[r.message_id] || [];
          if (list.some((x) => x.user_id === r.user_id)) return prev;
          return { ...prev, [r.message_id]: [...list, { user_id: r.user_id }] };
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const r = payload.new as any;
        setMessageReactions((prev) => {
          const list = prev[r.message_id] || [];
          if (list.some((x) => x.id === r.id)) return prev;
          return { ...prev, [r.message_id]: [...list, { id: r.id, emoji: r.emoji, user_id: r.user_id }] };
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const old = payload.old as any;
        setMessageReactions((prev) => {
          const list = prev[old.message_id] || [];
          return { ...prev, [old.message_id]: list.filter((x) => x.id !== old.id) };
        });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); markedReadRef.current.clear(); };
  }, [conversationId, chatUserId]);

  // Mark visible messages as read
  useEffect(() => {
    if (!conversationId || !chatUserId || messages.length === 0) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const toMark = messages
      .filter((m) => m.id && m.user_id !== chatUserId && !markedReadRef.current.has(m.id))
      .map((m) => m.id!);
    if (toMark.length === 0) return;
    toMark.forEach((id) => markedReadRef.current.add(id));
    const t = setTimeout(() => {
      supabase.from("message_reads" as any).insert(
        toMark.map((mid) => ({ message_id: mid, user_id: chatUserId, conversation_id: conversationId }))
      ).then(({ error }: any) => { if (error) toMark.forEach((id) => markedReadRef.current.delete(id)); });
    }, 500);
    return () => clearTimeout(t);
  }, [messages, conversationId, chatUserId]);

  // Sound + document title for unread when tab hidden
  useEffect(() => {
    if (!originalTitleRef.current) originalTitleRef.current = document.title;
    const onVis = () => { if (!document.hidden) { setUnreadCount(0); document.title = originalTitleRef.current; } };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  useEffect(() => {
    if (unreadCount > 0) document.title = `(${unreadCount}) ${originalTitleRef.current || "Chat"}`;
    else if (originalTitleRef.current) document.title = originalTitleRef.current;
  }, [unreadCount]);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.26);
      setTimeout(() => ctx.close(), 400);
    } catch {}
  }, []);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!conversationId || !chatUserId) return;
    const existing = (messageReactions[messageId] || []).find((r) => r.user_id === chatUserId && r.emoji === emoji);
    if (existing) {
      setMessageReactions((prev) => ({ ...prev, [messageId]: (prev[messageId] || []).filter((r) => r.id !== existing.id) }));
      await supabase.from("message_reactions" as any).delete().eq("id", existing.id);
    } else {
      const tempId = `tmp-${Date.now()}`;
      setMessageReactions((prev) => ({ ...prev, [messageId]: [...(prev[messageId] || []), { id: tempId, emoji, user_id: chatUserId }] }));
      const { data, error } = await supabase.from("message_reactions" as any).insert({ message_id: messageId, user_id: chatUserId, conversation_id: conversationId, emoji }).select("id").single();
      if (error) {
        setMessageReactions((prev) => ({ ...prev, [messageId]: (prev[messageId] || []).filter((r) => r.id !== tempId) }));
      } else if (data) {
        setMessageReactions((prev) => ({ ...prev, [messageId]: (prev[messageId] || []).map((r) => r.id === tempId ? { ...r, id: (data as any).id } : r) }));
      }
    }
    setReactionPickerFor(null);
  }, [conversationId, chatUserId, messageReactions]);

  // Mention detection from input
  useEffect(() => {
    if (members.length === 0) { setMentionQuery(null); return; }
    const m = input.match(/(?:^|\s)@(\w{0,30})$/);
    if (m) setMentionQuery({ q: m[1] || "", start: input.length - m[1].length - 1 });
    else setMentionQuery(null);
  }, [input, members.length]);

  const insertMention = useCallback((name: string) => {
    if (!mentionQuery) return;
    const before = input.slice(0, mentionQuery.start);
    const safeName = name.replace(/\s+/g, "_");
    setInput(`${before}@${safeName} `);
    setMentionQuery(null);
  }, [input, mentionQuery]);

  const handleDelete = () => {
    if (!conversationId) return;
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!conversationId) return;
    setIsDeleting(true);
    const { error: msgErr } = await supabase.from("messages").delete().eq("conversation_id", conversationId);
    const { error: convErr } = await supabase.from("conversations").delete().eq("id", conversationId);
    setIsDeleting(false);
    setConfirmDeleteOpen(false);
    if (msgErr || convErr) { toast.error("Failed to delete"); return; }
    toast.success("Chat deleted");
    handleNewChat();
  };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<string>("");
  const handleEditUserMessageAt = useCallback((index: number, messageText: string) => {
    setEditingIndex(index);
    setEditingOriginal(messageText);
    setInput(messageText);
    // Focus textarea on next tick
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>('textarea');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 50);
  }, []);
  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingOriginal("");
    setInput("");
  }, []);

  const hasConversation = messages.length > 0;

  const iosSpring = { type: "spring" as const, damping: 22, stiffness: 350 };

  const renderPlusMenu = () => {
    const content = (
        <AnimatePresence mode="wait" initial={false}>
          {plusView === "main" ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-1"
            >
              {/* Top row: 3 large flat tiles (Gemini style) */}
              <div className="grid grid-cols-3 gap-2.5 mb-2">
                {[
                  { icon: Camera, label: "Camera", onClick: () => { cameraInputRef.current?.click(); setPlusMenuOpen(false); } },
                  { icon: Image, label: "Photos", onClick: () => { imageInputRef.current?.click(); setPlusMenuOpen(false); } },
                  { icon: FileUp, label: "Files", onClick: () => { fileInputRef.current?.click(); setPlusMenuOpen(false); } },
                ].map(({ icon: Icon, label, onClick }) => (
                  <motion.button
                    key={label}
                    whileTap={{ scale: 0.96 }}
                    transition={iosSpring}
                    onClick={onClick}
                    className="flex flex-col items-center justify-center gap-2.5 h-[108px] rounded-[22px] bg-muted/70 dark:bg-white/[0.06] hover:bg-muted dark:hover:bg-white/[0.09] transition-colors"
                  >
                    <Icon className="w-7 h-7 text-foreground/80" strokeWidth={1.5} />
                    <span className="text-[13px] font-medium text-foreground/85">{label}</span>
                  </motion.button>
                ))}
              </div>


              {chatMode === "learning" ? (
                <>
                  {/* Play music */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={iosSpring}
                    onClick={() => setPlusView("music")}
                    className="w-full flex items-center gap-4 px-2 py-3.5 text-left"
                  >
                    <Music2 className="w-[22px] h-[22px] text-foreground/80 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15.5px] font-semibold text-foreground/90 leading-tight">Play music</div>
                      <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 truncate whitespace-nowrap">{studyMusic.kind || "Off — pick a focus soundscape"}</div>
                    </div>
                  </motion.button>

                  {/* Focus timer */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={iosSpring}
                    onClick={() => setPlusView("timer")}
                    className="w-full flex items-center gap-4 px-2 py-3.5 text-left"
                  >
                    <Timer className="w-[22px] h-[22px] text-foreground/80 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15.5px] font-semibold text-foreground/90 leading-tight">Focus timer</div>
                      <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 truncate whitespace-nowrap">Stay on task with a Pomodoro countdown</div>
                    </div>
                  </motion.button>
                </>
              ) : (
                <div className="flex flex-col">
                  {/* Model */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={iosSpring}
                    onClick={() => setPlusView("models")}
                    className="w-full flex items-center gap-4 px-2 py-3.5 text-left"
                  >
                    <Atom className="w-[22px] h-[22px] text-foreground/80 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15.5px] font-semibold text-foreground/90 leading-tight">Model</span>
                        {(megsyTier === "pro" || megsyTier === "max") && (
                          <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-muted text-foreground/70">PRO</span>
                        )}
                      </div>
                      <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 capitalize truncate whitespace-nowrap">{megsyTier} — tap to switch intelligence</div>
                    </div>
                  </motion.button>

                  {/* Web search row */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={iosSpring}
                    onClick={handleSearchToggle}
                    className="w-full flex items-center gap-4 px-2 py-3.5 text-left"
                  >
                    <Globe className="w-[22px] h-[22px] text-foreground/80 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15.5px] font-semibold text-foreground/90 leading-tight">Web search</div>
                      <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 truncate whitespace-nowrap">Browse the web for up-to-date answers</div>
                    </div>
                    <div
                      className="relative shrink-0 rounded-full transition-colors duration-200 ease-out"
                      style={{ width: 40, height: 24, backgroundColor: searchEnabled ? "#34C759" : "#e9e9eb" }}
                    >
                      <motion.div
                        layout
                        transition={iosSpring}
                        className="absolute top-1/2 rounded-full bg-white"
                        style={{
                          width: 20, height: 20, marginTop: -10,
                          left: searchEnabled ? 18 : 2,
                          boxShadow: "0px 3px 8px rgba(0,0,0,0.15), 0px 3px 1px rgba(0,0,0,0.06)",
                        }}
                      />
                    </div>
                  </motion.button>

                  {/* Skills row */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={iosSpring}
                    onClick={() => setPlusView("skills")}
                    className="w-full flex items-center gap-4 px-2 py-3.5 text-left"
                  >
                    <Lightbulb className="w-[22px] h-[22px] text-foreground/80 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15.5px] font-semibold text-foreground/90 leading-tight">Skills</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-foreground/70">New</span>
                      </div>
                      <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 truncate whitespace-nowrap">
                        {enabledSkills.length > 0 ? `${enabledSkills.length} skill${enabledSkills.length === 1 ? "" : "s"} enabled` : "Enable specialized abilities on demand"}
                      </div>
                    </div>
                  </motion.button>

                  {/* Tools row */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    transition={iosSpring}
                    onClick={() => setPlusView("tools")}
                    className="w-full flex items-center gap-4 px-2 py-3.5 text-left"
                  >
                    <Wrench className="w-[22px] h-[22px] text-foreground/80 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15.5px] font-semibold text-foreground/90 leading-tight">Use tools</div>
                      <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 truncate whitespace-nowrap">Connect apps like Gmail, Drive and more</div>
                    </div>
                  </motion.button>

                  {/* Divider between settings and agents */}
                  <div className="h-px bg-border/60 my-2 mx-2" />

                  {/* Agents — rendered as plain rows, no section header */}
                  {([
                      { id: "deep-research", label: "Deep Research", desc: "In-depth multi-source reports", Icon: Telescope },
                      { id: "slides", label: "Slides", desc: "Generate beautiful presentations", Icon: LayoutTemplate },
                      { id: "learning", label: "Learning", desc: "Guided tutor mode", Icon: GraduationCap },
                      { id: "docs", label: "Docs", desc: "Long-form documents & reports", Icon: ScrollText },
                    ] as const).map((a) => {
                      const active = a.id === "docs" ? selectedAgent?.id === "docs" : chatMode === a.id;
                      return (
                        <motion.button
                          key={a.id}
                          whileTap={{ scale: 0.98 }}
                          transition={iosSpring}
                          onClick={() => {
                            if (a.id === "docs") {
                              if (active) { setSelectedAgent(null); }
                              else {
                                setChatMode("normal");
                                import("@/lib/agentRegistry").then(({ AGENTS }) => {
                                  const def = AGENTS.find((x) => x.id === "docs");
                                  if (def) setSelectedAgent(def);
                                });
                              }
                            } else {
                              handleModeChange(active ? "normal" : (a.id as ChatMode));
                            }
                            setPlusMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-4 px-2 py-3.5 text-left"
                        >
                          <a.Icon className="w-[22px] h-[22px] text-foreground/80 shrink-0" strokeWidth={1.5} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[15.5px] font-semibold text-foreground/90 leading-tight">{a.label}</div>
                            <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 truncate whitespace-nowrap">{a.desc}</div>
                          </div>
                        </motion.button>
                      );
                    })}
                </div>
              )}
            </motion.div>
          ) : plusView === "models" ? (
            <motion.div
              key="models"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col"
            >
              <div className="flex items-center gap-1 px-1.5 pt-1 pb-2">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setPlusView("main")}
                  className="w-7 h-7 flex items-center justify-center rounded-full liquid-glass-hover"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground/80" />
                </motion.button>
                <span className="text-[13px] font-semibold text-foreground/85">Choose Model</span>
              </div>

              <div className="flex flex-col gap-1">
                {([
                  { id: "lite" as const, label: "Lite", desc: "Fast everyday answers", pro: false },
                  { id: "pro" as const, label: "Pro", desc: "Smarter reasoning", pro: true },
                  { id: "max" as const, label: "Max", desc: "1T+ flagship intelligence", pro: true },
                ]).map(t => {
                  const locked = t.pro && (userPlan === "free" || userPlan === "trial");
                  const active = megsyTier === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      whileTap={{ scale: 0.98 }}
                      transition={iosSpring}
                      onClick={() => {
                        if (locked) {
                          toast.info("Megsy " + t.label + " is available on premium plans only");
                          return;
                        }
                        setMegsyTier(t.id);
                        if (chatUserId) {
                          supabase.from("ai_personalization").upsert({ user_id: chatUserId, preferred_tier: t.id } as any, { onConflict: "user_id" }).then(() => {});
                        }
                        setPlusView("main");
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${active ? "bg-primary/10 border border-primary/30" : "liquid-glass-hover border border-transparent"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold text-foreground/90">{t.label}</span>
                          {t.pro && (
                            <span className="text-[8px] font-bold px-1 py-px rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">PRO</span>
                          )}
                          {locked && <span className="text-[10px] opacity-70">🔒</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight">{t.desc}</div>
                      </div>
                      {active && <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : plusView === "skills" ? (
            <motion.div
              key="skills"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col"
            >
              <div className="flex items-center gap-1 px-1.5 pt-1 pb-2">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setPlusView("main")}
                  className="w-7 h-7 flex items-center justify-center rounded-full liquid-glass-hover"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground/80" />
                </motion.button>
                <span className="flex-1 text-[13px] font-semibold text-foreground/85">Skills</span>
                <button
                  onClick={() => { setPlusMenuOpen(false); navigate("/settings/skills"); }}
                  className="text-[11.5px] text-primary font-medium hover:opacity-80 px-2"
                >
                  Manage
                </button>
              </div>

              <div className="flex flex-col gap-1 max-h-[55vh] overflow-y-auto pr-0.5">
                <div className="px-3 pb-2 text-[11px] text-muted-foreground leading-snug">
                  Toggle the skills you want available. The AI decides which to use for each message — like Claude.
                </div>

                {mySkills.length === 0 && (
                  <button
                    onClick={() => { setPlusMenuOpen(false); navigate("/settings/skills"); }}
                    className="w-full flex items-center justify-center gap-2 py-5 mt-1 text-[12.5px] text-primary border border-dashed border-primary/30 rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add your first skill
                  </button>
                )}

                {mySkills.map((skill) => {
                  const enabled = skill.is_enabled !== false;
                  return (
                    <div
                      key={`mine-${skill.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleEnabled(skill, !enabled)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleEnabled(skill, !enabled); } }}
                      className={`w-full text-left px-3 py-2.5 rounded-2xl transition-colors cursor-pointer ${enabled ? "bg-primary/10" : "hover:bg-muted/40"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`flex-1 text-[13.5px] font-semibold truncate ${enabled ? "text-foreground/95" : "text-foreground/60"}`}>{skill.name}</span>
                        <span
                          className={`relative inline-flex h-[18px] w-[30px] items-center rounded-full transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-muted"}`}
                          aria-hidden="true"
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${enabled ? "translate-x-[14px]" : "translate-x-[2px]"}`}
                          />
                        </span>
                      </div>
                      {skill.description && (
                        <div className={`text-[11px] leading-tight truncate ${enabled ? "text-muted-foreground" : "text-muted-foreground/60"}`}>{skill.description}</div>
                      )}
                    </div>
                  );
                })}

                {librarySkills.length > 0 && (
                  <div className="mt-2 px-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">Library</div>
                )}
                {librarySkills.filter((l) => !mySkills.some((m) => m.name === l.name)).map((skill) => (
                  <div key={`sys-${skill.id}`} className="px-3 py-2 rounded-2xl opacity-80 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-[13px] font-medium text-foreground/85 truncate">{skill.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Built-in</span>
                    </div>
                    {skill.description && <div className="text-[11px] text-muted-foreground leading-tight truncate">{skill.description}</div>}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : plusView === "music" ? (
            <motion.div
              key="music"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col"
            >
              <div className="flex items-center gap-1 px-1.5 pt-1 pb-2">
                <motion.button whileTap={{ scale: 0.92 }} onClick={() => setPlusView("main")} className="w-7 h-7 flex items-center justify-center rounded-full liquid-glass-hover" aria-label="Back">
                  <ChevronLeft className="w-4 h-4 text-foreground/80" />
                </motion.button>
                <span className="text-[13px] font-semibold text-foreground/85">Study music</span>
              </div>
              <div className="flex flex-col gap-1">
                {[
                  { id: "Lo-fi", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3" },
                  { id: "Classical", url: "https://cdn.pixabay.com/audio/2022/10/25/audio_92215f17a4.mp3" },
                  { id: "Nature sounds", url: "https://cdn.pixabay.com/audio/2022/03/15/audio_e1ada46b94.mp3" },
                  { id: "Focus beats", url: "https://cdn.pixabay.com/audio/2023/06/02/audio_5d4cb33a1d.mp3" },
                  { id: "White noise", url: "https://cdn.pixabay.com/audio/2022/03/24/audio_e87a37a40b.mp3" },
                  { id: "Off", url: "" },
                ].map((opt) => {
                  const active = (studyMusic.kind || "Off") === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      whileTap={{ scale: 0.98 }}
                      transition={iosSpring}
                      onClick={() => {
                        if (opt.id === "Off") {
                          setStudyMusic({ kind: null });
                          if (studyAudioRef.current) { studyAudioRef.current.pause(); studyAudioRef.current.src = ""; }
                        } else {
                          setStudyMusic({ kind: opt.id });
                          if (!studyAudioRef.current) studyAudioRef.current = new Audio();
                          studyAudioRef.current.loop = true;
                          studyAudioRef.current.src = opt.url;
                          studyAudioRef.current.volume = 0.5;
                          studyAudioRef.current.play().catch(() => toast.info(`Selected ${opt.id} (audio blocked by browser)`));
                        }
                        setPlusView("main");
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${active ? "bg-emerald-500/10 border border-emerald-500/30" : "liquid-glass-hover border border-transparent"}`}
                    >
                      <Music2 className="w-[18px] h-[18px] text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                      <span className="flex-1 text-[13.5px] text-foreground/90">{opt.id}</span>
                      {active && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />}
                    </motion.button>
                  );
                })}

                {/* Upload your own track */}
                <button
                  type="button"
                  disabled={uploadingMusic}
                  onClick={() => musicFileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-dashed border-emerald-500/40 hover:bg-emerald-500/5 transition-colors text-left disabled:opacity-60"
                >
                  {uploadingMusic
                    ? <Loader2 className="w-[18px] h-[18px] text-emerald-600 dark:text-emerald-400 animate-spin" />
                    : <Plus className="w-[18px] h-[18px] text-emerald-600 dark:text-emerald-400" strokeWidth={2} />}
                  <span className="flex-1 text-[13.5px] text-foreground/90">{uploadingMusic ? "Uploading…" : "Upload your music"}</span>
                </button>

                {userTracks.length > 0 && (
                  <>
                    <div className="mt-2 px-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">My tracks</div>
                    {userTracks.map((track) => {
                      const active = studyMusic.kind === track.name;
                      return (
                        <div
                          key={track.id}
                          className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${active ? "bg-emerald-500/10 border border-emerald-500/30" : "liquid-glass-hover border border-transparent"}`}
                        >
                          <button
                            onClick={() => { playUserTrack(track); setPlusView("main"); }}
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                          >
                            <Music2 className="w-[18px] h-[18px] text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                            <span className="flex-1 text-[13.5px] text-foreground/90 truncate">{track.name}</span>
                            {active && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.5} />}
                          </button>
                          <button
                            onClick={() => deleteUserTrack(track)}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                            aria-label={`Delete ${track.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <input
                ref={musicFileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleMusicUpload}
              />
            </motion.div>
          ) : plusView === "timer" ? (
            <motion.div
              key="timer"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col"
            >
              <div className="flex items-center gap-1 px-1.5 pt-1 pb-2">
                <motion.button whileTap={{ scale: 0.92 }} onClick={() => setPlusView("main")} className="w-7 h-7 flex items-center justify-center rounded-full liquid-glass-hover" aria-label="Back">
                  <ChevronLeft className="w-4 h-4 text-foreground/80" />
                </motion.button>
                <span className="text-[13px] font-semibold text-foreground/85">Focus timer</span>
              </div>
              <div className="px-2 pb-1">
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[15, 25, 45, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTimerInputMin(m)}
                      className={`py-2 rounded-xl text-[12.5px] font-semibold transition-colors ${timerInputMin === m ? "bg-emerald-600 text-white" : "liquid-glass-hover text-foreground/85"}`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={timerInputMin}
                    onChange={(e) => setTimerInputMin(Math.max(1, Math.min(180, parseInt(e.target.value || "0") || 1)))}
                    className="flex-1 bg-transparent border border-border/40 rounded-xl px-3 py-2 text-[13px] text-foreground outline-none focus:border-emerald-500/60"
                  />
                  <span className="text-[12px] text-muted-foreground">minutes</span>
                </div>
                <button
                  onClick={() => {
                    const id = `timer-${Date.now()}`;
                    setStudyTimers((prev) => [...prev, { id, totalSec: timerInputMin * 60, startedAt: Date.now(), paused: false, pausedRemaining: null }]);
                    setPlusMenuOpen(false);
                    setTimeout(() => scrollToBottom(), 100);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500 transition-colors"
                >
                  <Play className="w-4 h-4" fill="currentColor" /> Start session
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="tools"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col"
            >
              <div className="flex items-center gap-1 px-1.5 pt-1 pb-1.5">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setPlusView("main")}
                  className="w-7 h-7 flex items-center justify-center rounded-full liquid-glass-hover"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground/80" />
                </motion.button>
                <span className="text-[13px] font-semibold text-foreground/85">Tools</span>
              </div>

              {userIntegrations.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[13px] text-foreground/80 mb-1">You're not connected to any apps yet</p>
                  <p className="text-[11px] text-muted-foreground mb-3">Connect tools to extend Megsy with your data.</p>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    transition={iosSpring}
                    onClick={() => { setPlusMenuOpen(false); setConnectorsOpen(true); }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Connect now
                  </motion.button>
                </div>
              ) : (
                <div className="flex flex-col">
                  {userIntegrations.map((name) => (
                    <div key={name} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl">
                      <div className="w-7 h-7 rounded-lg bg-secondary/70 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="flex-1 text-[13.5px] text-foreground/85">{name}</span>
                    </div>
                  ))}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    transition={iosSpring}
                    onClick={() => { setPlusMenuOpen(false); setConnectorsOpen(true); }}
                    className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl liquid-glass-hover text-[12.5px] text-primary font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Manage connections
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
    );
    return (
      <>
        {/* Mobile: bottom sheet */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setPlusMenuOpen(false)}
          className="fixed inset-0 z-[55] bg-foreground/10 backdrop-blur-[2px] md:hidden"
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0, maxHeight: plusExpanded ? "88vh" : "62vh" }}
          exit={{ y: "100%" }}
          transition={{
            y: { type: "spring", stiffness: 380, damping: 36 },
            maxHeight: { type: "spring", stiffness: 220, damping: 28, mass: 0.7 },
          }}
          data-plus-menu
          className="fixed inset-x-0 bottom-0 z-[56] w-full rounded-t-[28px] overflow-hidden bg-background border-t border-border/40 flex flex-col md:hidden"
        >
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) {
                setPlusMenuOpen(false);
              } else if (plusExpanded && info.offset.y > 60) {
                setPlusExpanded(false);
              }
            }}
            className="flex justify-center pb-2 pt-2 shrink-0 cursor-grab active:cursor-grabbing touch-none"
          >
            <div className="w-10 h-1.5 rounded-full bg-foreground/20" />
          </motion.div>
          <div
            className="overflow-y-auto overscroll-contain px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] flex-1 touch-pan-y"
          >
            {content}
          </div>
        </motion.div>


        {/* Desktop: backdrop to close on outside click */}
        <div
          className="hidden md:block fixed inset-0 z-[55]"
          onClick={() => setPlusMenuOpen(false)}
        />
        {/* Desktop: anchored popover below input */}
        <motion.div
          initial={{ opacity: 0, y: hasConversation ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: hasConversation ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 0.9, 0.3, 1] }}
          data-plus-menu
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: "min(70vh, 560px)" }}
          className={`hidden md:flex absolute left-2 ${hasConversation ? "bottom-full mb-2 origin-bottom-left" : "top-full mt-2 origin-top-left"} z-[60] w-[360px] rounded-2xl border border-border bg-background overflow-y-auto overscroll-contain p-2 flex-col`}
        >
          {content}
        </motion.div>

      </>
    );
  };


  const renderAttachments = () => {
    if (attachedFiles.length === 0) return null;
    return (
      <div className="flex gap-2 px-2 overflow-x-auto pb-1 mb-1">
        {attachedFiles.map((f, i) =>
        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg liquid-glass-button text-xs text-foreground shrink-0">
            {f.type === "image" ? <img src={f.data} alt="" className="w-8 h-8 rounded object-cover" /> : <FileUp className="w-3 h-3" />}
            <span className="truncate max-w-[100px]">{f.name}</span>
            <button onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>);
  };

  return (
    <>
      <SEOHead title="Chat" description="Chat with 80+ AI models in one place — GPT, Claude, Gemini, Grok, Llama and more. Stream answers, run deep research, and continue conversations across devices." path="/chat" noindex />
      {/* Megsy Operator now renders as a tiny inline pill above the input — see below. */}
      <div className="h-[100dvh] flex bg-background overflow-hidden">
        {/* Desktop persistent sidebar */}
        <aside
          style={{ width: sidebarCollapsed ? 60 : 280 }}
          className="hidden md:flex shrink-0 overflow-hidden border-r border-border/70 bg-sidebar transition-[width] duration-200 ease-out"
        >
          <AppSidebar
            inline
            open
            onClose={() => {}}
            onNewChat={handleNewChat}
            onSelectConversation={loadConversation}
            activeConversationId={conversationId}
            currentMode={chatMode === "learning" ? "learning" : chatMode === "deep-research" ? "research" : chatMode === "shopping" ? "shopping" : chatMode === "slides" ? "slides" : "chat"}
          />
        </aside>

        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-background text-foreground">
        {/* Mobile drawer sidebar */}
        <div className="md:hidden">
          <AppSidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onNewChat={handleNewChat}
            onSelectConversation={loadConversation}
            activeConversationId={conversationId}
            currentMode={chatMode === "learning" ? "learning" : chatMode === "deep-research" ? "research" : chatMode === "shopping" ? "shopping" : chatMode === "slides" ? "slides" : "chat"} />
        </div>

        {/* Mobile-only header — Luma Neutral */}
        <MobileChatHeader
          title={conversationTitle}
          hasConversation={hasConversation && !!conversationId}
          isPinned={isPinned}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewChat={handleNewChat}
          onShare={handleShare}
          onInvite={handleInvite}
          onRename={() => { setRenameValue(conversationTitle); setIsRenaming(true); }}
          onTogglePin={handleTogglePin}
          onDelete={handleDelete}
          rightSlot={!hasConversation ? <UnlockProButton onClick={() => navigate("/pricing")} aria-label="Get Plus" text="Get Plus" /> : null}
        />

        {/* Desktop header (mobile bits hidden via md:hidden / hidden md:flex inside) */}
        <div className="hidden md:flex absolute top-0 inset-x-0 z-20 items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 min-h-[56px] pt-2.5 pointer-events-none [&>*]:pointer-events-auto md:bg-transparent bg-background/80 backdrop-blur-xl backdrop-saturate-150 md:backdrop-blur-0 md:backdrop-saturate-100 border-b border-border/40 md:border-b-0">
          {/* Unlock Pro centered absolutely (mobile + desktop) */}
          {!hasConversation && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <UnlockProButton onClick={() => navigate("/pricing")} aria-label="Unlock Pro" text="Unlock Pro" />
            </div>
          )}
          <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-foreground/85 liquid-glass-button hover:bg-accent/40 transition-colors" aria-label="Open menu">
            <Menu className="w-[20px] h-[20px]" />
          </button>

          {/* Desktop: title with chevron dropdown on the leading side */}
          <div className="hidden md:flex items-center gap-1 min-w-0">
            {hasConversation && conversationId ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Chat options" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[14px] font-medium text-foreground/85 hover:bg-accent/40 transition-colors">
                    <MoreHorizontal className="w-[18px] h-[18px] text-foreground/85" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={6}
                  className="w-[15rem] rounded-2xl liquid-glass border border-border/30 p-1.5"
                >
                  {[
                    { icon: Plus, label: "New chat", onClick: handleNewChat, featured: true },
                    { icon: Share2, label: "Share chat", onClick: handleShare },
                    { icon: UserPlus, label: "Invite people", onClick: handleInvite },
                    { icon: Pencil, label: "Rename", onClick: () => { setRenameValue(conversationTitle); setIsRenaming(true); } },
                    { icon: Pin, label: isPinned ? "Unpin chat" : "Pin chat", onClick: handleTogglePin },
                  ].map(({ icon: Icon, label, onClick, featured }) => (
                    <DropdownMenuItem
                      key={label}
                      onClick={onClick}
                      className="rounded-xl px-2.5 py-2.5 text-[14px] gap-3 cursor-pointer text-foreground/90 focus:bg-accent/40 data-[highlighted]:bg-accent/40"
                    >
                      <span className="w-8 h-8 rounded-xl bg-accent/30 flex items-center justify-center shrink-0">
                        <Icon className={`w-[15px] h-[15px] ${featured ? "text-purple-400" : "text-foreground/85"}`} strokeWidth={1.9} />
                      </span>
                      <span className={`flex-1 truncate ${featured ? "font-bold bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent" : ""}`}>{label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="my-1.5 bg-border/40" />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="rounded-xl px-2.5 py-2.5 text-[14px] gap-3 cursor-pointer text-destructive focus:text-destructive data-[highlighted]:bg-destructive/10"
                  >
                    <span className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <Trash2 className="w-[15px] h-[15px]" strokeWidth={1.9} />
                    </span>
                    <span className="flex-1 truncate">Delete chat</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {/* Center spacer */}
          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Mobile: keep existing more menu */}
            {hasConversation && conversationId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-foreground/85 hover:bg-accent/40 transition-colors" aria-label="More options">
                  <MoreVertical className="w-[20px] h-[20px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-[15rem] rounded-2xl liquid-glass border border-border/30 p-1.5"
              >
                {[
                  { icon: Plus, label: "New chat", onClick: handleNewChat, featured: true },
                  { icon: Share2, label: "Share chat", onClick: handleShare },
                  { icon: UserPlus, label: "Invite people", onClick: handleInvite },
                  { icon: Pencil, label: "Rename", onClick: () => { setRenameValue(conversationTitle); setIsRenaming(true); } },
                  { icon: Pin, label: isPinned ? "Unpin chat" : "Pin chat", onClick: handleTogglePin },
                ].map(({ icon: Icon, label, onClick, featured }) => (
                  <DropdownMenuItem
                    key={label}
                    onClick={onClick}
                    className="rounded-xl px-2.5 py-2.5 text-[14px] gap-3 cursor-pointer text-foreground/90 focus:bg-accent/40 data-[highlighted]:bg-accent/40"
                  >
                    <span className="w-8 h-8 rounded-xl bg-accent/30 flex items-center justify-center shrink-0">
                      <Icon className={`w-[15px] h-[15px] ${featured ? "text-purple-400" : "text-foreground/85"}`} strokeWidth={1.9} />
                    </span>
                    <span className={`flex-1 truncate ${featured ? "font-bold bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent" : ""}`}>{label}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="my-1.5 bg-border/40" />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="rounded-xl px-2.5 py-2.5 text-[14px] gap-3 cursor-pointer text-destructive focus:text-destructive data-[highlighted]:bg-destructive/10"
                >
                  <span className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <Trash2 className="w-[15px] h-[15px]" strokeWidth={1.9} />
                  </span>
                  <span className="flex-1 truncate">Delete chat</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}

            {/* Desktop: Share button */}
            {hasConversation && conversationId && (
              <button
                onClick={handleShare}
                className="hidden md:inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-border/60 text-[13px] font-medium text-foreground/85 hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                Share
              </button>
            )}


            {/* Mobile Unlock Pro is rendered absolutely-centered in header (see top of header) */}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto min-h-0 relative" ref={messagesContainerRef} onScroll={handleScroll}>
          {loadingMessages && messages.length === 0 ? (
            <div className="max-w-3xl mx-auto pt-20 pb-44 md:pb-52 px-4 md:px-6 space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`h-12 rounded-2xl bg-muted/60 animate-pulse ${i % 2 === 0 ? "w-2/3" : "w-3/4"}`}
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 pb-40 md:pb-[260px]">
              {/* Mobile: clean centered prompt — stable per chat open, accent word in a rotating color */}
              {(() => {
                const name = userName?.split(" ")[0] || "friend";
                const FIRST_GREETINGS = [
                  { plain: `Hey`, accent: name, tail: "." },
                  { plain: `Welcome back,`, accent: name, tail: "." },
                  { plain: `What's up,`, accent: name, tail: "?" },
                  { plain: `Ready,`, accent: name, tail: "?" },
                  { plain: `Let's go,`, accent: name, tail: "." },
                  { plain: `Hi`, accent: name, tail: "." },
                  { plain: `Your move,`, accent: name, tail: "." },
                  { plain: `Ask away,`, accent: name, tail: "." },
                ];
                const RETURNING_GREETINGS = (() => {
                  const h = new Date().getHours();
                  const timeGreeting = h < 12 ? "Good morning" : "Good evening";
                  return [
                    { plain: timeGreeting, accent: name, tail: "" },
                    { plain: `How are you,`, accent: name, tail: "?" },
                    { plain: `Let's cook something up,`, accent: name, tail: "" },
                    { plain: `Welcome back,`, accent: name, tail: "" },
                  ];
                })();
                const ACCENT_COLORS = [
                  "text-rose-500",
                  "text-amber-500",
                  "text-emerald-500",
                  "text-sky-500",
                  "text-violet-500",
                  "text-fuchsia-500",
                  "text-orange-500",
                  "text-cyan-500",
                ];
                const color = ACCENT_COLORS[mobileGreetingColor % ACCENT_COLORS.length];
                const phrase = RETURNING_GREETINGS[0];
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="md:hidden w-full text-center px-2"
                  >
                    <p className="font-display text-[22px] sm:text-[26px] font-light tracking-tight text-foreground/85 leading-none whitespace-nowrap">
                      {phrase.plain}{" "}
                      <span className={`${color} font-medium`}>{phrase.accent}</span>
                      {phrase.tail}
                    </p>
                  </motion.div>
                );
              })()}


              {/* Desktop: Claude-style greeting + quick chips */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="hidden md:flex flex-col items-center w-full max-w-2xl"
              >
                <h1 className="font-display text-4xl lg:text-[44px] font-light tracking-tight text-foreground/90 flex items-center gap-3">
                  <PegtopIcon className={`w-9 h-9 ${chatMode === "deep-research" ? "text-violet-500" : chatMode === "learning" ? "text-emerald-500" : chatMode === "slides" ? "text-fuchsia-500" : "text-orange-400"}`} />
                  <span className="whitespace-nowrap">{(() => {
                    const name = userName || "friend";
                    const h = new Date().getHours();
                    const part = h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Late night";
                    if (isFirstVisit) {
                      return `${part}, ${name}`;
                    }
                    const ROT = [`${part}, ${name}`, `How are you, ${name}?`, `Let's cook something, ${name}`, `Welcome back, ${name}`];
                    return ROT[returningGreetingIdx % ROT.length];
                  })()}</span>
                </h1>

              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto pt-20 pb-56 md:pb-64 px-4 md:px-6 space-y-2">
              {messages.map((msg, i) => {
                const isOther = msg.role === "user" && !!msg.user_id && !!chatUserId && msg.user_id !== chatUserId;
                const isStreamingThis = isLoading && i === messages.length - 1 && msg.role === "assistant";
                return (
                <motion.div
                  key={msg.clientId || msg.id || `idx-${i}`}
                  initial={isStreamingThis ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {msg.role === "assistant" && msg.operatorRunId ? (
                    <Suspense fallback={null}>
                      <OperatorInlineBubbleLazy runId={msg.operatorRunId} onDismiss={() => setOperatorRunId(null)} />
                    </Suspense>
                  ) : (
                  <ChatMessage
                    messageIndex={i}
                    role={msg.role}
                    content={msg.content}
                    images={msg.images}
                    products={msg.products}
                    attachedImages={msg.attachedImages}
                    attachedFiles={msg.attachedFiles}
                    isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                    isThinking={isThinking && i === messages.length - 1 && msg.role === "assistant" && !msg.content}
                    searchStatus={i === messages.length - 1 && msg.role === "assistant" ? searchStatus : undefined}
                    liked={msg.liked}
                    onLikeMessage={handleLikeMessage}
                    onShare={undefined}
                    onStructuredAction={handleStructuredAction}
                    onEditUserMessageAt={msg.role === "user" ? handleEditUserMessageAt : undefined}
                    isDeepResearch={msg.mode === "deep-research" && msg.role === "assistant"}
                    isSlidesMode={msg.mode === "slides" && msg.role === "assistant"}
                    isLearningMode={msg.mode === "learning" && msg.role === "assistant"}
                    researchQuery={msg.role === "assistant" && i > 0 && messages[i - 1]?.role === "user" ? messages[i - 1].content : undefined}
                    researchSessionKey={msg.role === "assistant" && conversationId ? `conv_${conversationId}_${i}` : undefined}
                    narrations={msg.role === "assistant" && i === messages.length - 1 ? narrations : undefined}
                    senderName={members.length > 0 ? msg.senderName || undefined : undefined}
                    senderAvatar={members.length > 0 ? msg.senderAvatar || undefined : undefined}
                    isOtherMember={isOther}
                    bubbleColor={isOther ? colorForUser(msg.user_id!) : null}
                    messageId={msg.id}
                    currentUserId={chatUserId || undefined}
                    reactions={msg.id ? (messageReactions[msg.id] || EMPTY_REACTIONS) : EMPTY_REACTIONS}
                    onToggleReaction={msg.id ? toggleReaction : undefined}
                    readers={msg.id ? (readersByMessageId[msg.id] || EMPTY_READERS) : EMPTY_READERS}
                    showReaders={members.length > 0 && msg.role === "user" && msg.user_id === chatUserId && i === messages.length - 1 - (messages[messages.length - 1]?.role === "assistant" ? 1 : 0)}
                    bottomSlot={msg.role === "assistant" && msg.docsArtifact ? (
                      <Suspense fallback={null}>
                        <DocsArtifactCard
                          artifactId={msg.docsArtifact.artifactId}
                          title={msg.docsArtifact.title}
                          docType={msg.docsArtifact.docType}
                          html={msg.docsArtifact.html}
                        />
                      </Suspense>
                    ) : undefined}
                    hideActions={msg.role === "assistant" && !!msg.docsClarify}
                   />
                  )}
                   {/* Slides deck card under assistant message in slides mode */}
                    {msg.role === "assistant" && msg.slidesDeck && (
                       <div className="px-3 md:px-12">
                         <Suspense fallback={null}>
                           {isPremiumHtml(msg.slidesDeck.templateId) && (msg.slidesDeck as SlideDeck & { htmlSlug?: string }).htmlSlug ? (
                             <SlidesHtmlDeckCard deck={msg.slidesDeck as SlideDeck & { htmlSlug: string }} />
                           ) : (
                             <SlidesDeckCard deck={msg.slidesDeck} />
                           )}
                         </Suspense>
                       </div>
                     )}
                    {msg.role === "assistant" && msg.standardSlides && (
                      <div className="px-3 md:px-12">
                        <Suspense fallback={null}>
                          <StandardSlidesCard
                            title={msg.standardSlides.title}
                            templateName={msg.standardSlides.templateName}
                            url={msg.standardSlides.url}
                            colors={msg.standardSlides.colors}
                          />
                        </Suspense>
                      </div>
                    )}
                    {/* docsArtifact card is rendered inside ChatMessage as bottomSlot
                        so that the AI's description appears above and the action buttons (copy/like/dislike) below it. */}
                    {msg.role === "assistant" && msg.docsClarify && (
                      <div className="px-3 md:px-12">
                        <Suspense fallback={null}>
                          <DocsClarifyCard
                            key={`${msg.id ?? msg.clientId ?? "c"}::${msg.docsClarify.questions.length}::${msg.docsClarify.questions[0]?.id ?? ""}::${msg.docsClarify.reason.slice(0, 32)}`}
                            reason={msg.docsClarify.reason}
                            questions={msg.docsClarify.questions}
                            ui={msg.docsClarify.ui}
                            onSubmit={async (answers) => {
                              const targetKey = msg.id ?? msg.clientId;
                              const matchesTarget = (mm: Message) => (
                                targetKey ? (mm.id === targetKey || mm.clientId === targetKey) : mm === msg
                              );
                              try {
                                setIsLoading(true); setIsThinking(true); startDocsStatusFallback();
                                const [{ streamDoc }, { saveDocHtml, newArtifactId }] = await Promise.all([
                                  import("@/lib/agent/docs/docsGenerator"),
                                  import("@/lib/agent/docs/htmlCache"),
                                ]);
                                const artifactId = newArtifactId();
                                let meta: { title: string; doc_type: string } | null = null;
                                let lastFlush = 0;
                                let generatedMessageId = msg.id ?? null;
                                const flush = (full: string, force = false) => {
                                  const now = Date.now();
                                  if (!force && now - lastFlush < 250) return;
                                  lastFlush = now;
                                  setMessages((prev) => prev.map((mm) => matchesTarget(mm) ? {
                                    ...mm, docsClarify: undefined, content: "",
                                    docsArtifact: { artifactId, title: meta?.title ?? "Document", docType: meta?.doc_type ?? "document", html: full },
                                  } : mm));
                                };
                                let finalHtml = "";
                                let finalFriendly = "";
                                await streamDoc({
                                  prompt: msg.docsClarify!.originalPrompt,
                                  clarifications: answers,
                                  conversationId: conversationId ?? null,
                                  messageId: msg.id ?? null,
                                }, {
                                  onStatus: (text) => { stopDocsStatusFallback(); setSearchStatus(text); },
                                  onMeta: (m) => { meta = m; flush("<!DOCTYPE html><html><body></body></html>", true); },
                                  onHtmlDelta: (_c, full) => { finalHtml = full; flush(full); },
                                  onHtmlDone: (full, friendly) => { finalHtml = full; if (friendly) finalFriendly = friendly; flush(full, true); },
                                  onClarify: (c) => {
                                    setMessages((prev) => prev.map((mm) => matchesTarget(mm) ? {
                                      ...mm, docsArtifact: undefined,
                                      docsClarify: { reason: c.reason, questions: c.questions, ui: c.ui, originalPrompt: msg.docsClarify!.originalPrompt },
                                    } : mm));
                                  },
                                  onError: (msg2) => { throw new Error(msg2); },
                                });
                                if (finalHtml && finalHtml.length > 400 && meta) {
                                  saveDocHtml(artifactId, finalHtml);
                                  let friendly = finalFriendly;
                                  if (!friendly) {
                                    const { buildDocReadyMessageAI } = await import("@/lib/agent/docs/readyMessage");
                                    friendly = await buildDocReadyMessageAI({ title: meta!.title, html: finalHtml, docType: meta!.doc_type, prompt: msg.docsClarify!.originalPrompt });
                                  }
                                  setMessages((prev) => prev.map((mm) => matchesTarget(mm) ? {
                                    ...mm, content: friendly,
                                    docsClarify: undefined,
                                    docsArtifact: { artifactId, title: meta!.title, docType: meta!.doc_type, html: finalHtml },
                                  } : mm));
                                  if (conversationId) {
                                    const metadata = {
                                      kind: "docsArtifact",
                                      docsArtifact: { artifactId, title: meta!.title, docType: meta!.doc_type, html: finalHtml },
                                    };
                                    if (generatedMessageId) {
                                      try {
                                        await supabase.from("messages").update({ content: friendly, metadata }).eq("id", generatedMessageId);
                                      } catch { /* best-effort */ }
                                    } else {
                                      generatedMessageId = await saveMessage(conversationId, "assistant", friendly, undefined, metadata).catch(() => undefined) ?? null;
                                    }
                                  }
                                } else {
                                  // Generation produced no usable HTML — surface the failure
                                  setMessages((prev) => prev.map((mm) => matchesTarget(mm) ? {
                                    ...mm, docsArtifact: undefined,
                                    content: "Could not create the document this time. Try rephrasing or try again.",
                                  } : mm));
                                  toast.error("Document was not created — please try again");
                                }
                              } catch (e) {
                                const safe = friendlyUserMessage(e, "We couldn't create the document. Please try again.");
                                void reportError(e, { source: "docs-regenerate" });
                                toast.error(safe);
                                setMessages((prev) => prev.map((mm) => matchesTarget(mm) ? {
                                  ...mm,
                                  docsArtifact: undefined,
                                  content: safe,
                                } : mm));
                              } finally { stopDocsStatusFallback(); setIsLoading(false); setIsThinking(false); setSearchStatus(""); }
                            }}
                          />
                        </Suspense>
                      </div>
                    )}
                    {msg.role === "assistant" && msg.mode === "slides" && !msg.slidesDeck && !msg.standardSlides && !msg.slidesJobId && !msg.content?.trim() && !isLoading && (
                      <div className="px-3 md:px-12 mt-3">
                        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-4 max-w-xl">
                          <div className="text-[13px] font-medium text-foreground mb-1">Slides not available</div>
                          <div className="text-[12px] text-muted-foreground mb-3">Slide generation was interrupted before completing. You can regenerate it.</div>
                          <button
                            onClick={() => {
                              const topic = msg.slidesPendingTopic
                                || (i > 0 && messages[i - 1]?.role === "user" ? messages[i - 1].content : "");
                              if (topic) { setChatMode("slides"); handleSendWithText(topic); }
                            }}
                            className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-foreground text-background text-[12.5px] font-semibold hover:opacity-90 transition"
                          >
                            Regenerate slides
                          </button>
                        </div>
                      </div>
                    )}
                 </motion.div>
                 );
                })}
              {/* Sticky in-chat focus timers — float above messages while scrolling */}
              {chatMode === "learning" && studyTimers.length > 0 && (
                <div className="sticky top-16 z-30 flex flex-col gap-2 pointer-events-none">
                  <AnimatePresence>
                    {studyTimers.map((t) => (
                      <div key={t.id} className="pointer-events-auto">
                        <Suspense fallback={null}>
                          <InChatTimerCard
                            id={t.id}
                            totalSec={t.totalSec}
                            startedAt={t.startedAt}
                            paused={t.paused}
                            pausedRemaining={t.pausedRemaining}
                            onPauseToggle={(id) => setStudyTimers((prev) => prev.map((x) => {
                              if (x.id !== id) return x;
                              if (x.paused) {
                                const remaining = x.pausedRemaining ?? x.totalSec;
                                return { ...x, paused: false, startedAt: Date.now() - (x.totalSec - remaining) * 1000, pausedRemaining: null };
                              }
                              const remaining = Math.max(0, x.totalSec - Math.floor((Date.now() - x.startedAt) / 1000));
                              return { ...x, paused: true, pausedRemaining: remaining };
                            }))}
                            onCancel={(id) => setStudyTimers((prev) => prev.filter((x) => x.id !== id))}
                          />
                        </Suspense>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* System events (join/leave) */}
              <AnimatePresence>
                {systemEvents.slice(-3).map((ev) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex justify-center my-2"
                  >
                    <span className="px-3 py-1 rounded-full bg-muted/60 text-[11px] text-muted-foreground">
                      {ev.text}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                >
                  <div className="flex -space-x-1.5">
                    {typingUsers.slice(0, 3).map((u) => {
                      const c = colorForUser(u.id);
                      return u.avatar ? (
                        <img key={u.id} src={u.avatar} alt="" className="w-5 h-5 rounded-full ring-2 ring-background object-cover" />
                      ) : (
                        <div key={u.id} className="w-5 h-5 rounded-full ring-2 ring-background flex items-center justify-center text-[9px] font-bold text-white" style={{ background: c?.bg || "hsl(var(--accent))" }}>
                          {(u.name || "?")[0]?.toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>{typingUsers.map((u) => u.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…</span>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          <AnimatePresence>
            {(showScrollBtn || newMessagesCount > 0) && messages.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                onClick={scrollToBottom}
                className={`fixed bottom-40 left-1/2 -translate-x-1/2 z-20 ${newMessagesCount > 0 ? "px-3 h-8 gap-1.5 bg-primary text-primary-foreground" : "w-8 h-8 liquid-glass text-foreground/70 hover:text-foreground"} rounded-full flex items-center justify-center transition-colors`}
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                {newMessagesCount > 0 && (
                  <span className="text-xs font-semibold">{newMessagesCount} new</span>
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom input - floating with blur. On desktop empty state, lifted to center. */}
        <div
          style={{ ['--sb-left' as any]: (sidebarCollapsed ? 56 : 260) + 'px' }}
          className={`fixed left-0 md:left-[var(--sb-left)] right-0 z-30 px-2 md:px-6 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] md:pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 md:pt-6 pointer-events-none transition-[left,top,bottom] duration-200 ease-out bg-transparent ${
            messages.length === 0 && !loadingMessages
              ? "bottom-0 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:bg-transparent md:backdrop-blur-0 md:border-0"
              : "bottom-0 md:bg-transparent md:backdrop-blur-0 md:border-0"
          }`}
        >
            <div className="max-w-3xl mx-auto space-y-2 pointer-events-auto">
              {/* Quick mode toggles removed — chip shown elsewhere */}
              <AnimatePresence>
                {selectedAgent && chatMode === "normal" && selectedAgent.id !== "docs" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex items-center"
                  >
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm border border-border/30 ${selectedAgent.bg} ${selectedAgent.color}`}>
                      {(() => { const Icon = selectedAgent.icon; return <Icon className="w-3.5 h-3.5" />; })()}
                      <span>{selectedAgent.label}</span>
                      <button
                        onClick={() => { setSelectedAgent(null); setSelectedModel(null); }}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-accent/50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Learning quick-tools row removed — everything happens inside chat */}

              {/* Mode chips removed per request */}

              {renderAttachments()}

              <AnimatePresence>
                {remoteAiBusy && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className="relative mx-auto overflow-hidden px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/30 text-amber-600 text-xs flex items-center justify-center gap-2"
                  >
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    <span className="font-medium">Megsy is replying to {remoteAiBusy.name}…</span>
                    <motion.span
                      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-400/20 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>



              <div className="relative mx-auto w-full max-w-3xl">
                <div className="md:hidden"><AgentsOnboarding /></div>

                <AnimatePresence>
                  {plusMenuOpen && renderPlusMenu()}
                </AnimatePresence>




                {mentionQuery && members.filter((m) => (m.name || "").toLowerCase().includes(mentionQuery.q.toLowerCase())).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute bottom-full left-0 right-0 mb-2 mx-3 rounded-xl border border-border bg-popover overflow-hidden z-30"
                  >
                    {members
                      .filter((m) => (m.name || "").toLowerCase().includes(mentionQuery.q.toLowerCase()))
                      .slice(0, 5)
                      .map((m) => {
                        const c = colorForUser(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => insertMention(m.name || "Member")}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors"
                          >
                            {m.avatar ? (
                              <img src={m.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: c?.bg || "hsl(var(--accent))" }}>
                                {(m.name || "?")[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm flex-1 truncate">{m.name || "Member"}</span>
                            {onlineUsers.has(m.id) && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                          </button>
                        );
                      })}
                  </motion.div>
                )}
                {editingIndex !== null && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-2xl liquid-glass border border-border/30">
                    <Pencil className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[12px] text-foreground/80 flex-1 truncate">Editing message</span>
                    <button
                      onClick={cancelEdit}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-accent/40 transition-colors"
                    >Cancel</button>
                  </div>
                )}
                <AnimatedInput
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  onCancel={handleCancel}
                  onPlusClick={() => { if (!plusMenuOpen) setPlusView("main"); setPlusMenuOpen(!plusMenuOpen); }}
                  disabled={isLoading || !!remoteAiBusy}
                  isLoading={isLoading}
                  pendingQuestions={pendingQuestions}
                  onQuestionAnswer={handleQuestionAnswer}
                  onQuestionSkip={handleQuestionSkip}
                  activeAgent={chatMode !== "normal" ? chatMode : (selectedAgent?.id || null)}
                  onAgentSelect={(agent: AgentDef) => {
                    const modeMap: Record<string, ChatMode> = { learning: "learning", shopping: "shopping", "deep-research": "deep-research" };
                    if (modeMap[agent.id]) {
                      setSelectedAgent(null);
                      setSelectedModel(null);
                      handleModeChange(modeMap[agent.id]);
                      return;
                    }
                    setChatMode("normal");
                    setSelectedAgent(agent);
                    setSelectedModel(null);
                  }}
                  onAgentRemove={() => { setChatMode("normal"); setSelectedAgent(null); setSelectedModel(null); if (chatMode === "deep-research") setSearchEnabled(false); }}
                  selectedModel={selectedModel}
                  onModelSelect={(model: AgentModel) => setSelectedModel(model)}
                  onModelRemove={() => setSelectedModel(null)}
                  accentMode={chatMode === "learning" ? "learn" : null}
                  inlineSlot={
                    chatMode === "slides" ? (
                      <button
                        type="button"
                        onClick={() => setSlidesPickerOpen(true)}
                        className="inline-flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-full border border-border/60 text-foreground/85 hover:text-foreground hover:bg-foreground/10 hover:border-foreground/30 transition-colors text-[12px] font-medium"
                        aria-label="Choose template"
                      >
                        <svg viewBox="0 0 24 24" className="w-[16px] h-[16px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
                          <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
                          <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
                          <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
                        </svg>
                        <span className="truncate max-w-[140px]">{findSlidesTemplate(slidesTemplate).name}</span>
                      </button>
                    ) : null
                  }

                  headerSlot={
                    (() => {
                      const CHIPS = [
                        {
                          id: "deep-research" as const,
                          label: "Deep Research",
                          activeCls: "bg-background/60 border-border/50 text-violet-600 dark:text-violet-300",
                          inactiveCls: "bg-background/60 border-border/50 text-foreground/65 hover:text-foreground",
                          bubbleCls: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="10.5" cy="10.5" r="5.5" />
                              <path d="M19.5 19.5l-4.5-4.5" />
                            </svg>
                          ),
                        },
                        {
                          id: "slides" as const,
                          label: "Slides",
                          activeCls: "bg-background/60 border-border/50 text-fuchsia-600 dark:text-fuchsia-300",
                          inactiveCls: "bg-background/60 border-border/50 text-foreground/65 hover:text-foreground",
                          bubbleCls: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" />
                              <path d="M8 20h8M12 16.5V20" />
                            </svg>
                          ),
                        },
                        {
                          id: "learning" as const,
                          label: "Learning",
                          activeCls: "bg-background/60 border-border/50 text-emerald-600 dark:text-emerald-300",
                          inactiveCls: "bg-background/60 border-border/50 text-foreground/65 hover:text-foreground",
                          bubbleCls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 8.5L12 4l9 4.5-9 4.5-9-4.5z" />
                              <path d="M7 11v4.2c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6V11" />
                            </svg>
                          ),
                        },
                        {
                          id: "docs" as const,
                          label: "Docs",
                          activeCls: "bg-background/60 border-border/50 text-indigo-600 dark:text-indigo-300",
                          inactiveCls: "bg-background/60 border-border/50 text-foreground/65 hover:text-foreground",
                          bubbleCls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                              <path d="M14 3v5h5M9 13h6M9 17h6" />
                            </svg>
                          ),
                        },
                        {
                          id: "operator" as const,
                          label: "Megsy Operator",
                          activeCls: "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300",
                          inactiveCls: "bg-background/60 border-border/50 text-foreground/65 hover:text-foreground",
                          bubbleCls: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3v2a3 3 0 0 0 1 2.2V18a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-3.8A3 3 0 0 0 19 12v-2a3 3 0 0 0-3-3V6a4 4 0 0 0-4-4z" />
                              <path d="M9 13h.01M15 13h.01M9 17h6" />
                            </svg>
                          ),
                        },
                      ];
                      const isDocsActive = selectedAgent?.id === "docs";
                      const activeChip = CHIPS.find((c) => c.id === chatMode) || (isDocsActive ? CHIPS.find((c) => c.id === "docs") : undefined);
                      if (!activeChip) return null;
                      const deactivate = () => {
                        if (activeChip.id === "docs") setSelectedAgent(null);
                        else handleModeChange("normal");
                      };
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className={`inline-flex items-center h-8 rounded-full border text-[12px] font-semibold shrink-0 ${activeChip.activeCls}`}
                        >
                          <span className="inline-flex items-center gap-1.5 h-full pl-2 pr-1">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${activeChip.bubbleCls}`}>
                              {activeChip.icon}
                            </span>
                            <span className="truncate max-w-[160px]">{activeChip.label}</span>
                          </span>
                          <button
                            type="button"
                            onClick={deactivate}
                            aria-label="Exit mode"
                            className="inline-flex items-center justify-center w-6 h-6 mr-1 rounded-full hover:bg-foreground/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2.2} />
                          </button>
                        </motion.div>
                      );
                    })()
                  }
                />
              </div>
            </div>
          </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.doc,.docx" multiple />
        <input ref={cameraInputRef} type="file" className="hidden" onChange={handleCameraCapture} accept="image/*" capture="environment" />
        <input ref={imageInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" multiple />

        <Suspense fallback={null}>
          {connectorsOpen && (
            <ConnectorsDialog open={connectorsOpen} onOpenChange={setConnectorsOpen} onNavigateIntegrations={() => navigate("/settings/integrations")} />
          )}

          {slidesPickerOpen && (
            <TemplatePickerSheet
              open={slidesPickerOpen}
              showCategoryTabs
              templates={SLIDES_TEMPLATES.map((t) => ({
                id: t.id,
                name: t.name,
                preview: t.cover,
                description: t.description,
                fallbackLabel: t.name,
                category: t.category,
                colors: t.colors,
              }))}
              selectedId={slidesTemplate}
              onSelect={(t) => setSlidesTemplate(t.id)}
              onClose={() => setSlidesPickerOpen(false)}
            />
          )}

        </Suspense>



        {/* Share Dialog - Glass */}
        <ChatDesktopDialog open={shareDialogOpen} onOpenChange={(open) => {setShareDialogOpen(open);if (!open) setGeneratedShareUrl(null);}}>
            <div className="px-5 pt-5 pb-3">
              <div className="mb-0 flex flex-col space-y-1.5 text-left">
                <h2 className="text-base font-semibold text-left text-foreground">Share chat</h2>
                <p className="text-xs text-left text-muted-foreground">Future messages aren't included</p>
              </div>
            </div>
            <div className="border-t border-border/30">
              <button
                onClick={() => {setShareMode("private");setGeneratedShareUrl(null);}}
                className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors ${shareMode === "private" ? "bg-accent/50" : "hover:bg-accent/30"}`}>
                <Lock className="w-4 h-4 text-foreground shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Keep private</p>
                  <p className="text-[11px] text-muted-foreground">Only you have access</p>
                </div>
              </button>
              <div className="h-px bg-border/30 mx-5" />
              <button
                onClick={() => { setShareMode("public"); if (!generatedShareUrl) handleCreateShareLink("public"); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors ${shareMode === "public" ? "bg-accent/50" : "hover:bg-accent/30"}`}>
                <Globe className="w-4 h-4 text-foreground shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Create public link</p>
                  <p className="text-[11px] text-muted-foreground">Anyone with the link can view</p>
                </div>
              </button>
            </div>
            <div className="px-5 py-4 border-t border-border/30">
              {shareMode === "public" ? (
                generatedShareUrl ? (
                  <div className="mx-auto flex items-center justify-center gap-2 max-w-full w-fit rounded-xl liquid-glass-button px-3 py-2.5 overflow-hidden">
                    <span className="text-[12px] font-medium text-foreground tracking-tight truncate min-w-0 max-w-[60vw]" dir="ltr">
                      {(() => {
                        try {
                          const u = new URL(generatedShareUrl);
                          const tail = u.pathname.split("/").pop() || "";
                          return `${u.host}/…/${tail.slice(0, 6)}`;
                        } catch { return generatedShareUrl.slice(0, 24) + "…"; }
                      })()}
                    </span>
                    <button onClick={handleCopyShareLink} className="shrink-0 p-1.5 rounded-lg liquid-glass-hover transition-colors" aria-label="Copy">
                      <Copy className="w-3.5 h-3.5 text-foreground" />
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-[12px] text-muted-foreground">Generating link…</p>
                )
              ) : (
                <p className="text-center text-[12px] font-medium text-foreground">Everything stays private to you</p>
              )}
            </div>
        </ChatDesktopDialog>

        {/* Rename Dialog - Glass (matches Share dialog style) */}
        <ChatDesktopDialog open={isRenaming} onOpenChange={setIsRenaming}>
            <div className="px-5 pt-5 pb-3">
              <div className="mb-0 flex flex-col space-y-1.5 text-left">
                <h2 className="text-base font-semibold text-left text-foreground">Rename chat</h2>
                <p className="text-xs text-left text-muted-foreground">Give this conversation a new name</p>
              </div>
            </div>
            <div className="border-t border-border/30 px-5 py-4">
              <div className="flex items-center gap-3 rounded-xl liquid-glass-button px-3 py-2.5">
                <Pencil className="w-4 h-4 text-foreground shrink-0" />
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  placeholder="Chat name"
                  autoFocus
                  className="flex-1 bg-transparent border-0 outline-none text-sm font-medium text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5 border-t border-border/30 pt-4">
              <button onClick={() => setIsRenaming(false)} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground liquid-glass-hover transition-colors">Cancel</button>
              <button onClick={handleRename} className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Save</button>
            </div>
        </ChatDesktopDialog>

        {/* Confirm Pin/Unpin Dialog - Glass (matches Share dialog style) */}
        <ChatDesktopDialog open={confirmPinOpen} onOpenChange={setConfirmPinOpen}>
            <div className="px-5 pt-5 pb-3">
              <div className="mb-0 flex flex-col space-y-1.5 text-left">
                <h2 className="text-base font-semibold text-left text-foreground">{isPinned ? "Unpin this chat?" : "Pin this chat?"}</h2>
                <p className="text-xs text-left text-muted-foreground">{isPinned ? "Remove from the top of your list" : "Keep it at the top of your conversations"}</p>
              </div>
            </div>
            <div className="border-t border-border/30 px-5 py-4">
              <div className="flex items-center gap-3 rounded-xl liquid-glass-button px-3 py-2.5">
                <Pin className="w-4 h-4 text-foreground shrink-0" />
                <p className="text-[12px] font-medium text-foreground">{isPinned ? "This chat won't be pinned anymore." : "Pinned chats stay easy to find."}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5 border-t border-border/30 pt-4">
              <button onClick={() => setConfirmPinOpen(false)} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground liquid-glass-hover transition-colors">Cancel</button>
              <button onClick={performTogglePin} className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">{isPinned ? "Unpin" : "Pin"}</button>
            </div>
        </ChatDesktopDialog>

        {/* Confirm Delete Dialog - Glass (matches Share dialog style) */}
        <ChatDesktopDialog open={confirmDeleteOpen} onOpenChange={(o) => !isDeleting && setConfirmDeleteOpen(o)}>
            <div className="px-5 pt-5 pb-3">
              <div className="mb-0 flex flex-col space-y-1.5 text-left">
                <h2 className="text-base font-semibold text-left text-foreground">Delete this chat?</h2>
                <p className="text-xs text-left text-muted-foreground">This action can't be undone</p>
              </div>
            </div>
            <div className="border-t border-border/30 px-5 py-4">
              <div className="flex items-center gap-3 rounded-xl liquid-glass-button px-3 py-2.5">
                <Trash2 className="w-4 h-4 text-foreground shrink-0" />
                <p className="text-[12px] font-medium text-foreground">The conversation and all its messages will be permanently removed.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5 border-t border-border/30 pt-4">
              <button
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground liquid-glass-hover transition-colors disabled:opacity-50"
              >Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
        </ChatDesktopDialog>
        <ChatDesktopDialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) { setInviteLink(null); setInviteEmail(""); } }}>
            <div className="px-5 pt-5 pb-4">
              <div className="mb-0 flex flex-col space-y-1.5 text-left">
                <h2 className="text-base font-semibold text-left text-foreground">Invite people</h2>
                <p className="text-xs text-left text-muted-foreground mt-0.5">Add someone to chat together in this conversation</p>
              </div>
            </div>

            {/* Email invite — primary action */}
            <div className="px-5 pb-4 border-t border-border/30 pt-4">
              <div className="flex items-center gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="flex-1 h-11 rounded-xl border-border/30 bg-accent/30 text-sm text-foreground placeholder:text-muted-foreground/60"
                  onKeyDown={(e) => e.key === "Enter" && handleSendInviteEmail()}
                />
                <button
                  onClick={handleSendInviteEmail}
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="px-4 h-11 rounded-xl text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invite"}
                </button>
              </div>
            </div>

            {/* Or divider */}
            <div className="px-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">or share link</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            {/* Truncated link */}
            <div className="px-5 pt-4 pb-5">
              {inviteLink ? (
                <div className="mx-auto flex items-center justify-center gap-2 max-w-full w-fit rounded-xl liquid-glass-button px-3 py-2.5 overflow-hidden">
                  <span className="text-[12px] font-medium text-foreground tracking-tight truncate min-w-0 max-w-[60vw]" dir="ltr">
                    {(() => {
                      try {
                        const u = new URL(inviteLink);
                        const tok = new URLSearchParams(u.search).get("invite") || "";
                        return `${u.host}/…/${tok.slice(0, 6)}`;
                      } catch { return inviteLink.slice(0, 24) + "…"; }
                    })()}
                  </span>
                  <button onClick={handleCopyInviteLink} className="shrink-0 p-1.5 rounded-lg liquid-glass-hover transition-colors" aria-label="Copy">
                    <Copy className="w-3.5 h-3.5 text-foreground" />
                  </button>
                </div>
              ) : (
                <p className="text-center text-[12px] text-muted-foreground">Generating link…</p>
              )}
            </div>

            {members.length > 0 && (
              <div className="px-5 py-4 border-t border-border/30">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">People with access ({members.length + 1})</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary">You</div>
                    <span className="text-xs text-foreground">Owner</span>
                  </div>
                  {members.map((m) => {
                    const c = colorForUser(m.id);
                    const isOwner = chatUserId && conversationOwnerId === chatUserId;
                    const isOnline = onlineUsers.has(m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-2 py-1">
                        <div className="relative">
                          {m.avatar ? (
                            <img src={m.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: c?.bg || "hsl(var(--accent))" }}>
                              {(m.name || "?")[0]?.toUpperCase()}
                            </div>
                          )}
                          {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" title="Online" />
                          )}
                        </div>
                        <span className="text-xs text-foreground flex-1 truncate">{m.name || "Member"}</span>
                        <span className="text-[10px] text-muted-foreground/70 capitalize">{isOnline ? "online" : m.role}</span>
                        {isOwner && (
                          <button
                            onClick={() => handleKickMember(m.id)}
                            className="ml-1 px-2 py-1 rounded-md text-[11px] font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </ChatDesktopDialog>
        </div>
      </div>
    </>);
};

export default ChatPage;
