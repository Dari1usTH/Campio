import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const ForgotPage = lazy(() => import("@/features/auth/ForgotPage"));
export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Resetare parolă · Campio" }] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" aria-label="Se încarcă" />}>
      <ForgotPage />
    </Suspense>
  ),
});
