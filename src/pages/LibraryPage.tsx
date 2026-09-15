import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { PageContent } from "@/components/page-content";
import { FolderIcon, File02Icon, ChevronRightIcon, BubbleChatIcon } from "@/components/icons/untitled-ui";
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
// affordances this read-only view doesn't need).
type TreeNode = {
  name: string;
  children: Map<string, TreeNode>;
  files: LibraryFile[];
};

function buildTree(files: LibraryFile[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map(), files: [] };
  for (const file of files) {
    const parts = file.filePath.split("/").filter(Boolean);
    const leaf = parts.pop();
    if (!leaf) continue;
    let node = root;
    for (const part of parts) {
      let next = node.children.get(part);
      if (!next) {
        next = { name: part, children: new Map(), files: [] };
        node.children.set(part, next);
      }
      node = next;
    }
    node.files.push({ ...file, filePath: leaf });
  }
  return root;
}

function TreeView({ node, depth = 0, onOpenFile }: { node: TreeNode; depth?: number; onOpenFile: (path: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      {[...node.children.values()].map((child) => (
        <div key={child.name} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground" style={{ paddingLeft: depth * 16 }}>
            <FolderIcon className="size-3.5 shrink-0" />
            <span className="truncate">{child.name}</span>
          </div>
          <TreeView node={child} depth={depth + 1} onOpenFile={onOpenFile} />
        </div>
      ))}
      {node.files.map((file) => (
        <button
          key={`${file.chatId}-${file.filePath}`}
          type="button"
          // Opens the real right-side editor panel (issue #288, phase 1)
          // instead of navigating to the source chat -- per that issue's
          // own explicit direction, superseding Library's original "click
          // opens the chat" behavior (issue #286).
          onClick={() => onOpenFile(file.filePath)}
          className="flex items-center gap-1.5 rounded-[6px] py-1 pr-2 text-left text-xs text-foreground transition-colors hover:bg-hover-2/50"
          style={{ paddingLeft: depth * 16 + 20 }}
        >
          <File02Icon className="size-3.5 shrink-0 text-muted-foreground" />
          {/* flex-1 on the wrapper, not the name span -- same real bug/fix
              right-panel.tsx's own identical row has the full reasoning
              for: a truncating span with flex-1 directly on it stretches
              to fill the row regardless of actual text length, pushing
              the badge to the row's far edge instead of beside the name. */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 truncate">{stripExtension(file.filePath)}</span>
            <FileExtensionBadge name={file.filePath} />
          </div>
          <span className="shrink-0 text-2xs text-muted-foreground">{formatRelativeTime(file.lastModified)}</span>
        </button>
      ))}
    </div>
  );
}

type ChatGroup = { chatId: string; label: string; files: LibraryFile[] };
type ProjectGroup = { projectId: string; label: string; chats: ChatGroup[] };
type Selection = { type: "project"; id: string } | { type: "chat"; id: string };

// GET /library -- backend/src/db.rs's own list_library_files, one row per
// distinct file a Write/Edit tool_use has actually touched, most-recent
// first. Grouped here client-side (same pattern InboxPage.tsx already uses
// for its own search filtering) rather than needing a query param per view.
export function LibraryPage() {
  const { openFile } = useOutletContext<{ openFile: (path: string) => void }>();
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Nested projects -> chats -> files, per explicit direction ("another
  // second left sidebar to project the projects or chats and once we open
  // we can see the files inside that chat or project") -- replaces the
  // earlier flat "By project / By chat" toggle entirely, since a project's
  // own chats are always shown nested under it now rather than needing a
  // separate view mode.
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    document.title = "Library";
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/library")
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
          project = { projectId: file.projectId, label: file.projectName ?? "Untitled project", chats: [] };
          projectMap.set(file.projectId, project);
        }
        if (!project.chats.some((c) => c.chatId === file.chatId)) project.chats.push(chat);
      }
    }
    return { projects: [...projectMap.values()], standaloneChats: [...standalone.values()] };
  }, [files]);

  const isEmpty = loaded && files.length === 0;

  // Default to the first available project/chat once real data loads,
  // rather than an empty "select something" state on every visit --
  // cydonia's own sidebar always opens onto a real selection too.
  useEffect(() => {
    if (selection || (!projects.length && !standaloneChats.length)) return;
    if (projects.length > 0) {
      setSelection({ type: "project", id: projects[0].projectId });
      setExpandedProjects((prev) => new Set(prev).add(projects[0].projectId));
    } else {
      setSelection({ type: "chat", id: standaloneChats[0].chatId });
    }
    // Only reacts to data becoming available, not to selection itself --
    // this is a one-time default, not something that should fight a
    // user's own later selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, standaloneChats]);

  const selectedFiles = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "chat") {
      return (
        standaloneChats.find((c) => c.chatId === selection.id)?.files ??
        projects.flatMap((p) => p.chats).find((c) => c.chatId === selection.id)?.files ??
        null
      );
    }
    return projects.find((p) => p.projectId === selection.id)?.chats.flatMap((c) => c.files) ?? null;
  }, [selection, projects, standaloneChats]);

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
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
            className="absolute inset-0 top-0 flex"
          >
            {/* Left rail: projects (foldable, nesting their own chats) and
                standalone chats -- selecting one shows its files to the
                right, mirroring cydonia's own foldable project_head()
                pattern (this session's own design-reference research). */}
            <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border px-2 pt-14 pb-4">
              <div className="flex flex-col gap-0.5">
                {projects.map((project) => {
                  const expanded = expandedProjects.has(project.projectId);
                  return (
                    <div key={project.projectId} className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          toggleProject(project.projectId);
                          setSelection({ type: "project", id: project.projectId });
                        }}
                        className={`flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-xs transition-colors hover:bg-hover-2/50 ${selection?.type === "project" && selection.id === project.projectId ? "bg-hover-2/50 text-foreground" : "text-foreground"}`}
                      >
                        <ChevronRightIcon className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{project.label}</span>
                        <span className="shrink-0 text-2xs text-muted-foreground">{project.chats.length}</span>
                      </button>
                      {expanded &&
                        project.chats.map((chat) => (
                          <button
                            key={chat.chatId}
                            type="button"
                            onClick={() => setSelection({ type: "chat", id: chat.chatId })}
                            className={`flex items-center gap-1.5 rounded-[6px] py-1.5 pr-2 pl-7 text-left text-xs transition-colors hover:bg-hover-2/50 ${selection?.type === "chat" && selection.id === chat.chatId ? "bg-hover-2/50 text-foreground" : "text-muted-foreground"}`}
                          >
                            <BubbleChatIcon className="size-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{chat.label}</span>
                          </button>
                        ))}
                    </div>
                  );
                })}
                {standaloneChats.map((chat) => (
                  <button
                    key={chat.chatId}
                    type="button"
                    onClick={() => setSelection({ type: "chat", id: chat.chatId })}
                    className={`flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-xs transition-colors hover:bg-hover-2/50 ${selection?.type === "chat" && selection.id === chat.chatId ? "bg-hover-2/50 text-foreground" : "text-foreground"}`}
                  >
                    <BubbleChatIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{chat.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Right side: the selected project/chat's own files, real file
                tree reused from the earlier flat view (buildTree/TreeView
                are generic over any LibraryFile[], no changes needed
                there). */}
            <div className="min-w-0 flex-1 overflow-y-auto px-4 pt-14 pb-6">
              {selectedFiles === null ? (
                <p className="p-2 text-[13px] text-muted-foreground">Select a project or chat to see its files.</p>
              ) : (
                <PageContent>
                  <TreeView node={buildTree(selectedFiles)} onOpenFile={openFile} />
                </PageContent>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* border-b border-border + bg-background -- per explicit request
          ("we need to add a bottom border to match the right sidebar"),
          matching right-panel.tsx's own header row treatment. bg-background
          keeps the scrolling content below from visually bleeding through
          the border, the same way the right panel's own opaque header sits
          above its scrollable body. */}
      {/* py-2 + items-center, not pt-1 pb-4 -- per explicit follow-up ("the
          topbar should be in the same page height as the right sidebar
          Library | Terminal buttons"): matches right-panel.tsx's own
          header row exactly (py-2, flex items-center), so both headers
          render at the same height instead of just sharing a border. */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center border-b border-border bg-background px-4 py-2">
        <PageContent>
          <span className="text-xs font-normal text-muted-foreground">Library</span>
        </PageContent>
      </div>
    </div>
  );
}
