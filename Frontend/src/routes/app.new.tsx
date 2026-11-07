import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const WizardPage = lazy(() => import("@/features/wizard/WizardPage"));
export const Route = createFileRoute("/app/new")({
  validateSearch: (search: Record<string, unknown>): { reuse?: string } =>
    typeof search["reuse"] === "string" ? { reuse: search["reuse"] } : {},
  component: () => (
    <Suspense
      fallback={<div className="skeleton-shimmer h-96 rounded-3xl" aria-label="Se încarcă…" />}
    >
      <WizardPage />
    </Suspense>
  ),
});
