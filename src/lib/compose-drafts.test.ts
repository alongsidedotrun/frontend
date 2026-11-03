import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, readDraft, resetDraftsForTest, saveDraft } from "./compose-drafts";

describe("compose drafts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    resetDraftsForTest();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps each chat's draft separately", () => {
    saveDraft("a", "hello");
    saveDraft("b", "other");
    expect(readDraft("a")).toBe("hello");
    expect(readDraft("b")).toBe("other");
    expect(readDraft(undefined)).toBe("");
  });

  it("survives a restart once saved", () => {
    saveDraft("a", "half a thought");
    vi.advanceTimersByTime(400);
    resetDraftsForTest();
    expect(readDraft("a")).toBe("half a thought");
  });

  it("drops a draft when it's sent or emptied", () => {
    saveDraft("a", "x");
    clearDraft("a");
    saveDraft("b", "y");
    saveDraft("b", "   ");
    vi.advanceTimersByTime(400);
    resetDraftsForTest();
    expect(readDraft("a")).toBe("");
    expect(readDraft("b")).toBe("");
  });
});
