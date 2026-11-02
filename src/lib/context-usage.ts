// Token fields as the providers report them; each provider sends its own subset, so summing them
// never double-counts. Claude names the cached part cache_creation_input_tokens /
// cache_read_input_tokens, Codex cached_input_tokens / cache_write_input_tokens, Antigravity
// cache_read_tokens (and a precomputed total_tokens, used as is).
type TokenFields = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  cache_read_tokens?: number;
  total_tokens?: number;
};

// Claude also lists the turn's API calls in `iterations`.
export type TurnUsage = TokenFields & { iterations?: TokenFields[] };

function sum(usage: TokenFields): number {
  return (
    usage.total_tokens ??
    (usage.input_tokens ?? 0) +
      (usage.output_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cached_input_tokens ?? 0) +
      (usage.cache_write_input_tokens ?? 0) +
      (usage.cache_read_tokens ?? 0)
  );
}

// The context the next turn starts from: the turn's last call (its prompt plus its reply).
// Claude's top-level usage adds up every call in the turn, so a turn with many tool calls read as
// millions of tokens (3.4M for a chat holding 75k) and handed the chat off after nearly every turn.
export function contextTokensUsed(usage: TurnUsage): number {
  const last = usage.iterations?.[usage.iterations.length - 1];
  return sum(last ?? usage);
}
