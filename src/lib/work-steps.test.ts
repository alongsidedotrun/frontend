import { describe, expect, it } from "vitest";
import { workCounts, workSteps } from "./work-steps";

describe("workSteps", () => {
  it("keeps notes, tool calls and file edits in the order they happened", () => {
    const steps = workSteps(
      "",
      [
        { label: "Read", detail: "a.ts" },
        { label: "Read", detail: "b.ts" },
        { label: "Edit", detail: "a.ts", rowId: "t1" },
        { label: "Edit", detail: "b.ts", rowId: "t2" },
        { label: "Run", detail: "npm test" },
      ],
      [
        { text: "Looking at the files.", at: 0 },
        { text: "Now the fix.", at: 2 },
      ]
    );
    expect(steps.map((s) => s.kind)).toEqual(["note", "tools", "note", "files", "tools"]);
    expect(steps[1]).toMatchObject({ label: "Read", lines: [{ detail: "a.ts" }, { detail: "b.ts" }] });
    expect(steps[3]).toMatchObject({ label: "Edit", rowIds: ["t1", "t2"] });
  });

  it("starts with the thinking and ends with notes written after the last call", () => {
    const steps = workSteps("Hmm.", [{ label: "Run", detail: "ls" }], [{ text: "Done.", at: 1, active: true }]);
    expect(steps).toEqual([
      { kind: "thinking", text: "Hmm." },
      { kind: "tools", label: "Run", lines: [{ label: "Run", detail: "ls" }] },
      { kind: "note", text: "Done.", active: true },
    ]);
  });

  it("doesn't fold calls of the same kind across a note", () => {
    const steps = workSteps("", [{ label: "Run" }, { label: "Run" }], [{ text: "Again.", at: 1 }]);
    expect(steps.map((s) => s.kind)).toEqual(["tools", "note", "tools"]);
  });
});

describe("workCounts", () => {
  it("counts each changed file once", () => {
    expect(
      workCounts([
        { label: "Edit", detail: "a.ts", rowId: "1" },
        { label: "Edit", detail: "a.ts", rowId: "2" },
        { label: "Write", detail: "b.ts", rowId: "3" },
        { label: "Run" },
        { label: "Read" },
      ])
    ).toEqual({ files: 2, commands: 1, reads: 1, searches: 0 });
  });
});
