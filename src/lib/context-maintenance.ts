export type ContextMaintenanceAction = "compact" | "handoff" | null;

export function contextMaintenanceAction({
  used,
  compactAt,
  automaticHandoff,
  lastCompactedUsage,
  turnsSinceCompact,
}: {
  used: number;
  compactAt: number;
  automaticHandoff: boolean;
  lastCompactedUsage: number | null;
  turnsSinceCompact: number;
}): ContextMaintenanceAction {
  if (used < compactAt) return null;
  if (automaticHandoff && lastCompactedUsage !== null && turnsSinceCompact <= 2) return "handoff";
  return "compact";
}

export function shouldHandoffAfterCompact(used: number, compactAt: number, automaticHandoff: boolean, replaying = false) {
  return !replaying && automaticHandoff && used >= compactAt / 2;
}
