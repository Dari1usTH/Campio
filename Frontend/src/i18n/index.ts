import { ro, type Dict } from "./ro";

/**
 * Minimal i18n. Add `en.ts` with the same shape (typed as `Dict`) and register it
 * here to support English; the active locale can then come from settings.
 */
const dictionaries: Record<string, Dict> = { ro };
let locale: keyof typeof dictionaries = "ro";

export const setLocale = (l: string) => {
  if (dictionaries[l]) locale = l;
};

export const useT = (): Dict => dictionaries[locale] ?? ro;
export const t = (): Dict => dictionaries[locale] ?? ro;

/** Replace {placeholders} in a string. */
export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export const formatMoney = (n: number, currency = "RON") =>
  currency === "RON"
    ? `${new Intl.NumberFormat("ro-RO").format(n)} lei`
    : new Intl.NumberFormat("ro-RO", { style: "currency", currency }).format(n);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );

export const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 60) return `acum ${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `acum ${h} ${h === 1 ? "oră" : "ore"}`;
  const d = Math.round(h / 24);
  return `acum ${d} ${d === 1 ? "zi" : "zile"}`;
};
