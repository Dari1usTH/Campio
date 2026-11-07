import { tr } from "@/i18n";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const SharePage = lazy(() => import("@/features/campaign/SharePage"));
export const Route = createFileRoute("/share/$id")({
  component: () => (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-background"
          role="status"
          aria-label={tr("extra.loadingCampaign")}
        />
      }
    >
      <SharePage />
    </Suspense>
  ),
});
