import { z } from "zod";
import { API_URL, ApiError, http } from "./api";
import { getLocale, translateError } from "@/i18n";
import {
  assetSchema,
  budgetSimulationSchema,
  campaignListSchema,
  chatMessageSchema,
  chatReplySchema,
  demoCaseSchema,
  editSchema,
  kitSchema,
  imageModelListSchema,
  videoModelListSchema,
  type BudgetSimulation,
  type ChatReply,
} from "./kit";
import {
  channelResultSchema,
  notificationSchema,
  resultsAnalysisSchema,
} from "./schemas";
import type { ChannelResult } from "./schemas";

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 8 << 20;
export const MAX_PROMPT = 4000;

const idPath = (id: string) => `/campaigns/${encodeURIComponent(id)}`;

export interface AnswerInput {
  question_id: string;
  value?: string;
  skip?: boolean;
}

export interface ChatHandlers {
  onToken?: (text: string) => void;
  onSimulation?: (sim: BudgetSimulation) => void;
}

/** One server-sent event. */
export interface SSEEvent {
  event: string;
  data: string;
}

/** Splits a text/event-stream buffer into complete events and the unfinished remainder. */
export function parseSSE(buffer: string): { events: SSEEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: SSEEvent[] = [];
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:"))
        data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

/** Builds the multipart body for POST /campaigns (prompt + one `images` part per photo). */
export function campaignFormData(prompt: string, images: File[]): FormData {
  const form = new FormData();
  form.append("prompt", prompt.trim());
  form.append("language", getLocale());
  for (const image of images) form.append("images", image, image.name);
  return form;
}

export const campaignsService = {
  async list() {
    const items: z.infer<typeof campaignListSchema>["items"] = [];
    for (let offset = 0; ; offset += 100) {
      const page = campaignListSchema.parse(
        await http(`/campaigns?limit=100&offset=${offset}`),
      );
      items.push(...page.items);
      if (page.items.length === 0 || offset + page.items.length >= page.total)
        break;
    }
    return items;
  },
  async get(id: string) {
    return kitSchema.parse(await http(idPath(id)));
  },
  async create(prompt: string, images: File[]) {
    return kitSchema.parse(
      await http("/campaigns", {
        method: "POST",
        body: campaignFormData(prompt, images),
      }),
    );
  },
  async answer(id: string, answers: AnswerInput[], message?: string) {
    const body: { answers: AnswerInput[]; message?: string } = { answers };
    if (message?.trim()) body.message = message.trim();
    return kitSchema.parse(
      await http(`${idPath(id)}/answers`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },
  async remove(id: string) {
    await http(idPath(id), { method: "DELETE" });
  },
  async markLaunched(id: string) {
    await http(`${idPath(id)}/ui-data`, {
      method: "PATCH",
      body: JSON.stringify({ status: "launched" }),
    });
  },
  async simulateBudget(
    id: string,
    total: number,
    shares: Record<string, number>,
  ) {
    return budgetSimulationSchema.parse(
      await http(`${idPath(id)}/budget-simulation`, {
        method: "POST",
        body: JSON.stringify({ total_budget_ron: total, shares }),
      }),
    );
  },
  async demoCases() {
    return z
      .object({ items: z.array(demoCaseSchema) })
      .parse(await http("/demo-cases")).items;
  },

  /* ---------- Media ---------- */
  async assets(id: string) {
    return z
      .object({ items: z.array(assetSchema) })
      .parse(await http(`${idPath(id)}/assets`)).items;
  },
  async upload(
    id: string,
    file: File,
    role: "product_image" | "logo" | "music" | "footage",
  ) {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("role", role);
    return assetSchema.parse(
      await http(`${idPath(id)}/uploads`, { method: "POST", body: form }),
    );
  },
  async videoModels() {
    return videoModelListSchema.parse(await http("/video-models"));
  },
  async generateVideos(id: string, conceptId: string, model?: string) {
    return z
      .object({
        items: z.array(assetSchema),
        estimated_cost_usd: z.number().optional(),
      })
      .parse(
        await http(`${idPath(id)}/videos`, {
          method: "POST",
          body: JSON.stringify(
            model
              ? { concept_id: conceptId, model }
              : { concept_id: conceptId },
          ),
        }),
      );
  },
  async imageModels() {
    return imageModelListSchema.parse(await http("/image-models"));
  },
  async generatePosters(
    id: string,
    body: {
      concept_ids?: string[];
      prompt?: string;
      headline?: string;
      subline?: string;
      cta?: string;
      aspect_ratio?: string;
      model?: string;
      show_price?: boolean;
    },
  ) {
    return z.object({ items: z.array(assetSchema) }).parse(
      await http(`${idPath(id)}/posters`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },
  async edits(id: string) {
    return z
      .object({ items: z.array(editSchema) })
      .parse(await http(`${idPath(id)}/edits`)).items;
  },
  async startEdit(id: string, conceptId: string, instructions?: string) {
    const body: { concept_id: string; instructions?: string } = {
      concept_id: conceptId,
    };
    if (instructions?.trim()) body.instructions = instructions.trim();
    return editSchema.parse(
      await http(`${idPath(id)}/edits`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },
  async getEdit(editId: string) {
    return editSchema.parse(await http(`/edits/${encodeURIComponent(editId)}`));
  },

  /* ---------- Chat ---------- */
  async messages(id: string) {
    return z
      .object({ items: z.array(chatMessageSchema) })
      .parse(await http(`${idPath(id)}/messages`)).items;
  },
  /** Streams the assistant reply (SSE). Resolves with the final ChatReply. */
  async sendMessage(
    id: string,
    message: string,
    handlers: ChatHandlers = {},
  ): Promise<ChatReply> {
    const response = await fetch(`${API_URL}${idPath(id)}/messages`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Accept-Language": getLocale(),
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { code?: string };
      };
      const code = body.error?.code ?? "unknown_error";
      throw new ApiError(translateError(code), response.status, code);
    }
    if (
      !response.body ||
      !response.headers.get("Content-Type")?.includes("text/event-stream")
    )
      return chatReplySchema.parse(await response.json());
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      const parsed = parseSSE(done ? `${buffer}\n\n` : buffer);
      buffer = parsed.rest;
      for (const ev of parsed.events) {
        const data = JSON.parse(ev.data) as unknown;
        if (ev.event === "token")
          handlers.onToken?.(z.object({ text: z.string() }).parse(data).text);
        else if (ev.event === "simulation")
          handlers.onSimulation?.(budgetSimulationSchema.parse(data));
        else if (ev.event === "done") return chatReplySchema.parse(data);
        else if (ev.event === "error") {
          const code = z.object({ code: z.string() }).safeParse(data);
          const c = code.success ? code.data.code : "ai_error";
          throw new ApiError(translateError(c), 502, c);
        }
      }
      if (done) break;
    }
    throw new ApiError(translateError("ai_error"), 502, "ai_error");
  },

  /* ---------- Real results & notifications (kept) ---------- */
  async saveResults(id: string, results: ChannelResult[]) {
    z.array(channelResultSchema).min(1).parse(results);
    return resultsAnalysisSchema.parse(
      await http(`${idPath(id)}/results`, {
        method: "POST",
        body: JSON.stringify(results),
      }),
    );
  },
  async analysis(id: string) {
    return resultsAnalysisSchema
      .nullable()
      .parse(await http(`${idPath(id)}/results/analysis`));
  },
  async notifications() {
    return z.array(notificationSchema).parse(await http("/notifications"));
  },
  async markAllRead() {
    await http("/notifications/read", { method: "POST" });
  },
};
