import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "flex h-12 w-full rounded-2xl border border-input bg-card px-4 text-base text-foreground shadow-soft outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-coral focus:ring-4 focus:ring-coral/20 disabled:opacity-60 aria-[invalid=true]:border-destructive";

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />,
);
TextInput.displayName = "TextInput";

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputClass, "h-auto min-h-28 resize-y py-3 leading-relaxed", className)}
      {...props}
    />
  ),
);
TextArea.displayName = "TextArea";

export function Field({
  id,
  label,
  error,
  hint,
  children,
  aside,
  className,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
