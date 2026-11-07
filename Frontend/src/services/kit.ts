import { z } from "zod";

/**
 * Zod mirror of the backend contract (Backend/openapi.yaml → components.schemas).
 * Arrays default to [] because Go encodes nil slices as null; objects use
 * passthrough so new backend fields never break parsing.
 */
const arr = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((v) => v ?? []);
const strings = arr(z.string());
const num = z
  .number()
  .nullish()
  .transform((v) => v ?? 0);
const str = z
  .string()
  .nullish()
  .transform((v) => v ?? "");

export const kitStatusSchema = z.enum([
  "pending",
  "running",
  "needs_input",
  "completed",
  "failed",
]);
export type KitStatus = z.infer<typeof kitStatusSchema>;

export const KIT_STEPS = [
  "intake",
  "market",
  "strategy",
  "content",
  "plan",
] as const;
export type KitStep = (typeof KIT_STEPS)[number];

/* ---------- Input & intake ---------- */
export const kitInputSchema = z
  .object({
    prompt: str,
    image_asset_ids: strings,
    product_name: str,
    keyword: str,
    keyword_en: str,
    subreddits: strings,
    product_description: str,
    sale_price: num,
    ad_budget_ron: num,
    brand_name: str,
    language: z.string().optional(),
  })
  .passthrough();
export type KitInput = z.infer<typeof kitInputSchema>;

export const questionSchema = z
  .object({
    id: z.string(),
    field: str,
    text: z.string(),
    kind: z.string(),
    unit: str,
    required: z.boolean(),
    hint: str,
    options: arr(z.object({ label: z.string(), value: z.string() })),
  })
  .passthrough();
export type Question = z.infer<typeof questionSchema>;

export const answerSchema = z
  .object({
    question_id: str,
    field: str,
    question: str,
    value: str,
    skipped: z.boolean().default(false),
    round: num,
    at: str,
  })
  .passthrough();
export type Answer = z.infer<typeof answerSchema>;

export const intakeSchema = z
  .object({
    round: num,
    questions: arr(questionSchema),
    answers: arr(answerSchema),
    assumptions: strings,
  })
  .passthrough();

export const stepInfoSchema = z.object({
  step: z.string(),
  status: z.string(),
  duration_ms: num,
});
export type StepInfo = z.infer<typeof stepInfoSchema>;

/* ---------- Market & trends ---------- */
export const productSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    url: str,
    image_url: str,
    brand: str,
    seller: str,
    price: num,
    rating: num,
    review_count: num,
    position: num,
  })
  .passthrough();
export type MarketProduct = z.infer<typeof productSchema>;

export const marketStatsSchema = z
  .object({
    competitor_count: num,
    known_seller_count: num,
    price_min: num,
    price_p25: num,
    price_median: num,
    price_p75: num,
    price_max: num,
    price_avg: num,
    avg_rating: num,
    total_reviews: num,
    top3_review_share_pct: num,
    est_market_units_month: num,
    top_sellers: arr(
      z.object({
        name: z.string(),
        product_count: num,
        review_count: num,
        review_share_pct: num,
      }),
    ),
    price_histogram: arr(z.object({ from: num, to: num, count: num })),
  })
  .passthrough();
export type MarketStats = z.infer<typeof marketStatsSchema>;

export const marketBlockSchema = z
  .object({
    source: str,
    fetched_at: str,
    fallback_note: str,
    stats: marketStatsSchema,
    reviews_analyzed: num,
    price_vs_median_pct: num,
    competitors: arr(productSchema),
  })
  .passthrough();
export type MarketBlock = z.infer<typeof marketBlockSchema>;

export const trendBlockSchema = z
  .object({
    source: str,
    fetched_at: str,
    fallback_note: str,
    stats: z
      .object({
        direction: z.string().default("unknown"),
        yoy_change_pct: num,
        last_12_month_avg: num,
        prev_12_month_avg: num,
        peak_month: str,
        yearly: arr(z.object({ year: num, value: num })),
      })
      .passthrough(),
    monthly: arr(z.object({ month: z.string(), value: num })),
  })
  .passthrough();
