import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./en.json";
import ro from "./ro.json";

export type Locale = "en" | "ro";
export type Dict = typeof en;
const storageKey = "campio:language";
const dictionaries: Record<Locale, Dict> = { en, ro };

function initialLocale(): Locale {
  if (typeof localStorage === "undefined") return "en";
  try {
    return localStorage.getItem(storageKey) === "ro" ? "ro" : "en";
  } catch {
    return "en";
  }
}

// No browser-language detection: a first visit always starts in English.
void i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, ro: { translation: ro } },
  lng: initialLocale(),
  fallbackLng: "en",
  supportedLngs: ["en", "ro"],
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

export function getLocale(): Locale {
  return i18next.resolvedLanguage === "ro" ? "ro" : "en";
}

function applyLocale() {
  if (typeof document !== "undefined") document.documentElement.lang = getLocale();
}
i18next.on("languageChanged", applyLocale);
applyLocale();

export function setLocale(locale: string) {
  const next: Locale = locale === "ro" ? "ro" : "en";
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Language switching still works with browser storage disabled.
  }
  void i18next.changeLanguage(next);
  applyLocale();
}

export function useLocale(): Locale {
  useTranslation();
  return getLocale();
}

export function useT(): Dict {
  return dictionaries[useLocale()];
}

export const t = (): Dict => dictionaries[getLocale()];
export const tr = (key: string): string => String(i18next.t(key));

/** Feature dictionaries stay reactive without capturing translated text at import time. */
export function createCopy<K extends keyof Dict>(section: K): Dict[K] {
  return new Proxy({} as Dict[K] & object, {
    get: (_target, key) => Reflect.get(t()[section] as object, key),
    ownKeys: () => Reflect.ownKeys(t()[section] as object),
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
  }) as Dict[K];
}

export const fmt = (message: string, variables: Record<string, string | number>) =>
  message.replace(/\{(\w+)\}/g, (_, key: string) => String(variables[key] ?? ""));

export const getIntlLocale = () => (getLocale() === "ro" ? "ro-RO" : "en-GB");
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(getIntlLocale(), options).format(value);
export const formatMoney = (value: number, currency = "RON") =>
  new Intl.NumberFormat(getIntlLocale(), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
export const formatDate = (iso: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(getIntlLocale(), options ?? {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
export const formatRelative = (iso: string) => {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: "auto" });
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
};

/** Never expose raw provider or backend error messages to the user. */
export function translateError(code: string): string {
  const key = code.toLowerCase().replaceAll("-", "_");
  return Object.hasOwn(t().errors, key)
    ? Reflect.get(t().errors, key) as string
    : t().empty.error;
}

export { i18next };
