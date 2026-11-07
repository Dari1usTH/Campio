import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { useSession } from "@/hooks/use-session";

export function LandingNav() {
  const t = useT();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#cum-functioneaza", label: t.landing.navHow },
    { href: "#ce-primesti", label: t.landing.navWhat },
    { href: "#cost", label: t.landing.navPrice },
    { href: "#intrebari", label: t.landing.navFaq },
  ];
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <nav
        aria-label="Principal"
        className="glass mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full border border-border/60 pl-5 pr-2 shadow-soft"
      >
        <Link to="/" aria-label="Campio, acasă">
          <Logo size={28} />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5">
          {session ? (
            <Button asChild size="sm">
              <Link to="/app">{t.nav.dashboard} ›</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">{t.landing.login}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">{t.landing.start} ›</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="iconSm"
            className="lg:hidden"
            aria-label={t.common.menu}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>
      {open && (
        <div className="glass mx-auto mt-2 max-w-6xl animate-rise rounded-[1.75rem] border border-border/60 p-2 shadow-lift lg:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-2xl px-4 font-medium hover:bg-secondary">
              {l.label}
            </a>
          ))}
          {!session && (
            <Link to="/login" className="flex min-h-11 items-center rounded-2xl px-4 font-medium hover:bg-secondary sm:hidden">
              {t.landing.login}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
