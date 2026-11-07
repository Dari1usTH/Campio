import { describe, expect, it } from "vitest";
import {
  computeMessageScore,
  COST_PER_CAMPAIGN_USD,
  DEFAULT_BUDGET_RON,
  SCORE_WEIGHTS,
} from "@/lib/scoring";
import { allocateBudget, buildCampaign, seedCampaigns } from "@/services/mock-data";
import { parseProductTextLocal } from "@/services/wizard";
import { campaignSchema, type Product } from "@/services/schemas";

const coffee: Product = {
  name: "Cafea Atlas",
  category: "Alimente",
  price: 59.9,
  currency: "RON",
  shortDescription: "Cafea boabe prăjită în București, pachet de 250 g.",
  strengths: ["Prăjită în București", "Pachet de 250 g"],
  audience: "Iubitorii de cafea de specialitate",
  country: "România",
};

describe("Campaign score and defaults", () => {
  it("weights click 50%, stopping 30% and sharing 20%, rounded once", () => {
    expect(SCORE_WEIGHTS.click + SCORE_WEIGHTS.stop + SCORE_WEIGHTS.share).toBe(1);
    expect(computeMessageScore({ click: 100, stop: 0, share: 0 })).toBe(50);
    expect(computeMessageScore({ click: 0, stop: 100, share: 0 })).toBe(30);
    expect(computeMessageScore({ click: 0, stop: 0, share: 100 })).toBe(20);
    expect(computeMessageScore({ click: 55, stop: 50, share: 48 })).toBe(52);
    expect(computeMessageScore({ click: 100, stop: 100, share: 100 })).toBe(100);
  });

  it("uses the agreed default campaign budget and transparent simulated cost", () => {
    const campaign = buildCampaign("test-coffee", coffee);
    expect(campaign.budget).toBe(DEFAULT_BUDGET_RON);
    expect(DEFAULT_BUDGET_RON).toBe(500);
    expect(campaign.costUsd).toEqual(COST_PER_CAMPAIGN_USD);
  });
});

describe("Product parsing", () => {
  it.each([
    ["Vând o cană handmade la 89.99 RON pentru iubitorii de cafea.", 89.99, "RON", "Cană handmade"],
    ["Vând o cană handmade la 89,99 lei pentru iubitorii de cafea.", 89.99, "RON", "Cană handmade"],
    ["Vând o cană handmade la 25.50 euro pentru iubitorii de cafea.", 25.5, "EUR", "Cană handmade"],
    ["Vând o cană handmade la 20 USD pentru iubitorii de cafea.", 20, "USD", "Cană handmade"],
    [
      "Vând o cană handmade la 1.299,99 lei pentru iubitorii de cafea.",
      1299.99,
      "RON",
      "Cană handmade",
    ],
  ])("preserves decimal price and currency for %s", (text, price, currency, name) => {
    const parsed = parseProductTextLocal(text);
    expect(parsed.product.price).toBe(price);
    expect(parsed.product.currency).toBe(currency);
    expect(parsed.product.name).toBe(name);
    expect(parsed.product.name).not.toMatch(/89|25|20|1\.299/);
    expect(parsed.aiFields).toContain("price");
    expect(parsed.missing).not.toContain("price");
  });

  it("flags a missing price instead of inventing one", () => {
    const result = parseProductTextLocal(
      "Vând săpun presat la rece, natural, pentru iubitorii de lavandă.",
    );
    expect(result.product.price).toBeNull();
    expect(result.missing).toContain("price");
    expect(result.product.category).toBe("Cosmetice");
    expect(result.product.strengths).toContain("Ingrediente naturale");
    expect(result.product.audience).toContain("iubitorii de lavandă");
  });
});

describe("Mock campaign relevance and budget", () => {
  it("builds a complete schema-valid campaign around the actual product", () => {
    const campaign = buildCampaign("test-coffee", coffee, {
      budget: 725,
      tone: "direct",
      durationDays: 14,
    });
    expect(campaignSchema.safeParse(campaign).success).toBe(true);
    expect(campaign.keyMessage).toContain(coffee.name);
    expect(campaign.copy.instagram.caption).toContain(coffee.shortDescription);
    expect(campaign.copy.tiktok.hook).toContain(coffee.name);
    expect(campaign.copy.meta.primaryText).toContain("59,9 lei");
    expect(JSON.stringify(campaign)).not.toMatch(/lumânar|ceară|flacără|45 de ore/i);
    expect(campaign.kpis[0]?.hint).toContain("14 zile");
    expect(campaign.channels.reduce((sum, channel) => sum + channel.budget, 0)).toBe(725);
    expect(campaign.messages.filter((message) => message.isWinner)).toHaveLength(1);
    for (const message of campaign.messages)
      expect(message.score).toBe(computeMessageScore(message));
  });

  it("keeps the rich candle demo and the selected budget on every seeded campaign", () => {
    const seeds = seedCampaigns();
    const candle = seeds.find((campaign) => campaign.id === "demo-lumanare");
    expect(candle?.keyMessage).toContain("flacără");
    expect(candle?.isDemo).toBe(true);
    for (const campaign of seeds) {
      expect(campaignSchema.safeParse(campaign).success).toBe(true);
      expect(campaign.channels.reduce((sum, channel) => sum + channel.budget, 0)).toBe(
        campaign.budget,
      );
    }
  });

  it("allocates odd budgets exactly and leaves free channels free", () => {
    const base = buildCampaign("test-coffee", coffee);
    const channels = allocateBudget(base.channels, 137);
    expect(channels.reduce((sum, channel) => sum + channel.budget, 0)).toBe(137);
    expect(channels.find((channel) => channel.id === "c3")?.budget).toBe(0);
  });

  it("keeps missing prices honest in generated text", () => {
    const campaign = buildCampaign("test-no-price", { ...coffee, price: null });
    expect(campaign.copy.instagram.caption).toContain("Cere detalii despre preț");
    expect(campaign.copy.instagram.caption).not.toContain("89 lei");
    expect(campaign.warnings[0]?.title).toContain("Completează prețul");
  });

  it("changes tone while preserving the selected campaign goal and stable KPI identifiers", () => {
    const playful = buildCampaign("playful", coffee, { tone: "playful", goal: "awareness" });
    const premium = buildCampaign("premium", coffee, { tone: "premium", goal: "sales" });
    expect(playful.keyMessage).toContain("îți face cu ochiul");
    expect(premium.keyMessage).toContain("Detaliile fac diferența");
    expect(playful.copy.meta.cta).toBe("Descoperă povestea");
    expect(playful.goal).toBe("awareness");
    expect(playful.kpis.map((kpi) => kpi.id)).toEqual(["orders", "ctr", "cpo"]);
  });
});
