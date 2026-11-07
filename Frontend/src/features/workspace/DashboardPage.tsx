import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Layers,
  Loader2,
  MessageCircleQuestion,
  Plus,
  Sparkles,
} from "lucide-react";
import { campaignsQuery } from "@/services/queries";
import { isKitActive } from "@/services/kit";
import { useSession } from "@/hooks/use-session";
import { useT, fmt, formatRelative } from "@/i18n";
import { Surface } from "@/components/campio/Surface";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/app/CampaignCard";
import { PageError, PageLoading } from "@/components/app/PageState";
import { RocketFriend } from "@/components/campio/Illustrations";
import { useKitCopy } from "@/features/campaign/kit/copy";

export default function DashboardPage() {
  const t = useT();
  const c = useKitCopy();
  const session = useSession();
  const query = useQuery({
    ...campaignsQuery(),
    refetchInterval: (q) =>
      q.state.data?.some((x) => isKitActive(x.status)) ? 4000 : false,
  });
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError retry={() => query.refetch()} />;
  const list = query.data;
  const waiting = list.filter(
    (x) => x.status === "needs_input" || isKitActive(x.status),
  );
  const stats = [
    { label: t.nav.campaigns, value: list.length, icon: Layers },
    {
      label: c.status.needs_input,
      value: list.filter((x) => x.status === "needs_input").length,
      icon: MessageCircleQuestion,
    },
    {
      label: c.status.completed,
      value: list.filter((x) => x.status === "completed").length,
      icon: CheckCheck,
    },
  ];
  return (
    <div className="animate-rise">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-[-.045em] md:text-5xl">
          {fmt(t.dashboard.hello, { name: session?.user.name ?? "" })}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {c.newCampaign.sub}
        </p>
      </header>
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Surface tone="navy" className="relative overflow-hidden p-7 sm:p-8">
          <div className="relative z-10 max-w-[75%] sm:max-w-[70%]">
            <span className="inline-flex items-center gap-2 rounded-full bg-cream/10 px-3 py-1.5 text-[10px] font-medium tracking-wide">
              <Sparkles className="size-3 text-coral" />
              {c.header.eyebrow}
            </span>
            <h2 className="mt-6 font-display text-[clamp(1.8rem,3vw,2.75rem)] font-semibold leading-[1.05] tracking-tight">
              {c.newCampaign.title}
            </h2>
            <ul className="mt-4 max-w-sm space-y-1 text-xs leading-relaxed text-cream/70 sm:text-sm">
              {c.newCampaign.whatList.slice(0, 4).map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
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
        </Surface>
        <Surface
          tone="coralSoft"
          className="flex flex-col border border-coral/10 p-6 sm:p-7"
        >
          <h2 className="font-display text-xl font-semibold">
            {c.status.needs_input} · {c.status.running}
          </h2>
          {waiting.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t.workspace.allDone}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {waiting.slice(0, 5).map((x) => (
                <li key={x.id}>
                  <Link
                    to="/app/campaigns/$id"
                    params={{ id: x.id }}
                    className="flex min-h-12 items-center gap-3 rounded-2xl bg-card/70 px-4 py-2 text-sm hover:bg-card"
                  >
                    {x.status === "needs_input" ? (
                      <MessageCircleQuestion className="size-4 shrink-0 text-warning-ink" />
                    ) : (
                      <Loader2 className="size-4 shrink-0 animate-spin text-coral-ink" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {x.product_name || c.header.untitled}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {c.status[x.status]} · {formatRelative(x.created_at)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
      <div className="my-6 grid grid-cols-3 gap-3 sm:gap-5">
        {stats.map((stat) => (
          <Surface
            key={stat.label}
            className="border border-border/40 !p-4 sm:!p-5"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                {stat.label}
              </span>
              <stat.icon className="hidden size-4 text-coral-ink sm:block" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {stat.value}
            </p>
          </Surface>
        ))}
      </div>
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
        {list.length === 0 ? (
          <Surface tone="cream" className="text-sm text-muted-foreground">
            {t.campaigns.emptySub}
          </Surface>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {list.slice(0, 6).map((x) => (
              <CampaignCard key={x.id} campaign={x} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
