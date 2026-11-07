import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/services/api";
import { authService, getChallenge, getSession, onSessionChange } from "@/services/auth";
import { campaignsService } from "@/services/campaigns";
import { seedCampaigns } from "@/services/mock-data";
import { settingsService } from "@/services/settings";
import type { Challenge, ResultsAnalysis, Session } from "@/services/schemas";

// Exercise API mode while retaining real browser persistence helpers.
vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return { ...actual, USE_MOCKS: false, http: vi.fn() };
});

const backend = vi.mocked(http);
const credentials = { email: "ana@atelier.ro", password: "CampioTest1!" };
const challenge: Challenge = {
  id: "challenge-from-backend",
  email: credentials.email,
  method: "email",
  firstSetup: true,
};
const session: Session = {
  token: "opaque-backend-session-token",
  user: {
    id: "user-from-backend",
    name: "Ana",
    email: credentials.email,
    businessName: "Atelierul Anei",
    twoFactorEnabled: true,
  },
};

beforeEach(() => {
  backend.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe("Campaign API mode contracts", () => {
  const campaign = seedCampaigns()[0]!;
  const analysis: ResultsAnalysis = { series: [], deltas: [], suggestions: [] };
  const calls = [
    {
      name: "toggles a warning on the backend",
      run: () => campaignsService.toggleWarning("campaign-42", "warning-3"),
      path: "/campaigns/campaign-42/warnings/warning-3/toggle",
      init: { method: "POST" },
      response: campaign,
    },
    {
      name: "toggles a channel action on the backend",
      run: () => campaignsService.toggleAction("campaign-42", "channel-2", "action-7"),
      path: "/campaigns/campaign-42/channels/channel-2/actions/action-7/toggle",
      init: { method: "POST" },
      response: campaign,
    },
    {
      name: "loads analysis from the backend",
      run: () => campaignsService.analysis("campaign-42"),
      path: "/campaigns/campaign-42/results/analysis",
      response: analysis,
    },
    {
      name: "deletes a campaign on the backend",
      run: () => campaignsService.remove("campaign-42"),
      path: "/campaigns/campaign-42",
      init: { method: "DELETE" },
      response: undefined,
    },
    {
      name: "marks notifications as read on the backend",
      run: () => campaignsService.markAllRead(),
      path: "/notifications/read",
      init: { method: "POST" },
      response: undefined,
    },
  ];

  it.each(calls)("$name without touching mock records", async ({ run, path, init, response }) => {
    localStorage.setItem("campio:campaigns", JSON.stringify([{ id: "local-campaign" }]));
    localStorage.setItem(
      "campio:notifications",
      JSON.stringify([{ id: "local-notification", read: false }]),
    );
    const storedCampaigns = localStorage.getItem("campio:campaigns");
    const storedNotifications = localStorage.getItem("campio:notifications");
    backend.mockResolvedValueOnce(response);

    await expect(run()).resolves.toEqual(response);

    expect(backend).toHaveBeenCalledTimes(1);
    if (init) expect(backend).toHaveBeenCalledWith(path, init);
    else expect(backend).toHaveBeenCalledWith(path);
    expect(localStorage.getItem("campio:campaigns")).toBe(storedCampaigns);
    expect(localStorage.getItem("campio:notifications")).toBe(storedNotifications);
    expect(localStorage.getItem("campio:activity")).toBeNull();
  });
});

describe("Authentication API mode persistence", () => {
  it.each(["signup", "login"] as const)(
    "persists the %s challenge returned by the backend",
    async (operation) => {
      backend.mockResolvedValueOnce(challenge);

      await expect(authService[operation](credentials)).resolves.toEqual(challenge);

      expect(backend).toHaveBeenCalledWith(`/auth/${operation}`, {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      expect(getChallenge()).toEqual(challenge);
      expect(JSON.parse(sessionStorage.getItem("campio:challenge")!)).toEqual(challenge);
      expect(getSession()).toBeNull();
    },
  );

  it("persists the Google challenge returned by the backend", async () => {
    backend.mockResolvedValueOnce(challenge);

    await expect(authService.google()).resolves.toEqual(challenge);

    expect(backend).toHaveBeenCalledWith("/auth/google", { method: "POST" });
    expect(getChallenge()).toEqual(challenge);
  });

  it("sends the current challenge id and persists the server's updated 2FA method", async () => {
    sessionStorage.setItem("campio:challenge", JSON.stringify(challenge));
    const refreshed: Challenge = { ...challenge, id: "refreshed-by-backend", method: "app" };
    backend.mockResolvedValueOnce(refreshed);

    await expect(authService.setMethod("app")).resolves.toEqual(refreshed);

    expect(backend).toHaveBeenCalledWith("/auth/2fa/method", {
      method: "POST",
      body: JSON.stringify({ id: challenge.id, method: "app" }),
    });
    expect(getChallenge()).toEqual(refreshed);
  });

  it.each([
    { name: "without backup codes", result: { session } },
    { name: "with backup codes", result: { session, backupCodes: ["BACKUP-ONE", "BACKUP-TWO"] } },
  ])("stores a verified session and clears the challenge $name", async ({ result }) => {
    sessionStorage.setItem("campio:challenge", JSON.stringify(challenge));
    backend.mockResolvedValueOnce(result);
    const listener = vi.fn();
    const unsubscribe = onSessionChange(listener);
    try {
      await expect(authService.verify2fa("123456")).resolves.toEqual(result);

      expect(backend).toHaveBeenCalledWith("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ id: challenge.id, code: "123456" }),
      });
      expect(getSession()).toEqual(session);
      expect(localStorage.getItem("campio:token")).toBe(session.token);
      expect(sessionStorage.getItem("campio:challenge")).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("preserves the pending challenge if verification fails", async () => {
    sessionStorage.setItem("campio:challenge", JSON.stringify(challenge));
    backend.mockRejectedValueOnce(new Error("Cod incorect"));

    await expect(authService.verify2fa("123456")).rejects.toThrow("Cod incorect");

    expect(getChallenge()).toEqual(challenge);
    expect(getSession()).toBeNull();
    expect(localStorage.getItem("campio:token")).toBeNull();
  });
});

describe("Settings API mode contracts", () => {
  it("sends both current and next passwords in the backend request body", async () => {
    backend.mockResolvedValueOnce(undefined);
    const current = "CurrentPassword1!";
    const next = "NextPassword2!";

    await settingsService.changePassword(current, next);

    expect(backend).toHaveBeenCalledTimes(1);
    expect(backend).toHaveBeenCalledWith("/settings/password", {
      method: "POST",
      body: JSON.stringify({ current, next }),
    });
  });
});
