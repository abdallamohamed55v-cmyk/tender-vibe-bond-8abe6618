import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Share2, Loader2, Sparkles, Eye, ArrowRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { detectResearchReportDirection, normalizeResearchReport } from "@/lib/normalizeResearchReport";
import { supabase } from "@/integrations/supabase/client";

interface DeepResearchCardProps {
  query: string;
  report: string;
  images?: string[];
  sessionKey?: string;
}

const DeepResearchCard = ({ query, report, images = [], sessionKey }: DeepResearchCardProps) => {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const cleanReport = normalizeResearchReport(report);
  const isRtl = detectResearchReportDirection(cleanReport) === "rtl";
  const cover = images[0];
  const wordCount = cleanReport.split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.round(wordCount / 220));
  const sourceCount = images.length;
  const previewLine =
    cleanReport
      .replace(/^#+\s*/gm, "")
      .replace(/[*_`#>~-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) + (cleanReport.length > 160 ? "…" : "");

  const reportData = { query, report: cleanReport, images };

  const openPreview = () => {
    if (sessionKey) {
      navigate(`/research/preview/${sessionKey}`, { state: { reportData } });
    } else {
      navigate("/research/preview/new", { state: { reportData } });
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Delegate to the preview page which uses html2canvas — supports Arabic
    // and all non-Latin scripts cleanly (jsPDF.text() with helvetica garbles them).
    const target = sessionKey
      ? `/research/preview/${sessionKey}`
      : "/research/preview/new";
    navigate(target, { state: { reportData, autoDownload: true } });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sharing) return;
    setSharing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      let url = `${window.location.origin}${sessionKey ? `/research/preview/${sessionKey}` : "/research/preview/new"}`;
      if (uid) {
        // Generate a public share token so anyone with the link can open it.
        const token =
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2)) + Date.now().toString(36);
        const key = sessionKey || `r_${Date.now().toString(36)}`;
        const { error } = await supabase.from("research_reports").upsert(
          {
            user_id: uid,
            session_key: key,
            query,
            report: cleanReport,
            images: images as any,
            steps: [] as any,
            share_token: token,
          },
          { onConflict: "user_id,session_key" }
        );
        if (!error) {
          url = `${window.location.origin}/research/share/${token}`;
        }
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: query, text: query, url });
          return;
        } catch { /* fall through to clipboard */ }
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (err) {
      console.error("[research-card share]", err);
      toast.error("Share failed");
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={openPreview}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPreview(); } }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      dir="ltr"
      className="group relative w-full max-w-[360px] text-left rounded-[32px] bg-card border border-border/40 overflow-hidden hover:border-border/70 shadow-2xl transition-colors cursor-pointer"
    >
      {/* Cover */}
      <div className="relative h-44 w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-500/30 via-blue-500/25 to-emerald-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
      </div>

      {/* Body — overlaps cover by -mt-10 */}
      <div className="px-6 pb-6 pt-0 -mt-10 relative z-10">
        <div className="min-w-0" dir={isRtl ? "rtl" : "ltr"}>
          <h3 className="text-[22px] font-bold text-foreground leading-tight line-clamp-2 mb-2">
            {query}
          </h3>
          {/* Preview text hidden — only revealed after opening the preview */}

        </div>

        {/* Meta strip */}
        <div className="mt-5 mb-5 flex items-center gap-4 border-y border-border/40 py-3" dir="ltr">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Sources</span>
            <span className="text-xs text-foreground font-medium">
              {sourceCount > 0 ? `${sourceCount} Citations` : "—"}
            </span>
          </div>
          <div className="w-px h-6 bg-border/60" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Length</span>
            <span className="text-xs text-foreground font-medium">{readMinutes} Min Read</span>
          </div>
          <div className="w-px h-6 bg-border/60" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Words</span>
            <span className="text-xs text-foreground font-medium">{wordCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2" dir="ltr">
          <button
            onClick={(e) => { e.stopPropagation(); openPreview(); }}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            <span>Open Preview</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            aria-label="Share"
            className="w-12 h-12 inline-flex items-center justify-center rounded-full bg-secondary/60 text-foreground hover:bg-secondary transition-colors disabled:opacity-60 border border-border/40"
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DeepResearchCard;
