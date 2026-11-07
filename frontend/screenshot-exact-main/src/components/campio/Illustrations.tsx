import { cn } from "@/lib/utils";

/** Friendly line-art illustrations drawn in navy + coral. */

export function SmileyTrio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" className={cn("h-auto w-full", className)} aria-hidden="true" fill="none">
      <g strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="66" r="36" className="fill-coral-tint stroke-foreground" />
        <path d="M36 60 q4 -5 8 0 M56 60 q4 -5 8 0" className="stroke-foreground" />
        <path d="M38 76 q12 12 24 0" className="stroke-foreground" />
        <circle cx="120" cy="52" r="42" className="fill-coral stroke-foreground" />
        <circle cx="106" cy="46" r="3" className="fill-foreground stroke-none" />
        <circle cx="134" cy="46" r="3" className="fill-foreground stroke-none" />
        <path d="M102 62 q18 20 36 0 z" className="fill-card stroke-foreground" />
        <circle cx="192" cy="70" r="32" className="fill-surface stroke-foreground" />
        <path d="M180 66 h8 M198 66 h8" className="stroke-foreground" />
        <path d="M182 82 q10 6 20 0" className="stroke-foreground" />
        <path d="M168 18 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4 l8 -4 z" className="fill-coral stroke-none" />
        <path d="M20 22 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z" className="fill-foreground stroke-none" />
      </g>
    </svg>
  );
}

export function EmptyBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={cn("h-auto w-full", className)} aria-hidden="true" fill="none">
      <g strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-foreground">
        <path d="M40 70 L100 45 L160 70 L100 95 Z" className="fill-coral-tint" />
        <path d="M40 70 V115 L100 140 V95" className="fill-surface" />
        <path d="M160 70 V115 L100 140" className="fill-card" />
        <circle cx="86" cy="112" r="2.5" className="fill-foreground stroke-none" />
        <circle cx="70" cy="106" r="2.5" className="fill-foreground stroke-none" />
        <path d="M70 120 q8 6 16 -2" />
        <path d="M100 30 q-6 -14 6 -22" className="stroke-coral" />
        <path d="M120 36 q8 -12 22 -10" className="stroke-coral" />
        <path d="M78 34 q-12 -6 -20 4" className="stroke-coral" />
      </g>
    </svg>
  );
}

export function RocketFriend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={cn("h-auto w-full", className)} aria-hidden="true" fill="none">
      <g strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-foreground">
        <path d="M80 20 C110 40 112 90 100 112 H60 C48 90 50 40 80 20 Z" className="fill-card" />
        <circle cx="80" cy="62" r="13" className="fill-coral" />
        <path d="M60 100 L42 118 L60 116 M100 100 L118 118 L100 116" className="fill-coral-tint" />
        <path d="M68 116 q12 30 24 0" className="fill-coral stroke-coral" />
        <circle cx="74" cy="86" r="2" className="fill-foreground stroke-none" />
        <circle cx="86" cy="86" r="2" className="fill-foreground stroke-none" />
        <path d="M74 94 q6 5 12 0" />
      </g>
    </svg>
  );
}

export function EmptyState({
  title,
  sub,
  action,
  art = "box",
  className,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  art?: "box" | "smiles" | "rocket";
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-sm flex-col items-center py-10 text-center", className)}>
      <div className="w-40">
        {art === "box" ? <EmptyBox /> : art === "smiles" ? <SmileyTrio /> : <RocketFriend />}
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold">{title}</h3>
      {sub && <p className="mt-2 text-muted-foreground">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
