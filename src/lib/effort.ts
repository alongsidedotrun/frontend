import i18n from "@/i18n";

// Real values only ("low"/"medium"/"high"/"xhigh"/"max"), confirmed via `claude
// --help`'s own --effort flag -- not invented. Shared by compose-box.tsx (the
// per-message slider), ChatPage.tsx (the reply's own EffortDial/tooltip), and
// settings-overlay.tsx (the default-effort settings below), which is why this
// lives in its own module now instead of compose-box.tsx alone.
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

// Display labels only -- the wire value sent to --effort stays the CLI's own
// exact string ("xhigh"), per explicit request only "Xhigh" (a bare capitalized
// slug) reads oddly next to the other four, real words. Function, not a plain
// object (the shape every call site used before translation existed) -- i18n
// singleton, not useTranslation()'s own hook-bound t, since several call
// sites (compose-box.tsx's own tooltip text, this module itself) aren't
// necessarily React components.
export function effortLabel(level: EffortLevel): string {
  return i18n.t(`effort.${level}`);
}

// Settings > Chats' own "Default effort" control -- a single shared value,
// same shape as "Default provider" (settings-overlay.tsx's own
// DefaultModelRow): a plain dropdown with a "None" option, no per-provider
// values. Per explicit request ("do the same as the model default but for
// effort as well in settings") -- a per-provider mode existed before this,
// but only Claude actually runs with its own chosen effort today
// (compose-box.tsx's own comment on EFFORT_LEVELS has the full reasoning),
// so per-provider granularity had no real use yet and was dropped along
// with the swap.
const DEFAULT_EFFORT_KEY = "alongside_default_effort";
// The fallback when nothing's been set in Settings yet ("None" there) --
// matches Claude Code's own real default (confirmed directly: this
// machine's own interactive session env carries CLAUDE_EFFORT=medium when
// nothing else is set).
const BUILTIN_DEFAULT_EFFORT: EffortLevel = "medium";

export function loadDefaultEffort(): EffortLevel | null {
  const raw = localStorage.getItem(DEFAULT_EFFORT_KEY);
  return EFFORT_LEVELS.includes(raw as EffortLevel) ? (raw as EffortLevel) : null;
}

export function saveDefaultEffort(level: EffortLevel | null) {
  if (level === null) localStorage.removeItem(DEFAULT_EFFORT_KEY);
  else localStorage.setItem(DEFAULT_EFFORT_KEY, level);
}

// compose-box.tsx's own real read path: what a fresh compose box should
// default to.
export function defaultEffortFor(): EffortLevel {
  return loadDefaultEffort() ?? BUILTIN_DEFAULT_EFFORT;
}
