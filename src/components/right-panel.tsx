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
import {
  useCreateBlockNote,
  SideMenu,
  SideMenuController,
  DragHandleButton,
  DragHandleMenu,
  RemoveBlockItem,
  BlockColorsItem,
  TableRowHeaderItem,
  TableColumnHeaderItem,
  blockTypeSelectItems,
  useComponentsContext,
  useDictionary,
  useBlockNoteEditor,
  useExtensionState,
  type SideMenuProps,
} from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { offset } from "@floating-ui/react";
import { en } from "@blocknote/core/locales";
import { BlockNoteView, lightDefaultTheme, darkDefaultTheme, type Theme } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "./right-panel.css";
import { XIcon, File02Icon, ChevronLeftIcon, ChevronRightIcon, FolderIcon, TerminalIcon, DotsVerticalIcon } from "@/components/icons/untitled-ui";
import { Button } from "@/components/ui/button";
import { FileExtensionBadge, stripExtension } from "@/components/file-extension-badge";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
} from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { MoreTrigger } from "@/components/ui/more-trigger";

// Real BlockNote block editor (issue #299) -- replaces the earlier
// Streamdown-based read-mostly preview per explicit direction (referencing
// a sibling repo, cydonia, as a design target: click-to-transform a block
// into a different type, drag-and-drop block reordering, a "Plain text"
// toggle). BlockNote ships the drag handle/side menu and the slash "turn
// into" menu itself, so neither needs custom implementation here.
//
// Transparent editor background, same real bug/fix class as the CodeMirror
// background fix elsewhere in this file: BlockNote's own default themes
// bake in a real (non-transparent) editor background rather than blending
// into this panel's own bg-background. Unlike CodeMirror's stylesheet-based
// theme (a real specificity fight, needed Prec.highest + !important),
// BlockNote's Theme is applied as inline CSS custom properties on the
// editor's own DOM node (applyBlockNoteCSSVariablesFromTheme), so a plain
// override here is sufficient -- no specificity contest to force.
const lightTheme: Theme = {
  ...lightDefaultTheme,
  colors: { ...lightDefaultTheme.colors, editor: { ...lightDefaultTheme.colors.editor, background: "transparent" } },
};
const darkTheme: Theme = {
  ...darkDefaultTheme,
  colors: { ...darkDefaultTheme.colors, editor: { ...darkDefaultTheme.colors.editor, background: "transparent" } },
};

