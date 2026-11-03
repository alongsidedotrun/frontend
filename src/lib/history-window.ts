// #563: which rows a long chat puts on the page. A window that starts with the newest rows and
// slides as the reader scrolls, never holding more than HISTORY_MAX rows, cut at turn starts.

type Row = { kind: string };

// #563: rows a long chat shows at first, and how many more each scroll near the top reveals.
export const HISTORY_WINDOW = 60;
const HISTORY_STEP = 30;
// The most rows on the page at once; past this, the far end is dropped.
const HISTORY_MAX = 120;

/** The nearest turn start (a person's message) at or before `index`. */
export function turnStart(rows: readonly Row[], index: number): number {
  let i = Math.max(0, Math.min(index, rows.length - 1));
  while (i > 0 && rows[i].kind !== "human") i--;
  return Math.max(0, i);
}

/** The next window of rows when the reader nears an edge: HISTORY_STEP more on that side, and the
 * far side trimmed back to HISTORY_MAX rows, both cut at turn starts. */
export function slideHistoryWindow(
  rows: readonly Row[],
  shown: { first: number; last: number },
  direction: "up" | "down",
): { start: number; end: number | null } {
  if (direction === "up") {
    const start = turnStart(rows, shown.first - HISTORY_STEP);
    let end = shown.last;
    if (end - start > HISTORY_MAX) end = Math.max(shown.first, turnStart(rows, start + HISTORY_MAX));
    return { start, end: end >= rows.length ? null : end };
  }
  let end = shown.last + HISTORY_STEP;
  // Ends just before a turn start, so a turn is never split.
  while (end < rows.length && rows[end].kind !== "human") end++;
  let start = shown.first;
  if (end - start > HISTORY_MAX) start = Math.min(turnStart(rows, end - HISTORY_MAX), turnStart(rows, shown.last - 1));
  return { start, end: end >= rows.length ? null : end };
}


/** The newest row whose text has `query` in it (any case), or -1. */
export function findRow(rows: readonly (Row & { text?: unknown })[], query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    const text = rows[i].text;
    if (typeof text === "string" && text.toLowerCase().includes(needle)) return i;
  }
  return -1;
}

/** A window that shows row `index` with some of the chat before and after it, cut at turn starts. */
export function windowAround(rows: readonly Row[], index: number): { start: number; end: number | null } {
  const start = turnStart(rows, index - HISTORY_STEP);
  let end = Math.min(rows.length, Math.max(index + 1, start + HISTORY_WINDOW));
  while (end < rows.length && rows[end].kind !== "human") end++;
  return { start, end: end >= rows.length ? null : end };
}
