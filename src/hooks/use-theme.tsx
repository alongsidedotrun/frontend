import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "alongside_theme";

// The stored *preference* -- "system" isn't itself a paintable theme, it
// means "resolve to whichever of dark/light the OS reports right now, and
// keep following it if that changes". ResolvedTheme is what actually ever
// gets applied to <html>.
export type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

// Matches the transition duration on .theme-transition in index.css --
// the fallback path below, for browsers without View Transitions.
const THEME_TRANSITION_MS = 200;

// The View Transitions API (Chrome/Edge 111+, Safari 18+; Firefox doesn't
// have it yet, hence the feature-detected fallback below) is what
// actually fixed this, not the single-Provider change above. That change
// was a real fix for a real bug (two untethered copies of "the current
// theme"), but it turned out not to be what was causing the *transition*
// itself to look staggered -- confirmed directly, it still staggered
// afterward. The .theme-transition class (index.css) approach forces
// every element's background-color/color/etc. to transition
// independently, and the browser doesn't guarantee independent per-
// element transitions all paint in perfect lockstep -- different
// elements can land in different compositing layers (position: sticky,
// overflow-y-auto, Framer Motion's own transform/opacity usage) with
// slightly different repaint timing, which reads exactly like "the logo
// changes, then the top bar, then the sidebar, then the content" even
// though every element's transition genuinely started at the same
// moment. startViewTransition sidesteps that class of issue entirely: it
// snapshots the whole page before and after the callback runs, then
// cross-fades those two snapshots as ONE compositor-level animation --
// there's no per-element timing left to drift apart, because there's
// only one animation, not N of them.
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark = resolveTheme(theme) === "dark";
  const apply = () => root.classList.toggle("dark", isDark);

  if (document.startViewTransition) {
    // .no-transitions (index.css) suppresses every element's OWN CSS
    // transitions for as long as this class is present. Without it,
    // anything that already has its own transition-colors for normal
    // hover/focus/open-close interactions -- a button's hover state, the
    // search input, DropdownMenuContent's own open/close fade -- ALSO
    // independently animates its background-color the moment .dark
    // flips, at that component's own (usually ~100-150ms) duration,
    // layered on top of the view transition's own snapshot crossfade
    // running at its own separate duration. Two overlapping animations
    // on the same element is what actually read as "the search bar/
    // hover states/dropdown lag behind everything else" -- removed once
    // .finished resolves (not a fixed setTimeout -- ties cleanup to the
    // transition's own real lifetime instead of guessing its duration).
    root.classList.add("no-transitions");
    const transition = document.startViewTransition(apply);
    // ViewTransition creates three promises up front -- ready,
    // updateCallbackDone, finished -- whether or not any caller ever
    // touches them; an unobserved rejection on ANY of the three still
    // reports as an unhandled rejection. "Old view transition aborted by
    // new view transition" (confirmed directly via the console) is the
    // spec's own wording for `ready` rejecting specifically when a new
    // transition supersedes one already in flight -- catching only
    // `finished` (this file's own earlier fix) left `ready` itself
    // unobserved, since nothing here ever reads it at all. Both silenced
    // now; benign either way (an expected outcome of rapid theme
    // switches), this just stops it from surfacing as an error.
    transition.ready.catch(() => {});
    transition.finished.finally(() => root.classList.remove("no-transitions")).catch(() => {});
    return;
  }

  // Fallback for browsers without View Transitions support -- same
  // mechanism this app used before, staggering risk and all, still
  // better than an instant, jarring snap.
  root.classList.add("theme-transition");
  apply();
  window.setTimeout(() => root.classList.remove("theme-transition"), THEME_TRANSITION_MS);
}

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  // Default stays "dark" (not "system") for anyone with no stored
  // preference yet -- matches this app's existing default from before
  // "system" existed as an option, rather than silently switching
  // everyone's default behavior out from under them.
  return stored === "light" || stored === "system" ? stored : "dark";
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
};

// Was a plain hook (each call site ran its own independent useState/
// useEffect, own copy of `theme`, own applyTheme call) -- App.tsx called it
// once just to apply the class on mount, NavUser.tsx called it again for
// the Appearance submenu, and neither instance knew the other existed.
// Real bug (two untethered copies of "the current theme" is never
// correct), so still worth fixing on its own merits, but it turned out
// *not* to be the cause of the staggered-transition report that prompted
// this change -- confirmed directly, switching still staggered afterward.
// applyTheme's own comment below has what actually fixed that. One
// Provider, mounted once in App.tsx, still means there's exactly one
// `theme` state and one applyTheme call for the whole app now, instead of
// two that can drift.
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);

    // Only matters while "system" is selected -- dark/light are already
    // fixed choices with nothing to listen for. Re-applies live if the OS
    // preference flips while this tab is open, instead of only picking up
    // the change on next load.
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
