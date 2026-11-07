import { z } from "zod";

/* ---------- Primitives ---------- */
export const toneSchema = z.enum(["warm", "premium", "playful", "direct"]);
export type Tone = z.infer<typeof toneSchema>;

export const channelResultSchema = z.object({
  channelId: z.string(),
  spent: z.number().min(0),
  impressions: z.number().min(0),
  clicks: z.number().min(0),
  orders: z.number().min(0),
  revenue: z.number().min(0),
});
export type ChannelResult = z.infer<typeof channelResultSchema>;

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
  deltas: {
    id: string;
    label: string;
    predicted: number;
    actual: number;
    unit: string;
  }[];
  suggestions: {
    id: string;
    title: string;
    body: string;
    impact: "mare" | "mediu" | "mic";
  }[];
}

export interface Settings {
  profile: {
    name: string;
    businessName: string;
    email: string;
    avatarUrl?: string | undefined;
  };
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
  notifications: {
    resultsReminder: boolean;
    weeklyDigest: boolean;
    productNews: boolean;
  };
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

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
  href: z.string().optional(),
});
export const resultsAnalysisSchema = z.object({
  series: z.array(
    z.object({ day: z.string(), predicted: z.number(), actual: z.number() }),
  ),
  deltas: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      predicted: z.number(),
      actual: z.number(),
      unit: z.string(),
    }),
  ),
  suggestions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
      impact: z.enum(["mare", "mediu", "mic"]),
    }),
  ),
});
export const settingsSchema = z.object({
  profile: z.object({
    name: z.string(),
    businessName: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().optional(),
  }),
  security: z.object({
    twoFactorEnabled: z.boolean(),
    sessions: z.array(
      z.object({
        id: z.string(),
        device: z.string(),
        location: z.string(),
        lastActive: z.string(),
        current: z.boolean(),
      }),
    ),
  }),
  integrations: z.record(z.enum(["connected", "available", "soon"])),
  notifications: z.object({
    resultsReminder: z.boolean(),
    weeklyDigest: z.boolean(),
    productNews: z.boolean(),
  }),
  language: z.enum(["ro", "en"]),
  brandKit: z.object({
    colors: z.array(z.string()),
    tone: toneSchema,
    logoUrl: z.string().optional(),
  }),
});
