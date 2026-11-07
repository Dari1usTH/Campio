import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageLoading } from "@/components/app/PageState";
const Page = lazy(() => import("@/features/workspace/AssetsPage"));
export const Route = createFileRoute("/app/assets")({
  component: () => (
    <Suspense fallback={<PageLoading />}>
      <Page />
    </Suspense>
  ),
});
