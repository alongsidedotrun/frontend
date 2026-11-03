import { describe, expect, it } from "vitest";
import { findRow, windowAround } from "./history-window";

const rows = Array.from({ length: 500 }, (_, i) => ({ kind: i % 5 === 0 ? "human" : "agent", text: `row ${i}` }));

describe("opening a chat at a search match", () => {
  it("finds the newest row with the text, in any case", () => {
    const withMatch = rows.map((r, i) => (i === 37 || i === 52 ? { ...r, text: "The Deploy failed" } : r));
    expect(findRow(withMatch, "deploy FAILED")).toBe(52);
    expect(findRow(withMatch, "nothing like this")).toBe(-1);
    expect(findRow(withMatch, "  ")).toBe(-1);
  });
  it("shows the match with the chat around it, cut at turn starts", () => {
    expect(windowAround(rows, 52)).toEqual({ start: 20, end: 80 });
    expect(windowAround(rows, 3)).toEqual({ start: 0, end: 60 });
    expect(windowAround(rows, 498)).toEqual({ start: 465, end: null });
  });
});
