import { BrowserRouter, Navigate, useLocation, useRoutes, type RouteObject } from "react-router-dom";
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GettingStartedProvider, useGettingStarted } from "@/hooks/use-getting-started";
import { ThemeProvider } from "@/hooks/use-theme";
import { useApplyAppearanceSettings } from "@/hooks/use-appearance-settings";
import { AppsPage } from "@/pages/AppsPage";
import { AuthPage } from "@/pages/AuthPage";
import { ChatPage } from "@/pages/ChatPage";
import { DataAcknowledgementPage } from "@/pages/DataAcknowledgementPage";
import { DocsPage } from "@/pages/DocsPage";
import { HelpPage } from "@/pages/HelpPage";
import { HomePage } from "@/pages/HomePage";
import { InboxPage } from "@/pages/InboxPage";
import { JoinPage } from "@/pages/JoinPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { RedesignPage } from "@/pages/RedesignPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { WelcomePage } from "@/pages/WelcomePage";
import { diagnose_onboarding, hasCompletedOnboardingIntro } from "@/lib/onboarding";

// Opening the app should always enter the redesigned workspace. Onboarding is
// still available at its explicit routes, but it must not block normal use of
// the local app shell.
function AppRoot() {
  return <Navigate to="/overview" replace />;
}

function GettingStartedRoute() {
  const { show } = useGettingStarted();
  return show ? <WelcomePage /> : <Navigate to="/" replace />;
}

function OnboardGettingStartedRoute() {
  const location = useLocation();
  const openedFromSettings = new URLSearchParams(location.search).get("manage") === "data-acknowledgement";
  const [backendAcknowledged, setBackendAcknowledged] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/storage/status")
      .then(async (response) => response.ok ? response.json() as Promise<{ acknowledged: boolean }> : { acknowledged: false })
      .then((status) => setBackendAcknowledged(status.acknowledged))
      .catch(() => setBackendAcknowledged(false));
  }, []);

  const onboardingComplete = hasCompletedOnboardingIntro() && backendAcknowledged === true;

  if (!diagnose_onboarding && onboardingComplete && !openedFromSettings) {
    return <Navigate to="/getting-started" replace />;
  }

  return <DataAcknowledgementPage />;
}

function SecureAppRoute() {
  // The redesign is now the production shell. Existing routed pages remain
  // available as the right-side content through RedesignPage's Outlet.
  return <RedesignPage />;
}

