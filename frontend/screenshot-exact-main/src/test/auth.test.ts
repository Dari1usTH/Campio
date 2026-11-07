import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authService, getChallenge, getSession } from "@/services/auth";

/** Resolve simulated service latency without making the suite wait in real time. */
async function complete<T>(promise: Promise<T>): Promise<T> {
  const observed = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await observed;
  if (!result.ok) throw result.error;
  return result.value;
}

describe("Mock auth service boundaries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("preserves the signup email in a first-setup challenge without authenticating early", async () => {
    const challenge = await complete(
      authService.signup({ email: "maria@atelier.ro", password: "CampioTest1!" }),
    );
    expect(challenge).toMatchObject({
      email: "maria@atelier.ro",
      method: "email",
      firstSetup: true,
    });
    expect(getChallenge()).toEqual(challenge);
    expect(getSession()).toBeNull();
  });

  it("rejects an existing email without leaving a verification challenge", async () => {
    await expect(
      complete(authService.signup({ email: "taken@atelier.ro", password: "CampioTest1!" })),
    ).rejects.toMatchObject({ status: 409 });
    expect(getChallenge()).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("rejects a verification request when the challenge is missing", async () => {
    await expect(complete(authService.verify2fa("123456"))).rejects.toMatchObject({ status: 410 });
    expect(getSession()).toBeNull();
  });

  it("treats corrupt or malformed stored challenges as expired", async () => {
    sessionStorage.setItem("campio:challenge", "{broken");
    expect(getChallenge()).toBeNull();
    sessionStorage.setItem("campio:challenge", JSON.stringify({ id: "incomplete" }));
    expect(getChallenge()).toBeNull();
  });

  it.each(["", "12345", "1234567", "abcdef", "12 456", "000000"])(
    "rejects malformed or refused OTP %j and preserves the challenge for retry",
    async (code) => {
      const challenge = await complete(
        authService.login({ email: "maria@atelier.ro", password: "CampioTest1!" }),
      );
      await expect(complete(authService.verify2fa(code))).rejects.toMatchObject({ status: 401 });
      expect(getSession()).toBeNull();
      expect(getChallenge()).toEqual(challenge);
    },
  );

  it("creates a session only after successful verification and clears the single-use challenge", async () => {
    await complete(authService.signup({ email: "maria@atelier.ro", password: "CampioTest1!" }));
    const verified = await complete(authService.verify2fa("123456"));
    expect(verified.session.user).toMatchObject({ email: "maria@atelier.ro", name: "Maria" });
    expect(getSession()).toEqual(verified.session);
    expect(localStorage.getItem("campio:token")).toBe(verified.session.token);
    expect(getChallenge()).toBeNull();
    expect(verified.backupCodes).toHaveLength(8);
    await expect(complete(authService.verify2fa("123456"))).rejects.toMatchObject({ status: 410 });
  });
});
