import { useMemo } from "react";
import { cn } from "@/lib/utils";

const COLORS = ["bg-coral", "bg-peach", "bg-navy", "bg-cream", "bg-sky"];

/** Lightweight CSS confetti burst. Hidden when reduced motion is preferred. */
export function Confetti({ count = 36, className }: { count?: number; className?: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 120 + Math.random() * 220;
        return {
          i,
          dx: `${Math.cos(angle) * dist}px`,
          dy: `${Math.sin(angle) * dist - 60}px`,
          rot: `${Math.random() * 720 - 360}deg`,
          delay: `${Math.random() * 120}ms`,
          color: COLORS[i % COLORS.length],
          shape: i % 3 === 0 ? "rounded-full size-2.5" : "rounded-[2px] h-3 w-1.5",
        };
      }),
    [count],
  );
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-visible motion-reduce:hidden", className)}>
      <div className="absolute left-1/2 top-1/2">
        {pieces.map((p) => (
          <span
            key={p.i}
            className={cn("absolute animate-confetti", p.color, p.shape)}
            style={
              {
                "--dx": p.dx,
                "--dy": p.dy,
                "--rot": p.rot,
                animationDelay: p.delay,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
