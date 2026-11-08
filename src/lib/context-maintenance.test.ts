import { describe, expect, it } from "vitest";
import { shouldHandOff } from "./context-maintenance";

describe("context maintenance", () => {
  const at = { threshold: 100_000, automaticHandoff: true, handedOffAbove: false, replaying: false };

  it("hands off once the context reaches the chat's threshold", () => {
    expect(shouldHandOff({ ...at, used: 99_999 })).toBe(false);
    expect(shouldHandOff({ ...at, used: 100_000 })).toBe(true);
  });

  it("hands off once per crossing, never from a replay, and not when the chat turned it off", () => {
    expect(shouldHandOff({ ...at, used: 150_000, handedOffAbove: true })).toBe(false);
    expect(shouldHandOff({ ...at, used: 150_000, replaying: true })).toBe(false);
    expect(shouldHandOff({ ...at, used: 150_000, automaticHandoff: false })).toBe(false);
  });
});
