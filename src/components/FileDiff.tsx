import { useTranslation } from "react-i18next";
import { useEffect, useState, type MouseEvent } from "react";
import { diffLines } from "diff";
import { FileExtensionBadge, stripExtension } from "@/components/file-extension-badge";
import { FilePlusIcon } from "@/components/icons/untitled-ui";
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

// Real bug, confirmed directly via screenshot, through two corrections:
// "Claude now do a huge file diff we should do a small one where we can
// expand it like a drawer" -> "we should not do show more lines at the
// bottom we should do a collapse and expand arrow at the top right after
// the lines" -> "we should a snip like 10 lines of the code diff as well".
// A real diff (the screenshot's own +52/-0 Founders.md) used to render
// every single row inline with no way to collapse it at all. Every diff
// body now shows at most SNIPPET_LINES rows by default (a real preview, not
// a placeholder), with a chevron next to the +/- stat (DiffChevron, below)
// that reveals the rest -- only rendered at all when there's more than the
// snippet to reveal. Separate from the header's own click-to-open-real-
// editor area (issue #288 phase 1's own contract, unchanged).
const SNIPPET_LINES = 3;

function DiffChevron({ open, onClick }: { open: boolean; onClick: (e: MouseEvent) => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className={styles.diffChevron} onClick={onClick} aria-expanded={open} aria-label={t("chat.toggleDiff")}>
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path
          d="m6 9 6 6 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transformOrigin: "center", transition: "transform 180ms ease-out" }}
        />
      </svg>
    </button>
  );
}

