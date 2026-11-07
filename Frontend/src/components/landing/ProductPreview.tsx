import { useT } from "@/i18n";
import { Clapperboard, Quote, Wallet } from "lucide-react";

/** Static illustration of a kit, using the documented demo case (aluminium laptop stand). */
const HISTOGRAM = [12, 16, 11, 9, 6, 4, 2];
const TREND = [40, 44, 38, 52, 47, 41, 39, 45, 54, 63];
const CHANNELS = [
  { name: "Meta", pct: 41, color: "bg-coral" },
  { name: "eMAG Ads", pct: 34, color: "bg-peach" },
  { name: "TikTok", pct: 25, color: "bg-navy-foreground/40" },
];

export function ProductPreview() {
  const t = useT();
  const k = t.landingKit;
  const max = Math.max(...HISTOGRAM);
  const points = TREND.map(
    (v, i) => `${(i / (TREND.length - 1)) * 100},${40 - (v / 70) * 40}`,
  ).join(" ");
  return (
    <div
      className="relative mx-auto mt-14 w-full max-w-5xl md:mt-20"
      aria-hidden="true"
    >
      <div className="relative mx-auto w-[92%] animate-rise rounded-[1.75rem] bg-navy p-2.5 shadow-float md:w-[78%] md:p-3">
        <div className="overflow-hidden rounded-[1.25rem] bg-background">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-coral" />
            <span className="size-2.5 rounded-full bg-peach" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="ml-3 truncate text-[11px] text-muted-foreground">
              {k.example}
            </span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-3 md:gap-4 md:p-5">
            <div className="rounded-3xl bg-card p-4 shadow-soft sm:col-span-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {k.median}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {k.yourPrice}: <b className="text-foreground">79 lei</b>{" "}
                  (+11%)
                </p>
              </div>
              <p className="font-display text-3xl font-bold">71 lei</p>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {HISTOGRAM.map((v, i) => (
                  <span
                    key={i}
                    className={`flex-1 rounded-t-md ${i === 2 ? "bg-coral" : "bg-navy dark:bg-cream/70"}`}
                    style={{ height: `${(v / max) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="hidden flex-col justify-between gap-3 rounded-3xl bg-gradient-navy p-4 text-navy-foreground sm:flex">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-foreground/70">
                {k.channels}
              </p>
              <p className="font-display text-3xl font-bold">2.000 lei</p>
              <div className="flex h-2 overflow-hidden rounded-full">
                {CHANNELS.map((c) => (
                  <span
                    key={c.name}
                    className={c.color}
                    style={{ width: `${c.pct}%` }}
                  />
                ))}
              </div>
              <p className="text-[10px] text-navy-foreground/70">
                ≈ 22 {k.orders} · 1.486 {k.clicks}
              </p>
            </div>
            <div className="rounded-3xl bg-card p-4 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {k.trend}
              </p>
              <svg
                viewBox="0 0 100 40"
                className="mt-2 h-14 w-full"
                preserveAspectRatio="none"
              >
                <polyline
                  points={points}
                  fill="none"
                  stroke="var(--coral)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div className="rounded-3xl bg-coral-tint p-4 sm:col-span-2">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {k.complaint}
              </p>
              <p className="mt-1 flex gap-2 text-sm italic">
                <Quote className="mt-0.5 size-3.5 shrink-0" />
                {k.complaintText}
              </p>
              <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
                {k.message}
              </p>
              <p className="font-display text-lg font-bold">{k.messageText}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 right-0 w-[34%] max-w-[200px] animate-float rounded-[2.2rem] bg-navy p-2 shadow-float [--r:4deg] sm:right-[2%] md:-bottom-14">
        <div className="overflow-hidden rounded-[1.8rem] bg-background">
          <div className="mx-auto mt-2 h-4 w-16 rounded-full bg-navy" />
          <div className="p-2.5">
            <div className="grid aspect-[9/14] place-items-center rounded-2xl bg-gradient-navy text-navy-foreground">
              <div className="grid justify-items-center gap-2 px-2 text-center">
                <Clapperboard className="size-7 text-coral" />
                <p className="font-display text-sm font-bold leading-tight">
                  {k.messageText}
                </p>
                <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-coral-foreground">
                  79 lei
                </span>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              {k.reel}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute -left-2 bottom-2 hidden max-w-[240px] animate-float rounded-2xl bg-card p-3 shadow-lift [--r:2deg] md:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {k.persona}
        </p>
        <p className="text-xs font-semibold">{k.personaName}</p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          “{k.personaHook}”
        </p>
      </div>
      <div className="absolute -top-6 right-[8%] hidden animate-float-slow items-center gap-2 rounded-full bg-coral px-4 py-2 font-semibold text-coral-foreground shadow-coral [--r:3deg] sm:flex">
        <Wallet className="size-4" /> {k.cost}
      </div>
    </div>
  );
}
