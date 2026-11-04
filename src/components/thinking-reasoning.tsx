import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Brain, ChevronRight, FilePen, FilePlus, FileText, Globe, Terminal, Wrench } from "lucide-react";
import { workCounts, workSteps, type StepNote, type ToolLine, type WorkStep } from "@/lib/work-steps";
import { suppressAutoScroll } from "@/lib/chat-scroll-suppress";
import { useTextSwap } from "@/lib/use-text-swap";
import { TypedText } from "@/components/streaming-text";
import { parseInlineMarkdown, type InlineSegment } from "@/lib/inline-markdown";
import styles from "./thinking-reasoning.module.css";

/** #563: whether a collapsible's content should be on the page. A closed block kept every step
 * (and every command inside it) on the page, only hidden: one closed "Worked for 12m" was 1,470
 * elements. Now it's added when the block opens and removed once the closing transition (320ms,
 * thinking-reasoning.module.css) has finished. */
export function useMountedWhileOpen(open: boolean): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setMounted(false), 360);
    return () => clearTimeout(timer);
  }, [open]);
  return open || mounted;
}

// The Working / "Worked for Ns" block: a turn's work as a column of steps joined by a line (the
// thinking-steps pattern, fluidfunctionalism.com/docs/thinking-steps, MIT), in the order it
// happened -- its thinking, the notes it wrote along the way, its commands and reads, and its file
// edits with their diffs. While the turn runs the steps stream in, open, following the newest; when
// it ends the block folds into its header, which opens it again (aicss.dev's thinking-reasoning:
// a shimmering label that folds into a summary). Calls of the same kind in a row fold into one step
// that opens a list ("Read 6 files"). Nothing is staged: a step shows the moment its data exists.

// "Worked for 5s" -> the verb, then the rest (shown lighter). A label with no space stays whole.
function labelParts(label: string): [string, string] {
  const at = label.indexOf(" ");
  return at < 0 ? [label, ""] : [label.slice(0, at), label.slice(at)];
}

function TwoToneLabel({ text }: { text: string }) {
  const [verb, rest] = labelParts(text);
  return (
    <>
      {verb}
      {rest && <span className={styles.trLabelRest}>{rest}</span>}
    </>
  );
}

const ICON_PROPS = { size: 14, strokeWidth: 1.6, "aria-hidden": true } as const;

function StepIcon({ step }: { step: WorkStep }) {
  if (step.kind === "thinking") return <Brain {...ICON_PROPS} />;
  if (step.kind === "note") return <span className={styles.stepDot} />;
  if (step.kind === "files") return step.label === "Write" ? <FilePlus {...ICON_PROPS} /> : <FilePen {...ICON_PROPS} />;
  if (step.label === "Run") return <Terminal {...ICON_PROPS} />;
  if (step.label === "Read") return <FileText {...ICON_PROPS} />;
  if (step.label === "WebSearch") return <Globe {...ICON_PROPS} />;
  return <Wrench {...ICON_PROPS} />;
}

// A note's `code` spans, drawn as code rather than with their backticks.
function renderInline(segments: InlineSegment[]): ReactNode[] {
  return segments.map((seg, i) => {
    if (seg.kind === "text") return seg.text;
    if (seg.kind === "code") return <code key={i}>{seg.text}</code>;
    if (seg.kind === "bold") return <strong key={i} className={styles.stepStrong}>{renderInline(seg.children)}</strong>;
    if (seg.kind === "italic") return <em key={i}>{renderInline(seg.children)}</em>;
    return (
      <a key={i} href={seg.href} target="_blank" rel="noreferrer" className={styles.stepLink}>
        {seg.text}
      </a>
    );
  });
}

// A note's inline markdown (bold, italic, code, links, bullets), styled in place -- see inline-markdown.ts.
function InlineCode({ text }: { text: string }) {
  return <>{renderInline(parseInlineMarkdown(text))}</>;
}

const baseName = (path: string) => path.split("/").filter(Boolean).pop() ?? path;

// A tool step's label: "Ran a command", "Read 6 files", "Searched the web".
function toolStepLabel(label: string, lines: ToolLine[]): string {
  const count = lines.length;
  if (label === "Run") return count === 1 ? i18n.t("work.ranCommand") : i18n.t("work.ranCommands", { count });
  if (label === "Read") return count === 1 && lines[0].detail ? i18n.t("work.readFile", { name: baseName(lines[0].detail) }) : i18n.t("work.readFiles", { count });
  if (label === "WebSearch") return count === 1 ? i18n.t("work.searched") : i18n.t("work.searchedTimes", { count });
  const name = toolLabelText(label);
  return count === 1 ? name : `${name} ×${count}`;
}

