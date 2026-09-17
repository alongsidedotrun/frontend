import { useEffect, useRef, useState, type ReactNode } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { Plate, usePlateEditor } from "platejs/react";
import { EditorKit } from "@/components/editor/editor-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { FixedToolbarButtons } from "@/components/ui/fixed-toolbar-buttons";
import { XIcon, File02Icon, ChevronLeftIcon, ChevronRightIcon, FolderIcon, TerminalIcon, DotsVerticalIcon } from "@/components/icons/untitled-ui";
import { Button } from "@/components/ui/button";
import { LibraryFileNameCell } from "@/components/library-file-row";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
} from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { MoreTrigger } from "@/components/ui/more-trigger";

// Real Plate.js block editor -- replaces BlockNote (issue #299 originally
// built this on BlockNote; migrated per explicit request, "give me other
// alternatives to blocknote, there's a lot to fix and i want something
// ready to use" -- BlockNote's packaged Mantine/Emotion styling needed a
// long running series of !important CSS overrides to fit this panel's
// compact scale, each one its own bug report; Plate ships through the
// shadcn CLI as copied-in source instead of a packaged stylesheet, so
// sizing is just this app's own Tailwind classes going forward). EditorKit
// (src/components/editor/editor-kit.tsx) is Plate's own full stock plugin
// bundle -- headings/lists/tables/media/AI/markdown/comments/suggestions/
// the fixed toolbar, all included, none of it hand-assembled here.

