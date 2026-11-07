import type { ReactNode } from "react";
import { Drawer as Vaul } from "vaul";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Mobile-first bottom sheet with drag handle and safe-area padding. */
export function BottomSheet({ open, onOpenChange, title, description, children, className }: BottomSheetProps) {
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[2px]" />
        <Vaul.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[2rem] bg-background shadow-float outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          <div className="px-5 pt-4">
            <Vaul.Title className="font-display text-xl font-bold">{title}</Vaul.Title>
            {description ? (
              <Vaul.Description className="mt-1 text-sm text-muted-foreground">{description}</Vaul.Description>
            ) : (
              <Vaul.Description className="sr-only">{title}</Vaul.Description>
            )}
          </div>
          <div className="safe-bottom overflow-y-auto px-5 pt-4">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}