// "3 files changed, 5 commands" after "Worked for 2m", so the folded block says what the turn did.
function countsText(lines: ToolLine[]): string {
  const c = workCounts(lines);
  const parts: string[] = [];
  if (c.files) parts.push(i18n.t(c.files === 1 ? "work.count.file" : "work.count.files", { count: c.files }));
  if (c.commands) parts.push(i18n.t(c.commands === 1 ? "work.count.command" : "work.count.commands", { count: c.commands }));
  if (c.searches) parts.push(i18n.t(c.searches === 1 ? "work.count.search" : "work.count.searches", { count: c.searches }));
  if (!parts.length && c.reads) parts.push(i18n.t(c.reads === 1 ? "work.count.read" : "work.count.reads", { count: c.reads }));
  return parts.join(", ");
}

function ToolStep({ step, active }: { step: Extract<WorkStep, { kind: "tools" }>; active: boolean }) {
  const [open, setOpen] = useState(false);
  const mounted = useMountedWhileOpen(open);
  const single = step.lines.length === 1 ? step.lines[0] : null;
  const label = toolStepLabel(step.label, step.lines);
  // A single read or search shows what it was right there; it has nothing more to open.
  if (single && !single.detail) return <span className={styles.stepLabel + (active ? " " + styles.stepShimmer : "")}>{label}</span>;
  if (single && step.label !== "Run") {
    return (
      <span className={styles.stepLabel + (active ? " " + styles.stepShimmer : "")}>
        {step.label === "Read" ? label : `${label} `}
        {step.label !== "Read" && <span className={styles.stepTarget}>{single.detail}</span>}
      </span>
    );
  }
  return (
    <div className={styles.stepDetails}>
      <button
        type="button"
        className={styles.stepToggle}
        aria-expanded={open}
        onClick={(event) => {
          suppressAutoScroll(event.currentTarget.parentElement, !open);
          setOpen((v) => !v);
        }}
      >
        <span className={styles.stepLabel + (active ? " " + styles.stepShimmer : "")}>{label}</span>
        <ChevronRight size={12} strokeWidth={1.8} aria-hidden className={styles.stepChevron} />
      </button>
      <div className={styles.trCollapsible + (open ? "" : " " + styles.isCollapsed)}>
        <div className={styles.trInner}>
          {mounted && (
            <div className={styles.stepList}>
              {step.label === "Run"
                ? step.lines.map((line, i) => (line.detail ? <CommandSnippet key={i} command={line.detail} /> : null))
                : step.lines.map((line, i) => (
                    <span key={i} className={styles.stepListItem}>
                      {line.detail ?? toolLabelText(line.label)}
                    </span>
                  ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThinkingReasoning({
  label,
  title,
  duration,
  labelSuffix,
  text,
  toolLines,
  notes,
  renderFiles,
  live,
  open,
  onToggleOpen,
}: {
  label: string;
  // The agent's name for the turn's work ("Fixed the login redirect"); the folded header leads with
  // it, then how long it took. Without one the header is "Worked for 9s · 2 files changed".
  title?: string;
  duration?: string;
  // Live elapsed time; shown after the label without replaying its text swap (#551).
  labelSuffix?: string;
  // Claude's thinking-block text, when the turn had one.
  text: string;
  // The turn's tool calls in order (ChatPage.tsx's toolCallLines). A file edit's line carries its
  // chat row (rowId), whose diff card renderFiles draws inside the step.
  toolLines?: ToolLine[];
  // #557: text the turn wrote along the way, shown as steps between its tool calls.
  // `active` marks the step being written now.
  notes?: StepNote[];
  renderFiles?: (rowIds: string[]) => ReactNode;
  live: boolean;
  open: boolean;
  onToggleOpen: () => void;
}) {
  useTranslation();
  const lines = toolLines ?? [];
  const steps = workSteps(text, lines, notes ?? []);
  const { displayText: labelSwapText, phase: labelSwapPhase } = useTextSwap(label);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const stepsMounted = useMountedWhileOpen(open);
  const counts = live ? "" : countsText(lines);

  // The steps sit in a box of fixed height that scrolls inside, with a fade at whichever edge has
  // more to see. While the turn runs it follows the newest step, unless the reader scrolled up.
  const followRef = useRef(true);
  const measure = () => {
    const el = viewportRef.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setFade((f) => (f.top === top && f.bottom === bottom ? f : { top, bottom }));
  };
  const onScroll = () => {
    const el = viewportRef.current;
    if (el) followRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    measure();
  };
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return;
    const follow = () => {
      if (live && followRef.current) el.scrollTop = el.scrollHeight;
      measure();
    };
    follow();
    // Steps grow as they type in, and a command or a diff opens inside one.
    const ro = new ResizeObserver(follow);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, live, steps.length]);
  useEffect(() => {
    if (!open) followRef.current = true;
  }, [open]);
  const edgeFade = `linear-gradient(to bottom, ${fade.top ? "transparent 0, #000 24px" : "#000 0"}, ${fade.bottom ? "#000 calc(100% - 24px), transparent 100%" : "#000 100%"})`;
  const lastIndex = steps.length - 1;

  return (
    <div className={live ? `${styles.tr} ${styles.isLive}` : styles.tr}>
      <button
        type="button"
        className={styles.trHeader + " " + styles.isClickable}
        aria-expanded={open}
        aria-label={i18n.t("chat.toggleThought")}
        onClick={onToggleOpen}
      >
        {live ? (
          <span
            className={
              styles.trLabel + " " + styles.trShimmer + " " + (labelSwapPhase === "exit" ? styles.isExit : labelSwapPhase === "enter-start" ? styles.isEnterStart : "")
            }
          >
            <TwoToneLabel text={labelSuffix ? `${labelSwapText} ${labelSuffix}` : labelSwapText} />
          </span>
        ) : title ? (
          <span className={styles.trLabel} title={counts ? `${label} · ${counts}` : label}>
            {title}
            {duration && <span className={styles.trLabelRest}>{` · ${duration}`}</span>}
          </span>
        ) : (
          <span className={styles.trLabel}>
            <TwoToneLabel text={label} />
            {counts && <span className={styles.trLabelRest}>{` · ${counts}`}</span>}
          </span>
        )}
        <ChevronRight size={13} strokeWidth={1.8} aria-hidden className={styles.trChevron} />
      </button>
      <div className={styles.trCollapsible + (open ? "" : " " + styles.isCollapsed)}>
        <div className={styles.trInner}>
          <div ref={viewportRef} className={styles.trViewport} onScroll={onScroll} style={{ WebkitMaskImage: edgeFade, maskImage: edgeFade }}>
            <ol className={styles.steps}>
              {(stepsMounted ? steps : []).map((step, i) => {
                const active = live && i === lastIndex;
                return (
                  <li key={i} className={styles.step + (live ? " " + styles.stepIn : "")}>
                    <div className={styles.stepRail}>
                      <span className={styles.stepIcon}>
                        <StepIcon step={step} />
                      </span>
                      {i < lastIndex && <span className={styles.stepLine} />}
                    </div>
                    <div className={styles.stepBody}>
                      {step.kind === "thinking" ? (
                        <>
                          <span className={styles.stepLabel + (active ? " " + styles.stepShimmer : "")}>
                            {i18n.t(active ? "chat.phase.thinking" : "work.thought")}
                          </span>
                          <p className={styles.stepText}>{live ? <TypedText text={step.text} animate /> : step.text}</p>
                        </>
                      ) : step.kind === "note" ? (
                        // A note is the turn's own words: plain, in full, never cut to a line. The one
                        // being written now reads at full strength.
                        <p className={styles.stepText + (step.active ? " " + styles.stepTextActive : "")}>
                          {live ? <TypedText text={step.text} animate render={(shown) => <InlineCode text={shown} />} /> : <InlineCode text={step.text} />}
                        </p>
                      ) : step.kind === "files" ? (
                        <div className={styles.stepFiles}>{renderFiles?.(step.rowIds)}</div>
                      ) : (
                        <ToolStep step={step} active={active} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tool names ("Run"/"Read"/...) double as logic keys throughout ChatPage, so they stay literal in
// data and are only translated here, at display time.
function toolLabelText(label: string): string {
  return i18n.exists(`tool.label.${label}`) ? i18n.t(`tool.label.${label}`) : label;
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
