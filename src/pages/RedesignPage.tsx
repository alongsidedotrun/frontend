import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { forcedNoProvider } from "@/lib/dev-no-provider";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ChevronRight, CircleArrowUp, CircleHelp, Plus } from "lucide-react";
import { JoinChatIcon } from "@/components/icons/join-chat-icon";
import { BotIcon } from "@/components/icons/bot-icon";
import { Star01 } from "@untitledui/icons";
import { BotFace, type BotAvatar } from "@/components/bot-face";
import { NewAgentDialog } from "@/components/new-agent-dialog";
import { showErrorToast } from "@/components/ui/app-toast";
import { deleteBot, openBotChat, updateBot, useBots, type Bot } from "@/lib/bots";
import { WorkspaceBrandIcon, workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import { CreateWorkspaceDialog } from "@/components/design-system/create-workspace-dialog";
import { CreateProjectDialog } from "@/components/design-system/create-project-dialog";
import { SignInDialog } from "@/components/design-system/sign-in-dialog";
import { ShareChatDialog } from "@/components/design-system/share-chat-dialog";
import { JoinChatDialog } from "@/components/design-system/join-chat-dialog";
import { JoinRequestsCard } from "@/components/design-system/join-requests-card";
import { useShareDialogHost } from "@/lib/use-share";
import { useSignInDialogHost } from "@/lib/use-sign-in";
import { useIdentity } from "@/lib/identity";
import { signOut } from "@/lib/auth";
import { moveLocalWorkspaceDetailsToBackend } from "@/lib/workspace-logos";
import { ManageWorkspaceDialog, type WorkspaceChange } from "@/components/design-system/manage-workspace-dialog";
import { ArchiveIcon, DeleteIcon, SkillIcon, BubbleChatIcon, EditIcon, FolderIcon, WorkspacesIcon, IntegrationsIcon, LogOutIcon, MessageChatCircleIcon, PaletteIcon, ProvidersIcon, Settings01Icon, SettingsIcon, UserIcon } from "@/components/icons/untitled-ui";
import { SplitView } from "@/components/design-system/split-view";
import { AppTopBar } from "@/components/app-top-bar";
import { QuickActions, type QuickActionItem } from "@/components/design-system/quick-actions";
import { SidebarSections, type SidebarItemMenuEntry, type SidebarSection, type SidebarSectionItem } from "@/components/design-system/sidebar-sections";
import { SidebarSurfaceTransition } from "@/components/design-system/sidebar-surface-transition";
import { GettingStartedSummary, SidebarAccountFooter, type GettingStartedStep } from "@/components/design-system/sidebar-footer";
import { SettingsSidebarNav, type SettingsSection } from "@/components/settings-overlay";
import { DefaultAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  workspace_id?: string | null;
};

type Chat = {
  id: string;
  name: string;
  project_id?: string | null;
  workspace_id?: string | null;
  // #504: the bot this chat talks to, and when it was last active (Recents).
  bot_id?: string | null;
  last_activity?: string | null;
};

// How many chats Recents shows.
const RECENTS_SIZE = 5;

// A bot's face as a sidebar row icon, one component per look so rows don't remount on every render.
const botIcons = new Map<string, IconComponent>();
function botRowIcon(avatar: BotAvatar | null): IconComponent {
  const key = JSON.stringify(avatar);
  let icon = botIcons.get(key);
  if (!icon) {
    icon = ({ className }: { className?: string }) => <BotFace avatar={avatar ?? undefined} className={className} />;
    botIcons.set(key, icon);
  }
  return icon;
}

const DEFAULT_WORKSPACE: WorkspaceRecord = {
  id: "personal",
  name: "Alongside",
  is_personal: true,
  logo: "/favicon.svg",
};

function toWorkspaceOption(workspace: WorkspaceRecord): WorkspaceOption {
  // Without a logo the tile is the name's first letter on its picked colour
  // (or the name's own colour when none was picked).
  const logo = workspace.logo ?? null;
  const monogram = workspaceMonogram(workspace.name, workspace.color ?? null);
  const icon = logo
    ? <WorkspaceBrandIcon size={20} imageSrc={logo} />
    : monogram
      ? <WorkspaceBrandIcon size={20} monogram={monogram} />
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

// New (a chat or a bot, #504), and under it Join chat (someone else's, with their chat ID and
// join code -- JoinChatDialog).
const quickActions = (t: Translate): readonly QuickActionItem[] => [
  { id: "chats", label: t("shell.new"), icon: Plus },
  { id: "join", label: t("joinChat.title"), icon: JoinChatIcon },
];

// Getting started follows the first-run journey, with each step backed by the
// corresponding real account, provider, project, chat, workspace or relay state.
// Setting up a provider comes first: nothing that needs a model works without one.
const GETTING_STARTED_STEP_IDS = ["provider", "account", "project", "chat", "workspace", "multiplayer"] as const;
const GETTING_STARTED_DONE_KEY = "alongside_getting_started_done";
const GETTING_STARTED_DISMISSED_KEY = "alongside_getting_started_dismissed";

// A Getting started value for one account ("<key>:<account>"). What was saved before progress was
// per account goes to the first account that reads it, like the chats on this device did.
function readGettingStarted(scopedKey: string): string | null {
  try {
    const found = localStorage.getItem(scopedKey);
    if (found !== null) return found;
    const [key, scope] = [scopedKey.slice(0, scopedKey.lastIndexOf(":")), scopedKey.slice(scopedKey.lastIndexOf(":") + 1)];
    const legacy = localStorage.getItem(key);
    if (legacy === null || scope === "local") return null;
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(key);
    return legacy;
  } catch {
    return null;
  }
}

function parseDone(raw: string | null): string[] {
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
const EXPANDED_PROJECTS_KEY = "alongside_expanded_projects";
type GettingStartedStepId = (typeof GETTING_STARTED_STEP_IDS)[number];
const gettingStartedSteps = (
  t: Translate,
  done: Record<GettingStartedStepId, boolean>,
  open: Record<GettingStartedStepId, () => void>,
): readonly GettingStartedStep[] =>
  GETTING_STARTED_STEP_IDS.map((id) => ({
    id,
    label: t(`shell.gettingStarted.${id}.label`),
    description: t(`shell.gettingStarted.${id}.description`),
    complete: done[id],
    onSelect: open[id],
  }));

// Quick actions entries for each settings page, in the order they're listed
// there. Labels are the settings pages' own names; keywords stay English
// (extra search terms on top of the translated label and description).
const SETTINGS_COMMANDS: readonly { section: SettingsSection; labelKey: string; icon: IconComponent; keywords: string[] }[] = [
  { section: "general", labelKey: "settings.nav.general", icon: SettingsIcon, keywords: ["language", "timezone", "notifications", "tips"] },
  { section: "appearance", labelKey: "settings.nav.appearance", icon: PaletteIcon, keywords: ["theme", "dark", "light", "font", "transparency"] },
  { section: "chat", labelKey: "settings.nav.chat", icon: BubbleChatIcon, keywords: ["provider", "effort", "usage"] },
  { section: "profile", labelKey: "settings.nav.profile", icon: UserIcon, keywords: ["account", "picture", "sign in", "log out"] },
  { section: "provider", labelKey: "settings.nav.provider", icon: ProvidersIcon, keywords: ["models", "api key", "ai"] },
  { section: "apps", labelKey: "settings.nav.apps", icon: IntegrationsIcon, keywords: ["integrations", "connect"] },
  { section: "skills", labelKey: "settings.nav.skills", icon: SkillIcon, keywords: ["skill", "add skill", "import", "instructions"] },
  { section: "archived-workspaces", labelKey: "settings.archived.workspaces.title", icon: WorkspacesIcon, keywords: ["archived", "restore", "delete", "workspace"] },
  { section: "archived-projects", labelKey: "settings.archived.projects.title", icon: FolderIcon, keywords: ["archived", "restore", "delete", "project"] },
  { section: "archived-chats", labelKey: "settings.archived.chats.title", icon: MessageChatCircleIcon, keywords: ["archived", "restore", "delete", "chat"] },
];

const SETTINGS_SECTIONS: readonly SettingsSection[] = ["profile", "general", "appearance", "chat", "provider", "apps", "skills", "archived-workspaces", "archived-projects", "archived-chats"];

function quickActionForPath(pathname: string) {
  if (pathname === "/overview") return "overview";
  if (pathname.startsWith("/chat/") || pathname === "/") return "chats";
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
  // Share (for the chat it was opened on) and Join chat, also opened from the
  // chat page's /share and Quick actions (lib/use-share.ts).
  const [shareChatId, setShareChatId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const openShare = useCallback((chatId: string) => {
    setShareChatId(chatId);
    setShareOpen(true);
  }, []);
  const openJoin = useCallback(() => setJoinOpen(true), []);
  useShareDialogHost(openShare, openJoin);
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
  // Getting started's own checks: any provider CLI connected, and a chat
  // shared or joined through the relay. Re-read on each navigation; both are cheap local calls.
  // Whether any provider is connected: null until the first check answers, so nothing is gated on a guess.
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  // Checked again when the window comes back into focus (a provider connected in a terminal, say).
  const [providerCheck, setProviderCheck] = useState(0);
  useEffect(() => {
    const recheck = () => setProviderCheck((count) => count + 1);
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, []);
  // Sidebar row menus: the project awaiting delete confirmation, and the chat
  // to add to the project being created from its "New project…" entry.
  const [projectToArchive, setProjectToArchive] = useState<Project | null>(null);
  const [chatForNewProject, setChatForNewProject] = useState<string | null>(null);
  // Projects open in the sidebar, remembered on this device.
  const [expandedProjects, setExpandedProjects] = useState<ReadonlySet<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED_PROJECTS_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const toggleProjectExpanded = useCallback((projectId: string) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      try {
        localStorage.setItem(EXPANDED_PROJECTS_KEY, JSON.stringify([...next]));
      } catch {
        // storage blocked: stays open for this session
      }
      return next;
    });
  }, []);
  const [sharedOnce, setSharedOnce] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  // Kept after closing, so the dialog's closing fade still shows the bot.
  const [botToEdit, setBotToEdit] = useState<Bot | null>(null);
  const [botEditOpen, setBotEditOpen] = useState(false);
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
  const workspaceProjects = projects.filter((project) => project.workspace_id === activeWorkspace.id);
  const workspaceChats = chats.filter((chat) => chat.workspace_id === activeWorkspace.id);
  const bots = useBots(identity.scope);
  const botsById = new Map(bots.map((bot) => [bot.id, bot]));
  // A bot's chat is called by the bot's name, whatever the chat was named.
  const chatTitle = (chat: Chat) => (chat.bot_id && botsById.get(chat.bot_id)?.name) || chat.name;
  const routeChatId = location.pathname.startsWith("/chat/")
    ? decodeURIComponent(location.pathname.slice("/chat/".length))
    : null;
  // The open chat's project unfolds, so its row is never hidden. Not saved:
  // closing the project again is the user's choice.
  const openChatProjectId = chats.find((chat) => chat.id === (routeChatId ?? activeChatId))?.project_id ?? null;
  useEffect(() => {
    if (!openChatProjectId) return;
    setExpandedProjects((current) => (current.has(openChatProjectId) ? current : new Set(current).add(openChatProjectId)));
  }, [openChatProjectId]);
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const settingsPathSection = location.pathname.split("/")[2] as SettingsSection | undefined;
  const settingsSection = settingsPathSection && SETTINGS_SECTIONS.includes(settingsPathSection)
    ? settingsPathSection
    : "general";
  const activeChat = chats.find((chat) => chat.id === (routeChatId ?? activeChatId)) ?? null;
  const activeBot = activeChat?.bot_id ? botsById.get(activeChat.bot_id) : undefined;
  const routedContent = useOutlet({
    chatName: activeChat ? chatTitle(activeChat) : t("shell.untitledChat"),
    // Whether a provider is connected (null: not known yet); the New page and chats gate on false.
    providerReady,
    bot: activeBot ? { name: activeBot.name, avatar: activeBot.avatar } : undefined,
    // No contextLabel: the chat's name (and project) shows in the top bar.
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
    // #504: New > Bot opens the bot's chat once it's made.
    onBotCreated: (bot: Bot) => void openBot(bot),
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
    // Each account has its own workspaces: reload on signing in, out or switching.
  }, [identity.scope]);

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
    // And its own chats and projects: an open chat that isn't this account's closes.
  }, [activeQuickAction, identity.scope]);

  const redesignChatContext: ChatPageShellContext | undefined = activeChat ? {
    chatName: activeChat.name,
    providerReady,
    bot: activeBot ? { name: activeBot.name, avatar: activeBot.avatar } : undefined,
    receiveChatNameFromServer: (name) => {
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, name } : chat));
    },
    refreshSidebarLists: () => {
      void fetch("/sessions")
        .then((response) => response.ok ? response.json() as Promise<Chat[]> : [])
        .then(applyLoadedChats);
    },
    openSettings: (section) => navigate(`/settings/${section}`),
    openFile: () => {},
    rightPanelOpen: false,
    notifyFilesTouched: () => {},
  } : undefined;
  const redesignHomeContext: HomePageShellContext = {
    openSettings: (section) => navigate(`/settings/${section}`),
    providerReady,
    workspaceId: activeWorkspace.id,
    workspaceName: activeWorkspace.name,
    workspaceLogo: activeWorkspace.logo ?? null,
    workspaceColor: activeWorkspace.color ?? null,
  };

  // Opens a bot's chat (#504), listing it straight away: until its first message it isn't in /sessions.
  function showBotChat(chatId: string, bot: Bot) {
    pendingChatIdsRef.current.add(chatId);
    setChats((current) => current.some((chat) => chat.id === chatId)
      ? current
      : [{ id: chatId, name: bot.name, workspace_id: activeWorkspace.id, bot_id: bot.id }, ...current]);
    setActiveChatId(chatId);
    navigate(`/chat/${chatId}`);
  }

  // Its chat, started the first time; if that fails, the coded error toast says why (no backend is
  // ALS-002, anything else ALS-039) instead of nothing happening.
  async function openBot(bot: Bot) {
    const chat = bot.chat_id ?? await openBotChat(bot.id, activeWorkspace.id);
    if (typeof chat === "string") {
      showBotChat(chat, bot);
      return;
    }
    showErrorToast(
      chat.reason === "unreachable" ? t("settings.providers.noConnection") : t("bots.errors.openFailed", { status: chat.status ?? "-" }),
      { id: "open-bot-chat" },
    );
  }

  async function removeBot(bot: Bot) {
    if (!await deleteBot(bot.id)) return;
    // Its chat is archived with it.
    setChats((current) => current.filter((chat) => chat.bot_id !== bot.id));
    if (bot.chat_id && bot.chat_id === (routeChatId ?? activeChatId)) {
      setActiveChatId(null);
      navigate("/");
    }
  }

  function openCreatedChat(sessionId: string) {
    pendingChatIdsRef.current.add(sessionId);
    setChats((current) => current.some((chat) => chat.id === sessionId)
      ? current
      : [{ id: sessionId, name: t("shell.untitledChat"), workspace_id: activeWorkspace.id }, ...current]);
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

  // ---- Sidebar row actions (each row's "..." menu) ----
  async function renameChat(chatId: string, name: string) {
    setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, name } : chat));
    await fetch(`/sessions/${encodeURIComponent(chatId)}/name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => undefined);
  }

  async function setChatProject(chatId: string, projectId: string | null) {
    const targetWorkspaceId = projectId
      ? projects.find((project) => project.id === projectId)?.workspace_id ?? activeWorkspace.id
      : undefined;
    setChats((current) => current.map((chat) => chat.id === chatId ? {
      ...chat,
      project_id: projectId,
      workspace_id: targetWorkspaceId ?? chat.workspace_id,
    } : chat));
    await fetch(`/sessions/${encodeURIComponent(chatId)}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    }).catch(() => undefined);
  }

  async function archiveChat(chatId: string) {
    const response = await fetch(`/sessions/${encodeURIComponent(chatId)}/archive`, { method: "POST" }).catch(() => null);
    if (!response?.ok) return;
    setChats((current) => current.filter((chat) => chat.id !== chatId));
    // Archiving the open chat leaves it for a new one.
    if (chatId === (routeChatId ?? activeChatId)) {
      setActiveChatId(null);
      navigate("/");
    }
  }

  async function renameProject(projectId: string, name: string) {
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, name } : project));
    await fetch(`/projects/${encodeURIComponent(projectId)}/name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => undefined);
  }

  async function archiveProject(project: Project, includeChats: boolean) {
    const response = await fetch(`/projects/${encodeURIComponent(project.id)}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ include_chats: includeChats }),
    }).catch(() => null);
    if (!response?.ok) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    if (includeChats) setChats((current) => current.filter((chat) => chat.project_id !== project.id));
    setProjectToArchive(null);
  }

  const chatMenu = (chat: Chat): readonly SidebarItemMenuEntry[] => [
    { kind: "rename", id: "rename", label: t("common.rename"), icon: EditIcon },
    {
      kind: "submenu",
      id: "project",
      label: t("nav.chat.addToProject"),
      icon: FolderIcon,
      entries: [
        // Picking the chat's current project again takes it out of the project.
        ...workspaceProjects.map((project) => ({
          id: project.id,
          label: project.name,
          checked: chat.project_id === project.id,
          onSelect: () => void setChatProject(chat.id, chat.project_id === project.id ? null : project.id),
        })),
        {
          id: "new-project",
          label: t("shell.rowMenu.newProject"),
          onSelect: () => {
            setChatForNewProject(chat.id);
            setProjectError(null);
            setNewProjectOpen(true);
          },
        },
      ],
    },
    { kind: "separator", id: "separator" },
    { kind: "action", id: "archive", label: t("common.archive"), icon: ArchiveIcon, destructive: true, onSelect: () => void archiveChat(chat.id) },
  ];

  const projectMenu = (project: Project): readonly SidebarItemMenuEntry[] => [
    { kind: "rename", id: "rename", label: t("common.rename"), icon: EditIcon },
    { kind: "separator", id: "separator" },
    { kind: "action", id: "archive", label: t("common.archive"), icon: ArchiveIcon, onSelect: () => setProjectToArchive(project) },
  ];

  const chatRow = (chat: Chat): SidebarSectionItem => ({
    id: chat.id,
    label: chat.name,
    menu: chatMenu(chat),
    onRename: (name: string) => void renameChat(chat.id, name),
  });

  // #504: Recents (chats and bot chats, newest first), Chats (a project is a row that opens to its
  // chats) and Bots (each one opens its own chat).
  const botMenu = (bot: Bot): readonly SidebarItemMenuEntry[] => [
    { kind: "action", id: "edit", label: t("bots.edit"), icon: EditIcon, onSelect: () => { setBotToEdit(bot); setBotEditOpen(true); } },
    { kind: "action", id: "favourite", label: t(bot.favourite ? "bots.unfavourite" : "bots.favouriteAction"), icon: Star01, onSelect: () => void updateBot(bot.id, { favourite: !bot.favourite }) },
    { kind: "separator", id: "separator" },
    { kind: "action", id: "delete", label: t("common.delete"), icon: DeleteIcon, destructive: true, onSelect: () => void removeBot(bot) },
  ];
  const botRow = (bot: Bot, id: string): SidebarSectionItem => ({ id, label: bot.name, icon: botRowIcon(bot.avatar), menu: botMenu(bot) });
  const recentChats = [...workspaceChats]
    // Bot chats only while their bot is here.
    .filter((chat) => !chat.bot_id || botsById.has(chat.bot_id))
    // A chat just started has no activity yet: it's the newest.
    .sort((a, b) => !a.last_activity ? -1 : !b.last_activity ? 1 : b.last_activity.localeCompare(a.last_activity))
    .slice(0, RECENTS_SIZE);

  const chatsSidebarSections: readonly SidebarSection[] = [
    {
      id: "recents",
      label: t("nav.recents"),
      items: recentChats.map((chat) => {
        const bot = chat.bot_id ? botsById.get(chat.bot_id) : undefined;
        return bot ? botRow(bot, chat.id) : chatRow(chat);
      }),
      emptyLabel: t("shell.sections.noChats"),
    },
    {
      id: "chats",
      label: t("nav.chats"),
      // New (above) starts a chat; this adds a project, which then lists here with its chats.
      action: { label: t("nav.newProject.ariaLabel"), icon: Plus, onSelect: () => { setProjectError(null); setNewProjectOpen(true); } },
      items: [
        ...workspaceProjects.map((project) => ({
        id: project.id,
        label: project.name,
        menu: projectMenu(project),
        onRename: (name: string) => void renameProject(project.id, name),
          // A project expands to its chats.
          children: workspaceChats.filter((chat) => !chat.bot_id && chat.project_id === project.id).map(chatRow),
          childrenEmptyLabel: t("shell.sections.noChats"),
        })),
        // Then chats outside a project; the rest are listed under their project, and bot chats under Bots.
        ...workspaceChats
          .filter((chat) => !chat.bot_id && (!chat.project_id || !workspaceProjects.some((project) => project.id === chat.project_id)))
          .map(chatRow),
      ],
      emptyLabel: t("shell.sections.noChats"),
    },
    {
      id: "bots",
      label: t("bots.title"),
      action: { label: t("bots.new"), icon: Plus, onSelect: () => { setActiveChatId(null); navigate("/?new=bot"); } },
      // Its chat's id once it has one, so the open bot chat is the selected row.
      items: bots.map((bot) => botRow(bot, bot.chat_id ?? `bot:${bot.id}`)),
      emptyLabel: t("shell.sections.noBots"),
    },
  ];
  const activeSidebarSurface = activeQuickAction === "inbox" || activeQuickAction === "chats"
    ? activeQuickAction
    : null;
  // Changing this key fades the page out and the next one in. Not for the
  // new-chat handoff (HomePage navigates with composeHandoff): its compose box
  // has already moved into place, so the chat page takes over without a fade.
  // Settings by its path alone: it swaps its own views in place (a provider's page is
  // ?provider=…) with their own crossfade, and keying on location.key faded the whole page
  // out and in on top of that one -- the doubled fade opening a provider's setup.
  const surfaceIdentity = location.pathname.startsWith("/settings") ? location.pathname : `${location.pathname}:${location.key}`;
  const surfaceKeyRef = useRef(surfaceIdentity);
  if (!(location.state as { composeHandoff?: boolean } | null)?.composeHandoff) {
    surfaceKeyRef.current = surfaceIdentity;
  }
  const redesignSurfaceKey = surfaceKeyRef.current;
  // The chat shown in the top bar: the open one, on a chat route.
  const topBarChat = routeChatId ? chats.find((chat) => chat.id === routeChatId) ?? null : null;
  // A bot's chat shows the bot's profile instead of a chat title.
  const topBarBot = topBarChat?.bot_id ? botsById.get(topBarChat.bot_id) : undefined;
  const topBarProject = topBarChat?.project_id ? projects.find((project) => project.id === topBarChat.project_id) ?? null : null;

  async function createProject() {
    const name = newProjectName.trim();
    if (!name || saving) return;
    setSaving(true);
    setProjectError(null);
    try {
      const response = await fetch("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, workspace_id: activeWorkspace.id }),
      });
      if (!response.ok) throw new Error(t("shell.newProject.error"));
      const project = await response.json() as Project;
      setProjects((current) => [...current, project]);
      setNewProjectName("");
      setNewProjectOpen(false);
      if (chatForNewProject) void setChatProject(chatForNewProject, project.id);
      setChatForNewProject(null);
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

  async function archiveWorkspace(workspace: WorkspaceRecord) {
    if (saving) return;
    setSaving(true);
    setWorkspaceError(null);
    setWorkspaceNameTaken(false);
    try {
      const response = await fetch(`/workspaces/${encodeURIComponent(workspace.id)}/archive`, { method: "POST" });
      if (response.status === 409) throw new Error(t("workspace.errors.onlyWorkspace"));
      if (!response.ok) throw new Error(t("archive.workspace.error"));
      syncWorkspaces(workspaces.filter((item) => item.id !== workspace.id));
      setProjects((current) => current.filter((project) => project.workspace_id !== workspace.id));
      setChats((current) => current.filter((chat) => chat.workspace_id !== workspace.id));
      setManageWorkspacesOpen(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : t("archive.workspace.error"));
    } finally {
      setSaving(false);
    }
  }

  async function moveProjectToWorkspace(projectId: string, destinationId: string) {
    const response = await fetch(`/projects/${encodeURIComponent(projectId)}/workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: destinationId }),
    }).catch(() => null);
    if (!response?.ok) return;
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, workspace_id: destinationId } : project));
    setChats((current) => current.map((chat) => chat.project_id === projectId ? { ...chat, workspace_id: destinationId } : chat));
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
        navigate("/");
      },
    },
    {
      value: "join-chat",
      label: t("joinChat.title"),
      description: t("shell.commands.joinChat.description"),
      icon: JoinChatIcon,
      keywords: ["share", "multiplayer", "code", "invite"],
      group: t("shell.commands.group.actions"),
      onSelect: () => setJoinOpen(true),
    },
    {
      value: "new-bot",
      label: t("bots.new"),
      description: t("bots.subtitle"),
      icon: BotIcon,
      keywords: ["bot", "agent", "specialist", "create"],
      group: t("shell.commands.group.actions"),
      onSelect: () => {
        setActiveChatId(null);
        navigate("/?new=bot");
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
      // One chat: the Chat icon. message-chat-circle is for chats as a group.
      icon: BubbleChatIcon,
      keywords: ["conversation", "recent"],
      group: t("nav.chats"),
      onSelect: () => {
        if (chat.id === (routeChatId ?? activeChatId)) return;
        setActiveChatId(chat.id);
        navigate(`/chat/${chat.id}`);
      },
    })),
  ], [activeChatId, chats, navigate, routeChatId, t]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ["claude", "codex", "antigravity"].map((cli) =>
        fetch(`/cli/${cli}/available`)
          .then((response) => (response.ok ? (response.json() as Promise<{ available?: boolean }>) : null))
          .then((data) => Boolean(data?.available))
          .catch(() => false),
      ),
    ).then((ready) => {
      if (!cancelled) setProviderReady(ready.some(Boolean) && !forcedNoProvider());
    });
    // Any chat shared or joined through the relay (the host-embedded gateway is development-only now).
    void fetch("/relay/shared")
      .then((response) => (response.ok ? (response.json() as Promise<{ shared?: boolean }>) : null))
      .then((data) => {
        if (!cancelled) setSharedOnce(Boolean(data?.shared));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.pathname, identity.scope, providerCheck]);

  // Signing in, out or switching account leaves a chat that belonged to the
  // account before (the backend now answers it as not found).
  const scopeRef = useRef(identity.scope);
  useEffect(() => {
    if (scopeRef.current === identity.scope) return;
    scopeRef.current = identity.scope;
    if (location.pathname.startsWith("/chat/")) navigate("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.scope]);

  // A step stays done once it has been done (deleting every chat or signing
  // out later doesn't untick it), remembered on this device.
  const liveDone: Record<GettingStartedStepId, boolean> = {
    account: identity.signedIn,
    provider: providerReady === true,
    project: projects.length > 0,
    chat: chats.length > 0,
    workspace: workspaces.some(
      (workspace) => workspace.is_personal && workspace.name.trim().toLocaleLowerCase() !== DEFAULT_WORKSPACE.name.toLocaleLowerCase(),
    ),
    multiplayer: sharedOnce,
  };
  // Closed with its X once every step was done; stays closed on this device.
  // Both remembered per account (and for the signed-out space), like the chats they count.
  const gettingStartedKey = (key: string) => `${key}:${identity.scope || "local"}`;
  const [gettingStartedDismissed, setGettingStartedDismissed] = useState(() => readGettingStarted(gettingStartedKey(GETTING_STARTED_DISMISSED_KEY)) === "1");
  const dismissGettingStarted = () => {
    setGettingStartedDismissed(true);
    try {
      localStorage.setItem(gettingStartedKey(GETTING_STARTED_DISMISSED_KEY), "1");
    } catch {
      // storage blocked: closed for this session
    }
  };
  const [rememberedDone, setRememberedDone] = useState<string[]>(() => parseDone(readGettingStarted(gettingStartedKey(GETTING_STARTED_DONE_KEY))));
  // Another account (or signed out): its own progress.
  useEffect(() => {
    setRememberedDone(parseDone(readGettingStarted(gettingStartedKey(GETTING_STARTED_DONE_KEY))));
    setGettingStartedDismissed(readGettingStarted(gettingStartedKey(GETTING_STARTED_DISMISSED_KEY)) === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.scope]);
  const newlyDone = GETTING_STARTED_STEP_IDS.filter((id) => liveDone[id] && !rememberedDone.includes(id));
  useEffect(() => {
    if (newlyDone.length === 0) return;
    const next = [...rememberedDone, ...newlyDone];
    setRememberedDone(next);
    try {
      localStorage.setItem(gettingStartedKey(GETTING_STARTED_DONE_KEY), JSON.stringify(next));
    } catch {
      // storage blocked: still shown done while the live check holds
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyDone.join(",")]);
  const steps = gettingStartedSteps(
    t,
    Object.fromEntries(GETTING_STARTED_STEP_IDS.map((id) => [id, liveDone[id] || rememberedDone.includes(id)])) as Record<GettingStartedStepId, boolean>,
    {
      account: () => (identity.signedIn ? navigate("/settings/profile") : openSignIn()),
      provider: () => navigate("/settings/provider"),
      project: () => { setProjectError(null); setNewProjectOpen(true); },
      chat: () => navigate("/"),
      workspace: () => { setWorkspaceError(null); setWorkspaceNameTaken(false); setManageWorkspacesOpen(true); },
      // Sharing happens from a chat (/share there): the latest one, or a new one.
      multiplayer: () => navigate(chats[0] ? `/chat/${chats[0].id}` : "/"),
    },
  );

  return (
    <>
    <SplitView
      topBar={
        <AppTopBar
          // The sidebar's strip and its right-edge line in the top bar fade
          // with the sidebar: out in 160ms as it closes, in over 240ms as it
          // opens (spring.slow's exit and enter), instantly with reduced motion.
          className={cn(
            "border-b border-[var(--redesign-sidebar-border)] bg-background before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[var(--redesign-sidebar-width)] before:bg-[var(--redesign-sidebar-surface)] after:pointer-events-none after:absolute after:inset-y-0 after:left-[calc(var(--redesign-sidebar-width)-1px)] after:w-px after:bg-[var(--redesign-sidebar-border)]",
            "before:transition-opacity after:transition-opacity before:ease-out after:ease-out motion-reduce:before:transition-none motion-reduce:after:transition-none",
            sidebarCollapsed && !isSettingsRoute
              ? "before:opacity-0 after:opacity-0 before:duration-[160ms] after:duration-[160ms]"
              : "before:opacity-100 after:opacity-100 before:duration-[240ms] after:duration-[240ms]",
          )}
          controlsClassName="absolute right-[var(--redesign-top-bar-controls-right)] gap-1"
          // The open chat's name (after its project, when it has one), at the
          // content's left edge: the controls stay inside the sidebar's width
          // even when it's collapsed, so this clears them either way.
          // Fades out and in with the page content (same surface key and timing).
          title={
            <SidebarSurfaceTransition
              surfaceKey={redesignSurfaceKey}
              className="flex min-w-0 bg-transparent"
              contentClassName="flex min-w-0 items-center"
            >
              {topBarBot ? (
                // A bot's chat: the bot's profile -- its face and name, the size of a chat's title; opens Edit bot.
                <button
                  type="button"
                  onClick={() => { setBotToEdit(topBarBot); setBotEditOpen(true); }}
                  className="-ml-1 flex min-w-0 items-center gap-1.5 rounded-[var(--redesign-control-radius)] px-1 py-0.5 text-left transition-colors hover:bg-hover-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BotFace avatar={topBarBot.avatar ?? undefined} className="size-4" />
                  <span className="min-w-0 truncate">{topBarBot.name}</span>
                </button>
              ) : topBarChat ? (
                <span className="flex min-w-0 items-center gap-1">
                  {topBarProject && (
                    <>
                      <span className="truncate text-muted-foreground">{topBarProject.name}</span>
                      <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                    </>
                  )}
                  <span className="truncate">{chatTitle(topBarChat)}</span>
                </span>
              ) : null}
            </SidebarSurfaceTransition>
          }
          // Invite (sharing the chat), at the right end, on a chat only.
          actions={topBarChat ? (
            // 24px, a notch under compact, so it sits in the 40px bar with room around it.
            <Button type="button" variant="tertiary" size="compact" className="h-6 rounded-[4px] px-2.5" onClick={() => openShare(topBarChat.id)}>
              {t("shareChat.button")}
            </Button>
          ) : null}
          titleClassName="absolute left-[calc(var(--redesign-sidebar-width)+16px)] max-w-[min(32rem,calc(100%-var(--redesign-sidebar-width)-6rem))] font-normal"
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
                onValueChange={(nextWorkspaceId) => {
                  if (activeChat?.workspace_id && activeChat.workspace_id !== nextWorkspaceId) {
                    setActiveChatId(null);
                    navigate("/");
                  }
                  setWorkspaceId(nextWorkspaceId);
                }}
                workspaceSectionActions={workspaceSectionActions}
              actionSections={[]}
                ariaLabel={t("shell.selectWorkspace")}
              />
            </div>
            <QuickActions
              label={t("shell.quickActions")}
              shortcut="K"
              actions={quickActions(t)}
              activeId={location.pathname === "/" ? "chats" : undefined}
              onOpen={() => setQuickActionsOpen(true)}
              onActionSelect={(actionId) => {
                if (actionId === "join") {
                  setJoinOpen(true);
                  return;
                }
                if (actionId === "chats") {
                  // Already on an empty new chat: nothing to do. Navigating to
                  // the same route would push a duplicate entry and re-render
                  // the page for no change.
                  if (location.pathname === "/" && !activeChatId) return;
                  setActiveChatId(null);
                  navigate("/");
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
                expandedIds={expandedProjects}
                onToggleExpanded={toggleProjectExpanded}
                onItemSelect={activeSidebarSurface === "chats" ? (itemId) => {
                  // Navigating to the exact same chat creates a new location key,
                  // which in turn replays the routed chat surface. An active row
                  // is already open, so it is deliberately a no-op.
                  if (itemId === (routeChatId ?? activeChatId)) return;
                  if (chats.some((chat) => chat.id === itemId)) {
                    setActiveChatId(itemId);
                    navigate(`/chat/${itemId}`);
                    return;
                  }
                  // A bot: its chat, started the first time.
                  const bot = bots.find((candidate) => `bot:${candidate.id}` === itemId || candidate.chat_id === itemId);
                  if (bot) void openBot(bot);
                } : undefined}
              />
            </SidebarSurfaceTransition>
          )}
          </div>
          <footer className="mt-auto shrink-0 pt-[var(--redesign-sidebar-section-gap)]">
            {/* #460: people waiting to be let into a chat this person shares. */}
            <JoinRequestsCard enabled={identity.signedIn} />
            {/* Collapses and fades out when closed. */}
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none",
                gettingStartedDismissed ? "-mb-[var(--redesign-sidebar-section-gap)] grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
              )}
              inert={gettingStartedDismissed}
            >
              <div className={cn(gettingStartedDismissed && "min-h-0 overflow-hidden")}>
                <GettingStartedSummary
                  label={t("shell.gettingStarted.label")}
                  steps={steps}
                  completedSteps={steps.filter((step) => step.complete).length}
                  onDismiss={dismissGettingStarted}
                />
              </div>
            </div>
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
          <HomePage shellContextOverride={redesignHomeContext} onSessionCreated={openCreatedChat} onBotCreated={(bot) => void openBot(bot)} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {null}
          </div>
        ))}
      </SidebarSurfaceTransition>
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
      <ShareChatDialog sessionId={shareChatId} open={shareOpen} onOpenChange={setShareOpen} />
      <JoinChatDialog open={joinOpen} onOpenChange={setJoinOpen} />
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
        onArchive={() => archiveWorkspace(activeWorkspace)}
        canArchive={workspaces.length > 1}
        projects={projects}
        workspaces={workspaces}
        onMoveProject={moveProjectToWorkspace}
        saving={saving}
        error={workspaceNameTaken ? null : workspaceError}
        nameError={workspaceNameTaken ? workspaceError : null}
      />
      <Dialog open={projectToArchive !== null} onOpenChange={(open) => { if (!open) setProjectToArchive(null); }} backdropClassName="!z-[120]">
        <DialogContent className="!z-[120]">
          <DialogHeader>
            <DialogTitle>{t("archive.project.title")}</DialogTitle>
            <DialogDescription>{t("archive.project.description", { name: projectToArchive?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col">
            <Button type="button" variant="tertiary" onClick={() => setProjectToArchive(null)}>{t("common.cancel")}</Button>
            <Button type="button" variant="tertiary" onClick={() => projectToArchive && void archiveProject(projectToArchive, false)}>{t("archive.project.only")}</Button>
            <Button type="button" onClick={() => projectToArchive && void archiveProject(projectToArchive, true)}>{t("archive.project.withChats")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NewAgentDialog
        kind="bot"
        open={botEditOpen}
        onClose={() => setBotEditOpen(false)}
        initial={botToEdit ? { name: botToEdit.name, description: botToEdit.description ?? "", instructions: botToEdit.instructions, avatar: botToEdit.avatar ?? { kind: "bot", color: "#7A7A7A" } } : undefined}
        onAdd={async (name, instructions, avatar, description) => botToEdit ? updateBot(botToEdit.id, { name, description, instructions, avatar }) : null}
      />
      <CreateProjectDialog
        open={newProjectOpen}
        onOpenChange={(open) => {
          setNewProjectOpen(open);
          if (!open) {
            setChatForNewProject(null);
            setNewProjectName("");
          }
        }}
        name={newProjectName}
        onNameChange={setNewProjectName}
        onCreate={() => void createProject()}
        saving={saving}
        error={projectError}
      />
    </SplitView>
    <CommandMenuDemo
      open={quickActionsOpen}
      onOpenChange={setQuickActionsOpen}
      items={commandMenuItems}
    />
    </>
  );
}
