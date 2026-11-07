import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { AiBadge, Chip, ComputedBadge } from "@/components/campio/Chip";
import { Field, TextInput } from "@/components/campio/Field";
import { EmptyState } from "@/components/campio/Illustrations";
import { PlatformIcon } from "@/components/campio/PlatformIcon";
import { Surface, Eyebrow } from "@/components/campio/Surface";
import { campaignsService } from "@/services/campaigns";
import { campaignKeys, campaignQuery, analysisQuery } from "@/services/queries";
import type { Campaign, ChannelResult, ResultsAnalysis } from "@/services/schemas";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { CampaignLoading } from "./CampaignResultPage";
import { campaignCopy as c } from "./copy";

const channelSchema = z
  .object({
    channelId: z.string(),
    spent: z.number({ invalid_type_error: c.positive }).finite().min(0, c.positive),
    impressions: z
      .number({ invalid_type_error: c.positive })
      .finite()
      .min(0, c.positive)
      .int(c.wholeNumber),
    clicks: z
      .number({ invalid_type_error: c.positive })
      .finite()
      .min(0, c.positive)
      .int(c.wholeNumber),
    orders: z
      .number({ invalid_type_error: c.positive })
      .finite()
      .min(0, c.positive)
      .int(c.wholeNumber),
    revenue: z.number({ invalid_type_error: c.positive }).finite().min(0, c.positive),
  })
  .superRefine((value, ctx) => {
    if (value.clicks > value.impressions)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clicks"], message: c.invalidCounts });
    if (value.orders > value.clicks)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["orders"], message: c.invalidCounts });
  });
const resultsFormSchema = z.object({ channels: z.array(channelSchema).min(1) });
type ResultsForm = z.infer<typeof resultsFormSchema>;
const fields = ["spent", "impressions", "clicks", "orders", "revenue"] as const;

export default function ResultsPage() {
  const { id = "" } = useParams({ strict: false });
  const query = useQuery(campaignQuery(id));
  const t = useT();
  if (query.isPending) return <CampaignLoading />;
  if (query.isError)
    return (
      <EmptyState
        title={t.result.notFound}
        sub={query.error.message}
        action={<Button onClick={() => query.refetch()}>{c.retry}</Button>}
      />
    );
  return <ResultsFormPage key={query.data.id} campaign={query.data} />;
}

