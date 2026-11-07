import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Setări · Campio" }] }),
  component: () => (
    <Suspense
      fallback={
        <div className="h-96 rounded-3xl skeleton-shimmer" aria-label="Se încarcă setările" />
      }
    >
      <SettingsPage />
    </Suspense>
  ),
});
