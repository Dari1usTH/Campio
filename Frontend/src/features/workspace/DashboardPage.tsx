import { tr } from "@/i18n";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lightbulb,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { campaignsQuery } from "@/services/queries";
import { campaignsService } from "@/services/campaigns";
import { onboardingService } from "@/services/settings";
import { useSession } from "@/hooks/use-session";
import { useT, fmt, formatMoney } from "@/i18n";
import { Surface, Eyebrow } from "@/components/campio/Surface";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/app/CampaignCard";
import { PageError, PageLoading } from "@/components/app/PageState";
import { RocketFriend } from "@/components/campio/Illustrations";
import { CountUp } from "@/components/campio/CountUp";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const t = useT();
  const session = useSession();
  const qc = useQueryClient();
  const query = useQuery(campaignsQuery());
  const [tip, setTip] = useState(0);
  const onboarding = useQuery({queryKey:["onboarding"],queryFn:()=>onboardingService.get()});
  const visited = onboarding.data?.completed ?? [];
  const toggle = useMutation({
    mutationFn: ({ id, ch, act }: { id: string; ch: string; act: string }) =>
      campaignsService.toggleAction(id, ch, act),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      void qc.invalidateQueries({queryKey:["onboarding"]});
      toast.success(t.workspace.done);
    },
    onError: (e) => toast.error(e.message),
  });
  if (query.isPending || onboarding.isPending) return <PageLoading />;
  if (query.isError || onboarding.isError) return <PageError retry={() => {void query.refetch(); void onboarding.refetch();}} />;
  const list = query.data;
  const actionCampaign = list.find((c) =>
    c.channels.some((ch) => ch.firstActions.some((a) => !a.done)),
  );
  const channel = actionCampaign?.channels.find((ch) => ch.firstActions.some((a) => !a.done));
  const action = channel?.firstActions.find((a) => !a.done);
  const launched = list.find((c) => c.status === "launched" && !c.results);
  const completed = list.reduce(
    (sum, c) =>
      sum + c.channels.reduce((s, ch) => s + ch.firstActions.filter((a) => a.done).length, 0),
    0,
  );
  const created = list.filter(c=>!c.isDemo).length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const used = list.filter((c) => !c.isDemo && c.createdAt.startsWith(currentMonth)).length;
  const activity = onboarding.data?.activity ?? [];
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const activityDays = new Set(
    activity
      .filter((date) => new Date(date) >= weekStart)
      .map((date) => (new Date(date).getDay() + 6) % 7),
  );
  const onboardingDone = [
    visited.includes("demo"),
    created > 0,
    visited.includes("copy"),
    completed > 0,
    list.some((c) => c.status === "launched"),
    list.some((c) => c.results?.length),
    visited.includes("rerun"),
  ];
  const onboardingCount = onboardingDone.filter(Boolean).length;
  const currentTip = t.dashboard.tipList[tip]!;
  const example = list.find(c=>c.isDemo) ?? list[0];
  const exampleLink = example ? `/app/campaigns/${example.id}` : "/app/new";
  const resultsExample = list.find(c=>c.results?.length) ?? example;
  const onboardLinks = [exampleLink,"/app/new",`${exampleLink}#copy`,`${exampleLink}#budget`,exampleLink,resultsExample?`/app/campaigns/${resultsExample.id}/results`:"/app/new",example?`/app/new?reuse=${example.id}`:"/app/new"];
  return (
    <div className="animate-rise">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">{t.workspace.today}</p>
          <h1 className="font-display text-4xl font-semibold tracking-[-.045em] md:text-5xl">
            {fmt(t.dashboard.hello, { name: session?.user.name ?? "" })}
            <span
              aria-hidden="true"
              className="ml-2 inline-block origin-bottom-right rotate-12 text-[.7em]"
            >
              ✳
            </span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t.dashboard.sub}</p>
        </div>
        <span className="hidden rounded-full border border-border px-4 py-2.5 text-xs text-muted-foreground sm:block">
          {new Intl.DateTimeFormat("ro-RO", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Europe/Bucharest",
          }).format(new Date())}
        </span>
      </header>
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Surface tone="navy" className="relative overflow-hidden p-7 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 size-80 rounded-full border-[1px] border-cream/10"
          />
          <div
            aria-hidden="true"
            className="absolute -right-3 -top-12 size-60 rounded-full border-[1px] border-cream/10"
          />
          <div className="relative z-10 max-w-[75%] sm:max-w-[70%]">
            <span className="inline-flex items-center gap-2 rounded-full bg-cream/10 px-3 py-1.5 text-[9px] font-medium tracking-wide">
              <Sparkles className="size-3 text-coral" />
              {t.workspace.heroLabel}
            </span>
            <h2 className="mt-6 font-display text-[clamp(1.8rem,3vw,2.75rem)] font-semibold leading-[1.05] tracking-tight">
              {t.workspace.launchpad}
              <br />
              <span className="text-coral">{t.workspace.launchpadAccent}</span>
            </h2>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-cream/65 sm:text-sm">
              {t.workspace.heroDescription}
            </p>
            <Button asChild variant="coral" className="mt-6 shadow-none">
              <Link to="/app/new">
                <Plus />
                {t.workspace.newCampaign}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="absolute -right-2 bottom-10 w-[35%] rotate-[18deg] sm:right-0 sm:w-[30%]">
            <RocketFriend />
          </div>
          <span aria-hidden="true" className="absolute right-12 top-12 text-4xl text-coral">
            ✳
          </span>
        </Surface>
        <Surface tone="coralSoft" className="flex flex-col border border-coral/10 p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <Eyebrow className="text-coral-ink">{t.dashboard.weekAction}</Eyebrow>
            <span className="grid size-9 place-items-center rounded-full bg-card/70">
              <Target className="size-4" />
            </span>
          </div>
          <p className="mt-4 font-display text-2xl font-semibold leading-tight">
            {action?.text ?? t.workspace.allDone}
          </p>
          {actionCampaign && (
            <p className="mt-3 text-xs text-muted-foreground">
              {channel?.channel} · {actionCampaign.product.name}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
            <span className="text-[10px] text-muted-foreground">{t.workspace.weeklyAction}</span>
            {action && channel && actionCampaign ? (
              <Button
                disabled={toggle.isPending}
                onClick={() =>
                  toggle.mutate({ id: actionCampaign.id, ch: channel.id, act: action.id })
                }
                size="sm"
              >
                <Check />
                {t.dashboard.markDone}
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/app/campaigns">
                  {t.nav.campaigns}
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </Surface>
      </div>
      <div className="my-6 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          {
            label: t.workspace.active,
            value: list.filter((c) => c.status === "ready" || c.status === "launched").length,
            icon: TrendingUp,
          },
          { label: t.workspace.completed, value: completed, icon: CheckCheck },
          {
            label: t.workspace.investment,
            value: list.reduce((s, c) => s + c.budget, 0),
            icon: Target,
          },
        ].map((stat, i) => (
          <Surface key={stat.label} className="border border-border/40 !p-4 sm:!p-5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                {stat.label}
              </span>
              <stat.icon className="hidden size-4 text-coral-ink sm:block" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              <CountUp value={stat.value} />
              {i === 2 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">{tr("common.lei")}</span>
              )}
            </p>
          </Surface>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">{t.dashboard.yourCampaigns}</h2>
              <Link
                to="/app/campaigns"
                className="inline-flex min-h-11 items-center gap-2 text-xs font-medium"
              >
                {t.common.seeAll}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {list.slice(0, 2).map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          </section>
          {launched && (
            <Surface
              tone="cream"
              className="flex flex-wrap items-center justify-between gap-5 border border-border p-6"
            >
              <div className="max-w-sm">
                <Eyebrow className="text-coral-ink">{t.workspace.resultsLabel}</Eyebrow>
                <h3 className="mt-2 text-xl font-semibold">
                  {fmt(t.dashboard.resultsPrompt, { name: launched.product.name })}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {t.dashboard.resultsPromptSub}
                </p>
              </div>
              <Button asChild variant="outline" className="bg-card">
                <Link to="/app/campaigns/$id/results" params={{ id: launched.id }}>
                  {t.dashboard.resultsPromptCta}
                  <ArrowUpRight />
                </Link>
              </Button>
            </Surface>
          )}
          <Surface className="border border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-4 text-coral-ink" />
                <h2 className="text-sm font-semibold">{t.workspace.tipsTitle}</h2>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={t.workspace.previousTip}
                  onClick={() =>
                    setTip((i) => (i - 1 + t.dashboard.tipList.length) % t.dashboard.tipList.length)
                  }
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={t.workspace.nextTip}
                  onClick={() => setTip((i) => (i + 1) % t.dashboard.tipList.length)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
            <div aria-live="polite" className="min-h-24">
              <h3 className="mt-3 text-xl font-semibold">{currentTip.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{currentTip.d}</p>
            </div>
            <div className="mt-5 flex gap-1.5" aria-hidden="true">
              {t.dashboard.tipList.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    tip === i ? "w-6 bg-coral" : "w-2 bg-border",
                  )}
                />
              ))}
            </div>
          </Surface>
        </div>
        <div className="min-w-0 space-y-5">
          <Surface className="border border-border/40">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t.workspace.getStarted}</h2>
              <span className="text-xs font-medium text-coral-ink">{onboardingCount}/7</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.workspace.onboardSub}</p>
            <div
              role="progressbar"
              aria-label={t.dashboard.onboarding}
              aria-valuenow={onboardingCount}
              aria-valuemin={0}
              aria-valuemax={7}
              className="my-5 h-1.5 overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full rounded-full bg-coral transition-all"
                style={{ width: `${(onboardingCount / 7) * 100}%` }}
              />
            </div>
            <ul className="space-y-1">
              {t.dashboard.onboardingItems.map((item, i) => (
                <li key={item}>
                  <a
                    href={onboardLinks[i]}
                    onClick={() => {
                      if (i === 0 || i === 6) {
                        void onboardingService.mark(i===0?"demo":"rerun").then(()=>qc.invalidateQueries({queryKey:["onboarding"]})).catch(e=>toast.error(e.message));
                      }
                    }}
                    className="group flex min-h-11 items-center gap-3 text-xs"
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border",
                        onboardingDone[i]
                          ? "border-navy bg-navy text-cream"
                          : "border-border group-hover:border-coral",
                      )}
                    >
                      {onboardingDone[i] ? (
                        <Check className="size-3" />
                      ) : (
                        <span className="text-[9px]">{i + 1}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        onboardingDone[i] && "text-muted-foreground line-through decoration-border",
                      )}
                    >
                      {item}
                    </span>
                    {!onboardingDone[i] && (
                      <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </Surface>
          <Surface tone="cream" className="border border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.workspace.week}</h2>
              <Flame className="size-4 text-coral-ink" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {completed ? t.workspace.activity : t.workspace.noActivity}
            </p>
            <div className="mt-5 flex justify-between gap-1">
              {t.workspace.weeklyDays.map((day, i) => {
                const active = activityDays.has(i);
                return (
                  <div key={i} className="flex flex-col items-center gap-2 text-[10px]">
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full sm:size-8",
                        active ? "bg-coral text-navy" : "border border-border bg-card",
                      )}
                    >
                      {active ? (
                        <Check className="size-3.5" />
                      ) : (
                        <span className="size-1 rounded-full bg-border" />
                      )}
                    </span>
                    <span className="text-muted-foreground">{day}</span>
                  </div>
                );
              })}
            </div>
          </Surface>
          <Surface tone="navy">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.dashboard.usage}</h2>
              <Sparkles className="size-4 text-coral" />
            </div>
            <p className="mt-4 font-display text-3xl font-semibold">
              {used}
              <span className="text-base font-normal text-cream/50"> / 10</span>
            </p>
            <div className="my-3 h-1.5 overflow-hidden rounded-full bg-cream/15">
              <div
                className="h-full rounded-full bg-coral"
                style={{ width: `${Math.min(100, used * 10)}%` }}
              />
            </div>
            <p className="text-[10px] text-cream/60">{t.workspace.demoCredits}</p>
          </Surface>
        </div>
      </div>
    </div>
  );
}
