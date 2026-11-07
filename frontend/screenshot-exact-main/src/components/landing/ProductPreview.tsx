import candle from "@/assets/candle.jpg";
import { Chip } from "@/components/campio/Chip";
import { ScoreGauge } from "@/components/campio/ScoreGauge";
import { PlatformIcon } from "@/components/campio/PlatformIcon";
import { Trophy, MessageCircle, Wallet } from "lucide-react";

/** Animated hero preview: laptop + phone frames with floating campaign cards. */
export function ProductPreview() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl md:mt-20" aria-hidden="true">
      {/* Laptop */}
      <div className="relative mx-auto w-[92%] animate-rise rounded-[1.75rem] bg-navy p-2.5 shadow-float md:w-[78%] md:p-3">
        <div className="overflow-hidden rounded-[1.25rem] bg-background">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-coral" />
            <span className="size-2.5 rounded-full bg-peach" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="ml-3 truncate text-[11px] text-muted-foreground">campio.ro/app/campaigns/lumanare</span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-3 md:gap-4 md:p-5">
            <div className="rounded-3xl bg-card p-4 shadow-soft sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ce mesaj funcționează</p>
              <div className="mt-2 flex items-end justify-around gap-2">
                <div className="flex flex-col items-center">
                  <ScoreGauge value={64} size={96} highlight />
                  <Chip variant="coral" size="sm" className="mt-1">Câștigător</Chip>
                </div>
                <div className="hidden flex-col items-center opacity-80 sm:flex">
                  <ScoreGauge value={39} size={78} />
                  <span className="mt-1 text-[11px] text-muted-foreground">Mesaj B</span>
                </div>
                <div className="hidden flex-col items-center opacity-70 md:flex">
                  <ScoreGauge value={34} size={78} />
                  <span className="mt-1 text-[11px] text-muted-foreground">Mesaj C</span>
                </div>
              </div>
            </div>
            <div className="hidden flex-col justify-between rounded-3xl bg-gradient-navy p-4 text-navy-foreground sm:flex">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-foreground/70">Buget</p>
              <p className="font-display text-3xl font-bold">500 lei</p>
              <div className="flex h-2 overflow-hidden rounded-full">
                <span className="w-[50%] bg-coral" />
                <span className="w-[30%] bg-peach" />
                <span className="w-[20%] bg-navy-foreground/40" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phone */}
      <div className="absolute -bottom-10 right-0 w-[38%] max-w-[230px] animate-float rounded-[2.2rem] bg-navy p-2 shadow-float [--r:4deg] sm:right-[2%] md:-bottom-14">
        <div className="overflow-hidden rounded-[1.8rem] bg-background">
          <div className="mx-auto mt-2 h-4 w-16 rounded-full bg-navy" />
          <div className="p-2.5">
            <div className="relative overflow-hidden rounded-2xl">
              <img src={candle} alt="" width={1024} height={1024} className="aspect-square w-full object-cover" />
              <div className="absolute inset-x-2 bottom-2 rounded-xl bg-navy/85 p-2 text-navy-foreground backdrop-blur">
                <p className="text-[9px] font-semibold leading-tight sm:text-[11px]">Seara ta liniștită începe cu o flacără curată.</p>
                <span className="mt-1 inline-block rounded-full bg-coral px-2 py-0.5 text-[8px] font-bold text-coral-foreground sm:text-[10px]">Comandă acum</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <PlatformIcon platform="instagram" className="size-3" /> 89 lei · Etsy
            </div>
          </div>
        </div>
      </div>

      {/* Floating chips */}
      <div className="absolute -left-1 top-6 hidden animate-float-slow rounded-2xl bg-card p-3 shadow-lift [--r:-4deg] sm:flex sm:items-center sm:gap-3 md:-left-6">
        <span className="grid size-9 place-items-center rounded-xl bg-coral text-coral-foreground"><Trophy className="size-4" /></span>
        <div>
          <p className="text-xs text-muted-foreground">Runda 2</p>
          <p className="font-display text-lg font-bold leading-none">64 <span className="text-sm font-medium text-muted-foreground">vs 39</span></p>
        </div>
      </div>
      <div className="absolute -left-2 bottom-2 hidden max-w-[240px] animate-float rounded-2xl bg-card p-3 shadow-lift [--r:2deg] md:block">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-peach text-xs font-bold text-navy">I</span>
          <p className="text-xs font-semibold">Ioana, 31</p>
          <MessageCircle className="ml-auto size-3.5 text-muted-foreground" />
        </div>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">„Exact vibe-ul pe care îl caut după o zi lungă.”</p>
      </div>
      <div className="absolute -top-6 right-[8%] hidden animate-float-slow items-center gap-2 rounded-full bg-coral px-4 py-2 font-semibold text-coral-foreground shadow-coral [--r:3deg] sm:flex">
        <Wallet className="size-4" /> ≈ $0.01 / campanie
      </div>
    </div>
  );
}
