import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowUp, Loader2, FileCode, Eye, Code2, Sparkles, Rocket, Globe, Save, History, RotateCcw, Upload, Github, Download, Database, Check, Unlink, Smartphone, Tablet, Monitor, DollarSign, X, FileDiff, MousePointerClick, ShieldCheck, Brain, BarChart3, AlertTriangle, CheckCircle2, Menu, Settings as SettingsIcon, LogOut, Pencil, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { prepareProjectFilesForDeploy } from "@/lib/projectBuildGuards";
import { projectSandbox } from "@/lib/projectSandbox";
import { parseBuildAgentChanges, changeActionLabel } from "@/lib/buildAgentChanges";
import { startJob, subscribeJob, resumeJob, getJob, listActiveJobs, failStaleJob } from "@/lib/jobs/client";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileChatView from "@/components/megsy-pr/MobileChatView";
import MobilePreviewView from "@/components/megsy-pr/MobilePreviewView";
import AppSidebar from "@/components/layout/AppSidebar";
import { getProjectDraft, saveProjectDraftDebounced } from "@/lib/projectDrafts";

// In-memory active job tracker (DB `background_jobs` is source of truth; this is just a fast lookup).
const buildAgentActiveJobs = new Map<string, string>();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Msg { id?: string; role: "user" | "assistant"; content: string; raw?: string; pending?: boolean }
type BuildFile = { path: string; content: string };
interface BuildPreviewProps {
  files: BuildFile[];
  projectId?: string;
  streaming?: boolean;
  device?: "desktop" | "tablet" | "mobile";
  sandboxDevUrl?: string | null;
  onError?: (msg: string) => void;
  onConsole?: (e: { level: string; message: string }) => void;
  onIframeReady?: (el: HTMLIFrameElement | null) => void;
}

