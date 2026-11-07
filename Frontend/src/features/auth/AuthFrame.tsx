import { LanguageSwitch } from "@/components/campio/LanguageSwitch";
import { authCopy } from "./copy";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Check, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { USE_MOCKS } from "@/services/api";
import candle from "@/assets/candle.jpg";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-[1500px] lg:grid-cols-2">
        <section className="flex flex-col px-2 py-3 sm:px-8 xl:px-16">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" aria-label={authCopy.homeLabel}>
              <Logo size={38} />
            </Link>
            <LanguageSwitch />
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
              {authCopy.home}{" "}
            </Link>
          </div>
          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12 lg:py-16">
            {children}
          </div>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            {USE_MOCKS ? authCopy.demoFooter : authCopy.tagline}
          </p>
        </section>
        <aside className="relative hidden overflow-hidden rounded-[36px] bg-navy px-10 py-12 text-cream-soft lg:flex lg:flex-col xl:px-14">
          <div
            className="absolute -right-24 -top-24 size-80 rounded-full border border-cream/10"
            aria-hidden="true"
          />
          <span className="mb-12 inline-flex w-fit items-center gap-2 rounded-full border border-cream/20 px-4 py-2 text-xs">
            <Sparkles className="size-4 text-coral" />
            {authCopy.eyebrow}{" "}
          </span>
          <h2 className="max-w-md font-display text-[clamp(2.8rem,4.5vw,4.7rem)] font-semibold leading-[0.98]">
            {authCopy.heroLine1} <br />
            {authCopy.heroLine2} <br />
            <span className="text-coral">{authCopy.heroAccent}</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-6 text-cream/70">{authCopy.heroBody} </p>
          <div className="relative mx-auto my-10 w-full max-w-[360px] rotate-[-4deg] rounded-[28px] bg-cream p-3 text-navy shadow-float">
            <img
              src={candle}
              width="480"
              height="320"
              alt={authCopy.candleAlt}
              className="h-44 w-full rounded-[20px] object-cover xl:h-56"
            />
            <div className="p-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {authCopy.winner}{" "}
              </span>
              <p className="mt-2 font-display text-2xl font-semibold leading-tight">
                {authCopy.demoMessage1} <br />
                {authCopy.demoMessage2}{" "}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-navy px-3 py-2 text-xs text-cream">
                  {authCopy.ready} <ArrowUpRight className="ml-1 inline size-3" />
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <Check className="size-4 text-success-ink" /> eMAG
                </span>
              </div>
            </div>
            <div className="absolute -right-6 top-8 rotate-[8deg] rounded-full bg-coral px-4 py-3 text-xs font-semibold shadow-soft">
              {authCopy.campaignSticker}{" "}
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-x-6 gap-y-3 text-xs text-cream/75">
            {[authCopy.benefitSimple, authCopy.benefitBrand, authCopy.benefitQuick].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <Check className="size-4 text-coral" />
                {item}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

export function AuthHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-[46px]">
        {title}
        <span className="text-coral">.</span>
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{sub}</p>
    </header>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  return message ? (
    <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
