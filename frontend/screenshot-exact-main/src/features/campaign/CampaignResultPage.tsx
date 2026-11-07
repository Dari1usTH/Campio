import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Info,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip, AiBadge, ComputedBadge } from "@/components/campio/Chip";
import { Surface, Eyebrow } from "@/components/campio/Surface";
import { ScoreGauge } from "@/components/campio/ScoreGauge";
import { CopyButton } from "@/components/campio/CopyButton";
import { EmptyState } from "@/components/campio/Illustrations";
import { PlatformIcon, platformName } from "@/components/campio/PlatformIcon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { campaignsService } from "@/services/campaigns";
import { campaignKeys, campaignQuery } from "@/services/queries";
import type { Campaign, MessageVariant } from "@/services/schemas";
import { formatDate, formatMoney, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { VisualPreview, DownloadVisualButton } from "./visual";
import { makeShareUrl } from "./share";
import { campaignCopy as c } from "./copy";

const sectionIds = [
  "audiences",
  "positioning",
  "messages",
  "warnings",
  "agent",
  "budget",
  "copy",
  "visual",
  "kpis",
];
const sectionIcons = [
  Users,
  MessageSquare,
  Trophy,
  ShieldCheck,
  WandSparkles,
  Target,
  Sparkles,
  Download,
  Lightbulb,
];

export function CampaignLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Se încarcă campania">
      <div className="skeleton-shimmer h-12 w-3/4 rounded-2xl" />
      <div className="skeleton-shimmer h-48 rounded-[2rem]" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="skeleton-shimmer h-72 rounded-[2rem]" />
        <div className="skeleton-shimmer h-72 rounded-[2rem]" />
      </div>
    </div>
  );
}

export default function CampaignResultPage() {
  const { id = "" } = useParams({ strict: false });
  const query = useQuery(campaignQuery(id));
  const t = useT();
  if (query.isPending) return <CampaignLoading />;
  if (query.isError)
    return (
      <EmptyState
        art="box"
        title={t.result.notFound}
        sub={query.error.message}
        action={<Button onClick={() => query.refetch()}>{c.retry}</Button>}
      />
    );
  return <CampaignReport campaign={query.data} />;
}

function ReportSection({
  index,
  children,
  hint,
  badge = "ai",
}: {
  index: number;
  children: ReactNode;
  hint?: string;
  badge?: "ai" | "computed";
}) {
  const t = useT();
  const [open, setOpen] = useState(true);
  const Icon = sectionIcons[index] ?? Sparkles;
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === `#${sectionIds[index]}`) setOpen(true);
    };
    const fromNavigation = (event: Event) => {
      if ((event as CustomEvent<number>).detail === index) setOpen(true);
    };
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("campio:open-section", fromNavigation);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("campio:open-section", fromNavigation);
    };
  }, [index]);
  return (
    <section
      id={sectionIds[index]}
      className="scroll-mt-36 rounded-[1.75rem] bg-card p-5 shadow-soft md:scroll-mt-24 md:p-7"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            {badge === "ai" ? <AiBadge label={t.common.aiWritten} /> : <ComputedBadge />}
          </div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Icon className="size-5 shrink-0 text-coral-ink" aria-hidden="true" />
            {t.result.sections[index]}
          </h2>
          {hint && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{hint}</p>
          )}
        </div>
        <button
          className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`content-${index}`}
          aria-label={`${open ? c.collapse : c.expand} ${t.result.sections[index]}`}
        >
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      <div id={`content-${index}`} className={cn(!open && "hidden", "md:block")}>
        {children}
      </div>
    </section>
  );
}

