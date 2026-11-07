import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const surfaceVariants = cva("relative rounded-[1.75rem] md:rounded-[2rem]", {
  variants: {
    tone: {
      card: "bg-card text-card-foreground shadow-soft",
      cream: "bg-surface text-foreground",
      coral: "bg-coral text-coral-foreground",
      coralSoft: "bg-coral-tint text-foreground",
      coralGradient: "bg-gradient-coral text-coral-foreground",
      navy: "bg-navy text-navy-foreground",
      navyGradient: "bg-gradient-navy text-navy-foreground",
      outline: "border border-border bg-transparent",
      warning: "bg-warning-tint text-foreground",
    },
    pad: {
      none: "",
      sm: "p-4",
      md: "p-5 md:p-6",
      lg: "p-6 md:p-8",
    },
    lift: { true: "card-lift", false: "" },
  },
  defaultVariants: { tone: "card", pad: "md", lift: false },
});

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof surfaceVariants> {
  as?: "div" | "section" | "article" | "aside" | "li";
}

export const Surface = React.forwardRef<HTMLElement, SurfaceProps>(
  ({ className, tone, pad, lift, as: Comp = "div", ...props }, ref) => (
    <Comp
      ref={(node: HTMLElement | null) => {
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(surfaceVariants({ tone, pad, lift }), className)}
      {...props}
    />
  ),
);
Surface.displayName = "Surface";

export function Eyebrow({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
      {...p}
    />
  );
}

export function PageHeader({
  title,
  sub,
  actions,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8", className)}
    >
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold md:text-5xl">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
