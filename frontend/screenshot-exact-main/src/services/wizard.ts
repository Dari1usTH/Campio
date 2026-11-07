import { USE_MOCKS, delay, http } from "./api";
import type { ParseResult, ParsedField, Product } from "./schemas";

const CATEGORIES: [RegExp, string][] = [
  [/lum[aâ]n|candel|cear[aă]/i, "Decor casă"],
  [/c[aă]n[aă]|ceramic|farfuri|bol/i, "Ceramică"],
  [/s[aă]pun|crem[aă]|ser |cosmetic|balsam/i, "Cosmetice"],
  [/tricou|rochi|hanorac|hain|bluz/i, "Modă"],
  [/bijuter|cercei|colier|inel|br[aă][tț]ar/i, "Bijuterii"],
  [/cafea|ceai|miere|ciocolat|dulcea/i, "Alimente"],
  [/juc[aă]ri|copii|bebe/i, "Copii"],
];

const STRENGTH_HINTS: [RegExp, string][] = [
  [/soia/i, "Ceară de soia"],
  [/manual|de m[aâ]n[aă]|handmade|artizan/i, "Lucrat manual"],
  [/natural/i, "Ingrediente naturale"],
  [/(\d+)\s*(de\s*)?ore/i, "$1 h durată"],
  [/bumbac/i, "Bumbac"],
  [/eco|sustenabil|reciclab/i, "Eco-friendly"],
  [/cadou|ambalat/i, "Gata de cadou"],
  [/livrare (rapid|gratuit)/i, "Livrare rapidă"],
  [/unic/i, "Piesă unică"],
];

/** Distinguish a decimal separator from a three-digit grouping separator. */
function normalizePrice(value: string): number {
  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = Math.max(comma, dot);
    return Number(value.slice(0, decimal).replace(/[.,]/g, "") + "." + value.slice(decimal + 1));
  }
  const separator = Math.max(comma, dot);
  if (separator < 0) return Number(value);
  if (value.length - separator - 1 === 3) return Number(value.replace(/[.,]/g, ""));
  return Number(value.replace(",", "."));
}

export function parseProductTextLocal(text: string): ParseResult {
  const clean = text.trim().replace(/\s+/g, " ");
  const missing: ParsedField[] = [];
  const aiFields: ParsedField[] = [];

  // Preserve decimal prices (89.99 / 89,99) and Romanian grouped values (1.299,99).
  const pricePattern = /(\d+(?:[ .]\d{3})*(?:[.,]\d{1,2})?)\s*(lei|ron|€|euro|eur|\$|usd)/i;
  const priceMatch = clean.match(pricePattern);
  const numericText = priceMatch?.[1]?.replace(/\s/g, "");
  const price = numericText ? normalizePrice(numericText) : null;
  const currencyRaw = priceMatch?.[2]?.toLowerCase();
  const currency =
    currencyRaw && /€|eur/.test(currencyRaw)
      ? "EUR"
      : currencyRaw && /\$|usd/.test(currencyRaw)
        ? "USD"
        : "RON";
  if (price !== null) aiFields.push("price");
  else missing.push("price");

  const first = (clean.split(/[.,](?!\d)|(?<!\d)[.,]|[!?;:]|\s[-–]\s/)[0] ?? "")
    .replace(/\s+pentru\s+.*$/i, "")
    .replace(pricePattern, "")
    .replace(/\s+(?:la|cost[aă]|cu pre[tț]ul|pre[tț])\s*$/i, "")
    .trim();
  const nameWords = first
    .replace(/^(?:(?:vând|vand|am|fac|este|e|un|o|niște|niste)\s+)+/i, "")
    .split(" ")
    .slice(0, 5)
    .join(" ");
  const name = nameWords ? nameWords.charAt(0).toUpperCase() + nameWords.slice(1) : "";
  if (name) aiFields.push("name");
  else missing.push("name");

  const category = CATEGORIES.find(([re]) => re.test(clean))?.[1] ?? "";
  if (category) aiFields.push("category");
  else missing.push("category");

  const strengths: string[] = [];
  for (const [re, label] of STRENGTH_HINTS) {
    const m = clean.match(re);
    if (m) strengths.push(label.replace("$1", m[1] ?? ""));
  }
  if (strengths.length) aiFields.push("strengths");
  else missing.push("strengths");

  const audienceMatch = clean.match(/pentru\s+([^.,!?]{4,60})/i);
  const audience = audienceMatch?.[1]?.trim() ?? "";
  if (audience) aiFields.push("audience");
  else missing.push("audience");

  const shortDescription = clean.length > 140 ? clean.slice(0, 137).trim() + "…" : clean;
  if (shortDescription) aiFields.push("shortDescription");

  aiFields.push("country");

  const product: Product = {
    name,
    category,
    price,
    currency,
    shortDescription,
    strengths,
    audience,
    country: "România",
  };
  return { product, aiFields, missing };
}

export const wizardService = {
  async parseProduct(text: string): Promise<ParseResult> {
    if (!USE_MOCKS)
      return http("/wizard/parse", { method: "POST", body: JSON.stringify({ text }) });
    await delay(1200);
    return parseProductTextLocal(text);
  },
};