function MessageCard({ message }: { message: MessageVariant }) {
  const t = useT();
  return (
    <article
      className={cn(
        "min-w-0 rounded-3xl border p-5",
        message.isWinner ? "border-coral bg-coral-tint/60" : "border-border bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{message.label}</p>
        {message.isWinner && (
          <Chip variant="coral" size="sm">
            <Trophy />
            {t.result.winner}
          </Chip>
        )}
      </div>
      <div className="my-3 flex justify-center">
        <ScoreGauge value={message.score} size={130} label="/ 100" highlight={message.isWinner} />
      </div>
      <p className="mb-2 min-h-24 font-display text-lg font-semibold leading-snug">
        „{message.text}”
      </p>
      <p className="text-xs text-muted-foreground">{message.angle}</p>
      <div className="my-4 grid grid-cols-3 gap-2 border-y border-border py-3">
        {[
          [t.result.click, message.click],
          [t.result.stop, message.stop],
          [t.result.shareMetric, message.share],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold">{value}%</p>
          </div>
        ))}
      </div>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold">
          {t.result.why}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 space-y-3">
          {message.reactions.map((reaction, i) => (
            <blockquote key={reaction.id} className="rounded-2xl bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                    i % 2 ? "bg-coral-tint text-navy" : "bg-navy text-cream",
                  )}
                >
                  {reaction.persona.charAt(0)}
                </span>
                <p className="text-xs font-semibold">
                  {reaction.persona}, {reaction.age} {c.years}
                </p>
              </div>
              <p className="text-xs leading-relaxed">„{reaction.quote}”</p>
              {reaction.objection && (
                <p className="mt-2 text-xs text-warning-ink">
                  {t.result.objection}: {reaction.objection}
                </p>
              )}
            </blockquote>
          ))}
        </div>
      </details>
    </article>
  );
}

