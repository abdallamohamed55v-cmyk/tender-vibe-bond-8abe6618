import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("scheduler") || id.match(/[\\/]react[\\/]/)) return "react-vendor";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) return "motion";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("unicornstudio")) return "unicorn";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("zod")) return "zod";
          if (id.includes("react-hook-form")) return "forms";
          if (id.includes("sonner") || id.includes("cmdk") || id.includes("vaul")) return "ui-extras";
        },
      },
    },
  },
}));
