// "You're getting close to your 5-hour limit": the provider's own reading of its 5-hour usage
// window (backend `limit_usage` events mid-turn, or GET /provider-usage when a chat opens),
// shown above the composer at 80% and again at 95%. Closing it holds until the next level or
// the next window (a window is known by when it resets).

export const LIMIT_WARNING_LEVELS = [80, 95] as const;

export interface LimitReading {
  /** "claude" | "codex" */
  provider: string;
  usedPercent: number;
  /** Unix seconds, when the window resets. */
  resetsAt: number | null;
}

/** The highest warning level reached, or null below the first. */
export function warningLevel(usedPercent: number): number | null {
  return [...LIMIT_WARNING_LEVELS].reverse().find((level) => usedPercent >= level) ?? null;
}

const DISMISSED_KEY = "alongside_limit_warnings_dismissed";
const dismissKey = (reading: LimitReading, level: number) => `${reading.provider}:${reading.resetsAt ?? "?"}:${level}`;

function readDismissed(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isWarningDismissed(reading: LimitReading, level: number): boolean {
  return readDismissed().includes(dismissKey(reading, level));
}

export function dismissWarning(reading: LimitReading, level: number) {
  try {
    // The last few are enough: older windows have reset.
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), dismissKey(reading, level)].slice(-20)));
  } catch {
    // Storage unavailable: it just shows again next time.
  }
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
  return { provider, usedPercent: fiveHour.used_percent, resetsAt: Number.isFinite(resets) ? Math.round(resets / 1000) : null };
}
