import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { SidebarModelStack } from "@/components/sidebar-nav";
import { FolderIcon, ChevronRightIcon, DeleteIcon, EditIcon } from "@/components/icons/untitled-ui";
import { FileExtensionBadge, stripExtension, extensionOf } from "@/components/file-extension-badge";
import { spring } from "@/lib/springs";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
  DropdownLabel as BaseDropdownLabel,
} from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { MoreTrigger } from "@/components/ui/more-trigger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Which project/chat rows are left expanded, persisted across visits --
// per explicit request ("chats and projects in the library should open
// collapsed and not expanded, unless we left expanded, we need to save
// that somehow cached"). Same load-defensively pattern
// locally-hidden-chats.ts already uses (a parse failure or missing key
// just falls back to "nothing expanded", not a thrown error).
const EXPANDED_PROJECTS_KEY = "alongside_library_expanded_projects";
const EXPANDED_CHATS_KEY = "alongside_library_expanded_chats";

function loadExpandedIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

// Root cause of "the rename is not working", found only once real console
// logs (per explicit request) showed the actual request: it wasn't a
// frontend bug at all -- every rename was correctly reaching
// POST /files/rename and 404ing there, because Library's own /library/files
// rows are built from each chat's historical Write/Edit tool-use events
// (db.rs's own list_library_files), which never change once written. A
// rename earlier in the very same session had already succeeded (renaming
// the real file on disk), but reloading Library re-fetched that same
// original, now-stale path from history and represented it as if nothing
// had happened -- so trying to rename *that* 404'd, looking exactly like
// the feature had never worked at all, when it had worked every time.
// Persisted client-side (original historical path -> current real path),
// same defensive load pattern as loadExpandedIds above, so a rename
// survives a Library reload/app restart instead of reverting to a path
// that no longer exists on disk.
const RENAMED_PATHS_KEY = "alongside_library_renamed_paths";