const ROUTES: RouteObject[] = [
  { path: "/auth", element: <AuthPage /> },
  { path: "/", element: <AppRoot /> },
  { path: "/onboard", element: <OnboardingPage /> },
  { path: "/onboard/getting-started", element: <OnboardGettingStartedRoute /> },
  // Kept as a compatibility alias while the redesign is now the production
  // shell for every authenticated route.
  { path: "/redesign", element: <Navigate to="/inbox" replace /> },
  {
    // No RequireAuth gate any more -- per explicit request ("I'd like for
    // us to open Alongside and be able to navigate without being signed
    // in... users should be able to use our application without being
    // signed in but for multiplayer purposes, they should sign in").
    // /auth is still a real, reachable page (settings-overlay.tsx's own
    // Profile section links to it when signed out), just no longer a
    // forced redirect off of every other route. lib/auth.ts's own
    // useIsSignedIn is what the few features that genuinely need an
    // identity (sharing a chat, AppLayout.tsx's chat-header "..." menu)
    // check instead.
    element: <SecureAppRoute />,
    children: [
      { path: "/overview", element: <OverviewPage /> },
      { path: "/getting-started", element: <GettingStartedRoute /> },
      { path: "/new/chat", element: <HomePage /> },
      { path: "/new-chat", element: <Navigate to="/" replace /> },
      { path: "/chat/:sessionId", element: <ChatPage /> },
      // Joining a chat someone else hosts, from an invite link (JoinPage.tsx).
      { path: "/join", element: <JoinPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/apps", element: <AppsPage /> },
      // Full page now, not a modal -- per explicit request ("i want a
      // full page setting page"), matching Synara's own structure
      // exactly. :section is a real path segment (settings-overlay.tsx's
      // own SettingsSection union), not a query param -- SettingsPage
      // itself falls back to "general" for a missing/invalid one.
      { path: "/settings", element: <Navigate to="/settings/general" replace /> },
      // Static path, not caught by the :section param route below --
      // React Router ranks a static segment above a dynamic one at the
      // same position, so this always wins for this exact path. Lives
      // under /settings (not its own top-level /models any more) per
      // explicit request ("should change the content of the settings
      // and keep the sidebar"): the avatar dropdown's own "Provider
      // usage" rows and the Providers page's own Usage card both link
      // here now. /settings/provider/usage, not /settings/models --
      // per explicit request ("that should now be
      // /settings/provider/usage instead"), confirmed as a real bug
      // (AppLayout.tsx's own rawSettingsSegment fell back to
      // highlighting "General" as active on this page, since "models"
      // matched none of the real section keys): nesting it under
      // "provider" lets that same fallback logic map it to the
      // Providers section instead, matching where this page actually
      // belongs now.
      { path: "/settings/provider/usage", element: <ModelsPage /> },
      { path: "/settings/:section", element: <SettingsPage /> },
      { path: "/docs", element: <DocsPage /> },
      { path: "/help", element: <HelpPage /> },
      // Top bar's Agent/Code/Design tabs -- real clicks now, landing on
      // the shared PlaceholderPage until each gets real content (see
      // that component's own comment). Notifications/Activity/Invite
      // are their own dropdown instead of a route (top-bar.tsx's
      // TopBarPlaceholderMenu), not listed here.
      // Sidebar's own Inbox row, above New Chat -- InboxPage.tsx's own
      // comment has the current real-vs-placeholder scope.
      { path: "/inbox", element: <InboxPage /> },
      // Library (issue #286) -- every file the agent has actually touched,
      // sidebar-nav.tsx's own LIBRARY_ITEM row directly under Inbox.
      { path: "/library", element: <LibraryPage /> },
      { path: "/agents", element: <Navigate to="/" replace /> },
      { path: "/code", element: <PlaceholderPage title="Code" /> },
      { path: "/design", element: <PlaceholderPage title="Design" /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
];

// Fades from the sign-in page into the real app shell (Home, the default
// landing page once signed in) instead of snapping straight to it -- the
// one route boundary in this app that isn't already covered by
// AppLayout.tsx's own AnimatePresence, since AuthPage sits outside that
// layout entirely (a sibling route, not nested under it).
//
// useRoutes(), not <Routes>/<Outlet/> rendered directly inside the
// animated wrapper -- confirmed directly (AppLayout.tsx's own git
// history): a live route-context consumer rendered inside a *still-
// exiting* AnimatePresence child keeps tracking the router's current
// (already-changed) route during its own exit animation, mounting the
// *new* page early inside the *old*, about-to-unmount wrapper, which then
// unmounts it again the moment that exit finishes -- a real, visible
// double mount/fade, not just a theoretical risk. useRoutes() captures a
// plain element once per render instead, so the exiting wrapper keeps
// whatever page it was actually given.
//
// Keyed by a coarse isAuthPage boolean, not the full pathname -- this
// fade should only play when crossing the /auth <-> authenticated-app
// boundary, not on every single in-app navigation (Agent, Settings, a new
// chat, etc.), which AppLayout's own pathname-keyed AnimatePresence
// already handles on its own. Keying by the full pathname here too would
// remount (and re-fade) this *outer* wrapper on every one of those
// in-app moves as well, stacking a second, redundant fade on top of the
// one AppLayout already plays.
function AppRoutes() {
  const location = useLocation();
  const element = useRoutes(ROUTES);
  const isAuthPage = location.pathname === "/auth";

  // Keep the route boundary as a plain layer. The app shell owns its own
  // transitions; an animated ancestor creates a composited layer that can
  // leave the desktop shell unpainted while the route is settling.
  return (
    <div className="relative h-dvh min-h-0">
      <div key={isAuthPage ? "auth" : "app"} className="absolute inset-0">
        {element}
      </div>
    </div>
  );
}

export function App() {
  // Applies the persisted system-font/font-smoothing/chat-width Appearance
  // settings once at startup, before AppearanceSection (settings-overlay.tsx)
  // ever mounts -- that component's own handlers additionally apply these
  // same effects live the moment a control changes (use-appearance-settings.ts's
  // own comment has the full reasoning for not needing a shared context).
  useApplyAppearanceSettings();

  return (
    // Catches otherwise-unhandled render errors instead of leaving a blank
    // white screen; reports to Sentry when VITE_SENTRY_DSN is set (see
    // main.tsx), no-ops otherwise.
    <Sentry.ErrorBoundary
      fallback={
        <div className="flex h-screen items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Something went wrong. Try reloading the app.
        </div>
      }
    >
      {/* ThemeProvider, not a bare useTheme() call (what this used to be)
          -- applies the stored/default theme class on <html> regardless of
          which route is active (AuthPage included), same as before, but
          now as the single shared source of truth NavUser.tsx's own
          useTheme() call (the Appearance submenu) reads from too, instead
          of each maintaining an independent, untethered copy of the
          current theme. See use-theme.ts's own comment for why that
          mattered. */}
      <ThemeProvider>
        <GettingStartedProvider>
          <TooltipProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </GettingStartedProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}
