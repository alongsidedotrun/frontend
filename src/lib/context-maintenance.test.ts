import { describe, expect, it } from "vitest";
import { contextMaintenanceAction, shouldHandoffAfterCompact } from "./context-maintenance";

describe("context maintenance", () => {
  it("never hands off from a replayed compaction event", () => {
    expect(shouldHandoffAfterCompact(90_000, 100_000, true, true)).toBe(false);
    expect(shouldHandoffAfterCompact(90_000, 100_000, true, false)).toBe(true);
  });
  it("compacts at the selected margin without counting earlier compactions", () => {
    expect(contextMaintenanceAction({ used: 100_000, compactAt: 100_000, automaticHandoff: true, lastCompactedUsage: null, turnsSinceCompact: 99 })).toBe("compact");
    expect(shouldHandoffAfterCompact(30_000, 100_000, true)).toBe(false);
  });

  it("hands off when compaction stays too large", () => {
    expect(shouldHandoffAfterCompact(50_000, 100_000, true)).toBe(true);
    expect(shouldHandoffAfterCompact(90_000, 100_000, false)).toBe(false);
  });

  it("hands off when context regrows to the margin within two turns", () => {
    expect(contextMaintenanceAction({ used: 100_000, compactAt: 100_000, automaticHandoff: true, lastCompactedUsage: 25_000, turnsSinceCompact: 2 })).toBe("handoff");
    expect(contextMaintenanceAction({ used: 100_000, compactAt: 100_000, automaticHandoff: true, lastCompactedUsage: 25_000, turnsSinceCompact: 3 })).toBe("compact");
  });
});
