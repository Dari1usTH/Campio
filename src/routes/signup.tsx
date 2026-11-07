import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
const AuthPage = lazy(() => import("@/features/auth/AuthPage"));
export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Creează cont · Campio" }] }),
  component: () => (
    <Suspense fallback={<div className="min-h-dvh" aria-label="Se încarcă" />}>
      <AuthPage mode="signup" />
    </Suspense>
  ),
});
