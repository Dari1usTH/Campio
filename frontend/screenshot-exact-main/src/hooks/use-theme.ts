import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const KEY = "campio:theme";
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const get = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, get, () => "light" as Theme);
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    localStorage.setItem(KEY, t);
    listeners.forEach((l) => l());
  }, []);
  return { theme, setTheme };
}

/** Inline script applied before paint to avoid a theme flash. */
export const themeInitScript = `try{if(localStorage.getItem('${KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;
