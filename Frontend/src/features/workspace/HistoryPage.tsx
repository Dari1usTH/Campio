import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { campaignsQuery } from "@/services/queries";
import { isKitActive, type KitStatus } from "@/services/kit";
import { PageLoading, PageError } from "@/components/app/PageState";
import { CampaignCard } from "@/components/app/CampaignCard";
import { PageHeader, Surface } from "@/components/campio/Surface";
import { EmptyState } from "@/components/campio/Illustrations";
import { Button } from "@/components/ui/button";
import { SelectChip } from "@/components/campio/Chip";
import { useKitCopy } from "@/features/campaign/kit/copy";
import { useT } from "@/i18n";

type Filter = "all" | "running" | Exclude<KitStatus, "pending" | "running">;
const FILTERS: Filter[] = [
  "all",
  "running",
  "needs_input",
  "completed",
  "failed",
];

export default function HistoryPage() {
  const t = useT();
  const c = useKitCopy();
  const query = useQuery({
    ...campaignsQuery(),
    refetchInterval: (q) =>
      q.state.data?.some((x) => isKitActive(x.status)) ? 4000 : false,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Filter>("all");
  const list = useMemo(() => {
    const q = search.toLocaleLowerCase();
    return (
      query.data?.filter(
        (x) =>
          (status === "all" ||
            (status === "running"
              ? isKitActive(x.status)
              : x.status === status)) &&
          `${x.product_name} ${x.keyword}`.toLocaleLowerCase().includes(q),
      ) ?? []
    );
  }, [query.data, status, search]);
  return (
    <div className="animate-rise">
      <PageHeader
        title={t.campaigns.title}
        actions={
          <Button asChild variant="coral">
            <Link to="/app/new">
              <Plus />
              {t.common.createCampaign}
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-5">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t.campaigns.search}
            placeholder={t.campaigns.search}
            className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((key) => (
            <SelectChip
              key={key}
              selected={status === key}
              onToggle={() => setStatus(key)}
              showCheck={false}
              className="shrink-0"
              size="md"
            >
              {key === "all" ? t.campaigns.filters.all : c.status[key]}
              {key === "all" && query.data && (
                <span className="ml-1 text-[10px] opacity-60">
                  {query.data.length}
                </span>
              )}
            </SelectChip>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <PageLoading />
      ) : query.isError ? (
        <PageError retry={() => query.refetch()} />
      ) : list.length === 0 ? (
        <Surface>
          <EmptyState
            title={search ? t.campaigns.noResults : t.campaigns.emptyTitle}
            sub={t.campaigns.emptySub}
            action={
              search || status !== "all" ? (
                <Button
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}
                >
                  {t.workspace.clearSearch}
                </Button>
              ) : (
                <Button asChild variant="coral">
                  <Link to="/app/new">
                    {t.common.createCampaign}
                    <Plus />
                  </Link>
                </Button>
              )
            }
          />
        </Surface>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          {list.map((x) => (
            <CampaignCard key={x.id} campaign={x} />
          ))}
        </div>
      )}
    </div>
  );
}
