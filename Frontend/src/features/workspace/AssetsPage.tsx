import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Image, LockKeyhole, Plus, Sparkles, Video } from "lucide-react";
import { campaignsService } from "@/services/campaigns";
import { campaignsQuery } from "@/services/queries";
import { useT, tr } from "@/i18n";
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
  const media = useQuery({queryKey:["media-assets",query.data?.map(c=>c.id).join(",")],enabled:!!query.data,queryFn:async()=>{const groups=await Promise.all((query.data??[]).map(c=>campaignsService.assets(c.id)));return groups.flat();},refetchInterval:query=>query.state.data?.some(a=>["pending","in_progress"].includes(a.status))?3000:false});
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

          </SelectChip>
        ))}
      </div>
      {query.isPending ? (
        <PageLoading />
      ) : query.isError ? (
        <PageError retry={() => query.refetch()} />
      ) : tab !== "images" ? (
        media.isPending ? <PageLoading/> : media.isError ? <PageError retry={()=>media.refetch()}/> : <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">{media.data.filter(a=>tab==="videos"?a.mime.startsWith("video/"):a.mime.startsWith("image/")).map(asset=><article key={asset.id} className="rounded-[1.75rem] border border-border bg-card p-4 shadow-soft">{asset.status==="completed"?(asset.mime.startsWith("video/")?<video src={asset.content_url} controls className="aspect-square w-full rounded-2xl bg-navy"/>:<img src={asset.content_url} alt={asset.name} className="aspect-square w-full rounded-2xl object-contain"/>):<div className="grid aspect-square place-items-center rounded-2xl bg-background"><p>{asset.status==="failed"?tr("extra.assetFailed"):t.common.loading}</p></div>}<h2 className="mt-4 font-semibold">{asset.name}</h2>{asset.status==="completed"&&<a href={asset.content_url+"?download=1"} download={asset.name} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm text-cream">{tr("extra.download")}</a>}</article>)}{!media.data.some(a=>tab==="videos"?a.mime.startsWith("video/"):a.mime.startsWith("image/"))&&<EmptyState title={t.assets.emptyTitle} sub={tr("extra.mediaEmpty")}/>}</div>
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
                    {t.assets.square} {tr("extra.png")}</p>
                  <DownloadVisualButton campaign={c} />
                </div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
