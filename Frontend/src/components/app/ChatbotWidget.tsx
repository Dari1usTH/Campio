import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Sparkles, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { campaignsQuery } from "@/services/queries";
import { useSession } from "@/hooks/use-session";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Floating help button (bottom-right): a short FAQ plus a shortcut into the AI
 * chat. Chat is per-kit in the backend, so "Talk to AI" opens the chat tab of
 * the campaign being viewed, else the newest completed campaign, else the
 * new-campaign page. Signed-out visitors (homepage) are sent to signup.
 *
 * `placement="app"` lifts the button above the mobile bottom nav and the
 * "+" FAB of AppShell; `"page"` sits in the corner on every screen size.
 */
export function ChatbotWidget({
  placement = "app",
}: {
  placement?: "app" | "page";
}) {
  const t = useT();
  const c = t.chatbot;
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const path = useLocation({ select: (l) => l.pathname });
  const session = useSession();
  const campaigns = useQuery({
    ...campaignsQuery(),
    enabled: open && !!session,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const viewingId = /^\/app\/campaigns\/([^/]+)\/?$/.exec(path)?.[1];
  const newest = [...(campaigns.data ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const targetId =
    viewingId ??
    (newest.find((k) => k.status === "completed") ?? newest[0])?.id;

  const talkToAI = () => {
    setOpen(false);
    if (!session) {
      void navigate({ to: "/signup" });
    } else if (viewingId) {
      // Same page: KitView listens for hashchange to switch tabs.
      window.location.hash = "chat";
    } else if (targetId) {
      void navigate({
        to: "/app/campaigns/$id",
        params: { id: targetId },
        hash: "chat",
      });
    } else {
      void navigate({ to: "/app/new" });
    }
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={c.title}
          className={cn(
            "fixed inset-x-3 z-50 mx-auto flex max-w-sm animate-rise flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-surface shadow-float md:inset-x-auto md:bottom-24 md:right-6 md:max-h-[min(36rem,calc(100dvh-8rem))] md:w-96",
            placement === "app"
              ? "bottom-[calc(15rem+env(safe-area-inset-bottom))] max-h-[min(34rem,calc(100dvh-17rem))]"
              : "bottom-[calc(6rem+env(safe-area-inset-bottom))] max-h-[min(34rem,calc(100dvh-8rem))]",
          )}
        >
          <div className="flex items-start gap-3 bg-navy p-5 text-navy-foreground">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-coral text-coral-foreground">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold">{c.title}</p>
              <p className="mt-0.5 text-sm text-navy-foreground/80">
                {c.subtitle}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={t.common.close}
              className="grid size-8 place-items-center rounded-full text-navy-foreground/80 hover:bg-cream/10"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            <Accordion type="single" collapsible>
              {c.faq.map((item, i) => (
                <AccordionItem key={i} value={String(i)}>
                  <AccordionTrigger className="text-left text-sm">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          <div className="border-t border-border/70 p-4">
            <Button variant="coral" className="w-full" onClick={talkToAI}>
              <MessageCircle />
              {c.talk}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {!session
                ? c.talkHintSignedOut
                : targetId || campaigns.isLoading
                  ? c.talkHint
                  : c.talkHintNoCampaign}
            </p>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t.common.close : c.open}
        aria-expanded={open}
        className={cn(
          "fixed right-5 z-50 grid size-14 place-items-center rounded-full shadow-float transition-transform active:scale-95 md:bottom-6 md:right-6",
          placement === "app"
            ? "bottom-[calc(11rem+env(safe-area-inset-bottom))]"
            : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
          open ? "bg-coral text-navy" : "bg-navy text-cream-soft",
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}
