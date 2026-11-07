import { cn } from "@/lib/utils";

type Variant = "full" | "mark" | "mono" | "wordmark";

interface LogoProps {
  variant?: Variant;
  className?: string;
  /** Visual height in px of the mark; wordmark scales with it. */
  size?: number;
  title?: string;
}

/** Symbol: coral rounded square with a cream "C" whose end forms a speech-bubble tail. */
export function LogoMark({
  size = 32,
  mono = false,
  className,
}: {
  size?: number;
  mono?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        width="64"
        height="64"
        rx="18"
        className={mono ? "fill-current" : "fill-coral"}
      />
      <path
        d="M41.5 22.4 A13 13 0 1 0 41.5 39.6 L47 46"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={mono ? "stroke-background" : "stroke-cream-soft"}
      />
    </svg>
  );
}

/** The "o" of the wordmark: coral ring with a tiny spark. */
function RingO({ mono }: { mono: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="inline-block h-[0.62em] w-[0.62em] translate-y-[0.02em] overflow-visible"
    >
      <circle
        cx="19"
        cy="22"
        r="13.5"
        fill="none"
        strokeWidth="7"
        className={mono ? "stroke-current" : "stroke-coral"}
      />
      <path
        d="M35 2 L36.6 6.4 L41 8 L36.6 9.6 L35 14 L33.4 9.6 L29 8 L33.4 6.4 Z"
        className={mono ? "fill-current" : "fill-coral"}
      />
    </svg>
  );
}

export function Logo({ variant = "full", className, size = 32, title = "Campio" }: LogoProps) {
  const mono = variant === "mono";
  if (variant === "mark") {
    return (
      <span role="img" aria-label={title} className={cn("inline-flex", className)}>
        <LogoMark size={size} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={title}
      className={cn("inline-flex items-center gap-2 text-foreground", className)}
    >
      {variant !== "wordmark" && <LogoMark size={size} mono={mono} />}
      <span
        aria-hidden="true"
        className="font-display font-bold leading-none tracking-[-0.06em]"
        style={{ fontSize: size * 0.82 }}
      >
        campi
        <RingO mono={mono} />
      </span>
    </span>
  );
}
