import { describe, expect, it } from "vitest";
import { SHARE_ERRORS, formatTypedId } from "@/lib/use-share";

describe("formatTypedId", () => {
  it("puts typed text into the shown XXXXX-XXXXX / XXXX-XXXX shape", () => {
    expect(formatTypedId("7kq2m9xf4t", [5, 5])).toBe("7KQ2M-9XF4T");
    expect(formatTypedId("7kq2m 9xf4t", [5, 5])).toBe("7KQ2M-9XF4T");
    expect(formatTypedId("k7qf", [4, 4])).toBe("K7QF");
    expect(formatTypedId("k7qf2", [4, 4])).toBe("K7QF-2");
    expect(formatTypedId("k7qf-2m9x-extra", [4, 4])).toBe("K7QF-2M9X");
  });
});

describe("SHARE_ERRORS", () => {
  it("maps each relay refusal a joiner can hit to its own message", () => {
    expect(SHARE_ERRORS).toMatchObject({
      invalid_join_code: "joinChat.errors.invalid",
      join_code_expired: "joinChat.errors.expired",
      join_code_used: "joinChat.errors.used",
      too_many_attempts: "joinChat.errors.tooMany",
      relay_unavailable: "shareChat.errors.relay",
    });
  });
});
