import { describe, expect, it } from "vitest";
import { highlightLine } from "./diff-highlight";

const kinds = (line: string, file?: string) =>
  highlightLine(line, file)
    .filter((t) => t.kind !== "txt")
    .map((t) => `${t.kind}:${t.text}`);

describe("highlightLine", () => {
  it("keeps the line's text exactly", () => {
    const line = '  const t = cookies.get("session"); // why';
    expect(highlightLine(line).map((t) => t.text).join("")).toBe(line);
  });

  it("marks keywords, strings, numbers, calls and comments", () => {
    expect(kinds('export function getToken() { return f("a", 42); } // done')).toEqual([
      "kw:export",
      "kw:function",
      "fn:getToken",
      "kw:return",
      "fn:f",
      'str:"a"',
      "num:42",
      "cm:// done",
    ]);
  });

  it("treats Rust macros as calls and # as a comment only where it is one", () => {
    expect(kinds('pub fn run() { println!("x"); }', "a.rs")).toEqual(["kw:pub", "kw:fn", "fn:run", "fn:println", 'str:"x"']);
    expect(kinds("x = 1  # note", "a.py")).toEqual(["num:1", "cm:# note"]);
    expect(kinds("color: #fff;", "a.css")).toEqual([]);
    expect(kinds("Mutex::new(Vec::new())", "a.rs")).toEqual(["fn:new", "fn:new"]);
    expect(kinds("if (x) return;")).toEqual(["kw:if", "kw:return"]);
  });

  it("colours an unterminated string to the end of the line", () => {
    expect(kinds('let s = "open', "a.rs")).toEqual(["kw:let", 'str:"open']);
  });
});
