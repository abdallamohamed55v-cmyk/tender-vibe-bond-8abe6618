// Megsy Operator computer icon — minimal solid desktop with cursor + spark
import { type SVGProps } from "react";

export const MegsyComputerIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...p}>
    {/* monitor body */}
    <rect x="2.2" y="3.5" width="19.6" height="13" rx="2.2" opacity="0.18" />
    <rect x="2.2" y="3.5" width="19.6" height="13" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    {/* stand */}
    <path d="M9 19h6l-.6-2.5H9.6L9 19z" />
    <rect x="7" y="19.2" width="10" height="1.6" rx="0.8" />
    {/* cursor inside the screen */}
    <path d="M9.6 7.4l5.6 2.4-2.4 0.9-0.9 2.4-2.3-5.7z" />
    {/* spark / AI dot */}
    <circle cx="17" cy="6.4" r="1.1" />
  </svg>
);

export default MegsyComputerIcon;
