import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/campio/CopyButton";
import {
  Field,
  TextArea,
  TextInput,
  inputClass,
} from "@/components/campio/Field";
import { campaignsService } from "@/services/campaigns";
import {
  assetsQuery,
  campaignKeys,
  imageModelsQuery,
} from "@/services/queries";
import {
  isAssetActive,
  type Asset,
  type Kit,
  type PosterConcept,
} from "@/services/kit";
import { cn } from "@/lib/utils";
import { useKitCopy } from "./copy";
import { Notice, Panel, Pending, lei, mediaUrl, usd } from "./ui";

type Settings = { model: string; aspect: string; showPrice: boolean };
type Overrides = { headline: string; subline: string; cta: string };

const byNewest = (a: Asset, b: Asset) =>
  b.created_at.localeCompare(a.created_at);

export function PosterTab({ kit }: { kit: Kit }) {
  const c = useKitCopy();
  const content = kit.content;
  const assets = useQuery(assetsQuery(kit.id));
  const models = useQuery(imageModelsQuery());
  const [settings, setSettings] = useState<Settings>({
    model: "",
    aspect: "",
    showPrice: true,
  });
  useEffect(() => {
    if (!models.data) return;
    setSettings((s) => ({
      ...s,
      model: s.model || models.data.default_model,
      aspect: s.aspect || models.data.default_aspect_ratio || "4:5",
    }));
  }, [models.data]);
  if (!content) return <Pending />;

  const list = assets.data ?? [];
  const posters = list.filter((a) => a.kind === "poster").sort(byNewest);
  const hasPhoto = list.some(
    (a) =>
      a.kind === "upload" &&
      a.role === "product_image" &&
      a.status === "completed",
  );
  const price =
    settings.showPrice && kit.input.sale_price > 0
      ? lei(kit.input.sale_price, 2)
      : "";
  const aspects = models.data?.aspect_ratios.length
    ? models.data.aspect_ratios
    : ["4:5", "1:1", "9:16", "16:9"];

  return (
    <div className="space-y-5">
      <Panel title={c.posters.model}>
        {models.isError ? (
          <Notice tone="warn">{c.posters.modelsError}</Notice>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <select
              aria-label={c.posters.model}
              className={cn(inputClass, "max-w-md")}
              value={settings.model}
              onChange={(e) =>
                setSettings((s) => ({ ...s, model: e.target.value }))
              }
              disabled={!models.data}
            >
              {models.data?.items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
            <select
              aria-label={c.posters.format}
              className={cn(inputClass, "w-auto")}
              value={settings.aspect}
              onChange={(e) =>
                setSettings((s) => ({ ...s, aspect: e.target.value }))
              }
            >
              {aspects.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-coral"
                checked={settings.showPrice}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, showPrice: e.target.checked }))
                }
              />
              {c.posters.showPrice}
            </label>
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {c.posters.costNote}
        </p>
        <div className="mt-3">
          <Notice tone={hasPhoto ? "info" : "warn"}>
            {hasPhoto ? c.posters.productPhoto : c.posters.noPhoto}
          </Notice>
        </div>
      </Panel>

      {content.poster_concepts.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {content.poster_concepts.map((concept) => (
            <ConceptCard
              key={concept.id}
              kit={kit}
              concept={concept}
              posters={posters.filter((a) => a.meta.concept_id === concept.id)}
              settings={settings}
              price={price}
            />
          ))}
        </div>
      )}

      <CustomPoster
        kit={kit}
        posters={posters.filter((a) => !a.meta.concept_id)}
        settings={settings}
        price={price}
      />
    </div>
  );
}

function useGenerate(kit: Kit) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      body: Parameters<typeof campaignsService.generatePosters>[1],
    ) => campaignsService.generatePosters(kit.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: campaignKeys.assets(kit.id) });
      void qc.invalidateQueries({ queryKey: campaignKeys.detail(kit.id) });
    },
    onError: (e) => toast.error(e.message),
  });
}

