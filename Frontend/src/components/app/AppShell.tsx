import { tr } from "@/i18n";
import { LanguageSwitch } from "@/components/campio/LanguageSwitch";
import { Link, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Home,
  Layers,
  Image,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Moon,
  Sun,
  X,
  ArrowUpRight,
  CircleHelp,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSession, useSessionReady } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/services/auth";
import { campaignsService } from "@/services/campaigns";
import { notificationsQuery } from "@/services/queries";
import { USE_MOCKS } from "@/services/api";
import { useT, formatRelative } from "@/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AppShell() {
  const t = useT();
  const session = useSession();
  const sessionReady = useSessionReady();
  const { theme, setTheme } = useTheme();
  const path = useLocation({ select: (l) => l.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const qc = useQueryClient();
  const notifications = useQuery({ ...notificationsQuery(), enabled: sessionReady && !!session });
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  const markRead = useMutation({
    mutationFn: () => campaignsService.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(e.message),
  });
  const nav = [
    { to: "/app", label: t.nav.dashboard, icon: Home },
    { to: "/app/campaigns", label: t.nav.campaigns, icon: Layers },
    { to: "/app/assets", label: t.nav.assets, icon: Image },
    { to: "/app/settings", label: t.nav.settings, icon: Settings },
  ] as const;
  const current = nav.find((n) =>
    n.to === "/app" ? path === "/app" || path === "/app/" : path.startsWith(n.to),
  );
  if (!sessionReady) return <div className="min-h-dvh animate-pulse bg-background" aria-label={t.common.loading} />;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <div className={cn("app-layout min-h-dvh", collapsed && "sidebar-collapsed")}>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-full bg-coral px-5 py-3 text-navy focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t.common.skipToContent}
      </a>
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto border-r border-border/70 bg-surface px-5 pb-6 pt-8 lg:flex">
        <Link to="/" aria-label={tr("brand.name")} className="mb-12 px-3">
          <Logo variant={collapsed ? "mark" : "full"} size={34} />
        </Link>
        <Button asChild variant="coral" className="mb-8 w-full shrink-0 shadow-none">
          <Link to="/app/new">
            <Plus />
            {!collapsed && <span className="sidebar-label">{t.common.createCampaign}</span>}
          </Link>
        </Button>
        <nav aria-label={t.common.menu} className="space-y-2">
          {nav.map((n) => {
            const active =
              n.to === "/app" ? path === "/app" || path === "/app/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                title={n.label}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-colors",
                  active
                    ? "bg-navy text-cream-soft shadow-soft"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <n.icon className="size-[19px] shrink-0" />
                {!collapsed && <span className="sidebar-label">{n.label}</span>}
                {active && !collapsed && (
                  <span className="ml-auto size-1.5 rounded-full bg-coral" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-5 pt-8">
          {!collapsed && (
            <div className="sidebar-label rounded-3xl bg-secondary/70 p-4">
              <Sparkles className="mb-3 size-5 text-coral-ink" />
              <p className="font-display text-base font-semibold">{t.workspace.help}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t.workspace.helpBody}
              </p>
              <Link
                to="/app/campaigns"
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold"
              >
                {t.landing.heroSecondary}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden min-h-11 w-full items-center gap-3 rounded-xl px-4 text-xs text-muted-foreground hover:bg-secondary xl:flex"
            aria-label={collapsed ? t.nav.expand : t.nav.collapse}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4" />
                <span>{t.nav.collapse}</span>
              </>
            )}
          </button>
          <div className="flex items-center gap-3 border-t border-border px-1 pt-5">
            <Link
              to="/app/settings"
              className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-coral-tint text-sm font-semibold text-coral-ink"
            >
              {session?.user.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                (session?.user.name ?? "A").slice(0, 1)
              )}
            </Link>
            {!collapsed && (
              <div className="sidebar-label min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{session?.user.name ?? ""}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {session?.user.businessName ?? t.workspace.demoMode}
                </p>
              </div>
            )}
            {!collapsed && session && (
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={t.nav.logout}
                onClick={async () => {
                  await authService.logout();
                  window.location.assign("/");
                }}
              >
                <LogOut />
              </Button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-body min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-5 backdrop-blur-xl md:px-8 xl:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="lg:hidden">
              <Logo size={28} />
            </Link>
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {current?.label ?? t.nav.newCampaign}
            </span>
            <span className="hidden text-muted-foreground/40 lg:inline">/</span>
            <span className="hidden text-xs font-medium lg:inline">
              {session?.user.businessName ?? ""}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitch />
            {USE_MOCKS && (
              <span className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-success" />
                {t.workspace.demoMode}
              </span>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={t.workspace.theme}
            >
              {theme === "light" ? <Moon /> : <Sun />}
            </Button>
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`${t.nav.notifications}${unread ? `: ${unread}` : ""}`}
                  className="relative bg-card"
                >
                  <Bell />
                  {unread > 0 && (
                    <span className="absolute right-2 top-1.5 size-2 rounded-full bg-coral" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[min(23rem,calc(100vw-2rem))] rounded-3xl p-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t.nav.notifications}</h2>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => setNotificationsOpen(false)}
                    aria-label={t.workspace.closeNotifications}
                  >
                    <X />
                  </Button>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t.workspace.notificationsDescription}
                </p>
                {notifications.isPending ? (
                  <div className="skeleton-shimmer h-24 rounded-xl" />
                ) : notifications.isError ? (
                  <p role="alert" className="py-5 text-sm">
                    {t.workspace.notificationError}
                  </p>
                ) : notifications.data.length === 0 ? (
                  <p className="py-5 text-sm">{t.nav.noNotifications}</p>
                ) : (
                  notifications.data.map((n) => (
                    <a
                      key={n.id}
                      href={n.href ?? "/app"}
                      onClick={() => setNotificationsOpen(false)}
                      className={cn(
                        "mb-2 block rounded-2xl p-3 hover:bg-secondary",
                        !n.read && "bg-coral-tint/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-coral" />}
                        <p className="text-sm font-semibold">{n.title}</p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </p>
                    </a>
                  ))
                )}
                <Button
                  variant="ghost"
                  className="mt-1 w-full text-xs"
                  disabled={markRead.isPending || !unread}
                  onClick={() => markRead.mutate()}
                >
                  {t.nav.markAllRead}
                </Button>
              </PopoverContent>
            </Popover>
            <Link
              to="/app/settings"
              aria-label={t.nav.settings}
              className="ml-1 grid size-10 place-items-center rounded-full bg-coral-tint text-sm font-bold text-coral-ink lg:hidden"
            >
              {(session?.user.name ?? "A").slice(0, 1)}
            </Link>
          </div>
        </header>
        <nav
          aria-label={t.common.menu}
          className="no-scrollbar hidden gap-2 overflow-x-auto border-b border-border px-6 py-3 md:flex lg:hidden"
        >
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium",
                current?.to === n.to ? "bg-navy text-cream" : "hover:bg-secondary",
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
          <Button asChild variant="coral" className="ml-auto shrink-0">
            <Link to="/app/new">
              <Plus />
              {t.common.createCampaign}
            </Link>
          </Button>
        </nav>
        <main
          id="main-content"
          className="mx-auto max-w-[1360px] px-4 pb-32 pt-7 sm:px-6 md:px-8 md:pb-12 md:pt-9 xl:px-10"
        >
          <Outlet />
        </main>
        {USE_MOCKS && (
          <p className="mx-auto hidden max-w-[1280px] px-8 pb-6 text-[10px] text-muted-foreground md:block">
            {t.workspace.demoNote}
          </p>
        )}
      </div>
      <Link
        to="/app/new"
        aria-label={t.common.createCampaign}
        className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-5 z-30 grid size-14 place-items-center rounded-full bg-coral text-navy shadow-coral transition-transform active:scale-95 md:hidden"
      >
        <Plus className="size-6" />
      </Link>
      <nav
        aria-label={t.common.menu}
        className="safe-bottom fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[1.6rem] border border-border/60 bg-navy px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-cream-soft shadow-float md:hidden"
      >
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[10px] transition-colors",
              current?.to === n.to ? "bg-cream/12 text-coral" : "text-cream/70",
            )}
          >
            <n.icon className="size-[19px]" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
