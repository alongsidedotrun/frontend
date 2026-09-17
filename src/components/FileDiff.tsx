import { useEffect, useState } from "react";
import { diffLines } from "diff";
import styles from "./FileDiff.module.css";

// Saved from aicss.dev's file-diff component (npx shadcn@latest add
// https://www.aicss.dev/r/file-diff.json) as a reference for a future chat
// file-diff feature -- not wired into ChatPage yet, no real diff data source
// behind it (ROWS below is the component's own static example).
type DiffRow = {
  old: number | null;
  cur: number | null;
  type: "ctx" | "add" | "del";
  text: string;
};

const ROWS: DiffRow[] = [
  { old: 12, cur: 12, type: "ctx", text: "export function getToken() {" },
  { old: 13, cur: null, type: "del", text: "  return localStorage.token;" },
  { old: null, cur: 13, type: "add", text: '  const t = cookies.get("session");' },
  { old: null, cur: 14, type: "add", text: '  if (!t) throw new Error("no session");' },
  { old: null, cur: 15, type: "add", text: "  return t;" },
  { old: 14, cur: 16, type: "ctx", text: "}" },
];

export type { DiffRow };

// Factored out of ChatPage.tsx's own buildFileDiffRows (still there --
// converts a tool_use's own content/old_string+new_string into this same
// shape) so AntigravityFileDiff (below) can produce identical DiffRow[]
// from real file content fetched off disk instead, since write_to_file's
// own tool_use never carries the file's content, only its path. One real
// line-diff implementation, not two.
export function diffToRows(oldText: string, newText: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine = 1;
  let newLine = 1;
  for (const part of diffLines(oldText, newText)) {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    for (const text of lines) {
      if (part.added) {
        rows.push({ old: null, cur: newLine++, type: "add", text });
      } else if (part.removed) {
        rows.push({ old: oldLine++, cur: null, type: "del", text });
      } else {
        rows.push({ old: oldLine++, cur: newLine++, type: "ctx", text });
      }
    }
  }
  return rows;
}

