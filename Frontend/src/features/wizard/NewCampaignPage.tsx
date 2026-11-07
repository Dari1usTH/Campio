import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/campio/Field";
import { PageHeader } from "@/components/campio/Surface";
import {
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_PROMPT,
  campaignsService,
} from "@/services/campaigns";
import { readLocal, writeLocal } from "@/services/api";
import { campaignKeys, demoCasesQuery } from "@/services/queries";
import { fmt } from "@/i18n";
import { useKitCopy } from "@/features/campaign/kit/copy";

const DRAFT_KEY = "campio:prompt-draft";

export default function NewCampaignPage() {
  const c = useKitCopy();
  const n = c.newCampaign;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ strict: false }) as { reuse?: string };
  const [prompt, setPrompt] = useState(() => readLocal(DRAFT_KEY, ""));
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const demos = useQuery(demoCasesQuery());

  // "Reuse" prefills the prompt of an earlier campaign.
  const reuse = useQuery({
    queryKey: campaignKeys.detail(search.reuse ?? ""),
    queryFn: () => campaignsService.get(search.reuse!),
    enabled: !!search.reuse,
  });
  useEffect(() => {
    if (reuse.data?.input.prompt) setPrompt(reuse.data.input.prompt);
  }, [reuse.data]);
  useEffect(() => {
    try {
      writeLocal(DRAFT_KEY, prompt);
    } catch {
      /* storage disabled */
    }
  }, [prompt]);

  const previews = useMemo(
    () => images.map((f) => URL.createObjectURL(f)),
    [images],
  );
  useEffect(
    () => () => previews.forEach((u) => URL.revokeObjectURL(u)),
    [previews],
  );

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setError("");
    const next = [...images];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) {
        setError(fmt(n.notImage, { name: f.name }));
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        setError(fmt(n.tooLarge, { name: f.name }));
        continue;
      }
      if (next.length >= MAX_IMAGES) {
        setError(n.tooMany);
        break;
      }
      next.push(f);
    }
    setImages(next);
  };

  const create = useMutation({
    mutationFn: () => campaignsService.create(prompt, images),
    onSuccess: (kit) => {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage disabled */
      }
      qc.setQueryData(campaignKeys.detail(kit.id), kit);
      void qc.invalidateQueries({ queryKey: campaignKeys.list() });
      void navigate({ to: "/app/campaigns/$id", params: { id: kit.id } });
    },
    onError: (e) => setError(e.message),
  });

  const submit = () => {
    if (!prompt.trim() && images.length === 0) return setError(n.empty);
    setError("");
    create.mutate();
  };

  return (
    <div className="animate-rise">
      <PageHeader title={n.title} sub={n.sub} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="space-y-6 rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-soft md:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="prompt" className="font-semibold">
                {n.label}
              </label>
              <span className="text-xs text-muted-foreground">
                {prompt.length}/{MAX_PROMPT}
              </span>
            </div>
            <TextArea
              id="prompt"
              rows={7}
              maxLength={MAX_PROMPT}
              placeholder={n.placeholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
          </div>

          {demos.data && demos.data.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">{n.examples}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {demos.data.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPrompt(d.prompt)}
                    aria-pressed={prompt === d.prompt}
                    className="rounded-2xl border border-border bg-surface p-3 text-left transition-colors hover:border-foreground/40 aria-pressed:border-primary"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {prompt === d.prompt ? (
                        <Check className="size-4" />
                      ) : (
                        <Sparkles className="size-4 text-coral-ink" />
                      )}
                      {d.title}
                    </span>
                    {d.description && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {d.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="font-semibold">{n.photos}</p>
            <p className="mb-3 text-xs text-muted-foreground">{n.photosHint}</p>
            <div
              className="flex flex-wrap gap-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
            >
              {images.map((f, i) => (
                <figure
                  key={`${f.name}-${i}`}
                  className="relative size-24 overflow-hidden rounded-2xl bg-secondary"
                >
                  <img
                    src={previews[i]}
                    alt={f.name}
                    className="size-full object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 rounded-full bg-navy px-1.5 py-0.5 text-[10px] text-cream">
                      1
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`${n.remove}: ${f.name}`}
                    onClick={() =>
                      setImages((all) => all.filter((_, j) => j !== i))
                    }
                    className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-card/90 shadow-soft"
                  >
                    <X className="size-4" />
                  </button>
                </figure>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="grid size-24 place-items-center rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-coral hover:text-foreground"
                >
                  <span className="grid justify-items-center gap-1 text-[11px]">
                    <ImagePlus className="size-6" />
                    {n.addPhotos}
                  </span>
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="coral"
            size="lg"
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {create.isPending ? n.submitting : n.submit}
          </Button>
        </form>
        <aside className="h-fit rounded-[1.75rem] bg-surface p-6">
          <p className="font-display text-lg font-bold">{n.what}</p>
          <ul className="mt-4 space-y-3 text-sm">
            {n.whatList.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success-ink" />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
