import { campaignSchema, channelResultSchema, wizardDraftSchema } from "./schemas";
import { z } from "zod";
import { USE_MOCKS, delay, http, readLocal, uid, writeLocal } from "./api";
import { buildCampaign, seedCampaigns, seedNotifications } from "./mock-data";
import type {
  Campaign,
  ChannelResult,
  Notification,
  ResultsAnalysis,
  WizardDraft,
} from "./schemas";

const KEY = "campio:campaigns";
const NOTIF_KEY = "campio:notifications";
const GEN_KEY = "campio:generation";

function load(): Campaign[] {
  const list = readLocal<Campaign[] | null>(KEY, null);
  if (list) return list;
  const seeded = seedCampaigns();
  writeLocal(KEY, seeded);
  return seeded;
}
const save = (list: Campaign[]) => writeLocal(KEY, list);

function update(id: string, fn: (c: Campaign) => Campaign): Campaign {
  const list = load();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Campania nu a fost găsită.");
  const current = list[idx];
  if (!current) throw new Error("Campania nu a fost găsită.");
  const next = fn(current);
  list[idx] = next;
  save(list);
  return next;
}

export const GENERATION_STEPS = [
  { id: "analyze", ms: 1800 },
  { id: "audiences", ms: 1900 },
  { id: "panel", ms: 2800 },
  { id: "agent", ms: 2400 },
  { id: "assets", ms: 1800 },
] as const;
export const GENERATION_TOTAL_MS = GENERATION_STEPS.reduce((a, s) => a + s.ms, 0);

export interface GenerationStatus {
  id: string;
  stepIndex: number;
  progress: number;
  done: boolean;
  scores: { a: number; b: number; c: number };
}

export interface CampaignFilters {
  q?: string;
  status?: Campaign["status"] | "all";
}

