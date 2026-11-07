import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/campio/CookieBanner";
import { EmptyState } from "@/components/campio/Illustrations";
import { buttonVariants } from "@/components/ui/button";
import { themeInitScript } from "@/hooks/use-theme";

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <EmptyState
        art="smiles"
        title="404 · Pagina nu există"
        sub="Pagina pe care o cauți a fost mutată sau nu a existat niciodată."
        action={
          <Link to="/" className={buttonVariants({ variant: "default" })}>
            Înapoi acasă
          </Link>
        }
      />
    </main>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-bold">Pagina nu s-a încărcat</h1>
        <p className="mt-2 text-muted-foreground">
          Ceva n-a mers la noi. Reîncearcă sau mergi acasă.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className={buttonVariants({ variant: "default" })}
          >
            Încearcă din nou
          </button>
          <a href="/" className={buttonVariants({ variant: "outline" })}>
            Acasă
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F4EDE0" },
      { title: "Campio · Campania ta de marketing, gata de postat azi" },
      {
        name: "description",
        content: "Campio creează campanii de marketing complete cu AI pentru vânzătorii online.",
      },
      { name: "author", content: "Campio" },
      { property: "og:site_name", content: "Campio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Campio · Marketingul, reinventat cu AI." },
      {
        property: "og:description",
        content:
          "Campania ta de marketing, gata de postat azi. Public, mesaje, texte și vizuale într-un singur loc.",
      },
      { property: "og:image", content: "/og-campio.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [{ children: themeInitScript }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <CookieBanner />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
