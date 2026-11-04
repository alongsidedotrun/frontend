import { describe, expect, it } from "vitest";
import { chatProviderMarks } from "./provider-marks";

const icons = (models: { provider: string; model: string }[]) => chatProviderMarks({ models }).map((mark) => mark.icon.split("/").pop());

describe("chatProviderMarks", () => {
  it("keeps the order providers joined the chat, first on the left", () => {
    expect(icons([
      { provider: "codex", model: "gpt-x" },
      { provider: "claude", model: "claude-y" },
      { provider: "codex", model: "gpt-z" },
      { provider: "grok", model: "grok-w" },
    ])).toEqual(["chatgpt.svg", "claude.svg", "grok.svg"]);
  });

  it("past three, shows the three that joined last", () => {
    expect(icons([
      { provider: "claude", model: "a" },
      { provider: "codex", model: "b" },
      { provider: "antigravity", model: "c" },
      { provider: "grok", model: "d" },
    ])).toEqual(["chatgpt.svg", "gemini.svg", "grok.svg"]);
  });

  it("is empty before the first reply", () => {
    expect(chatProviderMarks({})).toEqual([]);
  });
});
