import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageLoading } from "@/components/app/PageState";
const Page = lazy(() => import("@/features/workspace/DashboardPage"));
export const Route = createFileRoute("/app/")({
  component: () => (
    <Suspense fallback={<PageLoading />}>
      <Page />
    </Suspense>
  ),
});
