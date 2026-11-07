import { tr } from "@/i18n";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        select:
          "cursor-pointer border-border bg-card text-foreground hover:border-foreground/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground active:scale-95",
        static: "border-transparent bg-secondary text-secondary-foreground",
        coral: "border-transparent bg-coral-tint text-coral-ink",
        navy: "border-transparent bg-navy text-navy-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-transparent bg-success-tint text-success-ink",
        warning: "border-transparent bg-warning-tint text-warning-ink",
        onDark: "border-navy-foreground/20 bg-navy-foreground/10 text-navy-foreground",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-9 px-3.5 text-sm",
        lg: "min-h-11 px-5 text-sm md:text-base",
      },
    },
    defaultVariants: { variant: "static", size: "md" },
  },
);

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipVariants>;

export function Chip({ className, variant, size, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ variant, size }), className)} {...props} />;
}

interface SelectChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  selected: boolean;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
  showCheck?: boolean;
}

export function SelectChip({
  selected,
  onToggle,
  size = "lg",
  showCheck = true,
  className,
  children,
  ...props
}: SelectChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(chipVariants({ variant: "select", size }), "min-h-11", className)}
      {...props}
    >
      {showCheck && selected && <Check aria-hidden="true" />}
      {children}
    </button>
  );
}

export function AiBadge({ className, label = tr("extra.ai") }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-coral-tint px-2 py-0.5 text-[11px] font-semibold text-coral-ink",
        className,
      )}
    >
      <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
        <path d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}

export function ComputedBadge({
  className,
  label = tr("common.computed"),
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
        <path
          d="M1 3h10M1 6h10M1 9h6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {label}
    </span>
  );
}