export type TrendBlock = z.infer<typeof trendBlockSchema>;

/* ---------- Outside eMAG ---------- */
export const webSourceSchema = z.object({
  name: z.string(),
  status: z.string(),
  items: num,
  note: str,
});
export type WebSource = z.infer<typeof webSourceSchema>;

export const webBlockSchema = z
  .object({
    source: str,
    fetched_at: str,
    query: str,
    subreddits: strings,
    sources: arr(webSourceSchema),
    stats: z
      .object({
        amazon: z
          .object({
            product_count: num,
            priced_count: num,
            currency: str,
            price_min: num,
            price_median: num,
            price_max: num,
            price_median_ron: num,
            avg_rating: num,
            total_reviews: num,
            sponsored_pct: num,
            emag_vs_amazon_pct: num,
          })
          .passthrough(),
        reddit: z
          .object({
            post_count: num,
            comment_count: num,
            total_score: num,
            total_replies: num,
            last_12_months: num,
            last_12_months_pct: num,
            first_date: str,
            last_date: str,
            subreddits: arr(
              z.object({
                name: z.string(),
                posts: num,
                comments: num,
                score: num,
              }),
            ),
          })
          .passthrough(),
        launches: z.object({ found: num, relevant: num }).passthrough(),
      })
      .passthrough(),
    amazon: arr(
      z
        .object({
          id: z.string(),
          title: z.string(),
          url: str,
          image_url: str,
          price: num,
          currency: str,
          rating: num,
          review_count: num,
          sponsored: z.boolean().default(false),
          position: num,
        })
        .passthrough(),
    ),
    discussions: arr(
      z
        .object({
          id: z.string(),
          kind: z.string(),
          subreddit: z.string(),
          title: str,
          text: str,
          url: str,
          score: num,
          num_comments: num,
          date: str,
        })
        .passthrough(),
    ),
    launches: arr(
      z.object({
        id: z.string(),
        name: z.string(),
        tagline: str,
        url: str,
        image_url: str,
      }),
    ),
  })
  .passthrough();
export type WebBlock = z.infer<typeof webBlockSchema>;

/* ---------- Strategy ---------- */
export const personaSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    age_range: str,
    occupation: str,
    description: str,
    motivations: strings,
    pain_points: strings,
    channels: strings,
    buying_triggers: strings,
    objections: strings,
    message_hook: str,
  })
  .passthrough();
export type Persona = z.infer<typeof personaSchema>;

export const strategySchema = z
  .object({
    summary: str,
    complaints: arr(
      z
        .object({
          theme: z.string(),
          mentions: num,
          severity: str,
          quotes: strings,
          opportunity: str,
          source: str,
        })
        .passthrough(),
    ),
    personas: arr(personaSchema),
    positioning: z
      .object({
        statement: str,
        main_message: str,
        tone: str,
        proof_points: strings,
        messages: arr(
          z.object({ complaint_theme: str, message: str, proof_claim: str }),
        ),
      })
      .passthrough(),
  })
  .passthrough();
export type Strategy = z.infer<typeof strategySchema>;

/* ---------- Content ---------- */
export const shotSchema = z.object({
  description: str,
  video_prompt: str,
  duration_s: num,
  caption: str,
});
export const videoConceptSchema = z
  .object({
    id: z.string(),
    title: str,
    persona_id: str,
    hook: str,
    shots: arr(shotSchema),
    end_card_lines: strings,
    music_mood: str,
  })
  .passthrough();
export type VideoConcept = z.infer<typeof videoConceptSchema>;

