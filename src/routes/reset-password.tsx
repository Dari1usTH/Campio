import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const ResetPage = lazy(() => import("@/features/auth/ResetPage"));
export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search["token"] === "string" ? { token: search["token"] } : {},
  head: () => ({ meta: [{ title: "Parolă nouă · Campio" }] }),
  component: Page,
});
function Page() {
  const { token } = Route.useSearch();
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-label="Se încarcă" />}>
      <ResetPage {...(token ? { token } : {})} />
    </Suspense>
  );
}
