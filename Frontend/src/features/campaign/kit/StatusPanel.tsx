import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleAlert,
  Loader2,
  MessageCircleQuestion,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea, inputClass } from "@/components/campio/Field";
import { campaignsService, type AnswerInput } from "@/services/campaigns";
import { campaignKeys } from "@/services/queries";
import { KIT_STEPS, type Kit, type Question } from "@/services/kit";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import { Notice } from "./ui";

export function ProgressStrip({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const byStep = new Map(kit.steps.map((s) => [s.step, s]));
  return (
    <ol
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      aria-label={c.status[kit.status]}
    >
      {KIT_STEPS.map((step) => {
        const info = byStep.get(step);
        const status = info?.status ?? "pending";
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm",
              status === "completed" && "border-success/30 bg-success-tint/60",
              status === "running" && "border-coral/40 bg-coral-tint/60",
              status === "waiting" && "border-warning/40 bg-warning-tint/70",
              status === "failed" && "border-destructive/40 bg-destructive/10",
              status === "pending" && "border-border bg-card",
            )}
          >
            <span className="grid size-6 shrink-0 place-items-center">
              {status === "completed" ? (
                <Check className="size-4 text-success-ink" />
              ) : status === "running" ? (
                <Loader2 className="size-4 animate-spin text-coral-ink" />
              ) : status === "waiting" ? (
                <Pause className="size-4 text-warning-ink" />
              ) : status === "failed" ? (
                <CircleAlert className="size-4 text-destructive" />
              ) : (
                <span className="size-1.5 rounded-full bg-border" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {c.steps[step]}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {c.stepStatus[status] ?? status}
                {status === "completed" && info?.duration_ms
                  ? ` · ${(info.duration_ms / 1000).toFixed(1)} s`
                  : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type Draft = Record<string, { value: string; skip: boolean }>;

export function QuestionsCard({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const qc = useQueryClient();
  const questions = kit.intake.questions;
  const [draft, setDraft] = useState<Draft>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const answer = useMutation({
    mutationFn: (answers: AnswerInput[]) =>
      campaignsService.answer(kit.id, answers, message),
    onSuccess: (next) => {
      qc.setQueryData(campaignKeys.detail(kit.id), next);
      void qc.invalidateQueries({ queryKey: campaignKeys.list() });
      setDraft({});
      setMessage("");
    },
    onError: (e) => setError(e.message),
  });
  const set = (id: string, patch: Partial<Draft[string]>) =>
    setDraft((d) => ({
      ...d,
      [id]: { value: d[id]?.value ?? "", skip: d[id]?.skip ?? false, ...patch },
    }));
  const submit = () => {
    setError("");
    const answers: AnswerInput[] = [];
    for (const q of questions) {
      const d = draft[q.id];
      if (d?.skip && !q.required)
        answers.push({ question_id: q.id, skip: true });
      else if (d?.value.trim())
        answers.push({ question_id: q.id, value: d.value.trim() });
      else if (q.required) return setError(c.questions.required);
      else answers.push({ question_id: q.id, skip: true });
    }
    answer.mutate(answers);
  };
  return (
    <section
      aria-labelledby="questions-title"
      className="rounded-[1.75rem] border-2 border-coral/40 bg-card p-5 shadow-lift md:p-7"
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-coral-tint">
          <MessageCircleQuestion className="size-5 text-coral-ink" />
        </span>
        <div>
          <h2 id="questions-title" className="font-display text-xl font-bold">
            {c.questions.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.questions.sub}
          </p>
        </div>
      </div>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            q={q}
            value={draft[q.id]?.value ?? ""}
            skipped={draft[q.id]?.skip ?? false}
            onChange={(value) => set(q.id, { value, skip: false })}
            onSkip={(skip) => set(q.id, { skip })}
          />
        ))}
        <div className="space-y-1.5">
          <label htmlFor="intake-message" className="text-sm font-medium">
            {c.questions.message}
          </label>
          <TextArea
            id="intake-message"
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-20"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="coral" disabled={answer.isPending}>
          {answer.isPending && <Loader2 className="animate-spin" />}
          {c.questions.submit}
        </Button>
      </form>
    </section>
  );
}

function QuestionField({
  q,
  value,
  skipped,
  onChange,
  onSkip,
}: {
  q: Question;
  value: string;
  skipped: boolean;
  onChange: (v: string) => void;
  onSkip: (skip: boolean) => void;
}) {
  const c = useKitCopy();
  const id = `q-${q.id}`;
  return (
    <div className={cn("space-y-2", skipped && "opacity-60")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-medium">
          {q.text}
          {q.required && <span className="text-coral-ink"> *</span>}
        </label>
        {!q.required && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onSkip(!skipped)}
            aria-pressed={skipped}
          >
            {skipped ? c.questions.undo : c.questions.skip}
          </Button>
        )}
      </div>
      {skipped ? (
        <p className="text-sm italic text-muted-foreground">
          {c.questions.skipped}
        </p>
      ) : (
        <>
          <div className="relative">
            <input
              id={id}
              className={cn(inputClass, q.unit && "pr-16")}
              inputMode={q.kind === "number" ? "decimal" : undefined}
              value={value}
              maxLength={1000}
              onChange={(e) => onChange(e.target.value)}
            />
            {q.unit && (
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {q.unit}
              </span>
            )}
          </div>
          {q.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={value === o.value}
                  onClick={() => onChange(o.value)}
                  className="min-h-9 rounded-full border border-border bg-card px-3 text-sm transition-colors hover:border-foreground/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
    </div>
  );
}

export function AnswersHistory({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const answers = kit.intake.answers;
  if (!answers.length) return null;
  return (
    <details className="rounded-2xl border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        {c.questions.history} ({answers.length})
      </summary>
      <ul className="mt-3 space-y-2">
        {answers.map((a, i) => (
          <li key={`${a.question_id}-${i}`} className="grid gap-0.5">
            {a.question && (
              <span className="text-muted-foreground">{a.question}</span>
            )}
            <span className="font-medium">
              {a.skipped ? (
                <em className="font-normal">{c.questions.skipped}</em>
              ) : (
                a.value
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Assumptions({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  if (!kit.intake.assumptions.length) return null;
  return (
    <Notice tone="warn">
      <p className="font-semibold">{c.header.assumptions}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {kit.intake.assumptions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </Notice>
  );
}
