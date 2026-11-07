import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const AuthPage = lazy(() => import("@/features/auth/AuthPage"));
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Intră în cont · Campio" }] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" aria-label="Se încarcă" />}>
      <AuthPage mode="login" />
    </Suspense>
  ),
});
