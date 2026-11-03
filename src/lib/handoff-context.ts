// Splits what a fresh session was given at a handoff (backend/src/context.rs, compile_full) into
// parts the handoff dialog can show as readable sections. The text is the backend's own format:
// `<carried_context>` (or `<since_your_last_turn>`) holding `<instructions>`, `<checkpoint>`,
// `<work_state>`, `<conversation>`, tool output and `<file path="…">` blocks. Anything that
// doesn't parse is returned as `null`, and the dialog shows the plain text instead.

export type HandoffSection = { tag: string; path?: string; body: string };

export type WorkBlock = { label: string; value: string; items: { text: string; failed?: boolean; ok?: boolean }[] };

export type Turn = { speaker: string; text: string; tools: string[] };

const WRAPPERS = ["carried_context", "since_your_last_turn"];

export function parseHandoff(context: string): HandoffSection[] | null {
  const wrapper = WRAPPERS.find((w) => context.trimStart().startsWith(`<${w}>`));
  if (!wrapper) return null;
  const end = context.lastIndexOf(`</${wrapper}>`);
  if (end < 0) return null;
  const inner = context.slice(context.indexOf(">") + 1, end);
  const sections: HandoffSection[] = [];
  const open = /<([a-z_]+)(?: path="([^"]*)")?>/g;
  let pos = 0;
  while (pos < inner.length) {
    open.lastIndex = pos;
    const m = open.exec(inner);
    if (!m) break;
    const tag = m[1];
    const start = m.index + m[0].length;
    // Each block ends with its closing tag at the end of a line. Its body can quote other tags
    // (a tool's output can contain a whole earlier handoff), so the first closing tag that ends
    // a line is taken, not the first opening tag after it.
    const close = `</${tag}>`;
    let stop = inner.indexOf(`${close}\n`, start);
    if (stop < 0) stop = inner.indexOf(close, start);
    if (stop < 0) return null;
    sections.push({ tag, path: m[2], body: inner.slice(start, stop).replace(/^\n/, "").replace(/\n+$/, "") });
    pos = stop + close.length;
  }
  return sections.length ? sections : null;
}

// The labels work_state.rs writes (render and render_compact). Only these start a block: a
// multi-line command's own lines can look like "Something: …" too.
const HEADER =
  /^((?:Original request|Latest request|Task list|Files changed(?: in this chat)?|Commands run|Latest commands|Open problems|The last turn ended with a provider error)(?: \([^)\n]*\))?):(?: (.*))?$/;

// In a list of commands, a "- " line without a result is part of the command above (a heredoc).
const isCommands = (label: string) => /^(Commands run|Latest commands)/.test(label);

/** The work state's blocks ("Task list (2 of 3 done):" and its items, "Latest request: …"). */
export function parseWorkState(text: string): WorkBlock[] {
  const blocks: WorkBlock[] = [];
  for (const line of text.split("\n")) {
    const header = !line.startsWith(" ") && !line.startsWith("- ") ? HEADER.exec(line) : null;
    const last = blocks[blocks.length - 1];
    if (header) {
      blocks.push({ label: header[1], value: header[2] ?? "", items: [] });
    } else if (line.startsWith("- ") && last && !(isCommands(last.label) && !/^- (ok|FAILED) /.test(line) && last.items.length)) {
      const rest = line.slice(2);
      const status = /^(ok|FAILED) /.exec(rest);
      if (status) last.items.push({ text: rest.slice(status[0].length), ok: status[1] === "ok", failed: status[1] === "FAILED" });
      else last.items.push({ text: rest });
    } else if (last) {
      // A command's later lines, a problem's indented output, or a long request's next paragraph.
      const item = last.items[last.items.length - 1];
      if (item) item.text += `\n${line.replace(/^ {4}/, "")}`;
      else last.value += `\n${line}`;
    } else {
      blocks.push({ label: "", value: line, items: [] });
    }
  }
  for (const b of blocks) {
    b.value = b.value.trim();
    for (const i of b.items) i.text = i.text.replace(/\n+$/, "");
  }
  return blocks.filter((b) => b.label || b.value || b.items.length);
}

const SPEAKER = /(?:^|\n\n)([^\n:[\]`]{1,60}): /g;

/** The conversation's messages, with a speaker's run of tool calls folded into one turn. */
export function parseConversation(text: string): Turn[] {
  const found = [...text.matchAll(SPEAKER)].map((m) => ({
    speaker: m[1].trim(),
    at: m.index! + (m[0].startsWith("\n") ? 2 : 0),
    body: m.index! + m[0].length,
  }));
  // A paragraph like "Note: …" inside a message looks like a speaker line. Speakers are the
  // agent ("Assistant", "@name", "Ana's agent"), whoever speaks first, and any name that speaks
  // more than once.
  const counts = new Map<string, number>();
  for (const f of found) counts.set(f.speaker, (counts.get(f.speaker) ?? 0) + 1);
  const isSpeaker = (name: string, i: number) =>
    name === "Assistant" || name.startsWith("@") || name.endsWith("'s agent") || (i === 0 && found[0].at === 0) || (counts.get(name) ?? 0) > 1;
  const starts = found.filter((f, i) => isSpeaker(f.speaker, i));
  const turns: Turn[] = [];
  starts.forEach((s, i) => {
    const body = text.slice(s.body, i + 1 < starts.length ? starts[i + 1].at : text.length).trim();
    const tool = /^\[tool: ([\s\S]*)\]$/.exec(body);
    const last = turns[turns.length - 1];
    if (tool) {
      if (last && last.speaker === s.speaker && !last.text) last.tools.push(tool[1]);
      else turns.push({ speaker: s.speaker, text: "", tools: [tool[1]] });
    } else {
      turns.push({ speaker: s.speaker, text: body, tools: [] });
    }
  });
  return turns;
}

/** #564: a summary split into its first paragraph (shown on the earlier-messages card, without
 * the heading above it) and the rest (behind "Full summary"). A whole first section was too long:
 * a chat's Goal section ran over a screen. */
export function splitSummary(text: string): { lead: string; rest: string } {
  const trimmed = text.trim();
  const body = trimmed.startsWith("## ") ? trimmed.slice(trimmed.indexOf("\n") + 1 || trimmed.length).trim() : trimmed;
  const end = body.search(/\n\s*\n|\n(?=## )/);
  if (end < 0) return { lead: body, rest: "" };
  return { lead: body.slice(0, end).trim(), rest: body.slice(end).trim() };
}

/** The checkpoint without the backend's lead-in. */
export function checkpointText(body: string): string {
  return body.replace(/^Summary of earlier work:\s*/, "");
}
