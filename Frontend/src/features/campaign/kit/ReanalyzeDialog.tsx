import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { campaignsService } from "@/services/campaigns";
import { campaignKeys } from "@/services/queries";
import { isKitActive, type Kit } from "@/services/kit";
import { useKitCopy } from "./copy";

/** Button + dialog that asks the backend for a fresh analysis of the product. */
export function ReanalyzeButton({
  kit,
  variant = "outline",
}: {
  kit: Kit;
  variant?: "outline" | "coral";
}) {
  const c = useKitCopy().reanalyze;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState(kit.input.keyword);
  const [message, setMessage] = useState("");
  const run = useMutation({
    mutationFn: () =>
      campaignsService.reanalyze(kit.id, {
        message,
        // Only send the keyword when the seller changed it.
        keyword: keyword.trim() !== kit.input.keyword ? keyword : undefined,
      }),
    onSuccess: (next) => {
      qc.setQueryData(campaignKeys.detail(kit.id), next);
      void qc.invalidateQueries({ queryKey: campaignKeys.list() });
      setOpen(false);
      setMessage("");
      toast.success(c.started);
    },
    onError: (e) => toast.error(e.message),
  });
  if (isKitActive(kit.status)) return null;
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => {
          setKeyword(kit.input.keyword);
          setOpen(true);
        }}
      >
        <RefreshCw />
        {c.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{c.title}</DialogTitle>
            <DialogDescription>{c.body}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="reanalyze-keyword">{c.keyword}</Label>
              <Input
                id="reanalyze-keyword"
                value={keyword}
                maxLength={1000}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{c.keywordHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reanalyze-note">{c.note}</Label>
              <Textarea
                id="reanalyze-note"
                value={message}
                maxLength={4000}
                placeholder={c.notePlaceholder}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <p className="rounded-xl bg-warning-tint p-3 text-xs text-warning-ink">
              {c.warning}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                {c.cancel}
              </Button>
              <Button type="submit" variant="coral" disabled={run.isPending}>
                {run.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                {c.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
