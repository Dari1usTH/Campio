import { afterEach, describe, expect, it } from "vitest";
import { kitSchema } from "@/services/kit";
import completed from "@/test/fixtures/kit-completed.json";
import { makeShareUrl, readSharedKit } from "./share";

afterEach(() => window.history.replaceState(null, "", "/"));

const open = (url: string) => {
  const u = new URL(url);
  window.history.replaceState(null, "", u.pathname + u.hash);
};

describe("read-only kit snapshots", () => {
  it("carries a validated kit to another browser without a server round-trip", () => {
    const kit = kitSchema.parse({
      ...completed,
      ui_data: { results: [{ channelId: "meta" }] },
    });
    open(makeShareUrl(kit));
    const snapshot = readSharedKit();
    expect(snapshot?.id).toBe(kit.id);
    expect(snapshot?.input.product_name).toBe(kit.input.product_name);
    expect(snapshot?.plan?.totals).toEqual(kit.plan?.totals);
  });

  it("drops private data: ui_data, uploads, intake answers and Reddit quotes", () => {
    open(makeShareUrl(kitSchema.parse(completed)));
    const snapshot = readSharedKit()!;
    expect(snapshot.ui_data).toEqual({});
    expect(snapshot.input.image_asset_ids).toEqual([]);
    expect(snapshot.intake.answers).toEqual([]);
    expect(snapshot.web?.discussions).toEqual([]);
  });

  it("rejects malformed snapshot data", () => {
    window.history.replaceState(null, "", "/share/test#data=broken%%%");
    expect(readSharedKit()).toBeNull();
  });
});
