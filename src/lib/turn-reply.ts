// #557: a turn is one reply, the way Claude Code and Codex show it.

type AgentPart = { kind: "agent"; id: string; text: string; time: string; turnRowId?: string; continued?: boolean };

// Adds a turn's later text to that turn's reply (`turnRowId` is its first row). It joins the turn's
// last part when nothing visible came after it (permission rows aren't drawn in the log), and
// otherwise starts a new part after the card in between (a file edit), drawn as the same reply:
// the new part carries `turnRowId`, and the part before it is marked `continued`.
export function addTurnText<R extends { kind: string; id: string }, A extends AgentPart & R>(rows: R[], turnRowId: string, part: A): R[] {
  let at = -1;
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index] as R & Partial<AgentPart>;
    if (row.kind === "agent" && (row.id === turnRowId || row.turnRowId === turnRowId)) {
      at = index;
      break;
    }
  }
  if (at < 0) return [...rows, part];
  const last = rows[at] as unknown as A;
  const next = [...rows];
  if (rows.slice(at + 1).every((row) => row.kind === "permission")) {
    next[at] = { ...last, text: `${last.text}\n\n${part.text}`, time: part.time };
    return next;
  }
  next[at] = { ...last, continued: true };
  return [...next, { ...part, turnRowId }];
}
