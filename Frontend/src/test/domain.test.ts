import { describe, expect, it } from "vitest";
import {
  kitSchema,
  campaignListSchema,
  pricePerSecond,
  isKitActive,
} from "@/services/kit";
import completed from "./fixtures/kit-completed.json";

const needsInput = {
  id: "8f6f2c1e-1111-4c55-9a4e-1f0f7d2b9a11",
  created_at: "2026-11-07T09:00:00Z",
  updated_at: "2026-11-07T09:00:05Z",
  status: "needs_input",
  step: "intake",
  steps: [{ step: "intake", status: "waiting", duration_ms: 2100 }],
  input: {
    prompt: "Huse iPhone 16",
    image_asset_ids: null,
    product_name: "Husă iPhone 16",
    keyword: "husa iphone 16",
    keyword_en: "iphone 16 case",
    subreddits: null,
    sale_price: 0,
    ad_budget_ron: 0,
  },
  intake: {
    round: 1,
    questions: [
      {
        id: "q1_1",
        field: "sale_price",
        text: "La ce preț vinzi?",
        kind: "number",
        unit: "lei",
        required: false,
        hint: "Median eMAG: 49 lei",
        options: [{ label: "49 lei (median eMAG)", value: "49" }],
      },
    ],
    answers: null,
    assumptions: null,
  },
  market: null,
  trend: null,
  web: null,
  strategy: null,
  content: null,
  plan: null,
  ai_model: "",
  cost: {
    scraper_cost_usd: 0,
    pages_fetched: 0,
    ai_text_cost_usd: 0,
    video_cost_usd: 0,
    editing_cost_usd: 0,
    total_cost_usd: 0,
    total_cost_ron: 0,
    ad_budget_ron: 0,
    cost_pct_of_budget: 0,
    usd_to_ron: 4.6,
  },
  ui_data: null,
};

describe("Kit contract (Backend/openapi.yaml)", () => {
  it("parses the documented completed kit with every section", () => {
    const kit = kitSchema.parse(completed);
    expect(kit.status).toBe("completed");
    expect(kit.market?.stats.price_median).toBe(71.39);
    expect(kit.web?.sources.map((s) => s.name)).toEqual([
      "amazon",
      "reddit",
      "betalist",
    ]);
    expect(kit.strategy?.complaints[0]?.source).toBe("emag_reviews");
    expect(kit.content?.video_concepts[0]?.shots[0]?.duration_s).toBe(4);
    expect(kit.plan?.ab_tests[0]?.sizing.feasible_in_campaign).toBe(true);
    expect(kit.cost?.cost_pct_of_budget).toBeCloseTo(0.0514, 3);
  });

  it("accepts a partial kit waiting for answers (null sections and nil slices)", () => {
    const kit = kitSchema.parse(needsInput);
    expect(isKitActive(kit.status)).toBe(false);
    expect(kit.input.image_asset_ids).toEqual([]);
    expect(kit.intake.answers).toEqual([]);
    expect(kit.intake.questions[0]?.options[0]?.value).toBe("49");
    expect(kit.market).toBeNull();
    expect(kit.ui_data).toEqual({});
  });

  it("rejects malformed records", () => {
    expect(kitSchema.safeParse({ id: "x" }).success).toBe(false);
    expect(
      kitSchema.safeParse({ ...needsInput, status: "ready" }).success,
    ).toBe(false);
  });

  it("parses campaign list summaries", () => {
    const list = campaignListSchema.parse({
      items: [
        {
          id: "a",
          created_at: "2026-11-07T09:00:00Z",
          status: "running",
          step: "market",
          product_name: "",
          keyword: "",
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });
    expect(list.items[0]?.status).toBe("running");
  });

  it("prices videos per resolution, then default, then cheapest", () => {
    const m = {
      id: "m",
      name: "M",
      price_per_second_usd: { "480p": 0.02, default: 0.05 },
      cheapest_per_second_usd: 0.01,
    };
    expect(pricePerSecond(m, "480p")).toBe(0.02);
    expect(pricePerSecond(m, "720p")).toBe(0.05);
    expect(pricePerSecond({ ...m, price_per_second_usd: {} }, "720p")).toBe(
      0.01,
    );
    expect(pricePerSecond(undefined, "480p")).toBeNull();
  });
});