// Shorter empty-block placeholder -- per explicit request ("it should only
// be Type / for commands and not Enter..."): BlockNote's own default
// ("Enter text or type '/' for commands", @blocknote/core's en locale)
// spells out both ways to start a block; overriding just this one string
// on top of the full `en` dictionary (options.dictionary replaces the
// whole dictionary, not a per-key merge, per BlockNoteEditor.ts's own
// `this.dictionary = options.dictionary || en`) keeps every other real
// translation intact.
const dictionary = { ...en, placeholders: { ...en.placeholders, default: "Type '/' for commands" } };

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
function splitTitle(markdownText: string, path: string): { title: string; body: string } {
  const lines = markdownText.split("\n");
  const headingIndex = lines.findIndex((line) => /^#{1,6}\s+/.test(line));
  const fallbackTitle = fileName(path).replace(/\.(md|markdown)$/i, "");
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

// A real, uploaded cover image -- per explicit direction ("what is it
// used by cydonia to generate the cover?... don't implement anything, the
// only thing we should have is upload cover"): checked cydonia's own
// cover.rs directly -- its generated pattern is a from-scratch procedural
// algorithm (a hand-tuned halftone dither), not something worth porting,
// but that same file also supports a real uploaded cover image, stored as
// a plain file beside the document ("the file being there is the whole
// of the state" -- its own comment). This mirrors that: GET/POST
// /files/cover (backend/src/server.rs) store the cover as
// `<basename>.cover.<ext>` next to the markdown file, no DB row, so
// there's nothing to keep in sync and a cover deleted outside the app is
// simply gone -- same trust boundary as /files itself.
function Cover({ path }: { path: string }) {
  // Real bug, confirmed directly via a screenshot (a broken-image glyph
  // sitting where the cover should be, on a file with no cover uploaded
  // yet -- the overwhelmingly common case right now): starting hasCover
  // optimistically true meant the <img> always mounted and always
  // attempted to load /files/cover before anything had confirmed a cover
  // actually exists, so a missing one always hit the browser's own
  // native broken-image rendering first, onError or not. Starting false
  // and confirming existence with a HEAD request before ever rendering
  // the <img> means a missing cover never gets an <img> tag at all.
  const [hasCover, setHasCover] = useState(false);
  const [version, setVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setHasCover(false);
    setVersion(0);
    fetch(`/files/cover?path=${encodeURIComponent(path)}`, { method: "HEAD" })
      .then((res) => {
        if (!cancelled && res.ok) setHasCover(true);
      })
      .catch(() => {
        // No cover, or the request itself failed -- either way, the
        // neutral placeholder (already the default) is the right state.
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read the selected file."));
      reader.readAsDataURL(file);
    });
    await fetch("/files/cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, data_url: dataUrl }),
    });
    setHasCover(true);
    setVersion((v) => v + 1);
  }

  return (
    // bg-black/[0.06] dark:bg-white/[0.06], not bg-muted -- real bug,
    // confirmed directly ("For no cover, just add something like a plain
    // lighter bg for dark mode and a darker bg for light mode"): bg-muted
    // already darkens in light mode and lightens in dark mode (the same
    // direction requested), but only at a 4% --accent opacity meant for
    // subtle hover states, not a placeholder that needs to actually read
    // as a real "cover" area against the page.
    <div className="group relative h-[110px] w-full shrink-0 bg-black/[0.06] dark:bg-white/[0.06]">
      {hasCover && (
        // key={version} -- a plain src change alone doesn't force a
        // reload if the URL is otherwise identical to what's already
        // painted; the version query param (bumped after a real upload)
        // guarantees a fresh request instead of the old image lingering.
        <img
          key={version}
          src={`/files/cover?path=${encodeURIComponent(path)}&v=${version}`}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setHasCover(false)}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => void handleUpload(event)}
      />
      {/* Bottom-right, only on hover -- per explicit direction ("inside
          the cover at the bottom right"), matching Notion's own
          add/change-cover placement. */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="absolute right-2 bottom-2 rounded-md border border-border bg-background/90 px-2 py-1 text-[12px] text-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100"
      >
        {hasCover ? "Change cover" : "Add cover"}
      </button>
    </div>
  );
}

// "Transform >" submenu -- per explicit request ("we should make / as
// part of the draggable icon as Transform > and keep the same size as
// dropdown as colors and not this huge dropdown"): the "/" slash menu
// already lists every block type this editor supports, but only as a
// separate, much larger suggestion-menu UI, and the drag-handle menu
// itself only ever showed BlockNote's own default items (Delete, Colors)
// -- there's no built-in "turn into" item in this package version.
// blockTypeSelectItems is the exact same data source the formatting
// toolbar's own compact block-type dropdown already draws from (13
// entries: paragraph, headings 1-6 plus their toggle variants, quote,
// toggle/bullet/numbered/check list), reused directly here instead of
// hand-duplicating that list, rendered as a right-opening submenu built
// the same way BlockColorsItem builds its own (Menu.Root
// position="right" sub -- matching size/style exactly, not the slash
// menu's own SuggestionMenu UI).
function TransformItem({ children }: { children: ReactNode }) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  });

  if (block === undefined) return null;

  return (
    <Components.Generic.Menu.Root position="right" sub={true}>
      <Components.Generic.Menu.Trigger sub={true}>
        <Components.Generic.Menu.Item className="bn-menu-item" subTrigger={true}>
          {children}
        </Components.Generic.Menu.Item>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown sub={true} className="bn-menu-dropdown">
        {blockTypeSelectItems(dict).map((item) => {
          const Icon = item.icon;
          const propsMatch = Object.entries(item.props ?? {}).every(([key, value]) => block.props[key] === value);
          return (
            <Components.Generic.Menu.Item
              key={`${item.type}-${item.name}`}
              className="bn-menu-item"
              icon={<Icon size={18} />}
              checked={block.type === item.type && propsMatch}
              onClick={() => {
                editor.updateBlock(block, { type: item.type as never, props: item.props as never });
              }}
            >
              {item.name}
            </Components.Generic.Menu.Item>
          );
        })}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

// A single gutter icon, not BlockNote's default separate "+"/drag-handle
// pair -- per explicit request (referencing cydonia's own source directly:
// bezel-editor's menu.rs `handle()` renders one "⠿" glyph that drags to
// reorder on mousedown+move, or opens the block menu on a plain click
// disambiguated at release). BlockNote's own DragHandleButton already
// does exactly this (its own source wraps the drag handle in a
// Menu.Root/Menu.Trigger, opening DragHandleMenu -- BlockNote's "turn
// into"/duplicate/delete menu -- on click, while native HTML5 draggable
// still handles the reorder drag) -- so this only drops AddBlockButton
// ("+") from the default two-button side menu, not a new interaction.
// Custom children on DragHandleMenu -- per a further explicit request
// ("when I click at the icon only shows delete and colors"): BlockNote's
// own default DragHandleMenu (used when no children are passed) only
// ever renders RemoveBlockItem/BlockColorsItem/the two table-header
// items -- there's no "turn into" item built in. TransformItem (above)
// adds that; the table-header items are kept too, unchanged, so nothing
// existing regresses.
function SingleHandleSideMenu(props: SideMenuProps) {
  const dict = useDictionary();
  return (
    <SideMenu {...props}>
      <DragHandleButton {...props}>
        <DragHandleMenu>
          <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
          <TransformItem>Transform</TransformItem>
          <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
          <TableRowHeaderItem>{dict.drag_handle.header_row_menuitem}</TableRowHeaderItem>
          <TableColumnHeaderItem>{dict.drag_handle.header_column_menuitem}</TableColumnHeaderItem>
        </DragHandleMenu>
      </DragHandleButton>
    </SideMenu>
  );
}

// Real bug, confirmed directly via a follow-up screenshot ("the drag icon
// and text still not vertically centralised"): BlockNote's own default
// placement for this menu is "left-start" (top-aligned to the block, not
// centered) plus a *hardcoded per-block-type pixel offset* to fake
// vertical centering (@blocknote/react's own SideMenuController.tsx,
// getBlockOffset() -- e.g. +39px for an h1), tuned for BlockNote's own
// default (larger) font sizes. Shrinking the font scale to fit this panel
// (right-panel.css) made every one of those hardcoded numbers wrong, so
// no further pixel-guessing fix would hold. Overriding placement to
// plain "left" instead makes floating-ui center the menu against the
// reference block's own real height itself (no per-block-type table to
// keep in sync with font-size changes), and mainAxis: 6 adds real
// breathing room between the handle and the block's own text -- per a
// further explicit follow-up ("increase the gap of the icon to the text
// so when we hover over it, the hover bg do not touch the text").
const sideMenuFloatingUIOptions = {
  useFloatingOptions: {
    placement: "left" as const,
    middleware: [offset({ mainAxis: 6 })],
  },
};

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
  onClose,
  onSelectFile,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
}: {
  state: RightPanelState;
  onClose: () => void;
  onSelectFile: (path: string) => void;
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}) {
  const navButtons = <NavButtons canGoBack={canGoBack} canGoForward={canGoForward} onBack={onBack} onForward={onForward} />;
  if (state.type === "list") {
    return <ChatFileListPanel chatId={state.chatId} onSelectFile={onSelectFile} navButtons={navButtons} />;
  }
  return <FileEditorPanel path={state.path} onClose={onClose} navButtons={navButtons} />;
}

