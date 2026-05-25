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
      <div className="mt-3 rounded-2xl overflow-hidden border border-border/40 bg-card max-w-xl">
        <button
          onClick={() => setOpen(true)}
          className="relative block w-full aspect-[16/9] overflow-hidden group"
          style={{ background: gradient }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-90 mb-1.5">
              <Layers className="inline w-3 h-3 mr-1.5 -mt-0.5" />
              Standard · {templateName}
            </div>
            <h3 className="text-xl md:text-2xl font-extrabold line-clamp-2">{title}</h3>
          </div>
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition">
            <Maximize2 className="w-3 h-3" /> Open
          </div>
        </button>

        <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-background/40">
          <div className="text-xs text-muted-foreground truncate">{templateName}</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-foreground text-background hover:opacity-90 transition"
            >
              Open
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-border/60 hover:bg-muted/40 transition"
            >
              <ExternalLink className="w-3 h-3" /> New tab
            </a>
          </div>
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
