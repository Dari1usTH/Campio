import { queryOptions } from "@tanstack/react-query";
import { campaignsService, type CampaignFilters } from "./campaigns";
import { settingsService } from "./settings";

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: (f: CampaignFilters) => ["campaigns", "list", f] as const,
  detail: (id: string) => ["campaigns", "detail", id] as const,
  analysis: (id: string) => ["campaigns", "analysis", id] as const,
  generation: (id: string) => ["campaigns", "generation", id] as const,
};

export const campaignsQuery = (f: CampaignFilters = {}) =>
  queryOptions({ queryKey: campaignKeys.list(f), queryFn: () => campaignsService.list(f) });

export const campaignQuery = (id: string) =>
  queryOptions({ queryKey: campaignKeys.detail(id), queryFn: () => campaignsService.get(id) });

export const analysisQuery = (id: string) =>
  queryOptions({
    queryKey: campaignKeys.analysis(id),
    queryFn: () => campaignsService.analysis(id),
  });

export const notificationsQuery = () =>
  queryOptions({ queryKey: ["notifications"], queryFn: () => campaignsService.notifications() });

export const settingsQuery = () =>
  queryOptions({ queryKey: ["settings"], queryFn: () => settingsService.get() });
