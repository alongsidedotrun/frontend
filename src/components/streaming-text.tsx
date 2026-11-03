import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Streamdown, type ExtraProps } from "streamdown";
import { ResearchIcon } from "@/components/icons/untitled-ui";
import { holdBackTable } from "@/lib/stream-table";

// WORD_MS = 55 -- exact cadence from the pasted reference component (its own
// WORD_MS), per explicit request ("the entire and exactly streaming effect...
// so that it feels like AI is replying via typing"). streamdown's own built-in
// word-stagger animation (`animated`, tried first -- this file's own git history)
// didn't read as a deliberate typing cadence the way driving our own timer at this
// exact interval does.
//
// The reference's own citation chips/source list/follow-up prompts are NOT ported
// -- disclosed the same way once already this session (this file's own git
// history): those render fixed demo data (specific source names/URLs, canned
// follow-up questions) with nothing real to back them from an actual agent reply,
// and fabricating that structure on top of a real reply would misrepresent what
// the model actually said. Only the reveal mechanic itself -- the actual ask here
// -- is real.
//
// Still real markdown, not plain text -- text is fed to streamdown incrementally
// (mode="streaming", its own incomplete-markdown-safe parsing) rather than
// rendered as raw spans, so a code fence or bold marker revealed mid-word doesn't
// render as broken/literal asterisks the way plain-text word spans would.
const WORD_MS = 55;
// A long reply typed one word at a time kept typing for minutes and re-rendered the page on every
// word. Each tick reveals enough words that the rest is shown within about this long.
const MAX_REVEAL_MS = 6000;
const TICKS_LEFT = MAX_REVEAL_MS / WORD_MS;

// How often the cursor toggles on/off -- matches a typical text-cursor blink
// rate closely enough; there's nothing to port here since the reference's own
// cursor was a separate DOM node (a real span, not a character), which is
// exactly what doesn't work once markdown is involved (see below).
const BLINK_MS = 500;

