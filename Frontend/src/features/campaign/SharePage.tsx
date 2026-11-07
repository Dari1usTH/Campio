import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Chip } from "@/components/campio/Chip";
import { EmptyState } from "@/components/campio/Illustrations";
import { buttonVariants } from "@/components/ui/button";
import type { Kit } from "@/services/kit";
import { useT } from "@/i18n";
import { CampaignLoading, KitHeader } from "./CampaignResultPage";
import { KitView } from "./kit/KitView";
import { readSharedKit } from "./share";
import { campaignCopy as c } from "./copy";

export default function SharePage() {
  const t = useT();
  const [kit, setKit] = useState<Kit | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setKit(readSharedKit());
    setReady(true);
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background z-40 border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link to="/" aria-label={c.backHome}>
            <Logo size={30} />
          </Link>
          <Chip variant="outline" size="sm" className="hidden sm:inline-flex">
            <LockKeyhole />
            {t.share.readonly}
          </Chip>
          <Link
            to="/signup"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            {t.share.cta}
            <ArrowUpRight />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8 md:py-12">
        {!ready ? (
          <CampaignLoading />
        ) : kit ? (
          <>
            <KitHeader kit={kit} readOnly />
            <KitView kit={kit} readOnly />
          </>
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
      <footer className="py-8 text-center text-xs text-muted-foreground">
        {t.share.madeWith}
      </footer>
    </div>
  );
}
