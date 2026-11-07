import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUp, ExternalLink, MessageSquare, Rocket } from "lucide-react";
import type { Kit } from "@/services/kit";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import { tooltipStyle } from "./MarketTab";
import {
  CHART_COLORS,
  Notice,
  Panel,
  Pending,
  Stat,
  TableWrap,
  dec,
  int,
  lei,
  money,
  pct,
  safeHref,
  td,
  th,
} from "./ui";

export function WebTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const w = kit.web;
  if (!w) return kit.market ? <Notice>{c.pending}</Notice> : <Pending />;
  const status = (name: string) => w.sources.find((s) => s.name === name);
  const SourceNote = ({ name }: { name: string }) => {
    const s = status(name);
    if (!s || (s.status === "ok" && !s.note)) return null;
    return (
      <Notice tone={s.status === "ok" ? "info" : "warn"}>
        {s.note || c.web.sourceStatus[s.status]}
      </Notice>
    );
  };
  const ok = (name: string) => status(name)?.status === "ok";
  const a = w.stats.amazon;
  const r = w.stats.reddit;
  return (
    <div className="space-y-5">
      <Panel title={c.web.sources}>
        <p className="mb-3 text-sm text-muted-foreground">
          {c.web.query}:{" "}
          <span className="font-medium text-foreground">{w.query}</span>
          {w.subreddits.length > 0 && (
            <> · {w.subreddits.map((s) => `r/${s}`).join(", ")}</>
          )}
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {w.sources.map((s) => (
            <li
              key={s.name}
              className="flex items-center justify-between gap-2 rounded-2xl bg-surface px-4 py-3 text-sm"
            >
              <span className="font-medium">
                {c.web.sourceNames[s.name] ?? s.name}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  s.status === "ok"
                    ? "bg-success-tint text-success-ink"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {c.web.sourceStatus[s.status] ?? s.status}
                {s.status === "ok" && ` · ${s.items}`}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={c.web.amazon}>
        <SourceNote name="amazon" />
        {ok("amazon") && (
          <div className="space-y-4">
            <div className="mt-1 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label={c.web.amazonMedian}
                value={money(a.price_median, a.currency)}
                sub={
                  a.currency !== "RON"
                    ? `≈ ${lei(a.price_median_ron)}`
                    : undefined
                }
              />
              <Stat
                tone="accent"
                label={c.web.emagVsAmazon}
                value={
                  a.emag_vs_amazon_pct
                    ? pct(Math.abs(a.emag_vs_amazon_pct))
                    : "—"
                }
                sub={
                  a.emag_vs_amazon_pct
                    ? a.emag_vs_amazon_pct < 0
                      ? c.web.cheaper
                      : c.web.pricier
                    : undefined
                }
              />
              <Stat
                label={c.market.rating}
                value={dec(a.avg_rating)}
                sub={`${int(a.total_reviews)} ${c.market.reviews}`}
              />
              <Stat label={c.web.sponsored} value={pct(a.sponsored_pct)} />
            </div>
            <TableWrap>
              <thead>
                <tr>
                  <th className={th}>{c.market.colProduct}</th>
                  <th className={cn(th, "text-right")}>{c.market.colPrice}</th>
                  <th className={cn(th, "text-right")}>{c.market.colRating}</th>
                  <th className={cn(th, "text-right")}>
                    {c.market.colReviews}
                  </th>
                </tr>
              </thead>
              <tbody>
                {w.amazon.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>
                      <a
                        href={safeHref(p.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 hover:underline"
                      >
                        <span className="line-clamp-2">{p.title}</span>
                        <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      </a>
                      {p.sponsored && (
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          ({c.web.sponsored})
                        </span>
                      )}
                    </td>
                    <td className={cn(td, "text-right tabular-nums")}>
                      {p.price ? money(p.price, p.currency) : "—"}
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
          </div>
        )}
      </Panel>

      <Panel title={c.web.reddit}>
        <SourceNote name="reddit" />
        {w.discussions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {int(r.post_count)} {c.web.posts} · {int(r.comment_count)}{" "}
              {c.web.comments} · {int(r.last_12_months)} {c.web.lastYear}
            </p>
            {r.subreddits.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  {c.web.bySubreddit}
                </p>
                <div style={{ height: Math.max(80, r.subreddits.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={r.subreddits.map((s) => ({
                        name: `r/${s.name}`,
                        posts: s.posts,
                        comments: s.comments,
                      }))}
                      margin={{ left: 8, right: 8 }}
                    >
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={130}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        dataKey="posts"
                        name={c.web.posts}
                        stackId="a"
                        fill={CHART_COLORS[1]}
                      />
                      <Bar
                        dataKey="comments"
                        name={c.web.comments}
                        stackId="a"
                        fill={CHART_COLORS[0]}
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            <ul className="grid gap-3 md:grid-cols-2">
              {w.discussions.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col rounded-2xl bg-surface p-4"
                >
                  <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="size-3.5" />
                    r/{d.subreddit} · {d.date}
                    <span className="ml-auto inline-flex items-center gap-0.5">
                      <ArrowUp className="size-3" />
                      {int(d.score)}
                    </span>
                  </p>
                  {d.title && <p className="font-medium">{d.title}</p>}
                  {d.text && (
                    <blockquote className="mt-1 line-clamp-5 text-sm leading-relaxed text-muted-foreground">
                      “{d.text}”
                    </blockquote>
                  )}
                  <a
                    href={safeHref(d.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium hover:underline"
                  >
                    {c.web.open} <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel
        title={c.web.launches}
        aside={
          ok("betalist") || w.launches.length ? (
            <span className="text-xs text-muted-foreground">
              {int(w.stats.launches.relevant)} {c.web.relevant}{" "}
              {int(w.stats.launches.found)} {c.web.found}
            </span>
          ) : undefined
        }
      >
        <SourceNote name="betalist" />
        {w.launches.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {w.launches.map((l) => (
              <li key={l.id}>
                <a
                  href={safeHref(l.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full gap-3 rounded-2xl bg-surface p-4 hover:bg-secondary"
                >
                  <Rocket className="mt-0.5 size-4 shrink-0 text-coral-ink" />
                  <span>
                    <span className="block font-medium">{l.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {l.tagline}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
