import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Kit } from "@/services/kit";
import { useKitCopy, type KitCopy } from "./copy";
import { MarketTab } from "./MarketTab";
import { WebTab } from "./WebTab";
import { AudienceTab, ContentTab, PositioningTab } from "./StrategyTabs";
import { PlanTab } from "./PlanTab";
import { VideoTab } from "./VideoTab";
import { ChatTab, CostTab } from "./CostChatTabs";

type TabId = keyof KitCopy["tabs"];

const ALL: TabId[] = [
  "market",
  "web",
  "audience",
  "positioning",
  "content",
  "plan",
  "video",
  "cost",
  "chat",
];
const READ_ONLY: TabId[] = [
  "market",
  "web",
  "audience",
  "positioning",
  "content",
  "plan",
  "cost",
];

/** Which section a tab needs before it has anything to show (used for the "filled" dot). */
const filled = (kit: Kit, tab: TabId) =>
  ({
    market: !!kit.market,
    web: !!kit.web,
    audience: !!kit.strategy,
    positioning: !!kit.strategy,
    content: !!kit.content,
    plan: !!kit.plan,
    video: !!kit.content,
    cost: kit.status === "completed",
    chat: kit.status === "completed",
  })[tab];

export function KitView({
  kit,
  readOnly = false,
}: {
  kit: Kit;
  readOnly?: boolean;
}) {
  const c = useKitCopy();
  const tabs = readOnly ? READ_ONLY : ALL;
  const fromHash = () => {
    if (typeof window === "undefined") return "market";
    const h = window.location.hash.slice(1) as TabId;
    return tabs.includes(h) ? h : "market";
  };
  const [tab, setTab] = useState<TabId>(fromHash);
  useEffect(() => {
    if (readOnly) return;
    const onHash = () => setTab(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as TabId);
        if (!readOnly) history.replaceState(null, "", `#${v}`);
      }}
    >
      <div className="print-hidden sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur">
        <TabsList className="h-auto gap-1 rounded-2xl bg-secondary p-1">
          {tabs.map((id) => (
            <TabsTrigger
              key={id}
              value={id}
              className="relative min-h-10 rounded-xl px-4"
            >
              {c.tabs[id]}
              {!filled(kit, id) && (
                <span
                  className="ml-1.5 size-1.5 rounded-full bg-muted-foreground/40"
                  aria-hidden="true"
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="market" className="mt-4">
        <MarketTab kit={kit} />
      </TabsContent>
      <TabsContent value="web" className="mt-4">
        <WebTab kit={kit} />
      </TabsContent>
      <TabsContent value="audience" className="mt-4">
        <AudienceTab kit={kit} />
      </TabsContent>
      <TabsContent value="positioning" className="mt-4">
        <PositioningTab kit={kit} />
      </TabsContent>
      <TabsContent value="content" className="mt-4">
        <ContentTab kit={kit} readOnly={readOnly} />
      </TabsContent>
      <TabsContent value="plan" className="mt-4">
        <PlanTab kit={kit} readOnly={readOnly} />
      </TabsContent>
      {!readOnly && (
        <TabsContent value="video" className="mt-4">
          <VideoTab kit={kit} />
        </TabsContent>
      )}
      <TabsContent value="cost" className="mt-4">
        <CostTab kit={kit} />
      </TabsContent>
      {!readOnly && (
        <TabsContent value="chat" className="mt-4">
          <ChatTab kit={kit} />
        </TabsContent>
      )}
    </Tabs>
  );
}
