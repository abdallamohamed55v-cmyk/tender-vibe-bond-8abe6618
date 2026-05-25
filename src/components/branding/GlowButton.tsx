import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

type GlowVariant = "starter" | "pro" | "elite" | "business" | "enterprise" | "gold";

const VARIANT_GRADIENTS: Record<GlowVariant, string> = {
  starter:
    "conic-gradient(from var(--glow-angle), #22C55E, #4ADE80, #16A34A, #22C55E, #4ADE80, #22C55E)",
  pro: "conic-gradient(from var(--glow-angle), #3B82F6, #60A5FA, #1D4ED8, #3B82F6, #60A5FA, #3B82F6)",
  elite:
    "conic-gradient(from var(--glow-angle), #7C3AED, #FFD700, #A855F7, #FFD700, #7C3AED, #FFD700)",
  business:
    "conic-gradient(from var(--glow-angle), #D97706, #FBBF24, #F59E0B, #FBBF24, #D97706, #FBBF24)",
  enterprise:
    "conic-gradient(from var(--glow-angle), #FFD700, #C0C0C0, #FFD700, #C0C0C0, #FFD700, #C0C0C0)",
  gold: "conic-gradient(from var(--glow-angle), #FFD700, #FF8C00, #FFD700, #FF8C00, #FFD700, #FF8C00)",
};

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlowVariant;
  /** Tailwind sizing/padding overrides */
  className?: string;
  /** Inner background; default #0A0A0A */
  innerBg?: string;
}

const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  (
    {
      variant = "gold",
      className = "",
      innerBg = "#0A0A0A",
      children,
      style,
      ...rest
    },
    ref,
  ) => {
    const cssVars: CSSProperties = {
      // @ts-expect-error CSS custom props
      "--glow-gradient": VARIANT_GRADIENTS[variant],
      "--glow-inner": innerBg,
      ...style,
    };
    return (
      <button
        ref={ref}
        {...rest}
        style={cssVars}
        className={`glow-btn ${className}`}
      >
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {children}
        </span>
      </button>
    );
  },
);
GlowButton.displayName = "GlowButton";

export default GlowButton;
