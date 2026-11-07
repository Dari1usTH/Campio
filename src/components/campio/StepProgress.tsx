import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepProgress({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: readonly string[];
  current: number;
  onStepClick?: (i: number) => void;
  className?: string;
}) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <nav aria-label="Progres" className={cn("w-full", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-coral transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = onStepClick && i < current;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-full px-1 text-left text-xs font-medium transition-colors md:text-sm",
                  active ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground",
                  clickable && "cursor-pointer hover:text-coral-ink",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-coral text-coral-foreground",
                    !done && !active && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className="hidden truncate sm:inline">{s}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
