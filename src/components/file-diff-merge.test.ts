import { describe, expect, it } from "vitest";
import { mergeFileEdits, type DiffRow } from "./FileDiff";

const add = (text: string): DiffRow => ({ old: null, cur: 1, type: "add", text }) as DiffRow;
const file = (path: string, rows: DiffRow[] | null) => ({ name: path.split("/").pop()!, path, syncRows: rows });

describe("mergeFileEdits (#556)", () => {
  it("lists a file edited several times once, with all of its edits", () => {
    const out = mergeFileEdits([file("a/x.rs", [add("1")]), file("a/y.rs", [add("2")]), file("a/x.rs", [add("3")])], "append");
    expect(out.map((f) => f.path)).toEqual(["a/x.rs", "a/y.rs"]);
    expect(out[0].syncRows?.map((r) => r.text)).toEqual(["1", "3"]);
  });

  it("reads the file from disk when one of its edits has no diff", () => {
    const out = mergeFileEdits([file("x", [add("1")]), file("x", null)], "append");
    expect(out[0].syncRows).toBeNull();
  });

  it("shows the last version of a file written twice", () => {
    const out = mergeFileEdits([file("x", [add("old")]), file("x", [add("new")])], "replace");
    expect(out).toHaveLength(1);
    expect(out[0].syncRows?.map((r) => r.text)).toEqual(["new"]);
  });
});
