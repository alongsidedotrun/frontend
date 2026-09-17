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
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SENTENCE_STAGGER_MS = 70;

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
  // Real tool-call one-liners for this turn ("Bash: sed -n '1,160p'
  // Internet.md"), ChatPage.tsx's own toolCallLines comment has the full
  // reasoning. Rendered as literal lines, appended after text's own
  // sentences -- never re-split, since a path like "Internet.md" isn't a
  // sentence boundary the way splitSentences means it.
  toolLines?: string[];
  // Still receiving live updates this turn -- the reasoning stays open
  // and unclickable (same as the reference's own "while thinking the
  // reasoning is always open"), folding into a clickable summary once
  // the turn settles.
  live: boolean;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const sentences = [...splitSentences(text), ...(toolLines ?? [])];
  const [revealedCount, setRevealedCount] = useState(0);
  const revealedTextRef = useRef("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: true });

  // Re-staggers only when genuinely new content has arrived (the text
  // grew), not on every re-render/toggle -- reopening an already-settled
  // reasoning block shouldn't replay the entrance animation.
  useEffect(() => {
    if (text === revealedTextRef.current) return;
    revealedTextRef.current = text;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setRevealedCount(sentences.length);
      return;
    }
    setRevealedCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    sentences.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), i * SENTENCE_STAGGER_MS));
    });
    return () => timers.forEach(clearTimeout);
    // sentences is derived from text every render -- only text itself
    // (checked above) should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const expanded = live || open;
  const visibleSentences = sentences.slice(0, revealedCount);

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
              {visibleSentences.map((line, i) => (
                <p
                  key={i}
                  className={
                    // Tool-call lines (appended after any real prose
                    // sentences, see `sentences` above) render monospace --
                    // they're literal commands/paths, not prose, and should
                    // read the way a Bash row already did before this was
                    // folded into the same drawer.
                    styles.trSentence + (toolLines && i >= sentences.length - toolLines.length ? " " + styles.trToolLine : "")
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
