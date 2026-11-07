import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const GeneratingPage = lazy(() => import("@/features/wizard/GeneratingPage"));
export const Route = createFileRoute("/app/generating/$id")({
  component: () => {
    const { id } = Route.useParams();
    return (
      <Suspense
        fallback={<div className="skeleton-shimmer h-96 rounded-3xl" aria-label="Se încarcă…" />}
      >
        <GeneratingPage id={id} />
      </Suspense>
    );
  },
});