export default function MegsyPrWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasAutoPrompt = !!searchParams.get("prompt") || searchParams.get("autosend") === "1";

  const [project, setProject] = useState<{ id: string; name: string; published_url?: string | null; preview_url?: string | null; linked_supabase_project_ref?: string | null; linked_supabase_project_name?: string | null } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [files, setFiles] = useState<BuildFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [step, setStep] = useState<string>("");
  const [tab, setTab] = useState<"preview" | "code" | "console" | "github" | "snapshots" | "cost" | "visits" | "supabase" | "domains" | "versions" | "visual">("preview");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<{ level: string; message: string; t: number }[]>([]);
  const [authToken, setAuthToken] = useState<string>("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewIframe, setPreviewIframe] = useState<HTMLIFrameElement | null>(null);
  const [sandboxDevUrl, setSandboxDevUrl] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<string | null>(null);
  
  const autoStartedRef = useRef(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFixAttemptsRef = useRef<Map<string, number>>(new Map());
  const autoFixTimerRef = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) setAuthToken(session.access_token);

      const { data: p } = await supabase
        .from("projects").select("id, name, published_url, preview_url, linked_supabase_project_ref, linked_supabase_project_name").eq("id", projectId).single();
      if (p) setProject(p);

      const { data: msgs } = await supabase
        .from("ai_project_messages")
        .select("id, role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      setMessages(((msgs ?? []) as Msg[]).map((m) => ({
        ...m,
        raw: m.role === "assistant" ? m.content : undefined,
        content: m.role === "assistant" ? stripTags(m.content) : m.content,
      })));

      const { data: fs } = await supabase
        .from("ai_project_files")
        .select("path, content")
        .eq("project_id", projectId);
      setFiles((fs ?? []) as BuildFile[]);
      if (fs?.length) setActiveFile(fs[0].path);
      setInitialLoaded(true);
    })();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    projectSandbox.status(projectId).then((r) => {
      if (cancelled) return;
      if ("ok" in r && r.ok) {
        const data = r.data as { dev_url?: string | null; status?: string | null } | undefined;
        setSandboxDevUrl(data?.dev_url ?? null);
        setSandboxStatus(data?.status ?? null);
      }
    });

    const channel = supabase
      .channel(`workspace-sandbox-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_sandboxes", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const next = (payload.new ?? null) as { dev_url?: string | null; status?: string | null } | null;
          setSandboxDevUrl(next?.dev_url ?? null);
          setSandboxStatus(next?.status ?? null);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Preview is served from Cloudflare (deploy("preview")) instead of the e2b sandbox.
  // E2B sandbox auto-start is intentionally disabled here.

  // Persist draft input per project to Supabase (debounced)
  useEffect(() => {
    if (!projectId) return;
    saveProjectDraftDebounced(projectId, input);
  }, [input, projectId]);

  // Restore draft from Supabase when project changes
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      const saved = await getProjectDraft(projectId);
      if (!cancelled && saved && !input) setInput(saved);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-start with prompt from URL (also fires with existing messages when autosend=1)
  useEffect(() => {
    const prompt = searchParams.get("prompt");
    const force = searchParams.get("autosend") === "1";
    if (prompt && project && initialLoaded && !autoStartedRef.current && (messages.length === 0 || force)) {
      autoStartedRef.current = true;
      send(prompt);
      const next = new URLSearchParams(searchParams);
      next.delete("prompt");
      next.delete("autosend");
      setSearchParams(next, { replace: true });
    }
  }, [project, initialLoaded, messages.length, searchParams, setSearchParams]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, step]);

  const reloadFiles = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("ai_project_files")
      .select("path, content")
      .eq("project_id", projectId);
    setFiles((data ?? []) as BuildFile[]);
  };

  // Resume in-flight build job if user refreshed or returned to the workspace.
  useEffect(() => {
    if (!projectId) return;
    let unsub: (() => void) | null = null;
    (async () => {
      let jobId: string | null = null;
      jobId = buildAgentActiveJobs.get(projectId) ?? null;
      // Cross-device fallback: look up an active code_build job for this project in the DB.
      if (!jobId) {
        try {
          const active = await listActiveJobs("code_build", 10);
          const match = active.find((j) => {
            const inp = (j.input ?? {}) as { projectId?: string; project_id?: string };
            return inp.projectId === projectId || inp.project_id === projectId;
          });
          if (match) {
            jobId = match.id;
            buildAgentActiveJobs.set(projectId, jobId);
          }
        } catch { /* ignore */ }
      }
      if (!jobId) return;
      const row = await getJob(jobId).catch(() => null);
      if (!row || row.status === "done" || row.status === "error" || row.status === "canceled") {
        buildAgentActiveJobs.delete(projectId);
        await reloadFiles();
        return;
      }
      // Re-attach UI to the running job.
      setStreaming(true);
      setMessages((m) => [...m, { role: "assistant", content: "", pending: true }]);
      let consumedEvents = 0;
      let assistantText = row.stream_text ?? "";
      if (assistantText) {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") copy[copy.length - 1] = { ...last, raw: assistantText, content: stripTags(assistantText), pending: true };
          return copy;
        });
      }
      unsub = resumeJob(jobId, {
        onDelta: (_chunk, full) => {
          assistantText = full;
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") copy[copy.length - 1] = { ...last, raw: full, content: stripTags(full), pending: true };
            return copy;
          });
        },
        onMeta: (meta) => {
          const evs = Array.isArray((meta as { events?: unknown[] }).events) ? (meta as { events: Record<string, unknown>[] }).events : [];
          if (evs.length > consumedEvents) {
            const fresh = evs.slice(consumedEvents);
            consumedEvents = evs.length;
            for (const ev of fresh) {
              if (ev.type === "step") setStep(String(ev.text ?? ""));
              else if (ev.type === "file") void reloadFiles();
            }
          }
        },
        onDone: () => {
          buildAgentActiveJobs.delete(projectId);
          setStreaming(false);
          setStep("");
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") copy[copy.length - 1] = { ...last, pending: false, raw: assistantText, content: stripTags(assistantText) || "Done ✅" };
            return copy;
          });
          void reloadFiles();
        },
        onError: (msg) => {
          buildAgentActiveJobs.delete(projectId);
          setStreaming(false);
          setStep("");
          toast.error(msg);
        },
        onStale: async (row) => {
          const msg = "The coding agent stopped before finishing. Conversation and files were saved — press Send to resume the same project.";
          buildAgentActiveJobs.delete(projectId);
          await failStaleJob(row.id, msg);
          setStreaming(false);
          setStep("");
          toast.error(msg);
          await reloadFiles();
        },
      });
    })();
    return () => { if (unsub) unsub(); };
  }, [projectId]);


  const send = async (text: string, autoFixError?: string) => {
    if (!text.trim() || streaming || !projectId) return;
    setInput("");
    setStreaming(true);
    setStep("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", pending: true }]);

    // Snapshot current files before AI changes them (so user can rollback)
    if (files.length > 0) {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const uid = sess?.user?.id;
      if (uid) {
        const filesPayload = files.map((f) => ({ path: f.path, content: f.content }));
        supabase.from("ai_project_snapshots").insert({
          project_id: projectId,
          user_id: uid,
          label: text.slice(0, 60),
          files: filesPayload as unknown as never,
          file_count: files.length,
          total_bytes: filesPayload.reduce((s, f) => s + (f.content?.length || 0), 0),
        }).then(({ error }) => { if (error) console.warn("snapshot failed:", error); });
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in first");

      const fileEvents: Array<{ action: "create" | "update" | "delete" | "rename"; path: string; to?: string }> = [];
      const touched = new Set<string>();
      let assistantText = "";

      const handleEvent = async (ev: Record<string, unknown>) => {
        if (ev.type === "step") setStep(String(ev.text ?? ""));
        else if (ev.type === "file") {
          const path = String((ev as { path?: unknown }).path ?? "");
          if (!path) return;
          touched.add(path);
          const action = ((ev as { action?: string }).action ?? "update") as "create" | "update" | "delete" | "rename";
          fileEvents.push({ action, path, to: (ev as { to?: string }).to });
          const verb = action === "create" ? "Create file" : "Edit file";
          setStep(`tool:fs_write ${verb}: ${path}`);
          await reloadFiles();
          if (!activeFile) setActiveFile(path);
        } else if (ev.type === "warn") {
          toast.warning(String(ev.text ?? ""));
        } else if (ev.type === "error") {
          toast.error(String((ev as { message?: string }).message ?? ""));
        }
      };

      const applyText = (full: string) => {
        assistantText = full;
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, raw: full, content: stripTags(full), pending: true };
          }
          return copy;
        });
      };

      const { jobId } = await startJob("code_build", {
        projectId,
        project_id: projectId,
        message: text,
        auto_fix_error: autoFixError,
        background: true,
      });
      buildAgentActiveJobs.set(projectId, jobId);

      let consumedEvents = 0;
      await new Promise<void>((resolve) => {
        const unsub = subscribeJob(jobId, {
          onDelta: (_chunk, full) => applyText(full),
          onMeta: (meta) => {
            const evs = Array.isArray((meta as { events?: unknown[] }).events) ? (meta as { events: Record<string, unknown>[] }).events : [];
            if (evs.length > consumedEvents) {
              const fresh = evs.slice(consumedEvents);
              consumedEvents = evs.length;
              for (const ev of fresh) void handleEvent(ev);
            }
          },
          onDone: () => {
            buildAgentActiveJobs.delete(projectId);
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, pending: false, raw: assistantText, content: stripTags(assistantText) || "Done ✅" };
              }
              return copy;
            });
            supabase.from("ai_project_messages")
              .select("id, role, content")
              .eq("project_id", projectId)
              .order("created_at", { ascending: true })
              .then(({ data }) => {
                if (data) setMessages((data as Msg[]).map((m) => ({
                  ...m,
                  raw: m.role === "assistant" ? m.content : undefined,
                  content: m.role === "assistant" ? stripTags(m.content) : m.content,
                })));
              });
            if (fileEvents.length > 0 && projectId) {
              // Push fresh files to Cloudflare preview so the iframe shows latest
              void deploy("preview");
            }
            unsub();
            resolve();
          },
          onError: (msg) => {
            buildAgentActiveJobs.delete(projectId);
            toast.error(msg);
            setMessages((m) => m.filter((x) => !x.pending));
            unsub();
            resolve();
          },
          onStale: async (row) => {
            const msg = "The coding agent stopped before finishing. Conversation and files were saved — you can resume from the same project.";
            buildAgentActiveJobs.delete(projectId);
            await failStaleJob(row.id, msg);
            toast.error(msg);
            setMessages((m) => m.filter((x) => !x.pending));
            await reloadFiles();
            unsub();
            resolve();
          },
        });
      });
    } catch (e) {
      toast.error(String((e as Error).message));
      setMessages((m) => m.filter((x) => !x.pending));
      setInput(text); // restore draft so user doesn't lose their message
    } finally {
      setStreaming(false);
      setStep("");
    }
  };

  const deploy = async (mode: "preview" | "publish") => {
    if (!projectId) return;
    if (mode === "publish" && publishing) return;
    if (mode === "publish") setPublishing(true);
    try {
      const prepared = await prepareProjectFilesForDeploy(projectId, files);
      if (prepared.patches.length) {
        setFiles(prepared.files);
        toast.info("Build files repaired before publish");
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in first");
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cloudflare-deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ project_id: projectId, mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Publish failed");
      setProject((p) => p ? {
        ...p,
        ...(mode === "publish" ? { published_url: data.url } : { preview_url: data.url }),
      } : p);
      if (mode === "publish") {
        toast.success("Published to Cloudflare ✨");
      }
    } catch (e) {
      if (mode === "publish") toast.error(String((e as Error).message));
      else console.warn("preview deploy failed:", e);
    } finally {
      if (mode === "publish") setPublishing(false);
    }
  };

  const publish = async () => {
    // Ensure publish uses the latest files by syncing a fresh preview first
    await deploy("preview");
    await deploy("publish");
  };

  const activeContent = files.find((f) => f.path === activeFile)?.content ?? "";

  const isMobile = useIsMobile();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isPreviewRoute = location.pathname.endsWith("/preview");
  const isChatRoute = location.pathname.endsWith("/chat");
  const isFilesRoute = location.pathname.endsWith("/files");
  const isConsoleRoute = location.pathname.endsWith("/console");
  const isBaseProjectRoute = !!projectId && location.pathname === `/build/${projectId}`;
  const useNewMobileViews = isMobile && (isChatRoute || isPreviewRoute);
  const preferredMobileView = useMemo<"chat" | "preview">(() => {
    if (hasAutoPrompt) return "chat";
    if (typeof window !== "undefined") {
      const savedView = localStorage.getItem(`megsy:last-view:${projectId}`);
      if (savedView === "chat" || savedView === "preview") return savedView;
    }
    if (project?.preview_url || project?.published_url || files.length > 0 || messages.length > 0) return "preview";
    return "chat";
  }, [files.length, hasAutoPrompt, messages.length, project?.preview_url, project?.published_url, projectId]);

  useEffect(() => {
    if (isFilesRoute) setTab("code");
    else if (isConsoleRoute) setTab("console");
    else if (isPreviewRoute) setTab("preview");
  }, [isFilesRoute, isConsoleRoute, isPreviewRoute]);

  useEffect(() => {
    if (!projectId) return;
    const activeView = isPreviewRoute ? "preview" : isChatRoute ? "chat" : null;
    if (!activeView) return;
    try {
      localStorage.setItem(`megsy:last-view:${projectId}`, activeView);
    } catch {
      // noop
    }
  }, [projectId, isPreviewRoute, isChatRoute]);

  // Default /megsy-pr/:id → redirect to /chat once project loads
  useEffect(() => {
    if (!projectId || !initialLoaded || !isBaseProjectRoute) return;
    navigate(`/build/${projectId}/${preferredMobileView}`, { replace: true });
  }, [projectId, initialLoaded, isBaseProjectRoute, preferredMobileView, navigate]);

  if (useNewMobileViews) {
    const showPreview = isPreviewRoute || (isBaseProjectRoute && initialLoaded && preferredMobileView === "preview");
    return (
      <>
        {!showPreview && (
          <MobileChatView
            projectId={projectId!}
            projectName={project?.name ?? "Project"}
            messages={messages.map(m => ({ ...m })) as any}
            streaming={streaming}
            step={step}
            input={input}
            setInput={setInput}
            onSend={() => send(input)}
            onStop={() => setStreaming(false)}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
            onOpenPreview={() => navigate(`/build/${projectId}/preview`)}
            onProjectRenamed={(name) => setProject(p => p ? { ...p, name } : p)}
            onAction={(id) => {
              if (id === "publish") navigate(`/build/${projectId}/preview`);
              else if (id === "history") navigate(`/build/${projectId}/versions`);
              else toast(`${id} — coming in phase 2`);
            }}
          />
        )}
        {showPreview && (
          <MobilePreviewView
            projectId={projectId!}
            projectName={project?.name ?? "Project"}
            files={files}
            previewUrl={project?.preview_url}
            publishedUrl={project?.published_url}
            hasUnpublishedChanges={!!project?.preview_url && project?.preview_url !== project?.published_url}
            onPublished={(url) => setProject((p) => p ? { ...p, published_url: url } : p)}
            step={step}
            streaming={streaming}
            onIframeReady={setPreviewIframe}
          />
        )}
        <AppSidebar
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          onNewChat={() => navigate("/chat")}
          currentMode="megsy-pr"
        />
      </>
    );
  }

  return (
    <>
    <AppSidebar
      open={mobileSidebarOpen}
      onClose={() => setMobileSidebarOpen(false)}
      onNewChat={() => navigate("/chat")}
      currentMode="megsy-pr"
    />
    <div className="mb-paper flex h-[100dvh] w-full flex-col overflow-hidden" data-build-redesign="structured-depth-v7">
      {/* Top rail — Lovable-style: brand → segmented pill → URL bar → publish */}
      <header className="mb-rail shrink-0 px-3 flex items-center gap-1.5">
        {/* Project name + menu */}
        <ProjectMenu
          projectName={project?.name ?? "Untitled"}
          onRename={async () => {
            const next = window.prompt("New project name", project?.name ?? "");
            if (!next || !projectId || next === project?.name) return;
            const { error } = await supabase.from("projects").update({ name: next }).eq("id", projectId);
            if (error) { toast.error(error.message); return; }
            setProject((p) => (p ? { ...p, name: next } : p));
            toast.success("Renamed");
          }}
          onSettings={() => navigate(`/build/${projectId}/settings`)}
          onExit={() => navigate("/")}
        />

        <div className="mb-rail-divider" />

        {/* Segmented pill: all stage options */}
        <div className="mb-pill-group">
          <button onClick={() => setTab("preview")} className="mb-pill-tab" data-active={tab === "preview"} title="Preview">
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
          <div className="mb-pill-sep" />
          <button onClick={() => setTab("code")} className="mb-pill-icon" data-active={tab === "code"} title="Code">
            <Code2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setTab("console")} className="mb-pill-icon" data-active={tab === "console"} title="Console">
            <AlertTriangle className="w-3.5 h-3.5" />
            {consoleEntries.filter(e => e.level === "error").length > 0 && (
              <span className="mb-pill-badge">{consoleEntries.filter(e => e.level === "error").length}</span>
            )}
          </button>
        </div>


        {/* Spacer */}
        <div className="flex-1 min-w-0" />





        <button
          onClick={publish}
          disabled={publishing || streaming || files.length === 0}
          className="mb-publish"
        >
          {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {project?.published_url ? "Update" : "Publish"}
        </button>
      </header>

      {/* Canvas — true split-screen, hairline divider */}
      <div className="mb-canvas flex-1 min-h-0">



        {/* Chat */}
        <aside className="mb-chat">
          <div ref={scrollRef} className="mb-chat-scroll">
            {messages.length === 0 && !streaming && (
              <div className="mb-chat-empty">
                <div className="mb-chat-empty-mark">¶</div>
                <p className="mb-eyebrow mb-2">Start a conversation</p>
                <p className="text-sm text-[color:var(--ink-soft)] max-w-xs mx-auto leading-relaxed">
                  Describe what you want to build. Megsy will write the code and ship a live preview on the right.
                </p>
              </div>
            )}
            {messages.length > 0 && (
              <div className="mb-chat-timestamp">
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? `${m.role}-${i}-${String(m.content).slice(0, 24)}`} className="mb-msg">
                <div className="min-w-0">
                  <div className={`mb-msg-author ${m.role === "user" ? "mb-msg-author--user" : ""}`}>
                    {m.role === "user" ? "You" : "Megsy"}
                  </div>
                  <div
                    className={m.role === "user" ? "mb-msg-body mb-msg-body--user" : "mb-msg-body mb-msg-body--assistant"}
                    dir="auto"
                  >
                    {m.content || (m.pending ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "")}
                  </div>
                  {m.role === "assistant" && m.raw && !m.pending && (
                    <div className="mt-2">
                      <ChangedFilesPill rawContent={m.raw} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {streaming && step && (
              <div className="mb-step">
                <Loader2 className="w-3 h-3 animate-spin" /> {step}
              </div>
            )}
          </div>

          <div className="mb-composer">
            <div className="mb-composer-shell">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Queue follow-up…"
                rows={1}
                dir="auto"
                disabled={streaming}
              />
              <div className="mb-composer-toolbar">
                <PlusMenu
                  onAttachFile={async (file) => {
                    if (!projectId) return;
                    try {
                      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                      const path = `${projectId}/assets/${Date.now()}-${safe}`;
                      const { error } = await supabase.storage.from("project-assets").upload(path, file, { upsert: true });
                      if (error) throw error;
                      toast.success(`Attached ${file.name}`);
                      setInput((v) => (v ? `${v} ` : "") + `[file: ${file.name}]`);
                    } catch (e: any) {
                      toast.error(e.message || "Upload failed");
                    }
                  }}
                  onOpenGithub={() => setTab("github")}
                  onOpenSnapshots={() => setTab("snapshots")}
                  onOpenSupabase={() => setTab("supabase")}
                  onOpenDomains={() => setTab("domains")}
                  onOpenVisual={() => setTab("visual")}
                />
                {projectId && <VisualEditorToggle iframe={previewIframe} onPicked={(inst) => send(inst)} />}

                <div className="flex-1" />
                <button className="mb-composer-mode" title="Mode">
                  Build
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => send(input)}
                  disabled={(!input.trim() && !streaming)}
                  className="mb-composer-send"
                  title={streaming ? "Stop" : "Send"}
                >
                  {streaming ? <span className="mb-stop-square" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Hairline divider */}
        <div className="mb-divider" />

        {/* Stage — preview / code / console */}
        <main className="mb-stage">
          {tab === "preview" && (
            <>
              <div className="mb-stage-header">
                <div className="flex items-center gap-3">
                  <span className="mb-eyebrow">Live preview</span>
                  <span className="mb-mono text-[10px] text-[color:var(--ink-mute)]">
                    {previewDevice === "desktop" ? "1440×900" : previewDevice === "tablet" ? "768×1024" : "390×844"}
                  </span>
                </div>
                <div className="mb-device-toggle">
                  {([
                    ["desktop", Monitor, "Desktop"],
                    ["tablet", Tablet, "Tablet"],
                    ["mobile", Smartphone, "Mobile"],
                  ] as const).map(([dev, Icon, label]) => (
                    <button
                      key={dev}
                      onClick={() => setPreviewDevice(dev)}
                      title={label}
                      data-active={previewDevice === dev}
                      className="mb-device-btn"
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-stage-body">
                <div className="mb-stage-frame">
                  <BuildPreview
                    files={files}
                    projectId={projectId}
                    streaming={streaming}
                    device={previewDevice}
                    sandboxDevUrl={project?.preview_url ?? null}
                    onError={(msg) => {
                      const errorMessage = formatPreviewMessage(msg);
                      setPreviewError(errorMessage);
                      setConsoleEntries((c) => [...c.slice(-99), { level: "error", message: errorMessage, t: Date.now() }]);
                      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current);
                      autoFixTimerRef.current = window.setTimeout(() => {
                        if (streaming) return;
                        const key = errorMessage.slice(0, 100);
                        const tries = autoFixAttemptsRef.current.get(key) ?? 0;
                        if (tries >= 3) return;
                        autoFixAttemptsRef.current.set(key, tries + 1);
                        send(`Fix this error`, errorMessage);
                        setPreviewError(null);
                      }, 1800);
                    }}
                    onConsole={(e) => setConsoleEntries((c) => [...c.slice(-99), { ...e, t: Date.now() }])}
                    onIframeReady={setPreviewIframe}
                  />
                </div>
                {previewError && !streaming && (
                  <div className="mb-error-banner">
                    <div className="flex-1 min-w-0">
                      <p className="mb-error-title text-[12px]">Preview error — auto-fixing</p>
                      <p className="mb-mono text-[11px] opacity-80 truncate" dir="ltr">{previewError}</p>
                    </div>
                    <button
                      onClick={() => { send(`Fix this error`, previewError); setPreviewError(null); }}
                      className="mb-error-fix"
                    >
                      Fix now
                    </button>
                    <button onClick={() => setPreviewError(null)} className="mb-btn mb-btn-icon mb-btn-ghost" style={{ color: "var(--paper)" }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "code" && (
            <>
              <div className="mb-stage-header">
                <span className="mb-eyebrow">Source files</span>
                <span className="mb-mono text-[10px] text-[color:var(--ink-mute)]">{files.length} files</span>
              </div>
              <div className="flex-1 min-h-0">
                <div className="mb-code-shell">
                  <div className="mb-code-list">
                    {files.length === 0 && (
                      <div className="p-4 mb-mono text-[11px] text-[color:var(--ink-mute)]">No files yet</div>
                    )}
                    {files.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => setActiveFile(f.path)}
                        data-active={activeFile === f.path}
                        className="mb-code-item"
                      >
                        <FileCode className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate" dir="ltr">{f.path}</span>
                      </button>
                    ))}
                  </div>
                  {activeFile ? (
                    <CodeEditor
                      projectId={projectId!}
                      path={activeFile}
                      initialContent={activeContent}
                      onSaved={(p, c) => setFiles((fs) => fs.map((f) => f.path === p ? { ...f, content: c } : f))}
                    />
                  ) : (
                    <div className="grid place-items-center mb-mono text-[11px] text-[color:var(--ink-mute)] bg-[color:var(--paper-2)]">
                      Select a file to edit
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === "console" && (
            <div className="mb-console flex-1 min-h-0">
              <div className="mb-console-bar">
                <span>Runtime console · {consoleEntries.length}</span>
                <button
                  onClick={() => setConsoleEntries([])}
                  className="mb-mono text-[10px] uppercase tracking-wider hover:text-[color:var(--paper)]"
                  style={{ color: "rgba(245,243,238,0.6)" }}
                >
                  Clear
                </button>
              </div>
              {consoleEntries.length === 0 && (
                <div className="p-8 text-center text-[color:rgba(245,243,238,0.4)] mb-mono text-[11px]">No logs yet</div>
              )}
              {consoleEntries.map((e, i) => (
                <div key={i} className="mb-console-line" data-level={e.level} dir="ltr">
                  <span className="opacity-50 me-2">[{e.level}]</span>{e.message}
                </div>
              ))}
            </div>
          )}

          {(tab === "github" || tab === "snapshots" || tab === "cost" || tab === "visits" || tab === "supabase" || tab === "domains" || tab === "visual") && projectId && (
            <>
              <div className="mb-stage-header">
                <span className="mb-eyebrow">
                  {tab === "github" && "GitHub"}
                  {tab === "snapshots" && "Snapshots & versions"}
                  {tab === "cost" && "Cost dashboard"}
                  {tab === "visits" && "Visits"}
                  {tab === "supabase" && "Cloud (Supabase)"}
                  {tab === "domains" && "Custom domains"}
                  {tab === "visual" && "Visual editor"}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-6">
                <div className="max-w-2xl mx-auto">
                  {tab === "github" && <GitHubPanel projectId={projectId} projectName={project?.name} files={files} onImported={reloadFiles} />}
                  {tab === "snapshots" && <SnapshotsPanel projectId={projectId} onRestored={reloadFiles} />}
                  {tab === "cost" && <CostDashboard projectId={projectId} />}
                  {tab === "visits" && <VisitsPanel projectId={projectId} />}
                  {tab === "supabase" && (
                    <SupabaseConnectionPanel
                      projectId={projectId}
                      linkedProjectName={project?.linked_supabase_project_name}
                      linkedProjectRef={project?.linked_supabase_project_ref}
                      onChange={async () => {
                        const { data: p } = await supabase
                          .from("projects")
                          .select("id, name, published_url, preview_url, linked_supabase_project_ref, linked_supabase_project_name")
                          .eq("id", projectId).single();
                        if (p) setProject(p);
                      }}
                    />
                  )}
                  {tab === "domains" && (
                    <button
                      onClick={() => navigate(`/build/${projectId}/domains`)}
                      className="mb-publish"
                    >
                      Open domains manager
                    </button>
                  )}
                  {tab === "visual" && <VisualEditorToggle iframe={previewIframe} onPicked={(inst) => { send(inst); setTab("preview"); }} />}
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
    </>
  );
}


/* ============================================================================
 * SnapshotsPanel — snapshots list + restore
 * ========================================================================== */
interface Snapshot {
  id: string;
  label: string | null;
  file_count: number;
  total_bytes: number;
  created_at: string;
}

function SnapshotsPanel({
  projectId,
  onRestored,
}: {
  projectId: string;
  onRestored?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_project_snapshots")
      .select("id, label, file_count, total_bytes, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Snapshot[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const restore = async (snap: Snapshot) => {
    if (!confirm(`Restore this version (${snap.file_count} files)? Current files will be overwritten.`)) return;
    setRestoring(snap.id);
    try {
      const { data, error } = await supabase
        .from("ai_project_snapshots")
        .select("files")
        .eq("id", snap.id)
        .single();
      if (error) throw error;
      const files = (data?.files as Array<{ path: string; content: string }>) ?? [];
      // Wipe + rewrite project files
      await supabase.from("ai_project_files").delete().eq("project_id", projectId);
      if (files.length) {
        const rows = files.map((f) => ({ project_id: projectId, path: f.path, content: f.content }));
        const { error: insErr } = await supabase.from("ai_project_files").insert(rows);
        if (insErr) throw insErr;
      }
      toast.success("Restored successfully");
      onRestored?.();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 w-9 rounded-xl hover:bg-foreground/10 grid place-items-center text-muted-foreground hover:text-foreground transition"
        title="Previous versions"
      >
        <History className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="ios26-glass-strong rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 border-b border-foreground/10">
              <div className="flex items-center gap-2 font-medium text-sm">
                <History className="w-4 h-4" /> Previous versions
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading && <div className="text-center text-xs text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin inline mx-1" /> Loading...</div>}
              {!loading && !items.length && <div className="text-center text-xs text-muted-foreground py-6">No previous versions yet</div>}
              {items.map((s) => (
                <div key={s.id} className="ios26-glass rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate" dir="auto">{s.label || "Automatic version"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(s.created_at).toLocaleString("ar-EG")} · {s.file_count} files · {(s.total_bytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => restore(s)}
                    disabled={restoring === s.id}
                    className="ios26-button h-8 px-3 text-xs inline-flex items-center gap-1"
                  >
                    {restoring === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================================
 * CostDashboard — Total MC used
 * ========================================================================== */
interface UsageRow {
  action: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  mc_cost: number | null;
  duration_ms: number | null;
  created_at: string;
}

function CostDashboard({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_project_usage")
      .select("action, model, prompt_tokens, completion_tokens, mc_cost, duration_ms, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as UsageRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const totals = useMemo(() => {
    const mc = rows.reduce((a, r) => a + Number(r.mc_cost ?? 0), 0);
    const tokens = rows.reduce((a, r) => a + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0), 0);
    const calls = rows.length;
    const avgMs = calls ? rows.reduce((a, r) => a + (r.duration_ms ?? 0), 0) / calls : 0;
    return { mc, tokens, calls, avgMs };
  }, [rows]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 w-9 rounded-xl hover:bg-foreground/10 grid place-items-center text-muted-foreground hover:text-foreground transition"
        title="MC usage"
      >
        <DollarSign className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="ios26-glass-strong rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-foreground/10">
              <div className="flex items-center gap-2 font-medium text-sm">
                <DollarSign className="w-4 h-4" /> Project usage
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4">
              <Stat label="Total MC" value={totals.mc.toFixed(2)} />
              <Stat label="Calls" value={totals.calls.toString()} />
              <Stat label="Total tokens" value={totals.tokens.toLocaleString()} />
              <Stat label="Avg time" value={`${(totals.avgMs / 1000).toFixed(1)}s`} />
            </div>

            <div className="flex-1 overflow-y-auto p-3 pt-0">
              {loading && <div className="text-center text-xs text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin inline mx-1" /> Loading...</div>}
              {!loading && !rows.length && <div className="text-center text-xs text-muted-foreground py-6">No usage data yet</div>}
              {rows.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-start px-2 py-1.5 font-normal">Operation</th>
                      <th className="text-start px-2 py-1.5 font-normal">Model</th>
                      <th className="text-end px-2 py-1.5 font-normal">Tokens</th>
                      <th className="text-end px-2 py-1.5 font-normal">MC</th>
                      <th className="text-end px-2 py-1.5 font-normal">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-foreground/5">
                        <td className="px-2 py-1.5">{r.action || "-"}</td>
                        <td className="px-2 py-1.5 truncate max-w-[160px]">{r.model || "-"}</td>
                        <td className="px-2 py-1.5 text-end">{((r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0)).toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-end">{Number(r.mc_cost ?? 0).toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-end text-muted-foreground">{((r.duration_ms ?? 0) / 1000).toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ios26-glass rounded-xl p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ChangedFilesPill({ rawContent }: { rawContent: string }) {
  const changed = useMemo(() => parseBuildAgentChanges(rawContent), [rawContent]);

  if (!changed.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {changed.map((f, index) => {
        const existed = f.action !== "create";
        return (
          <div
            key={`${f.action}:${f.path}:${f.to ?? ""}:${index}`}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg ios26-glass"
            title={f.to ? `${f.path} → ${f.to}` : f.path}
          >
            <FileDiff className="w-3 h-3" />
            <span className="font-mono">{f.path}</span>
            {f.to && <span className="font-mono text-muted-foreground">→ {f.to}</span>}
            <span className={`text-[10px] ${f.action === "delete" ? "text-rose-500" : existed ? "text-amber-500" : "text-emerald-500"}`}>
              {changeActionLabel(f.action)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * VisualEditorToggle — click→edit mode for the preview iframe
 * ========================================================================== */
function VisualEditorToggle({
  iframe,
  onPicked,
}: {
  iframe: HTMLIFrameElement | null;
  onPicked: (instruction: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [picked, setPicked] = useState<{ selector: string; text: string; tag: string } | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    iframe?.contentWindow?.postMessage({ __lov_visual_edit: true, enabled }, "*");
  }, [enabled, iframe]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d && d.__lov_visual_pick) {
        setPicked({ selector: d.selector, text: d.text, tag: d.tag });
        setDraft(d.text || "");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const submit = () => {
    if (!picked) return;
    const inst = `On element ${picked.tag} (${picked.selector}) whose current text is:\n"${picked.text}"\n\nApply the following edit:\n${draft}`;
    onPicked(inst);
    setPicked(null);
    setEnabled(false);
  };

  return (
    <>
      <button
        onClick={() => setEnabled((v) => !v)}
        className={`h-9 w-9 rounded-xl grid place-items-center transition ${
          enabled ? "bg-primary text-primary-foreground" : "hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
        }`}
        title="Visual editor (click to edit)"
      >
        <MousePointerClick className="w-4 h-4" />
      </button>
      {picked && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" onClick={() => setPicked(null)}>
          <div className="ios26-glass-strong rounded-2xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">Edit element</div>
              <button onClick={() => setPicked(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono truncate">{picked.selector}</div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              dir="auto"
              placeholder="Describe the change you want…"
              className="w-full bg-transparent ios26-glass rounded-xl p-3 text-sm outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPicked(null)} className="text-xs text-muted-foreground px-3 h-8">Cancel</button>
              <button onClick={submit} disabled={!draft.trim()} className="ios26-button h-8 px-3 text-xs">Send to AI</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================================
 * SelfTestButton — runs the self-test edge function and shows a report
 * ========================================================================== */
function SelfTestButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("project-self-test", { body: { projectId } });
      if (error) throw error;
      setReport(data);
      if (data.ok) toast.success("Scan completed successfully");
      else toast.warning(`${data.errors || 0} errors, ${data.warnings || 0} warnings`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); run(); }}
        className="h-9 w-9 rounded-xl hover:bg-foreground/10 grid place-items-center text-muted-foreground hover:text-foreground transition"
        title="Project self-check"
      >
        <ShieldCheck className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="ios26-glass-strong rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-foreground/10">
              <div className="flex items-center gap-2 font-medium text-sm">
                <ShieldCheck className="w-4 h-4" /> Self-check
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading && <div className="text-center text-xs text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin inline mx-1" /> Scanning…</div>}
              {!loading && report && (
                <>
                  <div className={`flex items-center gap-2 text-sm ${report.ok ? "text-emerald-500" : "text-amber-500"}`}>
                    {report.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {report.ok ? "Everything works" : `${report.errors || 0} errors, ${report.warnings || 0} warnings`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Files: {report.fileCount} · Bundle: {report.bundleOk ? "OK" : "FAIL"}
                  </div>
                  <div className="space-y-1.5 pt-2">
                    {(report.issues || []).map((i: any, idx: number) => (
                      <div key={idx} className={`text-[11px] p-2 rounded-lg ${
                        i.level === "error" ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {i.file && <span className="font-mono opacity-70">{i.file}: </span>}
                        {i.message}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button onClick={run} disabled={loading} className="ios26-button w-full h-8 text-xs mt-3">Re-scan</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================================
 * IndexFilesButton — generate vector embeddings for project files
 * ========================================================================== */
function IndexFilesButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("index-project-files", { body: { projectId, force: false } });
      if (error) throw error;
      toast.success(`Indexed ${data.indexed} files${data.failed ? ` (${data.failed} failed)` : ""}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={run}
      disabled={loading}
      className="h-9 w-9 rounded-xl hover:bg-foreground/10 grid place-items-center text-muted-foreground hover:text-foreground transition"
      title="Index files (Smart context)"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
    </button>
  );
}

/* ============================================================================
 * VisitsPanel — visitor analytics
 * ========================================================================== */
interface Visit { path: string; referrer: string | null; country: string | null; ua_hash: string | null; created_at: string }

function VisitsPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_visits")
      .select("path, referrer, country, ua_hash, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Visit[]);
    setLoading(false);
  };

  useEffect(() => { if (open) load();   }, [open, projectId]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = rows.filter((r) => new Date(r.created_at) >= today).length;
    const uniques = new Set(rows.map((r) => r.ua_hash)).size;
    const topPaths = Object.entries(
      rows.reduce<Record<string, number>>((a, r) => { a[r.path] = (a[r.path] ?? 0) + 1; return a; }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total: rows.length, todayCount, uniques, topPaths };
  }, [rows]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 w-9 rounded-xl hover:bg-foreground/10 grid place-items-center text-muted-foreground hover:text-foreground transition"
        title="Visitor analytics"
      >
        <BarChart3 className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="ios26-glass-strong rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-foreground/10">
              <div className="flex items-center gap-2 font-medium text-sm">
                <BarChart3 className="w-4 h-4" /> Visitor analytics
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </header>
            <div className="grid grid-cols-3 gap-2 p-4">
              <Stat label="Total visits" value={stats.total.toString()} />
              <Stat label="Today" value={stats.todayCount.toString()} />
              <Stat label="Unique visitors" value={stats.uniques.toString()} />
            </div>
            {stats.topPaths.length > 0 && (
              <div className="px-4 pb-2">
                <div className="text-[11px] text-muted-foreground mb-1.5">Most visited pages</div>
                <div className="space-y-1">
                  {stats.topPaths.map(([p, n]) => (
                    <div key={p} className="flex items-center justify-between text-xs ios26-glass rounded-lg px-2 py-1.5">
                      <span className="font-mono truncate">{p}</span>
                      <span className="text-muted-foreground">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 pt-0">
              {loading && <div className="text-center text-xs text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin inline mx-1" /> Loading…</div>}
              {!loading && !rows.length && <div className="text-center text-xs text-muted-foreground py-6">No visits yet. Add tracking to the published site.</div>}
              {rows.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-start px-2 py-1.5 font-normal">Time</th>
                      <th className="text-start px-2 py-1.5 font-normal">Page</th>
                      <th className="text-start px-2 py-1.5 font-normal">Source</th>
                      <th className="text-start px-2 py-1.5 font-normal">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t border-foreground/5">
                        <td className="px-2 py-1.5 text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</td>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[140px]">{r.path}</td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]">{r.referrer || "-"}</td>
                        <td className="px-2 py-1.5">{r.country || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface CodeEditorProps {
  projectId: string;
  path: string;
  initialContent: string;
  onSaved?: (path: string, content: string) => void;
}

function CodeEditor({ projectId, path, initialContent, onSaved }: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    setDirty(false);
  }, [path, initialContent]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("ai_project_files")
        .upsert({ project_id: projectId, path, content }, { onConflict: "project_id,path" });
      if (error) throw error;
      onSaved?.(path, content);
      setDirty(false);
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 text-xs">
        <span className="font-mono text-zinc-400 truncate" dir="ltr">{path}</span>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setDirty(true); }}
        className="flex-1 w-full bg-zinc-950 text-zinc-100 p-3 font-mono text-xs resize-none outline-none"
        spellCheck={false}
        dir="ltr"
      />
    </div>
  );
}

interface VersionRecord {
  id: string;
  created_at: string;
  message?: string | null;
}

function VersionHistory({ projectId, onRestored }: { projectId: string; onRestored?: () => void }) {
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("project_versions")
        .select("id, created_at, message")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      setVersions((data as VersionRecord[]) || []);
    })();
  }, [open, projectId]);

  const restore = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("restore-version", {
        body: { projectId, versionId: id },
      });
      if (error) throw error;
      toast.success("Version restored");
      onRestored?.();
    } catch (e: any) {
      toast.error(e.message || "Restore failed");
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent"
      >
        <span className="flex items-center gap-2"><History className="w-3.5 h-3.5" /> Version history</span>
        <span className="text-muted-foreground">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="border-t border-border/50 max-h-64 overflow-y-auto">
          {versions.length === 0 && <div className="p-3 text-xs text-muted-foreground">No versions</div>}
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-3 py-2 border-b border-border/30 text-[11px]">
              <div className="min-w-0">
                <div className="truncate text-foreground/80">{v.message || "No description"}</div>
                <div className="text-muted-foreground" dir="ltr">{new Date(v.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => restore(v.id)} className="shrink-0 p-1.5 rounded-md hover:bg-accent" title="Restore">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface GitHubPanelProps {
  projectId: string;
  projectName?: string;
  files: BuildFile[];
  onImported?: () => void;
}

function GitHubPanel({ projectId, projectName, files, onImported }: GitHubPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"push" | "import" | null>(null);
  const [repo, setRepo] = useState("");

  const push = async () => {
    if (files.length === 0) return toast.error("No files to upload");
    setBusy("push");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const filesObj: Record<string, string> = {};
      files.forEach((f) => { filesObj[f.path] = f.content; });
      const { data, error } = await supabase.functions.invoke("github-push", {
        body: { action: "push", project_id: projectId, project_name: projectName || "megsy-app", description: "Built with Megsy AI", files: filesObj },
      });
      if (error) throw error;
      toast.success("GitHub synced successfully", { description: data?.repo_url || "Repository updated from the backend integration" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(null); }
  };

  const importRepo = async () => {
    const m = repo.trim().match(/^(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/);
    if (!m) return toast.error("Invalid repo format (owner/repo)");
    setBusy("import");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase.functions.invoke("github-import", {
        body: { user_id: user.id, project_id: projectId, repo: `${m[1]}/${m[2]}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Imported ${data?.imported ?? 0} files`);
      setOpen(false); setRepo("");
      onImported?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(null); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-xl hover:bg-foreground/10 grid place-items-center text-muted-foreground hover:text-foreground transition"
        title="GitHub"
      >
        <Github className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-50 ios26-glass-strong rounded-2xl p-3 w-72 shadow-2xl space-y-2">
          <button
            onClick={push}
            disabled={!!busy}
            className="w-full ios26-button inline-flex items-center justify-center gap-2 h-9 text-xs disabled:opacity-50"
          >
            {busy === "push" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Push project to GitHub
          </button>
          <div className="pt-2 border-t border-foreground/10 space-y-2">
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="owner/repo or GitHub URL"
              dir="ltr"
              className="w-full ios26-glass rounded-xl px-3 py-2 text-xs outline-none"
            />
            <button
              onClick={importRepo}
              disabled={!!busy || !repo.trim()}
              className="w-full ios26-glass-strong inline-flex items-center justify-center gap-2 h-9 text-xs rounded-xl disabled:opacity-50"
            >
              {busy === "import" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Import a repo as a starting point
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



interface Props {
  projectId: string;
  linkedProjectName?: string | null;
  linkedProjectRef?: string | null;
  onChange: () => void;
}

type SbProject = { id: string; name: string; region: string; organization_id: string };

function SupabaseConnectionPanel({ projectId, linkedProjectName, linkedProjectRef, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<SbProject[] | null>(null);
  const [loading, setLoading] = useState(false);

  const callApi = async (action: string, body: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sign in first");
    const r = await fetch(`${SUPABASE_URL}/functions/v1/supabase-link-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const checkStatus = async () => {
    try { const r = await callApi("status"); setConnected(r.connected); }
    catch { setConnected(false); }
  };

  useEffect(() => { if (open) checkStatus(); }, [open]);

  const startOAuth = async () => {
    setLoading(true);
    try {
      const r = await callApi("status");
      setConnected(!!r.connected);
      if (!r.connected) throw new Error(r.error || "Supabase backend token is not configured");
      await loadProjects();
      toast.success("Supabase backend integration is active");
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setLoading(false); }
  };

  const loadProjects = async () => {
    setLoading(true);
    try { const r = await callApi("list_projects"); setProjects(r.projects); }
    catch (e) { toast.error(String((e as Error).message)); }
    finally { setLoading(false); }
  };

  const linkProject = async (p: SbProject) => {
    setLoading(true);
    try {
      await callApi("link_project", { project_id: projectId, ref: p.id, name: p.name });
      toast.success(`Linked to ${p.name}`);
      onChange();
      setOpen(false);
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setLoading(false); }
  };

  const unlink = async () => {
    if (!confirm("Unlink? Your current code won't be deleted, but it won't be able to modify your database.")) return;
    setLoading(true);
    try { await callApi("unlink_project", { project_id: projectId }); onChange(); toast.success("Unlinked"); }
    catch (e) { toast.error(String((e as Error).message)); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`h-9 px-3 rounded-xl grid place-items-center transition inline-flex items-center gap-1.5 text-xs ${
          linkedProjectRef
            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
            : "hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
        }`}
        title={linkedProjectName ? `Supabase: ${linkedProjectName}` : "Connect Supabase"}
      >
        <Database className="w-4 h-4" />
        <span className="hidden md:inline">{linkedProjectName ? linkedProjectName : "Supabase"}</span>
        {linkedProjectRef && <Check className="w-3 h-3" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="ios26-glass-strong rounded-2xl max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-semibold flex-1">Connect Supabase</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-xs">Close</button>
            </div>

            {connected === null && <div className="py-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin opacity-50" /></div>}

            {connected === false && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Supabase will be connected through the backend token, without opening an external dashboard.
                </p>
                <button
                  onClick={startOAuth}
                  disabled={loading}
                  className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium inline-flex items-center justify-center gap-2 transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Use backend integration
                </button>
              </div>
            )}

            {connected === true && (
              <div className="space-y-3">
                {linkedProjectName ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-muted-foreground mb-1">Linked project:</p>
                    <p className="font-medium text-emerald-400">{linkedProjectName}</p>
                    <button onClick={unlink} disabled={loading} className="mt-2 text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1">
                      <Unlink className="w-3 h-3" /> Unlink
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Choose a Supabase project to link to this build project:</p>
                )}

                {!projects && (
                  <button onClick={loadProjects} disabled={loading} className="w-full h-10 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-sm inline-flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Show projects"}
                  </button>
                )}

                {projects && (
                  <div className="max-h-72 overflow-y-auto space-y-1.5">
                    {projects.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No projects found from the backend integration</p>}
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => linkProject(p)}
                        disabled={loading || p.id === linkedProjectRef}
                        className="w-full text-start p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition flex items-center gap-2 text-sm disabled:opacity-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.region} · {p.id}</p>
                        </div>
                        {p.id === linkedProjectRef && <Check className="w-4 h-4 text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BuildPreview({ files, projectId, streaming, device = "desktop", sandboxDevUrl, onError, onConsole, onIframeReady }: BuildPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const lastHashRef = useRef<string>("");

  useEffect(() => { onIframeReady?.(iframeRef.current); }, [onIframeReady, html, sandboxDevUrl]);

  useEffect(() => {
    if (sandboxDevUrl) return;
    if (!files.length || !projectId) return;
    const hash = files.map((f) => `${f.path}:${f.content?.length || 0}`).join("|");
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    // Streaming → rebuild faster (every new file). Idle → keep batched 600ms.
    const delay = streaming ? 200 : 600;

    const debounce = window.setTimeout(async () => {
      setLoading(true);
      try {
        const filesObj: Record<string, string> = {};
        for (const f of files) filesObj[f.path] = f.content;
        const { data, error } = await supabase.functions.invoke("bundle-preview-fast", {
          body: { projectId, files: filesObj },
        });
        if (error) throw new Error(error.message);
        if (data?.html) setHtml(data.html);
        else if (data?.error) {
          onError?.(data.error);
          setHtml(createPreviewFallbackHtml(files, data.error));
        }
      } catch (e) {
        const msg = (e as Error).message || "Preview bundler unavailable";
        onConsole?.({ level: "warn", message: msg });
        setHtml(createPreviewFallbackHtml(files, msg));
      } finally {
        setLoading(false);
      }
    }, delay);
    return () => window.clearTimeout(debounce);
  }, [files, projectId, streaming, onError, sandboxDevUrl]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      const payload = e.data as Record<string, unknown>;
      if (payload.__lov_console) {
        onConsole?.({
          level: typeof payload.level === "string" ? payload.level : "log",
          message: formatPreviewMessage(Array.isArray(payload.args) ? payload.args.join(" ") : payload.message),
        });
      }
      if (payload.__lov_error) onError?.(formatPreviewMessage(payload.message ?? payload.stack ?? payload.__lov_error));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onConsole, onError]);

  if (!files.length) {
    return (
      <div className="h-full w-full grid place-items-center text-muted-foreground text-sm">
        Start the chat to generate the project
      </div>
    );
  }

  const frameSize =
    device === "mobile" ? { w: 390, h: 844 } :
    device === "tablet" ? { w: 820, h: 1180 } : null;

  return (
    <div className="relative h-full w-full bg-neutral-100 dark:bg-neutral-900 grid place-items-center overflow-auto">
      {loading && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 border border-border text-xs">
          <Loader2 className="w-3 h-3 animate-spin" /> Updating…
        </div>
      )}
      <div
        className={frameSize ? "rounded-[2rem] border-[10px] border-neutral-800 shadow-2xl bg-white overflow-hidden my-6" : "w-full h-full"}
        style={frameSize ? { width: frameSize.w, height: frameSize.h, maxWidth: "100%", maxHeight: "100%" } : undefined}
      >
        <iframe
          ref={iframeRef}
          src={sandboxDevUrl || undefined}
          srcDoc={sandboxDevUrl ? undefined : html}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          title="preview"
        />
      </div>
    </div>
  );
}

function createPreviewFallbackHtml(files: BuildFile[], reason: string) {
  const indexHtml = files.find((f) => f.path === "index.html")?.content;
  if (indexHtml && !/src=["']\/src\//.test(indexHtml)) return indexHtml;
  const appFile = files.find((f) => /src\/(App|pages\/Index)\.(tsx|jsx|ts|js)$/.test(f.path));
  const title = files.find((f) => f.path === "package.json")?.content.match(/"name"\s*:\s*"([^"]+)"/)?.[1] ?? "Megsy preview";
  const sample = appFile?.content?.slice(0, 1800) ?? "No application entry file was found.";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title><style>body{margin:0;font-family:Inter,system-ui;background:#fafafa;color:#111827}.wrap{min-height:100vh;display:grid;place-items:center;padding:32px}.panel{width:min(920px,100%);background:white;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.10);overflow:hidden}.hero{padding:34px;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg,#111827,#4338ca);color:white}h1{margin:0;font-size:32px;line-height:1.1}p{margin:10px 0 0;color:rgba(255,255,255,.78)}pre{margin:0;padding:24px;overflow:auto;white-space:pre-wrap;font-size:12px;line-height:1.6;background:#0b1020;color:#d1d5db}.warn{padding:14px 24px;color:#92400e;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:13px}</style></head><body><div class="wrap"><main class="panel"><section class="hero"><h1>${escapeHtml(title)}</h1><p>Project files loaded. Live bundler fallback is showing the app source instead of a blank preview.</p></section><div class="warn">${escapeHtml(reason)}</div><pre>${escapeHtml(sample)}</pre></main></div></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch] ?? ch));
}

// Hide our inline tags from the chat bubble — show only the prose around them.
function stripTags(s: string): string {
  return s
    .replace(/<change\b[^>]*>([\s\S]*?)<\/change>/g, "")
    .replace(/<change\b[^>]*\/?>/g, "")
    .replace(/<lov-write[\s\S]*?<\/lov-write>/g, "")
    .replace(/<lov-edit[\s\S]*?<\/lov-edit>/g, "")
    .replace(/<lov-delete[^>]*\/?>/g, "")
    .replace(/<lov-step>([\s\S]*?)<\/lov-step>/g, "")
    // Keep inner text of thinking/plan/step so the assistant bubble isn't empty.
    .replace(/<\/?(thinking|think|plan|step|files)>/g, "")
    .replace(/<tool[\s\S]*?<\/tool[^>]*>/g, "")
    .replace(/<sql>[\s\S]*?<\/sql>/g, "")
    .replace(/<migration>[\s\S]*?<\/migration>/g, "")
    .replace(/<file[\s\S]*?<\/file>/g, "")
    .replace(/<code>[\s\S]*?<\/code>/g, "")
    .replace(/<edge-function[\s\S]*?<\/edge-function>/g, "")
    .replace(/<done\s*\/?>/g, "")
    .replace(/<\/?(sql|migration|file|code|edge-function|done|tool|lov-[a-z-]+)\b[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatPreviewMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (value == null) return "Preview error";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function PlusMenu({
  onAttachFile,
  onOpenGithub,
  onOpenSnapshots,
  onOpenSupabase,
  onOpenDomains,
  onOpenVisual,
}: {
  onAttachFile: (file: File) => void;
  onOpenGithub: () => void;
  onOpenSnapshots: () => void;
  onOpenSupabase: () => void;
  onOpenDomains: () => void;
  onOpenVisual: () => void;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items = [
    { label: "Attach file", icon: Upload, onClick: () => { fileRef.current?.click(); setOpen(false); } },
    { label: "GitHub", icon: Github, onClick: () => { onOpenGithub(); setOpen(false); } },
    { label: "Snapshots", icon: History, onClick: () => { onOpenSnapshots(); setOpen(false); } },
    { label: "Cloud (Supabase)", icon: Database, onClick: () => { onOpenSupabase(); setOpen(false); } },
    { label: "Domains", icon: Globe, onClick: () => { onOpenDomains(); setOpen(false); } },
    { label: "Visual editor", icon: MousePointerClick, onClick: () => { onOpenVisual(); setOpen(false); } },
  ];

  return (
    <div ref={menuRef} className="relative">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAttachFile(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-composer-tool"
        title="Add"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-base leading-none">+</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-white/10 bg-[#131316] shadow-2xl p-1 z-50"
        >
          {items.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[12.5px] text-white/80 hover:bg-white/[0.06] hover:text-white rounded-lg transition-colors text-start"
            >
              <Icon className="w-3.5 h-3.5 text-white/60" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectMenu({
  projectName,
  onRename,
  onSettings,
  onExit,
}: {
  projectName: string;
  onRename: () => void;
  onSettings: () => void;
  onExit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("credits").eq("id", user.id).maybeSingle();
      setCredits(Number((data as any)?.credits ?? 0));
    })();
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-project-pill"
        title="Project menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate max-w-[160px]">{projectName}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#131316] shadow-2xl p-1 z-50"
        >
          <div className="px-3 py-2.5 border-b border-white/10 mb-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Project</div>
            <div className="text-[13px] text-white font-medium truncate">{projectName}</div>
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-white/70">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Balance:</span>
              <span className="tabular-nums text-white font-medium">
                {credits === null ? "…" : credits}
              </span>
              <span className="text-white/40">Credits</span>
            </div>
          </div>
          {[
            { label: "Rename project", icon: Pencil, onClick: () => { onRename(); setOpen(false); } },
            { label: "Project settings", icon: SettingsIcon, onClick: () => { onSettings(); setOpen(false); } },
            { label: "Exit project", icon: LogOut, onClick: () => { onExit(); setOpen(false); }, danger: true },
          ].map(({ label, icon: Icon, onClick, danger }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[12.5px] rounded-lg transition-colors text-start ${
                danger ? "text-red-400 hover:bg-red-500/10" : "text-white/80 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${danger ? "text-red-400/80" : "text-white/60"}`} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


