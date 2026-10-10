import { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { Bot, CircleArrowUp, CircleHelp, Plus, Search } from "lucide-react";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { InboxIcon, IntegrationsIcon, LogInIcon, MessageChatCircleIcon, Settings01Icon, Settings04Icon } from "@/components/icons/untitled-ui";
import { SplitView } from "@/components/design-system/split-view";
import { AppTopBar } from "@/components/app-top-bar";
import { QuickActions, type QuickActionItem } from "@/components/design-system/quick-actions";
import { SidebarSections, type SidebarSection } from "@/components/design-system/sidebar-sections";
import { SidebarSurfaceTransition } from "@/components/design-system/sidebar-surface-transition";
import { GettingStartedSummary, SidebarAccountFooter, type GettingStartedStep } from "@/components/design-system/sidebar-footer";
import { DefaultAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChatPage, type ChatPageShellContext } from "@/pages/ChatPage";
import { HomePage, type HomePageShellContext } from "@/pages/HomePage";
import {
  WorkspaceSelector,
  type WorkspaceMenuAction,
  type WorkspaceOption,
} from "@/components/design-system/workspace-selector";

type WorkspaceRecord = {
  id: string;
  name: string;
  is_personal: boolean;
};

type InboxItem = {
  id: string;
  name: string;
};

type InboxMention = {
  id: number;
  chat_id: string;
  chat_name: string;
};

type Project = {
  id: string;
  name: string;
};

type Chat = {
  id: string;
  name: string;
};

const DEFAULT_WORKSPACE: WorkspaceRecord = {
  id: "personal",
  name: "Alongside",
  is_personal: true,
};

function toWorkspaceOption(workspace: WorkspaceRecord): WorkspaceOption {
  return workspace.is_personal
    ? {
        id: workspace.id,
        name: workspace.name,
    icon: (
      <span className="relative block size-full" aria-hidden="true">
        <AlongsideLogo className="absolute left-1/2 top-1/2 block size-[var(--redesign-workspace-brand-mark-size)] -translate-x-1/2 -translate-y-1/2 !text-black [&_g]:!fill-black" />
      </span>
    ),
    iconSurfaceClassName: "relative !size-[var(--redesign-workspace-brand-surface-size)] rounded-[var(--redesign-workspace-brand-radius)] bg-white",
      }
    : { id: workspace.id, name: workspace.name };
}

const PROFILE_ACTION_SECTIONS: readonly (readonly WorkspaceMenuAction[])[] = [
  [
    { id: "sign-in", label: "Sign in", icon: LogInIcon, onSelect: () => { window.location.assign("/auth"); } },
    { id: "settings", label: "Settings", icon: Settings04Icon },
    { id: "help", label: "Help", icon: CircleHelp },
  ],
  [
    { id: "upgrade", label: "Upgrade plan", icon: CircleArrowUp, tone: "accent" },
  ],
];

const QUICK_ACTIONS: readonly QuickActionItem[] = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "chats", label: "Chats", icon: MessageChatCircleIcon },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "apps", label: "Apps", icon: IntegrationsIcon },
];

const GETTING_STARTED_STEPS: readonly GettingStartedStep[] = [
  { id: "profile", label: "Complete your profile", description: "Add your profile details to personalise Alongside." },
  { id: "data", label: "Acknowledge your data", description: "Review how your local data is stored and protected." },
  { id: "provider", label: "Set up an AI provider", description: "Connect a provider to begin using its models." },
  { id: "chat", label: "Create a chat", description: "Start a new conversation in your workspace." },
];

function quickActionForPath(pathname: string) {
  if (pathname.startsWith("/chat/") || pathname === "/new/chat") return "chats";
  if (pathname === "/apps") return "apps";
  if (pathname === "/agents") return "agents";
  return "inbox";
}

/**
 * An intentionally isolated workspace for the next Alongside design system.
 * It does not inherit the production app shell, allowing the redesign to be
 * built and evaluated without changing the current application.
 */
