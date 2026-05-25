// Renders an external docs-design-studio.lovable.app template inside a clean
// in-chat card with iframe preview, "Open in new tab", and a title strip.
// Used for "standard" (non-premium) slide templates.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Maximize2, X, Layers } from "lucide-react";

interface Props {
  title: string;
  templateName: string;
  url: string;
  colors: [string, string];
}

const StandardSlidesCard = ({ title, templateName, url, colors }: Props) => {
  const [open, setOpen] = useState(false);

  const gradient = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;

  return (
    <>
      <div className="mt-3 group relative max-w-[420px] rounded-[2rem] overflow-hidden bg-zinc-950 border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all duration-700 hover:border-white/10">
        <button
          onClick={() => setOpen(true)}
          className="relative block w-full aspect-[16/9] overflow-hidden"
          style={{ background: gradient }}
        >
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
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-900 text-zinc-400 hover:text-white font-medium rounded-2xl border border-white/5 transition-all hover:bg-zinc-800 active:scale-[0.97] text-[14px] tracking-tight"
          >
            <ExternalLink className="w-4 h-4" />
            Open in web
          </a>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/95 backdrop-blur flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <header className="flex items-center justify-between px-4 py-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Layers className="w-4 h-4 text-white/60" />
                <span className="text-sm font-semibold text-white truncate">{title}</span>
                <span className="text-xs text-white/50 truncate">· {templateName}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> New tab
                </a>
                <button
                  onClick={() => setOpen(false)}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 px-3 sm:px-6 pb-6 min-h-0">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-white">
                <iframe
                  title={title}
                  src={url}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StandardSlidesCard;
