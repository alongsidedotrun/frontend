// While a reply types in, a table's unfinished last row and the typing cursor each drew a row of
// their own (the cursor after a table line is read as one more row), so the table grew by a row and
// then lost it. A header also showed as plain `| a | b |` text until its separator line arrived.

const isTableLine = (line: string) => line.trimStart().startsWith("|");

/** The part of a typing reply that's safe to show while a table in it is still arriving, and
 * whether the cursor can follow it (not when the text ends inside a table). */
export function holdBackTable(revealed: string): { text: string; cursor: boolean } {
  const lines = revealed.split("\n");
  // The last line is still being typed: a table row there isn't finished yet.
  const dropped = lines.length > 1 && isTableLine(lines[lines.length - 1]);
  if (dropped) lines.pop();
  else if (lines.length === 1 && isTableLine(lines[0])) return { text: "", cursor: false };
  // Lines at the end that belong to a table.
  let start = lines.length;
  while (start > 0 && isTableLine(lines[start - 1])) start--;
  const tableLines = lines.length - start;
  if (tableLines === 0) return { text: dropped ? lines.join("\n").trimEnd() : revealed, cursor: true };
  // Only a header so far: wait for its separator, so it doesn't show as text first.
  if (tableLines === 1) return { text: lines.slice(0, start).join("\n").trimEnd(), cursor: true };
  return { text: lines.join("\n"), cursor: false };
}
