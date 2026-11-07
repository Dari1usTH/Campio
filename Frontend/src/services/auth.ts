import { ApiError, USE_MOCKS, delay, http, readLocal, uid, writeLocal } from "./api";
import { challengeSchema, verificationSchema } from "./schemas";
import type { Challenge, ResetTokenState, Session, TwoFactorMethod, User } from "./schemas";

const SESSION_KEY = "campio:session";
const CHALLENGE_KEY = "campio:challenge";

const listeners = new Set<() => void>();
export const onSessionChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn());

export function getSession(): Session | null {
  return readLocal<Session | null>(SESSION_KEY, null);
}

function setSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) {
    writeLocal(SESSION_KEY, s);
    localStorage.setItem("campio:token", s.token);
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("campio:token");
  }
  emit();
}

export function getChallenge(): Challenge | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CHALLENGE_KEY);
  try {
    const parsed = challengeSchema.safeParse(raw ? JSON.parse(raw) : null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function setChallenge(c: Challenge | null) {
  if (typeof window === "undefined") return;
  if (c) sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(c));
  else sessionStorage.removeItem(CHALLENGE_KEY);
}

const nameFromEmail = (email: string) => {
  const base = email.split("@")[0]?.split(/[._-]/)[0] ?? "Prieten";
  return base.charAt(0).toUpperCase() + base.slice(1);
};

export const authService = {
  async signup(input: { email: string; password: string }): Promise<Challenge> {
    if (!USE_MOCKS) {
      const c = challengeSchema.parse(
        await http("/auth/signup", { method: "POST", body: JSON.stringify(input) }),
      );
      setChallenge(c);
      return c;
    }
    await delay(900);
    if (input.email.toLowerCase().startsWith("taken@"))
      throw new ApiError("Există deja un cont cu acest email.", 409, "email_taken");
    const c: Challenge = { id: uid("ch"), email: input.email, method: "email", firstSetup: true };
    setChallenge(c);
    return c;
  },

  async login(input: { email: string; password: string }): Promise<Challenge> {
    if (!USE_MOCKS) {
      const c = challengeSchema.parse(
        await http("/auth/login", { method: "POST", body: JSON.stringify(input) }),
      );
      setChallenge(c);
      return c;
    }
    await delay(800);
    if (input.password === "gresit")
      throw new ApiError("Email sau parolă greșită.", 401, "invalid_credentials");
    const c: Challenge = { id: uid("ch"), email: input.email, method: "email", firstSetup: false };
    setChallenge(c);
    return c;
  },

  async google(): Promise<Challenge> {
    if (!USE_MOCKS) {
      const c = challengeSchema.parse(await http("/auth/google", { method: "POST" }));
      setChallenge(c);
      return c;
    }
    await delay(700);
    const c: Challenge = {
      id: uid("ch"),
      email: "ana@atelier.ro",
      method: "email",
      firstSetup: false,
    };
    setChallenge(c);
    return c;
  },

  async setMethod(method: TwoFactorMethod): Promise<Challenge> {
    const c = getChallenge();
    if (!c) throw new ApiError("Sesiunea de verificare a expirat.", 410);
    const next = { ...c, method };
    if (USE_MOCKS) {
      await delay(300);
      setChallenge(next);
      return next;
    }
    const updated = challengeSchema.parse(
      await http("/auth/2fa/method", {
        method: "POST",
        body: JSON.stringify({ id: c.id, method }),
      }),
    );
    setChallenge(updated);
    return updated;
  },

  async resendCode(): Promise<void> {
    if (!USE_MOCKS) return http("/auth/2fa/resend", { method: "POST" });
    await delay(500);
  },

  async verify2fa(code: string): Promise<{ session: Session; backupCodes?: string[] }> {
    const c = getChallenge();
    if (!USE_MOCKS) {
      const result = verificationSchema.parse(
        await http("/auth/2fa/verify", {
          method: "POST",
          body: JSON.stringify({ id: c?.id, code }),
        }),
      );
      setSession(result.session);
      setChallenge(null);
      return result.backupCodes
        ? { session: result.session, backupCodes: result.backupCodes }
        : { session: result.session };
    }
    await delay(800);
    if (!c) throw new ApiError("Sesiunea de verificare a expirat. Autentifică-te din nou.", 410);
    if (!/^\d{6}$/.test(code) || code === "000000")
      throw new ApiError("Cod incorect. Mai încearcă o dată.", 401);
    const user: User = {
      id: uid("u"),
      name: nameFromEmail(c.email),
      email: c.email,
      businessName: "Atelierul meu",
      twoFactorEnabled: true,
    };
    const session: Session = { token: uid("tok"), user };
    setSession(session);
    setChallenge(null);
    const backupCodes = c.firstSetup
      ? Array.from(
          { length: 8 },
          () =>
            Math.random().toString(36).slice(2, 7).toUpperCase() +
            "-" +
            Math.random().toString(36).slice(2, 7).toUpperCase(),
        )
      : undefined;
    return backupCodes ? { session, backupCodes } : { session };
  },

  async forgotPassword(email: string): Promise<void> {
    if (!USE_MOCKS)
      return http("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
    await delay(800);
  },

  async validateResetToken(token: string | undefined): Promise<ResetTokenState> {
    if (!USE_MOCKS) return http(`/auth/reset/validate?token=${encodeURIComponent(token ?? "")}`);
    await delay(600);
    if (!token || token === "invalid") return "invalid";
    if (token === "expired") return "expired";
    return "valid";
  },

  async resetPassword(token: string, password: string): Promise<void> {
    if (!USE_MOCKS)
      return http("/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
    await delay(900);
  },

  async logout(): Promise<void> {
    if (!USE_MOCKS) await http("/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession(null);
  },

  updateLocalUser(patch: Partial<User>) {
    const s = getSession();
    if (s) setSession({ ...s, user: { ...s.user, ...patch } });
  },
};
