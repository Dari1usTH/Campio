import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Image, MoreHorizontal, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HealthRing } from "@/components/campio/ScoreGauge";
import { Chip } from "@/components/campio/Chip";
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
import type { Campaign } from "@/services/schemas";
import { campaignsService } from "@/services/campaigns";
import { useT, formatMoney, formatDate } from "@/i18n";
import { cn } from "@/lib/utils";

export function CampaignCard({
  campaign: c,
  selected,
  onSelect,
}: {
  campaign: Campaign;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [removeOpen, setRemoveOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => campaignsService.remove(c.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(t.workspace.deleted);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <article
      className={cn(
        "group relative min-w-0 rounded-[1.75rem] border bg-card p-3 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift",
        selected ? "border-coral ring-2 ring-coral/30" : "border-border/60",
      )}
    >
      <div className="relative h-44 overflow-hidden rounded-[1.2rem] bg-secondary sm:h-48">
        {c.product.photoUrl ? (
          <img
            src={c.product.photoUrl}
            alt={c.product.name}
            loading="lazy"
            width="600"
            height="600"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center bg-coral-tint">
            <Image className="size-12 text-coral-ink" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Chip
            variant={c.status === "launched" ? "success" : "static"}
            size="sm"
            className="bg-card/95 backdrop-blur"
          >
            {t.status[c.status]}
          </Chip>
          {c.isDemo && (
            <Chip variant="navy" size="sm">
              {t.common.demo}
            </Chip>
          )}
        </div>
        {onSelect && (
          <label className="absolute right-3 top-3 grid size-11 cursor-pointer place-items-center rounded-full bg-card shadow-soft">
            <input
              aria-label={`${t.campaigns.compare}: ${c.product.name}`}
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              className="size-5 accent-[var(--coral)]"
            />
          </label>
        )}
      </div>
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {c.marketplaces.map((m) => t.wizard.marketplaces[m].name).join(" · ")}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={`${t.common.menu}: ${c.product.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/app/new" search={{ reuse: c.id }}>
                  <Copy className="mr-2 size-4" />
                  {t.wizard.reuse}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => setRemoveOpen(true)}>
                <Trash2 className="mr-2 size-4" />
                {t.workspace.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link
          to={c.status === "generating" ? "/app/generating/$id" : "/app/campaigns/$id"}
          params={{ id: c.id }}
          className="mt-1 block font-display text-xl font-bold leading-tight hover:underline"
        >
          {c.product.name}
        </Link>
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
          <div>
            <span className="text-[11px] text-muted-foreground">{t.campaigns.budget}</span>
            <p className="text-sm font-semibold">
              {formatMoney(c.budget)}{" "}
              <span className="font-normal text-muted-foreground">
                / {c.durationDays} {t.workspace.days}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HealthRing value={c.health} size={36} />
            <Link
              aria-label={`${t.workspace.open}: ${c.product.name}`}
              to={c.status === "generating" ? "/app/generating/$id" : "/app/campaigns/$id"}
              params={{ id: c.id }}
              className="grid size-10 place-items-center rounded-full bg-secondary transition-colors hover:bg-coral"
            >
              <ArrowUpRight className="size-5" />
            </Link>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          {t.campaigns.created} {formatDate(c.createdAt)}
        </p>
      </div>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.workspace.deleteCampaign}</AlertDialogTitle>
            <AlertDialogDescription>{t.workspace.deleteCampaignBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t.workspace.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