// Real favicon of the actual cited domain -- Google's own public favicon
// service (no API key, widely used for exactly this), not a scraped/hosted
// copy of our own. Falls back to the globe glyph (ResearchIcon) on a load
// error via the <img>'s own onError.
function faviconUrl(hostname: string) {
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(hostname)}`;
}

// A real markdown link in the reply -- Codex's own citations and Claude's own
// WebSearch results both write these directly into the reply text (confirmed
// directly: a real Codex reply cited "[Official OpenAI documentation](https://
// help.openai.com/...)"), rendered by Streamdown's own default `a` as a bare
// blue underlined hyperlink. Per explicit request ("the source is showing a
// hyperlink"), this renders it as a small pill instead -- the real cited
// site's own favicon plus its domain name, matching the pasted reference's own
// SourceChip in spirit. href/hostname/favicon are all the link's own real
// data, never fabricated.
function CitationLink({ href, children, ...props }: React.ComponentProps<"a"> & ExtraProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  let hostname = href;
  try {
    if (href) hostname = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    // Not a real absolute URL (a relative/malformed href) -- fall back to
    // rendering it as a plain link below rather than a chip with a made-up
    // label.
  }
  if (!href || hostname === href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mx-0.5 inline-flex h-[18px] translate-y-[-1px] items-center gap-1 rounded-[5px] border border-border bg-muted px-1.5 align-middle font-mono text-ui-2xs text-muted-foreground no-underline transition-colors hover:bg-hover-2/50 hover:text-foreground"
    >
      {faviconFailed ? (
        <ResearchIcon className="size-3 shrink-0" />
      ) : (
        // Non-null: the `!href || hostname === href` guard above already
        // returned early unless the try block ran (the only path that
        // reassigns hostname away from href), so hostname is a real
        // string by this point -- TS just can't see that through the
        // try/catch reassignment.
        <img src={faviconUrl(hostname!)} alt="" className="size-3 shrink-0 rounded-[2px]" onError={() => setFaviconFailed(true)} />
      )}
      {hostname}
    </a>
  );
}

// Streamdown's own default h1-h6 styling (text-3xl/2xl/xl + font-semibold,
// real markdown-typography defaults meant for a full document, not a chat
// bubble) -- confirmed directly as a real bug ("the text is on a bigger size
// and scales down to the size we have set"): not an animation, a real
// heading element rendering at its real (much larger) default size before
// the following paragraph text renders at this app's own 13px, which reads
// as a size jump reading down the reply. Only shows up on Claude replies
// (confirmed directly, "not happening to codex") because Claude's own
// replies are the ones that actually start with a markdown heading; Codex's
// don't, so the same code path never hits it. Every level collapses to the
// same 13px the rest of the reply uses, kept bold+block so a heading still
// reads as one, just without the oversized jump.
// mb-3 last:mb-0 -- confirmed directly as a real (if not new) bug ("we are
// missing the enters now to create space between the [paragraphs]"):
// Streamdown provides no block-to-block margin at all for <p> by default
// (no className on it anywhere in its own bundle, confirmed the same way
// Table/UnorderedList's own comment below confirmed table/list styling was
// missing) -- so every paragraph, list, and table in a reply ran flush into
// the next with zero gap regardless of the source markdown's own blank
// lines between them. last:mb-0 avoids doubling up on the action row's own
// gap-1 spacing below the reply text (ChatRowView's own outer flex-col).
function Paragraph({ children, ...props }: React.ComponentProps<"p"> & ExtraProps) {
  return (
    <p className="mb-3 text-chat leading-relaxed last:mb-0" {...props}>
      {children}
    </p>
  );
}

function Heading({ children, ...props }: React.ComponentProps<"p"> & ExtraProps) {
  return (
    <p className="mb-2 text-chat leading-relaxed font-semibold last:mb-0" {...props}>
      {children}
    </p>
  );
}

// Streamdown's own default table/list styling -- confirmed directly as a
// real bug ("no spacing in between [table cells]... no visible lines at the
// table... bullet point should have been added a tab for spacing"): not a
// missing design, a missing *build* -- Streamdown's own compiled bundle does
// carry real classes for these (`w-full divide-y divide-border` on <table>,
// `px-4 py-2` on <td>/<th>, real list-marker/indent classes), confirmed by
// reading its own dist/chunk-*.js. Tailwind only generates CSS for class
// names it finds while scanning *this app's own* source files, though --
// class strings that only ever exist inside an already-built node_modules
// bundle are invisible to that scan, so those elements render with the
// right className attribute and no matching CSS rule ever gets produced for
// it. Same root cause and same fix as the h1-h6 override above: don't rely
// on Streamdown's own bundled defaults surviving the build at all, own the
// classes directly in a file Tailwind actually scans.
function Table({ children, ...props }: React.ComponentProps<"table"> & ExtraProps) {
  return (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-chat" {...props}>
        {children}
      </table>
    </div>
  );
}
function TableHeaderCell({ children, ...props }: React.ComponentProps<"th"> & ExtraProps) {
  return (
    <th className="border border-border bg-muted/40 px-3 py-1.5 text-left text-chat font-semibold" {...props}>
      {children}
    </th>
  );
}
function TableCell({ children, ...props }: React.ComponentProps<"td"> & ExtraProps) {
  return (
    <td className="border border-border px-3 py-1.5 text-left text-chat align-top" {...props}>
      {children}
    </td>
  );
}
// list-disc/list-decimal + pl-5 -- Tailwind's own preflight (via
// @tailwindcss's reset, index.css's own top import) zeroes every list's
// default marker and left padding along with everything else it resets, so
// without these a <ul>/<ol> rendered no bullet/number and no indent at all
// -- exactly "no tab for spacing" reading as literally true, not just a
// visual nitpick. space-y-1 for breathing room between items at this
// app's own compact 13px scale, tighter than a full document's default.
function UnorderedList({ children, ...props }: React.ComponentProps<"ul"> & ExtraProps) {
  return (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-chat leading-relaxed last:mb-0" {...props}>
      {children}
    </ul>
  );
}
// Streamdown's own list items carry py-1 on top of the list's space-y-1, which spread a short list
// further apart than the paragraphs around it.
function ListItem({ children, ...props }: React.ComponentProps<"li"> & ExtraProps) {
  return (
    <li className="[&>p]:inline" {...props}>
      {children}
    </li>
  );
}
function OrderedList({ children, ...props }: React.ComponentProps<"ol"> & ExtraProps) {
  return (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-chat leading-relaxed last:mb-0" {...props}>
      {children}
    </ol>
  );
}

// A file:// link in a reply (Antigravity's write_to_file confirms the path
// this way, e.g. "[HelloWorld.md](file:///Users/.../HelloWorld.md)") --
// real bug, confirmed directly ("why is it showing blocked at
// HelloWorld.md [blocked]"): Streamdown's own link sanitizer (rehype-harden)
// hardcodes file:/javascript:/data:/vbscript: as permanently blocked
// protocols with no config escape hatch (checked directly in its source),
// appending " [blocked]" to the link text rather than rendering it. This
// app's own trust model already gives agents full filesystem access, so
// there's no real security reason to hide the reference -- but there's
// also no in-app "open this local file" action wired up here (that's
// Library/the right panel's own job, driven by a real path prop, not a
// markdown string) to make it a genuinely working link either. Dropping
// just the link wrapper and keeping its label as plain text is the
// straightforward middle ground: no dead/blocked-looking link, and the
// filename the agent named is still right there in the reply.
const FILE_LINK_PATTERN = /\[([^\]]+)\]\(file:\/\/[^\s)]+\)/g;

function stripFileLinks(text: string): string {
  return text.replace(FILE_LINK_PATTERN, "$1");
}

// Both renderers (history and live) draw a reply the same way, so a reply doesn't change look on reload.
const MARKDOWN_COMPONENTS = {
  a: CitationLink,
  p: Paragraph,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  table: Table,
  th: TableHeaderCell,
  td: TableCell,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
};
// Copy on code blocks only.
const MARKDOWN_CONTROLS = { code: { copy: true, download: false }, table: false, mermaid: false } as const;
// Streamdown spaces its blocks with space-y-4 on top of their own margins; our blocks set their own.
const MARKDOWN_CLASS = "space-y-0";

// How far each text has been typed, shared by everything that types it. While a turn runs, its
// newest text types in as the live step in Working; when the turn ends the same text becomes the
// reply, which carries on from there instead of showing it all first and then typing it again.
// Keyed by the text's start, which stays the same as the text grows. Two texts can share a start,
// so what was typed is kept too, and a text carries on only as far as it matches it.
const typedSoFar = new Map<string, string[]>();
function typingKey(text: string) {
  return text.slice(0, 80);
}
function rememberTyped(key: string, typed: string[]) {
  typedSoFar.delete(key);
  typedSoFar.set(key, typed);
  if (typedSoFar.size > 300) typedSoFar.delete(typedSoFar.keys().next().value!);
}
/** How many of `tokens` were already typed by something typing the same text. */
export function alreadyTyped(key: string, tokens: string[]) {
  const typed = typedSoFar.get(key);
  if (!typed) return 0;
  let n = 0;
  while (n < typed.length && n < tokens.length && typed[n] === tokens[n]) n++;
  return n;
}

/** Types `text` in word by word (while `animate`), at the reply's pace, carrying on from wherever
 * anything else typing the same text got to. */
export function useTyping(rawText: string, animate: boolean) {
  const text = useMemo(() => stripFileLinks(rawText), [rawText]);
  // Plain split(" "), not a line-aware tokenizer -- a real newline inside a word's
  // own substring survives untouched (never split on), so it's still there once
  // this joins revealed words back with " ".
  const tokens = useMemo(() => text.split(" "), [text]);
  const key = typingKey(text);
  const [count, setCount] = useState(() => (animate ? alreadyTyped(key, tokens) : tokens.length));
  const done = count >= tokens.length;
  useEffect(() => {
    if (animate) rememberTyped(key, tokens.slice(0, count));
  }, [animate, key, count, tokens]);
  useEffect(() => {
    if (!animate || done) return;
    const step = Math.max(1, Math.ceil((tokens.length - count) / TICKS_LEFT));
    const t = setTimeout(() => setCount((c) => c + step), WORD_MS);
    return () => clearTimeout(t);
    // count is a real dependency: each tick schedules the next one.
  }, [animate, done, count, tokens.length]);
  return { text, tokens, count, done, finish: () => setCount(Number.MAX_SAFE_INTEGER) };
}

/** A live step in Working: plain text, typed in like the reply. */
export function TypedText({ text, animate, render }: { text: string; animate: boolean; render?: (shown: string) => ReactNode }) {
  const { tokens, count, done } = useTyping(text, animate);
  const shown = done ? tokens.join(" ") : tokens.slice(0, count).join(" ");
  return <>{render ? render(shown) : shown}</>;
}

export function StreamingText({ text: rawText, animate, onDone }: { text: string; animate: boolean; onDone?: () => void }) {
  // Follows `text` as it grows: a turn's later text is added to the same reply (#557), and the
  // reveal carries on from where it was instead of starting over.
  const { text, tokens, count, done, finish } = useTyping(rawText, animate);
  const [blinkOn, setBlinkOn] = useState(true);
  // Set while the reply's end is off screen (the reader scrolled up): typing there costs work for
  // nothing anyone sees, so the rest is shown at once.
  const endRef = useRef<HTMLSpanElement>(null);
  const endHiddenRef = useRef(false);

  useEffect(() => {
    const el = endRef.current;
    if (!animate || done || !el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      // A short wait, so the frame before the chat scrolls to a new reply doesn't count.
      if (!entry.isIntersecting)
        timer = setTimeout(() => {
          endHiddenRef.current = true;
          finish();
        }, 300);
      else endHiddenRef.current = false;
    });
    io.observe(el);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [animate, done]);

  // Text added while the end is still off screen shows at once too.
  useEffect(() => {
    if (animate && !done && endHiddenRef.current) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, done, tokens.length]);

  // Real, per explicit request ("copy, rate, re-try... source and time and
  // advise shows before the actual text loads... makes no sense to show the
  // source before the text is even there") -- ChatRowView's own agent branch
  // uses this to gate the actions row/disclaimer's own mount until the
  // reveal genuinely finishes, not fire it while still typing. Only ever
  // needs to fire once per row, but done flips back to a fresh false/true
  // cycle if this component ever remounts on a new `text` (a new row, not
  // this same one updating) -- harmless, onDone firing again on a distinct
  // row is exactly what should happen there too.
  useEffect(() => {
    if (animate && done) onDone?.();
  }, [animate, done, onDone]);

  // Separate timer from the reveal one above -- the cursor keeps blinking at its
  // own steady rate independent of how fast words are arriving.
  useEffect(() => {
    if (!animate || done) return;
    const t = setInterval(() => setBlinkOn((b) => !b), BLINK_MS);
    return () => clearInterval(t);
  }, [animate, done]);

  if (!animate) {
    // History replay -- renders instantly, no reveal, real markdown either way.
    return (
      <Streamdown
        mode="static"
        className={MARKDOWN_CLASS}
        controls={MARKDOWN_CONTROLS}
        components={MARKDOWN_COMPONENTS}
      >
        {text}
      </Streamdown>
    );
  }

  // The cursor used to be a separate <span> rendered as Streamdown's sibling --
  // confirmed directly as the bug: Streamdown wraps its own output in block-level
  // markup (a real <p>, for real prose), so a sibling element lands *after* that
  // whole block and drops to the line below instead of sitting inline with the
  // last word. There's no hook to inject a real DOM node into Streamdown's own
  // rendered tree, so the cursor is a literal character appended to the revealed
  // text itself instead -- guaranteed to flow inline as part of the actual last
  // line, at the cost of the blink being a character swap (below) rather than a
  // CSS animation on its own node.
  const shown = done ? { text: tokens.join(" "), cursor: false } : holdBackTable(tokens.slice(0, count).join(" "));
  const revealed = shown.text + (shown.cursor ? (blinkOn ? " ▍" : "  ") : "");

  return (
    // animated={false}: this component already drives its own reveal cadence
    // (the timer above) -- streamdown's own animation would double up on top of
    // that instead of just rendering each growing prefix as it arrives.
    <>
      <Streamdown
        mode="streaming"
        animated={false}
        className={MARKDOWN_CLASS}
        controls={MARKDOWN_CONTROLS}
        components={MARKDOWN_COMPONENTS}
      >
        {revealed}
      </Streamdown>
      <span ref={endRef} aria-hidden="true" className="block h-px" />
    </>
  );
}
