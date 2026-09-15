import { useState, useSyncExternalStore } from "react";

// useSyncExternalStore, not useEffect + useState -- this app is client-only
// (no SSR), so there's no hydration mismatch to dodge the way use-platform.ts's
// useIsMac has to; reading the real matchMedia value synchronously on first
// render (via getSnapshot below) means callers never see a stale "assume
// desktop" flash before the real value lands after mount.
function subscribe(query: string, onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useMediaQuery(query: string) {
  // matchMedia's own MediaQueryList is not itself referentially stable
  // across calls, so subscribe/getSnapshot below re-create it from `query`
  // each time rather than closing over a single instance -- useState here
  // just keeps that query string stable across re-renders without
  // re-deriving it as a fresh dependency identity every render.
  const [stableQuery] = useState(query);
  return useSyncExternalStore(
    (onChange) => subscribe(stableQuery, onChange),
    () => window.matchMedia(stableQuery).matches
  );
}

// Below the sm breakpoint (Tailwind's own default, 40rem/640px -- this
// project doesn't override it, unlike xs) -- drives sidebar-nav.tsx's
// mobile drawer behavior. Widened from the original xs/480px threshold
// per explicit request: the sidebar's own persistent collapsed rail was
// still pushing/overlapping page content at sm-tier widths (640px and
// below), the same problem the drawer treatment already fixed below xs.
// rem units in an actual media query resolve against the browser's
// initial (unscaled) root font-size, not this app's own html { font-size:
// 90% } override, so this stays a reliable 640px regardless of that
// page-wide scaling. top-bar.tsx's own MobileMenu hamburger still swaps
// in at the narrower xs/480px threshold -- a separate, not-yet-widened
// concern (its own right-group width-matching math assumes that
// hamburger-only breakpoint specifically).
const MOBILE_QUERY = "(max-width: 639px)";

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}
