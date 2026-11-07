import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const VerifyPage = lazy(() => import("@/features/auth/VerifyPage"));
export const Route = createFileRoute("/verify-2fa")({
  head: () => ({ meta: [{ title: "Verificare · Campio" }] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" aria-label="Se încarcă" />}>
      <VerifyPage />
    </Suspense>
  ),
});
