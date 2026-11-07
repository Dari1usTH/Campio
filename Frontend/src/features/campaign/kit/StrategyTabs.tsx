import { Quote, Sparkles, UserRound } from "lucide-react";
import { CopyButton } from "@/components/campio/CopyButton";
import type { Kit } from "@/services/kit";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import { BulletList, Panel, Pending, TableWrap, TagList, td, th } from "./ui";

const channelLabel: Record<string, string> = {
  emag_ads: "eMAG Ads",
  meta: "Meta (Facebook + Instagram)",
  tiktok: "TikTok",
  google_ads: "Google Ads",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  google_search: "Google Search",
  emag: "eMAG",
  forums: "Forums",
  pinterest: "Pinterest",
};
export const labelChannel = (id: string) => channelLabel[id] ?? id;

export function AudienceTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const s = kit.strategy;
  if (!s) return <Pending />;
  return (
    <div className="space-y-5">
      {s.summary && (
        <Panel title={c.audience.summary}>
          <p className="leading-relaxed">{s.summary}</p>
        </Panel>
      )}
      <div>
        <h3 className="mb-3 font-display text-lg font-bold">
          {c.audience.personas}
        </h3>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {s.personas.map((p) => (
            <article
              key={p.id}
              className="space-y-4 rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-soft"
            >
              <header className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral-tint">
                  <UserRound className="size-5 text-coral-ink" />
                </span>
                <div>
                  <h4 className="font-display text-lg font-bold leading-tight">
                    {p.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {[p.age_range, p.occupation].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </header>
              {p.description && (
                <p className="text-sm leading-relaxed">{p.description}</p>
              )}
              {p.message_hook && (
                <p className="rounded-2xl bg-navy p-3 text-sm text-cream">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-cream/60">
                    {c.audience.hook}
                  </span>
                  “{p.message_hook}”
                </p>
              )}
              <BulletList
                title={c.audience.motivations}
                items={p.motivations}
              />
              <BulletList title={c.audience.pains} items={p.pain_points} />
              <BulletList
                title={c.audience.triggers}
                items={p.buying_triggers}
              />
              <BulletList title={c.audience.objections} items={p.objections} />
              {p.channels.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.audience.channels}
                  </p>
                  <TagList items={p.channels.map(labelChannel)} />
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
      <Panel title={c.audience.complaints}>
        <ul className="space-y-4">
          {s.complaints.map((cp, i) => (
            <li key={`${cp.theme}-${i}`} className="rounded-2xl bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">{cp.theme}</h4>
                {cp.severity && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      cp.severity === "high"
                        ? "bg-coral-tint text-coral-ink"
                        : cp.severity === "medium"
                          ? "bg-warning-tint text-warning-ink"
                          : "bg-secondary",
                    )}
                  >
                    {c.audience.severity[cp.severity] ?? cp.severity}
                  </span>
                )}
                {cp.source && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                    {c.audience.sourceLabel[cp.source] ?? cp.source}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {cp.mentions} {c.audience.mentions}
                </span>
              </div>
              {cp.quotes.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {cp.quotes.map((q, j) => (
                    <li
                      key={j}
                      className="flex gap-2 text-sm italic text-muted-foreground"
                    >
                      <Quote className="mt-0.5 size-3.5 shrink-0" />
                      {q}
                    </li>
                  ))}
                </ul>
              )}
              {cp.opportunity && (
                <p className="mt-3 text-sm">
                  <span className="font-semibold">
                    {c.audience.opportunity}:{" "}
                  </span>
                  {cp.opportunity}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function PositioningTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const s = kit.strategy;
  if (!s) return <Pending />;
  const p = s.positioning;
  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] bg-gradient-navy p-6 text-navy-foreground md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/60">
          {c.positioning.main}
        </p>
        <p className="mt-3 font-display text-2xl font-bold leading-snug md:text-3xl">
          {p.main_message}
        </p>
        {p.tone && (
          <p className="mt-4 text-sm text-cream/75">
            {c.positioning.tone}: {p.tone}
          </p>
        )}
      </section>
      <Panel title={c.positioning.statement}>
        <p className="leading-relaxed">{p.statement}</p>
        {p.proof_points.length > 0 && (
          <div className="mt-4">
            <BulletList title={c.positioning.proof} items={p.proof_points} />
          </div>
        )}
      </Panel>
      {p.messages.length > 0 && (
        <Panel title={c.positioning.table}>
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>{c.positioning.complaint}</th>
                <th className={th}>{c.positioning.message}</th>
                <th className={th}>{c.positioning.claim}</th>
              </tr>
            </thead>
            <tbody>
              {p.messages.map((m, i) => (
                <tr key={i}>
                  <td className={cn(td, "text-muted-foreground")}>
                    {m.complaint_theme}
                  </td>
                  <td className={cn(td, "font-medium")}>{m.message}</td>
                  <td className={td}>{m.proof_claim}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}
    </div>
  );
}

export function ContentTab({
  kit,
  readOnly,
}: {
  kit: Kit;
  readOnly?: boolean;
}) {
  const c = useKitCopy();
  const ct = kit.content;
  if (!ct) return <Pending />;
  const personaName = (id: string) =>
    kit.strategy?.personas.find((p) => p.id === id)?.name ?? id;
  const copy = (text: string) =>
    readOnly ? null : <CopyButton text={text} size="iconSm" variant="ghost" />;
  const adsByChannel = Object.entries(
    ct.ads.reduce<Record<string, typeof ct.ads>>((acc, ad) => {
      (acc[ad.channel] ??= []).push(ad);
      return acc;
    }, {}),
  );
  return (
    <div className="space-y-5">
      <Panel title={c.content.listing}>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {c.content.titles}
            </p>
            <ol className="space-y-2">
              {ct.listing.titles.map((title, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-2xl bg-surface py-1 pl-4 pr-1"
                >
                  <span className="text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 py-2 text-sm font-medium">
                    {title}
                  </span>
                  {copy(title)}
                </li>
              ))}
            </ol>
          </div>
          {ct.listing.description && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.content.description}
                </p>
                {copy(ct.listing.description)}
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {ct.listing.description}
              </p>
            </div>
          )}
          <BulletList title={c.content.bullets} items={ct.listing.bullets} />
          {ct.listing.search_keywords.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c.content.keywords}
              </p>
              <TagList items={ct.listing.search_keywords} />
            </div>
          )}
        </div>
      </Panel>

      <Panel title={c.content.ads}>
        <div className="space-y-5">
          {adsByChannel.map(([channel, ads]) => (
            <div key={channel}>
              <p className="mb-2 text-sm font-semibold">
                {labelChannel(channel)}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {ads.map((ad) => (
                  <article
                    key={ad.id}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        <span className="font-mono">{ad.id}</span> ·{" "}
                        {c.content.for} {personaName(ad.persona_id)}
                      </span>
                      {copy(
                        `${ad.headline}\n\n${ad.primary_text}\n\n${ad.cta}`,
                      )}
                    </div>
                    <p className="font-display text-lg font-bold leading-tight">
                      {ad.headline}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                      {ad.primary_text}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {ad.cta && (
                        <span className="rounded-full bg-navy px-3 py-1 font-semibold text-cream">
                          {ad.cta}
                        </span>
                      )}
                      {ad.angle && (
                        <span className="text-muted-foreground">
                          {c.content.angle}: {ad.angle}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={c.content.social}>
        <div className="grid gap-3 md:grid-cols-2">
          {ct.social_posts.map((post, i) => {
            const full = `${post.text}${post.hashtags.length ? `\n\n${post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}` : ""}`;
            return (
              <article key={i} className="rounded-2xl bg-surface p-4">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                  <span>
                    {labelChannel(post.channel)} · {post.format}
                  </span>
                  {copy(full)}
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {post.text}
                </p>
                {post.hashtags.length > 0 && (
                  <p className="mt-2 text-sm text-coral-ink">
                    {post.hashtags
                      .map((h) => (h.startsWith("#") ? h : `#${h}`))
                      .join(" ")}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </Panel>

      {ct.image_ideas.length > 0 && (
        <Panel title={c.content.images}>
          <div className="grid gap-3 md:grid-cols-2">
            {ct.image_ideas.map((idea, i) => (
              <article key={i} className="rounded-2xl border border-border p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4 text-coral-ink" />
                  {idea.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {idea.description}
                </p>
                {idea.generation_prompt && (
                  <div className="mt-3 rounded-xl bg-secondary/70 p-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                      {c.content.prompt}
                      {copy(idea.generation_prompt)}
                    </div>
                    <p className="font-mono text-xs leading-relaxed">
                      {idea.generation_prompt}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
