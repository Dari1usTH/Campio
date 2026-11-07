import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/campio/Field";
import { campaignsService } from "@/services/campaigns";
import { campaignKeys, messagesQuery } from "@/services/queries";
import type { BudgetSimulation, ChatMessage, Kit } from "@/services/kit";
import { fmt } from "@/i18n";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import { labelChannel } from "./StrategyTabs";
import { Notice, Panel, dec, int, lei, pct, usd } from "./ui";

export function CostTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const cost = kit.cost;
  if (!cost) return <Notice>{c.pending}</Notice>;
  const rows: [string, number, string?][] = [
    [
      c.cost.scraper,
      cost.scraper_cost_usd,
      `${int(cost.pages_fetched)} ${c.cost.pages}`,
    ],
    [c.cost.aiText, cost.ai_text_cost_usd],
    [c.cost.video, cost.video_cost_usd],
    [c.cost.posters, cost.poster_cost_usd],
    [c.cost.editing, cost.editing_cost_usd],
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] bg-gradient-navy p-6 text-navy-foreground md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/60">
          {c.cost.title}
        </p>
        <p className="mt-3 font-display text-2xl font-bold leading-snug md:text-3xl">
          {fmt(c.cost.sentence, {
            ron: dec(cost.total_cost_ron, 2),
            pct: dec(cost.cost_pct_of_budget, 2),
          })}
        </p>
      </section>
      <Panel>
        <ul className="divide-y divide-border text-sm">
          {rows.map(([label, value, sub]) => (
            <li
              key={label}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span>
                {label}
                {sub && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {sub}
                  </span>
                )}
              </span>
              <span className="tabular-nums">{usd(value)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-3 font-semibold">
            <span>{c.cost.total}</span>
            <span className="tabular-nums">
              {usd(cost.total_cost_usd)} ≈ {lei(cost.total_cost_ron, 2)}
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {c.cost.rate}: 1 USD = {dec(cost.usd_to_ron, 2)} lei
          {kit.ai_model && ` · ${c.cost.model}: ${kit.ai_model}`}
        </p>
      </Panel>
    </div>
  );
}

export function SimulationCard({ sim }: { sim: BudgetSimulation }) {
  const c = useKitCopy();
  return (
    <div className="mt-2 rounded-2xl border border-border bg-card p-3 text-xs">
      <p className="mb-2 font-semibold">
        {c.chat.simulation} · {lei(sim.total_budget_ron)}
      </p>
      <ul className="space-y-1">
        {sim.channels.map((ch) => (
          <li key={ch.channel} className="flex justify-between gap-2">
            <span>
              {ch.label || labelChannel(ch.channel)} · {pct(ch.share_pct)}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {lei(ch.budget_ron)} → {dec(ch.est_orders)}{" "}
              {c.plan.colOrders.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-border pt-2 font-semibold">
        {c.plan.total}: {int(sim.totals.est_clicks)}{" "}
        {c.plan.colClicks.toLowerCase()} · {dec(sim.totals.est_orders)}{" "}
        {c.plan.colOrders.toLowerCase()} · ROAS {dec(sim.totals.roas, 2)}
      </p>
    </div>
  );
}

/** Minimal, safe Markdown: **bold** and line breaks only (no HTML injection). */
function Markdownish({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            part
          ),
        )}
    </div>
  );
}

export function ChatTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const qc = useQueryClient();
  const ready = kit.status === "completed";
  const history = useQuery({ ...messagesQuery(kit.id), enabled: ready });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<{
    user: string;
    text: string;
    sims: BudgetSimulation[];
  } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const send = useMutation({
    mutationFn: (message: string) => {
      setPending({ user: message, text: "", sims: [] });
      return campaignsService.sendMessage(kit.id, message, {
        onToken: (t) => setPending((p) => (p ? { ...p, text: p.text + t } : p)),
        onSimulation: (s) =>
          setPending((p) => (p ? { ...p, sims: [...p.sims, s] } : p)),
      });
    },
    onSuccess: (reply) => {
      qc.setQueryData<ChatMessage[]>(campaignKeys.messages(kit.id), (old) => [
        ...(old ?? []),
        reply.user_message,
        {
          ...reply.assistant_message,
          simulations: reply.assistant_message.simulations.length
            ? reply.assistant_message.simulations
            : reply.simulations,
        },
      ]);
      setPending(null);
      void qc.invalidateQueries({ queryKey: campaignKeys.detail(kit.id) });
    },
    onError: (e, message) => {
      setPending(null);
      setInput(message);
      return e;
    },
  });
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [history.data?.length, pending?.text, pending?.sims.length]);
  if (!ready) return <Notice>{c.chat.notReady}</Notice>;
  const messages = history.data ?? [];
  const submit = () => {
    const text = input.trim();
    if (!text || send.isPending) return;
    setInput("");
    send.mutate(text);
  };
  return (
    <Panel title={c.chat.title}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{c.chat.sub}</p>
      <div
        className="max-h-[32rem] min-h-40 space-y-4 overflow-y-auto rounded-2xl bg-surface p-4"
        aria-live="polite"
      >
        {history.isPending ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : messages.length === 0 && !pending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {c.chat.empty}
          </p>
        ) : null}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            role={m.role}
            text={m.content}
            sims={m.simulations}
          />
        ))}
        {pending && (
          <>
            <Bubble role="user" text={pending.user} sims={[]} />
            <Bubble
              role="assistant"
              text={pending.text}
              sims={pending.sims}
              typing={!pending.text}
            />
          </>
        )}
        <div ref={end} />
      </div>
      {send.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {send.error.message}
        </p>
      )}
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextArea
          aria-label={c.chat.title}
          className="min-h-12 flex-1"
          rows={2}
          maxLength={4000}
          placeholder={c.chat.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="submit"
          variant="coral"
          size="icon"
          aria-label={c.chat.send}
          disabled={send.isPending || !input.trim()}
        >
          {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </Panel>
  );
}

function Bubble({
  role,
  text,
  sims,
  typing,
}: {
  role: "user" | "assistant";
  text: string;
  sims: BudgetSimulation[];
  typing?: boolean;
}) {
  const mine = role === "user";
  return (
    <div className={cn("flex gap-2", mine && "flex-row-reverse")}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          mine ? "bg-navy text-cream" : "bg-coral-tint text-coral-ink",
        )}
      >
        {mine ? <UserRound className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          mine ? "bg-navy text-cream" : "bg-card shadow-soft",
        )}
      >
        {typing ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <Markdownish text={text} />
        )}
        {sims.map((s, i) => (
          <SimulationCard key={i} sim={s} />
        ))}
      </div>
    </div>
  );
}
