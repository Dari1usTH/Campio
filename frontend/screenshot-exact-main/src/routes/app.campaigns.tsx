import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageLoading } from "@/components/app/PageState";
const Page = lazy(() => import("@/features/workspace/HistoryPage"));
function CampaignsRoute() {
  const path = useLocation({ select: (l) => l.pathname });
  return path.replace(/\/$/, "") === "/app/campaigns" ? (
    <Suspense fallback={<PageLoading />}>
      <Page />
    </Suspense>
  ) : (
    <Outlet />
  );
}
export const Route = createFileRoute("/app/campaigns")({ component: CampaignsRoute });