export function RedesignPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const routedContent = useOutlet({
    chatName: "Untitled chat",
    receiveChatNameFromServer: () => {},
    refreshSidebarLists: () => {},
    openSettings: (section: string) => navigate(`/settings/${section}`),
    openFile: () => {},
    renameOpenFile: () => {},
    notifyFilesTouched: () => {},
    primarySidebarCollapsed: false,
    rightPanelOpen: false,
  });
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([DEFAULT_WORKSPACE]);
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_WORKSPACE.id);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [manageWorkspacesOpen, setManageWorkspacesOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxMentions, setInboxMentions] = useState<InboxMention[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);

  const routeQuickAction = quickActionForPath(location.pathname);

  const activeQuickAction = routeQuickAction;

  const workspaceOptions = workspaces.map(toWorkspaceOption);

  function syncWorkspaces(next: WorkspaceRecord[]) {
    setWorkspaces(next);
    setWorkspaceNames(Object.fromEntries(next.map((workspace) => [workspace.id, workspace.name])));
    setWorkspaceId((current) => next.some((workspace) => workspace.id === current) ? current : DEFAULT_WORKSPACE.id);
  }

  useEffect(() => {
    document.title = "Alongside redesign";
    void fetch("/workspaces")
      .then((response) => response.ok ? response.json() as Promise<WorkspaceRecord[]> : Promise.reject(new Error("Could not load workspaces")))
      .then((loaded) => syncWorkspaces(loaded.length ? loaded : [DEFAULT_WORKSPACE]))
      // The workbench remains usable when the local backend is not running.
      .catch(() => syncWorkspaces([DEFAULT_WORKSPACE]));
  }, []);

  useEffect(() => {
    if (activeQuickAction !== "inbox") return;
    void Promise.all([
      fetch("/inbox-items").then((response) => response.ok ? response.json() as Promise<InboxItem[]> : []),
      fetch("/inbox-mentions").then((response) => response.ok ? response.json() as Promise<InboxMention[]> : []),
    ])
      .then(([items, mentions]) => {
        setInboxItems(items);
        setInboxMentions(mentions);
      })
      .catch(() => {
        setInboxItems([]);
        setInboxMentions([]);
      });
  }, [activeQuickAction]);

  useEffect(() => {
    if (activeQuickAction !== "chats") return;
    void Promise.all([
      fetch("/projects").then((response) => response.ok ? response.json() as Promise<Project[]> : []),
      fetch("/sessions").then((response) => response.ok ? response.json() as Promise<Chat[]> : []),
    ])
      .then(([loadedProjects, loadedChats]) => {
        setProjects(loadedProjects);
        setChats(loadedChats);
        setActiveChatId((current) => loadedChats.some((chat) => chat.id === current) ? current : null);
      })
      .catch(() => {
        setProjects([]);
        setChats([]);
        setActiveChatId(null);
      });
  }, [activeQuickAction]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const redesignChatContext: ChatPageShellContext | undefined = activeChat ? {
    chatName: activeChat.name,
    receiveChatNameFromServer: (name) => {
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, name } : chat));
    },
    refreshSidebarLists: () => {
      void fetch("/sessions")
        .then((response) => response.ok ? response.json() as Promise<Chat[]> : [])
        .then(setChats);
    },
    openSettings: () => {},
    openFile: () => {},
    rightPanelOpen: false,
    notifyFilesTouched: () => {},
  } : undefined;
  const redesignHomeContext: HomePageShellContext = {
    openSettings: () => {},
  };

  function openCreatedChat(sessionId: string) {
    void fetch("/sessions")
      .then((response) => response.ok ? response.json() as Promise<Chat[]> : [])
      .then((loadedChats) => {
        setChats(loadedChats);
        setActiveChatId(sessionId);
      });
  }

  const inboxSidebarSections: readonly SidebarSection[] = [
    {
      id: "mentions",
      label: "Mentions",
      items: inboxMentions.map((mention) => ({ id: `mention-${mention.id}`, label: mention.chat_name })),
      emptyLabel: "No new mentions",
    },
    {
      id: "all",
      label: "All",
      items: inboxItems.map((item) => ({ id: item.id, label: item.name })),
      emptyLabel: "No items available for Inbox",
    },
  ];

  const chatsSidebarSections: readonly SidebarSection[] = [
    {
      id: "projects",
      label: "Projects",
      action: { label: "New project", icon: Plus, onSelect: () => { setProjectError(null); setNewProjectOpen(true); } },
      items: projects.map((project) => ({ id: project.id, label: project.name })),
      emptyLabel: "No projects available",
    },
    {
      id: "chats",
      label: "Chats",
      action: { label: "New chat", icon: Plus, onSelect: () => { setActiveChatId(null); } },
      items: chats.map((chat) => ({ id: chat.id, label: chat.name })),
      emptyLabel: "No chats available",
    },
  ];
  const activeSidebarSurface = activeQuickAction === "inbox" || activeQuickAction === "chats"
    ? activeQuickAction
    : null;
  const redesignSurfaceKey = `${location.pathname}:${location.key}`;

  async function createProject() {
    const name = newProjectName.trim();
    if (!name || saving) return;
    setSaving(true);
    setProjectError(null);
    try {
      const response = await fetch("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Could not create project.");
      const project = await response.json() as Project;
      setProjects((current) => [...current, project]);
      setNewProjectName("");
      setNewProjectOpen(false);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  async function createWorkspace() {
    const name = newWorkspaceName.trim();
    if (!name || saving) return;
    setSaving(true);
    setWorkspaceError(null);
    try {
      const response = await fetch("/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("A workspace with that name may already exist.");
      const workspace = await response.json() as WorkspaceRecord;
      syncWorkspaces([...workspaces, workspace]);
      setWorkspaceId(workspace.id);
      setNewWorkspaceName("");
      setNewWorkspaceOpen(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not create workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function renameWorkspace(workspace: WorkspaceRecord) {
    const name = workspaceNames[workspace.id]?.trim() ?? "";
    if (!name || name === workspace.name || saving) return;
    setSaving(true);
    setWorkspaceError(null);
    try {
      const response = await fetch(`/workspaces/${encodeURIComponent(workspace.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Could not rename workspace.");
      syncWorkspaces(workspaces.map((item) => item.id === workspace.id ? { ...item, name } : item));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not rename workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkspace(workspace: WorkspaceRecord) {
    if (workspace.is_personal || saving || !window.confirm(`Delete ${workspace.name}?`)) return;
    setSaving(true);
    setWorkspaceError(null);
    try {
      const response = await fetch(`/workspaces/${encodeURIComponent(workspace.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete workspace.");
      syncWorkspaces(workspaces.filter((item) => item.id !== workspace.id));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not delete workspace.");
    } finally {
      setSaving(false);
    }
  }

  const workspaceSectionActions: readonly WorkspaceMenuAction[] = [
    { id: "new-workspace", label: "New Workspace", icon: Plus, onSelect: () => { setWorkspaceError(null); setNewWorkspaceOpen(true); } },
    { id: "manage-workspace", label: "Manage workspace", icon: Settings01Icon, onSelect: () => { setWorkspaceError(null); setManageWorkspacesOpen(true); } },
  ];

  return (
    <SplitView
      topBar={
        <AppTopBar
          className="border-b border-[var(--redesign-sidebar-border)] bg-background"
          controlsClassName="absolute right-[var(--redesign-top-bar-controls-right)] gap-1"
          showNotifications={false}
          collapseButtonHover={false}
          collapsed={sidebarCollapsed}
          onCollapseAll={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
        />
      }
      sidebarCollapsed={sidebarCollapsed}
      sidebarContentClassName="!pb-2"
      sidebar={
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-col gap-[var(--redesign-quick-actions-gap)]">
            <div className="flex h-[var(--redesign-workspace-trigger-height)] items-center">
              <WorkspaceSelector
                workspaces={workspaceOptions}
                value={workspaceId}
                onValueChange={setWorkspaceId}
                workspaceSectionActions={workspaceSectionActions}
              actionSections={[]}
                ariaLabel="Select workspace"
              />
              <button
                type="button"
                aria-label="Search"
                className="ml-auto flex size-[var(--redesign-search-control-size)] shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Search aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-search-icon-size)]" />
              </button>
            </div>
            <QuickActions
              label="Quick actions"
              shortcut="K"
              actions={QUICK_ACTIONS}
              activeId={activeQuickAction}
              onActionSelect={(actionId) => {
                if (actionId === "chats") {
                  setActiveChatId(null);
                  navigate("/new/chat");
                  return;
                }
                if (actionId === "inbox") navigate("/inbox");
                if (actionId === "apps") navigate("/apps");
              }}
            />
          {activeSidebarSurface && (
            <SidebarSurfaceTransition surfaceKey={redesignSurfaceKey}>
              <SidebarSections
                sections={activeSidebarSurface === "inbox" ? inboxSidebarSections : chatsSidebarSections}
                activeItemId={activeSidebarSurface === "chats" ? activeChatId ?? undefined : undefined}
                onItemSelect={activeSidebarSurface === "chats" ? (itemId) => {
                  if (chats.some((chat) => chat.id === itemId)) {
                    setActiveChatId(itemId);
                    navigate(`/chat/${itemId}`);
                  }
                } : undefined}
              />
            </SidebarSurfaceTransition>
          )}
          </div>
          <footer className="mt-auto pt-[var(--redesign-sidebar-section-gap)]">
            <GettingStartedSummary label="Getting Started" steps={GETTING_STARTED_STEPS} completedSteps={0} viewAllLabel="View all tasks" />
            <div className="mt-[var(--redesign-sidebar-section-gap)] border-t border-[var(--redesign-sidebar-border)] pt-2">
              <SidebarAccountFooter name="Guest" avatar={<DefaultAvatar name="Guest" />} actionSections={PROFILE_ACTION_SECTIONS} />
            </div>
          </footer>
        </div>
      }
      contentClassName="flex min-h-0 overflow-hidden bg-background"
    >
      <SidebarSurfaceTransition
        className="flex min-h-0 flex-1 bg-background"
        contentClassName="flex min-h-0 w-full flex-1 bg-background"
        surfaceKey={redesignSurfaceKey}
      >
        {routedContent ?? (activeQuickAction === "chats" && activeChat && redesignChatContext ? (
          <ChatPage key={activeChat.id} sessionIdOverride={activeChat.id} shellContextOverride={redesignChatContext} />
        ) : activeQuickAction === "chats" ? (
          <HomePage shellContextOverride={redesignHomeContext} onSessionCreated={openCreatedChat} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {null}
          </div>
        ))}
      </SidebarSurfaceTransition>
      <Dialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
            <DialogDescription>Create a separate place for your work.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newWorkspaceName}
            onChange={(event) => setNewWorkspaceName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void createWorkspace(); }}
            placeholder="Workspace name"
            maxLength={80}
          />
          {workspaceError && <p className="text-sm text-destructive">{workspaceError}</p>}
          <DialogFooter>
            <Button type="button" onClick={() => void createWorkspace()} disabled={!newWorkspaceName.trim() || saving}>Create workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={manageWorkspacesOpen} onOpenChange={setManageWorkspacesOpen}>
        <DialogContent className="max-h-[min(32rem,calc(100vh-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage workspaces</DialogTitle>
            <DialogDescription>Rename or remove the workspaces on this device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="flex items-center gap-2">
                <Input
                  value={workspaceNames[workspace.id] ?? workspace.name}
                  disabled={workspace.is_personal || saving}
                  onChange={(event) => setWorkspaceNames((current) => ({ ...current, [workspace.id]: event.target.value }))}
                />
                {!workspace.is_personal && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void renameWorkspace(workspace)}>Save</Button>}
                {!workspace.is_personal && <Button type="button" size="sm" variant="destructive" disabled={saving} onClick={() => void deleteWorkspace(workspace)}>Delete</Button>}
              </div>
            ))}
          </div>
          {workspaceError && <p className="text-sm text-destructive">{workspaceError}</p>}
        </DialogContent>
      </Dialog>
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Create a project to organise related chats.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void createProject(); }}
            placeholder="Project name"
            maxLength={80}
          />
          {projectError && <p className="text-sm text-destructive">{projectError}</p>}
          <DialogFooter>
            <Button type="button" onClick={() => void createProject()} disabled={!newProjectName.trim() || saving}>Create project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SplitView>
  );
}
