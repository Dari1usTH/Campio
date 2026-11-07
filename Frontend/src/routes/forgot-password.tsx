import { tr } from "@/i18n";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const ForgotPage = lazy(() => import("@/features/auth/ForgotPage"));
export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: tr("extra.forgotTitle") }] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" aria-label={tr("extra.loading")} />}>
      <ForgotPage />
    </Suspense>
  ),
});
