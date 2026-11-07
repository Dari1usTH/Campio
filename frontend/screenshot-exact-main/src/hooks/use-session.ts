import { useMemo, useSyncExternalStore } from "react";
import { onSessionChange } from "@/services/auth";
import type { Session } from "@/services/schemas";

const subscribe = (fn: () => void) => {
  const off = onSessionChange(fn);
  window.addEventListener("storage", fn);
  return () => {
    off();
    window.removeEventListener("storage", fn);
  };
};
const getRaw = () => localStorage.getItem("campio:session");
const getServerRaw = () => null;

export function useSession(): Session | null {
  const raw = useSyncExternalStore(subscribe, getRaw, getServerRaw);
  return useMemo(() => (raw ? (JSON.parse(raw) as Session) : null), [raw]);
}
