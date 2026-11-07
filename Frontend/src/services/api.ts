import { translateError, getLocale } from "@/i18n";

/** Same-origin cookie authentication. Vite proxies /api during development. */
export const API_URL = ((import.meta.env["VITE_API_URL"] as string | undefined) || "/api").replace(/\/$/, "");
// Kept only for presentation branches during migration; there is no browser mock backend.
export const USE_MOCKS = false;

export class ApiError extends Error {
  constructor(message: string, public status = 400, public code = "unknown_error") { super(message); }
}
let refresh: Promise<boolean> | null = null;

export async function http<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Accept-Language", getLocale());
  // The server validates Origin on every cookie-authenticated mutation (including refresh).
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    refresh ??= fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" }).then(r=>r.ok).catch(()=>false).finally(()=>{refresh=null;});
    if (await refresh) return http<T>(path, init, false);
    window.dispatchEvent(new Event("campio:session-expired"));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { code?: string; error?: {code?: string} };
    const code = body.code ?? (typeof body.error === "object" ? body.error.code : undefined) ?? (response.status === 401 ? "unauthorized" : response.status === 429 ? "rate_limited" : "unknown_error");
    throw new ApiError(translateError(code), response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

/** Local persistence is limited to non-secret preferences and unfinished wizard drafts. */
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
export function writeLocal<T>(key:string,value:T) {
  if (typeof window!=="undefined") localStorage.setItem(key,JSON.stringify(value));
}
