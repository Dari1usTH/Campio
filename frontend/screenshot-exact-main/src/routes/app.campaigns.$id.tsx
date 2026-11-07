import { lazy, Suspense } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
const CampaignResultPage = lazy(() => import("@/features/campaign/CampaignResultPage"));
export const Route = createFileRoute("/app/campaigns/$id")({ component: CampaignRoute });
function CampaignRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.endsWith("/results")) return <Outlet />;
  return (
    <Suspense
      fallback={
        <div
          className="skeleton-shimmer h-80 rounded-[2rem]"
          role="status"
          aria-label="Se încarcă campania"
        />
      }
    >
      <CampaignResultPage />
    </Suspense>
  );
}
