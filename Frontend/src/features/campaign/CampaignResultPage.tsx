import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChartNoAxesCombined,
  CircleAlert,
  Loader2,
  Printer,
  Rocket,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyButton } from "@/components/campio/CopyButton";
import { EmptyState } from "@/components/campio/Illustrations";
import { campaignsService } from "@/services/campaigns";
import { campaignKeys, campaignQuery } from "@/services/queries";
import { isKitActive, type Kit } from "@/services/kit";
import { formatDate, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./kit/copy";
import { KitView } from "./kit/KitView";
import {
  AnswersHistory,
  Assumptions,
  ProgressStrip,
  QuestionsCard,
} from "./kit/StatusPanel";
import { Notice, lei } from "./kit/ui";
import { makeShareUrl } from "./share";

export function CampaignLoading() {
  return (
    <div role="status" className="space-y-6">
      <div className="skeleton-shimmer h-10 w-72 rounded-2xl" />
      <div className="skeleton-shimmer h-28 rounded-[2rem]" />
      <div className="skeleton-shimmer h-96 rounded-[2rem]" />
    </div>
  );
}

export default function CampaignResultPage() {
  const { id = "" } = useParams({ strict: false });
  const t = useT();
  const query = useQuery(campaignQuery(id));
  if (query.isPending) return <CampaignLoading />;
  if (query.isError)
    return (
      <EmptyState
        title={t.result.notFound}
        sub={query.error.message}
        action={
          <Button onClick={() => query.refetch()}>{t.common.retry}</Button>
        }
      />
    );
  return <CampaignKit kit={query.data} />;
}

export const isLaunched = (kit: Kit) => kit.ui_data["status"] === "launched";

function CampaignKit({ kit }: { kit: Kit }) {
  return (
    <div className="space-y-6">
      <KitHeader kit={kit} />
      {kit.status === "failed" && (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <FailedMessage kit={kit} />
        </div>
      )}
      {kit.status !== "completed" && <ProgressStrip kit={kit} />}
      {kit.status === "needs_input" && kit.intake.questions.length > 0 && (
        <QuestionsCard kit={kit} />
      )}
      <Assumptions kit={kit} />
      <AnswersHistory kit={kit} />
      <KitView kit={kit} />
    </div>
  );
}

function FailedMessage({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  return (
    <div>
      <p className="font-semibold">{c.header.failed}</p>
      {kit.error && <p className="mt-1 text-muted-foreground">{kit.error}</p>}
    </div>
  );
}

export function KitHeader({
  kit,
  readOnly = false,
}: {
  kit: Kit;
  readOnly?: boolean;
}) {
  const c = useKitCopy();
  const i = kit.input;
  const launched = isLaunched(kit);
  const statusKey = launched ? "launched" : kit.status;
  const rows: [string, string][] = [
    [c.header.keyword, i.keyword],
    [c.header.price, i.sale_price ? lei(i.sale_price, 2) : ""],
    [c.header.budget, i.ad_budget_ron ? lei(i.ad_budget_ron) : ""],
    [c.header.brand, i.brand_name],
    [c.header.keywordEn, i.keyword_en],
  ];
  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold",
                statusKey === "completed" || statusKey === "launched"
                  ? "bg-success-tint text-success-ink"
                  : statusKey === "failed"
                    ? "bg-destructive/10 text-destructive"
                    : statusKey === "needs_input"
                      ? "bg-warning-tint text-warning-ink"
                      : "bg-coral-tint text-coral-ink",
              )}
            >
              {isKitActive(kit.status) && (
                <Loader2 className="size-3 animate-spin" />
              )}
              {c.status[statusKey] ?? statusKey}
            </span>
            {readOnly && (
              <span className="rounded-full border border-border px-2.5 py-1">
                {c.header.readonly}
              </span>
            )}
            <span className="text-muted-foreground">
              {formatDate(kit.created_at)}
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {c.header.eyebrow}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight md:text-5xl">
            {i.product_name || c.header.untitled}
          </h1>
        </div>
        {!readOnly && <HeaderActions kit={kit} />}
      </div>
      {isKitActive(kit.status) && (
        <p className="text-sm text-muted-foreground">{c.header.generating}</p>
      )}
      <section className="rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-soft">
        <p className="mb-3 text-sm font-semibold">{c.header.understood}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-5">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd
                className={cn(
                  "truncate font-medium",
                  !value && "font-normal italic text-muted-foreground",
                )}
              >
                {value || c.header.unknown}
              </dd>
            </div>
          ))}
        </dl>
        {i.product_description && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {i.product_description}
          </p>
        )}
        {!readOnly && i.prompt && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              {c.header.prompt}
            </summary>
            <p className="mt-2 whitespace-pre-line rounded-xl bg-surface p-3">
              {i.prompt}
            </p>
          </details>
        )}
      </section>
    </header>
  );
}

function HeaderActions({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const launched = isLaunched(kit);
  const remove = useMutation({
    mutationFn: () => campaignsService.remove(kit.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: campaignKeys.all });
      void navigate({ to: "/app/campaigns" });
    },
    onError: (e) => toast.error(e.message),
  });
  const launch = useMutation({
    mutationFn: () => campaignsService.markLaunched(kit.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: campaignKeys.all });
      void navigate({
        to: "/app/campaigns/$id/results",
        params: { id: kit.id },
      });
    },
    onError: (e) => toast.error(e.message),
  });
  const ready = kit.status === "completed";
  return (
    <div className="print-hidden flex flex-wrap gap-2">
      {ready && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            try {
              setShareUrl(makeShareUrl(kit));
            } catch {
              toast.error(c.header.shareError);
            }
          }}
        >
          <Share2 />
          {c.header.share}
        </Button>
      )}
      {ready && (
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer />
          {c.header.print}
        </Button>
      )}
      {ready &&
        (launched ? (
          <Button asChild variant="coral" size="sm">
            <Link to="/app/campaigns/$id/results" params={{ id: kit.id }}>
              <ChartNoAxesCombined />
              {c.header.enterResults}
            </Link>
          </Button>
        ) : (
          <Button
            variant="coral"
            size="sm"
            onClick={() => launch.mutate()}
            disabled={launch.isPending}
          >
            {launch.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Rocket />
            )}
            {c.header.launch}
          </Button>
        ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirm(true)}
        aria-label={c.header.delete}
      >
        <Trash2 />
      </Button>
      {shareUrl && (
        <div className="w-full">
          <Notice>
            <p className="font-semibold">{c.header.shareTitle}</p>
            <p className="text-xs text-muted-foreground">
              {c.header.shareHint}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <CopyButton text={shareUrl} />
            </div>
          </Notice>
        </div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.header.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {c.header.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{c.header.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {c.header.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
