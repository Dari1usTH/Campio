import { getIntlLocale } from "@/i18n";

/** Formats USD credit; small AI charges keep up to 4 decimals so they don't read as $0.00. */
export function formatCredit(value: number) {
  const abs = Math.abs(value);
  return new Intl.NumberFormat(getIntlLocale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: abs > 0 && abs < 1 ? 4 : 2,
  }).format(value);
}
