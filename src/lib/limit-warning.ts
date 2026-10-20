import { useSyncExternalStore } from "react";

// "You're getting close to your 5-hour limit": the provider's own reading of its 5-hour usage
// window (backend `limit_usage` events mid-turn, or GET /provider-usage when a chat opens),
// shown with the composer at each reminder level: 85% always, plus any the person adds
// (Settings > Chat, or the strip's own Reminders). Closing it holds for this session, until
// the next level or the next window (a window is known by when it resets).

/** The reminder every limit gets; it can't be removed. */
export const DEFAULT_LIMIT_REMINDER = 85;

// The added levels, in this browser (like skills, until settings sync).
const REMINDERS_KEY = "alongside_limit_reminders";
const reminderListeners = new Set<() => void>();
let customReminders: number[] | null = null;

const isLevel = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100;

function readReminders(): number[] {
  if (customReminders) return customReminders;
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? "[]") as unknown;
    customReminders = Array.isArray(parsed) ? normalize(parsed.filter(isLevel)) : [];
  } catch {
    customReminders = [];
  }
  return customReminders;
}

// Sorted, without repeats or the default (it's always there already).
const normalize = (levels: number[]) => [...new Set(levels)].filter((level) => level !== DEFAULT_LIMIT_REMINDER).sort((a, b) => a - b);

function writeReminders(levels: number[]) {
  customReminders = normalize(levels);
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(customReminders));
  } catch {
    // Kept for this session only.
  }
  reminderListeners.forEach((listener) => listener());
}

const subscribeReminders = (listener: () => void) => {
  reminderListeners.add(listener);
  return () => reminderListeners.delete(listener);
};

/** Every reminder level, the default included, lowest first. */
export function limitReminderLevels(): number[] {
  return [...readReminders(), DEFAULT_LIMIT_REMINDER].sort((a, b) => a - b);
}

// A new reminder's first value: the first of these not already taken.
const SUGGESTED_LEVELS = [95, 90, 75, 70, 99, 80, 60, 50];

/** The limit reminders: 85% always, and the ones added, which can be changed or removed. */
export function useLimitReminders() {
  const custom = useSyncExternalStore(subscribeReminders, readReminders, readReminders);
  return {
    custom,
    /** Every level, the default included, lowest first. */
    levels: [...custom, DEFAULT_LIMIT_REMINDER].sort((a, b) => a - b),
    /** Adds one at the first free suggested level, and returns it (null when they're all taken). */
    add: () => {
      const taken = new Set([...custom, DEFAULT_LIMIT_REMINDER]);
      const level = SUGGESTED_LEVELS.find((candidate) => !taken.has(candidate)) ?? Array.from({ length: 100 }, (_, i) => 100 - i).find((candidate) => !taken.has(candidate)) ?? null;
      if (level !== null) writeReminders([...custom, level]);
      return level;
    },
    /** Moves one to a new level; false (nothing changed) when that level is out of range or taken. */
    change: (from: number, to: number) => {
      if (!isLevel(to) || (to !== from && (to === DEFAULT_LIMIT_REMINDER || custom.includes(to)))) return false;
      writeReminders(custom.map((level) => (level === from ? to : level)));
      return true;
    },
    remove: (level: number) => writeReminders(custom.filter((item) => item !== level)),
  };
}

export interface LimitReading {
  /** "claude" | "codex" */
  provider: string;
  usedPercent: number;
  /** Unix seconds, when the window resets. */
  resetsAt: number | null;
}

/** The highest reminder level reached, or null below the first. */
export function warningLevel(usedPercent: number, levels: number[] = limitReminderLevels()): number | null {
  return [...levels].reverse().find((level) => usedPercent >= level) ?? null;
}

// Closed warnings, for this session only: a reload or restart shows the warning again while
// the window is still past a level. (Dropped: the earlier localStorage list, which kept a
// closed warning hidden across restarts.)
const dismissed = new Set<string>();
const dismissKey = (reading: LimitReading, level: number) => `${reading.provider}:${reading.resetsAt ?? "?"}:${level}`;
try {
  localStorage.removeItem("alongside_limit_warnings_dismissed");
} catch {
  // Nothing stored, or no storage.
}

export function isWarningDismissed(reading: LimitReading, level: number): boolean {
  return dismissed.has(dismissKey(reading, level));
}

export function dismissWarning(reading: LimitReading, level: number) {
  dismissed.add(dismissKey(reading, level));
}

/** The 5-hour window from a backend `limit_usage` event, if it has one. */
export function readingFromEvent(event: Record<string, unknown>): LimitReading | null {
  const windows = Array.isArray(event.windows) ? (event.windows as { window?: string; used_percent?: number; resets_at?: number | null }[]) : [];
  const fiveHour = windows.find((window) => window.window === "five_hour");
  if (typeof event.provider !== "string" || !fiveHour || typeof fiveHour.used_percent !== "number") return null;
  return { provider: event.provider, usedPercent: fiveHour.used_percent, resetsAt: fiveHour.resets_at ?? null };
}

/** The 5-hour window from GET /provider-usage/{provider} (Settings > Provider usage's own source). */
export function readingFromUsage(provider: string, snapshot: { status?: string; limits?: { window: string; used_percent?: number; resets_at?: string }[] }): LimitReading | null {
  if (snapshot.status !== "ok") return null;
  const fiveHour = snapshot.limits?.find((limit) => limit.window === "5h");
  if (!fiveHour || typeof fiveHour.used_percent !== "number") return null;
  const resets = fiveHour.resets_at ? Date.parse(fiveHour.resets_at) : NaN;
  // A saved reading from a window that has since reset says nothing about now.
  if (Number.isFinite(resets) && resets < Date.now()) return null;
  return { provider, usedPercent: fiveHour.used_percent, resetsAt: Number.isFinite(resets) ? Math.round(resets / 1000) : null };
}
