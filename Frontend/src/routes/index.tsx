import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageLoading } from "@/components/app/PageState";
const LandingPage = lazy(() => import("@/features/landing/LandingPage"));
export const Route = createFileRoute("/")({
  component: () => (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-6 pt-32">
          <PageLoading />
        </div>
      }
    >
      <LandingPage />
    </Suspense>
  ),
});