const commonBody = (s: Settings) => ({
  ...(s.model ? { model: s.model } : {}),
  ...(s.aspect ? { aspect_ratio: s.aspect } : {}),
  show_price: s.showPrice,
});

function ConceptCard({
  kit,
  concept,
  posters,
  settings,
  price,
}: {
  kit: Kit;
  concept: PosterConcept;
  posters: Asset[];
  settings: Settings;
  price: string;
}) {
  const c = useKitCopy();
  const generate = useGenerate(kit);
  const [text, setText] = useState<Overrides>({
    headline: concept.headline,
    subline: concept.subline,
    cta: concept.cta,
  });
  const persona = kit.strategy?.personas.find(
    (p) => p.id === concept.persona_id,
  )?.name;
  const busy = posters.some(isAssetActive);
  const changed = (k: keyof Overrides) =>
    text[k].trim() !== concept[k].trim() ? { [k]: text[k].trim() } : {};
  return (
    <section className="flex flex-col rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-soft md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {concept.id}
            {persona && ` · ${persona}`}
          </p>
          <h3 className="font-display text-xl font-bold">{concept.title}</h3>
        </div>
        <Button
          variant="coral"
          onClick={() =>
            generate.mutate({
              concept_ids: [concept.id],
              ...commonBody(settings),
              ...changed("headline"),
              ...changed("subline"),
              ...changed("cta"),
            })
          }
          disabled={generate.isPending || busy}
        >
          {generate.isPending || busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          {posters.length ? c.posters.regenerate : c.posters.generate}
        </Button>
      </header>

      <div className="mt-4">
        <PosterGallery posters={posters} aspect={settings.aspect} />
      </div>

      <dl className="mt-4 grid gap-1 text-sm">
        <TextRow label={c.posters.headline}>{text.headline}</TextRow>
        <TextRow label={c.posters.subline}>{text.subline}</TextRow>
        <TextRow label={c.posters.cta}>{text.cta}</TextRow>
        {price && (
          <TextRow label={c.posters.price}>
            {price}{" "}
            <span className="text-xs text-muted-foreground">
              ({c.posters.priceNote})
            </span>
          </TextRow>
        )}
      </dl>

      <details className="mt-3 rounded-2xl border border-dashed border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          {c.posters.editText}
        </summary>
        <div className="mt-3 grid gap-3">
          <TextFields id={concept.id} value={text} onChange={setText} />
        </div>
      </details>

      {concept.image_prompt && (
        <div className="mt-3 rounded-xl bg-secondary/70 p-3">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            {c.posters.scene}
            <CopyButton
              text={concept.image_prompt}
              size="iconSm"
              variant="ghost"
            />
          </div>
          <p className="font-mono text-xs leading-relaxed">
            {concept.image_prompt}
          </p>
        </div>
      )}
    </section>
  );
}

function CustomPoster({
  kit,
  posters,
  settings,
  price,
}: {
  kit: Kit;
  posters: Asset[];
  settings: Settings;
  price: string;
}) {
  const c = useKitCopy();
  const generate = useGenerate(kit);
  const [scene, setScene] = useState("");
  const [text, setText] = useState<Overrides>({
    headline: "",
    subline: "",
    cta: "",
  });
  const busy = posters.some(isAssetActive);
  return (
    <Panel title={c.posters.custom}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <form
          className="grid content-start gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate({
              prompt: scene.trim(),
              ...commonBody(settings),
              ...(text.headline.trim()
                ? { headline: text.headline.trim() }
                : {}),
              ...(text.subline.trim() ? { subline: text.subline.trim() } : {}),
              ...(text.cta.trim() ? { cta: text.cta.trim() } : {}),
            });
          }}
        >
          <p className="-mt-2 text-sm text-muted-foreground">
            {c.posters.customHint}
          </p>
          <Field id="poster-scene" label={c.posters.scene}>
            <TextArea
              id="poster-scene"
              className="min-h-24"
              maxLength={2000}
              placeholder={c.posters.scenePlaceholder}
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              required
            />
          </Field>
          <TextFields id="custom" value={text} onChange={setText} />
          {price && (
            <p className="text-sm text-muted-foreground">
              {c.posters.price}: <b className="text-foreground">{price}</b> (
              {c.posters.priceNote})
            </p>
          )}
          <div>
            <Button
              type="submit"
              variant="coral"
              disabled={generate.isPending || busy || !scene.trim()}
            >
              {generate.isPending || busy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {c.posters.generate}
            </Button>
          </div>
        </form>
        {posters.length > 0 && (
          <PosterGallery posters={posters} aspect={settings.aspect} />
        )}
      </div>
    </Panel>
  );
}

