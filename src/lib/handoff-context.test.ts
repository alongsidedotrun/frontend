import { describe, expect, it } from "vitest";
import { checkpointText, parseConversation, parseHandoff, parseWorkState, splitSummary } from "./handoff-context";

const sample = [
  "<carried_context>",
  "<instructions>",
  "Treat this as your memory.",
  "</instructions>",
  "<checkpoint>",
  "Summary of earlier work: ## Goal",
  "Ship it.",
  "</checkpoint>",
  "<work_state>",
  "Original request: Fix the loop",
  "",
  "Task list (1 of 2 done):",
  "- [x] Find it",
  "- [ ] Fix it",
  "",
  "Latest commands (12 run in all):",
  "- ok cargo test",
  "- FAILED npm run build",
  "    error: nope",
  "</work_state>",
  "<tools_used>Bash x2</tools_used>",
  "<conversation>",
  "Ana: Why is it slow?",
  "",
  "Assistant: [tool: Bash ls]",
  "",
  "Assistant: [tool: Read a.rs]",
  "",
  "Assistant: Because of the tools.",
  "",
  "Note: it's fixed.",
  "",
  "</conversation>",
  "<recent_tool_output>",
  "- Bash ls: <carried_context>",
  "<checkpoint>quoted</checkpoint>",
  "</recent_tool_output>",
  '<file path="/a/b.rs">',
  "fn main() {}",
  "</file>",
  "</carried_context>",
  "",
  "The new message follows.",
].join("\n");

describe("parseHandoff", () => {
  it("splits the blocks in order, keeping quoted tags inside a block's body", () => {
    const sections = parseHandoff(sample)!;
    expect(sections.map((s) => s.tag)).toEqual(["instructions", "checkpoint", "work_state", "tools_used", "conversation", "recent_tool_output", "file"]);
    expect(sections[5].body).toContain("<checkpoint>quoted</checkpoint>");
    expect(sections[6]).toEqual({ tag: "file", path: "/a/b.rs", body: "fn main() {}" });
    expect(checkpointText(sections[1].body)).toBe("## Goal\nShip it.");
  });

  it("returns null for text in another shape", () => {
    expect(parseHandoff("just some text")).toBeNull();
    expect(parseHandoff("<carried_context>\n<checkpoint>\nno end")).toBeNull();
  });
});

describe("parseWorkState", () => {
  it("reads labels, task items and command results with their output", () => {
    const body = parseHandoff(sample)!.find((s) => s.tag === "work_state")!.body;
    expect(parseWorkState(body)).toEqual([
      { label: "Original request", value: "Fix the loop", items: [] },
      { label: "Task list (1 of 2 done)", value: "", items: [{ text: "[x] Find it" }, { text: "[ ] Fix it" }] },
      {
        label: "Latest commands (12 run in all)",
        value: "",
        items: [
          { text: "cargo test", ok: true, failed: false },
          { text: "npm run build\nerror: nope", ok: false, failed: true },
        ],
      },
    ]);
  });
});

describe("parseConversation", () => {
  it("keeps multi-paragraph messages whole and folds a run of tool calls", () => {
    const body = parseHandoff(sample)!.find((s) => s.tag === "conversation")!.body;
    expect(parseConversation(body)).toEqual([
      { speaker: "Ana", text: "Why is it slow?", tools: [] },
      { speaker: "Assistant", text: "", tools: ["Bash ls", "Read a.rs"] },
      { speaker: "Assistant", text: "Because of the tools.\n\nNote: it's fixed.", tools: [] },
    ]);
  });
});

describe("splitSummary", () => {
  it("leads with the first paragraph and keeps the rest", () => {
    expect(splitSummary("## Goal\nShip it.\nSoon.\n\nMore goal.\n\n## Done\n- a")).toEqual({ lead: "Ship it.\nSoon.", rest: "More goal.\n\n## Done\n- a" });
  });
  it("stops the lead at the next heading", () => {
    expect(splitSummary("## Goal\nShip it.\n## Done\n- a")).toEqual({ lead: "Ship it.", rest: "## Done\n- a" });
  });
  it("handles text with no headings", () => {
    expect(splitSummary("Just a paragraph.")).toEqual({ lead: "Just a paragraph.", rest: "" });
  });
  it("handles text before the first heading", () => {
    expect(splitSummary("Intro.\n## Done\n- a")).toEqual({ lead: "Intro.", rest: "## Done\n- a" });
  });
});
