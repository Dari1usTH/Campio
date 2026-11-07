import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Copy,
  Loader2,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { campaignsService } from "@/services/campaigns";
import { isKitActive, type CampaignSummary } from "@/services/kit";
import { useKitCopy } from "@/features/campaign/kit/copy";
import { useT, formatDate } from "@/i18n";
import { cn } from "@/lib/utils";

export const statusTone: Record<string, string> = {
  completed: "bg-success-tint text-success-ink",
  needs_input: "bg-warning-tint text-warning-ink",
  failed: "bg-destructive/10 text-destructive",
  running: "bg-coral-tint text-coral-ink",
  pending: "bg-coral-tint text-coral-ink",
};

export function CampaignCard({ campaign: s }: { campaign: CampaignSummary }) {
  const t = useT();
  const c = useKitCopy();
  const queryClient = useQueryClient();
  const [removeOpen, setRemoveOpen] = useState(false);
  const name = s.product_name || c.header.untitled;
  const remove = useMutation({
    mutationFn: () => campaignsService.remove(s.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(t.workspace.deleted);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <article className="group relative flex min-w-0 flex-col rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            statusTone[s.status],
          )}
        >
          {isKitActive(s.status) && <Loader2 className="size-3 animate-spin" />}
          {c.status[s.status] ?? s.status}
          {isKitActive(s.status) &&
            s.step &&
            ` · ${c.steps[s.step as keyof typeof c.steps] ?? s.step}`}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              className="-mr-2 -mt-2"
              aria-label={`${t.common.menu}: ${name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/app/new" search={{ reuse: s.id }}>
                <Copy className="mr-2 size-4" />
                {t.wizard.reuse}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setRemoveOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              {t.workspace.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Link
        to="/app/campaigns/$id"
        params={{ id: s.id }}
        className="mt-3 block font-display text-xl font-bold leading-tight hover:underline"
      >
        {name}
      </Link>
      {s.keyword && (
        <p className="mb-5 mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Search className="size-3.5" />
          {s.keyword}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {t.campaigns.created} {formatDate(s.created_at)}
        </p>
        <Link
          aria-label={`${t.workspace.open}: ${name}`}
          to="/app/campaigns/$id"
          params={{ id: s.id }}
          className="grid size-10 place-items-center rounded-full bg-secondary transition-colors hover:bg-coral"
        >
          <ArrowUpRight className="size-5" />
        </Link>
      </div>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.workspace.deleteCampaign}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.workspace.deleteCampaignBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t.workspace.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
