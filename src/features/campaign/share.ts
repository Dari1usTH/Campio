import { campaignSchema, type Campaign } from "@/services/schemas";

/** A self-contained read-only snapshot. It contains campaign content, never account/session data. */
export async function makeShareUrl(campaign: Campaign): Promise<string> {
  const product = { ...campaign.product };
  // User-uploaded data URLs can be several MB. Sharing does not upload these files.
  if (product.photoUrl?.startsWith("data:") || product.photoUrl?.startsWith("blob:"))
    delete product.photoUrl;
  else if (product.photoUrl)
    product.photoUrl = new URL(product.photoUrl, window.location.origin).href;
  const snapshot = campaignSchema.parse({ ...campaign, product });
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${window.location.origin}/share/${encodeURIComponent(campaign.id)}#data=${encoded}`;
}

export function readSharedCampaign(): Campaign | null {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("data");
  if (!value || value.length > 200000) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = campaignSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success || !Number.isFinite(new Date(parsed.data.createdAt).getTime())) return null;
    // Prevent unexpected remote protocols in untrusted shared snapshots.
    const url = parsed.data.product.photoUrl;
    if (url && !/^https?:\/\//i.test(url) && !url.startsWith("/"))
      delete parsed.data.product.photoUrl;
    return parsed.data;
  } catch {
    return null;
  }
}
