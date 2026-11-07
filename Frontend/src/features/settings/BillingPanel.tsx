import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCopy, fmt, formatRelative, useT } from "@/i18n";
import { formatCredit } from "@/lib/credit";
import { billingQuery } from "@/services/queries";
import { billingService } from "@/services/billing";
import type { Billing } from "@/services/schemas";
import { cn } from "@/lib/utils";
import { settingsCopy } from "./copy";

const copy = createCopy("billing");

export function BillingPanel() {
  useT(); // re-render on language change
  const qc = useQueryClient();
  const query = useQuery(billingQuery());
  const buy = useMutation({
    mutationFn: (pack: number) => billingService.purchase(pack),
    onSuccess: (data, pack) => {
      qc.setQueryData<Billing>(["billing"], data);
      toast.success(fmt(copy.bought, { amount: formatCredit(pack) }));
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : copy.loadError),
  });

  if (query.isPending)
    return <div className="h-64 rounded-3xl skeleton-shimmer" />;
  if (query.isError)
    return (
      <div className="rounded-[22px] border border-border p-6 text-sm">
        <p className="mb-3">{copy.loadError}</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          {settingsCopy.retry}
        </Button>
      </div>
    );
  const b = query.data;
  const empty = !b.unmetered && b.balance_usd <= 0;

  return (
    <div className="space-y-8">
      <section className="rounded-[22px] border border-border p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.balance}
        </p>
        <p
          className={cn(
            "mt-2 font-display text-4xl font-semibold tabular-nums",
            empty && "text-destructive",
          )}
        >
          {formatCredit(b.balance_usd)}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {b.unmetered ? copy.unmetered : empty ? copy.low : copy.balanceHint}
          {!b.unmetered && b.markup !== 1 && (
            <> {fmt(copy.markup, { markup: b.markup })}</>
          )}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold">{copy.buyTitle}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{copy.buySub}</p>
        {b.purchases_enabled ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {b.packs_usd.map((pack) => (
                <Button
                  key={pack}
                  type="button"
                  variant="outline"
                  className="h-14 bg-card text-base"
                  disabled={buy.isPending}
                  onClick={() => buy.mutate(pack)}
                >
                  {buy.isPending && buy.variables === pack ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  {fmt(copy.buy, { amount: formatCredit(pack) })}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {copy.testMode}
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{copy.disabled}</p>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">{copy.history}</h3>
        {b.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="divide-y divide-border rounded-[22px] border border-border">
            {b.transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {tx.kind === "usage"
                      ? tx.description
                      : copy[`kind_${tx.kind}`]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.kind === "usage" ? copy.kind_usage : ""}
                    {tx.kind === "usage" ? " · " : ""}
                    {formatRelative(tx.created_at)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 tabular-nums font-semibold",
                    tx.amount_usd >= 0
                      ? "text-success"
                      : "text-muted-foreground",
                  )}
                >
                  {tx.amount_usd >= 0 ? "+" : ""}
                  {formatCredit(tx.amount_usd)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
