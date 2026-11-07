import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Circle, LoaderCircle, Sparkles } from "lucide-react";
import { useT, tr } from "@/i18n";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/campio/Chip";
import { Confetti } from "@/components/campio/Confetti";
import { EmptyState, RocketFriend } from "@/components/campio/Illustrations";
import { ScoreGauge } from "@/components/campio/ScoreGauge";
import { Surface } from "@/components/campio/Surface";
import { campaignsService } from "@/services/campaigns";
import { campaignKeys, campaignQuery } from "@/services/queries";
import { USE_MOCKS } from "@/services/api";
import { cn } from "@/lib/utils";
import { wizardCopy as c } from "./copy";

export default function GeneratingPage({ id }: { id: string }) {
  const t = useT();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [celebrate, setCelebrate] = useState(false);
  const campaign = useQuery(campaignQuery(id));
  const generation = useQuery({
    queryKey: campaignKeys.generation(id),
    queryFn: () => campaignsService.generationStatus(id),
    enabled: !!campaign.data,
    refetchInterval: (query) => (query.state.data?.done ? false : 650),
    retry: 1,
  });
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const answer = useMutation({ mutationFn:()=>campaignsService.answerQuestions(id,(generation.data?.questions??[]).map(q=>({question_id:q.id,value:answers[q.id]??"",skip:!q.required&&!answers[q.id]}))),onSuccess:()=>{setAnswers({});void generation.refetch();} });
  const status = generation.data;
  const done = !!status?.done;
  useEffect(() => {
    if (!done) return;
    setCelebrate(true);
    void client.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    void client.invalidateQueries({ queryKey: ["campaigns", "list"] });
    const timer = setTimeout(() => {
      void navigate({ to: "/app/campaigns/$id", params: { id } });
    }, 2400);
    return () => clearTimeout(timer);
  }, [done, id, client, navigate]);

  if (campaign.isError || generation.isError)
    return (
      <Surface>
        <EmptyState
          title={c.generationError}
          sub={
            campaign.isError ? c.missingCampaign : (generation.error?.message ?? c.generationError)
          }
          art="rocket"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void campaign.refetch();
                  void generation.refetch();
                }}
              >
                {t.common.retry}
              </Button>
              <Button asChild>
                <Link to="/app/campaigns">
                  <ArrowLeft />
                  {c.back}
                </Link>
              </Button>
            </div>
          }
        />
      </Surface>
    );

  return (
    <div className="mx-auto flex min-h-[75dvh] w-full max-w-4xl flex-col items-center justify-center py-6 sm:py-10">
      <div className="relative mb-7 flex size-24 items-center justify-center rounded-[30px] bg-coral-tint shadow-soft sm:size-28">
        {done ? (
          <Check className="size-12 text-coral-ink" />
        ) : (
          <>
            <div className="absolute -inset-2 rounded-[36px] border border-coral/20 motion-safe:animate-pulse" />
            <Logo variant="mark" size={64} />
          </>
        )}
        {celebrate && <Confetti />}
      </div>
      <Chip variant={done ? "success" : "coral"} size="sm">
        {done ? <Check /> : <Sparkles />}
        {done ? t.common.saved : (campaign.data?.product.name ?? t.common.loading)}
      </Chip>
      <h1
        className="mt-5 text-center font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
        aria-live="polite"
      >
        {done ? t.generating.doneTitle : t.generating.title}
      </h1>
      <p className="mt-4 max-w-lg text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
        {done ? c.finished : c.generationSub}
      </p>
      {!!status?.questions?.length && <Surface className="mt-7 w-full max-w-xl"><form onSubmit={e=>{e.preventDefault();answer.mutate();}} className="space-y-4"><h2 className="text-xl font-semibold">{tr("extra.moreInformation")}</h2>{status.questions.map(q=><label key={q.id} className="block text-sm"><span>{q.text}</span><input required={q.required} type={q.kind==="number"?"number":"text"} value={answers[q.id]??""} onChange={e=>setAnswers(old=>({...old,[q.id]:e.target.value}))} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3"/>{q.hint&&<span className="mt-1 block text-xs text-muted-foreground">{q.hint}</span>}</label>)}{answer.error&&<p role="alert" className="text-sm text-destructive">{answer.error.message}</p>}<Button disabled={answer.isPending} type="submit">{t.common.continue}</Button></form></Surface>}
      <div className="mt-9 grid w-full min-w-0 gap-5 md:grid-cols-[1.15fr_1fr]">
        <Surface className="!p-5 sm:!p-7">
          <div className="mb-6 flex items-center justify-between gap-3 text-xs font-semibold">
            <span>
              {c.generationStep.replace("{n}", String(Math.min(5, (status?.stepIndex ?? 0) + 1)))}
            </span>
            <span className="font-display text-base text-coral-ink">
              {Math.round((status?.progress ?? 0) * 100)}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t.generating.title}
            aria-valuenow={Math.round((status?.progress ?? 0) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mb-7 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-coral transition-[width] duration-700"
              style={{ width: `${(status?.progress ?? 0) * 100}%` }}
            />
          </div>
          <ol className="space-y-5">
            {t.generating.steps.map((step, i) => {
              const complete = done || i < (status?.stepIndex ?? 0);
              const current = !done && i === (status?.stepIndex ?? 0);
              return (
                <li
                  key={step.t}
                  className={cn(
                    "flex items-start gap-3 transition-opacity duration-500",
                    !current && !complete && "opacity-45",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                      complete
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "bg-coral text-navy"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {complete ? (
                      <Check className="size-4" />
                    ) : current ? (
                      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <span className="text-xs font-semibold">{i + 1}</span>
                    )}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold leading-relaxed">{step.t}</h2>
                    {(current || complete) && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.d}</p>
                    )}
                  </div>
                  <span className="sr-only">
                    {complete ? c.completed : current ? c.inProgress : c.waiting}
                  </span>
                </li>
              );
            })}
          </ol>
        </Surface>
        <div className="flex min-w-0 flex-col gap-5">
          <Surface tone="navy" className="relative flex-1 overflow-hidden !p-5 sm:!p-6">
            <div className="absolute -right-9 -top-9 size-32 rounded-full border-[22px] border-cream/5" />
            <div className="relative flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{t.generating.scoreboard}</h2>
              <span className="flex items-center gap-1.5 rounded-full bg-cream/10 px-2 py-1 text-[9px] font-semibold tracking-wider">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    done ? "bg-success" : "bg-coral motion-safe:animate-pulse",
                  )}
                />
                {done ? c.completed : c.live}
              </span>
            </div>
            <div className="relative my-6 grid grid-cols-3 gap-1 text-center">
              {Object.entries(status?.scores ?? { a: 0, b: 0, c: 0 }).map(([key, score], i) => (
                <div key={key} className={cn("rounded-2xl px-1 py-3", i === 0 && "bg-cream/5")}>
                  <div
                    className="font-display text-4xl font-bold sm:text-5xl"
                    style={{ color: i === 0 ? "var(--coral)" : undefined }}
                  >
                    {score}
                  </div>
                  <div className="mt-2 text-[10px] text-cream/60">
                    {c.message} {key.toUpperCase()}
                  </div>
                  <div className="mx-auto mt-3 h-1.5 w-12 overflow-hidden rounded-full bg-cream/10">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        i === 0 ? "bg-coral" : "bg-cream/60",
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="relative border-t border-cream/10 pt-4 text-[11px] leading-relaxed text-cream/60">
              {t.result.formula}
            </p>
          </Surface>
          <Surface tone="coralSoft" className="flex items-center gap-4 !p-5">
            <RocketFriend className="w-16 shrink-0" />
            <div>
              <h3 className="font-display text-lg font-semibold">{c.deliverables}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.generateHint}</p>
            </div>
          </Surface>
        </div>
      </div>
      {done && (
        <Button asChild variant="coral" size="lg" className="mt-7 animate-rise">
          <Link to="/app/campaigns/$id" params={{ id }}>
            {t.generating.doneCta}
            <ArrowRight />
          </Link>
        </Button>
      )}
      <p className="mt-7 max-w-lg text-center text-xs leading-relaxed text-muted-foreground">
        {USE_MOCKS ? c.generationNote : t.result.disclaimer}
      </p>
    </div>
  );
}