function TextFields({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Overrides;
  onChange: (v: Overrides) => void;
}) {
  const c = useKitCopy();
  const fields: [keyof Overrides, string, number][] = [
    ["headline", c.posters.headline, 80],
    ["subline", c.posters.subline, 120],
    ["cta", c.posters.cta, 40],
  ];
  return (
    <>
      {fields.map(([k, label, max]) => (
        <Field key={k} id={`${id}-${k}`} label={label}>
          <TextInput
            id={`${id}-${k}`}
            maxLength={max}
            value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: e.target.value })}
          />
        </Field>
      ))}
    </>
  );
}

function TextRow({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

/** The newest poster large, older versions as thumbnails that can be brought to the front. */
function PosterGallery({
  posters,
  aspect,
}: {
  posters: Asset[];
  aspect: string;
}) {
  const c = useKitCopy();
  const [selected, setSelected] = useState<string | null>(null);
  const main = posters.find((p) => p.id === selected) ?? posters[0];
  const others = posters.filter((p) => p.id !== main?.id);
  return (
    <div>
      <PosterFrame asset={main} aspect={aspect} />
      {main?.status === "completed" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={mediaUrl(main.content_url, true)}>
              <Download />
              {c.posters.download}
            </a>
          </Button>
          {main.cost_usd > 0 && (
            <span className="text-xs text-muted-foreground">
              {usd(main.cost_usd)}
            </span>
          )}
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {c.posters.history}
          </p>
          <ul className="flex flex-wrap gap-2">
            {others.map((p) => (
              <li key={p.id} className="w-16">
                <button
                  type="button"
                  className="block w-full rounded-lg ring-coral focus-visible:outline-none focus-visible:ring-2"
                  onClick={() => setSelected(p.id)}
                  aria-label={p.name}
                >
                  <PosterFrame asset={p} aspect={aspect} small />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PosterFrame({
  asset,
  aspect,
  small = false,
}: {
  asset: Asset | undefined;
  aspect: string;
  small?: boolean;
}) {
  const c = useKitCopy();
  const [w, h] = (asset?.meta.aspect_ratio || aspect || "4:5")
    .split(":")
    .map(Number);
  const ratio =
    asset?.width && asset.height
      ? `${asset.width} / ${asset.height}`
      : w && h
        ? `${w} / ${h}`
        : "4 / 5";
  return (
    <div
      className={cn(
        "relative grid w-full place-items-center overflow-hidden bg-secondary",
        small ? "rounded-lg" : "rounded-2xl",
      )}
      style={{ aspectRatio: ratio }}
    >
      {asset?.status === "completed" ? (
        <img
          src={mediaUrl(asset.content_url)}
          alt={asset.meta.headline || asset.name}
          className="absolute inset-0 size-full object-contain"
          loading="lazy"
        />
      ) : small ? (
        asset && isAssetActive(asset) ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" />
        )
      ) : asset?.status === "failed" ? (
        <p className="p-4 text-center text-xs text-destructive">
          {c.posters.failed}
          {asset.error && `: ${asset.error}`}
        </p>
      ) : asset ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {c.posters.pending}
        </p>
      ) : (
        <span className="grid justify-items-center gap-2 p-4 text-center text-xs text-muted-foreground">
          <ImageIcon className="size-6" />
          {c.posters.notGenerated}
        </span>
      )}
    </div>
  );
}
