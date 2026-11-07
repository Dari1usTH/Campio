import type { ReactNode } from "react";
import { Database, Info } from "lucide-react";
import { formatNumber, getIntlLocale } from "@/i18n";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";

/* ---------- number formatting ---------- */
export const lei = (v: number, digits = 0) =>
  `${formatNumber(v, { maximumFractionDigits: digits, minimumFractionDigits: 0 })} lei`;
export const usd = (v: number) =>
  new Intl.NumberFormat(getIntlLocale(), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: v < 1 ? 3 : 2,
  }).format(v);
export const money = (v: number, currency: string) =>
  currency
    ? new Intl.NumberFormat(getIntlLocale(), {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(v)
    : formatNumber(v);
export const int = (v: number) => formatNumber(Math.round(v));
export const dec = (v: number, digits = 1) =>
  formatNumber(v, { maximumFractionDigits: digits });
export const pct = (v: number, digits = 0) =>
  `${formatNumber(v, { maximumFractionDigits: digits })}%`;
export const signedPct = (v: number) => `${v > 0 ? "+" : ""}${pct(v)}`;

/* ---------- layout primitives ---------- */
export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-soft md:p-6",
        className,
      )}
    >
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="font-display text-lg font-bold">{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "plain" | "accent";
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-3xl p-4",
        tone === "accent" ? "bg-coral-tint" : "bg-surface",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 truncate font-display text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SourceBadge({
  source,
  note,
}: {
  source: string;
  note?: string;
}) {
  const c = useKitCopy();
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
          source === "live"
            ? "bg-success-tint text-success-ink"
            : "bg-secondary",
        )}
      >
        <Database className="size-3" aria-hidden="true" />
        {c.source[source] ?? source}
      </span>
      {note && <span>{note}</span>}
    </span>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl p-4 text-sm",
        tone === "warn" ? "bg-warning-tint text-foreground" : "bg-secondary/70",
      )}
    >
      <Info
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Pending() {
  const c = useKitCopy();
  return (
    <div role="status" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="skeleton-shimmer h-24 rounded-3xl" />
        <div className="skeleton-shimmer h-24 rounded-3xl" />
        <div className="skeleton-shimmer h-24 rounded-3xl" />
      </div>
      <div className="skeleton-shimmer h-56 rounded-[1.75rem]" />
      <p className="text-center text-sm text-muted-foreground">{c.pending}</p>
    </div>
  );
}

export function TagList({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item, i) => (
        <li
          key={`${item}-${i}`}
          className="rounded-full bg-secondary px-2.5 py-1 text-xs"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function BulletList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontally scrollable table wrapper. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export const th =
  "border-b border-border px-2 py-2 text-xs font-semibold text-muted-foreground";
export const td = "border-b border-border/60 px-2 py-2.5 align-top";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Absolute URL for a backend-relative content URL (VITE_API_URL may point elsewhere). */
export function mediaUrl(path: string, download = false) {
  if (!path) return "";
  const base = (
    (import.meta.env["VITE_API_URL"] as string | undefined) ?? ""
  ).replace(/\/api\/?$/, "");
  const url = /^https?:/i.test(path) ? path : `${base}${path}`;
  return download ? `${url}${url.includes("?") ? "&" : "?"}download=1` : url;
}

/** Only http(s) links are rendered: shared snapshots are untrusted input. */
export const safeHref = (url: string) =>
  /^https?:\/\//i.test(url) ? url : undefined;
