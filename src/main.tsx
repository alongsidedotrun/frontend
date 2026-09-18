import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { App } from "@/App";
import { isTauri } from "@/hooks/use-tauri";
import "@/i18n";
import "@/index.css";

// No right-click "Inspect Element"/"Reload" menu for real users -- per explicit request
// ("disable the right click on tauri as well so users can't do right click and do inspect
// or reload"). WKWebView's own context menu isn't gated behind the devtools feature flag
// (unlike the actual inspector, which release builds already exclude), so it still shows
// up on every right-click without this. isTauri()-gated: a plain browser tab (dev, or the
// non-Tauri web build) keeps its normal context menu.
if (isTauri()) {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

// DSN isn't a secret (Sentry designs these to be public), so it's
// hardcoded here rather than requiring VITE_SENTRY_DSN to be set --
// override via VITE_SENTRY_DSN if ever needed. environment defaults to
// "development" so local dev is tagged and filterable in Sentry separately
// from real releases, which should set VITE_SENTRY_ENVIRONMENT=production
// explicitly.
Sentry.init({
  dsn:
    import.meta.env.VITE_SENTRY_DSN ||
    "https://f4e132d0b3062dd139aa00dadcc79d84@o4511943155515392.ingest.de.sentry.io/4511943328202834",
  release: import.meta.env.VITE_SENTRY_RELEASE,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Reveals the (until now hidden, see src-tauri/src/lib.rs's WebviewWindowBuilder)
// window right after mount, so the app_ready hidden-window/background_color/CSS
// app-mount-in fade above are already running by the time the window ever
// paints on screen -- previously the window built and showed itself immediately
// on launch, painting a blank white frame the instant it appeared and only
// swapping to real content a moment later, which is what read as a "snap" per
// explicit request ("fade in the application instead of snapping"). Dynamic
// import + isTauri() guard: @tauri-apps/api's own invoke throws immediately
// outside the desktop app, same reasoning use-tauri.ts's useIsFullscreen already
// follows for its own Tauri-only API calls.
if (isTauri()) {
  void import("@tauri-apps/api/core").then(({ invoke }) => invoke("app_ready"));
}
