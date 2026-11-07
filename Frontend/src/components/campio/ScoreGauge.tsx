import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";

interface ScoreGaugeProps {
  value: number;
  max?: number;
  size?: number;
  segments?: number;
  label?: string;
  highlight?: boolean;
  className?: string;
}

/** Segmented 240° arc gauge. */
export function ScoreGauge({
  value,
  max = 100,
  size = 140,
  segments = 24,
  label,
  highlight = false,
  className,
}: ScoreGaugeProps) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const r = 42;
  const cx = 50;
  const cy = 52;
  const start = 150;
  const sweep = 240;
  const gap = 2.6;
  const segAngle = sweep / segments;
  const active = Math.round((shown / max) * segments);

  const polar = (deg: number, rad: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      style={{ width: size }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? "Scor"}
    >
      <svg viewBox="0 0 100 92" width={size} height={size * 0.92} aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => {
          const a0 = start + i * segAngle + gap / 2;
          const a1 = start + (i + 1) * segAngle - gap / 2;
          const [x0, y0] = polar(a0, r);
          const [x1, y1] = polar(a1, r);
          const on = i < active;
          return (
            <path
              key={i}
              d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`}
              strokeWidth={9}
              strokeLinecap="round"
              fill="none"
              className={cn(
                "transition-[stroke] duration-500",
                on ? (highlight ? "stroke-coral" : "stroke-foreground") : "stroke-muted",
              )}
              style={{ transitionDelay: `${i * 25}ms` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-[34%] flex flex-col items-center">
        <span className="font-display text-[2.1em] font-bold leading-none" style={{ fontSize: size * 0.24 }}>
          <CountUp value={value} />
        </span>
        {label && <span className="mt-1 text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/** Small health ring used on campaign cards. */
export function HealthRing({ value, size = 48 }: { value: number; size?: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const tone = value >= 80 ? "stroke-success" : value >= 60 ? "stroke-coral" : "stroke-warning";
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Sănătate campanie">
      <svg viewBox="0 0 44 44" width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className={cn(tone, "transition-[stroke-dashoffset] duration-1000")}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold">{value}</span>
    </div>
  );
}
