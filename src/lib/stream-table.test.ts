import { describe, expect, it } from "vitest";
import { holdBackTable } from "./stream-table";

const T = "Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |";

describe("holdBackTable", () => {
  it("leaves text without a table alone", () => {
    expect(holdBackTable("one two\nthree")).toEqual({ text: "one two\nthree", cursor: true });
  });
  it("drops an unfinished row and the cursor inside a table", () => {
    expect(holdBackTable(T + "\n| 3")).toEqual({ text: T, cursor: false });
    expect(holdBackTable(T + "\n|")).toEqual({ text: T, cursor: false });
  });
  it("keeps the last finished row while the next one hasn't started", () => {
    // "| 1 | 2 |" is the last line and still being typed, so it waits for the newline.
    expect(holdBackTable(T)).toEqual({ text: "Intro\n\n| a | b |\n|---|---|", cursor: false });
  });
  it("hides a header until its separator line is done", () => {
    expect(holdBackTable("Intro\n\n| a | b |\n|--")).toEqual({ text: "Intro", cursor: true });
    expect(holdBackTable("Intro\n\n| a | b")).toEqual({ text: "Intro", cursor: true });
    expect(holdBackTable("| a | b")).toEqual({ text: "", cursor: false });
  });
  it("shows the cursor again once text after the table starts", () => {
    expect(holdBackTable(T + "\n\nAfter")).toEqual({ text: T + "\n\nAfter", cursor: true });
  });
});
