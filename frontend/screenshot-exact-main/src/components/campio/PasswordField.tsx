import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@/i18n";
import { passwordStrength } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { TextInput } from "./Field";

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const t = useT();
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <TextInput ref={ref} type={show ? "text" : "password"} className={cn("pr-12", className)} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t.auth.hide : t.auth.show}
          aria-pressed={show}
          className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export function StrengthMeter({ password }: { password: string }) {
  const t = useT();
  const s = passwordStrength(password);
  const colors = ["bg-muted", "bg-destructive", "bg-warning", "bg-coral", "bg-success"];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= s ? colors[s] : "bg-muted")}
          />
        ))}
      </div>
      {password && <p className="mt-1.5 text-xs text-muted-foreground">{t.auth.strength[s]}</p>}
    </div>
  );
}
