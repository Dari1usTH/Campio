import { queryOptions } from "@tanstack/react-query";
import { campaignsService } from "./campaigns";
import { settingsService } from "./settings";
import { billingService } from "./billing";
import { isAssetActive, isKitActive } from "./kit";

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: () => ["campaigns", "list"] as const,
  detail: (id: string) => ["campaigns", "detail", id] as const,
  analysis: (id: string) => ["campaigns", "analysis", id] as const,
  assets: (id: string) => ["campaigns", "assets", id] as const,
  edits: (id: string) => ["campaigns", "edits", id] as const,
  edit: (editId: string) => ["edits", editId] as const,
  messages: (id: string) => ["campaigns", "messages", id] as const,
};

export const campaignsQuery = () =>
  queryOptions({
    queryKey: campaignKeys.list(),
    queryFn: () => campaignsService.list(),
  });

/** Polls every 2 s while the kit is generating (guide §2–3); stops on needs_input / completed / failed. */
export const campaignQuery = (id: string) =>
  queryOptions({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignsService.get(id),
    refetchInterval: (q) =>
      q.state.data && isKitActive(q.state.data.status) ? 2000 : false,
  });

/** Polls every 5 s while any clip is pending (guide §4). */
export const assetsQuery = (id: string) =>
  queryOptions({
    queryKey: campaignKeys.assets(id),
    queryFn: () => campaignsService.assets(id),
    refetchInterval: (q) => (q.state.data?.some(isAssetActive) ? 5000 : false),
  });

export const editsQuery = (id: string) =>
  queryOptions({
    queryKey: campaignKeys.edits(id),
    queryFn: () => campaignsService.edits(id),
  });

/** Polls every 2 s while the AI editor is running. */
export const editQuery = (editId: string) =>
  queryOptions({
    queryKey: campaignKeys.edit(editId),
    queryFn: () => campaignsService.getEdit(editId),
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2000 : false),
  });

export const messagesQuery = (id: string) =>
  queryOptions({
    queryKey: campaignKeys.messages(id),
    queryFn: () => campaignsService.messages(id),
  });

export const videoModelsQuery = () =>
  queryOptions({
    queryKey: ["video-models"],
    queryFn: () => campaignsService.videoModels(),
    staleTime: 60 * 60 * 1000,
  });

export const imageModelsQuery = () =>
  queryOptions({
    queryKey: ["image-models"],
    queryFn: () => campaignsService.imageModels(),
    staleTime: 60 * 60 * 1000,
  });

export const demoCasesQuery = () =>
  queryOptions({
    queryKey: ["demo-cases"],
    queryFn: () => campaignsService.demoCases(),
    staleTime: Infinity,
  });

export const analysisQuery = (id: string) =>
  queryOptions({
    queryKey: campaignKeys.analysis(id),
    queryFn: () => campaignsService.analysis(id),
  });

/** Credit balance; refreshed often because AI work spends it in the background. */
export const billingQuery = () =>
  queryOptions({
    queryKey: ["billing"],
    queryFn: () => billingService.get(),
    refetchInterval: 30_000,
  });

export const notificationsQuery = () =>
  queryOptions({
    queryKey: ["notifications"],
    queryFn: () => campaignsService.notifications(),
  });

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["settings"],
    queryFn: () => settingsService.get(),
  });
