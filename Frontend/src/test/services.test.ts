import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/services/api";
import {
  campaignFormData,
  campaignsService,
  parseSSE,
} from "@/services/campaigns";
import { setLocale } from "@/i18n";
import completed from "./fixtures/kit-completed.json";

beforeEach(() => {
  vi.restoreAllMocks();
  setLocale("en");
});

describe("cookie API boundary", () => {
  it("includes cookies and active locale without exposing bearer tokens", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    await http("/settings", {
      method: "PATCH",
      body: JSON.stringify({ language: "ro" }),
    });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.credentials).toBe("include");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("Accept-Language")).toBe("en");
  });

  it("maps backend {error:{code}} envelopes to translations and hides provider details", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "ai_unavailable",
              message: "OPENROUTER_API_KEY is not set",
            },
          }),
          { status: 503 },
        ),
    );
    await expect(http("/campaigns")).rejects.toMatchObject({
      code: "ai_unavailable",
      status: 503,
    });
    await expect(http("/campaigns")).rejects.not.toThrow("OPENROUTER");
  });

  it("refreshes cookies once then retries an expired authenticated request", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    await expect(http("/settings")).resolves.toEqual({ ok: true });
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
      "/api/settings",
      "/api/auth/refresh",
      "/api/settings",
    ]);
  });
});

describe("campaign service", () => {
  it("creates a campaign as multipart prompt + one images part per photo", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...completed, status: "running" }), {
        status: 202,
      }),
    );
    const photo = new File(["x"], "a.png", { type: "image/png" });
    const kit = await campaignsService.create("  Suport laptop  ", [
      photo,
      photo,
    ]);
    expect(kit.status).toBe("running");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/campaigns");
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("prompt")).toBe("Suport laptop");
    expect(body.getAll("images")).toHaveLength(2);
    // The browser sets the multipart boundary; we must not override Content-Type.
    expect(new Headers(init?.headers).get("Content-Type")).toBeNull();
  });

  it("builds form data without images", () => {
    const form = campaignFormData("x", []);
    expect(form.getAll("images")).toEqual([]);
    expect(form.get("language")).toBe("en");
  });

  it("sends answers with skip flags and an optional message", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(completed), { status: 202 }),
      );
    await campaignsService.answer(
      "k1",
      [
        { question_id: "q1", value: "79" },
        { question_id: "q2", skip: true },
      ],
      "  ",
    );
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/campaigns/k1/answers");
    expect(JSON.parse(String(init?.body))).toEqual({
      answers: [
        { question_id: "q1", value: "79" },
        { question_id: "q2", skip: true },
      ],
    });
  });

  it("posts budget simulations with total and shares", async () => {
    const sim = {
      total_budget_ron: 3000,
      shares: { meta: 50, tiktok: 50 },
      channels: [],
      totals: completed.plan.totals,
    };
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(sim), { status: 200 }));
    const out = await campaignsService.simulateBudget("k1", 3000, {
      meta: 50,
      tiktok: 50,
    });
    expect(out.total_budget_ron).toBe(3000);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      total_budget_ron: 3000,
      shares: { meta: 50, tiktok: 50 },
    });
  });
});

describe("chat streaming", () => {
  it("splits server-sent events and keeps the unfinished remainder", () => {
    const { events, rest } = parseSSE(
      'event: token\ndata: {"text":"Sal"}\n\nevent: token\r\ndata: {"text":"ut"}\r\n\r\nevent: do',
    );
    expect(events).toEqual([
      { event: "token", data: '{"text":"Sal"}' },
      { event: "token", data: '{"text":"ut"}' },
    ]);
    expect(rest).toBe("event: do");
  });

  it("streams tokens and simulations, then resolves with the final reply", async () => {
    const msg = (id: number, role: string, content: string) => ({
      id,
      campaign_id: "k1",
      role,
      content,
      simulations: null,
      cost_usd: 0,
      created_at: "2026-11-07T09:00:00Z",
    });
    const sim = {
      total_budget_ron: 1000,
      shares: { meta: 100 },
      channels: [],
      totals: completed.plan.totals,
    };
    const done = {
      user_message: msg(1, "user", "hi"),
      assistant_message: msg(2, "assistant", "Salut"),
      simulations: [sim],
    };
    const chunks = [
      'event: token\ndata: {"text":"Sa"}\n\nevent: tok',
      'en\ndata: {"text":"lut"}\n\nevent: simulation\ndata: ' +
        JSON.stringify(sim) +
        "\n\n",
      "event: done\ndata: " + JSON.stringify(done) + "\n\n",
    ];
    const stream = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const tokens: string[] = [];
    let sims = 0;
    const reply = await campaignsService.sendMessage("k1", "hi", {
      onToken: (t) => tokens.push(t),
      onSimulation: () => sims++,
    });
    expect(tokens.join("")).toBe("Salut");
    expect(sims).toBe(1);
    expect(reply.assistant_message.content).toBe("Salut");
  });

  it("surfaces stream errors as translated API errors", async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(
          new TextEncoder().encode(
            'event: error\ndata: {"code":"ai_error","message":"provider said no"}\n\n',
          ),
        );
        c.close();
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    await expect(
      campaignsService.sendMessage("k1", "hi"),
    ).rejects.toMatchObject({ code: "ai_error" });
  });
});
