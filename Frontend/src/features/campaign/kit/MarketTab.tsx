import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ExternalLink,
  Star,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import type { Kit } from "@/services/kit";
import { formatDate } from "@/i18n";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import {
  CHART_COLORS,
  Panel,
  Pending,
  SourceBadge,
  Stat,
  TableWrap,
  dec,
  int,
  lei,
  pct,
  safeHref,
  signedPct,
  td,
  th,
} from "./ui";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

export function MarketTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const m = kit.market;
  if (!m) return <Pending />;
  const s = m.stats;
  const price = kit.input.sale_price;
  const histogram = s.price_histogram.map((b) => ({
    label: `${Math.round(b.from)}–${Math.round(b.to)}`,
    count: b.count,
    mine: price >= b.from && price < b.to,
  }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SourceBadge source={m.source} note={m.fallback_note} />
        {m.fetched_at && (
          <span className="text-xs text-muted-foreground">
            {formatDate(m.fetched_at)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={c.market.competitors}
          value={int(s.competitor_count)}
          sub={`${int(s.known_seller_count)} ${c.market.sellers}`}
        />
        <Stat
          label={c.market.median}
          value={lei(s.price_median)}
          sub={`${c.market.range}: ${lei(s.price_min)} – ${lei(s.price_max)}`}
        />
        <Stat
          tone="accent"
          label={c.market.yourPrice}
          value={price ? lei(price, 2) : "—"}
          sub={
            price
              ? `${signedPct(m.price_vs_median_pct)} ${c.market.vsMedian}`
              : undefined
          }
        />
        <Stat
          label={c.market.rating}
          value={
            <span className="inline-flex items-center gap-1">
              {dec(s.avg_rating)}{" "}
              <Star className="size-5 fill-current text-coral" />
            </span>
          }
          sub={`${int(s.total_reviews)} ${c.market.reviews}`}
        />
        <Stat
          label={c.market.units}
          value={int(s.est_market_units_month)}
          sub={c.market.unitsHint}
        />
        <Stat label={c.market.top3} value={pct(s.top3_review_share_pct)} />
        <Stat
          label="P25 – P75"
          value={`${lei(s.price_p25)} – ${lei(s.price_p75)}`}
        />
        <Stat
          label={c.market.reviewsAnalyzed}
          value={int(m.reviews_analyzed)}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title={c.market.histogram}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogram}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v} ${c.market.products}`, ""]}
                  labelFormatter={(l: string) => `${l} lei`}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  shape={(props: unknown) => {
                    const p = props as {
                      x: number;
                      y: number;
                      width: number;
                      height: number;
                      payload: { mine: boolean };
                    };
                    return (
                      <rect
                        x={p.x}
                        y={p.y}
                        width={p.width}
                        height={p.height}
                        rx={6}
                        fill={
                          p.payload.mine ? CHART_COLORS[0] : CHART_COLORS[1]
                        }
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {price > 0 && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: CHART_COLORS[0] }}
              />
              {c.market.yourPrice}: {lei(price, 2)}
            </p>
          )}
        </Panel>
        <Panel title={c.market.topSellers}>
          <ul className="space-y-3">
            {s.top_sellers.slice(0, 6).map((seller) => (
              <li key={seller.name}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{seller.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {pct(seller.review_share_pct)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-navy dark:bg-cream"
                    style={{
                      width: `${Math.min(100, seller.review_share_pct)}%`,
                    }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {int(seller.product_count)} {c.market.products} ·{" "}
                  {int(seller.review_count)} {c.market.reviews}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <TrendPanel kit={kit} />
      <Panel title={c.market.table}>
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{c.market.colProduct}</th>
              <th className={th}>{c.market.colSeller}</th>
              <th className={cn(th, "text-right")}>{c.market.colPrice}</th>
              <th className={cn(th, "text-right")}>{c.market.colRating}</th>
              <th className={cn(th, "text-right")}>{c.market.colReviews}</th>
            </tr>
          </thead>
          <tbody>
            {m.competitors.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  {p.url ? (
                    <a
                      href={safeHref(p.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 hover:underline"
                    >
                      <span className="line-clamp-2">{p.title}</span>
                      <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    p.title
                  )}
                </td>
                <td className={cn(td, "text-muted-foreground")}>
                  {p.seller || "—"}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {lei(p.price, 2)}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {dec(p.rating)}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {int(p.review_count)}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>
    </div>
  );
}

function TrendPanel({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const tr = kit.trend;
  if (!tr) return null;
  const dir = tr.stats.direction;
  const Icon =
    dir === "rising" ? TrendingUp : dir === "declining" ? TrendingDown : Minus;
  return (
    <Panel
      title={c.market.trend}
      aside={<SourceBadge source={tr.source} note={tr.fallback_note} />}
    >
      {tr.monthly.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.market.noTrend}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold",
                dir === "rising"
                  ? "bg-success-tint text-success-ink"
                  : dir === "declining"
                    ? "bg-warning-tint text-warning-ink"
                    : "bg-secondary",
              )}
            >
              <Icon className="size-4" />
              {c.market.direction[dir] ?? dir}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1">
              {signedPct(tr.stats.yoy_change_pct)} {c.market.yoy}
            </span>
            {tr.stats.peak_month && (
              <span className="rounded-full bg-secondary px-3 py-1">
                {c.market.peak}: {tr.stats.peak_month}
              </span>
            )}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={tr.monthly}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  minTickGap={32}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [dec(v), ""]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

export { tooltipStyle };
