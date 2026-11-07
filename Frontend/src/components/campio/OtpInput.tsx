import { tr } from "@/i18n";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  labelPrefix?: string;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  labelPrefix = tr("extra.digit"),
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const setAt = (i: number, d: string) => {
    const arr = digits.slice();
    arr[i] = d;
    const next = arr.join("").slice(0, length);
    onChange(next);
    if (next.length === length && /^\d+$/.test(next)) onComplete?.(next);
  };

  const fill = (text: string, from = 0) => {
    const clean = text.replace(/\D/g, "").slice(0, length - from);
    if (!clean) return;
    const arr = digits.slice();
    for (let k = 0; k < clean.length; k++) arr[from + k] = clean[k] ?? "";
    const next = arr.join("");
    onChange(next);
    const focusIdx = Math.min(length - 1, from + clean.length);
    refs.current[focusIdx]?.focus();
    if (next.length === length && /^\d+$/.test(next)) onComplete?.(next);
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label={tr("extra.verificationCode")}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="\d*"
          maxLength={1}
          disabled={disabled}
          aria-label={`${labelPrefix} ${i + 1}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (v.length > 1) return fill(v, i);
            if (!/^\d?$/.test(v)) return;
            setAt(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setAt(i - 1, "");
              e.preventDefault();
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(e.clipboardData.getData("text"), i);
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-11 rounded-2xl border-2 bg-card text-center font-display text-2xl font-bold shadow-soft outline-none transition-all sm:h-16 sm:w-13",
            "focus:border-coral focus:ring-4 focus:ring-coral/20",
            d ? "border-foreground/30" : "border-border",
            invalid && "border-destructive animate-[pop_0.3s]",
          )}
        />
      ))}
    </div>
  );
}
