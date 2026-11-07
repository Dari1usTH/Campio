import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  ImagePlus,
  Info,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useT, formatMoney } from "@/i18n";
import { Button } from "@/components/ui/button";
import { AiBadge, Chip, SelectChip } from "@/components/campio/Chip";
import { Field, TextArea, TextInput, inputClass } from "@/components/campio/Field";
import { BottomSheet } from "@/components/campio/BottomSheet";
import { Eyebrow, PageHeader, Surface } from "@/components/campio/Surface";
import { StepProgress } from "@/components/campio/StepProgress";
import { MarketplaceBadge } from "@/components/campio/PlatformIcon";
import { RocketFriend } from "@/components/campio/Illustrations";
import { readLocal, writeLocal, USE_MOCKS } from "@/services/api";
import { campaignsService } from "@/services/campaigns";
import { wizardService } from "@/services/wizard";
import { settingsService } from "@/services/settings";
import { campaignKeys, campaignQuery, settingsQuery } from "@/services/queries";
import {
  marketplaceSchema,
  wizardDraftSchema,
  type Goal,
  type Marketplace,
  type ParseResult,
  type ParsedField,
  type Product,
  type Tone,
  type WizardDraft,
} from "@/services/schemas";
import { cn } from "@/lib/utils";
import { wizardCopy as c } from "./copy";

const DRAFT_KEY = "campio:wizard-draft";
const defaultProduct: Product = {
  name: "",
  category: "",
  price: null,
  currency: "RON",
  shortDescription: "",
  strengths: [],
  audience: "",
  country: "România",
};
const defaultDraft: WizardDraft = {
  rawText: "",
  product: defaultProduct,
  marketplaces: [],
  integrations: [],
  goal: "sales",
  budget: 500,
  tone: "warm",
  durationDays: 30,
};
const integrationNames: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
  mailchimp: "Mailchimp",
  shopify: "Shopify",
};
const goalIcons = { sales: Wallet, awareness: Sparkles, traffic: Target };

