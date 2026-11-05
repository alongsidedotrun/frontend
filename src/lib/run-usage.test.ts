import { describe, expect, it } from "vitest";
import { summarizeRunUsage, usageByRunId, type RunUsageObservation } from "./run-usage";

function row(partial: Partial<RunUsageObservation> & Pick<RunUsageObservation, "event_id" | "run_id" | "scope">): RunUsageObservation {
  return {
    message_event_id: null,
    provider: "codex",
    model: "gpt-5.6-terra",
    source: "provider_reported",
    total_tokens: null,
    context_tokens: null,
    ...partial,
  };
}

describe("summarizeRunUsage", () => {
  it("uses the latest context and session-cumulative processed when present", () => {
    const summary = summarizeRunUsage([
      row({ event_id: 1, run_id: "r1", scope: "session_cumulative", context_tokens: 111_413, total_tokens: 5_942_185 }),
      row({ event_id: 2, run_id: "r1", scope: "session_cumulative", context_tokens: 43_682, total_tokens: 28_337_524 }),
    ]);
    expect(summary).toEqual({
      contextTokens: 43_682,
      processedTokens: 28_337_524,
      processedScope: "session_cumulative",
    });
  });

  it("does not treat a result-scope total as cumulative processed", () => {
    const summary = summarizeRunUsage([
      row({ event_id: 1, run_id: "r1", scope: "result", context_tokens: 12_000, total_tokens: 12_000 }),
    ]);
    expect(summary).toEqual({
      contextTokens: 12_000,
      processedTokens: null,
      processedScope: "unavailable",
    });
  });

  it("groups observations by run", () => {
    const map = usageByRunId([
      row({ event_id: 1, run_id: "a", scope: "result", context_tokens: 100, total_tokens: 100 }),
      row({ event_id: 2, run_id: "b", scope: "session_cumulative", context_tokens: 200, total_tokens: 9_000 }),
    ]);
    expect(map.get("a")?.contextTokens).toBe(100);
    expect(map.get("a")?.processedScope).toBe("unavailable");
    expect(map.get("b")?.processedTokens).toBe(9_000);
  });
});
