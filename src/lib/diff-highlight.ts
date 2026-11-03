// Light syntax colouring for one line of a diff card. Not a parser: it marks comments, strings,
// numbers, keywords and called names, which is enough to make a short diff easy to read. Lines are
// coloured one at a time, so a comment or string that spans lines is only coloured where it starts.

export type TokenKind = "kw" | "str" | "num" | "cm" | "fn" | "txt";
export type Token = { kind: TokenKind; text: string };

const KEYWORDS = new Set(
  (
    // JS/TS
    "export function return const let var if else throw new import from async await class extends typeof " +
    "void true false null undefined for while switch case break continue try catch finally this super " +
    "static type interface enum as of in default yield delete instanceof " +
    // Rust
    "fn pub mut use mod impl struct trait match where self Self crate move ref loop unsafe dyn Some None Ok Err " +
    // Python, shell and others
    "def elif lambda pass raise with not and or is None True False nil func package go defer then fi do done esac"
  ).split(" ")
);

// Files where `#` starts a comment.
const HASH_COMMENTS = /\.(py|sh|bash|zsh|rb|toml|ya?ml|r|pl|conf|ini|env|mk)$|(^|\/)(Makefile|Dockerfile|\.gitignore)$/i;

const PATTERN =
  /(\s+)|(\/\/.*|\/\*.*?(?:\*\/|$))|(#.*)|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(.)/g;

export function highlightLine(line: string, file = ""): Token[] {
  const hashComments = HASH_COMMENTS.test(file);
  const raw: Token[] = [];
  for (const m of line.matchAll(PATTERN)) {
    const text = m[0];
    if (m[1]) raw.push({ kind: "txt", text });
    else if (m[2]) raw.push({ kind: "cm", text });
    else if (m[3]) {
      if (hashComments) raw.push({ kind: "cm", text });
      else {
        // `#` isn't a comment here (CSS colours, Rust attributes, markdown headings): keep going
        // after it.
        raw.push({ kind: "txt", text: "#" });
        raw.push(...highlightLine(text.slice(1), file));
      }
    } else if (m[4]) raw.push({ kind: "str", text });
    else if (m[5]) raw.push({ kind: "num", text });
    else if (m[6]) raw.push({ kind: KEYWORDS.has(text) ? "kw" : "txt", text });
    else raw.push({ kind: "txt", text });
  }
  // A name followed by `(` is a call or a definition; so is a keyword used as a method name
  // (`Mutex::new(`, `.delete(`).
  for (let i = 0; i < raw.length; i++) {
    const token = raw[i];
    if (!/^[A-Za-z_$][\w$]*$/.test(token.text)) continue;
    const member = raw[i - 1]?.text === "." || (raw[i - 1]?.text === ":" && raw[i - 2]?.text === ":");
    if (token.kind !== "txt" && !(token.kind === "kw" && member)) continue;
    let j = i + 1;
    while (j < raw.length && /^\s+$/.test(raw[j].text)) j++;
    if (raw[j]?.text === "(" || (raw[j]?.text === "!" && raw[j + 1]?.text === "(")) token.kind = "fn";
  }
  // Merge neighbours of the same kind, so a line is a handful of spans, not one per character.
  const out: Token[] = [];
  for (const token of raw) {
    const last = out[out.length - 1];
    if (last && last.kind === token.kind) last.text += token.text;
    else out.push({ ...token });
  }
  return out;
}
