/** One foreground usage_observations row from GET /chats/:id/usage. */
export type RunUsageObservation = {
  event_id: number;
  message_event_id: number | null;
  run_id: string;
  provider: string;
  model: string;
  source: string;
  scope: string;
  total_tokens: number | null;
  context_tokens: number | null;
};

/** Per-run summary for the Runs panel: context vs cumulative processed. */
export type RunUsageSummary = {
  contextTokens: number | null;
  processedTokens: number | null;
  processedScope: "session_cumulative" | "unavailable";
};

/**
 * Latest context and, when the provider reports it, session-cumulative processed
 * for one agent run. Result-scope totals are never shown as processed quota.
 */
export function summarizeRunUsage(rows: RunUsageObservation[]): RunUsageSummary {
  if (rows.length === 0) {
    return { contextTokens: null, processedTokens: null, processedScope: "unavailable" };
  }
  const ordered = [...rows].sort((a, b) => a.event_id - b.event_id);
  const latest = ordered[ordered.length - 1];
  const contextTokens = latest.context_tokens ?? null;
  const cumulative = [...ordered].reverse().find((row) => row.scope === "session_cumulative" && row.total_tokens != null);
  if (cumulative?.total_tokens != null) {
    return {
      contextTokens,
      processedTokens: cumulative.total_tokens,
      processedScope: "session_cumulative",
    };
  }
  return { contextTokens, processedTokens: null, processedScope: "unavailable" };
}

export function usageByRunId(rows: RunUsageObservation[]): Map<string, RunUsageSummary> {
  const grouped = new Map<string, RunUsageObservation[]>();
  for (const row of rows) {
    const list = grouped.get(row.run_id) ?? [];
    list.push(row);
    grouped.set(row.run_id, list);
  }
  const out = new Map<string, RunUsageSummary>();
  for (const [runId, list] of grouped) {
    out.set(runId, summarizeRunUsage(list));
  }
  return out;
}