// This chat's own files -- the same real GET /library data the Library
// page already shows globally (backend/src/db.rs's own list_library_files),
// filtered here to just this one chat's id, one row per file.
function ChatFileListPanel({
  chatId,
  onSelectFile,
  navButtons,
}: {
  chatId: string;
  onSelectFile: (path: string) => void;
  navButtons: ReactNode;
}) {
  const [files, setFiles] = useState<{ filePath: string; lastModified: string }[] | null>(null);
  // Real bug, confirmed directly ("the sidebar is stuck at loading... and
  // its not showing us our library"): this fetch had no .catch at all, so
  // any real failure (a genuine network/server error, not just "no files
  // yet") left `files` at its initial null forever -- indistinguishable
  // from still-loading. FileEditorPanel's own fetch already handles this
  // correctly; this one was just missing the same real error path.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
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
  }, [chatId]);

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
              <button
                key={file.filePath}
                type="button"
                onClick={() => onSelectFile(file.filePath)}
                className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-hover-2/50"
              >
                {/* FileExtensionBadge leading, not a generic File02Icon --
                    per explicit request ("we should use the same
                    component for the library page in this right
                    sidebar... it shows the file badge instead of the
                    icon"), matching LibraryPage.tsx's own file rows. */}
                <FileExtensionBadge name={file.filePath} />
                <span className="min-w-0 flex-1 truncate">{stripExtension(fileName(file.filePath))}</span>
              </button>
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
  // Real block editor (BlockNote) for markdown files -- per explicit
  // direction (referencing cydonia's own editor as a design target: click-
  // to-transform a block, drag-reorder, a "Plain text" toggle), replacing
  // the earlier Streamdown-based preview. Every other extension keeps the
  // plain CodeMirror-only view it already had. Defaults to "blocks" -- per
  // an earlier explicit follow-up carried over from that Streamdown preview
  // ("by default when we open any files it should be at the pretty view").
  const isMarkdown = ["md", "markdown"].includes(path.split(".").pop()?.toLowerCase() ?? "");
  const [view, setView] = useState<"blocks" | "plaintext">("blocks");
  const [title, setTitle] = useState(() => fileName(path).replace(/\.(md|markdown)$/i, ""));
  // Recreated per file (deps: [path]) -- a fresh editor/document per open
  // file rather than one long-lived instance reused across files.
  const editor = useCreateBlockNote({ dictionary }, [path]);
  // Guards editor.replaceBlocks calls (initial hydration from disk, and
  // plaintext -> blocks conversion on toggle) from tripping the dirty flag
  // via BlockNoteView's own onChange -- those are real content-setting
  // operations, not a user edit.
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
          editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(body));
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
      setContent(combineTitle(title, editor.blocksToMarkdownLossy()));
      setView("plaintext");
    } else {
      if (content !== null) {
        const { title: t, body } = splitTitle(content, path);
        setTitle(t);
        hydratingRef.current = true;
        editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(body));
        hydratingRef.current = false;
      }
      setView("blocks");
    }
  }

  async function save() {
    if (content === null || saving) return;
    const markdown = isMarkdown && view === "blocks" ? combineTitle(title, editor.blocksToMarkdownLossy()) : content;
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
        {dirty && (
          <Button size="sm" disabled={saving} onClick={() => void save()}>
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
          input's and the block editor's own font-size (right-panel.css)
          both use container query units (cqi) scaled off *this* panel's
          own actual rendered width, not the viewport -- this panel
          resizes independently of the window (its own drag handle), so a
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
            {/* Shown above either view -- both are still the same
                document, per explicit request that "all of our .mds"
                get this, not just the Blocks view. */}
            {isMarkdown && <Cover path={path} />}
            {isMarkdown && view === "blocks" ? (
              <>
                {/* A plain, static text input -- not a BlockNote block --
                    per explicit request ("the title should not be click
                    and drag but static"): splitTitle (above) already
                    keeps this out of editor.document entirely, so it
                    never picks up BlockNote's own per-block chrome (drag
                    handle/turn-into menu) the way it did when the title
                    was still just "whichever block happens to be first".
                    px-[54px] matches bn-editor's own padding-inline
                    (right-panel.css) so the title's left edge lines up
                    with the body text below it. font-size: clamp(...cqi)
                    -- same responsive-to-panel-width approach as the
                    body text below (right-panel.css's own comment has
                    the full reasoning), scaled up since a title reads
                    larger than body text. */}
                <input
                  type="text"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setDirty(true);
                  }}
                  placeholder="Untitled"
                  className="w-full border-0 bg-transparent px-[54px] pt-8 pb-1 font-bold text-foreground outline-none placeholder:text-muted-foreground/60"
                  style={{ fontSize: "clamp(20px, 6cqi, 32px)" }}
                />
                <BlockNoteView
                  editor={editor}
                  theme={document.documentElement.classList.contains("dark") ? darkTheme : lightTheme}
                  sideMenu={false}
                  onChange={() => {
                    if (!hydratingRef.current) setDirty(true);
                  }}
                >
                  <SideMenuController sideMenu={SingleHandleSideMenu} floatingUIOptions={sideMenuFloatingUIOptions} />
                </BlockNoteView>
              </>
            ) : (
              <CodeMirror
                value={content}
                height="100%"
                theme={document.documentElement.classList.contains("dark") ? "dark" : "light"}
                extensions={[...languageExtension(path), transparentBackground]}
                onChange={(value) => {
                  setContent(value);
                  setDirty(true);
                  if (isMarkdown) setTitle(splitTitle(value, path).title);
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