function ResultsFormPage({ campaign }: { campaign: Campaign }) {
  const t = useT();
  const client = useQueryClient();
  const analysis = useQuery(analysisQuery(campaign.id));
  const [savedAnalysis, setSavedAnalysis] = useState<ResultsAnalysis | null>(null);
  const form = useForm<ResultsForm>({
    resolver: zodResolver(resultsFormSchema),
    defaultValues: {
      channels: campaign.channels.map(
        (ch) =>
          campaign.results?.find((r) => r.channelId === ch.id) ?? {
            channelId: ch.id,
            spent: 0,
            impressions: 0,
            clicks: 0,
            orders: 0,
            revenue: 0,
          },
      ),
    },
  });
  const save = useMutation({
    mutationFn: (values: ChannelResult[]) => campaignsService.saveResults(campaign.id, values),
    onSuccess: (result) => {
      setSavedAnalysis(result);
      client.setQueryData(campaignKeys.analysis(campaign.id), result);
      client.invalidateQueries({ queryKey: campaignKeys.all });
      toast.success(t.results.savedToast);
      requestAnimationFrame(() =>
        document
          .getElementById("results-analysis")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    onError: (error) => toast.error(error.message || c.error),
  });
  const currentAnalysis = savedAnalysis ?? analysis.data;
  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/app/campaigns/$id"
          params={{ id: campaign.id }}
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {campaign.product.name}
        </Link>
        <div className="mb-3 flex items-center gap-2">
          <Chip variant="coral" size="sm">
            <ChartNoAxesCombined />
            {t.results.title}
          </Chip>
          <span className="text-xs text-muted-foreground">
            {campaign.durationDays} {c.days}
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold md:text-5xl">
          {t.results.predictedVsActual}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t.results.sub}
        </p>
      </header>
      <Surface tone="navyGradient" className="flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-lg">
          <Eyebrow className="text-cream/60">{campaign.product.name}</Eyebrow>
          <h2 className="mt-2 font-display text-2xl font-bold text-cream">
            {t.workspace.resultsTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-cream/75">{c.formHint}</p>
        </div>
        <div className="grid size-16 shrink-0 place-items-center rounded-3xl bg-cream/10 text-coral">
          <ChartNoAxesCombined className="size-8" />
        </div>
      </Surface>
      <form
        onSubmit={form.handleSubmit((values) => save.mutate(values.channels))}
        noValidate
        className="space-y-5"
      >
        {campaign.channels.map((channel, i) => (
          <Surface key={channel.id}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                {channel.platform && (
                  <PlatformIcon platform={channel.platform} className="size-5" />
                )}
                {channel.channel}
              </h2>
              <Chip size="sm" variant={channel.type === "paid" ? "coral" : "success"}>
                {channel.type === "paid" ? t.result.paid : t.result.organic}
              </Chip>
            </div>
            <input type="hidden" {...form.register(`channels.${i}.channelId`)} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {fields.map((field) => {
                const error = form.formState.errors.channels?.[i]?.[field]?.message;
                const id = `${channel.id}-${field}`;
                return (
                  <Field
                    key={field}
                    id={id}
                    label={t.results.fields[field]}
                    {...(error ? { error } : {})}
                  >
                    <TextInput
                      id={id}
                      type="number"
                      min={0}
                      step={field === "spent" || field === "revenue" ? "0.01" : "1"}
                      inputMode={field === "spent" || field === "revenue" ? "decimal" : "numeric"}
                      aria-invalid={Boolean(error)}
                      {...(error ? { "aria-describedby": `${id}-error` } : {})}
                      {...form.register(`channels.${i}.${field}`, { valueAsNumber: true })}
                    />
                  </Field>
                );
              })}
            </div>
          </Surface>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {t.workspace.demoNote}
          </p>
          <Button type="submit" variant="coral" size="lg" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {save.isPending ? t.results.analyzing : t.results.save}
          </Button>
        </div>
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {save.error.message}
          </p>
        )}
      </form>
      {currentAnalysis && <Analysis campaign={campaign} analysis={currentAnalysis} />}
    </div>
  );
}

function Analysis({ campaign, analysis }: { campaign: Campaign; analysis: ResultsAnalysis }) {
  const t = useT();
  return (
    <div id="results-analysis" className="scroll-mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-8">
        <h2 className="font-display text-2xl font-bold md:text-3xl">
          {t.results.predictedVsActual}
        </h2>
        <Chip variant="success" size="sm">
          <CheckCircle2 />
          {c.savedResults}
        </Chip>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {analysis.deltas.map((delta, i) => {
          const noOrders =
            delta.id === "cpo" && analysis.deltas.find((d) => d.id === "orders")?.actual === 0;
          const diff = delta.predicted
            ? ((delta.actual - delta.predicted) / delta.predicted) * 100
            : 0;
          const isGood = delta.id === "cpo" ? diff <= 0 && !noOrders : diff >= 0;
          return (
            <Surface key={delta.id}>
              <div className="mb-5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{delta.label}</span>
                <ComputedBadge />
              </div>
              <p className="font-display text-4xl font-bold">
                {noOrders
                  ? "—"
                  : new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(
                      delta.actual,
                    )}
                {!noOrders && <span className="ml-1 text-base font-medium">{delta.unit}</span>}
              </p>
              <div className="mt-3">
                <Chip size="sm" variant={isGood ? "success" : "warning"}>
                  {noOrders ? (
                    c.noOrders
                  ) : (
                    <>
                      {diff >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                      {diff >= 0 ? "+" : ""}
                      {Math.round(diff)}% {c.delta}
                    </>
                  )}
                </Chip>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {c.estimate}: {delta.predicted} {delta.unit}
              </p>
            </Surface>
          );
        })}
      </div>
      <Surface>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>{t.results.fields.orders}</Eyebrow>
            <h3 className="mt-1 font-display text-xl font-bold">{t.results.predictedVsActual}</h3>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground" />
              {t.results.predicted}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-coral" />
              {t.results.actual}
            </span>
          </div>
        </div>
        <div
          className="h-64 min-w-0 w-full"
          role="img"
          aria-label={`${t.results.predictedVsActual}: ${analysis.deltas[0]?.predicted ?? 0} vs ${analysis.deltas[0]?.actual ?? 0} ${t.results.fields.orders}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analysis.series} margin={{ top: 10, right: 8, bottom: 0, left: -25 }}>
              <defs>
                <linearGradient id="campioActualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B5B" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#FF6B5B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="campioPredictionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8090A9" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#8090A9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  color: "var(--foreground)",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="predicted"
                name={t.results.predicted}
                stroke="#8090A9"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="url(#campioPredictionGradient)"
              />
              <Area
                type="monotone"
                dataKey="actual"
                name={t.results.actual}
                stroke="#FF6B5B"
                strokeWidth={3}
                fill="url(#campioActualGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {c.chartNote}
        </p>
      </Surface>
      <div className="pt-2">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">{t.results.next}</h2>
          <AiBadge label={t.common.aiWritten} />
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{c.suggestionsNote}</p>
        <div className="grid gap-4 md:grid-cols-3">
          {analysis.suggestions.map((suggestion, i) => (
            <Surface key={suggestion.id} tone={i === 0 ? "coralSoft" : "card"}>
              <div className="mb-5 flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-full bg-navy text-sm font-bold text-cream">
                  {i + 1}
                </span>
                <Chip variant={suggestion.impact === "mare" ? "coral" : "static"} size="sm">
                  {t.results.impact[suggestion.impact]}
                </Chip>
              </div>
              <h3 className="font-display text-lg font-bold leading-snug">{suggestion.title}</h3>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">{suggestion.body}</p>
            </Surface>
          ))}
        </div>
      </div>
      <Surface tone="coral" className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="font-display text-2xl font-bold">{t.results.rerun}</h2>
          <p className="mt-2 text-sm">
            {t.wizard.reuse} · {campaign.product.name}
          </p>
        </div>
        <Link
          to="/app/new"
          search={{ reuse: campaign.id }}
          className={buttonVariants({ variant: "default", size: "lg" })}
        >
          <WandSparkles />
          {t.common.continue}
          <ArrowRight />
        </Link>
      </Surface>
    </div>
  );
}
