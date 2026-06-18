import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { AppProvider as MYTAppProvider } from "@/myt/lib/app-context";
import { SettingsProvider as MYTSettingsProvider } from "@/myt/lib/settings-context";
import { TourDataProvider as MYTTourDataProvider } from "@/myt/lib/tour-data-context";
import { OwnerProvider } from "@/owner/owner-context";
import { OnboardingWalkthrough } from "@/components/OnboardingWalkthrough";

import { FileQuestion, Home } from "lucide-react";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/3 left-1/2 -z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[80px]" />
      <div className="absolute bottom-1/3 left-1/4 -z-10 h-[250px] w-[250px] rounded-full bg-primary/10 blur-[80px]" />

      <div className="w-full max-w-md rounded-2xl border border-border bg-card/65 p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-inner">
          <FileQuestion className="h-7 w-7" />
        </div>
        
        <h1 className="font-display text-5xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
          404
        </h1>
        <h2 className="mt-3 text-lg font-semibold text-foreground">
          Route Mismatch Detected
        </h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          The requested operational resource does not exist or has been relocated within the Arena command center.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-xs font-semibold text-accent-foreground hover:opacity-90 transition-opacity gap-1.5 shadow-md shadow-accent/25"
          >
            <Home className="h-3.5 w-3.5" />
            Go to Dashboard
          </Link>
          <a
            href="/"
            className="w-full sm:w-auto inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-5 text-xs font-semibold hover:bg-muted transition-colors"
          >
            Public Site
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Align Deal Flow — Gharpayy CRM" },
      { name: "description", content: "Real-estate closing CRM with HR, Flow Ops, TCM, and Owner modules." },
      { property: "og:title", content: "Align Deal Flow — Gharpayy CRM" },
      { name: "twitter:title", content: "Align Deal Flow — Gharpayy CRM" },
      { property: "og:description", content: "Real-estate closing CRM with HR, Flow Ops, TCM, and Owner modules." },
      { name: "twitter:description", content: "Real-estate closing CRM with HR, Flow Ops, TCM, and Owner modules." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cdbd98a7-e10c-4823-bffd-0d94377d1a44/id-preview-d6582724--03dde394-5d87-421b-b74f-5c9974de7c0d.lovable.app-1776859196342.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cdbd98a7-e10c-4823-bffd-0d94377d1a44/id-preview-d6582724--03dde394-5d87-421b-b74f-5c9974de7c0d.lovable.app-1776859196342.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
      <MYTSettingsProvider>
        <MYTTourDataProvider>
          <MYTAppProvider>
            <OwnerProvider>
              <Outlet />
              <Toaster />
              <KeyboardShortcuts />
              <OnboardingWalkthrough />
            </OwnerProvider>
          </MYTAppProvider>
        </MYTTourDataProvider>
      </MYTSettingsProvider>
    </QueryClientProvider>
  );
}
