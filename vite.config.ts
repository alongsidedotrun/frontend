import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // In production (the Tauri desktop shell's release build) this app is now
  // embedded into and served by the Rust backend directly, same origin as the
  // API (backend/src/server.rs's own AppAssets) -- but `npm run dev` here still
  // runs Vite on its own separate origin/port for real hot-reload while
  // editing, so every backend route this app's own fetch/WebSocket calls hit
  // needs its own proxy entry below, or those calls 404 against Vite itself
  // (served the SPA's own index.html by its catch-all, not a real backend
  // response) instead of ever reaching the backend. 127.0.0.1:3000 matches
  // backend/src/main.rs's own BIND_ADDR default. ws: true on /sessions is
  // required for ChatPage's `/sessions/{id}/ws` -- Vite's proxy only forwards
  // a WebSocket upgrade when explicitly told to, the plain string shorthand
  // (used for /cli, all regular HTTP) doesn't enable it.
  server: {
    proxy: {
      "/sessions": { target: "http://127.0.0.1:3000", ws: true },
      "/cli": "http://127.0.0.1:3000",
      // /projects, /settings, /secrets -- confirmed directly as a real gap
      // (GET /projects returning Vite's own SPA index.html, 200 OK but
      // Content-Type: text/html, not JSON -- exactly the failure mode this
      // file's own comment above already named): these three routes were
      // added to the backend across this session (the SQLite migration's
      // own project endpoints, then Story 4.5.7's secret-storage settings)
      // without ever being added here, so every fetch to them through the
      // dev server silently fell through to Vite's own catch-all instead of
      // ever reaching the backend -- broken since the moment each was
      // built, not a new regression today.
      "/projects": "http://127.0.0.1:3000",
      "/inbox-items": "http://127.0.0.1:3000",
      "/search": "http://127.0.0.1:3000",
      // /usage, /provider-usage/* -- ModelsPage.tsx/nav-user.tsx's own
      // real usage data (backend/src/provider_usage.rs): same exact gap
      // this file's own comments already document for /projects etc. --
      // confirmed directly as a real bug ("frontend still showing No
      // connection to the application... ALS-002" even though the
      // backend endpoint itself returned real data via curl) -- without
      // an entry here these fell through to Vite's own SPA catch-all
      // (200 OK, text/html) instead of ever reaching the backend.
      "/usage": "http://127.0.0.1:3000",
      "/provider-usage": "http://127.0.0.1:3000",
      // Not a bare "/settings" prefix -- that collided with this app's own
      // *frontend* route, /settings/:section (App.tsx, a real page:
      // /settings/general, /settings/providers, etc.). A client-side
      // navigation into Settings never noticed (React Router handles that
      // in-memory, no new HTTP request), but a full page load or reload
      // *at* one of those URLs is a real GET request Vite's dev server has
      // to answer -- and with the blanket "/settings" rule, it forwarded
      // that request straight to the backend instead of serving this
      // app's own index.html, landing on a route the backend has nothing
      // real for (confirmed directly: "any page inside settings" reloads
      // to a blank white page with an empty document, no console error --
      // exactly what a misrouted proxy response looks like, not a render
      // crash, which the app's own ErrorBoundary would have shown a
      // message for instead). Scoped to the two real backend endpoints
      // that actually live under /settings (server.rs) instead.
      "/settings/secret-backend": "http://127.0.0.1:3000",
      "/settings/default-model": "http://127.0.0.1:3000",
      // Real bug, confirmed directly via the browser console (repeated "Failed to load
      // resource... 404 (last-used)"): both of these real backend endpoints
      // (server.rs's own set_last_used/get_last_used and set_autocompact/get_autocompact)
      // were added after this proxy list, without a matching entry here -- every browser
      // call to them (compose-box.tsx's Effort/Model/Context/autocompact persistence)
      // silently 404'd against Vite's own dev server instead of ever reaching the
      // backend. Every raw curl test this session hit port 3000 directly, which is why
      // this went unnoticed until real browser usage surfaced it.
      "/settings/last-used": "http://127.0.0.1:3000",
      // "/settings/autocompact" removed -- that endpoint no longer exists on the
      // backend (replaced by the per-chat/per-project compact threshold below).
      "/settings/autocompact-scope": "http://127.0.0.1:3000",
      "/settings/autocompact-global": "http://127.0.0.1:3000",
      "/secrets": "http://127.0.0.1:3000",
      // AuthPage.tsx's own "Continue with email" flow (Story #239) --
      // confirmed directly as the exact same class of gap this file's own
      // comment above already names: without an entry here, /auth/
      // check-email, /auth/signup, /auth/login all silently fell through to
      // Vite's own SPA catch-all (200 OK, text/html) instead of reaching
      // the backend, which surfaced in the UI as "Could not reach the
      // server" even though the backend itself was healthy.
      "/auth/check-email": "http://127.0.0.1:3000",
      "/auth/signup": "http://127.0.0.1:3000",
      "/auth/login": "http://127.0.0.1:3000",
      // Real bug, confirmed directly via a real console error ("The string
      // did not match the expected pattern" -- WebKit's own JSON.parse
      // failure wording for non-JSON input): the exact same recurring gap
      // this file's own comments already document repeatedly for past
      // endpoints -- /library (issue #286), /files (issue #288), and
      // /integrations + /permission-rules (issue #287) were all added to
      // the backend across this session without a matching entry here, so
      // every real fetch to them fell through to Vite's own SPA catch-all
      // (200 OK, text/html) instead of ever reaching the backend.
      // "/library/files", not a bare "/library" -- real bug, confirmed
      // directly ("when refreshing http://localhost:5173/library that
      // stay white... http proxy error: /library/files"): LibraryPage.tsx's
      // own client-side route is exactly /library, so a bare prefix here
      // proxied a full page reload at that URL straight to the backend
      // (bypassing Vite's own SPA fallback entirely, unlike a plain 404
      // which Vite would have served index.html for), instead of ever
      // letting Vite serve the real app shell. Same class of bug this
      // file's own /settings comment already documents (a bare
      // "/settings" prefix collided with the frontend's own
      // /settings/:section route) -- scoped to the one real API sub-path,
      // matching server.rs's own route rename to /library/files.
      "/library/files": "http://127.0.0.1:3000",
      "/files": "http://127.0.0.1:3000",
      "/integrations": "http://127.0.0.1:3000",
      "/permission-rules": "http://127.0.0.1:3000",
    },
  },
});
