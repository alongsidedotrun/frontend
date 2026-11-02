// #557: a turn is one reply, the way Claude Code and Codex show it.

// A turn's earlier text block, now a step in its Working list. `at` is how many tool calls came
// before it, so steps and tool calls keep the order they happened in.
export type TurnNote = { text: string; at: number };

type AgentPart = {
  kind: "agent";
  id: string;
  text: string;
  time: string;
  turnRowId?: string;
  continued?: boolean;
  // Tool calls made before `text` arrived (see TurnNote).
  textAt?: number;
  notes?: TurnNote[];
};

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
    // The turn's earlier text becomes a step inside its Working list and the newest text is the
    // reply (the thinking-steps pattern): one message, with the narration folded away.
    if (last.id === turnRowId) {
      const notes = [...(last.notes ?? []), { text: last.text, at: last.textAt ?? 0 }];
      next[at] = { ...last, notes, text: part.text, textAt: part.textAt, time: part.time };
      return next;
    }
    next[at] = { ...last, text: `${last.text}\n\n${part.text}`, time: part.time };
    return next;
  }
  next[at] = { ...last, continued: true };
  return [...next, { ...part, turnRowId }];
}
