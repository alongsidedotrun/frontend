import { useSyncExternalStore } from "react";

// "You're getting close to your 5-hour limit": the provider's own reading of its 5-hour usage
// window (backend `limit_usage` events mid-turn, or GET /provider-usage when a chat opens),
// shown with the composer at each reminder level: 85% always, plus any the person adds
// (Settings > Chat, or the strip's own Reminders). Closing it holds for this session, until
// the next level or the next window (a window is known by when it resets).

/** The reminder every limit gets; it can't be removed. */
export const DEFAULT_LIMIT_REMINDER = 85;

// The added levels, and an optional note for any level (the default's too), in this browser
// (like skills, until settings sync). Notes are keyed by level, so the levels list keeps its
// earlier shape.
const REMINDERS_KEY = "alongside_limit_reminders";
const NOTES_KEY = "alongside_limit_reminder_notes";
const NOTE_MAX = 80;
const reminderListeners = new Set<() => void>();

interface RemindersState {
  custom: number[];
  notes: Record<number, string>;
}
let remindersState: RemindersState | null = null;

const isLevel = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100;

function readStored<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function readReminders(): RemindersState {
  if (remindersState) return remindersState;
  const levels = readStored<unknown>(REMINDERS_KEY, []);
  const notes = readStored<unknown>(NOTES_KEY, {});
  remindersState = {
    custom: Array.isArray(levels) ? normalize(levels.filter(isLevel)) : [],
    notes:
      notes && typeof notes === "object"
        ? Object.fromEntries(
            Object.entries(notes as Record<string, unknown>).filter(
              (entry): entry is [string, string] => isLevel(Number(entry[0])) && typeof entry[1] === "string" && entry[1].trim() !== "",
            ),
          )
        : {},
  };
  return remindersState;
}

// Sorted, without repeats or the default (it's always there already).
const normalize = (levels: number[]) => [...new Set(levels)].filter((level) => level !== DEFAULT_LIMIT_REMINDER).sort((a, b) => a - b);

function writeReminders(next: RemindersState) {
  remindersState = { custom: normalize(next.custom), notes: next.notes };
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(remindersState.custom));
    localStorage.setItem(NOTES_KEY, JSON.stringify(remindersState.notes));
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
  return [...readReminders().custom, DEFAULT_LIMIT_REMINDER].sort((a, b) => a - b);
}

// A new reminder's first value: the first of these not already taken.
const SUGGESTED_LEVELS = [95, 90, 75, 70, 99, 80, 60, 50];

const withoutNote = (notes: Record<number, string>, level: number) => {
  const { [level]: _dropped, ...rest } = notes;
  return rest;
};

/** The limit reminders: 85% always, and the ones added, which can be changed or removed; any of them can carry a note. */
export function useLimitReminders() {
  const state = useSyncExternalStore(subscribeReminders, readReminders, readReminders);
  const { custom, notes } = state;
  return {
    custom,
    /** Every level, the default included, lowest first. */
    levels: [...custom, DEFAULT_LIMIT_REMINDER].sort((a, b) => a - b),
    /** A level's note, or "" without one. */
    noteFor: (level: number) => notes[level] ?? "",
    /** Adds one at the first free suggested level, and returns it (null when they're all taken). */
    add: () => {
      const taken = new Set([...custom, DEFAULT_LIMIT_REMINDER]);
      const level = SUGGESTED_LEVELS.find((candidate) => !taken.has(candidate)) ?? Array.from({ length: 100 }, (_, i) => 100 - i).find((candidate) => !taken.has(candidate)) ?? null;
      if (level !== null) writeReminders({ custom: [...custom, level], notes: withoutNote(notes, level) });
      return level;
    },
    /** Moves one (and its note) to a new level; false (nothing changed) when that level is out of range or taken. */
    change: (from: number, to: number) => {
      if (!isLevel(to) || (to !== from && (to === DEFAULT_LIMIT_REMINDER || custom.includes(to)))) return false;
      const moved = withoutNote(notes, from);
      if (notes[from]) moved[to] = notes[from];
      writeReminders({ custom: custom.map((level) => (level === from ? to : level)), notes: moved });
      return true;
    },
    remove: (level: number) => writeReminders({ custom: custom.filter((item) => item !== level), notes: withoutNote(notes, level) }),
    /** Sets a level's note; an empty one clears it. */
    setNote: (level: number, note: string) => {
      const trimmed = note.trim().slice(0, NOTE_MAX);
      writeReminders({ custom, notes: trimmed ? { ...notes, [level]: trimmed } : withoutNote(notes, level) });
    },
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
