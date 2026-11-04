import { describe, expect, it } from "vitest";
import { parseInlineMarkdown } from "./inline-markdown";

describe("parseInlineMarkdown", () => {
  it("styles bold, code, italic and links", () => {
    expect(parseInlineMarkdown("**What's in it:** a `b` *c* [d](https://e.f)")).toEqual([
      { kind: "bold", children: [{ kind: "text", text: "What's in it:" }] },
      { kind: "text", text: " a " },
      { kind: "code", text: "b" },
      { kind: "text", text: " " },
      { kind: "italic", children: [{ kind: "text", text: "c" }] },
      { kind: "text", text: " " },
      { kind: "link", text: "d", href: "https://e.f" },
    ]);
  });
  it("turns line-start dashes into bullets and keeps bold inside them", () => {
    expect(parseInlineMarkdown("- **Not pushed:** x")).toEqual([
      { kind: "text", text: "• " },
      { kind: "bold", children: [{ kind: "text", text: "Not pushed:" }] },
      { kind: "text", text: " x" },
    ]);
  });
  it("leaves code contents, snake_case, 2 * 3 and unclosed markers alone", () => {
    expect(parseInlineMarkdown("`**x**` a_b_c 2 * 3 **open")).toEqual([
      { kind: "code", text: "**x**" },
      { kind: "text", text: " a_b_c 2 * 3 **open" },
    ]);
  });
});
