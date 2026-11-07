import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clapperboard,
  Download,
  Film,
  Loader2,
  Music,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextArea, inputClass } from "@/components/campio/Field";
import { campaignsService } from "@/services/campaigns";
import {
  assetsQuery,
  campaignKeys,
  editQuery,
  editsQuery,
  videoModelsQuery,
} from "@/services/queries";
import {
  pricePerSecond,
  type Asset,
  type Edit,
  type Kit,
  type VideoConcept,
} from "@/services/kit";
import { formatRelative } from "@/i18n";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import { Notice, Panel, Pending, VideoFrame, mediaUrl, usd } from "./ui";

type Role = "product_image" | "logo" | "music" | "footage";
const ROLES: Role[] = ["product_image", "logo", "music", "footage"];
const ACCEPT: Record<Role, string> = {
  product_image: "image/*",
  logo: "image/*",
  music: "audio/*",
  footage: "video/*,image/*",
};

export function VideoTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const content = kit.content;
  const assets = useQuery(assetsQuery(kit.id));
  const models = useQuery(videoModelsQuery());
  const [model, setModel] = useState("");
  useEffect(() => {
    if (!model && models.data?.default_model)
      setModel(models.data.default_model);
  }, [models.data, model]);
  if (!content) return <Pending />;
  const resolution = models.data?.default_resolution || "480p";
  const price = pricePerSecond(
    models.data?.items.find((m) => m.id === model),
    resolution,
  );
  const list = assets.data ?? [];
  return (
    <div className="space-y-5">
      <Uploads kit={kit} assets={list} />
      <Panel title={c.video.model}>
        {models.isError ? (
          <Notice tone="warn">{c.video.modelsError}</Notice>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label={c.video.model}
              className={cn(inputClass, "max-w-md")}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!models.data}
            >
              {models.data?.items.map((m) => {
                const p = pricePerSecond(m, resolution);
                return (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                    {p != null ? ` · ${usd(p)}/s` : ""}
                  </option>
                );
              })}
            </select>
            <span className="text-sm text-muted-foreground">
              {c.video.resolution}: {resolution} ·{" "}
              {models.data?.default_aspect_ratio || "9:16"}
            </span>
          </div>
        )}
      </Panel>
      <div className="space-y-5">
        {content.video_concepts.map((concept) => (
          <ConceptCard
            key={concept.id}
            kit={kit}
            concept={concept}
            clips={list.filter(
              (a) => a.kind === "generated" && a.meta.concept_id === concept.id,
            )}
            model={model}
            pricePerSecond={price}
          />
        ))}
      </div>
      <EditsList kit={kit} assets={list} />
    </div>
  );
}

