import { tr } from "@/i18n";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const ResultsPage = lazy(() => import("@/features/campaign/ResultsPage"));
export const Route = createFileRoute("/app/campaigns/$id/results")({
  component: () => (
    <Suspense
      fallback={
        <div
          className="skeleton-shimmer h-80 rounded-[2rem]"
          role="status"
          aria-label={tr("extra.loadingResults")}
        />
      }
    >
      <ResultsPage />
    </Suspense>
  ),
});
