import { tr } from "@/i18n";
import { useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Campaign } from "@/services/schemas";
import { formatMoney, useT } from "@/i18n";
import { campaignCopy as c } from "./copy";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines = 4,
) {
  let line = "";
  let count = 0;
  for (const word of text.split(/\s+/)) {
    const next = `${line}${line ? " " : ""}${word}`;
    if (ctx.measureText(next).width > width && line) {
      ctx.fillText(line, x, y + count * lineHeight);
      count++;
      line = word;
      if (count >= maxLines - 1) break;
    } else line = next;
  }
  ctx.fillText(line, x, y + count * lineHeight);
}

export async function downloadCampaignPng(campaign: Campaign) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(c.downloadFailed);
  ctx.fillStyle = "#F4EDE0";
  ctx.fillRect(0, 0, 1080, 1080);
  if (campaign.product.photoUrl) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(c.downloadFailed));
      image.src = campaign.product.photoUrl!;
    });
    const ratio = Math.max(1080 / image.naturalWidth, 650 / image.naturalHeight);
    const width = image.naturalWidth * ratio;
    const height = image.naturalHeight * ratio;
    ctx.drawImage(image, (1080 - width) / 2, (650 - height) / 2, width, height);
  } else {
    ctx.fillStyle = "#FFE4DF";
    ctx.fillRect(0, 0, 1080, 650);
    ctx.fillStyle = "#FF6B5B";
    ctx.beginPath();
    ctx.arc(540, 310, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14213D";
    ctx.font = '700 100px "Inter Tight", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(campaign.product.name.slice(0, 2).toUpperCase(), 540, 345);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "#14213D";
  ctx.fillRect(38, 36, 210, 66);
  ctx.fillStyle = "#F4EDE0";
  ctx.font = '700 44px "Inter Tight", sans-serif';
  ctx.fillText("campio", 65, 83);
  ctx.fillStyle = "#14213D";
  ctx.font = '500 27px "Inter", sans-serif';
  ctx.fillText(campaign.product.name.slice(0, 55), 64, 716);
  ctx.font = '700 57px "Inter Tight", sans-serif';
  wrapText(ctx, campaign.keyMessage, 64, 787, 952, 66, 3);
  ctx.fillStyle = "#FF6B5B";
  ctx.beginPath();
  ctx.roundRect(64, 967, 337, 66, 33);
  ctx.fill();
  ctx.fillStyle = "#14213D";
  ctx.font = '600 27px "Inter", sans-serif';
  ctx.fillText(tr("extra.orderArrow"), 98, 1009);
  if (campaign.product.price !== null) {
    ctx.textAlign = "right";
    ctx.font = '700 37px "Inter Tight", sans-serif';
    ctx.fillText(formatMoney(campaign.product.price, campaign.product.currency), 1016, 1010);
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(c.downloadFailed))), "image/png"),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `campio-${campaign.id}-1080x1080.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VisualPreview({ campaign }: { campaign: Campaign }) {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-cream text-navy shadow-soft">
      <div className="relative aspect-[1.65] overflow-hidden bg-coral-tint">
        {campaign.product.photoUrl ? (
          <img
            src={campaign.product.photoUrl}
            alt={campaign.product.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <div className="grid size-28 place-items-center rounded-full bg-coral">
              <Sparkles className="size-12" />
            </div>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-xl bg-navy px-4 py-1.5 font-display text-xl font-bold tracking-tight text-cream">
          {tr("extra.logoPrefix")}<span className="text-coral">{tr("extra.logoEnd")}</span>
        </span>
      </div>
      <div className="p-5 sm:p-7">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em]">
          {campaign.product.name}
        </p>
        <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">
          {campaign.keyMessage}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold">
            {t.result.order} ↗
          </span>
          <span className="shrink-0 font-display text-xl font-bold">
            {campaign.product.price !== null &&
              formatMoney(campaign.product.price, campaign.product.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DownloadVisualButton({ campaign }: { campaign: Campaign }) {
  const [pending, setPending] = useState(false);
  const t = useT();
  return (
    <Button
      variant="default"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await downloadCampaignPng(campaign);
          toast.success(c.downloadDone);
        } catch {
          toast.error(c.downloadFailed);
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Download />}
      {pending ? c.downloading : t.result.downloadPng}
    </Button>
  );
}
