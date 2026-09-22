import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { suppressAutoScroll } from "@/lib/chat-scroll-suppress";
import { useTextSwap } from "@/lib/use-text-swap";
import styles from "./thinking-reasoning.module.css";

// Installed via `npx shadcn@latest add
// https://www.aicss.dev/r/thinking-reasoning.json` (per explicit request),
// then adapted the same way thinking-state.tsx already was from the same
// registry: no "use client" (Next.js-only), this app's own real
// --muted-foreground/--foreground theme tokens instead of the reference's
// own hardcoded grays (thinking-state.module.css's own comment has that
// reasoning), and -- the real change here -- the reference's own SENTENCES
// demo array and fixed ~5s fake "thinking" timeline are gone entirely.
// This app never fabricates content it doesn't have (this file's own
// project-wide rule): `text` is TurnWorkDisclosure's real detailText
// (Claude's actual thinking-block content, the only provider that has any
// today), split into real sentences and revealed with a short staggered
// entrance -- a tasteful reveal of content that's already real, not a
// simulation of how long thinking "should" take the way the reference
// component invents. `label` is this app's own "Worked for Ns" (kept per
// explicit decision, not the reference's own "Thought for Ns" wording) --
// TurnWorkDisclosure still owns the collapsed/expanded and live/settled
// state; this component only renders whichever state it's told to.
//
// toolLines' own row styling (bold label + muted monospace detail) is
// adapted the same way from a second reference component pasted directly
// ("It should be using this" -- a ThinkingState with Steps/Reasoning/
// Search/Coding variants). Only the Coding variant's row shape is taken
// (label/detail, no icon -- this app has no per-tool icon set); its own
// useSequence/STAGES fake timed reveal is dropped entirely, same as
// SENTENCES was dropped from this file's own first reference component --
// every row here renders the instant its real data exists, nothing is
// staged to *look* like it took a particular amount of time.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SENTENCE_STAGGER_MS = 70;

type ReasoningItem = { kind: "sentence"; text: string } | { kind: "tool"; label: string; detail?: string };