function DiffIcon() {
  return (
    <svg className={styles.diffIcon} viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Real bug, confirmed directly via screenshot ("Claude now do a huge file
// diff we should do a small one where we can expand it like a drawer"): a
// large real diff (the screenshot's own +52/-0 Founders.md) used to render
// every single row inline with no cap at all -- fine for a small edit, a
// wall of scroll for a genuinely large file. Collapsed by default past
// COLLAPSE_THRESHOLD real rows, with a real "Show N more lines" button
// (not a fixed-height clip -- an explicit count of what's actually hidden)
// that reveals the rest inline. Deliberately independent of the card's own
// header click (which still opens the real editor, issue #288 phase 1's
// own contract, unchanged) -- this is a second, separate expand affordance
// for the diff body itself.
const COLLAPSE_THRESHOLD = 12;

function DiffLines({ rows }: { rows: DiffRow[] }) {
  const [expanded, setExpanded] = useState(rows.length <= COLLAPSE_THRESHOLD);
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = rows.length - visibleRows.length;
  return (
    <div className={styles.diffBody}>
      <div className={styles.diffLines}>
        {visibleRows.map((r, i) => (
          <div key={i} className={`${styles.diffRow} ${styles[r.type]}`}>
            <span className={`${styles.ln} ${styles.old}`}>{r.old ?? ""}</span>
            <span className={`${styles.ln} ${styles.new}`}>{r.cur ?? ""}</span>
            <span className={styles.sign}>{r.type === "add" ? "+" : r.type === "del" ? "-" : ""}</span>
            <code>{r.text}</code>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button type="button" className={styles.diffShowMore} onClick={() => setExpanded(true)}>
          Show {hiddenCount} more line{hiddenCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

// onExpand (issue #288, phase 1) -- opens the real right-side editor panel
// for this exact file (AppLayout.tsx's own rightPanelPath state), per that
// issue's own explicit "manual expand only" direction: this card always
// renders inline as before; expanding is a deliberate click, never
// automatic just because a file was touched.
export function FileDiff({
  file = "src/auth.ts",
  rows = ROWS,
  onExpand,
}: {
  file?: string;
  rows?: DiffRow[];
  onExpand?: () => void;
}) {
  const added = rows.filter((r) => r.type === "add").length;
  const removed = rows.filter((r) => r.type === "del").length;
  return (
    <div className={styles.diff}>
      <button
        type="button"
        className={styles.diffHead}
        onClick={onExpand}
        disabled={!onExpand}
        style={{ width: "100%", border: 0, background: "transparent", cursor: onExpand ? "pointer" : "default" }}
      >
        <span className={styles.diffFileWrap}>
          <DiffIcon />
          <span className={styles.diffFile}>{file}</span>
        </span>
        <span className={styles.diffStat}>
          <span className={styles.add}>+{added}</span>
          <span className={styles.del}>-{removed}</span>
        </span>
      </button>
      <DiffLines rows={rows} />
    </div>
  );
}

// One file this group touched -- name/path are the real filename/full path
// (FileDiff's own display convention: summarizeToolInput's result).
// syncRows is real content already available from the tool_use's own input
// (Claude/Codex's Write/Edit both carry it) -- null means no such content
// exists (Antigravity's write_to_file, confirmed this session to only ever
// carry the path), in which case ResolvedFile (below) fetches the file's
// current on-disk content instead and diffs against that.
export type FileDiffGroupFile = { name: string; path: string; syncRows: DiffRow[] | null };

// Antigravity's own write_to_file tool_use never carries the file's real
// content (only TargetFile, the path) -- confirmed directly this session.
// Since write_to_file always replaces a file's entire contents (same real
// semantics as Claude's own Write), the file's current on-disk content
// *is* the "new text" a diff needs -- fetched here via the same GET /files
// endpoint FileEditorPanel/ChatFileListPanel (right-panel.tsx) already use,
// no backend change needed. oldText is always "" (an all-green diff, same
// as a fresh Claude Write already renders) since there's no prior snapshot
// to diff against. Passing an empty path is this hook's own "don't fetch"
// signal, for a file that already has syncRows and needs no disk read at
// all -- keeps this callable unconditionally (real rule-of-hooks
// requirement) from ResolvedFile below regardless of which path a given
// file takes.
function useDiskDiffRows(path: string): DiffRow[] | null {
  const [rows, setRows] = useState<DiffRow[] | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setRows(null);
    fetch(`/files?path=${encodeURIComponent(path)}`)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled || text === null) return;
        setRows(diffToRows("", text));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);
  return rows;
}

// One file's own row inside a FileDiffGroup -- its own small component
// (not inlined in FileDiffGroup's own render) specifically so
// useDiskDiffRows can be called unconditionally per file, regardless of
// whether this particular file needs it. Its own diff body is always
// shown once visible, never a separate per-file toggle -- same as the
// plain FileDiff's own original behavior (its diff body was never
// collapsible either); the header click opens the real file instead
// (onExpand, same "issue #288, phase 1" contract FileDiff already had).
function ResolvedFile({
  file,
  bare,
  // Whether this file's own row/body should actually render -- kept
  // separate from resolving its rows (below), which needs to run
  // regardless of whether the *group's* own header is currently
  // expanded, so a real aggregate total (FileDiffGroup's own header) is
  // available even while collapsed, matching the reference screenshot's
  // own "Edited 4 files +38 -80" shown collapsed.
  visible,
  onExpand,
  onResolved,
}: {
  file: FileDiffGroupFile;
  // No header row at all when this is the only file in its group -- the
  // group's own header already shows this exact filename (FileDiffGroup's
  // own comment has the reasoning), so this would just repeat it.
  bare: boolean;
  visible: boolean;
  onExpand?: () => void;
  // Reports this file's own real +/- counts up once resolved, so
  // FileDiffGroup's own header can show a real aggregate total rather than
  // needing to duplicate the diffing/counting itself.
  onResolved: (path: string, added: number, removed: number) => void;
}) {
  const diskRows = useDiskDiffRows(file.syncRows ? "" : file.path);
  const rows = file.syncRows ?? diskRows;
  const added = rows?.filter((r) => r.type === "add").length ?? 0;
  const removed = rows?.filter((r) => r.type === "del").length ?? 0;
  useEffect(() => {
    if (rows) onResolved(file.path, added, removed);
    // onResolved is a fresh closure every FileDiffGroup render -- only
    // file.path/added/removed identify a real change worth reporting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, added, removed, !!rows]);
  if (!rows || !visible) return null;
  return (
    <div>
      {!bare && (
        <button
          type="button"
          className={styles.diffHead}
          onClick={onExpand}
          disabled={!onExpand}
          style={{ width: "100%", border: 0, background: "transparent", cursor: onExpand ? "pointer" : "default" }}
        >
          <span className={styles.diffFileWrap}>
            <DiffIcon />
            <span className={styles.diffFile}>{file.name}</span>
          </span>
          <span className={styles.diffStat}>
            <span className={styles.add}>+{added}</span>
            <span className={styles.del}>-{removed}</span>
          </span>
        </button>
      )}
      <DiffLines rows={rows} />
    </div>
  );
}

// Per explicit request ("we should be using the same component for all"),
// replaces per-file FileDiff cards with one collapsed summary once ChatPage
// groups consecutive same-kind Write/Edit tool rows -- "New N files" or
// "Edited N files" (kind decided by ChatPage's own grouping: Write has no
// reliable "did this already exist" signal in the data this app actually
// has, so it's always New; Edit inherently requires content that already
// existed, so it's always Edited), matching the reference screenshot's own
// "Edited 4 files +38 -80" card. A single-file group still renders through
// this same component (per explicit request, not a separate code path) --
// the header just shows that one real filename instead of a "1 file" count,
// same as the plain FileDiff above already did. Per-file totals (+/-) are
// computed from whatever's actually resolved so far -- a still-loading
// Antigravity file (ResolvedFile's own disk fetch) just contributes 0 to
// the running total until it lands, rather than blocking the whole card.
export function FileDiffGroup({
  kind,
  files,
  onExpandFile,
}: {
  kind: "New" | "Edited";
  files: FileDiffGroupFile[];
  // Opens a given file in the real right-side editor panel -- same
  // "issue #288, phase 1" contract the plain FileDiff already had.
  onExpandFile?: (path: string) => void;
}) {
  const single = files.length === 1;
  const [open, setOpen] = useState(single);
  // Keyed by path, not summed inline -- a file's own count can arrive
  // (or change, if its rows resolve later than another's) independently,
  // and this needs the *latest* value per file, not an accumulating sum
  // that would double-count on re-resolution.
  const [resolvedCounts, setResolvedCounts] = useState<Record<string, { added: number; removed: number }>>({});
  const totals = Object.values(resolvedCounts).reduce(
    (acc, c) => ({ added: acc.added + c.added, removed: acc.removed + c.removed }),
    { added: 0, removed: 0 }
  );
  const headerLabel = single ? files[0].name : `${kind} ${files.length} files`;
  // A single file has nothing to expand/collapse (its diff is always
  // shown, matching FileDiff's own original behavior) -- the header
  // itself is this one file's own onExpand trigger instead. A real group
  // header toggles the group open/closed.
  const headerOnClick = single ? (onExpandFile ? () => onExpandFile(files[0].path) : undefined) : () => setOpen((prev) => !prev);
  return (
    <div className={styles.diff}>
      <button
        type="button"
        className={styles.diffHead}
        onClick={headerOnClick}
        disabled={single && !onExpandFile}
        style={{ width: "100%", border: 0, background: "transparent", cursor: headerOnClick ? "pointer" : "default" }}
      >
        <span className={styles.diffFileWrap}>
          <DiffIcon />
          <span className={styles.diffFile}>{headerLabel}</span>
        </span>
        <span className={styles.diffStat}>
          <span className={styles.add}>+{totals.added}</span>
          <span className={styles.del}>-{totals.removed}</span>
        </span>
      </button>
      {/* Always mounted, regardless of `open` -- each file's own diff
          still needs to resolve (real content or a disk fetch) so the
          header's own aggregate total above is accurate even while
          collapsed; `visible` (not conditional mounting) controls
          whether a file actually renders its own row/body. */}
      {files.map((f) => (
        <ResolvedFile
          key={f.path}
          file={f}
          bare={single}
          visible={open}
          onExpand={onExpandFile ? () => onExpandFile(f.path) : undefined}
          onResolved={(path, added, removed) =>
            setResolvedCounts((prev) =>
              prev[path]?.added === added && prev[path]?.removed === removed ? prev : { ...prev, [path]: { added, removed } }
            )
          }
        />
      ))}
    </div>
  );
}
