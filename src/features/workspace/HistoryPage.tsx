import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ArrowRight,
  Copy,
  X,
  GitCompareArrows,
} from "lucide-react";
import { toast } from "sonner";
import { campaignsQuery } from "@/services/queries";
import { PageLoading, PageError } from "@/components/app/PageState";
import { CampaignCard } from "@/components/app/CampaignCard";
import { PageHeader, Surface } from "@/components/campio/Surface";
import { EmptyState } from "@/components/campio/Illustrations";
import { Button } from "@/components/ui/button";
import { SelectChip } from "@/components/campio/Chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT, formatMoney, formatDate } from "@/i18n";
import type { Campaign } from "@/services/schemas";

export default function HistoryPage() {
  const t = useT();
  const query = useQuery(campaignsQuery());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Campaign["status"] | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const list = useMemo(
    () =>
      query.data?.filter(
        (c) =>
          (status === "all" || c.status === status) &&
          `${c.product.name} ${c.product.category}`
            .toLocaleLowerCase("ro")
            .includes(search.toLocaleLowerCase("ro")),
      ) ?? [],
    [query.data, status, search],
  );
  const pair = selected
    .map((id) => query.data?.find((c) => c.id === id))
    .filter((c): c is Campaign => !!c);
  const toggle = (id: string) =>
    setSelected((old) =>
      old.includes(id)
        ? old.filter((x) => x !== id)
        : old.length < 2
          ? [...old, id]
          : (toast.info(t.workspace.selectTwo), old),
    );
  return (
    <div className="animate-rise">
      <PageHeader
        title={t.campaigns.title}
        sub={t.workspace.findCampaign}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <Button
            variant="outline"
            onClick={() => {
              if (selected.length === 2) setCompare(true);
              else toast.info(t.workspace.selectTwo);
            }}
            className="bg-card"
          >
            <GitCompareArrows />
            {t.campaigns.compare}
            {selected.length > 0 && (
              <span className="rounded-full bg-coral-tint px-2 py-0.5 text-[10px] text-coral-ink">
                {selected.length}/2
              </span>
            )}
          </Button>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(t.campaigns.filters) as (Campaign["status"] | "all")[]).map((key) => (
            <SelectChip
              key={key}
              selected={status === key}
              onToggle={() => setStatus(key)}
              showCheck={false}
              className="shrink-0"
              size="md"
            >
              {t.campaigns.filters[key]}
              {key === "all" && query.data && (
                <span className="ml-1 text-[10px] opacity-60">{query.data.length}</span>
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
          {list.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              selected={selected.includes(c.id)}
              onSelect={() => toggle(c.id)}
            />
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="sticky bottom-24 z-20 mx-auto mt-6 flex w-fit max-w-full flex-wrap items-center justify-center gap-3 rounded-full bg-navy px-4 py-3 text-cream shadow-float md:bottom-6">
          <p className="text-xs">
            {selected.length}/2 {t.workspace.compareSelected}
          </p>
          <Button
            variant="coral"
            size="sm"
            disabled={selected.length !== 2}
            onClick={() => setCompare(true)}
          >
            {t.campaigns.compareCta}
            <ArrowRight />
          </Button>
          <Button
            variant="ghostLight"
            size="iconSm"
            onClick={() => setSelected([])}
            aria-label={t.common.cancel}
          >
            <X />
          </Button>
        </div>
      )}
      <Surface
        tone="cream"
        className="mt-8 flex flex-wrap items-center justify-between gap-5 border border-border"
      >
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-coral-tint">
            <Copy className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t.workspace.templates}</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              {t.workspace.templatesSub}
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/new" search={query.data?.[0] ? { reuse: query.data[0].id } : {}}>
            {t.workspace.useTemplate}
            <ArrowRight />
          </Link>
        </Button>
      </Surface>
      <Dialog open={compare} onOpenChange={setCompare}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.campaigns.compareTitle}</DialogTitle>
            <DialogDescription>{t.campaigns.compareHint}</DialogDescription>
          </DialogHeader>
          {pair.length === 2 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr>
                    <th className="w-1/4" />
                    {pair.map((c) => (
                      <th key={c.id} className="p-2 align-top">
                        <div className="mb-3 aspect-[3/2] overflow-hidden rounded-2xl bg-secondary">
                          {c.product.photoUrl && (
                            <img
                              alt=""
                              src={c.product.photoUrl}
                              className="size-full object-cover"
                            />
                          )}
                        </div>
                        <Link
                          className="text-base font-semibold"
                          to="/app/campaigns/$id"
                          params={{ id: c.id }}
                          onClick={() => setCompare(false)}
                        >
                          {c.product.name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: t.campaigns.budget, values: pair.map((c) => formatMoney(c.budget)) },
                    {
                      label: t.campaigns.winnerScore,
                      values: pair.map(
                        (c) => `${c.messages.find((m) => m.isWinner)?.score ?? 0}/100`,
                      ),
                    },
                    {
                      label: t.campaigns.channels,
                      values: pair.map((c) => c.channels.map((ch) => ch.channel).join(", ")),
                    },
                    { label: t.wizard.goal, values: pair.map((c) => t.wizard.goals[c.goal]) },
                    { label: t.wizard.tone, values: pair.map((c) => t.wizard.tones[c.tone]) },
                    {
                      label: t.campaigns.created,
                      values: pair.map((c) => formatDate(c.createdAt)),
                    },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-border">
                      <th className="py-4 pr-2 font-medium text-muted-foreground">{row.label}</th>
                      {row.values.map((v, i) => (
                        <td key={i} className="p-2 leading-relaxed">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
