import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export function PageLoading() {
  const t = useT();
  return (
    <div role="status" aria-label={t.common.loading} className="space-y-6 py-4">
      <div className="skeleton-shimmer h-10 w-56 rounded-2xl" />
      <div className="skeleton-shimmer h-5 w-72 max-w-full rounded-full" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="skeleton-shimmer h-64 rounded-[2rem]" />
        <div className="skeleton-shimmer h-64 rounded-[2rem]" />
      </div>
      <span className="sr-only">{t.common.loading}</span>
    </div>
  );
}
export function PageError({ retry, message }: { retry?: () => void; message?: string }) {
  const t = useT();
  return (
    <div role="alert" className="rounded-[2rem] border border-border bg-card p-10 text-center">
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-coral-tint text-3xl">
        :(
      </span>
      <h1 className="text-2xl font-bold">{message || t.empty.error}</h1>
      {retry && (
        <Button onClick={retry} className="mt-6">
          <RotateCcw />
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}