function Uploads({ kit, assets }: { kit: Kit; assets: Asset[] }) {
  const c = useKitCopy();
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>("product_image");
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => campaignsService.upload(kit.id, file, role),
    onSuccess: () => {
      toast.success(c.video.uploaded);
      void qc.invalidateQueries({ queryKey: campaignKeys.assets(kit.id) });
    },
    onError: (e) => toast.error(e.message),
  });
  const uploads = assets.filter((a) => a.kind === "upload");
  return (
    <Panel title={c.video.uploads}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        {c.video.uploadHint}
      </p>
      {uploads.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-3">
          {uploads.map((a) => (
            <li key={a.id} className="w-28 text-center text-[11px]">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-secondary">
                {a.mime.startsWith("image/") && a.status === "completed" ? (
                  <img
                    src={mediaUrl(a.content_url)}
                    alt={a.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : a.mime.startsWith("audio/") ? (
                  <Music className="size-6 text-muted-foreground" />
                ) : (
                  <Film className="size-6 text-muted-foreground" />
                )}
              </div>
              <p className="mt-1 truncate">{c.video.roles[a.role] ?? a.role}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={c.video.roles[role]}
          className={cn(inputClass, "h-11 w-auto")}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {c.video.roles[r]}
            </option>
          ))}
        </select>
        <input
          ref={input}
          type="file"
          accept={ACCEPT[role]}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          onClick={() => input.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          {c.video.upload}
        </Button>
      </div>
    </Panel>
  );
}

function ConceptCard({
  kit,
  concept,
  clips,
  model,
  pricePerSecond: price,
}: {
  kit: Kit;
  concept: VideoConcept;
  clips: Asset[];
  model: string;
  pricePerSecond: number | null;
}) {
  const c = useKitCopy();
  const qc = useQueryClient();
  const [instructions, setInstructions] = useState("");
  const seconds = concept.shots.reduce((s, sh) => s + sh.duration_s, 0);
  const persona = kit.strategy?.personas.find(
    (p) => p.id === concept.persona_id,
  )?.name;
  const generate = useMutation({
    mutationFn: () =>
      campaignsService.generateVideos(kit.id, concept.id, model || undefined),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: campaignKeys.assets(kit.id) }),
    onError: (e) => toast.error(e.message),
  });
  const edit = useMutation({
    mutationFn: () =>
      campaignsService.startEdit(kit.id, concept.id, instructions),
    onSuccess: (e) => {
      qc.setQueryData(campaignKeys.edit(e.id), e);
      void qc.invalidateQueries({ queryKey: campaignKeys.edits(kit.id) });
      setInstructions("");
    },
    onError: (e) => toast.error(e.message),
  });
  // Latest clip per shot (a concept may be generated more than once).
  const latest = new Map<number, Asset>();
  for (const a of [...clips].sort((x, y) =>
    x.created_at.localeCompare(y.created_at),
  ))
    latest.set(a.meta.shot_index, a);
  const shown = [...latest.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, a]) => a);
  const busy = shown.some(
    (a) => a.status === "pending" || a.status === "in_progress",
  );
  const ready = shown.filter((a) => a.status === "completed").length;
  return (
    <section className="rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-soft md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {concept.id}
          </p>
          <h3 className="font-display text-xl font-bold">{concept.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {concept.shots.length} {c.video.shots} · {seconds}
            {c.video.seconds}
            {persona && ` · ${persona}`}
            {concept.music_mood && ` · ${c.video.music}: ${concept.music_mood}`}
          </p>
        </div>
        <div className="text-right">
          {price != null && (
            <p className="mb-2 text-xs text-muted-foreground">
              {c.video.estimate}:{" "}
              <b className="text-foreground">{usd(price * seconds)}</b>
            </p>
          )}
          <Button
            variant="coral"
            onClick={() => generate.mutate()}
            disabled={generate.isPending || busy}
          >
            {generate.isPending || busy ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Clapperboard />
            )}
            {shown.length ? c.video.regenerate : c.video.generate}
          </Button>
        </div>
      </header>
      {concept.hook && (
        <p className="mt-4 rounded-2xl bg-navy p-3 text-sm text-cream">
          <span className="mr-1 font-semibold text-cream/60">
            {c.video.hook}:
          </span>
          {concept.hook}
        </p>
      )}
      <ol className="-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {concept.shots.map((shot, i) => {
          const clip = latest.get(i);
          return (
            <li key={i} className="w-40 shrink-0 snap-start sm:w-44">
              <VideoFrame
                src={
                  clip?.status === "completed"
                    ? mediaUrl(clip.content_url)
                    : undefined
                }
                {...(clip?.width ? { width: clip.width } : {})}
                {...(clip?.height ? { height: clip.height } : {})}
              >
                {clip?.status === "failed" ? (
                  <p className="p-3 text-center text-xs text-red-200">
                    {c.video.failed}
                    {clip.error && `: ${clip.error}`}
                  </p>
                ) : clip ? (
                  <p className="flex items-center gap-2 text-xs text-white/80">
                    <Loader2 className="size-4 animate-spin" />
                    {c.video.pending}
                  </p>
                ) : (
                  <span className="grid justify-items-center gap-2 p-3 text-center text-xs text-white/60">
                    <Film className="size-6" />
                    {c.video.notGenerated}
                  </span>
                )}
              </VideoFrame>
              <div className="pt-2 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">
                  #{i + 1} · {shot.duration_s}
                  {c.video.seconds}
                </p>
                <p className="mt-1">{shot.description}</p>
                {shot.caption && (
                  <p className="mt-2 rounded-lg bg-surface px-2 py-1 text-xs font-medium">
                    “{shot.caption}”
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {concept.end_card_lines.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {c.video.endCard}: {concept.end_card_lines.join(" · ")}
        </p>
      )}
      <div className="mt-5 rounded-2xl border border-dashed border-border p-4">
        <p className="mb-2 flex items-center gap-2 font-semibold">
          <Wand2 className="size-4 text-coral-ink" />
          {c.video.edit}
        </p>
        {ready === 0 ? (
          <p className="text-sm text-muted-foreground">{c.video.needClips}</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              edit.mutate();
            }}
          >
            <label
              htmlFor={`instr-${concept.id}`}
              className="text-sm text-muted-foreground"
            >
              {c.video.instructions}
            </label>
            <TextArea
              id={`instr-${concept.id}`}
              className="min-h-20"
              maxLength={4000}
              placeholder={c.video.instructionsPlaceholder}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            <Button type="submit" disabled={edit.isPending || busy}>
              {edit.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Wand2 />
              )}
              {c.video.startEdit}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

function EditsList({ kit, assets }: { kit: Kit; assets: Asset[] }) {
  const c = useKitCopy();
  const edits = useQuery(editsQuery(kit.id));
  const items = [...(edits.data ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  if (!items.length) return null;
  return (
    <Panel title={c.video.edits}>
      <div className="space-y-4">
        {items.map((e, i) => (
          <EditCard
            key={e.id}
            kit={kit}
            initial={e}
            assets={assets}
            open={i === 0}
          />
        ))}
      </div>
    </Panel>
  );
}

function EditCard({
  kit,
  initial,
  assets,
  open,
}: {
  kit: Kit;
  initial: Edit;
  assets: Asset[];
  open: boolean;
}) {
  const c = useKitCopy();
  const qc = useQueryClient();
  const live = useQuery({ ...editQuery(initial.id), initialData: initial });
  const e = live.data;
  const prev = useRef(e.status);
  useEffect(() => {
    if (prev.current === "running" && e.status !== "running") {
      void qc.invalidateQueries({ queryKey: campaignKeys.assets(kit.id) });
      void qc.invalidateQueries({ queryKey: campaignKeys.detail(kit.id) });
    }
    prev.current = e.status;
  }, [e.status, kit.id, qc]);
  const output = e.output_asset_id
    ? assets.find((a) => a.id === e.output_asset_id)
    : undefined;
  return (
    <details open={open} className="rounded-2xl border border-border p-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <span className="font-semibold">
          {e.title || e.instructions || c.video.final}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            e.status === "completed"
              ? "bg-success-tint text-success-ink"
              : e.status === "failed"
                ? "bg-destructive/10 text-destructive"
                : "bg-coral-tint text-coral-ink",
          )}
        >
          {e.status === "running"
            ? c.video.editRunning
            : (c.stepStatus[e.status] ?? e.status)}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {e.created_at && formatRelative(e.created_at)}
          {e.cost_usd > 0 && ` · ${usd(e.cost_usd)}`}
        </span>
      </summary>
      <div className="mt-4 grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[240px] md:order-first">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {c.video.final}
          </p>
          {output?.status === "completed" ? (
            <>
              <VideoFrame
                src={mediaUrl(output.content_url)}
                {...(output.width ? { width: output.width } : {})}
                {...(output.height ? { height: output.height } : {})}
              />
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-2 w-full"
              >
                <a href={mediaUrl(output.content_url, true)}>
                  <Download />
                  {c.video.download}
                </a>
              </Button>
            </>
          ) : (
            <VideoFrame>
              {e.status === "running" ? (
                <p className="flex items-center gap-2 text-xs text-white/80">
                  <Loader2 className="size-4 animate-spin" />
                  {c.video.editRunning}
                </p>
              ) : (
                <span className="grid justify-items-center gap-2 p-3 text-center text-xs text-white/60">
                  <Film className="size-6" />
                  {e.status === "failed" ? c.video.failed : c.video.pending}
                </span>
              )}
            </VideoFrame>
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {c.video.editLog}
          </p>
          <ol className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {e.steps.map((s, i) => (
              <li key={i} className="text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.video.stepTypes[s.type] ?? s.type}
                </p>
                {s.type === "script" ? (
                  <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-navy p-3 text-[11px] leading-relaxed text-cream">
                    <code>{s.content}</code>
                  </pre>
                ) : (
                  <p
                    className={cn(
                      "mt-0.5 whitespace-pre-line",
                      s.type === "error" && "text-destructive",
                    )}
                  >
                    {s.content}
                  </p>
                )}
              </li>
            ))}
            {e.status === "running" && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {c.video.editRunning}
              </li>
            )}
          </ol>
          {e.error && (
            <p className="mt-2 text-sm text-destructive">{e.error}</p>
          )}
          {e.notes && <Notice>{e.notes}</Notice>}
        </div>
      </div>
    </details>
  );
}
