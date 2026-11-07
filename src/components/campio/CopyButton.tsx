import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label,
  className,
  variant = "secondary",
  size = "sm",
  onCopied,
}: {
  text: string;
  label?: string;
  className?: string;
  variant?: "secondary" | "default" | "outline" | "ghost";
  size?: "sm" | "default" | "iconSm";
  onCopied?: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error(t.common.copyError);
      return;
    }
    try {
      const visited: string[] = JSON.parse(localStorage.getItem("campio:onboarding") ?? "[]");
      if (!visited.includes("copy"))
        localStorage.setItem("campio:onboarding", JSON.stringify([...visited, "copy"]));
    } catch {
      /* Progress persistence must not invalidate a successful clipboard write. */
    }
    setCopied(true);
    toast.success(t.common.copied);
    onCopied?.();
    setTimeout(() => setCopied(false), 1800);
  };
  const isIcon = size === "iconSm";
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={copy}
      aria-label={isIcon ? (label ?? t.common.copy) : undefined}
      className={cn(copied && "text-success-ink", className)}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {!isIcon && (copied ? t.common.copied : (label ?? t.common.copy))}
    </Button>
  );
}
