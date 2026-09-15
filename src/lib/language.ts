// Shared with settings-overlay.tsx's own Language row (the only place this is
// ever set) and any page that needs to read the current choice to actually
// change something (ChatPage.tsx's own date-order formatting is the first
// real consumer) -- moved out of settings-overlay.tsx once a second file
// needed it, same reasoning effort.ts's own top comment gives for why that
// module exists separately instead of living in compose-box.tsx alone.

// localStorage, not a backend setting -- same reasoning as theme/transparency
// (settings-overlay.tsx's own TRANSPARENCY_STORAGE_KEY comment): a per-device
// display preference, not something a Hosted/Enterprise account needs synced
// across machines yet. Only three real options today, per explicit request --
// "More languages" (Settings' own Language row) is the honest placeholder for
// the rest.
const LANGUAGE_STORAGE_KEY = "alongside_language";
export const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-IE", label: "English (IE)" },
  { value: "en-GB", label: "English (UK)" },
] as const;
export type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]["value"];

// Real detection, not a guess -- navigator.languages is the browser/OS's own
// ordered preference list; matched against this app's own three real options
// by exact tag first, then bare language ("en" alone, e.g. a machine set to
// "en" with no region), falling back to English (US) only once neither
// matches anything this app actually offers yet -- confirmed directly: a
// device set to Portuguese, French, or any other non-English language falls
// through both passes and lands on English (US), never a wrong non-English
// guess.
export function detectLanguage(): LanguageValue {
  const available = new Set<string>(LANGUAGE_OPTIONS.map((l) => l.value));
  for (const tag of navigator.languages ?? [navigator.language]) {
    if (available.has(tag)) return tag as LanguageValue;
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const bareMatch = LANGUAGE_OPTIONS.find((l) => l.value.split("-")[0] === tag.split("-")[0]);
    if (bareMatch) return bareMatch.value;
  }
  return "en-US";
}

// Auto-detected default when nothing's been manually picked yet -- a stored
// value (an explicit past choice, including having re-picked the same value
// auto-detection would have landed on anyway) always wins over re-detecting,
// so this doesn't silently override a deliberate choice on a later visit.
export function loadLanguage(): LanguageValue {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return LANGUAGE_OPTIONS.some((l) => l.value === stored) ? (stored as LanguageValue) : detectLanguage();
}

export function saveLanguage(value: LanguageValue) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
}

// The one real, ready difference between these three today (per explicit
// request, after being asked directly "what actually changes" and having to
// answer honestly that nothing did yet): US date order is month-before-day,
// IE/UK is day-before-month. Everything else about the three (spelling, see
// spelling.ts) only varies between US and British English, not a three-way
// split -- IE and UK both use British spelling -- but date order genuinely
// has three real answers in principle, so this stays keyed by the full
// LanguageValue rather than collapsed to a US/British boolean the way
// spelling.ts's own isBritish is.
export function isMonthFirstDateOrder(language: LanguageValue): boolean {
  return language === "en-US";
}
