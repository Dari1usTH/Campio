import { kitSchema, type Kit } from "@/services/kit";

const MAX_HASH = 400_000;

/**
 * A self-contained read-only snapshot of a kit, carried in the URL hash (never sent to a server).
 * Account data, ui_data, uploads and long scraped lists are dropped to keep the link portable.
 */
export function snapshotKit(kit: Kit): Kit {
  return kitSchema.parse({
    ...kit,
    ui_data: {},
    input: { ...kit.input, image_asset_ids: [] },
    intake: { ...kit.intake, questions: [], answers: [] },
    web: kit.web
      ? { ...kit.web, discussions: [], amazon: kit.web.amazon.slice(0, 5) }
      : null,
  });
}

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export function makeShareUrl(kit: Kit): string {
  const encoded = toBase64Url(JSON.stringify(snapshotKit(kit)));
  if (encoded.length > MAX_HASH) throw new Error("snapshot too large");
  return `${window.location.origin}/share/${encodeURIComponent(kit.id)}#data=${encoded}`;
}

export function readSharedKit(): Kit | null {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("data");
  if (!value || value.length > MAX_HASH) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = kitSchema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (
      !parsed.success ||
      !Number.isFinite(new Date(parsed.data.created_at).getTime())
    )
      return null;
    return parsed.data;
  } catch {
    return null;
  }
}
