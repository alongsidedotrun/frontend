// A turn's work as steps, in the order it happened (the thinking-steps pattern,
// fluidfunctionalism.com/docs/thinking-steps): its thinking, the notes it wrote along the way, and its
// tool calls, with calls of the same kind in a row folded into one step ("Read 6 files").

export type ToolLine = { label: string; detail?: string; rowId?: string };
export type StepNote = { text: string; at: number; active?: boolean };

export type WorkStep =
  | { kind: "thinking"; text: string }
  | { kind: "note"; text: string; active?: boolean }
  | { kind: "tools"; label: string; lines: ToolLine[] }
  // A file edit's step: its card (the diff) is drawn inside it. `rowIds` are the edit rows in the chat.
  | { kind: "files"; label: "Write" | "Edit"; rowIds: string[] };

export const isFileLine = (line: ToolLine): line is ToolLine & { rowId: string } =>
  !!line.rowId && (line.label === "Write" || line.label === "Edit");

export function workSteps(thinking: string, toolLines: ToolLine[], notes: StepNote[]): WorkStep[] {
  const steps: WorkStep[] = [];
  if (thinking.trim()) steps.push({ kind: "thinking", text: thinking.trim() });
  const pending = [...notes].sort((a, b) => a.at - b.at);
  const flushNotes = (upTo: number) => {
    while (pending.length && pending[0].at <= upTo) {
      const n = pending.shift()!;
      if (n.text.trim()) steps.push({ kind: "note", text: n.text, active: n.active });
    }
  };
  toolLines.forEach((line, index) => {
    flushNotes(index);
    const last = steps[steps.length - 1];
    if (isFileLine(line)) {
      if (last?.kind === "files" && last.label === line.label) last.rowIds.push(line.rowId);
      else steps.push({ kind: "files", label: line.label as "Write" | "Edit", rowIds: [line.rowId] });
      return;
    }
    if (last?.kind === "tools" && last.label === line.label) last.lines.push(line);
    else steps.push({ kind: "tools", label: line.label, lines: [line] });
  });
  flushNotes(Number.POSITIVE_INFINITY);
  return steps;
}

// What the turn did, for the folded header: "3 files changed, 5 commands".
export function workCounts(toolLines: ToolLine[]): { files: number; commands: number; reads: number; searches: number } {
  const files = new Set<string>();
  let commands = 0;
  let reads = 0;
  let searches = 0;
  for (const line of toolLines) {
    if (isFileLine(line)) files.add(line.detail || line.rowId);
    else if (line.label === "Run") commands++;
    else if (line.label === "Read") reads++;
    else if (line.label === "WebSearch") searches++;
  }
  return { files: files.size, commands, reads, searches };
}
