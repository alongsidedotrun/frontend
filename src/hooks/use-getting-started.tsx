import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// Same shared-Context shape as use-theme.tsx's own ThemeProvider, for the same
// reason: this needs to be read (App.tsx's own "/" redirect target,
// sidebar-nav.tsx's Getting started row) and written (settings-overlay.tsx's
// General toggle, WelcomePage's own "hide this page" control) from several
// unrelated places at once, and all of them need to agree on one live value --
// a plain per-call-site useState/localStorage read would give each of them its
// own untethered copy, the same real bug use-theme.tsx's own comment
// describes having to fix once already.
const STORAGE_KEY = "alongside_show_getting_started";

function getStored(): boolean {
  // Default true (shown) for anyone with no stored preference yet -- this
  // page is the app's current default landing page (App.tsx), so absence of
  // a stored value should mean "show it", not "hide it".
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

type GettingStartedContextValue = {
  show: boolean;
  setShow: (next: boolean) => void;
};

const GettingStartedContext = createContext<GettingStartedContextValue | null>(null);

export function GettingStartedProvider({ children }: { children: ReactNode }) {
  const [show, setShowState] = useState<boolean>(getStored);

  const setShow = useCallback((next: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    setShowState(next);
  }, []);

  return <GettingStartedContext.Provider value={{ show, setShow }}>{children}</GettingStartedContext.Provider>;
}

export function useGettingStarted() {
  const ctx = useContext(GettingStartedContext);
  if (!ctx) throw new Error("useGettingStarted must be used within a GettingStartedProvider");
  return ctx;
}