function DiffLines({ rows }: { rows: DiffRow[] }) {
  return (
    <div className={styles.diffBody}>
      <div className={styles.diffLines}>
        {rows.map((r, i) => (
          <div key={i} className={`${styles.diffRow} ${styles[r.type]}`}>
            {/* Real bug, confirmed directly ("there's a gap in between the
                numbers and the left border" / "between the left and the
                number of the lines") -- narrowing the old/new columns
                (an earlier fix) only shrank the gap, it didn't remove it:
                a pure add or delete (the only kind this app's own diffs
                have ever shown -- a brand-new file, or a full-content
                rewrite) leaves the OTHER side's own column genuinely
                empty on every single row, and that empty column sits
                leftmost, ahead of the real number. One column instead,
                showing whichever side actually has a number for this
                row -- real GitHub-style side-by-side old+new numbers were
                never actually in use here. */}
            <span className={styles.ln}>{r.cur ?? r.old ?? ""}</span>
            <span className={styles.sign}>{r.type === "add" ? "+" : r.type === "del" ? "-" : ""}</span>
            <code>{r.text}</code>
          </div>
        ))}
      </div>
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
  const [open, setOpen] = useState(false);
  const hasMore = rows.length > SNIPPET_LINES;
  return (
    <div className={styles.diff}>
      <div className={styles.diffHead}>
        <button
          type="button"
          className={styles.diffHeadMain}
          onClick={onExpand}
          disabled={!onExpand}
          style={{ cursor: onExpand ? "pointer" : "default" }}
        >
          <span className={styles.diffFileWrap}>
            <FileExtensionBadge name={file} />
            <span className={styles.diffFile}>{stripExtension(file)}</span>
          </span>
        </button>
        <span className={styles.diffStat}>
          <span className={styles.add}>+{added}</span>
          <span className={styles.del}>-{removed}</span>
        </span>
        {hasMore && (
          <DiffChevron
            open={open}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
          />
        )}
      </div>
      <DiffLines rows={open ? rows : rows.slice(0, SNIPPET_LINES)} />
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
  nested,
  isLast,
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
  // True for a file that's one of SEVERAL in its group -- its own header
  // sits inset in the group's body (a lighter style, no negative margins)
  // instead of spanning edge-to-edge the way the single-file delegated
  // case's header does (that one effectively becomes the whole card's own
  // top, styles.diffHead's own negative-margin trick).
  nested?: boolean;
  // True only for the actual last file in a multi-file group -- used, with
  // `open` below, to cancel the outer card's own bottom padding when this
  // file is both last AND rendering no body (diffLastCollapsed's own
  // comment has the full reasoning).
  isLast?: boolean;
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
  // Real bug, confirmed directly via screenshot ("New 3 files... gave me
  // one with the same but broken", a real Antigravity Plan-mode turn that
  // wrote three genuinely different files, each shown in full with no way
  // to tell them apart): this used to skip both its own header (a `bare`
  // prop, now removed entirely) AND the snippet limit for any file inside
  // a MULTI-file group -- only a single-file group's own delegated
  // ResolvedFile got a real header/chevron/snippet. Not a provider-
  // specific gap (this code has no provider branches at all) -- Claude or
  // Codex writing more than one file in a turn hit the exact same thing,
  // it just hadn't been reported yet. Every file in a group now gets its
  // own real header (name + stat) and its own independent snippet/expand,
  // whether it's the only file in its group or one of several.
  const [open, setOpen] = useState(false);
  // Real bug, confirmed directly ("when we have multiple files, we should
  // not show the 3 quick snippets, it should be fully collapsed"): a
  // nested file (one of several in a group) now shows NOTHING at all by
  // default, not a 3-line preview -- the group's own header already gives
  // an aggregate sense of what changed; a single-file group still shows
  // its real 3-line snippet, unaffected. hasMore reflects that: a nested
  // file needs its own chevron the moment it has ANY rows to reveal
  // (there's nothing showing to already account for), not just past
  // SNIPPET_LINES.
  const hasMore = nested ? (rows?.length ?? 0) > 0 : (rows?.length ?? 0) > SNIPPET_LINES;
  useEffect(() => {
    if (rows) onResolved(file.path, added, removed);
    // onResolved is a fresh closure every FileDiffGroup render -- only
    // file.path/added/removed identify a real change worth reporting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, added, removed, !!rows]);
  if (!rows || !visible) return null;
  const wrapperClass = nested
    ? `${styles.diffNestedFile}${isLast && !open ? ` ${styles.diffLastCollapsed}` : ""}`
    : undefined;
  return (
    <div className={wrapperClass}>
      <div className={nested ? styles.diffSubHead : styles.diffHead}>
        <button
          type="button"
          className={styles.diffHeadMain}
          onClick={onExpand}
          disabled={!onExpand}
          style={{ cursor: onExpand ? "pointer" : "default" }}
        >
          <span className={styles.diffFileWrap}>
            <FileExtensionBadge name={file.name} />
            <span className={styles.diffFile}>{stripExtension(file.name)}</span>
          </span>
        </button>
        <span className={styles.diffStat}>
          <span className={styles.add}>+{added}</span>
          <span className={styles.del}>-{removed}</span>
        </span>
        {hasMore && (
          <DiffChevron
            open={open}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
          />
        )}
      </div>
      {open ? <DiffLines rows={rows} /> : !nested && <DiffLines rows={rows.slice(0, SNIPPET_LINES)} />}
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
  const { t } = useTranslation();
  const single = files.length === 1;
  const [open, setOpen] = useState(true);
  // Keyed by path, not summed inline -- a file's own count can arrive
  // (or change, if its rows resolve later than another's) independently,
  // and this needs the *latest* value per file, not an accumulating sum
  // that would double-count on re-resolution.
  const [resolvedCounts, setResolvedCounts] = useState<Record<string, { added: number; removed: number }>>({});
  const onResolved = (path: string, added: number, removed: number) =>
    setResolvedCounts((prev) =>
      prev[path]?.added === added && prev[path]?.removed === removed ? prev : { ...prev, [path]: { added, removed } }
    );
  // A single file delegates its ENTIRE header -- including its own real
  // per-file collapse/expand chevron (ResolvedFile's own comment has the
  // full reasoning, added per explicit follow-up: "we should do a collapse
  // and expand arrow at the top right after the lines", not a bottom
  // "show more" button) -- to ResolvedFile itself instead of this
  // component rendering a second, redundant header for the same one file.
  if (single) {
    return (
      <div className={styles.diff}>
        <ResolvedFile
          file={files[0]}
          visible
          onExpand={onExpandFile ? () => onExpandFile(files[0].path) : undefined}
          onResolved={onResolved}
        />
      </div>
    );
  }
  const totals = Object.values(resolvedCounts).reduce(
    (acc, c) => ({ added: acc.added + c.added, removed: acc.removed + c.removed }),
    { added: 0, removed: 0 }
  );
  return (
    <div className={styles.diff}>
      <div className={styles.diffHead}>
        <button type="button" className={styles.diffHeadMain} onClick={() => setOpen((prev) => !prev)}>
          <span className={styles.diffFileWrap}>
            {/* FilePlusIcon + "Created N new files" for a New group only,
                per explicit request ("for the New 3 files that should be
                file-plus-2 icon and Created 3 new files") -- Edited keeps
                its own existing icon/label, not part of that ask. */}
            {kind === "New" ? <FilePlusIcon className={styles.diffIcon} /> : <DiffIcon />}
            <span className={styles.diffFile}>
              {kind === "New" ? t("chat.diff.created", { count: files.length }) : t("chat.diff.edited", { count: files.length })}
            </span>
          </span>
        </button>
        <span className={styles.diffStat}>
          <span className={styles.add}>+{totals.added}</span>
          <span className={styles.del}>-{totals.removed}</span>
        </span>
        <DiffChevron
          open={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
        />
      </div>
      {/* Always mounted, regardless of `open` -- each file's own diff
          still needs to resolve (real content or a disk fetch) so the
          header's own aggregate total above is accurate even while
          collapsed; `visible` (not conditional mounting) controls
          whether a file actually renders its own row/body. */}
      {files.map((f, index) => (
        <ResolvedFile
          key={f.path}
          file={f}
          nested
          isLast={index === files.length - 1}
          visible={open}
          onExpand={onExpandFile ? () => onExpandFile(f.path) : undefined}
          onResolved={onResolved}
        />
      ))}
    </div>
  );
}
