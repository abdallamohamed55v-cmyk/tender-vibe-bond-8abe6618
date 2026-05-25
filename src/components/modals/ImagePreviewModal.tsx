import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

interface ImagePreviewModalProps {
  url: string | null;
  alt?: string;
  onClose: () => void;
}

const ImagePreviewModal = ({ url, alt, onClose }: ImagePreviewModalProps) => {
  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(alt || "image").slice(0, 30).replace(/\s+/g, "_")}.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={url}
              alt={alt || "Preview"}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain pointer-events-auto"
            />
            <div className="mt-3 flex items-center gap-3">
              {alt && <p className="text-white/70 text-sm max-w-md truncate">{alt}</p>}
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
            <button
              onClick={onClose}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImagePreviewModal;
