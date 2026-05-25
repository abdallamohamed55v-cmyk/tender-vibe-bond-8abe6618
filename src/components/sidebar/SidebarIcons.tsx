// Custom Megsy nav icons — original geometric marks (not lucide)
// Each renders inline SVG, currentColor, props-controlled size & stroke.

type Props = { size?: number; className?: string; strokeWidth?: number };

export const ChatIcon = ({ size = 20, className, strokeWidth = 1.7 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
    xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {/* Minimal rounded chat bubble */}
    <path
      d="M4.5 10.5C4.5 7.46 7.13 5 10.5 5h3c3.37 0 6 2.46 6 5.5s-2.63 5.5-6 5.5h-3.2l-3.05 2.4a.4.4 0 0 1-.65-.31V15.6c-1.27-1-2.1-2.45-2.1-4.1Z"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round"
    />
  </svg>
);


export const MediaIcon = ({ size = 20, className, strokeWidth = 1.7 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
    xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {/* Ultra-clean image: frame + mountain + sun */}
    <rect x="3.5" y="5" width="17" height="14" rx="3"
      stroke="currentColor" strokeWidth={strokeWidth} />
    <path d="M5 16.5 10 12l3.5 3 2.5-2.2L19 15.5"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="15.75" cy="9.25" r="1.25" stroke="currentColor" strokeWidth={strokeWidth} />
  </svg>
);

export const CodeIcon = ({ size = 20, className, strokeWidth = 1.7 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
    xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {/* Original < / > with center dot — clean geometric */}
    <path d="M9 7.5 4.5 12 9 16.5" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 7.5 19.5 12 15 16.5" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" />
  </svg>
);

export const CornIcon = ({ size = 20, className, strokeWidth = 1.7 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
    xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {/* Constellation: central spark + orbiting nodes — autonomous agent network */}
    <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3M6.7 6.7l2.1 2.1M15.2 15.2l2.1 2.1M6.7 17.3l2.1-2.1M15.2 8.8l2.1-2.1"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth={strokeWidth} />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" />
  </svg>
);
