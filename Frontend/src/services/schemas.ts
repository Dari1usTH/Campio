import { z } from "zod";

/* ---------- Primitives ---------- */
export const platformSchema = z.enum([
  "instagram",
  "pinterest",
  "tiktok",
  "facebook",
  "email",
  "google",
]);
export type Platform = z.infer<typeof platformSchema>;

export const marketplaceSchema = z.enum([
  "emag",
  "trendyol",
  "etsy",
  "amazon",
  "olx",
  "facebook_marketplace",
  "shopify",
  "instagram_shop",
]);
export type Marketplace = z.infer<typeof marketplaceSchema>;

export const goalSchema = z.enum(["sales", "awareness", "traffic"]);
export type Goal = z.infer<typeof goalSchema>;

export const toneSchema = z.enum(["warm", "premium", "playful", "direct"]);
export type Tone = z.infer<typeof toneSchema>;

export const campaignStatusSchema = z.enum(["draft", "generating", "ready", "launched"]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

/* ---------- Product ---------- */
export const productSchema = z.object({
  name: z.string(),
  category: z.string(),
  price: z.number().nullable(),
  currency: z.string().default("RON"),
  shortDescription: z.string(),
  strengths: z.array(z.string()),
  audience: z.string(),
  country: z.string(),
  link: z.string().optional(),
  photoUrl: z.string().optional(),
});
export type Product = z.infer<typeof productSchema>;

/* ---------- Campaign building blocks ---------- */
export const segmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  ageRange: z.string(),
  platforms: z.array(platformSchema),
  motivations: z.array(z.string()),
  description: z.string(),
});
export type Segment = z.infer<typeof segmentSchema>;

export const panelReactionSchema = z.object({
  id: z.string(),
  persona: z.string(),
  age: z.number(),
  segmentId: z.string(),
  quote: z.string(),
  objection: z.string().optional(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
});
export type PanelReaction = z.infer<typeof panelReactionSchema>;

export const messageVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  text: z.string(),
  angle: z.string(),
  click: z.number(),
  stop: z.number(),
  share: z.number(),
  score: z.number(),
  isWinner: z.boolean(),
  reactions: z.array(panelReactionSchema),
});
export type MessageVariant = z.infer<typeof messageVariantSchema>;

export const warningSchema = z.object({
  id: z.string(),
  title: z.string(),
  why: z.string(),
  fix: z.string(),
  resolved: z.boolean().default(false),
});
export type Warning = z.infer<typeof warningSchema>;

export const agentRoundSchema = z.object({
  id: z.string(),
  kind: z.enum(["round", "rewrite", "stop"]),
  label: z.string(),
  message: z.string().optional(),
  score: z.number().optional(),
  versusScore: z.number().optional(),
  note: z.string(),
  objectionsAddressed: z.array(z.string()).default([]),
});
export type AgentRound = z.infer<typeof agentRoundSchema>;

export const channelPlanSchema = z.object({
  id: z.string(),
  channel: z.string(),
  platform: platformSchema.optional(),
  type: z.enum(["paid", "organic"]),
  budget: z.number(),
  why: z.string(),
  firstActions: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })),
});
export type ChannelPlan = z.infer<typeof channelPlanSchema>;

export const copyAssetSchema = z.object({
  instagram: z.object({ caption: z.string(), hashtags: z.array(z.string()) }),
  tiktok: z.object({
    hook: z.string(),
    beats: z.array(
      z.object({ from: z.number(), to: z.number(), visual: z.string(), voice: z.string() }),
    ),
  }),
  meta: z.object({ headline: z.string(), primaryText: z.string(), cta: z.string() }),
  email: z.object({ subjects: z.array(z.string()) }),
});
export type CopyAsset = z.infer<typeof copyAssetSchema>;

export const kpiSchema = z.object({
  id: z.string(),
  label: z.string(),
  target: z.number(),
  unit: z.string(),
  hint: z.string(),
});
export type KPI = z.infer<typeof kpiSchema>;

export const channelResultSchema = z.object({
  channelId: z.string(),
  spent: z.number().min(0),
  impressions: z.number().min(0),
  clicks: z.number().min(0),
  orders: z.number().min(0),
  revenue: z.number().min(0),
});
export type ChannelResult = z.infer<typeof channelResultSchema>;

export const campaignSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  status: campaignStatusSchema,
  isDemo: z.boolean().default(false),
  product: productSchema,
  marketplaces: z.array(marketplaceSchema),
  goal: goalSchema,
  budget: z.number(),
  tone: toneSchema,
  durationDays: z.number(),
  health: z.number(),
  segments: z.array(segmentSchema),
  positioning: z.string(),
  keyMessage: z.string(),
  tones: z.array(z.string()),
  messages: z.array(messageVariantSchema),
  warnings: z.array(warningSchema),
  agentRounds: z.array(agentRoundSchema),
  channels: z.array(channelPlanSchema),
  copy: copyAssetSchema,
  kpis: z.array(kpiSchema),
  costUsd: z.tuple([z.number(), z.number()]),
  results: z.array(channelResultSchema).optional(),
});
export type Campaign = z.infer<typeof campaignSchema>;