function CopyAssets({ campaign }: { campaign: Campaign }) {
  const t = useT();
  const [tab, setTab] = useState<keyof Campaign["copy"]>("instagram");
  const copy = campaign.copy;
  const activeText =
    tab === "instagram"
      ? `${copy.instagram.caption}\n\n${copy.instagram.hashtags.join(" ")}`
      : tab === "tiktok"
        ? copy.tiktok.beats.map((b) => `${b.from}–${b.to}s · ${b.visual}\n${b.voice}`).join("\n\n")
        : tab === "meta"
          ? `${copy.meta.headline}\n\n${copy.meta.primaryText}\n\n${copy.meta.cta}`
          : copy.email.subjects.join("\n");
  return (
    <>
      <div
        role="tablist"
        aria-label={c.copies}
        className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-secondary p-1 no-scrollbar"
      >
        {(Object.keys(t.result.tabs) as (keyof Campaign["copy"])[]).map((key) => (
          <button
            id={`copy-tab-${key}`}
            key={key}
            role="tab"
            aria-selected={tab === key}
            aria-controls="copy-panel"
            tabIndex={tab === key ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              const keys = Object.keys(t.result.tabs) as (keyof Campaign["copy"])[];
              const next =
                keys[
                  (keys.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1) + keys.length) %
                    keys.length
                ]!;
              setTab(next);
              document.getElementById(`copy-tab-${next}`)?.focus();
              e.preventDefault();
            }}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
              tab === key
                ? "bg-navy text-cream shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.result.tabs[key]}
          </button>
        ))}
      </div>
      <div className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{t.result.tabs[tab]}</p>
          <CopyButton
            text={activeText}
            onCopied={() => {
              localStorage.setItem("campio:copied", "true");
            }}
          />
        </div>
        <div id="copy-panel" role="tabpanel" aria-labelledby={`copy-tab-${tab}`} tabIndex={0}>
          {tab === "instagram" && (
            <>
              <p className="whitespace-pre-wrap text-sm leading-7">{copy.instagram.caption}</p>
              <p className="mt-4 text-sm leading-relaxed text-coral-ink">
                {copy.instagram.hashtags.join(" ")}
              </p>
              <p className="mt-4 text-right text-xs text-muted-foreground">
                {activeText.length} {t.result.chars}
              </p>
            </>
          )}
          {tab === "tiktok" && (
            <>
              <p className="mb-5 font-display text-xl font-semibold">„{copy.tiktok.hook}”</p>
              <ol className="space-y-4">
                {copy.tiktok.beats.map((beat) => (
                  <li key={beat.from} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-16 shrink-0 items-center justify-center rounded-full bg-coral-tint text-xs font-semibold text-coral-ink">
                      {beat.from}–{beat.to}s
                    </span>
                    <div className="min-w-0 border-l-2 border-border pl-4">
                      <p className="text-sm font-semibold">{beat.visual}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {beat.voice}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
          {tab === "meta" && (
            <div className="space-y-5">
              {[
                [t.result.headline, copy.meta.headline],
                [t.result.primaryText, copy.meta.primaryText],
                [t.result.cta, copy.meta.cta],
              ].map(([label, text]) => (
                <div key={label}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text?.length} {t.result.chars}
                  </p>
                </div>
              ))}
            </div>
          )}
          {tab === "email" && (
            <ol className="space-y-3">
              {copy.email.subjects.map((subject, i) => (
                <li key={subject} className="flex items-start gap-3 rounded-2xl bg-card p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-coral-tint text-xs font-semibold text-coral-ink">
                    {i + 1}
                  </span>
                  <p className="flex-1 pt-1 text-sm">{subject}</p>
                  <CopyButton text={subject} size="iconSm" />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

export function CampaignReport({
  campaign,
  readOnly = false,
}: {
  campaign: Campaign;
  readOnly?: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(0);
  const [shareUrl, setShareUrl] = useState("");
  const navRef = useRef<HTMLDivElement>(null);
  const mutation = useMutation({
    mutationFn: (action: {
      kind: "save" | "launch" | "warning" | "action";
      first?: string;
      second?: string;
    }) => {
      if (action.kind === "warning")
        return campaignsService.toggleWarning(campaign.id, action.first!);
      if (action.kind === "action")
        return campaignsService.toggleAction(campaign.id, action.first!, action.second!);
      return campaignsService.patch(
        campaign.id,
        action.kind === "launch" ? { status: "launched" } : {},
      );
    },
    onSuccess: (updated, action) => {
      queryClient.setQueryData(campaignKeys.detail(campaign.id), updated);
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      if (action.kind === "save") toast.success(c.saved);
      if (action.kind === "launch") toast.success(c.launched);
    },
    onError: () => toast.error(c.error),
  });
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (sectionIds.includes(target)) {
      requestAnimationFrame(() =>
        document.getElementById(target)?.scrollIntoView({ block: "start" }),
      );
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActive(sectionIds.indexOf(entry.target.id));
      },
      { rootMargin: "-100px 0px -60% 0px" },
    );
    sectionIds.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const activeLink = navRef.current?.querySelector(`[data-section="${active}"]`);
    if (activeLink && window.innerWidth < 1280) {
      const parent = navRef.current;
      if (parent)
        parent.scrollTo({
          left: (activeLink as HTMLElement).offsetLeft - parent.offsetLeft - 16,
          behavior: "smooth",
        });
    }
  }, [active]);
  const winner = campaign.messages.find((m) => m.isWinner);
  const budgetTotal = campaign.channels.reduce((sum, ch) => sum + ch.budget, 0);
  let offset = 0;
  const colors = ["var(--coral)", "var(--navy)", "var(--peach)", "var(--sky)"];
  const gradient = campaign.channels
    .map((ch, i) => {
      if (ch.budget <= 0) return "";
      const start = offset;
      offset += budgetTotal ? (ch.budget / budgetTotal) * 100 : 0;
      return `${colors[i % colors.length]} ${start}% ${offset}%`;
    })
    .filter(Boolean)
    .join(", ");
  return (
    <div className="campaign-report">
      <style>{`@media print { body * { visibility: hidden; } .campaign-report, .campaign-report * { visibility: visible; } .campaign-report { position: absolute; top: 0; left: 0; width: 100%; color: #14213D; background: #fff; } .campaign-report .print-hidden { display: none !important; } .campaign-report section { break-inside: avoid; box-shadow: none; border: 1px solid #e5e5e5; margin: 16px 0; } .campaign-report details { display: block; } .campaign-report [id^="content-"] { display: block !important; } .campaign-report .report-grid { display: block; } }`}</style>
      {!readOnly && (
        <Link
          to="/app/campaigns"
          className="print-hidden mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {c.back}
        </Link>
      )}
      <header className="mb-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip variant={campaign.status === "launched" ? "success" : "coral"} size="sm">
            <CheckCircle2 />
            {t.status[campaign.status]}
          </Chip>
          {campaign.isDemo && <Chip size="sm">{t.common.demo}</Chip>}
          {readOnly && (
            <Chip size="sm" variant="outline">
              <LockKeyhole />
              {t.share.readonly}
            </Chip>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(campaign.createdAt)}</span>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {c.report}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
          {campaign.product.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          {campaign.marketplaces.map((mp) => (
            <span key={mp}>{t.wizard.marketplaces[mp].name}</span>
          ))}
          <span aria-hidden="true">·</span>
          <span>{formatMoney(campaign.budget)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {campaign.durationDays} {c.days}
          </span>
        </div>
        {!readOnly && (
          <div className="print-hidden mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutation.mutate({ kind: "save" })}
              disabled={mutation.isPending}
            >
              <Save />
              {t.result.save}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  setShareUrl(await makeShareUrl(campaign));
                } catch {
                  toast.error(c.shareError);
                }
              }}
            >
              <Share2 />
              {t.result.share}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download />
              {t.result.export}
            </Button>
            <Button
              variant={campaign.status === "launched" ? "secondary" : "coral"}
              size="sm"
              onClick={() => mutation.mutate({ kind: "launch" })}
              disabled={mutation.isPending || campaign.status === "launched"}
            >
              <Check />
              {campaign.status === "launched" ? t.result.launchedDone : t.result.launched}
            </Button>
          </div>
        )}
      </header>
      <Surface tone="navyGradient" className="mb-7 overflow-hidden p-6 md:p-8">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-lg">
            <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-cream/70">
              <Sparkles className="size-4 text-coral" />
              {c.simulated}
            </span>
            <h2 className="font-display text-2xl font-bold leading-tight text-cream md:text-3xl">
              {c.ready}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-cream/75">{c.sub}</p>
          </div>
          <div className="rounded-3xl border border-cream/15 bg-cream/5 px-5 py-3 text-center">
            <p className="font-display text-4xl font-bold text-coral">
              {winner?.score ?? 0}
              <span className="text-base text-cream/60"> / 100</span>
            </p>
            <p className="mt-1 text-xs text-cream/75">{t.campaigns.winnerScore}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-20 size-72 rounded-full border-[36px] border-cream/5" />
      </Surface>
      <div className="report-grid grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="print-hidden sticky top-20 z-20 -mx-1 min-w-0 self-start bg-background/95 px-1 py-2 backdrop-blur-xl xl:top-24 xl:bg-transparent xl:py-1">
          <p className="mb-4 hidden text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground xl:block">
            {c.sections}
          </p>
          <div
            ref={navRef}
            className="flex gap-2 overflow-x-auto no-scrollbar xl:flex-col xl:overflow-visible"
          >
            {t.result.sections.map((title, i) => (
              <a
                key={title}
                href={`#${sectionIds[i]}`}
                data-section={i}
                onClick={() => {
                  setActive(i);
                  window.dispatchEvent(new CustomEvent("campio:open-section", { detail: i }));
                }}
                aria-current={active === i ? "location" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-medium transition-colors xl:rounded-2xl xl:px-3",
                  active === i
                    ? "bg-navy text-cream"
                    : "bg-secondary text-muted-foreground hover:bg-card xl:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "text-[10px]",
                    active === i ? "text-coral" : "text-muted-foreground",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {title}
              </a>
            ))}
          </div>
        </aside>
        <div className="min-w-0 space-y-6">
          <ReportSection index={0} hint={c.audienceHint}>
            <div className="grid gap-4 md:grid-cols-2">
              {campaign.segments.map((segment, i) => (
                <article
                  key={segment.id}
                  className={cn("rounded-3xl p-5", i === 0 ? "bg-coral-tint/70" : "bg-surface")}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-12 place-items-center rounded-2xl",
                        i === 0 ? "bg-coral text-navy" : "bg-navy text-cream",
                      )}
                    >
                      <Users className="size-6" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {segment.ageRange}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold">{segment.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {segment.description}
                  </p>
                  <div className="my-4 flex flex-wrap gap-2">
                    {segment.platforms.map((p) => (
                      <Chip key={p} size="sm" variant="outline">
                        <PlatformIcon platform={p} />
                        {platformName(p)}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs font-semibold">{t.result.motivations}</p>
                  <ul className="mt-2 space-y-2">
                    {segment.motivations.map((motivation) => (
                      <li
                        className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                        key={motivation}
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-coral-ink" />
                        {motivation}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </ReportSection>
          <ReportSection index={1} hint={c.messageHint}>
            <Eyebrow>{t.result.positioning}</Eyebrow>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{campaign.positioning}</p>
            <div className="my-5 rounded-3xl bg-navy p-6 text-cream">
              <p className="mb-3 text-xs font-medium text-cream/60">{t.result.keyMessage}</p>
              <p className="font-display text-2xl font-bold leading-tight md:text-4xl">
                „{campaign.keyMessage}”
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-muted-foreground">{t.result.tone}</span>
              {campaign.tones.map((tone) => (
                <Chip key={tone} size="sm">
                  {tone}
                </Chip>
              ))}
            </div>
          </ReportSection>
          <ReportSection index={2} hint={c.scoresHint}>
            <div className="grid gap-4 md:grid-cols-3">
              {campaign.messages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))}
            </div>
            <div className="mt-5 rounded-3xl bg-surface p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t.result.sections[2]}</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={t.result.formula}
                      className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-secondary"
                    >
                      <Info className="size-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">{t.result.formula}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="space-y-3">
                {campaign.messages.map((message) => (
                  <div key={message.id} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs">{message.label}</span>
                    <div
                      className="h-4 flex-1 overflow-hidden rounded-full bg-secondary"
                      role="meter"
                      aria-label={message.label}
                      aria-valuenow={message.score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          message.isWinner ? "bg-coral" : "bg-navy/45 dark:bg-cream/45",
                        )}
                        style={{ width: `${message.score}%` }}
                      />
                    </div>
                    <span className="w-7 text-right text-xs font-bold">{message.score}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t.result.formula}
              </p>
            </div>
          </ReportSection>
          <ReportSection index={3}>
            <div className="space-y-4">
              {campaign.warnings.map((warning) => (
                <article
                  key={warning.id}
                  className={cn(
                    "rounded-3xl border p-5",
                    warning.resolved
                      ? "border-success/20 bg-success-tint/60"
                      : "border-warning/30 bg-warning-tint/70",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      className={cn(
                        "mt-0.5 size-5 shrink-0",
                        warning.resolved ? "text-success-ink" : "text-warning-ink",
                      )}
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold">{warning.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {warning.why}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed">
                        <span className="font-semibold">{t.result.fix}: </span>
                        {warning.fix}
                      </p>
                      {readOnly ? (
                        <p className="mt-4 text-xs font-semibold">
                          {warning.resolved ? t.result.resolved : c.objections}
                        </p>
                      ) : (
                        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={warning.resolved}
                            disabled={mutation.isPending}
                            onChange={() => mutation.mutate({ kind: "warning", first: warning.id })}
                            className="size-4 accent-[#14213D]"
                          />
                          {warning.resolved ? t.result.resolved : t.result.markResolved}
                        </label>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </ReportSection>
          <ReportSection index={4} hint={c.agentHint}>
            <ol className="space-y-0">
              {campaign.agentRounds.map((round, i) => (
                <li key={round.id} className="relative flex gap-4 pb-7 last:pb-0">
                  {i < campaign.agentRounds.length - 1 && (
                    <span
                      className="absolute bottom-0 left-[19px] top-10 w-px bg-border"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid size-10 shrink-0 place-items-center rounded-full",
                      round.kind === "rewrite"
                        ? "bg-coral text-navy"
                        : round.kind === "stop"
                          ? "bg-success-tint text-success-ink"
                          : "bg-secondary",
                    )}
                  >
                    {round.kind === "rewrite" ? (
                      <WandSparkles className="size-4" />
                    ) : round.kind === "stop" ? (
                      <Check className="size-4" />
                    ) : (
                      <span className="text-sm font-bold">{i === 0 ? "1" : "2"}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl bg-surface p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{round.label}</h3>
                      {round.score !== undefined && (
                        <span className="font-display text-xl font-bold text-coral-ink">
                          {round.score}
                          {round.versusScore !== undefined && (
                            <span className="text-sm font-medium text-muted-foreground">
                              {" "}
                              {t.result.vs} {round.versusScore}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {round.message && (
                      <p className="mb-2 text-sm font-medium leading-relaxed">„{round.message}”</p>
                    )}
                    <p className="text-xs leading-relaxed text-muted-foreground">{round.note}</p>
                    {round.objectionsAddressed.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {round.objectionsAddressed.map((objection) => (
                          <Chip key={objection} variant="success" size="sm">
                            <Check />
                            {objection}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </ReportSection>
          <ReportSection index={5} hint={c.budgetHint} badge="computed">
            <div className="mb-6 flex flex-wrap items-center justify-center gap-7 rounded-3xl bg-surface p-6">
              <div
                className="relative grid size-40 shrink-0 place-items-center rounded-full"
                style={{
                  background: gradient ? `conic-gradient(${gradient})` : "var(--secondary)",
                }}
                role="img"
                aria-label={`${t.result.budgetSplit}: ${campaign.channels.map((ch) => `${ch.channel} ${formatMoney(ch.budget)}`).join(", ")}`}
              >
                <div className="grid size-28 place-content-center rounded-full bg-card text-center">
                  <span className="font-display text-2xl font-bold">{campaign.budget}</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    lei / {campaign.durationDays} {c.days}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {campaign.channels.map((channel, i) => (
                  <div key={channel.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor: channel.budget
                          ? colors[i % colors.length]
                          : "var(--border)",
                      }}
                    />
                    <span className="min-w-28">{channel.channel}</span>
                    <span className="ml-3 font-semibold">{formatMoney(channel.budget)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {campaign.channels.map((channel) => (
                <article key={channel.id} className="rounded-3xl border border-border p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {channel.platform && (
                        <PlatformIcon platform={channel.platform} className="size-5" />
                      )}
                      <h3 className="text-sm font-semibold">{channel.channel}</h3>
                    </div>
                    <span className="shrink-0 font-display text-lg font-bold">
                      {formatMoney(channel.budget)}
                    </span>
                  </div>
                  <Chip size="sm" variant={channel.type === "paid" ? "coral" : "success"}>
                    {channel.type === "paid" ? t.result.paid : t.result.organic}
                  </Chip>
                  <p className="my-3 text-xs leading-relaxed text-muted-foreground">
                    {channel.why}
                  </p>
                  <p className="mb-2 text-xs font-semibold">{t.result.firstAction}</p>
                  <div className="space-y-1">
                    {channel.firstActions.map((action) => (
                      <label
                        key={action.id}
                        className="flex min-h-11 items-start gap-2 py-2 text-xs leading-relaxed"
                      >
                        <input
                          type="checkbox"
                          checked={action.done}
                          disabled={readOnly || mutation.isPending}
                          onChange={() =>
                            mutation.mutate({
                              kind: "action",
                              first: channel.id,
                              second: action.id,
                            })
                          }
                          className="mt-0.5 size-4 shrink-0 accent-[#14213D]"
                        />
                        <span className={cn(action.done && "text-muted-foreground line-through")}>
                          {action.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </ReportSection>
          <ReportSection index={6} hint={c.copyHint}>
            <CopyAssets campaign={campaign} />
          </ReportSection>
          <ReportSection index={7}>
            <div className="grid items-start gap-5 md:grid-cols-[1.2fr_1fr]">
              <VisualPreview campaign={campaign} />
              <div className="space-y-4">
                <div className="rounded-3xl bg-surface p-5">
                  <p className="mb-3 text-sm font-semibold">{t.assets.square}</p>
                  <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                    {c.downloadHint}
                  </p>
                  <DownloadVisualButton campaign={campaign} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="grid aspect-square place-content-center gap-2 rounded-2xl border border-dashed border-border bg-surface text-center"
                    >
                      <LockKeyhole className="mx-auto size-5 text-muted-foreground" />
                      <p className="text-xs font-medium">
                        {i === 4 ? t.result.video : `${t.result.poster} ${i}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{t.assets.locked}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ReportSection>
          <ReportSection index={8} badge="computed">
            <p className="mb-4 text-sm text-muted-foreground">{t.result.kpiTitle}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {campaign.kpis.map((kpi, i) => (
                <div
                  key={kpi.id}
                  className={cn("rounded-3xl p-5", i === 0 ? "bg-coral-tint" : "bg-surface")}
                >
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <p className="my-3 font-display text-4xl font-bold">
                    {kpi.target}
                    <span className="ml-1 text-lg font-semibold">{kpi.unit}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-coral-ink" />
                {t.result.cost}
              </span>
              <ComputedBadge />
            </div>
          </ReportSection>
          <div className="flex gap-3 rounded-3xl border border-border bg-surface p-5">
            <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">{t.result.disclaimerTitle}</h2>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{t.result.disclaimer}</p>
            </div>
          </div>
          {!readOnly && (
            <div className="print-hidden flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] bg-coral p-6 text-navy">
              <div>
                <h2 className="font-display text-xl font-bold">{t.results.title}</h2>
                <p className="mt-1 text-sm">{t.dashboard.resultsPromptSub}</p>
              </div>
              <Link
                to="/app/campaigns/$id/results"
                params={{ id: campaign.id }}
                className={buttonVariants({ variant: "default" })}
              >
                {t.result.addResults}
                <ArrowRight />
              </Link>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={Boolean(shareUrl)}
        onOpenChange={(open) => {
          if (!open) setShareUrl("");
        }}
      >
        <DialogContent className="max-w-lg rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{c.shareTitle}</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">{c.shareNote}</DialogDescription>
          </DialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">{c.sharePrivate}</p>
          <div className="rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">
            {typeof window !== "undefined" ? window.location.origin : ""}/share/{campaign.id}#…
          </div>
          <CopyButton text={shareUrl} label={c.shareCopy} variant="default" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
