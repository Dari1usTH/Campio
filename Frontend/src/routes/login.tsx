import { tr } from "@/i18n";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const AuthPage = lazy(() => import("@/features/auth/AuthPage"));
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: tr("extra.loginTitle") }] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" aria-label={tr("extra.loading")} />}>
      <AuthPage mode="login" />
    </Suspense>
  ),
});