/* ---------- Wizard ---------- */
export const wizardDraftSchema = z.object({
  rawText: z.string(),
  product: productSchema,
  marketplaces: z.array(marketplaceSchema),
  integrations: z.array(z.string()),
  goal: goalSchema,
  budget: z.number().min(50).max(20000),
  tone: toneSchema,
  durationDays: z.number(),
  language: z.enum(["en", "ro"]).default("en"),
});
export type WizardDraft = z.infer<typeof wizardDraftSchema>;

export type ParsedField = keyof Pick<
  Product,
  "name" | "category" | "price" | "shortDescription" | "strengths" | "audience" | "country"
>;

export interface ParseResult {
  product: Product;
  aiFields: ParsedField[];
  missing: ParsedField[];
}

/* ---------- Auth ---------- */
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  businessName: z.string(),
  avatarUrl: z.string().optional(),
  twoFactorEnabled: z.boolean(),
  language: z.enum(["en", "ro"]).default("en"),
});
export type User = z.infer<typeof userSchema>;

export interface Session {
  token: string;
  user: User;
}

export type TwoFactorMethod = "email" | "app";

export interface Challenge {
  id: string;
  email: string;
  method: TwoFactorMethod;
  firstSetup: boolean;
  totpSecret?: string | undefined;
  otpauthUrl?: string | undefined;
}

export type ResetTokenState = "valid" | "expired" | "invalid";

/* ---------- Misc ---------- */
export interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

export interface ResultsAnalysis {
  series: { day: string; predicted: number; actual: number }[];
  deltas: { id: string; label: string; predicted: number; actual: number; unit: string }[];
  suggestions: { id: string; title: string; body: string; impact: "mare" | "mediu" | "mic" }[];
}

export interface Settings {
  profile: { name: string; businessName: string; email: string; avatarUrl?: string | undefined };
  security: {
    twoFactorEnabled: boolean;
    sessions: {
      id: string;
      device: string;
      location: string;
      lastActive: string;
      current: boolean;
    }[];
  };
  integrations: Record<string, "connected" | "available" | "soon">;
  notifications: { resultsReminder: boolean; weeklyDigest: boolean; productNews: boolean };
  language: "ro" | "en";
  brandKit: { colors: string[]; tone: Tone; logoUrl?: string | undefined };
}

/* Runtime validation at the authentication API boundary. No credentials are verified in the UI. */
export const challengeSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  method: z.enum(["email", "app"]),
  firstSetup: z.boolean(),
  totpSecret: z.string().optional(),
  otpauthUrl: z.string().optional(),
});
export const sessionSchema = z.object({ token: z.string(), user: userSchema });
export const verificationSchema = z.object({
  session: sessionSchema,
  backupCodes: z.array(z.string()).optional(),
});

export const notificationSchema = z.object({ id: z.string(), title: z.string(), body: z.string(), createdAt: z.string(), read: z.boolean(), href: z.string().optional() });
export const resultsAnalysisSchema = z.object({
  series: z.array(z.object({ day:z.string(), predicted:z.number(), actual:z.number() })),
  deltas:z.array(z.object({id:z.string(),label:z.string(),predicted:z.number(),actual:z.number(),unit:z.string()})),
  suggestions:z.array(z.object({id:z.string(),title:z.string(),body:z.string(),impact:z.enum(["mare","mediu","mic"])})),
});
export const settingsSchema = z.object({
 profile:z.object({name:z.string(),businessName:z.string(),email:z.string().email(),avatarUrl:z.string().optional()}),
 security:z.object({twoFactorEnabled:z.boolean(),sessions:z.array(z.object({id:z.string(),device:z.string(),location:z.string(),lastActive:z.string(),current:z.boolean()}))}),
 integrations:z.record(z.enum(["connected","available","soon"])),
 notifications:z.object({resultsReminder:z.boolean(),weeklyDigest:z.boolean(),productNews:z.boolean()}),
 language:z.enum(["ro","en"]),
 brandKit:z.object({colors:z.array(z.string()),tone:toneSchema,logoUrl:z.string().optional()}),
});
export const parseResultSchema=z.object({product:productSchema,aiFields:z.array(z.enum(["name","category","price","shortDescription","strengths","audience","country"])),missing:z.array(z.enum(["name","category","price","shortDescription","strengths","audience","country"]))});
