// Unsent compose-box text, one draft per chat (and one for Home's new-chat box), so leaving the page
// (Settings, Library, another chat) or restarting Alongside doesn't lose what was typed (#565).
// Drafts stay on this device: they live in this webview's localStorage and are never sent anywhere.
const STORAGE_KEY = "alongside.composeDrafts.v1";
const SAVE_DELAY_MS = 300;

export const HOME_DRAFT_KEY = "home";

let cache: Map<string, string> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Map<string, string> {
  if (cache) return cache;
  cache = new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string" && value) cache.set(key, value);
      }
    }
  } catch {
    // An unreadable store just means no saved drafts.
  }
  return cache;
}

function flush() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!cache) return;
  try {
    if (cache.size === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    // Storage full or unavailable: the draft still survives in memory for this run.
  }
}

if (typeof window !== "undefined") window.addEventListener("pagehide", flush);

export function readDraft(key: string | null | undefined): string {
  if (!key) return "";
  return load().get(key) ?? "";
}

// Whitespace-only text counts as no draft.
export function saveDraft(key: string | null | undefined, text: string) {
  if (!key) return;
  const drafts = load();
  if (text.trim()) drafts.set(key, text);
  else if (!drafts.delete(key)) return;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, SAVE_DELAY_MS);
}

export function clearDraft(key: string | null | undefined) {
  if (!key || !load().has(key)) return;
  load().delete(key);
  flush();
}

// Tests only.
export function resetDraftsForTest() {
  cache = null;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
}
