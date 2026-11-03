import { describe, expect, it } from "vitest";
import { slideHistoryWindow, turnStart } from "./history-window";

// A turn is a person's message followed by 4 agent/tool rows: 5 rows per turn.
const rows = Array.from({ length: 500 }, (_, i) => ({ kind: i % 5 === 0 ? "human" : "agent" }));

describe("history window", () => {
  it("snaps to the turn's start", () => {
    expect(turnStart(rows, 443)).toBe(440);
    expect(turnStart(rows, -10)).toBe(0);
  });
  it("adds rows above, at a turn start, and keeps the newest while under the cap", () => {
    expect(slideHistoryWindow(rows, { first: 440, last: 500 }, "up")).toEqual({ start: 410, end: null });
  });
  it("drops the newest rows once over the cap", () => {
    const next = slideHistoryWindow(rows, { first: 400, last: 500 }, "up");
    expect(next.start).toBe(370);
    expect(next.end).toBe(490);
    expect(rows[next.end!].kind).toBe("human");
  });
  it("brings rows back below and drops the oldest", () => {
    const next = slideHistoryWindow(rows, { first: 200, last: 320 }, "down");
    expect(next).toEqual({ start: 230, end: 350 });
  });
  it("reaching the newest row follows the end again", () => {
    expect(slideHistoryWindow(rows, { first: 300, last: 470 }, "down").end).toBeNull();
  });
});