// This document's real title, not its raw filename -- per explicit
// request ("instead of example.md at the top that should be the title of
// the file"), matching cydonia's own header (its own screenshot shows
// "Example Title" in the tab bar, not a filename). A real, separate field
// -- not just a label read off the first block -- per a further explicit
// follow-up ("the title should not be click and drag but static"): a
// title that was still just the document's first heading *block* carried
// BlockNote's own per-block chrome (the drag handle/turn-into menu) along
// with it, which a real page title shouldn't have (cydonia's own title
// is a field the block model itself never touches, not a block). Splits
// a leading heading (only when it is truly the document's opening line --
// anything else beforehand, or a heading appearing later in the body,
// stays a real body block) off the rest of the markdown, so the title
// renders as its own static element and the body blocks passed into
// BlockNote never include it as a duplicate. Falls back to the filename
// (extension stripped) when there's no such heading yet.
// useFilenameFallback (default true): only the initial load-from-disk
// call (below) should invent a title from the filename when there's no
// heading -- real bug, confirmed directly ("that keeps hardcoding
// example to the file instead of keeping Untitled"): togglePlainText's
// own plaintext -> blocks direction also called this, so an
// intentionally emptied title (no heading left in the raw text) got
// silently resurrected as the file's real name every time the user
// switched views, even though they'd already cleared it on purpose.
function splitTitle(
  markdownText: string,
  path: string,
  useFilenameFallback = true
): { title: string; body: string } {
  const lines = markdownText.split("\n");
  const headingIndex = lines.findIndex((line) => /^#{1,6}\s+/.test(line));
  const fallbackTitle = useFilenameFallback ? fileName(path).replace(/\.(md|markdown)$/i, "") : "";
  if (headingIndex === -1 || lines.slice(0, headingIndex).some((line) => line.trim() !== "")) {
    return { title: fallbackTitle, body: markdownText };
  }
  const title = lines[headingIndex].replace(/^#{1,6}\s+/, "").trim();
  const body = lines
    .slice(headingIndex + 1)
    .join("\n")
    .replace(/^\n+/, "");
  return { title: title || fallbackTitle, body };
}

// The inverse of splitTitle -- what actually gets saved/shown in Plain
// text is always the combined document (title heading + body), matching
// the real file on disk, even though Blocks view renders/edits them as
// two separate things.
function combineTitle(title: string, body: string): string {
  return title.trim() ? `# ${title.trim()}\n\n${body}` : body;
}

// Extension -> CodeMirror language extension. Anything not listed here
// still gets a real, editable plain-text CodeMirror instance (no syntax
// highlighting) rather than being refused -- issue #288 phase 1 is scoped
// to code/Markdown; Word/Excel are their own later phases (this file's
// own plan has the full staging).
function languageExtension(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "markdown":
      return [markdown()];
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return [javascript({ jsx: true, typescript: ext.startsWith("ts") })];
    case "py":
      return [python()];
    case "html":
      return [html()];
    case "css":
      return [css()];
    case "json":
      return [json()];
    default:
      return [];
  }
}

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

// theme="dark"/"light" (below) are @uiw/react-codemirror's own bundled
// presets -- "dark" is literally @codemirror/theme-one-dark's oneDark,
// confirmed directly by reading that package's own source, which sets a
// real background color (#282c34, a dark blue-gray -- exactly the "blue
// background" reported) via the same `&`/`.cm-gutters`/`.cm-activeLine`
// selectors this override also targets. A first attempt at this fix (a
// plain EditorView.theme with no Prec/!important) was still overridden --
// confirmed directly via a follow-up screenshot ("still with a bg color
// and not a transparent bg like i said it") -- both themes are appended
// to the same extensions array with no explicit precedence, so which
// one's generated stylesheet rule actually wins for the same selector
// isn't guaranteed by array order alone. Prec.highest forces this
// extension's own theme to sort ahead of oneDark's regardless of array
// position, and !important removes any remaining doubt from within the
// generated stylesheet itself.
const transparentBackground = Prec.highest(
  EditorView.theme({
    "&": { backgroundColor: "transparent !important" },
    ".cm-gutters": { backgroundColor: "transparent !important" },
    ".cm-activeLine": { backgroundColor: "transparent !important" },
    ".cm-activeLineGutter": { backgroundColor: "transparent !important" },
  })
);

// Real back/forward, per explicit request ("beside the x at the right we
// should have the <> buttons so we can navigate from library to files and
// come back") -- same shape a browser's own back/forward pair has, backed
// by AppLayout.tsx's own panelNav history stack.
function NavButtons({ canGoBack, canGoForward, onBack, onForward }: { canGoBack: boolean; canGoForward: boolean; onBack: () => void; onForward: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label="Back"
        disabled={!canGoBack}
        onClick={onBack}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2/50 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ChevronLeftIcon className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Forward"
        disabled={!canGoForward}
        onClick={onForward}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2/50 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ChevronRightIcon className="size-3.5" />
      </button>
    </div>
  );
}

export type RightPanelState = { type: "list"; chatId: string } | { type: "file"; path: string };

// Dispatches between the two real modes -- per explicit direction
// ("When we click the sidebar at right that should open the library of
// this chat and show multiple files/ one per row file and when i click at
// it i should be able to see, edit and save changes to the file"): a
// per-chat file list, and the existing single-file editor.
export function RightPanel({
  state,
  onCloseFile,
  onSelectFile,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  filesTouchedTick,
}: {
  state: RightPanelState;
  // Real bug, confirmed directly ("the close at the right sidebar when we
  // have a file open is not to close the sidebar but to close the file to
  // go back to library"): FileEditorPanel's own in-panel Close used to be
  // wired to the same `onClose` the header's own toggle uses, so closing a
  // FILE collapsed the entire sidebar instead of just returning to the
  // file list -- a real, distinct action (AppLayout.tsx's own
  // navigateRightPanel to a "list" entry), not another way to hide the
  // panel outright.
  onCloseFile: () => void;
  onSelectFile: (path: string) => void;
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  // Bumped by AppLayout.tsx whenever the active chat's own live event
  // stream processes a Write/Edit tool_use -- see that file's own
  // notifyFilesTouched comment for the real bug this fixes.
  filesTouchedTick: number;
}) {
  const navButtons = <NavButtons canGoBack={canGoBack} canGoForward={canGoForward} onBack={onBack} onForward={onForward} />;
  if (state.type === "list") {
    return (
      <ChatFileListPanel chatId={state.chatId} onSelectFile={onSelectFile} navButtons={navButtons} refreshSignal={filesTouchedTick} />
    );
  }
  return <FileEditorPanel path={state.path} onClose={onCloseFile} navButtons={navButtons} />;
}

// This chat's own files -- the same real GET /library data the Library
// page already shows globally (backend/src/db.rs's own list_library_files),
// filtered here to just this one chat's id, one row per file.
function ChatFileListPanel({
  chatId,
  onSelectFile,
  navButtons,
  refreshSignal,
}: {
  chatId: string;
  onSelectFile: (path: string) => void;
  navButtons: ReactNode;
  // Bumped whenever the active chat's own live event stream processes a
  // Write/Edit tool_use -- real bug, confirmed directly ("the files at the
  // right sidebar and library are not updating in real time so i have to
  // refresh"): this only ever fetched once per chatId, with nothing
  // telling it a new file just landed for the chat it's already showing.
  refreshSignal: number;
}) {
  const [files, setFiles] = useState<{ filePath: string; lastModified: string }[] | null>(null);
  // Real bug, confirmed directly ("the sidebar is stuck at loading... and
  // its not showing us our library"): this fetch had no .catch at all, so
  // any real failure (a genuine network/server error, not just "no files
  // yet") left `files` at its initial null forever -- indistinguishable
  // from still-loading. FileEditorPanel's own fetch already handles this
  // correctly; this one was just missing the same real error path.
  const [error, setError] = useState<string | null>(null);
  const prevChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Only reset to the loading state for a genuinely different chat --
    // a refreshSignal bump mid-conversation should refetch quietly, not
    // flash the whole list back to blank while it reloads.
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      setFiles(null);
    }
    setError(null);
    // /library/files, not a bare /library -- real bug, confirmed directly
    // ("if I reload i get [raw JSON]"): LibraryPage.tsx's own route is
    // exactly /library too, and the backend's real API route at that same
    // exact path won a full-page reload over the SPA (server.rs's own
    // route registration comment has the full reasoning).
    fetch("/library/files")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load files (status ${res.status}).`);
        return res.json();
      })
      .then((rows: { file_path: string; chat_id: string; last_modified: string }[]) => {
        if (cancelled) return;
        setFiles(rows.filter((r) => r.chat_id === chatId).map((r) => ({ filePath: r.file_path, lastModified: r.last_modified })));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId, refreshSignal]);

  // Real bug, confirmed directly ("The right sidebar at the chat is
  // missing... the three dots to rename or delete the file is missing
  // too"): this panel's own file rows never got LibraryPage.tsx's real
  // rename/delete wiring at all, only its own read-only click-to-open.
  // Same real endpoints, same "patch local state on success" pattern --
  // library-file-row.tsx's own comment has the full reasoning for why
  // these two components (LibraryFileMoreMenu/LibraryFileNameCell) are
  // shared, not reimplemented, between Library and this panel.
  async function deleteFile(filePath: string) {
    await fetch(`/files?path=${encodeURIComponent(filePath)}`, { method: "DELETE" });
    setFiles((prev) => (prev ? prev.filter((f) => f.filePath !== filePath) : prev));
  }

  async function renameFile(filePath: string, newLeaf: string) {
    const res = await fetch("/files/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, new_name: newLeaf }),
    });
    if (!res.ok) return;
    const { path: newPath }: { path: string } = await res.json();
    setFiles((prev) => (prev ? prev.map((f) => (f.filePath === filePath ? { ...f, filePath: newPath } : f)) : prev));
  }

  return (
    // No border-l here -- real bug, confirmed directly ("the border...
    // between chat and right sidebar is doubled instead of being only
    // one border like the left sidebar"): AppLayout.tsx's own drag-resize
    // handle (a real w-px bg-border div) already draws that seam, sitting
    // immediately left of this panel -- this border-l drew a second,
    // adjacent line right next to it.
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* h-10, not py-2 -- real bug, confirmed directly via a follow-up
          screenshot ("the chat and right sidebar topbar bottom borders
          are not aligned to be seamless"): this header's own border sits
          directly beside the chat header's own (AppLayout.tsx), and only
          sharing one real fixed height (not two paddings that happen to
          compute close) guarantees the two lines land at the same y --
          same fix applied to FileEditorPanel's own identical header
          below, and to LibraryPage.tsx's. */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        {/* Library/Terminal pill tabs -- per explicit request ("the right
            sidebar should show two options Library or Terminal", a real
            screenshot of VS Code's own Explorer/Terminal tab pair, with
            "Library" standing in for "Explorer"). Terminal is a real
            placeholder, not a working shell -- per an explicit follow-up
            ("Make the terminal disabled") after this session flagged
            that a working terminal is its own real feature (a PTY
            process on the backend, xterm.js on the frontend), not a
            small addition alongside the file library. */}
        {/* size-3.5 -- already matches AppLayout.tsx's own right-panel
            toggle icon (the "collapse right sidebar" icon,
            SidebarRightIcon, also size-3.5), confirmed directly -- per
            explicit request ("The library and terminal icon should be
            the same size as the collapse right sidebar icon size").
            text-[11px], down from 12px, to sit better proportionally
            next to that icon size -- per the same follow-up ("reduce the
            font size to match the new size of the icons"). */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="flex items-center gap-1 truncate rounded-md bg-hover-2/50 px-2 py-1 text-[11px] font-medium text-foreground">
            <FolderIcon className="size-3.5 shrink-0" />
            Library
          </span>
          <span
            aria-disabled
            title="Terminal is not available yet"
            className="flex cursor-not-allowed items-center gap-1 truncate rounded-md px-2 py-1 text-[11px] text-muted-foreground opacity-50"
          >
            <TerminalIcon className="size-3.5 shrink-0" />
            Terminal
          </span>
        </div>
        {navButtons}
        {/* Inactive for now -- per explicit request ("Remove the X from
            the library and change that to an inactive three dots as we
            will do a more dropdown with more features soon"): a real
            placeholder for a future "..." menu here, not wired to
            anything yet (including Close -- the header's own right-panel
            toggle icon, AppLayout.tsx, still closes this panel). */}
        <span aria-disabled title="More options coming soon" className="flex size-6 shrink-0 cursor-not-allowed items-center justify-center text-muted-foreground opacity-50">
          <DotsVerticalIcon className="size-4" />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {error ? (
          <p className="p-2 text-[13px] text-muted-foreground">{error}</p>
        ) : files === null ? (
          <p className="p-2 text-[13px] text-muted-foreground">Loading...</p>
        ) : files.length === 0 ? (
          <p className="p-2 text-[13px] text-muted-foreground">No files touched in this chat yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {files.map((file) => (
              // div, not a real <button> -- LibraryFileNameCell's own "..."
              // menu is a real button, and a button can't nest inside
              // another one (same real constraint LibraryPage.tsx's own
              // tree row comment already documents). onClick still opens
              // the file the same way; the menu/rename input each stop
              // their own propagation already.
              <div
                key={file.filePath}
                onClick={() => onSelectFile(file.filePath)}
                className="group flex cursor-pointer items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-hover-2/50"
              >
                {/* LibraryFileNameCell, not a bare FileExtensionBadge +
                    name -- per explicit request ("the three dots to
                    rename or delete the file is missing too"), the same
                    real component (badge, inline rename, "..." menu)
                    LibraryPage.tsx's own file rows already use. Real bug,
                    confirmed directly ("hover over it, the three dots is
                    not showing"): this row was missing the "group"
                    className MoreTrigger's own opacity-0 group-hover:
                    opacity-100 styling requires -- LibraryPage.tsx's own
                    working row already has it. */}
                <LibraryFileNameCell
                  leaf={fileName(file.filePath)}
                  onRename={(newLeaf) => renameFile(file.filePath, newLeaf)}
                  onDelete={() => deleteFile(file.filePath)}
                />
                {/* Per explicit request ("missing the 1 day ago as an
                    example of when the file was created"). */}
                <span className="shrink-0 text-2xs text-muted-foreground">{formatRelativeTime(file.lastModified)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FileEditorPanel({ path, onClose, navButtons }: { path: string; onClose: () => void; navButtons: ReactNode }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Real block editor (Plate.js) for markdown files -- per explicit
  // direction (referencing cydonia's own editor as a design target: click-
  // to-transform a block, drag-reorder, a "Plain text" toggle), replacing
  // the earlier Streamdown-based preview. Every other extension keeps the
  // plain CodeMirror-only view it already had. Defaults to "blocks" -- per
  // an earlier explicit follow-up carried over from that Streamdown preview
  // ("by default when we open any files it should be at the pretty view").
  const isMarkdown = ["md", "markdown"].includes(path.split(".").pop()?.toLowerCase() ?? "");
  const [view, setView] = useState<"blocks" | "plaintext">("blocks");
  const [title, setTitle] = useState(() => fileName(path).replace(/\.(md|markdown)$/i, ""));
  const titleInputRef = useRef<HTMLInputElement>(null);
  // Recreated per file (deps: [path]) -- a fresh editor/document per open
  // file rather than one long-lived instance reused across files, same
  // convention useCreateBlockNote's own [path] deps arg used.
  const editor = usePlateEditor({ plugins: EditorKit }, [path]);
  // Guards editor.tf.setValue calls (initial hydration from disk, and
  // plaintext -> blocks conversion on toggle) from tripping the dirty flag
  // via Plate's own onChange -- those are real content-setting operations,
  // not a user edit.
  const hydratingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    setDirty(false);
    setView("blocks");
    fetch(`/files?path=${encodeURIComponent(path)}`)
      .then((res) => {
        if (res.status === 404) throw new Error("This file no longer exists.");
        if (!res.ok) throw new Error(`Failed to load file (status ${res.status}).`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        if (isMarkdown) {
          const { title: t, body } = splitTitle(text, path);
          setTitle(t);
          hydratingRef.current = true;
          // editor.api.markdown.deserialize(body), not setValue(body)
          // directly -- real bug, confirmed directly via screenshot
          // ("the file is escaping the markdown"): setValue's own type
          // signature (value?: V | string) treats a plain string as HTML
          // to deserialize, not markdown -- confirmed directly by
          // reproducing it headlessly (it calls deserializeHtml, which
          // needs a real DOMParser). A markdown string with no actual
          // HTML tags parses as one bare text node, flattening every
          // heading/paragraph into a single block and leaving "##"/"###"
          // markers as literal text. Passing the already-deserialized
          // node array instead skips that ambiguous string path entirely.
          editor.tf.setValue(editor.api.markdown.deserialize(body));
          hydratingRef.current = false;
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // editor is recreated in lockstep with path (its own deps: [path]
    // above), so this effect doesn't need it listed separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  function togglePlainText() {
    if (view === "blocks") {
      setContent(combineTitle(title, editor.api.markdown.serialize({ preserveEmptyParagraphs: false })));
      setView("plaintext");
    } else {
      if (content !== null) {
        const { title: t, body } = splitTitle(content, path, false);
        setTitle(t);
        hydratingRef.current = true;
        // See the initial-load effect's own identical comment above --
        // same real bug, same fix.
        editor.tf.setValue(editor.api.markdown.deserialize(body));
        hydratingRef.current = false;
      }
      setView("blocks");
    }
  }

  async function save() {
    if (content === null || saving) return;
    const markdown =
      isMarkdown && view === "blocks"
        ? combineTitle(title, editor.api.markdown.serialize({ preserveEmptyParagraphs: false }))
        : content;
    setSaving(true);
    try {
      await fetch("/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content: markdown }),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    // No border-l here either -- same fix, same reasoning as
    // ChatFileListPanel's own identical container above.
    <div className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        {/* Blank until content actually loads, not the filename-derived
            guess immediately -- per explicit request ("we should show no
            text until actual text is available"): a markdown file's real
            title (splitTitle, below) can differ from that guess once the
            file's own first heading is read, so showing the guess first
            was a real, if brief, wrong-title flash on every open. */}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
          {content !== null ? (isMarkdown ? title : fileName(path)) : ""}
        </span>
        {navButtons}
        {/* size="xs" (h-6), not "sm" -- real bug, confirmed directly
            ("the save button is enormous"): this row's other buttons
            (navButtons, the "..." trigger below) are all sized to match
            a size-6 icon button, and "sm" (h-7, plus text padding) read
            noticeably larger next to them. */}
        {dirty && (
          <Button size="xs" disabled={saving} onClick={() => void save()}>
            Save
          </Button>
        )}
        {/* Vertical "..." dropdown, not a standalone pen icon + a plain
            X -- per explicit request ("instead of the X add a vertical
            three dots... that should be our more dropdown for Plain text
            with icon file-02 and remove the pen feature beside the <>").
            Close moves in here too, since removing the X left no other
            way to close the panel. size="sm" (size-5), not "md" -- this
            row's own other icon buttons are all size-6 already. */}
        <BaseDropdownMenu size="compact">
          <BaseDropdownTrigger render={<MoreTrigger orientation="vertical" size="sm" bg autoHide={false} aria-label="More" />} />
          <BaseDropdownContent align="end" className="w-40">
            {isMarkdown && (
              <BaseMenuItem
                index={0}
                icon={File02Icon}
                label={view === "blocks" ? "Plain text" : "Show blocks"}
                className="gap-[7px]"
                onSelect={togglePlainText}
              />
            )}
            <BaseMenuItem index={isMarkdown ? 1 : 0} icon={XIcon} label="Close" className="gap-[7px]" onSelect={onClose} />
          </BaseDropdownContent>
        </BaseDropdownMenu>
      </div>
      {/* [container-type:inline-size] -- per explicit request ("the font
          size needs to be dynamic... i need to fits to screen because in
          a smaller screen smaller fonts looks massive"): the title
          input's own font-size (its own inline clamp(), below) uses
          container query units (cqi) scaled off *this* panel's own
          actual rendered width, not the viewport -- this panel resizes
          independently of the window (its own drag handle), so a
          vw-based size would react to the wrong dimension. */}
      <div className="min-h-0 flex-1 overflow-auto [container-type:inline-size]">
        {error ? (
          <p className="p-3 text-[13px] text-muted-foreground">{error}</p>
        ) : content === null ? (
          // Blank, not a "Loading..." placeholder -- per explicit request
          // ("we should show no text until actual text is available"),
          // matching the header title's own identical treatment above.
          null
        ) : (
          <>
            {isMarkdown && view === "blocks" ? (
              // FixedToolbar/title/EditorContainer all live inside this one
              // <Plate>, in this exact order -- real bug, confirmed
              // directly via screenshot ("The title is above the tools
              // bar, that should be in the content area below"):
              // FixedToolbarKit (editor-kit.tsx) was previously part of
              // the plugin bundle, whose own render.beforeEditable hook
              // always inserts the toolbar immediately above wherever
              // <Editor> itself renders, regardless of other sibling
              // JSX -- so the title <input>, rendered before <Editor> but
              // outside <Plate> entirely, ended up above the toolbar
              // instead of below it. FixedToolbarKit is now left out of
              // the bundle (see that file's own comment) and rendered
              // here explicitly instead, so it's first, unconditionally,
              // with the title and body both after it. sticky top-0
              // (FixedToolbar's own class) needs a scrollable ancestor to
              // stick against -- this panel's own outer overflow-auto
              // container (above) is that ancestor, since EditorContainer
              // itself has that overflow overridden away below.
              <Plate
                editor={editor}
                onChange={() => {
                  if (!hydratingRef.current) setDirty(true);
                }}
              >
                <FixedToolbar>
                  <FixedToolbarButtons />
                </FixedToolbar>
                {/* A plain, static text input -- not a Plate block -- per
                    explicit request ("the title should not be click and
                    drag but static"): splitTitle (above) already keeps
                    this out of the document entirely, so it never picks
                    up Plate's own per-block chrome (drag handle/turn-into
                    menu) the way it did when the title was still just
                    "whichever block happens to be first". px-[54px]
                    matches the editor's own left padding (ui/editor.tsx's
                    own "default"/"none" variant paddings) so the title's
                    left edge lines up with the body text below it.
                    font-size: clamp(...cqi) -- same responsive-to-panel-
                    width approach as this container's own [container-
                    type:inline-size] comment above, scaled up since a
                    title reads larger than body text. */}
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setDirty(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      editor.tf.focus({ edge: "startEditor" });
                    }
                  }}
                  placeholder="Untitled"
                  className="w-full border-0 bg-transparent px-[54px] pt-8 pb-1 font-bold text-foreground outline-none placeholder:text-muted-foreground/60"
                  style={{ fontSize: "clamp(20px, 6cqi, 32px)" }}
                />
                <EditorContainer variant="default" className="h-auto overflow-visible">
                  {/* onKeyDown: Backspace at the very start of the document
                      -- real bug ("we should be able to fully delete the
                      title even tho we are at next line"): the title is a
                      plain input (see above), not part of the Plate
                      document, so Backspace at the body's own first
                      position had nothing before it to merge into and did
                      nothing. Redirects that Backspace into the title
                      itself (deleting its last character and moving focus
                      there), matching how Backspace at the start of a
                      block normally merges into whatever comes before it. */}
                  <Editor
                    variant="none"
                    className="px-[54px] py-2"
                    onKeyDown={(event) => {
                      if (
                        event.key === "Backspace" &&
                        editor.api.isCollapsed() &&
                        editor.selection &&
                        editor.api.isStart(editor.selection.anchor, [])
                      ) {
                        event.preventDefault();
                        const next = title.slice(0, -1);
                        setTitle(next);
                        setDirty(true);
                        requestAnimationFrame(() => {
                          const input = titleInputRef.current;
                          if (input) {
                            input.focus();
                            input.setSelectionRange(next.length, next.length);
                          }
                        });
                      }
                    }}
                  />
                </EditorContainer>
              </Plate>
            ) : (
              <CodeMirror
                value={content}
                height="100%"
                theme={document.documentElement.classList.contains("dark") ? "dark" : "light"}
                extensions={[...languageExtension(path), transparentBackground]}
                onChange={(value) => {
                  setContent(value);
                  setDirty(true);
                  if (isMarkdown) setTitle(splitTitle(value, path, false).title);
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "s") {
                    event.preventDefault();
                    void save();
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
