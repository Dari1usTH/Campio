import { USE_MOCKS, delay, http, readLocal, writeLocal } from "./api";
import { getSession } from "./auth";
import type { Settings } from "./schemas";

const KEY = "campio:settings";

function defaults(): Settings {
  const s = getSession();
  return {
    profile: {
      name: s?.user.name ?? "Ana",
      businessName: s?.user.businessName ?? "Atelierul meu",
      email: s?.user.email ?? "ana@atelier.ro",
    },
    security: {
      twoFactorEnabled: true,
      sessions: [
        {
          id: "se1",
          device: "MacBook Air · Safari",
          location: "București",
          lastActive: "acum",
          current: true,
        },
        {
          id: "se2",
          device: "iPhone 15 Pro · Campio",
          location: "București",
          lastActive: "acum 2 ore",
          current: false,
        },
        {
          id: "se3",
          device: "Windows · Chrome",
          location: "Cluj-Napoca",
          lastActive: "acum 6 zile",
          current: false,
        },
      ],
    },
    integrations: {
      meta_ads: "connected",
      google_ads: "available",
      tiktok_ads: "available",
      mailchimp: "available",
      shopify: "soon",
    },
    notifications: { resultsReminder: true, weeklyDigest: true, productNews: false },
    language: "ro",
    brandKit: { colors: ["#14213D", "#F4EDE0", "#FF6B5B"], tone: "warm" },
  };
}

export const settingsService = {
  async get(): Promise<Settings> {
    if (!USE_MOCKS) return http("/settings");
    await delay(400);
    return readLocal<Settings | null>(KEY, null) ?? defaults();
  },
  async update(patch: Partial<Settings>): Promise<Settings> {
    if (!USE_MOCKS) return http("/settings", { method: "PATCH", body: JSON.stringify(patch) });
    await delay(500);
    const next = { ...(readLocal<Settings | null>(KEY, null) ?? defaults()), ...patch };
    writeLocal(KEY, next);
    return next;
  },
  async changePassword(current: string, next: string): Promise<void> {
    if (!USE_MOCKS)
      return http("/settings/password", {
        method: "POST",
        body: JSON.stringify({ current, next }),
      });
    await delay(800);
  },
  async deleteAccount(): Promise<void> {
    if (!USE_MOCKS) return http("/settings/account", { method: "DELETE" });
    await delay(900);
    Object.keys(localStorage)
      .filter((key) => key.startsWith("campio:"))
      .forEach((key) => localStorage.removeItem(key));
  },
};
