import { tr } from "@/i18n";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const VerifyPage = lazy(() => import("@/features/auth/VerifyPage"));
export const Route = createFileRoute("/verify-2fa")({
  head: () => ({ meta: [{ title: tr("extra.verificationTitle") }] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" aria-label={tr("extra.loading")} />}>
      <VerifyPage />
    </Suspense>
  ),
});