export default function WizardPage() {
  const t = useT();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { reuse?: string };
  const client = useQueryClient();
  const [draft, setDraft] = useState<WizardDraft>(defaultDraft);
  const [raw, setRaw] = useState("");
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState(false);
  const [aiFields, setAiFields] = useState<ParsedField[]>([]);
  const [missing, setMissing] = useState<ParsedField[]>([]);
  const [error, setError] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reused = useRef<string | null>(null);
  const settings = useQuery(settingsQuery());
  const reuse = useQuery({ ...campaignQuery(search.reuse ?? ""), enabled: !!search.reuse });

  useEffect(() => {
    const saved = readLocal<{
      draft: WizardDraft;
      raw: string;
      step: number;
      parsed: boolean;
    } | null>(DRAFT_KEY, null);
    if (saved && wizardDraftSchema.safeParse(saved.draft).success) {
      setDraft(saved.draft);
      setRaw(saved.raw || "");
      setStep(Math.min(3, Math.max(0, saved.step || 0)));
      setParsed(!!saved.parsed);
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        writeLocal(DRAFT_KEY, { draft, raw, step, parsed });
      } catch {
        /* Image storage can exceed the browser quota; keep working in memory. */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, raw, step, parsed, hydrated]);
  useEffect(() => {
    if (!reuse.data || reused.current === reuse.data.id) return;
    const old = reuse.data;
    setDraft({
      rawText: old.product.shortDescription,
      product: old.product,
      marketplaces: old.marketplaces,
      integrations: [],
      goal: old.goal,
      budget: old.budget,
      tone: old.tone,
      durationDays: old.durationDays,
    });
    setRaw(old.product.shortDescription);
    setParsed(true);
    setStep(0);
    reused.current = old.id;
  }, [reuse.data]);

  const setProduct = <K extends keyof Product>(key: K, value: Product[K]) => {
    setDraft((prev) => ({ ...prev, product: { ...prev.product, [key]: value } }));
    setError("");
  };
  const parse = useMutation({
    mutationFn: () => wizardService.parseProduct(raw),
    onSuccess: (result: ParseResult) => {
      setDraft((prev) => ({
        ...prev,
        product: {
          ...result.product,
          ...(prev.product.photoUrl ? { photoUrl: prev.product.photoUrl } : {}),
          ...(prev.product.link ? { link: prev.product.link } : {}),
        },
      }));
      setAiFields(result.aiFields);
      setMissing(result.missing);
      setParsed(true);
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const create = useMutation({
    mutationFn: () => campaignsService.create(wizardDraftSchema.parse({ ...draft, rawText: raw })),
    onSuccess: ({ id }) => {
      localStorage.removeItem(DRAFT_KEY);
      void client.invalidateQueries({ queryKey: campaignKeys.all });
      void navigate({ to: "/app/generating/$id", params: { id } });
    },
    onError: (e) => setError(e.message || c.error),
  });
  const integration = useMutation({
    mutationFn: async (id: string) => {
      const old = settings.data;
      if (!old) throw new Error(c.error);
      const next = old.integrations[id] === "connected" ? "available" : "connected";
      await settingsService.update({ integrations: { ...old.integrations, [id]: next } });
      return { id, connected: next === "connected" };
    },
    onSuccess: ({ id, connected }) => {
      setDraft((prev) => ({
        ...prev,
        integrations: connected
          ? [...new Set([...prev.integrations, id])]
          : prev.integrations.filter((x) => x !== id),
      }));
      void client.invalidateQueries({ queryKey: ["settings"] });
      toast.success(connected ? c.simulationConnect : c.simulationDisconnect);
    },
    onError: (e) => toast.error(e.message),
  });

  function next() {
    if (step === 0 && !draft.product.name.trim()) return setError(t.wizard.errorProduct);
    if (step === 0 && !draft.product.shortDescription.trim()) return setError(c.missingDescription);
    if (step === 0 && draft.product.link) {
      try {
        const u = new URL(draft.product.link);
        if (!/^https?:$/.test(u.protocol)) return setError(c.invalidLink);
      } catch {
        return setError(c.invalidLink);
      }
    }
    if (step === 1 && draft.marketplaces.length === 0) return setError(t.wizard.errorMarketplace);
    if (step === 2 && (!Number.isFinite(draft.budget) || draft.budget < 50 || draft.budget > 20000))
      return setError(c.invalidBudget);
    setError("");
    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function upload(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error(c.photoError);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProduct("photoUrl", String(reader.result));
    reader.onerror = () => toast.error(c.photoError);
    reader.readAsDataURL(file);
  }
  function reset() {
    setDraft(defaultDraft);
    setRaw("");
    setParsed(false);
    setAiFields([]);
    setMissing([]);
    setStep(0);
    setError("");
    localStorage.removeItem(DRAFT_KEY);
  }
  const label = (key: ParsedField) => (
    <span className="inline-flex items-center gap-2">
      {t.wizard.fields[key]}
      {aiFields.includes(key) && <AiBadge />}
    </span>
  );
  const summary = <CampaignSummary draft={draft} />;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={t.wizard.title}
        sub={c.eyebrow}
        actions={
          <Button variant="ghost" onClick={reset}>
            <RotateCcw />
            {c.startAgain}
          </Button>
        }
      />
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px] dual-split">
        <div className="min-w-0 space-y-6">
          <Surface className="!rounded-[28px] !p-5 sm:!p-7">
            <StepProgress
              steps={t.wizard.steps}
              current={step}
              onStepClick={(s) => {
                setStep(s);
                setError("");
              }}
            />
          </Surface>
          <Surface className="min-w-0 !p-5 sm:!p-8">
            <div key={step} className="animate-rise">
              <Eyebrow className="mb-2 text-coral-ink">
                {t.wizard.stepOf.replace("{n}", String(step + 1))}
              </Eyebrow>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">
                {[t.wizard.s1Title, t.wizard.s2Title, t.wizard.s3Title, t.wizard.s4Title][step]}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {[t.wizard.s1Sub, t.wizard.s2Sub, t.wizard.s3Sub, t.wizard.s4Sub][step]}
              </p>

              {step === 0 && (
                <div className="mt-7 space-y-7">
                  <div className="space-y-3">
                    <label htmlFor="product-description" className="sr-only">
                      {t.wizard.s1Sub}
                    </label>
                    <div className="relative">
                      <TextArea
                        id="product-description"
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                        placeholder={t.wizard.s1Ph}
                        className="min-h-44 !rounded-3xl !bg-surface !p-5 !pb-14 text-base leading-relaxed"
                        maxLength={5000}
                      />
                      <span className="absolute bottom-4 right-5 text-xs text-muted-foreground">
                        {raw.length} / 5.000
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        className="min-h-11 text-sm font-medium text-coral-ink underline-offset-4 hover:underline"
                        onClick={() => setRaw(c.exampleText)}
                      >
                        {c.example}
                      </button>
                      <Button
                        onClick={() =>
                          raw.trim().length < 10 ? setError(c.parseError) : parse.mutate()
                        }
                        disabled={parse.isPending}
                        variant="default"
                      >
                        {parse.isPending ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                        {parse.isPending
                          ? t.wizard.analyzing
                          : parsed
                            ? t.wizard.reanalyze
                            : t.wizard.analyze}
                      </Button>
                    </div>
                    {!parsed && (
                      <button
                        type="button"
                        onClick={() => setParsed(true)}
                        className="min-h-11 text-sm text-muted-foreground underline underline-offset-4"
                      >
                        {c.manual}
                      </button>
                    )}
                  </div>
                  {parse.isPending && (
                    <div className="grid grid-cols-2 gap-4" aria-label={t.wizard.analyzing}>
                      {[0, 1, 2, 3].map((n) => (
                        <div key={n} className="skeleton-shimmer h-16 rounded-2xl" />
                      ))}
                    </div>
                  )}
                  {parsed && !parse.isPending && (
                    <div className="space-y-5 border-t border-border pt-6 animate-rise">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-xl font-semibold">
                          {t.wizard.parsedTitle}
                        </h3>
                        <AiBadge label={USE_MOCKS ? t.common.demo : t.common.aiWritten} />
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {USE_MOCKS ? c.aiHint : t.wizard.parsedSub}
                      </p>
                      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <Field id="product-name" label={label("name")}>
                          <TextInput
                            id="product-name"
                            value={draft.product.name}
                            onChange={(e) => setProduct("name", e.target.value)}
                            required
                            maxLength={100}
                          />
                        </Field>
                        <Field id="product-category" label={label("category")}>
                          <TextInput
                            id="product-category"
                            value={draft.product.category}
                            onChange={(e) => setProduct("category", e.target.value)}
                            maxLength={100}
                          />
                        </Field>
                        <Field
                          id="product-price"
                          label={label("price")}
                          hint={
                            missing.includes("price") && draft.product.price === null
                              ? t.wizard.missing.price
                              : undefined
                          }
                        >
                          <TextInput
                            id="product-price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.product.price ?? ""}
                            placeholder="89"
                            onChange={(e) =>
                              setProduct(
                                "price",
                                e.target.value === "" ? null : Number(e.target.value),
                              )
                            }
                          />
                        </Field>
                        <Field id="product-currency" label={t.wizard.fields.currency}>
                          <select
                            id="product-currency"
                            value={draft.product.currency}
                            className={inputClass}
                            onChange={(e) => setProduct("currency", e.target.value)}
                          >
                            <option value="RON">RON · Lei</option>
                            <option value="EUR">EUR · Euro</option>
                            <option value="USD">USD · Dolari</option>
                          </select>
                        </Field>
                        <Field
                          id="product-short-description"
                          label={label("shortDescription")}
                          className="sm:col-span-2"
                        >
                          <TextArea
                            id="product-short-description"
                            value={draft.product.shortDescription}
                            onChange={(e) => setProduct("shortDescription", e.target.value)}
                            maxLength={1000}
                          />
                        </Field>
                        <Field
                          id="product-strengths"
                          label={label("strengths")}
                          hint={c.strengthHint}
                          className="sm:col-span-2"
                        >
                          <TextInput
                            id="product-strengths"
                            value={draft.product.strengths.join(",")}
                            onChange={(e) => setProduct("strengths", e.target.value.split(","))}
                            placeholder="Lucrat manual, ingrediente naturale"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            {draft.product.strengths
                              .filter((s) => s.trim())
                              .map((s, i) => (
                                <Chip key={i} variant="coral" size="sm">
                                  {s.trim()}
                                </Chip>
                              ))}
                          </div>
                        </Field>
                        <Field id="product-audience" label={label("audience")}>
                          <TextInput
                            id="product-audience"
                            value={draft.product.audience}
                            onChange={(e) => setProduct("audience", e.target.value)}
                            maxLength={200}
                          />
                        </Field>
                        <Field id="product-country" label={label("country")}>
                          <TextInput
                            id="product-country"
                            value={draft.product.country}
                            onChange={(e) => setProduct("country", e.target.value)}
                            maxLength={80}
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-[140px_1fr]">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed border-border bg-surface text-muted-foreground transition hover:border-coral hover:text-foreground"
                        aria-label={
                          draft.product.photoUrl ? t.wizard.photoChange : t.wizard.photoUpload
                        }
                      >
                        {draft.product.photoUrl ? (
                          <img
                            src={draft.product.photoUrl}
                            alt={draft.product.name || t.wizard.photo}
                            className="size-full object-cover"
                          />
                        ) : (
                          <>
                            <ImagePlus className="size-7" />
                            <span className="px-2 text-center text-xs">{t.wizard.photoUpload}</span>
                          </>
                        )}
                      </button>
                      {draft.product.photoUrl && (
                        <button
                          type="button"
                          className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-card shadow-soft"
                          aria-label={c.photoRemove}
                          onClick={() => setProduct("photoUrl", "")}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => upload(e.target.files?.[0])}
                      />
                    </div>
                    <div className="self-center">
                      <h3 className="font-medium">
                        {t.wizard.photo}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {t.common.optional}
                        </span>
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {t.wizard.photoHint} · Max. 2 MB
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload />
                        {draft.product.photoUrl ? t.wizard.photoChange : t.wizard.photoUpload}
                      </Button>
                    </div>
                  </div>
                  <Field
                    id="product-link"
                    label={
                      <>
                        {t.wizard.fields.link}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {t.common.optional}
                        </span>
                      </>
                    }
                  >
                    <TextInput
                      id="product-link"
                      type="url"
                      value={draft.product.link ?? ""}
                      onChange={(e) => setProduct("link", e.target.value)}
                      placeholder={t.wizard.linkPh}
                    />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="mt-7 space-y-8">
                  <div
                    className="grid gap-3 sm:grid-cols-2"
                    role="group"
                    aria-label={t.wizard.s2Title}
                  >
                    {marketplaceSchema.options.map((id: Marketplace) => {
                      const selected = draft.marketplaces.includes(id);
                      return (
                        <button
                          type="button"
                          key={id}
                          aria-pressed={selected}
                          onClick={() => {
                            setDraft((prev) => ({
                              ...prev,
                              marketplaces: selected
                                ? prev.marketplaces.filter((x) => x !== id)
                                : [...prev.marketplaces, id],
                            }));
                            setError("");
                          }}
                          className={cn(
                            "relative flex min-h-28 items-center gap-3 rounded-3xl border-2 p-4 text-left transition-all hover:-translate-y-0.5",
                            selected
                              ? "border-foreground bg-primary text-primary-foreground shadow-soft"
                              : "border-border bg-surface hover:border-foreground/30",
                          )}
                        >
                          <MarketplaceBadge
                            id={id}
                            className={
                              selected
                                ? "bg-primary-foreground/10 text-primary-foreground"
                                : "bg-card text-foreground"
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                              {t.wizard.marketplaces[id].name}
                            </span>
                            <span
                              className={cn(
                                "mt-1 block text-xs leading-relaxed",
                                selected ? "text-primary-foreground/70" : "text-muted-foreground",
                              )}
                            >
                              {t.wizard.marketplaces[id].d}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "absolute right-3 top-3 grid size-5 place-items-center rounded-full border",
                              selected ? "border-coral bg-coral text-navy" : "border-border",
                            )}
                          >
                            {selected && <Check className="size-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.marketplaceHint}</p>
                  <div className="border-t border-border pt-6">
                    <h3 className="font-display text-xl font-semibold">
                      {t.wizard.integrationsTitle}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{t.wizard.integrationsSub}</p>
                    <div className="mt-4 divide-y divide-border">
                      {Object.entries(integrationNames).map(([id, name]) => {
                        const status = settings.data?.integrations[id] ?? "available";
                        return (
                          <div key={id} className="flex items-center justify-between gap-2 py-3">
                            <span className="text-sm font-medium">{name}</span>
                            <Button
                              variant={status === "connected" ? "secondary" : "outline"}
                              size="sm"
                              disabled={
                                status === "soon" || integration.isPending || !settings.data
                              }
                              onClick={() => integration.mutate(id)}
                            >
                              {status === "connected" && <Check />}
                              {status === "soon"
                                ? t.common.soon
                                : status === "connected"
                                  ? `${t.common.connected} · ${t.common.demo}`
                                  : `${t.common.connect} · ${t.common.demo}`}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      {c.demo}
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="mt-7 space-y-8">
                  <fieldset>
                    <legend className="mb-3 text-sm font-semibold">{t.wizard.goal}</legend>
                    <div className="flex flex-wrap gap-2">
                      {(["sales", "awareness", "traffic"] as Goal[]).map((goal) => {
                        const Icon = goalIcons[goal];
                        return (
                          <SelectChip
                            key={goal}
                            selected={draft.goal === goal}
                            onToggle={() => setDraft((p) => ({ ...p, goal }))}
                            showCheck={false}
                          >
                            <Icon />
                            {t.wizard.goals[goal]}
                          </SelectChip>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="rounded-3xl bg-surface p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <label htmlFor="campaign-budget" className="pt-2 text-sm font-semibold">
                        {t.wizard.budget}
                      </label>
                      <div className="flex items-center gap-2">
                        <TextInput
                          id="campaign-budget"
                          type="number"
                          min="50"
                          max="20000"
                          step="50"
                          className="!h-12 !w-28 !border-0 !bg-card font-display text-2xl font-bold"
                          value={draft.budget}
                          onChange={(e) => {
                            setDraft((p) => ({ ...p, budget: Number(e.target.value) }));
                            setError("");
                          }}
                        />
                        <span className="text-sm font-medium">RON</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="20000"
                      step="50"
                      value={draft.budget}
                      aria-label={t.wizard.budget}
                      onChange={(e) => setDraft((p) => ({ ...p, budget: Number(e.target.value) }))}
                      className="my-5 h-2 w-full cursor-pointer accent-[var(--coral)]"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>50 lei</span>
                      <span>20.000 lei</span>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      {t.wizard.budgetHint}
                    </p>
                  </div>
                  <fieldset>
                    <legend className="mb-3 text-sm font-semibold">{t.wizard.tone}</legend>
                    <div className="flex flex-wrap gap-2">
                      {(["warm", "premium", "playful", "direct"] as Tone[]).map((tone) => (
                        <SelectChip
                          key={tone}
                          selected={draft.tone === tone}
                          onToggle={() => setDraft((p) => ({ ...p, tone }))}
                        >
                          {t.wizard.tones[tone]}
                        </SelectChip>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-3 text-sm font-semibold">{t.wizard.duration}</legend>
                    <div className="flex flex-wrap gap-2">
                      {([7, 14, 30, 60] as const).map((durationDays) => (
                        <SelectChip
                          key={durationDays}
                          selected={draft.durationDays === durationDays}
                          onToggle={() => setDraft((p) => ({ ...p, durationDays }))}
                          showCheck={false}
                        >
                          {t.wizard.durations[durationDays]}
                        </SelectChip>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {step === 3 && (
                <div className="mt-7 space-y-6">
                  <div className="overflow-hidden rounded-3xl bg-surface">
                    <div className="flex items-center gap-4 p-5">
                      {draft.product.photoUrl ? (
                        <img
                          src={draft.product.photoUrl}
                          alt={draft.product.name}
                          className="size-20 rounded-2xl object-cover"
                        />
                      ) : (
                        <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-coral-tint">
                          <Store className="size-8 text-coral-ink" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <Chip variant="success" size="sm">
                          <Check />
                          {c.ready}
                        </Chip>
                        <h3 className="mt-2 break-words font-display text-2xl font-bold">
                          {draft.product.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {draft.product.price !== null
                            ? formatMoney(draft.product.price, draft.product.currency)
                            : c.noPrice}
                        </p>
                      </div>
                    </div>
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                      {draft.product.shortDescription}
                    </p>
                    <dl className="grid grid-cols-2 gap-5 border-t border-border p-5">
                      <div>
                        <dt className="text-xs text-muted-foreground">{t.wizard.goal}</dt>
                        <dd className="mt-1 font-semibold">{t.wizard.goals[draft.goal]}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t.wizard.budget}</dt>
                        <dd className="mt-1 font-semibold">{formatMoney(draft.budget)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t.wizard.tone}</dt>
                        <dd className="mt-1 font-semibold">{t.wizard.tones[draft.tone]}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t.wizard.duration}</dt>
                        <dd className="mt-1 font-semibold">{draft.durationDays} zile</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-muted-foreground">{c.channels}</dt>
                        <dd className="mt-2 flex flex-wrap gap-2">
                          {draft.marketplaces.map((id) => (
                            <Chip key={id} variant="outline" size="sm">
                              {t.wizard.marketplaces[id].name}
                            </Chip>
                          ))}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <Surface tone="coralSoft" className="flex items-center gap-4 !rounded-3xl">
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-coral">
                      <Sparkles className="size-6 text-navy" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{c.deliverables}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {c.deliverablesHint}
                      </p>
                    </div>
                  </Surface>
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <ShieldCheck className="size-4 shrink-0" />
                    {c.generateHint}
                  </p>
                </div>
              )}
            </div>
            {error && (
              <p
                role="alert"
                className="mt-5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
              {step > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep((s) => s - 1);
                    setError("");
                  }}
                  disabled={create.isPending}
                >
                  <ArrowLeft />
                  {t.common.back}
                </Button>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCheck className="size-4" />
                  {c.saved}
                </p>
              )}
              {step < 3 ? (
                <Button onClick={next} disabled={parse.isPending || (step === 0 && !parsed)}>
                  {t.common.continue}
                  <ArrowRight />
                </Button>
              ) : (
                <Button
                  variant="coral"
                  size="lg"
                  className="max-sm:w-full"
                  onClick={() => create.mutate()}
                  disabled={create.isPending}
                >
                  {create.isPending ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                  {create.isPending ? t.common.loading : t.wizard.generate}
                  <ArrowRight />
                </Button>
              )}
            </div>
          </Surface>
          <p className="pb-3 text-center text-xs text-muted-foreground">
            {USE_MOCKS ? c.demo : c.info}
          </p>
        </div>
        <aside className="sticky top-28 hidden min-w-0 space-y-5 lg:block">
          {summary}
          <Surface tone="navy" className="overflow-hidden !p-6">
            <div className="absolute -right-8 -top-10 size-36 rounded-full border-[20px] border-cream/5" />
            <RocketFriend className="mb-2 w-24" />
            <h3 className="font-display text-2xl font-semibold">{c.deliverables}</h3>
            <p className="mt-3 text-sm leading-relaxed text-cream/70">{c.deliverablesHint}</p>
          </Surface>
        </aside>
      </div>
      <div className="mt-4 lg:hidden">
        <Button variant="outline" className="w-full bg-card" onClick={() => setSummaryOpen(true)}>
          <Store />
          {t.wizard.summaryOpen}
          <ChevronRight className="ml-auto" />
        </Button>
      </div>
      <BottomSheet title={t.wizard.summaryTitle} open={summaryOpen} onOpenChange={setSummaryOpen}>
        {summary}
      </BottomSheet>
    </div>
  );
}

function CampaignSummary({ draft }: { draft: WizardDraft }) {
  const t = useT();
  return (
    <Surface className="overflow-hidden !rounded-[28px] !p-0">
      <div className="border-b border-border px-6 py-5">
        <Eyebrow>{c.summaryNote}</Eyebrow>
        <h2 className="mt-1 font-display text-xl font-semibold">{t.wizard.summaryTitle}</h2>
      </div>
      <div className="p-6">
        <div className="relative mb-5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-coral-tint">
          {draft.product.photoUrl ? (
            <img
              src={draft.product.photoUrl}
              alt={draft.product.name || t.wizard.photo}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-5 text-center">
              <ImagePlus className="size-10 text-coral-ink/60" />
              <p className="text-xs text-muted-foreground">{c.noPhoto}</p>
            </div>
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-soft">
            {draft.product.price !== null
              ? formatMoney(draft.product.price, draft.product.currency)
              : c.noPrice}
          </span>
        </div>
        <h3 className="break-words font-display text-2xl font-bold">
          {draft.product.name || c.productEmpty}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {draft.product.shortDescription || c.descriptionEmpty}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {draft.product.strengths
            .filter((s) => s.trim())
            .map((s, i) => (
              <Chip key={i} size="sm" variant="outline">
                {s.trim()}
              </Chip>
            ))}
        </div>
        <dl className="mt-6 space-y-4 border-t border-border pt-5">
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{t.wizard.budget}</dt>
            <dd className="font-semibold">{formatMoney(draft.budget)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{t.wizard.goal}</dt>
            <dd className="font-semibold">{t.wizard.goals[draft.goal]}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{t.wizard.tone}</dt>
            <dd className="font-semibold">{t.wizard.tones[draft.tone]}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{t.wizard.duration}</dt>
            <dd className="font-semibold">{draft.durationDays} zile</dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 text-xs text-muted-foreground">{c.channels}</p>
          <div className="flex flex-wrap gap-2">
            {draft.marketplaces.length > 0 ? (
              draft.marketplaces.map((id) => (
                <Chip key={id} size="sm" variant="coral">
                  {t.wizard.marketplaces[id].name}
                </Chip>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">{t.wizard.s2Sub}</span>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
}
