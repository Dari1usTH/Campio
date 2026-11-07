import { afterEach, describe, expect, it } from "vitest";
import { seedCampaigns } from "@/test/fixtures/campaigns";
import { makeShareUrl, readSharedCampaign } from "./share";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("read-only campaign snapshots", () => {
  it("carries a validated campaign to another browser without local storage", async () => {
    const campaign = seedCampaigns()[0]!;
    const url = await makeShareUrl(campaign);
    window.history.replaceState(null, "", new URL(url).pathname + new URL(url).hash);
    const snapshot = readSharedCampaign();
    expect(snapshot?.id).toBe(campaign.id);
    expect(snapshot?.product.name).toBe(campaign.product.name);
    expect(snapshot?.messages).toEqual(campaign.messages);
    expect(Object.keys(snapshot ?? {})).not.toContain("token");
  });

  it("omits locally uploaded images so the share URL stays portable", async () => {
    const campaign = seedCampaigns()[0]!;
    campaign.product.photoUrl = "data:image/png;base64,c2VjcmV0";
    const url = await makeShareUrl(campaign);
    window.history.replaceState(null, "", new URL(url).pathname + new URL(url).hash);
    expect(readSharedCampaign()?.product.photoUrl).toBeUndefined();
  });

  it("rejects malformed snapshot data", () => {
    window.history.replaceState(null, "", "/share/test#data=broken%%%");
    expect(readSharedCampaign()).toBeNull();
  });
});
