import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Download,
  Film,
  Loader2,
  Music,
  Plus,
} from "lucide-react";
import { campaignsService } from "@/services/campaigns";
import { campaignsQuery } from "@/services/queries";
import { isAssetActive, type Asset } from "@/services/kit";
import { useT, formatRelative } from "@/i18n";
import { PageHeader } from "@/components/campio/Surface";
import { SelectChip } from "@/components/campio/Chip";
import { Button } from "@/components/ui/button";
import { PageLoading, PageError } from "@/components/app/PageState";
import { EmptyState } from "@/components/campio/Illustrations";
import { useKitCopy } from "@/features/campaign/kit/copy";
import { VideoFrame, mediaUrl } from "@/features/campaign/kit/ui";

type Tab = "edited" | "generated" | "upload";

export default function AssetsPage() {
  const t = useT();
  const c = useKitCopy();
  const campaigns = useQuery(campaignsQuery());
  const [tab, setTab] = useState<Tab>("edited");
  const ids = campaigns.data?.map((x) => x.id) ?? [];
  const media = useQuery({
    queryKey: ["media-assets", ids.join(",")],
    enabled: !!campaigns.data,
    queryFn: async () =>
      (await Promise.all(ids.map((id) => campaignsService.assets(id)))).flat(),
    refetchInterval: (q) => (q.state.data?.some(isAssetActive) ? 5000 : false),
  });
  const names = new Map(
    campaigns.data?.map((x) => [x.id, x.product_name || x.keyword]) ?? [],
  );
  const tabs: { id: Tab; label: string }[] = [
    { id: "edited", label: c.video.final },
    { id: "generated", label: c.video.clips },
    { id: "upload", label: c.video.uploads },
  ];
  const items = (media.data ?? [])
    .filter((a) => a.kind === tab)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="animate-rise">
      <PageHeader
        title={t.assets.title}
        actions={
          <Button asChild variant="coral">
            <Link to="/app/new">
              <Plus />
              {t.common.createCampaign}
            </Link>
          </Button>
        }
      />
      <div className="mb-7 flex flex-wrap gap-2">
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
      {campaigns.isPending || media.isPending ? (
        <PageLoading />
      ) : campaigns.isError || media.isError ? (
        <PageError
          retry={() => void campaigns.refetch().then(() => media.refetch())}
        />
      ) : items.length === 0 ? (
        <EmptyState title={t.assets.emptyTitle} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {items.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              campaign={names.get(a.campaign_id) ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset: a, campaign }: { asset: Asset; campaign: string }) {
  const c = useKitCopy();
  const url = mediaUrl(a.content_url);
  const done = a.status === "completed";
  return (
    <article className="min-w-0 rounded-[1.75rem] border border-border/60 bg-card p-3 shadow-soft">
      {a.mime.startsWith("video/") ? (
        <VideoFrame
          src={done ? url : undefined}
          {...(a.width ? { width: a.width } : {})}
          {...(a.height ? { height: a.height } : {})}
        >
          <p className="flex items-center gap-2 p-4 text-center text-xs text-white/80">
            {isAssetActive(a) && <Loader2 className="size-4 animate-spin" />}
            {a.status === "failed" ? c.video.failed : c.video.pending}
          </p>
        </VideoFrame>
      ) : (
        <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-navy">
          {!done ? (
            <p className="flex items-center gap-2 p-4 text-center text-xs text-cream/80">
              {isAssetActive(a) && <Loader2 className="size-4 animate-spin" />}
              {a.status === "failed" ? c.video.failed : c.video.pending}
            </p>
          ) : a.mime.startsWith("image/") ? (
            <img
              src={url}
              alt={a.name}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : a.mime.startsWith("audio/") ? (
            <div className="grid w-full justify-items-center gap-3 p-4">
              <Music className="size-8 text-cream/70" />
              <audio src={url} controls className="w-full" />
            </div>
          ) : (
            <Film className="size-8 text-cream/70" />
          )}
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              {a.meta.title || a.meta.caption || a.name}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {campaign}
              {a.kind === "upload" &&
                a.role &&
                ` · ${c.video.roles[a.role] ?? a.role}`}
              {a.kind === "generated" &&
                a.meta.concept_id &&
                ` · ${a.meta.concept_id} #${a.meta.shot_index + 1}`}
              {a.created_at && ` · ${formatRelative(a.created_at)}`}
            </p>
          </div>
          <Link
            aria-label={campaign}
            to="/app/campaigns/$id"
            params={{ id: a.campaign_id }}
            hash="video"
            className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-secondary"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        {done && (
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <a href={mediaUrl(a.content_url, true)}>
              <Download />
              {c.video.download}
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
