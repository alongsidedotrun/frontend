import { describe, expect, it } from "vitest";
import { contextTokensUsed } from "./context-usage";

describe("contextTokensUsed", () => {
  it("uses the turn's last call, not the sum over every call (a real Claude result)", () => {
    expect(
      contextTokensUsed({
        input_tokens: 19,
        cache_creation_input_tokens: 47216,
        cache_read_input_tokens: 630071,
        output_tokens: 9000,
        iterations: [{ input_tokens: 2, cache_creation_input_tokens: 670, cache_read_input_tokens: 73067, output_tokens: 932 }],
      }),
    ).toBe(74671);
  });
  it("sums the top level when there are no iterations (Codex, Antigravity)", () => {
    expect(contextTokensUsed({ input_tokens: 100, cached_input_tokens: 900, output_tokens: 50 })).toBe(1050);
    expect(contextTokensUsed({ total_tokens: 1234, input_tokens: 1 })).toBe(1234);
  });
});
