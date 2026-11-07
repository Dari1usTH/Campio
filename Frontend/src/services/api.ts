/**
 * API client. When VITE_API_URL is set, services call the real backend;
 * otherwise they return typed mock data with simulated latency.
 */
export const API_URL: string = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";
export const USE_MOCKS = API_URL === "";

export const delay = (ms = 600) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms + Math.random() * 250));

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
  ) {
    super(message);
  }
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("campio:token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(body.message ?? res.statusText, res.status, body.code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* Browser-only local persistence for mocks */
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
