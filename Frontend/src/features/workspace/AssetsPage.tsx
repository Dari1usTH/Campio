import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Image, LockKeyhole, Plus, Sparkles, Video } from "lucide-react";
import { campaignsQuery } from "@/services/queries";
import { useT } from "@/i18n";
import { PageHeader, Surface } from "@/components/campio/Surface";
import { SelectChip, Chip } from "@/components/campio/Chip";
import { Button } from "@/components/ui/button";
import { PageLoading, PageError } from "@/components/app/PageState";
import { EmptyState } from "@/components/campio/Illustrations";
import { VisualPreview, DownloadVisualButton } from "@/features/campaign/visual";
export default function AssetsPage() {
  const t = useT();
  const query = useQuery(campaignsQuery());
  const [tab, setTab] = useState("images");
  const tabs = [
    { id: "images", label: t.workspace.images },
    { id: "posters", label: t.workspace.posters },
    { id: "videos", label: t.workspace.videos },
  ];
  return (
    <div className="animate-rise">
      <PageHeader
        title={t.assets.title}
        sub={t.workspace.assetsNote}
        actions={
          <Button asChild variant="coral">
            <Link to="/app/new">
              <Plus />
              {t.common.createCampaign}
            </Link>
          </Button>
        }
      />
      <div className="mb-7 flex gap-2">
        {tabs.map((item) => (
          <SelectChip
            key={item.id}
            selected={tab === item.id}
            onToggle={() => setTab(item.id)}
            showCheck={false}
            size="lg"
          >
            {item.label}
            {item.id !== "images" && <LockKeyhole className="size-3" />}
          </SelectChip>
        ))}
      </div>
      {query.isPending ? (
        <PageLoading />
      ) : query.isError ? (
        <PageError retry={() => query.refetch()} />
      ) : tab !== "images" ? (
        <Surface
          tone="cream"
          className="flex min-h-96 flex-col items-center justify-center border border-dashed border-border text-center"
        >
          <span className="mb-5 grid size-20 place-items-center rounded-3xl bg-coral-tint">
            {tab === "posters" ? <Image className="size-8" /> : <Video className="size-8" />}
          </span>
          <Chip variant="coral">{t.common.soon}</Chip>
          <h2 className="mt-5 text-2xl font-semibold">{t.workspace.assetsSoon}</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t.workspace.assetsSoonBody}
          </p>
        </Surface>
      ) : query.data.length === 0 ? (
        <EmptyState
          title={t.assets.emptyTitle}
          sub={t.campaigns.emptySub}
          action={
            <Button asChild>
              <Link to="/app/new">{t.common.createCampaign}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
          {query.data
            .filter((c) => c.status !== "generating")
            .map((c) => (
              <article
                key={c.id}
                className="min-w-0 rounded-[1.75rem] border border-border/60 bg-card p-3 shadow-soft"
              >
                <div className="overflow-hidden rounded-[1.2rem]">
                  <VisualPreview campaign={c} />
                </div>
                <div className="p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold">{c.product.name}</h2>
                    <Link
                      aria-label={`${t.workspace.viewCampaign}: ${c.product.name}`}
                      to="/app/campaigns/$id"
                      params={{ id: c.id }}
                      className="grid size-10 place-items-center rounded-full hover:bg-secondary"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                  <p className="mb-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Image className="size-3" />
                    {t.assets.square} · PNG
                  </p>
                  <DownloadVisualButton campaign={c} />
                </div>
              </article>
            ))}
        </div>
      )}
      <Surface tone="navy" className="mt-8 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream/10">
            <Sparkles className="size-5 text-coral" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t.result.lockedTitle}</h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-cream/65">
              {t.workspace.assetsSoonBody}
            </p>
          </div>
        </div>
        <Chip variant="onDark" size="sm">
          <LockKeyhole />
          {t.common.soon}
        </Chip>
      </Surface>
    </div>
  );
}
