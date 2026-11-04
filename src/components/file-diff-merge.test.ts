import { describe, expect, it } from "vitest";
import { dedentRows, mergeFileEdits, unifiedDiffToRows, type DiffRow } from "./FileDiff";

const add = (text: string): DiffRow => ({ old: null, cur: 1, type: "add", text }) as DiffRow;
const file = (path: string, rows: DiffRow[] | null) => ({ name: path.split("/").pop()!, path, syncRows: rows });

describe("mergeFileEdits (#556)", () => {
  it("lists a file edited several times once, with all of its edits", () => {
    const out = mergeFileEdits([file("a/x.rs", [add("1")]), file("a/y.rs", [add("2")]), file("a/x.rs", [add("3")])], "append");
    expect(out.map((f) => f.path)).toEqual(["a/x.rs", "a/y.rs"]);
    expect(out[0].syncRows?.map((r) => r.text)).toEqual(["1", "3"]);
  });

  it("keeps counts unknown when one of its edits has no diff", () => {
    const out = mergeFileEdits([file("x", [add("1")]), file("x", null)], "append");
    expect(out[0].syncRows).toBeNull();
  });

  it("shows the last version of a file written twice", () => {
    const out = mergeFileEdits([file("x", [add("old")]), file("x", [add("new")])], "replace");
    expect(out).toHaveLength(1);
    expect(out[0].syncRows?.map((r) => r.text)).toEqual(["new"]);
  });
});

describe("unifiedDiffToRows", () => {
  it("counts only the supplied hunk, not the whole existing file", () => {
    const rows = unifiedDiffToRows("--- a/large.rs\n+++ b/large.rs\n@@ -2500,2 +2500,2 @@\n-old\n+new\n context\n");
    expect(rows?.filter((row) => row.type === "add")).toHaveLength(1);
    expect(rows?.filter((row) => row.type === "del")).toHaveLength(1);
    expect(rows?.find((row) => row.type === "add")?.cur).toBe(2500);
  });
});

describe("dedentRows", () => {
  it("drops the indentation all lines share, keeping relative indentation", () => {
    const rows = [
      { old: 1, cur: 1, type: "ctx" as const, text: "      const a = 1;" },
      { old: null, cur: 2, type: "add" as const, text: "" },
      { old: null, cur: 3, type: "add" as const, text: "        b();" },
    ];
    expect(dedentRows(rows).map((r) => r.text)).toEqual(["const a = 1;", "", "  b();"]);
  });
  it("leaves unindented code alone", () => {
    const rows = [{ old: 1, cur: 1, type: "ctx" as const, text: "fn main() {}" }];
    expect(dedentRows(rows)).toBe(rows);
  });
});
