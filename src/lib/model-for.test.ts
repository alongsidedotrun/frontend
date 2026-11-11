import { describe, expect, it } from "vitest";
import { modelFor, modelNameFromId } from "@/lib/quick-chat-models";

describe("modelFor", () => {
  it("names a model the list doesn't have from its id, under its own provider", () => {
    expect(modelNameFromId("claude-opus-5-5")).toBe("Claude Opus 5.5");
    expect(modelNameFromId("gpt-5.6-luna")).toBe("GPT-5.6 Luna");
    expect(modelNameFromId("claude-haiku-4-5-20251001")).toBe("Claude Haiku 4.5");
    const model = modelFor("claude-opus-9-1");
    expect(model?.label).toBe("Claude Opus 9.1");
    expect(model?.provider).toBe("Claude");
    expect(modelFor("grok-5")?.provider).toBe("Grok");
  });

  it("knows nothing of an id from no known family", () => {
    expect(modelFor("mystery-model")).toBeUndefined();
  });
});
