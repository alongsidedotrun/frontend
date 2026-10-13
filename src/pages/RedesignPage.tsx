import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { ICON_PRESS, PRESS_EFFECT } from "@/lib/press-effect";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CircleArrowUp, CircleHelp, Plus, Search, ShieldCheck } from "lucide-react";
import { WorkspaceBrandIcon, workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import { CreateWorkspaceDialog } from "@/components/design-system/create-workspace-dialog";
import { SignInDialog } from "@/components/design-system/sign-in-dialog";
import { useSignInDialogHost } from "@/lib/use-sign-in";
import { useIdentity } from "@/lib/identity";
import { signOut } from "@/lib/auth";
import { moveLocalWorkspaceDetailsToBackend } from "@/lib/workspace-logos";
import { ManageWorkspaceDialog, type WorkspaceChange } from "@/components/design-system/manage-workspace-dialog";
import { BubbleChatIcon, IntegrationsIcon, LogOutIcon, MessageChatCircleIcon, PaletteIcon, ProvidersIcon, Settings01Icon, SettingsIcon, UserIcon } from "@/components/icons/untitled-ui";
import { SplitView } from "@/components/design-system/split-view";
import { AppTopBar } from "@/components/app-top-bar";
import { QuickActions, type QuickActionItem } from "@/components/design-system/quick-actions";
import { SidebarSections, type SidebarSection } from "@/components/design-system/sidebar-sections";
import { SidebarSurfaceTransition } from "@/components/design-system/sidebar-surface-transition";
import { GettingStartedSummary, SidebarAccountFooter, type GettingStartedStep } from "@/components/design-system/sidebar-footer";
import { SettingsSidebarNav, type SettingsSection } from "@/components/settings-overlay";
import { DefaultAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChatPage, type ChatPageShellContext } from "@/pages/ChatPage";
import { HomePage, type HomePageShellContext } from "@/pages/HomePage";
import { CommandMenuDemo } from "@/components/command-menu-demo";
import type { CommandMenuItemData } from "@/components/ui/command-menu";
import {
  WorkspaceSelector,
  type WorkspaceMenuAction,
  type WorkspaceOption,
} from "@/components/design-system/workspace-selector";

type WorkspaceRecord = {
  id: string;
  name: string;
  is_personal: boolean;
  logo?: string | null;
  description?: string | null;
  color?: number | null;
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
  project_id?: string | null;
};

const DEFAULT_WORKSPACE: WorkspaceRecord = {
  id: "personal",
  name: "Personal",
  is_personal: true,
};

function toWorkspaceOption(workspace: WorkspaceRecord): WorkspaceOption {
  // Without a logo the tile is the name's first letter on its picked colour
  // (or the name's own colour when none was picked).
  const logo = workspace.logo ?? null;
  const monogram = workspaceMonogram(workspace.name, workspace.color ?? null);
  const icon = logo
    ? <WorkspaceBrandIcon size={18} imageSrc={logo} />
    : monogram
      ? <WorkspaceBrandIcon size={18} monogram={monogram} />
      : undefined;
  return { id: workspace.id, name: workspace.name, icon };
}

type Translate = TFunction;

// Profile menu, shown once signed in by clicking the profile in the sidebar.
function profileMenuSections(t: Translate, onOpenProfile: () => void, onSignOut: () => void): readonly (readonly WorkspaceMenuAction[])[] {
  return [
    [
      { id: "profile", label: t("settings.nav.profile"), icon: UserIcon, onSelect: onOpenProfile },
      { id: "help", label: t("nav.helpItem"), icon: CircleHelp },
      { id: "upgrade", label: t("shell.profileMenu.upgradePlan"), icon: CircleArrowUp, tone: "accent" },
    ],
    [
      { id: "sign-out", label: t("shell.profileMenu.signOut"), icon: LogOutIcon, onSelect: onSignOut },
    ],
  ];
}

const quickActions = (t: Translate): readonly QuickActionItem[] => [
  { id: "chats", label: t("common.newChat"), icon: Plus },
];

const GETTING_STARTED_STEP_IDS = ["profile", "data", "provider", "chat"] as const;
const gettingStartedSteps = (t: Translate): readonly GettingStartedStep[] =>
  GETTING_STARTED_STEP_IDS.map((id) => ({
    id,
    label: t(`shell.gettingStarted.${id}.label`),
    description: t(`shell.gettingStarted.${id}.description`),
  }));

// Quick actions entries for each settings page, in the order they're listed
// there. Labels are the settings pages' own names; keywords stay English
// (extra search terms on top of the translated label and description).
const SETTINGS_COMMANDS: readonly { section: SettingsSection; labelKey: string; icon: IconComponent; keywords: string[] }[] = [
  { section: "general", labelKey: "settings.nav.general", icon: SettingsIcon, keywords: ["language", "timezone", "notifications", "tips"] },
  { section: "appearance", labelKey: "settings.nav.appearance", icon: PaletteIcon, keywords: ["theme", "dark", "light", "font", "transparency"] },
  { section: "chat", labelKey: "settings.nav.chat", icon: BubbleChatIcon, keywords: ["provider", "effort", "usage"] },
  { section: "profile", labelKey: "settings.nav.profile", icon: UserIcon, keywords: ["account", "picture", "sign in", "log out"] },
  { section: "security", labelKey: "settings.nav.security", icon: ShieldCheck, keywords: ["privacy", "encryption", "data"] },
  { section: "provider", labelKey: "settings.nav.provider", icon: ProvidersIcon, keywords: ["models", "api key", "ai"] },
  { section: "apps", labelKey: "settings.nav.apps", icon: IntegrationsIcon, keywords: ["integrations", "connect"] },
];

const SETTINGS_SECTIONS: readonly SettingsSection[] = ["profile", "general", "appearance", "chat", "security", "provider", "apps"];

function quickActionForPath(pathname: string) {
  if (pathname === "/overview") return "overview";
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
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const appHistoryRef = useRef<string[]>([location.pathname + location.search]);
  const appHistoryIndexRef = useRef(0);
  const appHistoryNavigationRef = useRef(false);
  const [, setAppHistoryVersion] = useState(0);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([DEFAULT_WORKSPACE]);
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_WORKSPACE.id);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  // Sign-in is a dialog over the shell (also opened from Settings via
  // openSignInDialog in lib/use-sign-in.ts).
  const [signInOpen, setSignInOpen] = useState(false);
  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const identity = useIdentity();
  useSignInDialogHost(openSignIn);
  const [manageWorkspacesOpen, setManageWorkspacesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  // Whether workspaceError is about the name (shown under the Name field)
  // rather than the save as a whole (shown by the Save button).
  const [workspaceNameTaken, setWorkspaceNameTaken] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxMentions, setInboxMentions] = useState<InboxMention[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // A session exists before its first message, while GET /sessions
  // deliberately lists only chats with real content. Keep that short-lived
  // local row so the newly-created chat can mount, send its queued message,
  // and be visible in the sidebar straight away.
  const pendingChatIdsRef = useRef(new Set<string>());

  function applyLoadedChats(loadedChats: Chat[]) {
    setChats((current) => {
      const loadedIds = new Set(loadedChats.map((chat) => chat.id));
      for (const id of loadedIds) pendingChatIdsRef.current.delete(id);
      const pending = current.filter(
        (chat) => pendingChatIdsRef.current.has(chat.id) && !loadedIds.has(chat.id),
      );
      return [...pending, ...loadedChats];
    });
  }

  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? DEFAULT_WORKSPACE;
  const routeChatId = location.pathname.startsWith("/chat/")
    ? decodeURIComponent(location.pathname.slice("/chat/".length))
    : null;
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const settingsPathSection = location.pathname.split("/")[2] as SettingsSection | undefined;
  const settingsSection = settingsPathSection && SETTINGS_SECTIONS.includes(settingsPathSection)
    ? settingsPathSection
    : "general";
  const activeChat = chats.find((chat) => chat.id === (routeChatId ?? activeChatId)) ?? null;
  const routedContent = useOutlet({
    chatName: activeChat?.name ?? t("shell.untitledChat"),
    contextLabel: activeChat?.name ?? t("shell.untitledChat"),
    receiveChatNameFromServer: (name: string) => {
      const chatId = routeChatId ?? activeChatId;
      if (!chatId) return;
      setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, name } : chat));
    },
    refreshSidebarLists: () => {
      void fetch("/sessions")
        .then((response) => response.ok ? response.json() as Promise<Chat[]> : [])
        .then(applyLoadedChats);
    },
    openSettings: (section: string) => navigate(`/settings/${section}`),
    openFile: () => {},
    renameOpenFile: () => {},
    notifyFilesTouched: () => {},
    primarySidebarCollapsed: false,
    rightPanelOpen: false,
    workspaceName: activeWorkspace.name,
    workspaceLogo: activeWorkspace.logo ?? null,
    workspaceColor: activeWorkspace.color ?? null,
  });

  const currentAppPath = location.pathname + location.search;
  const routeQuickAction = quickActionForPath(location.pathname);

  const activeQuickAction = routeQuickAction;

  const workspaceOptions = workspaces.map(toWorkspaceOption);

  useEffect(() => {
    const history = appHistoryRef.current;
    const index = appHistoryIndexRef.current;
    if (appHistoryNavigationRef.current) {
      appHistoryNavigationRef.current = false;
      return;
    }
    if (history[index] === currentAppPath) return;
    appHistoryRef.current = [...history.slice(0, index + 1), currentAppPath];
    appHistoryIndexRef.current = appHistoryRef.current.length - 1;
    setAppHistoryVersion((version) => version + 1);
  }, [currentAppPath]);

  function goBackInApp() {
    const nextIndex = appHistoryIndexRef.current - 1;
    if (nextIndex < 0) return;
    appHistoryNavigationRef.current = true;
    appHistoryIndexRef.current = nextIndex;
    setAppHistoryVersion((version) => version + 1);
    navigate(appHistoryRef.current[nextIndex], { replace: true });
  }

  function goForwardInApp() {
    const nextIndex = appHistoryIndexRef.current + 1;
    if (nextIndex >= appHistoryRef.current.length) return;
    appHistoryNavigationRef.current = true;
    appHistoryIndexRef.current = nextIndex;
    setAppHistoryVersion((version) => version + 1);
    navigate(appHistoryRef.current[nextIndex], { replace: true });
  }

  function syncWorkspaces(next: WorkspaceRecord[]) {
    setWorkspaces(next);
    // Stay on the current workspace while it still exists; otherwise go to the first.
    setWorkspaceId((current) => next.some((workspace) => workspace.id === current) ? current : (next[0] ?? DEFAULT_WORKSPACE).id);
  }


  useEffect(() => {
    void fetch("/workspaces")
      .then((response) => response.ok ? response.json() as Promise<WorkspaceRecord[]> : Promise.reject(new Error("Could not load workspaces")))
      // Logos, descriptions and colours saved in this browser before the
      // backend kept them move there once (lib/workspace-logos.ts).
      .then((loaded) => moveLocalWorkspaceDetailsToBackend(loaded))
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
        applyLoadedChats(loadedChats);
        setActiveChatId((current) =>
          current && (loadedChats.some((chat) => chat.id === current) || pendingChatIdsRef.current.has(current))
            ? current
            : null,
        );
      })
      .catch(() => {
        setProjects([]);
        setChats([]);
        setActiveChatId(null);
      });
  }, [activeQuickAction]);

  const redesignChatContext: ChatPageShellContext | undefined = activeChat ? {
    chatName: activeChat.name,
    contextLabel: activeChat.name,
    receiveChatNameFromServer: (name) => {
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, name } : chat));
    },
    refreshSidebarLists: () => {
      void fetch("/sessions")
        .then((response) => response.ok ? response.json() as Promise<Chat[]> : [])
        .then(applyLoadedChats);
    },
    openSettings: () => {},
    openFile: () => {},
    rightPanelOpen: false,
    notifyFilesTouched: () => {},
  } : undefined;
  const redesignHomeContext: HomePageShellContext = {
    openSettings: () => {},
    workspaceName: activeWorkspace.name,
    workspaceLogo: activeWorkspace.logo ?? null,
    workspaceColor: activeWorkspace.color ?? null,
  };

  function openCreatedChat(sessionId: string) {
    pendingChatIdsRef.current.add(sessionId);
    setChats((current) => current.some((chat) => chat.id === sessionId)
      ? current
      : [{ id: sessionId, name: t("shell.untitledChat") }, ...current]);
    setActiveChatId(sessionId);
    void fetch("/sessions")
      .then((response) => response.ok ? response.json() as Promise<Chat[]> : [])
      .then(applyLoadedChats);
  }

  const inboxSidebarSections: readonly SidebarSection[] = [
    {
      id: "mentions",
      label: t("shell.sections.mentions"),
      items: inboxMentions.map((mention) => ({ id: `mention-${mention.id}`, label: mention.chat_name })),
      emptyLabel: t("shell.sections.noMentions"),
    },
    {
      id: "all",
      label: t("shell.sections.all"),
      items: inboxItems.map((item) => ({ id: item.id, label: item.name })),
      emptyLabel: t("shell.sections.noInboxItems"),
    },
  ];

  const chatsSidebarSections: readonly SidebarSection[] = [
    {
      id: "projects",
      label: t("nav.projects"),
      action: { label: t("nav.newProject.ariaLabel"), icon: Plus, onSelect: () => { setProjectError(null); setNewProjectOpen(true); } },
      items: projects.map((project) => ({ id: project.id, label: project.name })),
      emptyLabel: t("shell.sections.noProjects"),
    },
    {
      id: "chats",
      label: t("nav.chats"),
      action: { label: t("common.newChat"), icon: Plus, onSelect: () => { setActiveChatId(null); } },
      items: chats.map((chat) => ({ id: chat.id, label: chat.name })),
      emptyLabel: t("shell.sections.noChats"),
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
      if (!response.ok) throw new Error(t("shell.newProject.error"));
      const project = await response.json() as Project;
      setProjects((current) => [...current, project]);
      setNewProjectName("");
      setNewProjectOpen(false);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : t("shell.newProject.error"));
    } finally {
      setSaving(false);
    }
  }

  async function createWorkspace(name: string, logo: string | null, description: string | null, colorIndex: number | null) {
    if (!name || saving) return;
    setSaving(true);
    setWorkspaceError(null);
    try {
      const response = await fetch("/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logo, description, color: colorIndex }),
      });
      if (!response.ok) throw new Error(t("workspace.errors.nameExists"));
      const workspace = await response.json() as WorkspaceRecord;
      syncWorkspaces([...workspaces, workspace]);
      setWorkspaceId(workspace.id);
      setNewWorkspaceOpen(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : t("workspace.errors.create"));
    } finally {
      setSaving(false);
    }
  }

  // Manage workspace's save: sends only the fields that changed.
  async function updateWorkspace(workspace: WorkspaceRecord, change: WorkspaceChange) {
    if (saving) return;
    setSaving(true);
    setWorkspaceError(null);
    setWorkspaceNameTaken(false);
    try {
      const response = await fetch(`/workspaces/${encodeURIComponent(workspace.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      setWorkspaceNameTaken(response.status === 409);
      if (response.status === 409) throw new Error(t("workspace.errors.nameTaken"));
      if (!response.ok) throw new Error(t("workspace.errors.save"));
      syncWorkspaces(workspaces.map((item) => item.id === workspace.id ? { ...item, ...change, name: change.name ?? item.name } : item));
      setManageWorkspacesOpen(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : t("workspace.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkspace(workspace: WorkspaceRecord) {
    if (saving) return;
    setSaving(true);
    setWorkspaceError(null);
    setWorkspaceNameTaken(false);
    try {
      const response = await fetch(`/workspaces/${encodeURIComponent(workspace.id)}`, { method: "DELETE" });
      if (response.status === 409) throw new Error(t("workspace.errors.onlyWorkspace"));
      if (!response.ok) throw new Error(t("workspace.errors.delete"));
      // Moves to the first remaining workspace (syncWorkspaces).
      syncWorkspaces(workspaces.filter((item) => item.id !== workspace.id));
      setManageWorkspacesOpen(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : t("workspace.errors.delete"));
    } finally {
      setSaving(false);
    }
  }

  const workspaceSectionActions: readonly WorkspaceMenuAction[] = [
    { id: "new-workspace", label: t("workspace.new"), icon: Plus, onSelect: () => { setWorkspaceError(null); setNewWorkspaceOpen(true); } },
    { id: "manage-workspace", label: t("workspace.manage"), icon: Settings01Icon, onSelect: () => { setWorkspaceError(null); setWorkspaceNameTaken(false); setManageWorkspacesOpen(true); } },
  ];
  const commandMenuItems = useMemo<CommandMenuItemData[]>(() => [
    {
      value: "new-chat",
      label: t("common.newChat"),
      description: t("shell.commands.newChat.description"),
      icon: Plus,
      shortcut: "mod+n",
      keywords: ["compose", "start", "conversation"],
      group: t("shell.commands.group.actions"),
      onSelect: () => {
        setActiveChatId(null);
        navigate("/new/chat");
      },
    },
    {
      value: "new-project",
      label: t("nav.newProject.ariaLabel"),
      description: t("shell.commands.newProject.description"),
      icon: Plus,
      keywords: ["create", "organise", "workspace"],
      group: t("shell.commands.group.actions"),
      onSelect: () => {
        setProjectError(null);
        setNewProjectOpen(true);
      },
    },
    {
      value: "settings",
      label: t("nav.settings"),
      description: t("shell.commands.settings.description"),
      icon: SettingsIcon,
      shortcut: "mod+,",
      keywords: ["preferences", "account"],
      group: t("nav.settings"),
      onSelect: () => navigate("/settings/general"),
    },
    // Each settings page on its own, straight to that page.
    ...SETTINGS_COMMANDS.map(({ section, labelKey, icon, keywords }) => ({
      value: `settings-${section}`,
      label: t(labelKey),
      description: t(`shell.commands.${section}.description`),
      icon,
      keywords: ["settings", ...keywords],
      group: t("nav.settings"),
      onSelect: () => navigate(`/settings/${section}`),
    })),
    ...chats.map((chat) => ({
      value: `chat-${chat.id}`,
      label: chat.name,
      description: t("shell.commands.openChat"),
      icon: MessageChatCircleIcon,
      keywords: ["conversation", "recent"],
      group: t("nav.chats"),
      onSelect: () => {
        if (chat.id === (routeChatId ?? activeChatId)) return;
        setActiveChatId(chat.id);
        navigate(`/chat/${chat.id}`);
      },
    })),
  ], [activeChatId, chats, navigate, routeChatId, t]);

  return (
    <>
    <SplitView
      topBar={
        <AppTopBar
          className="border-b border-[var(--redesign-sidebar-border)] bg-background before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[var(--redesign-sidebar-width)] before:bg-[var(--redesign-sidebar-surface)] after:pointer-events-none after:absolute after:inset-y-0 after:left-[calc(var(--redesign-sidebar-width)-1px)] after:w-px after:bg-[var(--redesign-sidebar-border)]"
          controlsClassName="absolute right-[var(--redesign-top-bar-controls-right)] gap-1"
          showNotifications={false}
          collapseButtonHover={false}
          collapsed={sidebarCollapsed}
          canGoBack={appHistoryIndexRef.current > 0}
          canGoForward={appHistoryIndexRef.current < appHistoryRef.current.length - 1}
          onBack={goBackInApp}
          onForward={goForwardInApp}
          onCollapseAll={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
        />
      }
      sidebarCollapsed={isSettingsRoute ? false : sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
      sidebarContentClassName="!pb-2"
      sidebar={
        <SidebarSurfaceTransition
          surfaceKey={isSettingsRoute ? "settings" : "chats"}
          className="flex h-full min-h-0 w-full bg-[var(--redesign-sidebar-surface)]"
          contentClassName="flex h-full min-h-0 w-full"
        >
          {isSettingsRoute ? <SettingsSidebarNav section={settingsSection} variant="redesign" /> :
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className="flex flex-col gap-[var(--redesign-quick-actions-gap)]">
            <div className="flex h-[var(--redesign-workspace-trigger-height)] items-center">
              <WorkspaceSelector
                workspaces={workspaceOptions}
                value={workspaceId}
                onValueChange={setWorkspaceId}
                workspaceSectionActions={workspaceSectionActions}
              actionSections={[]}
                ariaLabel={t("shell.selectWorkspace")}
              />
              <button
                type="button"
                aria-label={t("nav.search.ariaLabel")}
                className={cn("ml-auto flex size-[var(--redesign-search-control-size)] shrink-0 items-center justify-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", PRESS_EFFECT, ICON_PRESS)}
              >
                <Search aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-search-icon-size)]" />
              </button>
            </div>
            <QuickActions
              label={t("shell.quickActions")}
              shortcut="K"
              actions={quickActions(t)}
              activeId={location.pathname === "/new/chat" ? "chats" : undefined}
              onOpen={() => setQuickActionsOpen(true)}
              onActionSelect={(actionId) => {
                if (actionId === "chats") {
                  // Already on an empty new chat: nothing to do. Navigating to
                  // the same route would push a duplicate entry and re-render
                  // the page for no change.
                  if (location.pathname === "/new/chat" && !activeChatId) return;
                  setActiveChatId(null);
                  navigate("/new/chat");
                }
              }}
            />
          {/* A chat route and the new-chat composer share this exact sidebar.
              Keying it by the route made clicking Chats fade and rebuild an
              unchanged list; only switch its surface when the section itself
              changes. */}
          {activeSidebarSurface && (
            <SidebarSurfaceTransition surfaceKey={activeSidebarSurface} className="bg-[var(--redesign-sidebar-surface)]">
              <SidebarSections
                sections={activeSidebarSurface === "inbox" ? inboxSidebarSections : chatsSidebarSections}
                activeItemId={activeSidebarSurface === "chats" ? routeChatId ?? activeChatId ?? undefined : undefined}
                onItemSelect={activeSidebarSurface === "chats" ? (itemId) => {
                  // Navigating to the exact same chat creates a new location key,
                  // which in turn replays the routed chat surface. An active row
                  // is already open, so it is deliberately a no-op.
                  if (itemId === (routeChatId ?? activeChatId)) return;
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
            <GettingStartedSummary label={t("shell.gettingStarted.label")} steps={gettingStartedSteps(t)} completedSteps={0} />
            <div className="-mx-[var(--redesign-sidebar-edge-padding)] mt-[var(--redesign-sidebar-section-gap)] border-t border-[var(--redesign-sidebar-border)] px-[var(--redesign-sidebar-edge-padding)] pt-2">
              <SidebarAccountFooter
                signedIn={identity.signedIn}
                onSignIn={openSignIn}
                name={identity.displayName ?? ""}
                avatar={<DefaultAvatar name={identity.displayName ?? ""} />}
                onOpenSettings={() => navigate("/settings/general")}
                profileSections={profileMenuSections(t, () => navigate("/settings/profile"), () => signOut())}
              />
            </div>
          </footer>
          </div>}
        </SidebarSurfaceTransition>
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
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
      <CreateWorkspaceDialog
        open={newWorkspaceOpen}
        onOpenChange={setNewWorkspaceOpen}
        onCreate={createWorkspace}
        saving={saving}
        error={workspaceError}
      />
      <ManageWorkspaceDialog
        open={manageWorkspacesOpen}
        onOpenChange={setManageWorkspacesOpen}
        workspace={activeWorkspace}
        onSave={(change) => updateWorkspace(activeWorkspace, change)}
        onDelete={() => deleteWorkspace(activeWorkspace)}
        canDelete={workspaces.length > 1}
        saving={saving}
        error={workspaceNameTaken ? null : workspaceError}
        nameError={workspaceNameTaken ? workspaceError : null}
      />
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("nav.newProject.ariaLabel")}</DialogTitle>
            <DialogDescription>{t("shell.newProject.description")}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void createProject(); }}
            placeholder={t("shell.newProject.placeholder")}
            maxLength={80}
          />
          {projectError && <p className="text-sm text-destructive">{projectError}</p>}
          <DialogFooter>
            <Button type="button" onClick={() => void createProject()} disabled={!newProjectName.trim() || saving}>{t("shell.newProject.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SplitView>
    <CommandMenuDemo
      open={quickActionsOpen}
      onOpenChange={setQuickActionsOpen}
      items={commandMenuItems}
    />
    </>
  );
}
