// The inline markdown a Working note uses: `code`, **bold**, *italic* / _italic_, [text](url), and
// "- " / "* " bullets at the start of a line. Notes stay one plain paragraph (pre-wrap), so this
// only styles spans; it never builds blocks. An unclosed marker (mid-typing) stays as written.

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "bold"; children: InlineSegment[] }
  | { kind: "italic"; children: InlineSegment[] }
  | { kind: "link"; text: string; href: string };

// Order matters: code first (its contents are literal), then links, bold, italic.
const TOKEN = /(`[^`\n]+`)|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^\n]+?)\*\*|__([^\n]+?)__|(?<![\w*])\*(?![\s*])([^*\n]*?[^\s*])\*(?![\w*])|(?<![\w_])_(?![\s_])([^_\n]*?[^\s_])_(?![\w_])/g;

export function parseInlineMarkdown(input: string): InlineSegment[] {
  const text = input.replace(/^([ \t]*)[-*] (?=\S)/gm, "$1• ");
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    if (m[1]) out.push({ kind: "code", text: m[1].slice(1, -1) });
    else if (m[2] !== undefined) out.push({ kind: "link", text: m[2], href: m[3] });
    else if (m[4] !== undefined || m[5] !== undefined) out.push({ kind: "bold", children: parseInlineMarkdown(m[4] ?? m[5]) });
    else out.push({ kind: "italic", children: parseInlineMarkdown(m[6] ?? m[7]) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
