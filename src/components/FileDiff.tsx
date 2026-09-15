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
          <span className={styles.diffFile}>{file}</span>
        </span>
        <span className={styles.diffStat}>
          <span className={styles.add}>+{added}</span>
          <span className={styles.del}>-{removed}</span>
        </span>
      </button>
      <div className={styles.diffBody}>
        <div className={styles.diffLines}>
          {rows.map((r, i) => (
            <div key={i} className={`${styles.diffRow} ${styles[r.type]}`}>
              <span className={`${styles.ln} ${styles.old}`}>{r.old ?? ""}</span>
              <span className={`${styles.ln} ${styles.new}`}>{r.cur ?? ""}</span>
              <span className={styles.sign}>{r.type === "add" ? "+" : r.type === "del" ? "-" : ""}</span>
              <code>{r.text}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
