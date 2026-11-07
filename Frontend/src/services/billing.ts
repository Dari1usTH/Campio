import { http } from "./api";
import { billingSchema, type Billing } from "./schemas";

export const billingService = {
  async get(): Promise<Billing> {
    return billingSchema.parse(await http("/billing"));
  },
  async purchase(packUsd: number): Promise<Billing> {
    return billingSchema.parse(
      await http("/billing/purchase", {
        method: "POST",
        body: JSON.stringify({ pack_usd: packUsd }),
      }),
    );
  },
};
