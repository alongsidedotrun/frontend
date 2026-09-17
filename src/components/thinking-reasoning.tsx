import { useEffect, useRef, useState } from "react";
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
  const items: ReasoningItem[] = [
    ...splitSentences(text).map((s): ReasoningItem => ({ kind: "sentence", text: s })),
    ...(toolLines ?? []).map((t): ReasoningItem => ({ kind: "tool", label: t.label, detail: t.detail })),
  ];
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
        aria-label="Toggle thought detail"
        onClick={!live ? onToggleOpen : undefined}
      >
        {live ? (
          <span className={styles.trLabel + " " + styles.trShimmer}>{label}</span>
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
                  // Coding variant's own row shape (label + monospace
                  // detail, no icon -- this app has no per-tool icon set)
                  // -- a real tool call this turn made, not prose.
                  <div key={i} className={styles.trToolRow}>
                    <span className={styles.trToolLabel}>{item.label}</span>
                    {item.detail && <span className={styles.trToolDetail}>{item.detail}</span>}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
