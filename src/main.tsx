import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./styles/slides-typography.css";
import "./styles/megsy-build-redesign.css";
import { reportError } from "@/lib/errors";

// Prevent right-click context menu
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Report any unhandled error or promise rejection to the admin (best-effort).
let __lastReport = 0;
const __reportThrottled = (err: unknown, source: string) => {
  const now = Date.now();
  if (now - __lastReport < 2000) return; // throttle bursts
  __lastReport = now;
  void reportError(err, { source });
};
window.addEventListener("error", (e) => __reportThrottled(e.error ?? e.message, "window.onerror"));
window.addEventListener("unhandledrejection", (e) => __reportThrottled(e.reason, "unhandledrejection"));

// Apply saved user bubble color
const savedBubble = localStorage.getItem("userBubbleColor");
if (savedBubble) document.documentElement.style.setProperty("--user-bubble", savedBubble);

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