export const contentSchema = z
  .object({
    listing: z
      .object({
        titles: strings,
        description: str,
        bullets: strings,
        search_keywords: strings,
      })
      .passthrough(),
    ads: arr(
      z
        .object({
          id: z.string(),
          persona_id: str,
          channel: str,
          angle: str,
          headline: str,
          primary_text: str,
          cta: str,
        })
        .passthrough(),
    ),
    social_posts: arr(
      z
        .object({ channel: str, format: str, text: str, hashtags: strings })
        .passthrough(),
    ),
    image_ideas: arr(
      z.object({ title: str, description: str, generation_prompt: str }),
    ),
    video_concepts: arr(videoConceptSchema),
  })
  .passthrough();
export type Content = z.infer<typeof contentSchema>;

/* ---------- Plan ---------- */
export const channelEstimateSchema = z
  .object({
    channel: z.string(),
    label: str,
    share_pct: num,
    budget_ron: num,
    weekly_budget_ron: num,
    est_impressions: num,
    est_clicks: num,
    est_orders: num,
    est_revenue_ron: num,
    roas: num,
    cpc_ron: num,
    cpa_ron: num,
  })
  .passthrough();
export type ChannelEstimate = z.infer<typeof channelEstimateSchema>;

export const channelPlanSchema = channelEstimateSchema.extend({
  rationale: str,
  formats: strings,
});
export type ChannelPlan = z.infer<typeof channelPlanSchema>;

export const totalsSchema = z
  .object({
    budget_ron: num,
    est_impressions: num,
    est_clicks: num,
    est_orders: num,
    est_revenue_ron: num,
    roas: num,
    cpa_ron: num,
  })
  .passthrough();
export type BudgetTotals = z.infer<typeof totalsSchema>;

export const abTestSchema = z
  .object({
    id: z.string(),
    name: str,
    hypothesis: str,
    channel: str,
    metric: str,
    variant_a: str,
    variant_b: str,
    decision_rule: str,
    sizing: z
      .object({
        metric: str,
        sample_unit: str,
        baseline_rate_pct: num,
        min_detectable_lift_pct: num,
        sample_per_variant: num,
        est_cost_ron: num,
        est_days: num,
        feasible_in_campaign: z.boolean().default(false),
      })
      .passthrough(),
  })
  .passthrough();
export type ABTest = z.infer<typeof abTestSchema>;

