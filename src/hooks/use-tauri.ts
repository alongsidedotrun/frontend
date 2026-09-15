import { useEffect, useState } from "react";

// window.__TAURI_INTERNALS__ is injected by the Tauri runtime into every
// webview it creates, and is absent in a plain browser tab -- the
// documented way to tell "running inside the desktop app" from "running
// inside a normal browser" without needing an async call. A synchronous
// check (not a hook of its own) since it never changes after load; the
// hook below just gives components a stable read of it.
export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useIsTauri() {
  // Starts false (assume plain browser) to match the very first render,
  // then corrects synchronously in a layout-free effect -- same "no
  // reliable signal before mount" reasoning use-platform.ts's own
  // useIsMac already uses. isTauri() itself doesn't need the deferred
  // check (it's synchronous, no async Tauri API call involved), but
  // reading it inside an effect keeps this hook's own render behavior
  // consistent with the app's other environment-detection hooks.
  const [tauri, setTauri] = useState(false);
  useEffect(() => {
    setTauri(isTauri());
  }, []);
  return tauri;
}

// Whether the Tauri window is currently fullscreen -- only meaningful
// inside the desktop app (isTauri() false everywhere else, including
// this hook: it no-ops in a browser rather than throwing on the missing
// __TAURI_INTERNALS__ bridge @tauri-apps/api's own calls need).
//
// Sidebar-nav.tsx's own collapse behavior reads this to decide between
// two different "collapsed" treatments on the desktop app: dray's own
// "collapses to nothing" style when the window is NOT fullscreen (its
// own native traffic-light buttons are visible then, which is what the
// whole collapse-to-nothing-plus-a-separate-toggle design exists to
// clear), falling back to the regular narrow icon rail once fullscreen
// removes the traffic lights entirely -- same distinction dray's own
// SidebarToggle makes for its own positioning (fullscreen ? "-ml-1" :
// "pl-(--traffic-lights-w)").
export function useIsFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function sync() {
      // Dynamic import: @tauri-apps/api's own window module calls into
      // the Tauri bridge at *module load* time in some builds, which
      // throws immediately outside the desktop app -- deferring the
      // import until this effect has already confirmed isTauri() keeps
      // that call from ever running in a plain browser tab.
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const current = await win.isFullscreen();
      if (!cancelled) setFullscreen(current);
      // onResized, not a dedicated fullscreen-change event -- Tauri v2
      // doesn't expose one directly, but entering/leaving fullscreen
      // always resizes the window, so this fires exactly when the
      // answer to isFullscreen() could have changed.
      unlisten = await win.onResized(async () => {
        const next = await win.isFullscreen();
        if (!cancelled) setFullscreen(next);
      });
    }

    void sync();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return fullscreen;
}