export const campaignsService = {
  async list(filters: CampaignFilters = {}): Promise<Campaign[]> {
    if (!USE_MOCKS) {
      const p = new URLSearchParams(filters as Record<string, string>);
      return z.array(campaignSchema).parse(await http(`/campaigns?${p}`));
    }
    await delay(450);
    const q = filters.q?.toLowerCase().trim();
    return load()
      .filter((c) =>
        filters.status && filters.status !== "all" ? c.status === filters.status : true,
      )
      .filter((c) =>
        q ? `${c.product.name} ${c.product.category}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async get(id: string): Promise<Campaign> {
    if (!USE_MOCKS) return campaignSchema.parse(await http(`/campaigns/${id}`));
    await delay(500);
    const c = load().find((x) => x.id === id);
    if (!c) throw new Error("Campania nu a fost găsită.");
    return c;
  },

  async create(draft: WizardDraft): Promise<{ id: string }> {
    wizardDraftSchema.parse(draft);
    if (!USE_MOCKS) return http("/campaigns", { method: "POST", body: JSON.stringify(draft) });
    await delay(600);
    const id = uid("cmp");
    const c = buildCampaign(id, draft.product, {
      status: "generating",
      marketplaces: draft.marketplaces,
      goal: draft.goal,
      budget: draft.budget,
      tone: draft.tone,
      durationDays: draft.durationDays,
      health: 78,
    });
    save([c, ...load()]);
    const gen = readLocal<Record<string, number>>(GEN_KEY, {});
    gen[id] = Date.now();
    writeLocal(GEN_KEY, gen);
    return { id };
  },

  async generationStatus(id: string): Promise<GenerationStatus> {
    if (!USE_MOCKS) return http(`/campaigns/${id}/generation`);
    await delay(80);
    const started =
      readLocal<Record<string, number>>(GEN_KEY, {})[id] ?? Date.now() - GENERATION_TOTAL_MS;
    const elapsed = Date.now() - started;
    let acc = 0;
    let stepIndex: number = GENERATION_STEPS.length;
    for (let i = 0; i < GENERATION_STEPS.length; i++) {
      acc += GENERATION_STEPS[i]!.ms;
      if (elapsed < acc) {
        stepIndex = i;
        break;
      }
    }
    const progress = Math.min(1, elapsed / GENERATION_TOTAL_MS);
    const done = progress >= 1;
    if (done) {
      const c = load().find((x) => x.id === id);
      if (c?.status === "generating") update(id, (x) => ({ ...x, status: "ready" }));
    }
    const p = Math.min(1, Math.max(0, (elapsed - 3700) / 2800));
    return {
      id,
      stepIndex,
      progress,
      done,
      scores: { a: Math.round(52 * p), b: Math.round(39 * p), c: Math.round(34 * p) },
    };
  },

  async patch(id: string, patch: Partial<Campaign>): Promise<Campaign> {
    if (!USE_MOCKS)
      return http(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await delay(250);
    return update(id, (c) => ({ ...c, ...patch }));
  },

  async toggleWarning(id: string, warningId: string): Promise<Campaign> {
    if (!USE_MOCKS)
      return http(`/campaigns/${id}/warnings/${warningId}/toggle`, { method: "POST" });
    await delay(150);
    return update(id, (c) => ({
      ...c,
      warnings: c.warnings.map((w) => (w.id === warningId ? { ...w, resolved: !w.resolved } : w)),
    }));
  },

  async toggleAction(id: string, channelId: string, actionId: string): Promise<Campaign> {
    if (!USE_MOCKS)
      return http(`/campaigns/${id}/channels/${channelId}/actions/${actionId}/toggle`, {
        method: "POST",
      });
    await delay(150);
    const current = load()
      .find((c) => c.id === id)
      ?.channels.find((ch) => ch.id === channelId)
      ?.firstActions.find((a) => a.id === actionId);
    if (current && !current.done) {
      const activity = readLocal<string[]>("campio:activity", []);
      writeLocal("campio:activity", [...activity, new Date().toISOString()]);
    }
    return update(id, (c) => ({
      ...c,
      channels: c.channels.map((ch) =>
        ch.id === channelId
          ? {
              ...ch,
              firstActions: ch.firstActions.map((a) =>
                a.id === actionId ? { ...a, done: !a.done } : a,
              ),
            }
          : ch,
      ),
    }));
  },

  async saveResults(id: string, results: ChannelResult[]): Promise<ResultsAnalysis> {
    z.array(channelResultSchema).min(1).parse(results);
    if (!USE_MOCKS)
      return http(`/campaigns/${id}/results`, { method: "POST", body: JSON.stringify(results) });
    await delay(1200);
    const c = update(id, (x) => ({ ...x, results, status: "launched" }));
    return analyze(c, results);
  },

  async analysis(id: string): Promise<ResultsAnalysis | null> {
    if (!USE_MOCKS) return http(`/campaigns/${id}/results/analysis`);
    await delay(300);
    const c = load().find((x) => x.id === id);
    if (!c?.results) return null;
    return analyze(c, c.results);
  },

  async remove(id: string): Promise<void> {
    if (!USE_MOCKS) return http(`/campaigns/${id}`, { method: "DELETE" });
    await delay(300);
    save(load().filter((c) => c.id !== id));
  },

  async notifications(): Promise<Notification[]> {
    if (!USE_MOCKS) return http("/notifications");
    await delay(250);
    return readLocal<Notification[] | null>(NOTIF_KEY, null) ?? seedNotifications();
  },

  async markAllRead(): Promise<void> {
    if (!USE_MOCKS) return http("/notifications/read", { method: "POST" });
    const list = (readLocal<Notification[] | null>(NOTIF_KEY, null) ?? seedNotifications()).map(
      (n) => ({
        ...n,
        read: true,
      }),
    );
    writeLocal(NOTIF_KEY, list);
    await delay(150);
  },
};

function analyze(c: Campaign, results: ChannelResult[]): ResultsAnalysis {
  const sum = (k: keyof ChannelResult) =>
    results.reduce((a, r) => a + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
  const orders = sum("orders");
  const clicks = sum("clicks");
  const impressions = sum("impressions");
  const spent = sum("spent");
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const cpo = orders ? spent / orders : 0;
  const target = c.kpis[0]?.target ?? 28;
  const series = Array.from({ length: 6 }, (_, i) => {
    const t = (i + 1) / 6;
    return {
      day: `Z${Math.round(t * c.durationDays)}`,
      predicted: Math.round(target * t),
      actual: Math.round(orders * Math.pow(t, 1.15)),
    };
  });
  return {
    series,
    deltas: [
      { id: "orders", label: "Comenzi", predicted: target, actual: orders, unit: "" },
      {
        id: "ctr",
        label: "Rată de click",
        predicted: c.kpis[1]?.target ?? 1.8,
        actual: +ctr.toFixed(2),
        unit: "%",
      },
      {
        id: "cpo",
        label: "Cost per comandă",
        predicted: c.kpis[2]?.target ?? 14,
        actual: +cpo.toFixed(1),
        unit: "lei",
      },
    ],
    suggestions: buildSuggestions(c, results, { orders, clicks, impressions, spent, ctr }),
  };
}

function buildSuggestions(
  c: Campaign,
  results: ChannelResult[],
  totals: { orders: number; clicks: number; impressions: number; spent: number; ctr: number },
): ResultsAnalysis["suggestions"] {
  const paid = c.channels
    .filter((ch) => ch.type === "paid")
    .map((ch) => ({ channel: ch, metrics: results.find((r) => r.channelId === ch.id) }))
    .filter(
      (item): item is { channel: Campaign["channels"][number]; metrics: ChannelResult } =>
        !!item.metrics,
    );
  const withOrders = paid
    .filter((item) => item.metrics.orders > 0)
    .sort((a, b) => a.metrics.spent / a.metrics.orders - b.metrics.spent / b.metrics.orders);
  const best = withOrders[0];
  const first = best
    ? {
        id: "s1",
        title: `Testează o creștere graduală a bugetului pe ${best.channel.channel}`,
        body: `Costul observat este ${(best.metrics.spent / best.metrics.orders).toFixed(2)} lei pe comandă, pentru ${best.metrics.orders} comenzi. Încearcă o creștere de 10–15% și compară din nou după o săptămână. E o sugestie calculată din datele introduse, nu o garanție.`,
        impact: "mare" as const,
      }
    : {
        id: "s1",
        title: totals.impressions
          ? "Verifică drumul de la reclamă la comandă"
          : "Adaugă primele rezultate din platforme",
        body: totals.impressions
          ? "Nu ai înregistrat comenzi pe canalele plătite. Verifică pagina produsului, prețul, livrarea și funcționarea comenzii înainte să crești bugetul."
          : "Avem nevoie de afișări, click-uri și comenzi reale ca să comparăm canalele. Publică primul material și revino cu datele după câteva zile.",
        impact: "mare" as const,
      };
  const second =
    totals.clicks > 0 && totals.orders === 0
      ? {
          id: "s2",
          title: "Arată prețul și livrarea înainte de click",
          body: `Ai introdus ${totals.clicks} click-uri fără comenzi. Testează o variantă care explică prețul, punctele forte și condițiile de livrare. Nu putem stabili cauza doar din aceste cifre.`,
          impact: "mediu" as const,
        }
      : {
          id: "s2",
          title: "Testează un singur element al mesajului",
          body: `Păstrează produsul ${c.product.name} și același public, apoi compară două începuturi de text. Urmărește rata de click și costul pe comandă pentru fiecare variantă.`,
          impact: "mediu" as const,
        };
  return [
    first,
    second,
    {
      id: "s3",
      title: "Construiește următoarea rundă pe datele tale",
      body: "Reia campania cu aceleași setări, păstrează ce a funcționat și schimbă o singură variabilă. Adaugă rezultatele după aceeași perioadă, pentru o comparație utilă.",
      impact: "mic" as const,
    },
  ];
}