export const planSchema = z
  .object({
    channels: arr(channelPlanSchema),
    totals: totalsSchema,
    calendar: arr(
      z
        .object({
          week: num,
          theme: str,
          goal: str,
          actions: arr(
            z
              .object({
                day: str,
                channel: str,
                action: str,
                content_refs: strings,
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
    ab_tests: arr(abTestSchema),
    kpis: strings,
  })
  .passthrough();
export type Plan = z.infer<typeof planSchema>;

export const costSchema = z
  .object({
    scraper_cost_usd: num,
    pages_fetched: num,
    ai_text_cost_usd: num,
    video_cost_usd: num,
    editing_cost_usd: num,
    total_cost_usd: num,
    total_cost_ron: num,
    ad_budget_ron: num,
    cost_pct_of_budget: num,
    usd_to_ron: num,
  })
  .passthrough();
export type CostSummary = z.infer<typeof costSchema>;

/* ---------- Kit ---------- */
export const kitSchema = z
  .object({
    id: z.string(),
    created_at: z.string(),
    updated_at: str,
    status: kitStatusSchema,
    step: str,
    error: str,
    steps: arr(stepInfoSchema),
    input: kitInputSchema,
    intake: intakeSchema
      .nullish()
      .transform(
        (v) => v ?? { round: 0, questions: [], answers: [], assumptions: [] },
      ),
    market: marketBlockSchema.nullish(),
    trend: trendBlockSchema.nullish(),
    web: webBlockSchema.nullish(),
    strategy: strategySchema.nullish(),
    content: contentSchema.nullish(),
    plan: planSchema.nullish(),
    ai_model: str,
    cost: costSchema.nullish(),
    ui_data: z
      .record(z.unknown())
      .nullish()
      .transform((v) => v ?? {}),
  })
  .passthrough();
export type Kit = z.infer<typeof kitSchema>;

export const isKitActive = (status: KitStatus) =>
  status === "running" || status === "pending";

export const campaignSummarySchema = z.object({
  id: z.string(),
  created_at: z.string(),
  status: kitStatusSchema,
  step: str,
  product_name: str,
  keyword: str,
});
export type CampaignSummary = z.infer<typeof campaignSummarySchema>;

export const campaignListSchema = z.object({
  items: arr(campaignSummarySchema),
  total: num,
  limit: num,
  offset: num,
});

/* ---------- Budget simulation ---------- */
export const budgetSimulationSchema = z
  .object({
    total_budget_ron: num,
    shares: z
      .record(z.number())
      .nullish()
      .transform((v) => v ?? {}),
    channels: arr(channelEstimateSchema),
    totals: totalsSchema,
  })
  .passthrough();
export type BudgetSimulation = z.infer<typeof budgetSimulationSchema>;

/* ---------- Media ---------- */
export const assetSchema = z
  .object({
    id: z.string(),
    campaign_id: z.string(),
    created_at: str,
    kind: z.string(),
    role: str,
    status: z.string(),
    name: str,
    mime: str,
    size_bytes: num,
    duration_s: num,
    width: num,
    height: num,
    cost_usd: num,
    meta: z
      .object({
        model: str,
        concept_id: str,
        shot_index: num,
        caption: str,
        title: str,
        notes: str,
        edit_id: str,
        estimated_cost_usd: num,
      })
      .passthrough()
      .nullish()
      .transform(
        (v) =>
          v ?? {
            model: "",
            concept_id: "",
            shot_index: 0,
            caption: "",
            title: "",
            notes: "",
            edit_id: "",
            estimated_cost_usd: 0,
          },
      ),
    error: str,
    content_url: str,
  })
  .passthrough();
export type Asset = z.infer<typeof assetSchema>;
export const isAssetActive = (a: Asset) =>
  a.status === "pending" || a.status === "in_progress";

export const editSchema = z
  .object({
    id: z.string(),
    campaign_id: z.string(),
    created_at: str,
    status: z.string(),
    instructions: str,
    input_asset_ids: strings,
    steps: arr(
      z.object({
        at: str,
        type: z.string(),
        content: str,
        data: z.unknown().optional(),
      }),
    ),
    output_asset_id: z.string().nullish(),
    title: str,
    notes: str,
    cost_usd: num,
    error: str,
  })
  .passthrough();
export type Edit = z.infer<typeof editSchema>;

export const videoModelListSchema = z.object({
  default_model: str,
  default_resolution: str,
  default_aspect_ratio: str,
  items: arr(
    z
      .object({
        id: z.string(),
        name: str,
        price_per_second_usd: z
          .record(z.number())
          .nullish()
          .transform((v) => v ?? {}),
        cheapest_per_second_usd: z.number().nullish(),
        supported_resolutions: z.array(z.string()).nullish(),
      })
      .passthrough(),
  ),
});
export type VideoModelList = z.infer<typeof videoModelListSchema>;

/* ---------- Chat ---------- */
export const chatMessageSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    role: z.enum(["user", "assistant"]),
    content: str,
    simulations: arr(budgetSimulationSchema),
    created_at: str,
  })
  .passthrough();
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatReplySchema = z.object({
  user_message: chatMessageSchema,
  assistant_message: chatMessageSchema,
  simulations: arr(budgetSimulationSchema),
});
export type ChatReply = z.infer<typeof chatReplySchema>;

export const demoCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: str,
  prompt: z.string(),
});
export type DemoCase = z.infer<typeof demoCaseSchema>;

/** Price per second for the chosen resolution (falls back to "default", then the cheapest). */
export function pricePerSecond(
  model: VideoModelList["items"][number] | undefined,
  resolution: string,
): number | null {
  if (!model) return null;
  const p = model.price_per_second_usd;
  return p[resolution] ?? p["default"] ?? model.cheapest_per_second_usd ?? null;
}