export function ThinkingReasoning({
  label,
  text,
  toolLines,
  live,
  open,
  onToggleOpen,
}: {
  label: string;
  text: string;
  // Real tool calls this turn made ("Bash", "sed -n '1,160p' Internet.md"),
  // ChatPage.tsx's own toolCallLines comment has the full reasoning.
  // Rendered as their own structured rows (bold label + muted monospace
  // detail), appended after text's own prose sentences.
  toolLines?: { label: string; detail?: string }[];
  // Still receiving live updates this turn -- the reasoning stays open
  // and unclickable (same as the reference's own "while thinking the
  // reasoning is always open"), folding into a clickable summary once
  // the turn settles.
  live: boolean;
  open: boolean;
  onToggleOpen: () => void;
}) {
  useTranslation();
  const items: ReasoningItem[] = [
    ...splitSentences(text).map((s): ReasoningItem => ({ kind: "sentence", text: s })),
    ...(toolLines ?? []).map((t): ReasoningItem => ({ kind: "tool", label: t.label, detail: t.detail })),
  ];
  // useTextSwap (this file's own thinking-state.tsx sibling has the full
  // reasoning, a second reference pasted directly per explicit request --
  // "the switch between working and waiting should be [this]") -- label
  // changes as the live phase changes (Waiting -> Working, a running
  // seconds count updating), so this animates that swap instead of an
  // instant jump. Only meaningful while `live`; the settled label (below)
  // never changes after it's set, so it renders plain.
  const { displayText: labelSwapText, phase: labelSwapPhase } = useTextSwap(label);
  const [revealedCount, setRevealedCount] = useState(0);
  // Real bug, confirmed directly ("the arrow is expanded but there's
  // nothing there"): this used to key off `text` alone, initialized to "".
  // A turn with no real thinking-block text at all (the common case --
  // most turns only ever have tool calls, no Claude thinking block) passes
  // text="" here, which trivially equals that initial "", so the guard
  // below skipped the whole reveal and revealedCount stayed 0 forever --
  // toolLines never had a chance to reveal even though they were real and
  // present. Keying off the full combined signature (both text and
  // toolLines) instead of text alone fixes this for both fields.
  const sentencesKey = JSON.stringify([text, toolLines ?? []]);
  const revealedKeyRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: true });

  // Re-staggers only when genuinely new content has arrived (the text
  // grew), not on every re-render/toggle -- reopening an already-settled
  // reasoning block shouldn't replay the entrance animation.
  //
  // Real bug, confirmed directly via console output ("Still not showing"):
  // the staggered setTimeout-based reveal below is fragile against a row
  // being unmounted/remounted (this app's own viewport-visibility logic
  // mounts/unmounts off-screen rows) between scheduling a timer and it
  // firing -- diagnostic logging showed the effect running with the
  // correct real sentences/toolLines every time, yet revealedCount stuck
  // at 0 forever regardless. Staggering only ever mattered for genuinely
  // LIVE streaming content in the first place; a settled, already-fully-
  // known disclosure (the common case -- every historical reply, and any
  // live one with no further updates coming) has no reason to animate a
  // reveal at all, so it skips the timers entirely and shows everything
  // immediately, removing this whole class of timing bug for that case.
  useEffect(() => {
    if (sentencesKey === revealedKeyRef.current) return;
    revealedKeyRef.current = sentencesKey;
    if (!live || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setRevealedCount(items.length);
      return;
    }
    setRevealedCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    items.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), i * SENTENCE_STAGGER_MS));
    });
    return () => timers.forEach(clearTimeout);
    // items is derived from sentencesKey every render -- only
    // sentencesKey/live (checked above) should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentencesKey, live]);

  const expanded = live || open;
  const visibleItems = items.slice(0, revealedCount);

  const onScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    setFade({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  };

  return (
    <div className={styles.tr}>
      <button
        type="button"
        className={styles.trHeader + (!live ? " " + styles.isClickable : "")}
        aria-expanded={expanded}
        aria-label={i18n.t("chat.toggleThought")}
        onClick={!live ? onToggleOpen : undefined}
      >
        {live ? (
          <span
            className={
              styles.trLabel + " " + styles.trShimmer + " " + (labelSwapPhase === "exit" ? styles.isExit : labelSwapPhase === "enter-start" ? styles.isEnterStart : "")
            }
          >
            {labelSwapText}
          </span>
        ) : (
          <span className={styles.trLabel}>{label}</span>
        )}
        {!live && (
          <svg className={styles.trChevron} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path
              d="m4.5 15.75 7.5-7.5 7.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <div className={styles.trCollapsible + (expanded ? "" : " " + styles.isCollapsed)}>
        <div className={styles.trInner}>
          <div
            ref={viewportRef}
            className={styles.trViewport + (open && !live ? " " + styles.isScroll : "")}
            onScroll={open && !live ? onScroll : undefined}
            style={
              live
                ? {
                    WebkitMaskImage: fade.bottom
                      ? "linear-gradient(to bottom, #000 calc(100% - 16px), transparent 100%)"
                      : "none",
                    maskImage: fade.bottom ? "linear-gradient(to bottom, #000 calc(100% - 16px), transparent 100%)" : "none",
                  }
                : undefined
            }
          >
            <div className={styles.trStream}>
              {visibleItems.map((item, i) =>
                item.kind === "sentence" ? (
                  <p key={i} className={styles.trSentence}>
                    {item.text}
                  </p>
                ) : (
                  // One shared row for every tool kind (ToolDetailRow,
                  // below) -- per explicit follow-up ("it should be the
                  // same to other states like Read file > or Write file >
                  // or Delete file >"), checked directly against Synara's
                  // own real source (git pull + a direct read of
                  // TimelineWorkEntryRow.tsx/ToolCallDetailsDialog.tsx):
                  // Synara renders every tool kind through one generic row
                  // + detail-dialog pair, branching only on which fields a
                  // given call actually has, not a bespoke component per
                  // tool. Same idea here -- ToolDetailRow handles Read/
                  // WebSearch/etc. the same way it handles Run, only the
                  // expanded body's own shape differs (a real code-snippet
                  // card for a command, plain monospace text otherwise).
                  item.detail ? (
                    <ToolDetailRow key={i} label={item.label} detail={item.detail} />
                  ) : (
                    <div key={i} className={styles.trToolRow}>
                      <span className={styles.trToolLabel}>{toolLabelText(item.label)}</span>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Generic noun for a tool's own collapsed label ("Run command", "Read
// file", "Search the web") -- real display-only vocabulary, same spirit as
// ChatPage.tsx's own TOOL_DISPLAY_LABELS (Read/Write/Edit/Run), not
// something Synara's own source dictated verbatim (its real labels come
// from upstream verb+target templates, e.g. "Read file app.ts", not a
// generic noun) -- kept here because collapsing to a truly generic label
// (no raw path/command shown until expanded) was the explicit, repeated
// ask this session, not just matching Synara's own choice of words.
// Tool names ("Run"/"Read"/...) double as logic keys throughout ChatPage, so
// they stay literal in data and are only translated here, at display time.
function toolLabelText(label: string): string {
  return i18n.exists(`tool.label.${label}`) ? i18n.t(`tool.label.${label}`) : label;
}

const TOOL_NOUNS: Record<string, string> = {
  Run: "command",
  Read: "file",
  WebSearch: "the web",
};

// One shared row for every tool kind (this file's own render loop, above,
// has the full reasoning -- confirmed directly against Synara's real
// source, one generic row + detail-dialog pair for every tool kind, not a
// bespoke component per type). Collapses to a generic "{Label} {noun}"
// label (falls back to just the label alone when no noun is mapped) with
// its own expand arrow; expanding reveals the real detail -- a proper code
// snippet (language label, copy button, a real shell prompt) for a Run
// command specifically, matching a real reference screenshot pasted
// directly ("Sorry this is the correct code snippet"), or the plain detail
// text (a path, a query) for everything else, no fabricated card for data
// that's just a single string.
function ToolDetailRow({ label, detail }: { label: string; detail: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const noun = TOOL_NOUNS[label] ? t(`tool.noun.${label}`) : undefined;
  return (
    <div className={styles.trRunGroup}>
      <button
        type="button"
        className={styles.trRunToggle}
        onClick={() => {
          // Real bug, confirmed directly ("the run command is snapping the
          // same way the parent was doing before") -- this nested toggle
          // grows/shrinks the content column exactly the way the parent
          // "Worked" disclosure's own toggle does; chat-scroll-suppress.ts's
          // own comment has the full reasoning for why this needs arming
          // here too, not just there.
          suppressAutoScroll();
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
      >
        <span className={styles.trToolLabel}>{toolLabelText(label)}</span>
        {noun && <span className={styles.trToolDetail}>{noun}</span>}
        <svg
          className={styles.trChevron}
          viewBox="0 0 24 24"
          width="12"
          height="12"
          aria-hidden="true"
          // Real bug, confirmed directly ("The run command arrows are
          // inverted, should be facing/mirror the other way like > and
          // not <"): the base path is an up-caret; -90deg turned it left
          // ("<"), not right (">"). 90deg (collapsed, points right) ->
          // 180deg (expanded, points down) matches the standard disclosure
          // convention this app's own outer "Worked" chevron uses (below).
          style={{ transform: open ? "rotate(180deg)" : "rotate(90deg)" }}
        >
          <path
            d="m4.5 15.75 7.5-7.5 7.5 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {/* Real bug, confirmed directly ("the run command subfolder collapse
          or expand is snapping and does not have the same transition as
          the father component"): `{open && ...}` mounted/unmounted the
          detail outright, with no transition at all -- the parent
          disclosure's own .trCollapsible (a grid-template-rows 1fr/0fr
          trick, further up) is what actually animates there. Same
          mechanism here instead of a second, snapping one. */}
      <div className={styles.trCollapsible + (open ? "" : " " + styles.isCollapsed)}>
        <div className={styles.trInner}>
          {label === "Run" ? <CommandSnippet command={detail} /> : <div className={styles.trToolDetailBody}>{detail}</div>}
        </div>
      </div>
    </div>
  );
}

function CommandSnippet({ command }: { command: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className={styles.snippet}>
      <div className={styles.snippetHead}>
        <span className={styles.snippetLang}>bash</span>
        <button type="button" className={styles.snippetIconButton} onClick={copy} aria-label={t("chat.copyCommand")}>
          {copied ? (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <rect x="9" y="9" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <div className={styles.snippetBody}>
        <span className={styles.snippetPrompt}>$</span>
        <span className={styles.snippetCommand}>{command}</span>
      </div>
    </div>
  );
}
