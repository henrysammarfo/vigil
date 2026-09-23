import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/client-error-reporting";
import { DEFAULT_DESCRIPTION, pageMeta, SITE_TAGLINE, siteUrl } from "../lib/site";
import { AnalyticsBoot, CookieConsentBanner } from "../components/vigil/cookie-consent";
import { BrandMark } from "../components/vigil/brand";
import { Button } from "../components/ui/button";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-background">
      <div className="px-5 pt-8 md:px-12">
        <BrandMark />
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-md text-center">
          <p className="eyebrow text-muted-foreground">Error 404</p>
          <h1 className="mt-4 text-5xl font-bold uppercase tracking-tight text-heading md:text-7xl">
            Signal lost
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            That route isn’t on the map. Head home or create your private paper workspace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="signal" size="signal" asChild>
              <Link to="/auth" search={{ next: "/dashboard" }}>
                Create workspace
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Go home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#15bcdf" },
      { name: "author", content: "Henry Sam Marfo" },
      ...pageMeta({
        title: `VIGIL — ${SITE_TAGLINE}`,
        description: DEFAULT_DESCRIPTION,
        path: "/",
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Quantico:wght@400;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/vigil-mark.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "canonical", href: siteUrl() },
      { rel: "sitemap", href: "/sitemap.xml", type: "application/xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <CookieConsentBanner />
        <AnalyticsBoot />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
