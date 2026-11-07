import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CheckCircle2, CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ComputedBadge } from "@/components/campio/Chip";
import { campaignsService } from "@/services/campaigns";
import type { BudgetTotals, ChannelEstimate, Kit } from "@/services/kit";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import { tooltipStyle } from "./MarketTab";
import { labelChannel } from "./StrategyTabs";
import {
  CHART_COLORS,
  Panel,
  Pending,
  TableWrap,
  dec,
  int,
  lei,
  pct,
  td,
  th,
} from "./ui";

export function PlanTab({ kit, readOnly }: { kit: Kit; readOnly?: boolean }) {
  const c = useKitCopy();
  const plan = kit.plan;
  if (!plan) return <Pending />;
  return (
    <div className="space-y-5">
      <Panel title={c.plan.channels} aside={<ComputedBadge />}>
        <div className="grid items-center gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="mx-auto h-52 w-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={plan.channels.map((ch) => ({
                    name: ch.label || labelChannel(ch.channel),
                    value: ch.share_pct,
                  }))}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={2}
                  stroke="none"
                >
                  {plan.channels.map((ch, i) => (
                    <Cell
                      key={ch.channel}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => pct(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <EstimateTable channels={plan.channels} totals={plan.totals} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{c.plan.computed}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {plan.channels.map((ch, i) => (
            <div
              key={ch.channel}
              className="rounded-2xl bg-surface p-4 text-sm"
            >
              <p className="flex items-center gap-2 font-semibold">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {ch.label || labelChannel(ch.channel)}
                <span className="ml-auto font-normal text-muted-foreground">
                  {lei(ch.weekly_budget_ron)} / {c.plan.week.toLowerCase()}
                </span>
              </p>
              {ch.rationale && (
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {ch.rationale}
                </p>
              )}
              {ch.formats.length > 0 && (
                <p className="mt-2 text-xs">
                  {c.plan.formats}: {ch.formats.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {!readOnly && plan.channels.length > 0 && <BudgetSimulator kit={kit} />}

      <Panel title={c.plan.calendar}>
        <div className="grid gap-3 md:grid-cols-2">
          {plan.calendar.map((week) => (
            <article
              key={week.week}
              className="rounded-2xl border border-border p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-coral-ink">
                {c.plan.week} {week.week}
              </p>
              <h4 className="mt-1 font-display text-lg font-bold leading-tight">
                {week.theme}
              </h4>
              {week.goal && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {week.goal}
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {week.actions.map((a, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-sm"
                  >
                    <span className="text-xs font-semibold text-muted-foreground">
                      {a.day}
                    </span>
                    <span>
                      <span className="mr-1 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                        {labelChannel(a.channel)}
                      </span>
                      {a.action}
                      {a.content_refs.length > 0 && (
                        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                          {a.content_refs.map((ref) => (
                            <span
                              key={ref}
                              className="rounded-md bg-coral-tint px-1.5 py-0.5 font-mono text-[10px] text-coral-ink"
                            >
                              {ref}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Panel>

      {plan.ab_tests.length > 0 && (
        <Panel title={c.plan.abTests}>
          <div className="space-y-4">
            {plan.ab_tests.map((t) => {
              const sz = t.sizing;
              return (
                <article
                  key={t.id}
                  className="rounded-2xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{t.name}</h4>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                      {labelChannel(t.channel)}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] uppercase">
                      {t.metric}
                    </span>
                  </div>
                  {t.hypothesis && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {c.plan.hypothesis}: {t.hypothesis}
                    </p>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-surface p-3 text-sm">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {c.plan.variantA}
                      </p>
                      {t.variant_a}
                    </div>
                    <div className="rounded-xl bg-coral-tint/60 p-3 text-sm">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {c.plan.variantB}
                      </p>
                      {t.variant_b}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span>
                      {c.plan.sample}: <b>{int(sz.sample_per_variant)}</b>{" "}
                      {sz.sample_unit}
                    </span>
                    <span>
                      {c.plan.testCost}: <b>{lei(sz.est_cost_ron)}</b>
                    </span>
                    <span>
                      {sz.est_days < 0 ? (
                        c.plan.noBudget
                      ) : (
                        <>
                          ≈ <b>{dec(sz.est_days)}</b> {c.plan.days}
                        </>
                      )}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                        sz.feasible_in_campaign
                          ? "bg-success-tint text-success-ink"
                          : "bg-warning-tint text-warning-ink",
                      )}
                    >
                      {sz.feasible_in_campaign ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <CircleAlert className="size-3" />
                      )}
                      {sz.feasible_in_campaign
                        ? c.plan.feasible
                        : c.plan.notFeasible}
                    </span>
                  </div>
                  {t.decision_rule && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.plan.decision}: {t.decision_rule}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </Panel>
      )}

      {plan.kpis.length > 0 && (
        <Panel title={c.plan.kpis}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {plan.kpis.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function EstimateTable({
  channels,
  totals,
}: {
  channels: ChannelEstimate[];
  totals: BudgetTotals;
}) {
  const c = useKitCopy();
  return (
    <TableWrap>
      <thead>
        <tr>
          <th className={th}>{c.plan.colChannel}</th>
          <th className={cn(th, "text-right")}>{c.plan.colShare}</th>
          <th className={cn(th, "text-right")}>{c.plan.colBudget}</th>
          <th className={cn(th, "text-right")}>{c.plan.colImpr}</th>
          <th className={cn(th, "text-right")}>{c.plan.colClicks}</th>
          <th className={cn(th, "text-right")}>{c.plan.colOrders}</th>
          <th className={cn(th, "text-right")}>{c.plan.colRevenue}</th>
          <th className={cn(th, "text-right")}>{c.plan.colRoas}</th>
          <th className={cn(th, "text-right")}>{c.plan.colCpa}</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {channels.map((ch) => (
          <tr key={ch.channel}>
            <td className={td}>{ch.label || labelChannel(ch.channel)}</td>
            <td className={cn(td, "text-right")}>{pct(ch.share_pct)}</td>
            <td className={cn(td, "text-right")}>{lei(ch.budget_ron)}</td>
            <td className={cn(td, "text-right")}>{int(ch.est_impressions)}</td>
            <td className={cn(td, "text-right")}>{int(ch.est_clicks)}</td>
            <td className={cn(td, "text-right")}>{dec(ch.est_orders)}</td>
            <td className={cn(td, "text-right")}>{lei(ch.est_revenue_ron)}</td>
            <td className={cn(td, "text-right")}>{dec(ch.roas, 2)}</td>
            <td className={cn(td, "text-right")}>
              {ch.cpa_ron ? lei(ch.cpa_ron) : "—"}
            </td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className={td}>{c.plan.total}</td>
          <td className={cn(td, "text-right")}>100%</td>
          <td className={cn(td, "text-right")}>{lei(totals.budget_ron)}</td>
          <td className={cn(td, "text-right")}>
            {int(totals.est_impressions)}
          </td>
          <td className={cn(td, "text-right")}>{int(totals.est_clicks)}</td>
          <td className={cn(td, "text-right")}>{dec(totals.est_orders)}</td>
          <td className={cn(td, "text-right")}>
            {lei(totals.est_revenue_ron)}
          </td>
          <td className={cn(td, "text-right")}>{dec(totals.roas, 2)}</td>
          <td className={cn(td, "text-right")}>
            {totals.cpa_ron ? lei(totals.cpa_ron) : "—"}
          </td>
        </tr>
      </tbody>
    </TableWrap>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function BudgetSimulator({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const plan = kit.plan!;
  const initial = useMemo(
    () => ({
      total: Math.round(plan.totals.budget_ron || kit.input.ad_budget_ron),
      shares: Object.fromEntries(
        plan.channels.map((ch) => [ch.channel, Math.round(ch.share_pct)]),
      ),
    }),
    [plan, kit.input.ad_budget_ron],
  );
  const [state, setState] = useState(initial);
  const debounced = useDebounced(state, 300);
  const changed = JSON.stringify(debounced) !== JSON.stringify(initial);
  const sim = useQuery({
    queryKey: ["budget-sim", kit.id, debounced],
    queryFn: () =>
      campaignsService.simulateBudget(
        kit.id,
        debounced.total,
        debounced.shares,
      ),
    enabled: changed && Object.values(debounced.shares).some((v) => v > 0),
    placeholderData: keepPreviousData,
  });
  const max = Math.max(10000, Math.ceil((initial.total * 3) / 500) * 500);
  const shareSum = Object.values(state.shares).reduce((a, b) => a + b, 0) || 1;
  const result = changed ? sim.data : undefined;
  const totals = result?.totals ?? plan.totals;
  return (
    <Panel
      title={c.plan.simulator}
      aside={
        <div className="flex items-center gap-2">
          {sim.isFetching && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setState(initial)}
            disabled={!changed}
          >
            <RotateCcw />
            {c.plan.reset}
          </Button>
        </div>
      }
    >
      <p className="-mt-2 mb-5 text-sm text-muted-foreground">
        {c.plan.simulatorSub}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium">{c.plan.totalBudget}</span>
              <span className="font-semibold tabular-nums">
                {lei(state.total)}
              </span>
            </div>
            <Slider
              aria-label={c.plan.totalBudget}
              min={0}
              max={max}
              step={50}
              value={[state.total]}
              onValueChange={([v]) =>
                setState((s) => ({ ...s, total: v ?? 0 }))
              }
            />
          </div>
          {plan.channels.map((ch, i) => {
            const v = state.shares[ch.channel] ?? 0;
            return (
              <div key={ch.channel}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    {ch.label || labelChannel(ch.channel)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {pct((v / shareSum) * 100)}
                  </span>
                </div>
                <Slider
                  aria-label={ch.label || labelChannel(ch.channel)}
                  min={0}
                  max={100}
                  step={1}
                  value={[v]}
                  onValueChange={([n]) =>
                    setState((s) => ({
                      ...s,
                      shares: { ...s.shares, [ch.channel]: n ?? 0 },
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 content-start gap-3">
          {(
            [
              [
                c.plan.colImpr,
                int(totals.est_impressions),
                int(plan.totals.est_impressions),
              ],
              [
                c.plan.colClicks,
                int(totals.est_clicks),
                int(plan.totals.est_clicks),
              ],
              [
                c.plan.colOrders,
                dec(totals.est_orders),
                dec(plan.totals.est_orders),
              ],
              [
                c.plan.colRevenue,
                lei(totals.est_revenue_ron),
                lei(plan.totals.est_revenue_ron),
              ],
              [c.plan.colRoas, dec(totals.roas, 2), dec(plan.totals.roas, 2)],
              [
                c.plan.colCpa,
                totals.cpa_ron ? lei(totals.cpa_ron) : "—",
                plan.totals.cpa_ron ? lei(plan.totals.cpa_ron) : "—",
              ],
            ] as const
          ).map(([label, value, original]) => (
            <div
              key={label}
              className={cn(
                "rounded-2xl p-4",
                result ? "bg-coral-tint/70" : "bg-surface",
              )}
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">
                {value}
              </p>
              {result && (
                <p className="text-[11px] text-muted-foreground">
                  {c.plan.original}: {original}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
