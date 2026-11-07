import { tr } from "@/i18n";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
export const Route = createFileRoute("/app/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } =>
    typeof search["tab"] === "string" ? { tab: search["tab"] } : {},
  head: () => ({ meta: [{ title: tr("extra.settingsTitle") }] }),
  component: () => (
    <Suspense
      fallback={
        <div className="h-96 rounded-3xl skeleton-shimmer" aria-label={tr("settingsCopy.loading")} />
      }
    >
      <SettingsTab />
    </Suspense>
  ),
});

function SettingsTab() {
  const { tab } = Route.useSearch();
  // Remount on ?tab= changes so links such as the navbar credit chip switch tabs.
  return <SettingsPage key={tab ?? ""} initialTab={tab} />;
}