function loadRenamedPaths(): Record<string, string> {
  try {
    const raw = localStorage.getItem(RENAMED_PATHS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

type LibraryFile = {
  filePath: string;
  chatId: string;
  chatName: string;
  projectId: string | null;
  projectName: string | null;
  lastModified: string;
};

// Same relative-time formatter InboxPage.tsx uses for its own SQLite
// datetime('now') timestamps -- kept local rather than shared since neither
// page has a real shared utils module for it yet.
function parseSqliteTimestamp(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

function formatRelativeTime(value: string): string {
  const date = parseSqliteTimestamp(value);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// A file's own path split into folders + a leaf name, so files sharing a
// directory nest together the same way a real file tree would -- issue
// #286's own "use monocode's file tree pattern" direction, without pulling
// in monocode's actual code (its own tree has git-status/rename/move
// affordances this read-only view doesn't need). Built as a flat id->item
// map for @headless-tree/react's own dataLoader shape, rather than the
// nested-object shape a hand-rolled recursive renderer would use.
type LibraryTreeItem = {
  name: string;
  children?: string[];
  file?: LibraryFile;
};

function buildTreeItems(files: LibraryFile[]): Record<string, LibraryTreeItem> {
  const items: Record<string, LibraryTreeItem> = { root: { name: "", children: [] } };
  for (const file of files) {
    const parts = file.filePath.split("/").filter(Boolean);
    const leaf = parts.pop();
    if (!leaf) continue;
    let parentId = "root";
    let path = "";
    for (const part of parts) {
      path += `/${part}`;
      const id = `dir:${path}`;
      if (!items[id]) {
        items[id] = { name: part, children: [] };
        items[parentId].children!.push(id);
      }
      parentId = id;
    }
    const fileId = `file:${file.filePath}`;
    items[fileId] = { name: leaf, file };
    items[parentId].children!.push(fileId);
  }
  return items;
}

// Shared "..." > Rename file / Delete file menu for a Library file row --
// per explicit request ("we should have a three dots for a more dropdown
// like we do in most other three dots... Delete file"), and a follow-up
// ("rename is missing... on top of delete file"). Same confirm-swaps-the-
// dropdown-content-in-place pattern as sidebar-nav.tsx's own ChatRow/
// ProjectRow for Delete; Rename instead just closes the menu and hands
// off to the row's own inline rename input (LibraryFileNameCell, below),
// matching ProjectRow's own "swap the label for an input" rename UI
// rather than a rename dialog.
function LibraryFileMoreMenu({
  fileName,
  onRenameRequest,
  onDelete,
}: {
  fileName: string;
  onRenameRequest: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  // Same reblur fix sidebar-nav.tsx's own ChatRow/ProjectRow triggers use
  // -- real bug, confirmed directly ("the rename file is not working...
  // I press enter to save and never saves"): Base UI returns real DOM
  // focus to this trigger a beat after the menu closes, which stole focus
  // straight back off Rename's own inline input (autoFocus only fires
  // once, on mount, so it never gets a second chance to reclaim focus
  // once Base UI's delayed refocus wins) -- keystrokes, Enter included,
  // were landing on this button instead of the input the whole time.
  function handleMenuOpenChange(open: boolean) {
    setMenuOpen(open);
    // Reset to the plain menu, not the confirm prompt, same as
    // ChatRow/ProjectRow's own identical reset.
    if (!open) setConfirmingDelete(false);
    if (open) return;
    const button = menuTriggerRef.current;
    if (!button) return;
    const reblur = () => button.blur();
    button.addEventListener("focus", reblur, { once: true });
    setTimeout(() => button.removeEventListener("focus", reblur), 1000);
  }

  return (
    <BaseDropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
      <BaseDropdownTrigger
        render={
          <MoreTrigger
            ref={menuTriggerRef}
            aria-label={`More options for ${fileName}`}
            onClick={(event) => event.stopPropagation()}
            active={menuOpen}
          />
        }
      />
      <BaseDropdownContent align="start" side="right" className="w-40 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {confirmingDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <BaseDropdownLabel>Delete</BaseDropdownLabel>
              <div className="px-2 pb-2 text-[11px] font-normal text-foreground">Would you like to delete this file?</div>
              <div className="flex gap-1.5 px-2 pb-1.5">
                <Button
                  variant="outline"
                  className="h-7 flex-1 text-[11px]"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmingDelete(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="h-7 flex-1 bg-red-600 text-[11px] text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                    setMenuOpen(false);
                  }}
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              <BaseDropdownLabel>More</BaseDropdownLabel>
              <BaseMenuItem
                index={0}
                icon={EditIcon}
                label="Rename file"
                className="gap-[7px]"
                onSelect={onRenameRequest}
              />
              <BaseMenuItem
                index={1}
                icon={DeleteIcon}
                label="Delete file"
                destructive
                closeOnClick={false}
                className="gap-[7px]"
                onSelect={() => setConfirmingDelete(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </BaseDropdownContent>
    </BaseDropdownMenu>
  );
}

// Icon + name (or, mid-rename, an inline input) + the "..." menu above --
// shared between the Projects tree view and the flat Chats list so
// neither has to duplicate the rename-input/extension-preserving logic.
// Renaming only ever edits the base name; the real file's extension
// (leaf's own, via extensionOf) is reattached on commit rather than left
// editable, since FileExtensionBadge already renders it separately and a
// changed extension would silently change how this same file opens.
function LibraryFileNameCell({ leaf, onRename, onDelete }: { leaf: string; onRename: (newLeaf: string) => void; onDelete: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(() => stripExtension(leaf));
  const ext = extensionOf(leaf);
  const inputRef = useRef<HTMLInputElement>(null);
  // autoFocus alone lost every time to the "..." dropdown's own closing
  // popup: Base UI keeps focus trapped inside a Menu.Popup until it's
  // actually done closing (its exit animation, not just visually faded),
  // so autoFocus's one and only attempt -- firing the instant this input
  // mounts, well before that trap releases -- was simply overridden. Real
  // bug, confirmed directly ("I press enter to save and never saves"),
  // still not resolved by a single delayed re-focus attempt (Base UI's
  // own exact release timing isn't a fixed, reliably-outrunnable number).
  // Polls every animation frame instead, for up to 1s, re-asserting focus
  // on every frame it isn't already there -- outlasts the trap regardless
  // of its actual duration, and stops the moment focus genuinely sticks
  // (checked via document.activeElement, not just "did .focus() throw").
  useEffect(() => {
    if (!renaming) return;
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const input = inputRef.current;
      if (!input) return;
      if (document.activeElement !== input) {
        input.focus();
        input.select();
      } else {
        return;
      }
      if (performance.now() - start < 1000) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [renaming]);

  function commitRename() {
    const trimmed = draft.trim();
    const base = stripExtension(leaf);
    if (trimmed && trimmed !== base) onRename(ext ? `${trimmed}.${ext}` : trimmed);
    setRenaming(false);
  }

  return (
    <>
      <FileExtensionBadge name={leaf} />
      {renaming ? (
        <Input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={commitRename}
          onKeyDown={(event) => {
            // stopPropagation -- the flat Chats list's own row (below)
            // listens for Enter/Space at the row level to open the file
            // (role="button" there, not a real <button>); without this,
            // committing a rename with Enter would also bubble up and
            // open the file right after.
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(stripExtension(leaf));
              setRenaming(false);
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className="h-5 min-w-0 flex-1 border-none bg-transparent px-1 text-xs focus-visible:ring-0"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{stripExtension(leaf)}</span>
      )}
      <LibraryFileMoreMenu
        fileName={leaf}
        onRenameRequest={() => {
          setDraft(stripExtension(leaf));
          setRenaming(true);
        }}
        onDelete={onDelete}
      />
    </>
  );
}

function LibraryTreeView({
  files,
  onOpenFile,
  onDeleteFile,
  onRenameFile,
}: {
  files: LibraryFile[];
  onOpenFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (path: string, newLeaf: string) => void;
}) {
  const items = useMemo(() => buildTreeItems(files), [files]);
  const tree = useTree<LibraryTreeItem>({
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => !item.getItemData().file,
    dataLoader: {
      getItem: (itemId) => items[itemId],
      getChildren: (itemId) => items[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <Tree indent={16} tree={tree} className="gap-0.5">
      {tree.getItems().map((item) => {
        const data = item.getItemData();
        const file = data.file;
        return file ? (
          // asChild -- real restructuring needed for the "..." menu below:
          // TreeItem otherwise renders as a real <button> (tree.tsx's own
          // Comp), and a MoreTrigger (also a <button>) can't nest inside
          // one without invalid HTML/broken click semantics. TreeItemLabel
          // (a <span>) already carries the real onClick and is what
          // headless-tree's own item.getProps() (merged onto this
          // wrapping div regardless of asChild) expects to coexist with,
          // so switching only the outer element to a div, not touching
          // TreeItemLabel, keeps the same click-to-open/keyboard-select
          // behavior the folder branch below still gets from a real button.
          <TreeItem key={item.getId()} item={item} asChild className="rounded-[6px]">
            <div className="group">
              {/* The "..." trigger and Delete file live inside this same
                  span, before the timestamp -- per explicit request ("the
                  three dots is to be before 1 day ago and not after").
                  Valid nesting here (unlike the flat Chats list below):
                  TreeItemLabel itself is a plain <span>, and TreeItem's
                  own outer element is now a <div> (asChild, above), not a
                  <button> -- so MoreTrigger (a real <button>) has no
                  button ancestor to conflict with. */}
              <TreeItemLabel
                // Opens the real right-side editor panel (issue #288, phase 1)
                // instead of navigating to the source chat -- per that issue's
                // own explicit direction, superseding Library's original
                // "click opens the chat" behavior (issue #286).
                onClick={() => onOpenFile(file.filePath)}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 pl-2 text-xs text-foreground transition-colors hover:bg-hover-2/50"
              >
                <LibraryFileNameCell
                  leaf={data.name}
                  onRename={(newLeaf) => onRenameFile(file.filePath, newLeaf)}
                  onDelete={() => onDeleteFile(file.filePath)}
                />
                <span className="shrink-0 text-2xs text-muted-foreground">{formatRelativeTime(file.lastModified)}</span>
              </TreeItemLabel>
            </div>
          </TreeItem>
        ) : (
          <TreeItem key={item.getId()} item={item} className="rounded-[6px]">
            {(
              <TreeItemLabel className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
                <FolderIcon className="size-3.5 shrink-0" />
                <span className="truncate">{data.name}</span>
              </TreeItemLabel>
            )}
          </TreeItem>
        );
      })}
    </Tree>
  );
}

type ChatGroup = { chatId: string; label: string; files: LibraryFile[] };
type ProjectGroup = { projectId: string; label: string; chats: ChatGroup[]; files: LibraryFile[] };

// GET /library -- backend/src/db.rs's own list_library_files, one row per
// distinct file a Write/Edit tool_use has actually touched, most-recent
// first. Grouped here client-side (same pattern InboxPage.tsx already uses
// for its own search filtering) rather than needing a query param per view.
export function LibraryPage() {
  const { openFile, rightPanelOpen, renameOpenFile } = useOutletContext<{
    openFile: (path: string) => void;
    rightPanelOpen: boolean;
    renameOpenFile: (oldPath: string, newPath: string) => void;
  }>();
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  // A Projects section (each expanding into the real headless-tree file
  // browser, since a project can span many chats' worth of nested folders)
  // and a Chats section (each expanding into a flat file list -- a single
  // chat's own files don't need folder-nesting UI), mirroring the real
  // sidebar's own Projects/Chats grouping instead of one flat selector list.
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => loadExpandedIds(EXPANDED_PROJECTS_KEY));
  const [expandedChats, setExpandedChats] = useState<Set<string>>(() => loadExpandedIds(EXPANDED_CHATS_KEY));
  // Persisted (not just in-memory) -- per explicit request ("chats and
  // projects in the library should open collapsed and not expanded,
  // unless we left expanded, we need to save that somehow cached"):
  // whatever the user leaves expanded survives leaving Library and
  // coming back, or reloading, rather than resetting to the previous
  // "auto-expand the first item" default on every fresh visit.
  useEffect(() => {
    localStorage.setItem(EXPANDED_PROJECTS_KEY, JSON.stringify([...expandedProjects]));
  }, [expandedProjects]);
  useEffect(() => {
    localStorage.setItem(EXPANDED_CHATS_KEY, JSON.stringify([...expandedChats]));
  }, [expandedChats]);
  // See RENAMED_PATHS_KEY's own comment above for why this exists.
  const [renamedPaths, setRenamedPaths] = useState<Record<string, string>>(() => loadRenamedPaths());
  useEffect(() => {
    localStorage.setItem(RENAMED_PATHS_KEY, JSON.stringify(renamedPaths));
  }, [renamedPaths]);
  // Per-chat models, so a chat row can show the same model icon stack the
  // real sidebar/topbar show instead of a plain chat-bubble icon -- per
  // explicit request. GET /library/files itself has no model data (it's
  // built from chat_events/tool_use rows, not chat metadata), so this
  // reuses /sessions, the same endpoint AppLayout.tsx's own sidebar
  // already fetches for this exact purpose.
  const [chatModels, setChatModels] = useState<Record<string, { provider: string; model: string }[]>>({});

  useEffect(() => {
    document.title = "Library";
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/sessions")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; models?: { provider: string; model: string }[] }[]) => {
        if (cancelled) return;
        const byId: Record<string, { provider: string; model: string }[]> = {};
        for (const chat of data) {
          if (chat.models && chat.models.length > 0) byId[chat.id] = chat.models;
        }
        setChatModels(byId);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // /library/files, not a bare /library -- real bug, confirmed directly
    // ("if I reload i get [raw JSON]"): this page's own client-side route
    // is also exactly /library, and the backend's real API route at that
    // same exact path won a full-page reload over the SPA (server.rs's
    // own route registration comment has the full reasoning).
    fetch("/library/files")
      .then((res) => (res.ok ? res.json() : []))
      .then(
        (
          data: {
            file_path: string;
            chat_id: string;
            chat_name: string;
            project_id: string | null;
            project_name: string | null;
            last_modified: string;
          }[]
        ) => {
          if (cancelled) return;
          setLoaded(true);
          setFiles(
            data.map((f) => ({
              // renamedPaths[...] ?? -- applies any rename this session (or
              // a past one) has already made to this file, since the
              // history-derived path above never updates on its own. See
              // RENAMED_PATHS_KEY's own comment for the real bug this
              // fixes.
              filePath: renamedPaths[f.file_path] ?? f.file_path,
              chatId: f.chat_id,
              chatName: f.chat_name,
              projectId: f.project_id,
              projectName: f.project_name,
              lastModified: f.last_modified,
            }))
          );
        }
      );
    return () => {
      cancelled = true;
    };
    // Deliberately just [] -- this only needs whatever renamedPaths held
    // at the moment Library loaded; a rename made *during* this session
    // updates `files` directly (renameFile's own setFiles call below),
    // it doesn't need this fetch to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two-level grouping -- projects (each with its own nested chats) and
  // standalone chats with no project, both derived from the same /library
  // rows this page already fetched (no new backend endpoint: a chat/
  // project only appears here once it actually has a file in it, same
  // limitation the earlier flat grouping already had).
  const { projects, standaloneChats } = useMemo(() => {
    const projectMap = new Map<string, ProjectGroup>();
    const chatMap = new Map<string, ChatGroup>();
    const standalone = new Map<string, ChatGroup>();
    for (const file of files) {
      const chats = file.projectId ? chatMap : standalone;
      let chat = chats.get(file.chatId);
      if (!chat) {
        chat = { chatId: file.chatId, label: file.chatName, files: [] };
        chats.set(file.chatId, chat);
      }
      chat.files.push(file);
      if (file.projectId) {
        let project = projectMap.get(file.projectId);
        if (!project) {
          project = { projectId: file.projectId, label: file.projectName ?? "Untitled project", chats: [], files: [] };
          projectMap.set(file.projectId, project);
        }
        project.files.push(file);
        if (!project.chats.some((c) => c.chatId === file.chatId)) project.chats.push(chat);
      }
    }
    return { projects: [...projectMap.values()], standaloneChats: [...standalone.values()] };
  }, [files]);

  const isEmpty = loaded && files.length === 0;

  // "..." > Delete file -- per explicit request ("we should have a three
  // dots for a more dropdown like we do in most other three dots... Delete
  // file"), matching the same confirm-in-dropdown pattern chat/project rows
  // already use (sidebar-nav.tsx's own ChatRow/ProjectRow). Only removes
  // the real file from disk -- this row's own data (files state) is built
  // from each chat's historical Write/Edit tool-use events, not a live
  // directory listing, so an older chat that touched this same path keeps
  // its own row until it's opened again (matching how a file deleted
  // outside the app entirely already behaves: read_file just 404s).
  async function deleteFile(filePath: string) {
    await fetch(`/files?path=${encodeURIComponent(filePath)}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.filePath !== filePath));
  }

  // "..." > Rename file -- per explicit follow-up request ("rename is
  // missing for the file on top of delete file"). Same on-disk-only
  // caveat as deleteFile above: this row's own data doesn't live-scan the
  // directory, so it's just patched locally on success rather than
  // refetched; an older chat that touched this file under its old name
  // keeps pointing at the now-missing path until it's opened again.
  // renameOpenFile -- real bug, confirmed directly ("the right sidebar
  // still showing the not updated file name"): the file editor panel's
  // own path prop, and everything it derives from that (the title,
  // splitTitle's own filename fallback), never changes on its own just
  // because Library renamed the file elsewhere -- it has to be told.
  async function renameFile(filePath: string, newLeaf: string) {
    const res = await fetch("/files/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, new_name: newLeaf }),
    });
    if (!res.ok) return;
    const { path: newPath }: { path: string } = await res.json();
    setFiles((prev) => prev.map((f) => (f.filePath === filePath ? { ...f, filePath: newPath } : f)));
    renameOpenFile(filePath, newPath);
    // Record it against whichever historical path this file was already
    // known by -- if filePath is itself already a rename target (a prior
    // rename this session or an earlier one), keep pointing the SAME
    // original key at the newest path rather than adding a second,
    // now-dangling entry for it. See RENAMED_PATHS_KEY's own comment for
    // why this needs to persist at all.
    setRenamedPaths((prev) => {
      const originalKey = Object.keys(prev).find((key) => prev[key] === filePath) ?? filePath;
      return { ...prev, [originalKey]: newPath };
    });
  }

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleChat(chatId: string) {
    setExpandedChats((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <AnimatePresence initial={false}>
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: spring.moderate }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            className="absolute inset-x-0 top-0 bottom-[104px] px-4"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <AlongsideLogo className="size-[32px] text-black dark:text-white" />
            </div>
            <div className="absolute left-1/2 w-full max-w-[22rem] -translate-x-1/2 text-center" style={{ top: "calc(50% + 16px + 12px)" }}>
              <h1 className="text-[18px] font-normal text-foreground">No files yet</h1>
              <p className="mt-2 text-[13px] font-normal text-muted-foreground">
                Files an agent creates or edits across your chats will show up here.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="groups"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: spring.moderate }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            // top-0, plain -- this page no longer builds its own separate
            // header (see PageBreadcrumb's own /library branch,
            // AppLayout.tsx): the real bug behind every earlier attempt
            // to fix "the library topbar" via border/height/positioning
            // tweaks here was that this page was building a second,
            // real header stacked underneath AppLayout.tsx's own
            // chat-scoped header, which stays mounted (reserved height,
            // opacity 0) on every page without an open chat -- two
            // headers, not a CSS bug in either one. With Library now
            // reusing that same shared slot instead, this container
            // starts at the true top of the page with nothing above it
            // to clear.
            className="absolute inset-0 top-0 flex"
          >
            {/* Single sidebar-style column, mirroring the app's own
                left sidebar's own Projects/Chats grouping (sidebar-nav.tsx)
                instead of a separate selector + file-browser split: a
                Projects section (each expanding into the real
                headless-tree file browser, since a project can span many
                chats' worth of nested folders) and a Chats section (each
                expanding into a flat file list -- a single chat's own
                files don't need folder-nesting UI). */}
            {/* border-r dropped whenever a file is open (rightPanelOpen) --
                real bug, confirmed directly ("our right sidebar has a
                thick border because the left panel inside library has a
                right border already"): AppLayout.tsx's own right-panel
                drawer always draws a full-height 1px seam strip right
                alongside this column once a file is open, so keeping this
                border-r too doubled the line. Kept only for the "no file
                open" state, where that strip isn't rendered at all and
                this is the only thing separating the sidebar from the
                empty space past it. */}
            <div className={`flex w-64 shrink-0 flex-col gap-3 overflow-y-auto px-2 pt-2 pb-4 ${rightPanelOpen ? "" : "border-r border-border"}`}>
              <div className="flex flex-col gap-0.5">
                <div className="mb-0.5 flex h-5 items-center px-2 text-xs font-normal text-foreground select-none">
                  <span className="opacity-50">Projects</span>
                </div>
                {projects.length === 0 ? (
                  <p className="flex h-7 items-center px-2 text-xs font-normal text-muted-foreground opacity-50">No projects</p>
                ) : (
                  projects.map((project) => {
                    const expanded = expandedProjects.has(project.projectId);
                    return (
                      <div key={project.projectId} className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleProject(project.projectId)}
                          className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-hover-2/50"
                        >
                          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{project.label}</span>
                          <span className="shrink-0 text-2xs text-muted-foreground">{project.chats.length}</span>
                          <ChevronRightIcon className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                        </button>
                        {expanded && (
                          <div className="pl-5">
                            <LibraryTreeView files={project.files} onOpenFile={openFile} onDeleteFile={deleteFile} onRenameFile={renameFile} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="mb-0.5 flex h-5 items-center px-2 text-xs font-normal text-foreground select-none">
                  <span className="opacity-50">Chats</span>
                </div>
                {standaloneChats.length === 0 ? (
                  <p className="flex h-7 items-center px-2 text-xs font-normal text-muted-foreground opacity-50">No chats</p>
                ) : (
                  standaloneChats.map((chat) => {
                    const expanded = expandedChats.has(chat.chatId);
                    return (
                      <div key={chat.chatId} className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleChat(chat.chatId)}
                          className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-hover-2/50"
                        >
                          {chatModels[chat.chatId] && <SidebarModelStack models={chatModels[chat.chatId]} />}
                          <span className="min-w-0 flex-1 truncate">{chat.label}</span>
                          <ChevronRightIcon className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                        </button>
                        {expanded && (
                          <div className="flex flex-col gap-0.5">
                            {chat.files.map((file) => {
                              const leaf = file.filePath.split("/").filter(Boolean).pop() ?? file.filePath;
                              return (
                                // A div, not a <button> -- real restructuring
                                // needed for the "..." trigger to sit before
                                // the timestamp, not after it (per explicit
                                // request, "the three dots is to be before 1
                                // day ago and not after"): MoreTrigger is
                                // itself a real <button>, which can't nest
                                // inside another <button> without invalid
                                // HTML. role="button"/tabIndex/onKeyDown below
                                // keep the same click-and-keyboard-activate
                                // behavior a real button gave for free.
                                <div
                                  key={file.filePath}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openFile(file.filePath)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      openFile(file.filePath);
                                    }
                                  }}
                                  className="group flex w-full items-center gap-1.5 rounded-[6px] py-1 pr-2 pl-2 text-left text-xs text-foreground transition-colors hover:bg-hover-2/50"
                                >
                                  <LibraryFileNameCell
                                    leaf={leaf}
                                    onRename={(newLeaf) => renameFile(file.filePath, newLeaf)}
                                    onDelete={() => deleteFile(file.filePath)}
                                  />
                                  <span className="shrink-0 text-2xs text-muted-foreground">{formatRelativeTime(file.lastModified)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
