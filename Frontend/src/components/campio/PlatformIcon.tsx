import { Mail, Search } from "lucide-react";
import type { Marketplace, Platform } from "@/services/schemas";
import { cn } from "@/lib/utils";

const names: Record<Platform, string> = {
  instagram: "Instagram",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  facebook: "Facebook",
  email: "Email",
  google: "Google",
};

export const platformName = (p: Platform) => names[p];

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const cls = cn("size-4 shrink-0", className);
  switch (platform) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M11 8.5c3-1 5 .8 4.5 3.3-.4 2-2.4 2.8-3.7 1.9M11.6 10.5 9.5 20" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.5 2.5 2.3 4 5 4.2" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M13.5 21v-8h2.5M13.5 13H11M13.5 13v-2.5c0-1.4.8-2 2-2h1" />
        </svg>
      );
    case "email":
      return <Mail className={cls} aria-hidden="true" />;
    case "google":
      return <Search className={cls} aria-hidden="true" />;
  }
}

const mpShort: Record<Marketplace, string> = {
  emag: "eM",
  trendyol: "Tr",
  etsy: "Et",
  amazon: "Am",
  olx: "OX",
  facebook_marketplace: "Fb",
  shopify: "Sh",
  instagram_shop: "Ig",
};

export function MarketplaceBadge({ id, className }: { id: Marketplace; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-2xl bg-navy font-display text-sm font-bold text-navy-foreground",
        className,
      )}
    >
      {mpShort[id]}
    </span>
  );
}
