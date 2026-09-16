import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { SidebarModelStack } from "@/components/sidebar-nav";
import { FolderIcon, File02Icon, ChevronRightIcon } from "@/components/icons/untitled-ui";
import { FileExtensionBadge, stripExtension } from "@/components/file-extension-badge";
import { spring } from "@/lib/springs";
import { AlongsideLogo } from "@/components/icons/alongside-logo";

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

function LibraryTreeView({ files, onOpenFile }: { files: LibraryFile[]; onOpenFile: (path: string) => void }) {
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
        return (
          <TreeItem key={item.getId()} item={item} className="rounded-[6px]">
            {file ? (
              <TreeItemLabel
                // Opens the real right-side editor panel (issue #288, phase 1)
                // instead of navigating to the source chat -- per that issue's
                // own explicit direction, superseding Library's original
                // "click opens the chat" behavior (issue #286). Attached here
                // rather than on TreeItem itself: TreeItem merges
                // item.getProps() after its own props, so a custom onClick
                // passed to it would be silently overridden by headless-tree's
                // internal handler -- TreeItemLabel doesn't spread getProps(),
                // so both this click and headless-tree's own selection still fire.
                onClick={() => onOpenFile(file.filePath)}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-xs text-foreground transition-colors hover:bg-hover-2/50"
              >
                <File02Icon className="size-3.5 shrink-0 text-muted-foreground" />
                {/* flex-1 on the wrapper, not the name span -- same real bug/fix
                    right-panel.tsx's own identical row has the full reasoning
                    for: a truncating span with flex-1 directly on it stretches
                    to fill the row regardless of actual text length, pushing
                    the badge to the row's far edge instead of beside the name. */}
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="min-w-0 truncate">{stripExtension(data.name)}</span>
                  <FileExtensionBadge name={data.name} />
                </div>
                <span className="shrink-0 text-2xs text-muted-foreground">{formatRelativeTime(file.lastModified)}</span>
              </TreeItemLabel>
            ) : (
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
  const { openFile } = useOutletContext<{ openFile: (path: string) => void }>();
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  // A Projects section (each expanding into the real headless-tree file
  // browser, since a project can span many chats' worth of nested folders)
  // and a Chats section (each expanding into a flat file list -- a single
  // chat's own files don't need folder-nesting UI), mirroring the real
  // sidebar's own Projects/Chats grouping instead of one flat selector list.
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
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
              filePath: f.file_path,
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

  // Default-expand the first available project/chat once real data loads,
  // rather than an all-collapsed, empty-looking list on first visit.
  useEffect(() => {
    if (expandedProjects.size || expandedChats.size || (!projects.length && !standaloneChats.length)) return;
    if (projects.length > 0) setExpandedProjects(new Set([projects[0].projectId]));
    else setExpandedChats(new Set([standaloneChats[0].chatId]));
    // Only reacts to data becoming available, not to the expand sets
    // themselves -- this is a one-time default, not something that should
    // fight a user's own later expand/collapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, standaloneChats]);

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
            <div className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border px-2 pt-2 pb-4">
              <div className="flex flex-col gap-0.5">
                <div className="mb-0.5 flex h-5 items-center px-2 text-xs font-normal text-foreground select-none">
                  <span className="opacity-50">Projects</span>
                </div>
                {projects.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No projects</p>
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
                            <LibraryTreeView files={project.files} onOpenFile={openFile} />
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
                  <p className="px-2 py-1 text-xs text-muted-foreground">No chats</p>
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
                          <div className="flex flex-col gap-0.5 pl-7">
                            {chat.files.map((file) => {
                              const leaf = file.filePath.split("/").filter(Boolean).pop() ?? file.filePath;
                              return (
                                <button
                                  key={file.filePath}
                                  type="button"
                                  onClick={() => openFile(file.filePath)}
                                  className="flex items-center gap-1.5 rounded-[6px] py-1 pr-2 text-left text-xs text-foreground transition-colors hover:bg-hover-2/50"
                                >
                                  <File02Icon className="size-3.5 shrink-0 text-muted-foreground" />
                                  <div className="flex min-w-0 flex-1 items-center gap-1">
                                    <span className="min-w-0 truncate">{stripExtension(leaf)}</span>
                                    <FileExtensionBadge name={leaf} />
                                  </div>
                                  <span className="shrink-0 text-2xs text-muted-foreground">{formatRelativeTime(file.lastModified)}</span>
                                </button>
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
