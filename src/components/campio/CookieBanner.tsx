import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

const KEY = "campio:cookies";

export function CookieBanner() {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener("campio:cookie-preferences", reopen);
    if (!localStorage.getItem(KEY)) {
      const id = setTimeout(() => setOpen(true), 1200);
      return () => {
        clearTimeout(id);
        window.removeEventListener("campio:cookie-preferences", reopen);
      };
    }
    return () => window.removeEventListener("campio:cookie-preferences", reopen);
  }, []);
  if (!open) return null;
  const choose = (v: "all" | "necessary") => {
    localStorage.setItem(KEY, v);
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t.cookies.title}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] mx-auto max-w-md animate-rise rounded-[1.75rem] bg-navy p-5 text-navy-foreground shadow-float md:bottom-6 md:left-6 md:right-auto"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-coral text-coral-foreground">
          <Cookie className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-lg font-bold">{t.cookies.title}</p>
          <p className="mt-1 text-sm text-navy-foreground/80">{t.cookies.body}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="coral" size="sm" onClick={() => choose("all")}>
          {t.cookies.accept}
        </Button>
        <Button variant="ghostLight" size="sm" onClick={() => choose("necessary")}>
          {t.cookies.necessary}
        </Button>
      </div>
    </div>
  );
}
