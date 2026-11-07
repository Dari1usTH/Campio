import { tr } from "@/i18n";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Sparkles,
  Target,
  Users,
  MessageCircle,
  Trophy,
  ShieldCheck,
  WandSparkles,
  PieChart,
  Copy,
  Image,
  BarChart3,
  Plus,
  Minus,
  Instagram,
} from "lucide-react";
import { toast } from "sonner";
import candle from "@/assets/candle.jpg";
import { LandingNav } from "@/components/landing/LandingNav";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Surface, Eyebrow } from "@/components/campio/Surface";
import { Chip } from "@/components/campio/Chip";
import { ScoreGauge } from "@/components/campio/ScoreGauge";
import { SmileyTrio } from "@/components/campio/Illustrations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/i18n";
import { useSession } from "@/hooks/use-session";

export default function LandingPage() {
  const t = useT();
  const session = useSession();
  const [legal, setLegal] = useState<"terms" | "privacy" | "about" | null>(null);
  const destination = session ? "/app/new" : "/signup";
  const icons = [
    Users,
    MessageCircle,
    Trophy,
    ShieldCheck,
    WandSparkles,
    PieChart,
    Copy,
    Image,
    BarChart3,
  ];
  return (
    <div className="overflow-x-clip">
      <LandingNav />
      <main id="main-content">
        <section className="relative mx-auto grid max-w-[1280px] items-center gap-8 px-5 pb-12 pt-32 sm:px-8 md:gap-12 md:pb-16 md:pt-40 lg:min-h-[820px] lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-32">
          <div className="relative z-10 animate-rise">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[10px] font-semibold tracking-[.08em] sm:text-[11px]">
              <span className="size-1.5 rounded-full bg-coral" />
              {t.workspace.heroLabel}
            </span>
            <h1 className="font-display text-[clamp(3.7rem,6.6vw,6.5rem)] font-bold leading-[.98] tracking-[-.065em]">
              {t.landing.heroA}
              <br />
              <span className="relative z-0 inline-block">
                {t.landing.heroB}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 450 25"
                  className="absolute -bottom-2 left-0 -z-10 w-full text-coral"
                >
                  <path
                    d="M5 18 Q190 -3 442 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <br />
              {t.landing.heroC}
              <Sparkles
                aria-hidden="true"
                className="ml-4 inline size-10 -translate-y-3 text-coral sm:size-14"
              />
            </h1>
            <p className="mt-8 max-w-[440px] text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t.landing.heroSub}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="coral"
                size="xl"
                className="h-auto min-h-14 max-w-full whitespace-normal px-6 py-4 text-left text-sm shadow-none sm:text-base"
              >
                <Link to={destination}>
                  {t.landing.heroCta}
                  <ArrowUpRight className="ml-2 shrink-0" />
                </Link>
              </Button>
              <Link
                to="/app/campaigns"
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-medium underline decoration-border underline-offset-4"
              >
                {t.landing.heroSecondary}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Check className="size-3.5 text-success-ink" />
              {t.landing.heroNote}
            </p>
            <div className="mt-10 flex items-center gap-3 border-t border-border/80 pt-6">
              <div className="flex -space-x-2" aria-hidden="true">
                {["bg-coral-tint", "bg-peach", "bg-navy"].map((bg, i) => (
                  <span
                    key={bg}
                    className={`grid size-9 place-items-center rounded-full border-[3px] border-background ${bg} ${i === 2 ? "text-cream" : "text-navy"}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    >
                      <path d="M7 9h1m8 0h1M7 15q5 5 10 0" strokeLinecap="round" />
                    </svg>
                  </span>
                ))}
              </div>
              <p className="max-w-52 text-xs leading-relaxed text-muted-foreground">
                {t.workspace.trustworthy}
              </p>
            </div>
          </div>
          <div
            className="hero-collage relative mx-auto mt-6 h-[440px] w-full max-w-[530px] animate-rise sm:h-[550px] lg:mt-0"
            aria-label={t.workspace.livePreview}
          >
            <div className="absolute inset-x-2 inset-y-5 rounded-[45%] bg-[#ecdfcf] dark:bg-navy-soft/50" />
            <svg
              className="absolute -right-3 top-4 size-24 rotate-12 text-coral"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <path
                d="M50 6 57 35 83 20 67 45 96 50 67 57 83 83 57 68 50 96 43 67 17 83 33 57 4 50 33 43 17 17 43 33Z"
                fill="currentColor"
              />
            </svg>
            <div className="absolute left-[7%] top-5 w-[72%] rotate-[-7deg] rounded-[1.75rem] bg-card p-3 pb-5 shadow-float sm:top-7">
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-navy text-[10px] text-cream">
                    {tr("extra.previewMonogram")}</span>
                  <span className="text-[10px] font-semibold">{tr("extra.previewHandle")}</span>
                </div>
                <Instagram className="size-4" />
              </div>
              <div className="relative overflow-hidden rounded-[1.15rem]">
                <img
                  src={candle}
                  width="600"
                  height="600"
                  fetchPriority="high"
                  alt={tr("extra.candleAlt")}
                  className="aspect-[1/1.07] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-transparent to-transparent" />
                <div className="absolute inset-x-5 bottom-5 text-cream-soft">
                  <span className="text-[8px] font-medium tracking-[.2em]">{tr("extra.previewBrand")}</span>
                  <p className="mt-2 font-display text-[26px] font-semibold leading-none sm:text-[34px]">
                    {t.workspace.previewMessage}
                  </p>
                  <p className="mt-3 text-[8px] sm:text-[10px]">{t.workspace.previewNote}</p>
                </div>
              </div>
              <div className="flex justify-between px-2 pt-4 text-[9px] text-muted-foreground">
                <span>{t.workspace.previewProduct}</span>
                <span>{tr("extra.socialIcons")}</span>
              </div>
            </div>
            <div className="absolute -right-1 top-[43%] w-[45%] rotate-[7deg] rounded-3xl border border-border/40 bg-card p-4 shadow-float sm:right-0 sm:top-[42%]">
              <span className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground">
                <Trophy className="size-3.5 text-coral-ink" />
                {t.result.winner}
              </span>
              <div className="mx-auto mt-2 w-fit">
                <ScoreGauge value={64} size={125} highlight />
              </div>
              <p className="-mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                {t.workspace.tested}
              </p>
            </div>
            <div className="absolute -bottom-1 left-0 flex max-w-[90%] -rotate-3 items-center gap-3 rounded-2xl bg-navy px-5 py-4 text-cream-soft shadow-float sm:bottom-4 sm:left-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-coral text-navy">
                <Check className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {t.workspace.previewReady}
                  <Sparkles className="ml-2 inline size-3.5 text-coral" />
                </p>
                <p className="mt-1 text-[10px] text-cream/70">{t.workspace.previewReadySub}</p>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1200px] border-y border-border px-5 py-7 text-center sm:px-8">
          <p className="mb-5 text-[10px] font-medium uppercase tracking-[.15em] text-muted-foreground">
            {t.workspace.platforms}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 font-display text-lg font-bold tracking-tight text-foreground/65 sm:gap-x-12 sm:text-2xl">
            <span>
              {tr("extra.previewEmag")}<span className="text-coral">.</span>
            </span>
            <span className="font-serif font-medium">{tr("wizard.marketplaces.etsy.name")}</span>
            <span>{tr("extra.previewTrendyol")}</span>
            <span className="font-medium">
              {tr("extra.previewAmazon")}<span className="text-coral">⌣</span>
            </span>
            <span className="italic">{tr("extra.previewShopify")}</span>
            <span className="font-normal">{tr("result.tabs.instagram")}</span>
          </div>
        </section>
        <section
          id="cum-functioneaza"
          className="mx-auto max-w-[1200px] scroll-mt-28 px-5 py-20 sm:px-8 md:py-28"
        >
          <Eyebrow>{t.workspace.howEyebrow}</Eyebrow>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-lg text-4xl font-bold leading-[1.05] md:text-6xl">
              {t.landing.howTitle}
            </h2>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-coral-ink" />
              {t.workspace.aiPartner}
            </span>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {t.landing.how.map((step, i) => (
              <Surface
                key={step.t}
                tone={i === 1 ? "navy" : i === 2 ? "coralSoft" : "cream"}
                className="min-h-64 border border-border/40 p-7"
                lift
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`font-display text-5xl font-semibold ${i === 1 ? "text-coral" : "text-coral-ink"}`}
                  >
                    0{i + 1}
                  </span>
                  {i === 0 ? (
                    <MessageCircle className="size-9 -rotate-12" />
                  ) : i === 1 ? (
                    <Target className="size-10 rotate-12" />
                  ) : (
                    <WandSparkles className="size-9 -rotate-12" />
                  )}
                </div>
                <h3 className="mt-10 text-xl font-semibold">{step.t}</h3>
                <p
                  className={`mt-3 text-sm leading-relaxed ${i === 1 ? "text-cream/70" : "text-muted-foreground"}`}
                >
                  {step.d}
                </p>
              </Surface>
            ))}
          </div>
        </section>
        <section id="ce-primesti" className="scroll-mt-28 bg-surface py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow>{t.workspace.bentoEyebrow}</Eyebrow>
              <h2 className="mt-4 text-4xl font-bold leading-[1.05] md:text-6xl">
                {t.landing.bentoTitle}
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
                {t.landing.bentoSub}
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.landing.bento.map((item, i) => {
                const Icon = icons[i]!;
                return (
                  <Surface
                    key={item.t}
                    tone={i === 2 ? "coral" : i === 6 ? "navy" : "card"}
                    className="min-h-48 border border-border/30"
                    lift
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          i === 6
                            ? "grid size-11 place-items-center rounded-2xl bg-cream/10"
                            : "grid size-11 place-items-center rounded-2xl bg-navy/5"
                        }
                      >
                        <Icon className="size-5" />
                      </span>
                      <span
                        className={`text-[11px] ${i === 6 ? "text-cream/50" : "text-current/40"}`}
                      >
                        0{i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{item.t}</h3>
                    <p
                      className={`mt-2 max-w-64 text-sm leading-relaxed ${i === 6 ? "text-cream/70" : i === 2 ? "text-navy/80" : "text-muted-foreground"}`}
                    >
                      {item.d}
                    </p>
                  </Surface>
                );
              })}
            </div>
            <div className="pb-12 pt-4 md:pb-20">
              <ProductPreview />
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 sm:px-8 md:grid-cols-2 md:items-center md:gap-16 md:py-28">
          <div>
            <Eyebrow>{t.landing.panelEyebrow}</Eyebrow>
            <h2 className="mt-4 text-4xl font-bold leading-[1.08] md:text-5xl">
              {t.landing.panelTitle}
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {t.landing.panelBody}
            </p>
            <ul className="mt-7 space-y-4">
              {t.landing.panelPoints.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-coral-tint">
                    <Check className="size-3 text-coral-ink" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8">
              <Link to="/app/campaigns">
                {t.landing.heroSecondary}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="rounded-[2rem] border border-border bg-surface p-6 md:p-8">
            <SmileyTrio className="mx-auto max-w-[280px]" />
            <div className="mt-4 rounded-3xl bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-coral-tint font-display text-lg">
                  {tr("extra.previewInitial")}</span>
                <div>
                  <p className="text-sm font-semibold">{tr("extra.previewPerson")}</p>
                  <p className="mt-0.5 text-[9px] tracking-wider text-muted-foreground">
                    {t.workspace.panelLabel}
                  </p>
                </div>
                <Chip variant="success" size="sm" className="ml-auto">
                  +64
                </Chip>
              </div>
              <blockquote className="mt-4 text-base font-medium leading-relaxed">
                „{t.workspace.panelQuote}”
              </blockquote>
            </div>
            <p className="mt-4 text-center text-[10px] text-muted-foreground">{t.result.formula}</p>
          </div>
        </section>
        <section
          id="cost"
          className="mx-auto max-w-[1200px] scroll-mt-28 px-5 pb-20 sm:px-8 md:pb-28"
        >
          <div className="grid gap-6 rounded-[2rem] bg-navy p-7 text-cream-soft md:grid-cols-2 md:gap-12 md:p-12">
            <div>
              <Eyebrow className="text-coral">{t.landing.navPrice}</Eyebrow>
              <h2 className="mt-5 text-4xl font-bold leading-[1.08] md:text-5xl">
                {t.landing.priceTitle}
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/70">
                {t.landing.priceNote}
              </p>
              <p className="mt-5 max-w-sm text-[11px] text-cream/60">{t.workspace.costEstimate}</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-3xl bg-coral p-6 text-navy">
                <div className="flex items-center justify-between">
                  <Logo variant="wordmark" size={27} className="!text-navy" />
                  <Sparkles className="size-5" />
                </div>
                <p className="mt-5 font-display text-5xl font-semibold tracking-tight">
                  {t.landing.priceUsValue}
                </p>
                <p className="mt-1 text-sm">{t.landing.priceUsUnit}</p>
              </div>
              <div className="flex flex-wrap justify-between gap-3 rounded-3xl border border-cream/15 px-6 py-5">
                <div>
                  <p className="text-sm">{t.landing.priceThem}</p>
                  <p className="mt-1 text-[10px] text-cream/55">{t.workspace.agencyLabel}</p>
                </div>
                <p className="text-lg font-semibold">
                  {t.landing.priceThemValue}
                  <span className="block text-right text-[10px] font-normal text-cream/55">
                    {t.landing.priceThemUnit}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          id="intrebari"
          className="mx-auto grid max-w-[1200px] scroll-mt-28 gap-8 px-5 pb-20 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:gap-20 md:pb-28"
        >
          <div>
            <Eyebrow>{tr("extra.faq")}</Eyebrow>
            <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
              {t.landing.faqTitle}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t.workspace.faqSub}
            </p>
          </div>
          <div>
            {t.landing.faq.map((item) => (
              <details key={item.q} className="group border-b border-border py-1">
                <summary className="flex min-h-18 cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Plus className="size-4 shrink-0 group-open:hidden" />
                  <Minus className="hidden size-4 shrink-0 group-open:block" />
                </summary>
                <p className="pb-6 pr-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="mx-3 rounded-[2rem] bg-coral-tint px-5 py-16 text-center md:mx-6 md:py-24">
          <span className="mx-auto mb-6 grid size-14 -rotate-12 place-items-center rounded-2xl bg-coral text-navy">
            <Sparkles className="size-7" />
          </span>
          <h2 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.05] md:text-6xl">
            {t.landing.finalTitle}
          </h2>
          <Button
            asChild
            size="xl"
            className="mt-8 h-auto min-h-14 whitespace-normal py-4 text-sm sm:text-base"
          >
            <Link to={destination}>
              {t.landing.finalCta}
              <ArrowUpRight />
            </Link>
          </Button>
          <p className="mt-5 text-xs text-muted-foreground">{t.landing.heroNote}</p>
        </section>
      </main>
      <footer className="mx-auto max-w-[1200px] px-5 pb-7 pt-14 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-8 pb-10">
          <div>
            <Link to="/" aria-label={tr("brand.name")}>
              <Logo size={32} />
            </Link>
            <p className="mt-4 max-w-56 text-xs leading-relaxed text-muted-foreground">
              {t.workspace.madeFor}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-12 gap-y-6 text-xs">
            <div className="space-y-3">
              <p className="font-semibold">{t.landing.footerProduct}</p>
              <a href="#cum-functioneaza" className="block text-muted-foreground">
                {t.landing.navHow}
              </a>
              <Link to="/app" className="block text-muted-foreground">
                {t.workspace.explore}
              </Link>
              <a href="#cost" className="block text-muted-foreground">
                {t.landing.navPrice}
              </a>
            </div>
            <div className="space-y-3">
              <p className="font-semibold">{t.landing.footerCompany}</p>
              <button
                onClick={() => setLegal("about")}
                className="block min-h-6 text-muted-foreground"
              >
                {t.landing.footerLinks.about}
              </button>
              <a href="#intrebari" className="block min-h-6 text-muted-foreground">
                {t.landing.navFaq}
              </a>
            </div>
            <div className="space-y-3">
              <p className="font-semibold">{t.landing.footerLegal}</p>
              <button
                onClick={() => setLegal("terms")}
                className="block min-h-6 text-muted-foreground"
              >
                {t.landing.footerLinks.terms}
              </button>
              <button
                onClick={() => setLegal("privacy")}
                className="block min-h-6 text-muted-foreground"
              >
                {t.landing.footerLinks.privacy}
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("campio:cookies");
                  window.dispatchEvent(new Event("campio:cookie-preferences"));
                  toast.success(t.workspace.cookieReset);
                }}
                className="block min-h-6 text-muted-foreground"
              >
                {t.landing.footerLinks.cookies}
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-6 text-[10px] text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {tr("extra.campioDot")}{t.landing.rights}
          </span>
          <span>{t.brand.tagline}</span>
        </div>
      </footer>
      <Dialog open={!!legal} onOpenChange={() => setLegal(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {legal === "about"
                ? t.workspace.aboutTitle
                : legal === "terms"
                  ? t.workspace.termsTitle
                  : t.workspace.privacyTitle}
            </DialogTitle>
            <DialogDescription className="pt-4 leading-relaxed">
              {legal === "about" ? t.workspace.aboutBody : t.workspace.legalDemo}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
