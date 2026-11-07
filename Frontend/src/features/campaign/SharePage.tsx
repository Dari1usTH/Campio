import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Chip } from "@/components/campio/Chip";
import { EmptyState } from "@/components/campio/Illustrations";
import { buttonVariants } from "@/components/ui/button";
import { campaignQuery } from "@/services/queries";
import type { Campaign } from "@/services/schemas";
import { useT } from "@/i18n";
import { CampaignReport, CampaignLoading } from "./CampaignResultPage";
import { readSharedCampaign } from "./share";
import { campaignCopy as c } from "./copy";

export default function SharePage() {
  const t = useT();
  const { id = "" } = useParams({ strict: false });
  const [snapshot, setSnapshot] = useState<Campaign | null>(null);
  const [ready, setReady] = useState(false);
  const [hasHash, setHasHash] = useState(false);
  useEffect(() => {
    setSnapshot(readSharedCampaign());
    setHasHash(window.location.hash.includes("data="));
    setReady(true);
  }, []);
  const demo = useQuery({ ...campaignQuery(id), enabled: ready && !hasHash });
  const campaign = snapshot ?? (!hasHash ? demo.data : undefined);
  return (
    <div className="min-h-screen bg-background">
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link to="/" aria-label={c.backHome}>
            <Logo size={30} />
          </Link>
          <Chip variant="outline" size="sm" className="hidden sm:inline-flex">
            <LockKeyhole />
            {t.share.readonly}
          </Chip>
          <Link to="/signup" className={buttonVariants({ variant: "default", size: "sm" })}>
            {t.share.cta}
            <ArrowUpRight />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {!ready || (!hasHash && demo.isPending) ? (
          <CampaignLoading />
        ) : campaign ? (
          <CampaignReport campaign={campaign} readOnly />
        ) : (
          <EmptyState
            title={c.invalidShare}
            art="box"
            action={
              <Link to="/" className={buttonVariants()}>
                {c.backHome}
              </Link>
            }
          />
        )}
      </main>
      <footer className="py-8 text-center text-xs text-muted-foreground">{t.share.madeWith}</footer>
    </div>
  );
}
