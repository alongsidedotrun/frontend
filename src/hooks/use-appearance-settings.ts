import { useEffect } from "react";
import { detectMac } from "@/hooks/use-platform";

// Three new Appearance settings -- per explicit request ("lets add the
// option use system ui font, ui density either compact(default) or
// comfortable, chat width (Standard, Expanded), Font smoothing. All these
// like synara's option at typography and spacing"). Plain localStorage
// keys/loaders, same pattern this file's own siblings already use for
// Density/Transparency (settings-overlay.tsx) -- no context needed since
// each setting's own effect (below) is applied both once at app start
// (useApplyAppearanceSettings, called from App.tsx) and immediately at
// the moment AppearanceSection's own toggle/segmented control changes it,
// rather than a shared reactive store.

const SYSTEM_UI_FONT_KEY = "alongside_system_ui_font";
const FONT_SMOOTHING_KEY = "alongside_font_smoothing";
const CHAT_WIDTH_KEY = "alongside_chat_width";

export type ChatWidth = "standard" | "expanded";

// Default true (system font) -- matches Synara's own default (this
// setting's own screenshot showed it already toggled on) and this app's
// own recent switch to the system stack as the app-wide default
// (index.css's own --font-sans comment has the "why system by default"
// history).
export function loadSystemUiFont(): boolean {
  return localStorage.getItem(SYSTEM_UI_FONT_KEY) !== "false";
}

// Default true -- macOS's own antialiased rendering is what this app
// already looks like without any override (native -webkit-font-smoothing
// default), so "on" here reads as "no visible change yet" until a user
// turns it off to compare, same default Synara ships.
export function loadFontSmoothing(): boolean {
  return localStorage.getItem(FONT_SMOOTHING_KEY) !== "false";
}

export function loadChatWidth(): ChatWidth {
  return localStorage.getItem(CHAT_WIDTH_KEY) === "expanded" ? "expanded" : "standard";
}

// --font-sans, not a class toggle -- this app's whole UI already reads
// that one CSS custom property (index.css's own @theme inline block), so
// overriding it here at the root reaches every component for free. Empty
// string (remove the inline override), not re-setting the system stack's
// own literal value a second time, so the underlying stylesheet's own
// declaration -- the actual source of truth for "system" -- stays the one
// definition of what "system" means, not duplicated here too.
export function applySystemUiFont(enabled: boolean) {
  const root = document.documentElement.style;
  if (enabled) {
    root.removeProperty("--font-sans");
  } else {
    root.setProperty("--font-sans", "'Inter Variable', sans-serif");
  }
}

// macOS-only in effect, same as Synara's own useNativeFontSmoothing --
// -webkit-font-smoothing/-moz-osx-font-smoothing only do anything
// perceptible on macOS's own subpixel-antialiasing-by-default rendering;
// elsewhere this is a silent no-op either way, so the toggle can still be
// shown everywhere without needing to hide it on other platforms.
export function applyFontSmoothing(enabled: boolean) {
  const root = document.documentElement.style;
  if (enabled && detectMac()) {
    root.setProperty("-webkit-font-smoothing", "antialiased");
    root.setProperty("-moz-osx-font-smoothing", "grayscale");
  } else {
    root.removeProperty("-webkit-font-smoothing");
    root.removeProperty("-moz-osx-font-smoothing");
  }
}

// --chat-max-width -- ChatPage.tsx's own message column and compose box
// both read this directly (replacing their own literal PAGE_CONTENT_WIDTH
// reference), same "one CSS var, read wherever it applies" approach as
// --font-sans above. index.css's own :root already defines this at 800px
// (PAGE_CONTENT_WIDTH's own value) as the real default so there's no
// flash-of-unset-width before this effect runs on mount -- "standard"
// here just means "don't override that default". "Expanded" is 95vw
// (95% of the actual screen/viewport width), per explicit request --
// vw, not a fixed px or %, since both call sites already combine this
// with w-full/mx-auto (max-width caps a 100%-of-parent box), so this
// only ever visibly stretches things once the sidebar leaves enough
// room to matter, and never forces overflow past whatever space is
// actually available.
// --chat-width-ease -- direction-aware easing for the transition itself
// (index.css's own "Transitions.dev — Chat width change" has the full
// reasoning): growing into Expanded gets the ease-in mirror of the
// shrink-back-to-Standard curve that index.css already defaults to, not
// that same curve run forward, which read as an abrupt jump rather than
// a smooth grow -- confirmed directly ("the animation from standard to
// expand is too fast feeling snappy"). Removed (falls back to index.css's
// own default ease-out) when heading back to Standard, since that
// direction already felt right.
export function applyChatWidth(mode: ChatWidth) {
  const root = document.documentElement.style;
  if (mode === "expanded") {
    root.setProperty("--chat-max-width", "95vw");
    root.setProperty("--chat-width-ease", "cubic-bezier(0.7, 0, 0.84, 0)");
  } else {
    root.removeProperty("--chat-max-width");
    root.removeProperty("--chat-width-ease");
  }
}

// Called once at the app root (App.tsx) so a fresh load picks up whatever
// was persisted last time, before AppearanceSection ever mounts -- that
// component's own handlers additionally call these same functions
// directly the moment a control changes, for the immediate live effect.
export function useApplyAppearanceSettings() {
  useEffect(() => {
    applySystemUiFont(loadSystemUiFont());
    applyFontSmoothing(loadFontSmoothing());
    applyChatWidth(loadChatWidth());
  }, []);
}
