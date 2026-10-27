import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { ShapeProvider } from "@/lib/shape-context";
import { ProvidersEmptyState, ProviderUsageSection } from "@/components/provider-usage";
import { forcedNoProvider } from "@/lib/dev-no-provider";
import { providersChanged } from "@/lib/providers-changed";
import { resizeImageFile } from "@/lib/resize-image";
import { LimitReminderRows } from "@/components/limit-reminders";
import { Check, Plus, SearchMd } from "@untitledui/icons";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useIsMac, useIsWindows } from "@/hooks/use-platform";
import { useIsTauri } from "@/hooks/use-tauri";
import { useTheme } from "@/hooks/use-theme";
import {
  applyChatWidth,
  applyFontSmoothing,
  applySystemUiFont,
  loadChatWidth,
  loadFontSmoothing,
  loadSystemUiFont,
  type ChatWidth,
} from "@/hooks/use-appearance-settings";
import { fade, spring } from "@/lib/springs";
import { modelDisplayName, PROVIDER_DISPLAY, ProviderIcon, QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";
import { effortLabel, EFFORT_LEVELS, loadDefaultEffort, saveDefaultEffort, type EffortLevel } from "@/lib/effort";
import { loadLanguage, saveLanguage, uiLocaleFor, type LanguageValue } from "@/lib/language";
import { loadTimezone, saveTimezone } from "@/lib/timezones";
import { LanguageDropdown, TimezoneDropdown } from "@/components/locale-dropdowns";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { formatStorageBytes, useUsageStats } from "@/lib/use-usage";
import { ErrorText } from "@/lib/error-code";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { Avatar, AvatarFallback, DefaultAvatar } from "@/components/ui/avatar";
import { PageContent } from "@/components/page-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu as BaseDropdownMenu, DropdownTrigger as BaseDropdownTrigger, DropdownContent as BaseDropdownContent, DropdownSeparator } from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { useQueueing } from "@/lib/message-queue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShellField } from "@/components/design-system/shell-dialog";
import { SkillsSection } from "@/components/skills-section";
import { WorkspaceBrandIcon, workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import {
  BubbleChatIcon,
  SkillIcon,
  FolderIcon,
  MessageChatCircleIcon,
  WorkspacesIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  HelpCircleIcon,
  IntegrationsIcon,
  PaletteIcon,
  ProvidersIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
  ArrowCircleBrokenLeftIcon,
} from "@/components/icons/untitled-ui";
import { GlideGroup, RailButton } from "@/components/sidebar-nav";
import { AccountMenuItems, HelpMenuItems } from "@/components/nav-user";
import {
  clearUserAvatarImage,
  setUserAvatarImage,
  useUserAvatarImage,
  useUserDisplayName,
} from "@/lib/user";
import { signOut, useIsSignedIn } from "@/lib/auth";
import { openSignInDialog } from "@/lib/use-sign-in";
import { useIdentity } from "@/lib/identity";
import { Command, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { showErrorToast } from "@/components/ui/app-toast";
import { ShellDialog, ShellDialogActions, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { cn } from "@/lib/utils";

// General owns the language and timezone controls. Story: Settings
// "Application" section
// (alongsidedotrun/private#207). Appearance moved out to its own
// top-level section (AppearanceSection, below) -- per explicit request
// ("we should get an appearance menu at the sidebar as well as palette
// icon and move from general") -- no longer one of these sub-sections.
// #209 (an "Account" section with a Behaviors page for chat defaults, and
// the old Danger zone) was closed as superseded, not picked up -- Chat
// stays its own separate top-level section instead, and Danger zone was
// removed entirely rather than folded into a new section (SETTINGS_NAV_GROUPS'
// own comment below has the full reasoning).
export type SettingsSection = "profile" | "general" | "appearance" | "chat" | "provider" | "apps" | "skills" | "archived-workspaces" | "archived-projects" | "archived-chats";

// ---------------------------------------------------------------------------
// Style pass -- matches a reference open-source app called Synara's own
// Settings UI (cloned locally for comparison), per explicit request ("update
// our settings page to the same style as synara's one"). Not a structural
// copy (Synara's own Settings is a full route with its own sidebar slot;
// this stays the modal Alongside already had) -- the card/row visual
// language, nav row treatment, search, per-row reset-to-default, and a
// density setting, adapted onto Alongside's own existing sections/state
// rather than rebuilt from scratch.
// ---------------------------------------------------------------------------

// Density setting removed -- per explicit request ("remove ui density from
// the chat settings as we wont use that at all"). SettingsRow/
// SettingsSection below still read the same two CSS custom properties this
// used to drive (--settings-row-padding-y/--settings-section-gap), now set
// once, always, to the old "compact" tier's fixed values (SettingsSectionContent,
// below) -- compact was already the default every user actually saw, so
// nothing changes visually, there's just no control to leave it any more.

// Two-tier radius system -- rounded-xl for cards, rounded-lg for anything
// nested/controls inside them, matching Synara's own strict two-step scale
// (that app's settingsPanelStyles.ts).
const SETTINGS_CARD_RADIUS = "rounded-xl";
const PROVIDER_ICON_FRAME = "flex size-8 shrink-0 items-center justify-center rounded-[calc(32px*8/27)] border border-border";
// A Providers/Apps row: no border of its own (its icon's frame has one) and no hover highlight; the
// + / check and the update pill at its end are the controls that react.
// At its right end: a bordered + to add it (install, log in or set up), the same box with a check once
// it's connected.
const CONNECTION_ADD = "flex size-6 shrink-0 items-center justify-center rounded-[calc(24px*8/27)] border border-border text-foreground transition-colors hover:bg-hover-2";
const CONNECTED_MARK = CONNECTION_ADD;
const CONNECTION_ROW = `flex w-full select-none items-center gap-3 ${SETTINGS_CARD_RADIUS} p-2 text-left`;

type ConnectionFilter = "all" | "connected" | "available";

// Search shows once a list is this long; shorter ones are quicker to scan.
const CONNECTION_SEARCH_FROM = 6;

/** Whether a row shows: under its tab (Available is everything not connected yet) and matching the search. */
function showsUnder(filter: ConnectionFilter, connected: boolean, query: string, name: string) {
  const inTab = filter === "all" || (filter === "connected") === connected;
  return inTab && name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

/** Above Providers' and Apps' lists: All / Connected / Available (styled like Skills' tabs) on the
 *  left; search (from CONNECTION_SEARCH_FROM items) and Request on the right. */
function ConnectionToolbar({
  filter,
  onFilter,
  itemCount,
  query,
  onQuery,
  searchLabel,
}: {
  filter: ConnectionFilter;
  onFilter: (value: ConnectionFilter) => void;
  itemCount: number;
  query: string;
  onQuery: (value: string) => void;
  searchLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <ShapeProvider defaultShape="pill">
        <Tabs size="compact" value={filter} onValueChange={(next) => onFilter(next as ConnectionFilter)}>
          <TabsList>
            <TabItem value="all" label={t("settings.connections.all")} />
            <TabItem value="connected" label={t("settings.connections.connected")} />
            <TabItem value="available" label={t("settings.connections.available")} />
          </TabsList>
        </Tabs>
      </ShapeProvider>
      <div className="flex min-w-0 items-center gap-2">
        {itemCount >= CONNECTION_SEARCH_FROM && (
          // Skills' search field: focused, the icon and placeholder fade out.
          <div className="group/connection-search relative w-48 min-w-0">
            <SearchMd
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground transition-opacity duration-160 ease-in-out group-focus-within/connection-search:opacity-0 motion-reduce:transition-none"
            />
            <Input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
              className="h-7 border border-border pl-8 text-chat-meta shadow-none transition-[border-color] duration-160 placeholder:text-transparent focus:pl-2.5 focus-visible:border-focus-accent dark:border-border dark:focus-visible:border-focus-accent"
            />
            {!query && (
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-8 -translate-y-1/2 truncate text-chat-meta text-muted-foreground transition-opacity duration-160 ease-in-out group-focus-within/connection-search:opacity-0 motion-reduce:transition-none">
                {searchLabel}
              </span>
            )}
          </div>
        )}
        {/* The request form isn't built yet, like the request cards this replaces. */}
        <Button size="compact" variant="primary" leadingIcon={Plus} onClick={() => {}}>
          {t("settings.connections.request")}
        </Button>
      </div>
    </div>
  );
}

/** The rows in two columns, edge-aligned with the toolbar above. Each row renders nothing when it
 *  doesn't show. The list keeps the tallest height it has had this visit (and at least two rows), so
 *  a tab or search with fewer rows, or none, leaves blank space rather than moving the sections
 *  below; rows are taller when their text wraps, so a fixed height wouldn't do. */
// Switching tabs: what's below the tabs (the list, and on Providers its Usage too) fades out, changes
// while it's hidden, then fades back in -- the app's tab-content fade (springs.ts `fade`, as Skills and
// the New page), so nothing slides or snaps. `shown` is the tab whose content is on screen; the tabs
// themselves follow the click at once. Each part fades with <motion.div {...tabFade.motion}>.
function useTabFade<T>(value: T) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (value === shown) return;
    if (reduceMotion) {
      setShown(value);
      return;
    }
    setHidden(true);
    // Once the fade out has ended (and a moment more), so the change is never seen.
    const timer = setTimeout(() => {
      setShown(value);
      setHidden(false);
    }, fade.duration * 1000 + 50);
    return () => clearTimeout(timer);
  }, [value, shown, reduceMotion]);
  return { shown, motion: { initial: false, animate: { opacity: hidden ? 0 : 1 }, transition: fade } };
}

// The rows, two columns; or, with none in this tab, its placeholder in their place.
function ConnectionList({ children, placeholder }: { children: ReactNode; placeholder?: ReactNode }) {
  return placeholder ? (
    <div className="mt-3">{placeholder}</div>
  ) : (
    <div className="-mx-2 mt-3 grid grid-cols-2 content-start gap-x-2 gap-y-0.5">{children}</div>
  );
}
const SETTINGS_CONTROL_RADIUS = "rounded-lg";

// Shared by every plain action button in a Caution section (Reset, Log
// out) -- per explicit request ("use the same border as the dropdown
// buttons"/"fit their own size and not have the extra space"): the exact
// same border/radius/padding/text-size treatment as the Theme/Chat width
// dropdown triggers above them, not the shadcn Button component's own
// outline variant (same border-border/rounded-lg underneath, but a
// different fixed height and font size that read as visibly inconsistent
// next to those dropdowns) -- sized to each button's own label, not a
// shared fixed width (tried first, reverted).
const SETTINGS_ACTION_BUTTON_CLASS = `flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-ui-sm text-foreground transition-colors hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-40 ${SETTINGS_CONTROL_RADIUS}`;

// Shared by every dropdown trigger in a settings row (Theme, Chat width)
// -- per explicit request ("the dropdown of theme and chat width should
// be the same width even though chat width has no icon"): a fixed width
// and justify-between (icon+label left, chevron right) instead of each
// trigger sizing to its own label's length, so the two line up instead of
// one being visibly narrower.
const SETTINGS_DROPDOWN_TRIGGER_BASE = `flex items-center justify-between gap-1.5 border border-border px-2.5 py-1.5 text-ui-sm text-foreground hover:bg-muted/30 ${SETTINGS_CONTROL_RADIUS}`;
const SETTINGS_DROPDOWN_TRIGGER_CLASS = `${SETTINGS_DROPDOWN_TRIGGER_BASE} w-32`;
// Fits its content (never narrower than the standard w-32) -- for triggers whose
// label length varies by language, instead of hardcoding a wider fixed width.
const SETTINGS_DROPDOWN_TRIGGER_FIT_CLASS = `${SETTINGS_DROPDOWN_TRIGGER_BASE} w-max min-w-32 whitespace-nowrap`;

// SettingsSection -- label sits directly above the card with no box of its
// own (Synara's own pattern: a plain muted label, not a boxed header), then
// the card. No more per-section `action` slot for a "Restore defaults"
// button -- per explicit request ("restore to defaults should be an option
// at the bottom of each page... not exactly like synatara's where you can
// default anything"), that button moved to the bottom of each page instead
// (GeneralSection/ChatSection/AppearanceSection's own return), and the
// per-row reset icons SettingsRow used to render (below) are gone entirely.
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5" style={{ marginTop: "0.875rem" }}>
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <h3 className="text-ui-sm font-normal text-muted-foreground/60">{title}</h3>
      </div>
      {/* divide-y hairlines are back -- per explicit request ("we need the
          divider from any further items that include more than one action
          inside that item block"): a plain Tailwind divide-y on the card
          itself puts a line between every row automatically, for any
          section with more than one, and does nothing for a single-row
          section (nothing to divide) without any per-section special
          casing. Reverses an earlier request to remove these -- the
          earlier reasoning ("keep like synara's style") no longer applies
          now that this is the explicit ask. */}
      <div className={`divide-y divide-border overflow-hidden border border-border bg-foreground/[0.02] ${SETTINGS_CARD_RADIUS}`}>
        {children}
      </div>
    </section>
  );
}

// SettingsRow -- the shared label+description+control row every card is
// built from. No more per-row showReset/onReset icon -- per explicit
// request (SettingsSection's own comment above has the full reasoning):
// one "Restore defaults" per page is the only reset affordance now.
function SettingsRow({
  id,
  title,
  description,
  status,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: string;
  status?: string;
  children?: ReactNode;
}) {
  return (
    <div
      id={id}
      className="flex flex-col gap-2.5 px-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ paddingTop: "0.375rem", paddingBottom: "0.375rem", scrollMarginTop: "6rem" }}
    >
      <div className="min-w-0">
        <label className="text-ui-sm font-medium text-foreground">{title}</label>
        {description && <p className="mt-0.5 text-ui-sm font-normal text-muted-foreground">{description}</p>}
        {status && <p className="pt-1 text-ui-xs font-normal text-muted-foreground"><ErrorText message={status} /></p>}
      </div>
      {children && <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">{children}</div>}
    </div>
  );
}

// size-[14px], not size-4 (16px) -- matches the real sidebar's own
// RailButton icon convention exactly (sidebar-nav.tsx's own WELCOME_ITEM/
// INBOX_ITEM icons), per explicit request ("match our sidebar row sizes
// items and gaps and text and icon spacing") now that these rows render
// through that same RailButton component.
// `label` stays the fixed English name -- used only internally by
// rankSettingsSearch's own substring matching (that function's own comment
// has the "why not translated" reasoning), never rendered directly.
// `labelKey` is what every real display site below calls t() with.
// titleKey: the page heading, when the nav label alone needs its group for context.
const SECTIONS: { key: SettingsSection; label: string; labelKey: string; titleKey?: string; icon: ReactNode }[] = [
  { key: "profile", label: "Profile", labelKey: "settings.nav.profile", icon: <UserIcon className="size-[14px]" /> },
  { key: "general", label: "General", labelKey: "settings.nav.general", icon: <SettingsIcon className="size-[14px]" /> },
  { key: "appearance", label: "Appearance", labelKey: "settings.nav.appearance", icon: <PaletteIcon className="size-[14px]" /> },
  { key: "chat", label: "Chat", labelKey: "settings.nav.chat", icon: <BubbleChatIcon className="size-[14px]" /> },
  { key: "provider", label: "Provider", labelKey: "settings.nav.provider", icon: <ProvidersIcon className="size-[14px]" /> },
  // Its own top-level section now, not a drill-in under Provider -- per
  // explicit correction ("Still inside providers its meant to be settings
  // > apps and not settings > providers > apps").
  { key: "apps", label: "Apps", labelKey: "settings.nav.apps", icon: <IntegrationsIcon className="size-[14px]" /> },
  { key: "skills", label: "Skills", labelKey: "settings.nav.skills", icon: <SkillIcon className="size-[14px]" /> },
  // Archived, one page per kind, so each lists only its own.
  { key: "archived-workspaces", label: "Archived workspaces", labelKey: "settings.nav.archivedWorkspaces", titleKey: "settings.archived.workspaces.title", icon: <WorkspacesIcon className="size-[14px]" /> },
  { key: "archived-projects", label: "Archived projects", labelKey: "settings.nav.archivedProjects", titleKey: "settings.archived.projects.title", icon: <FolderIcon className="size-[14px]" /> },
  // Chats, plural: message-chat-circle. One chat (the rows) is the Chat icon.
  { key: "archived-chats", label: "Archived chats", labelKey: "settings.nav.archivedChats", titleKey: "settings.archived.chats.title", icon: <MessageChatCircleIcon className="size-[14px]" /> },
];

// Group describers -- per explicit request ("we need to add section
// describers like synara does"), matching that app's own nav (Personal/
// Integrations/Coding/System/Archived, settingsNavigation.ts) grouping
// related sections under a small muted label. "Workspace" renamed to
// "Application", per the Settings "Application" section story
// (alongsidedotrun/private#207). Appearance is its own key/page now, not a
// General sub-section -- per explicit request ("we should get an
// appearance menu at the sidebar as well as palette icon and move from
// general"). Chat stays here for now, same reasoning as SettingsSection's
// own comment above. No "Account" group any more -- per explicit request
// ("remove the account and danger zone as we will do restore to default
// at the end of each menu"): General and Chat already each have their own
// "Restore defaults" button at the end of their own page, which made the
// Danger zone's one global "Reset all settings" purely redundant, not a
// second real capability.
const SETTINGS_NAV_GROUPS: { labelKey: string; keys: SettingsSection[] }[] = [
  // General first, then the rest alphabetical (Appearance, Chat, Profile)
  // -- per explicit request.
  { labelKey: "settings.nav.group.application", keys: ["general", "appearance", "chat", "profile"] },
  { labelKey: "settings.nav.group.connections", keys: ["provider", "apps", "skills"] },
  { labelKey: "settings.nav.group.archived", keys: ["archived-workspaces", "archived-projects", "archived-chats"] },
];

const SECTION_SUBTITLE_KEY: Record<SettingsSection, string> = {
  profile: "settings.nav.subtitle.profile",
  general: "settings.nav.subtitle.general",
  appearance: "settings.nav.subtitle.appearance",
  chat: "settings.nav.subtitle.chat",
  provider: "settings.nav.subtitle.provider",
  apps: "settings.nav.subtitle.apps",
  skills: "settings.nav.subtitle.skills",
  "archived-workspaces": "settings.archived.workspaces.subtitle",
  "archived-projects": "settings.archived.projects.subtitle",
  "archived-chats": "settings.archived.chats.subtitle",
};

// Search -- per explicit request ("Also build search + reset-to-default +
// density"), matching Synara's own inline settings search (embedded in the
// nav column itself, not a separate modal). A flat, hand-maintained index
// mirroring every real row's own title (Synara's settingsSearchIndex.ts
// keeps the same kind of manually-maintained array) -- `target` is the
// matching SettingsRow's own `id` above (its own scroll-mt-24 anchor) for a
// real per-row jump, or null for a panel-level result with no single row to
// land on (Providers/Theme/Log out).
type SettingsSearchEntry = {
  id: string;
  section: SettingsSection;
  title: string;
  keywords: string;
  target: string | null;
};

const SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  { id: "log-out", section: "profile", title: "Log out", keywords: "sign out session logout", target: "setting-log-out" },
  { id: "avatar", section: "profile", title: "Profile picture", keywords: "avatar photo upload image picture", target: "setting-avatar" },
  { id: "default-provider", section: "chat", title: "Default provider", keywords: "model claude codex ai new chat", target: "setting-default-provider" },
  { id: "default-effort", section: "chat", title: "Default effort", keywords: "reasoning low medium high xhigh max", target: "setting-default-effort" },
  { id: "providers", section: "provider", title: "Provider", keywords: "api key connect claude codex mistral xai qwen kimi github gemini deepseek providers", target: null },
  { id: "apps", section: "apps", title: "Apps", keywords: "integrations github gmail google docs connect oauth mention", target: null },
  { id: "theme", section: "appearance", title: "Theme", keywords: "light dark system color mode appearance", target: "setting-theme" },
  { id: "transparency", section: "appearance", title: "Enable transparency", keywords: "blur vibrancy mac window appearance", target: "setting-transparency" },
  { id: "system-ui-font", section: "appearance", title: "Use system UI font", keywords: "font typography native system appearance", target: "setting-system-ui-font" },
  { id: "content-size", section: "appearance", title: "Content size", keywords: "standard expanded wide column appearance", target: "setting-content-size" },
  { id: "font-smoothing", section: "appearance", title: "Font smoothing", keywords: "antialiased crisp text rendering mac appearance", target: "setting-font-smoothing" },
  { id: "notify-turn-complete", section: "general", title: "Receive a notification from every chat when a turn completes", keywords: "notification toast turn complete finished notify", target: "setting-notify-turn-complete" },
  { id: "chat-usage", section: "chat", title: "Chat usage", keywords: "usage sessions count local", target: "setting-chat-usage" },
];

// Simple substring ranking: a title match ranks above a keyword match,
// which ranks above a section-label match -- same relative ordering
// Synara's own rankSettingsSearchEntries uses (title > keywords > section),
// just plain substring instead of that app's own fuzzy-match helper (no
// equivalent shared utility exists in this codebase yet, and a literal
// port wasn't the ask -- "same style", not the exact algorithm).
function rankSettingsSearch(query: string): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = SETTINGS_SEARCH_ENTRIES.map((entry) => {
    const title = entry.title.toLowerCase();
    const sectionLabel = SECTIONS.find((s) => s.key === entry.section)?.label.toLowerCase() ?? "";
    let score = -1;
    if (title.startsWith(q)) score = 0;
    else if (title.includes(q)) score = 1;
    else if (entry.keywords.includes(q)) score = 2;
    else if (sectionLabel.includes(q)) score = 3;
    return { entry, score };
  });
  return scored
    .filter((s) => s.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 12)
    .map((s) => s.entry);
}

// Same provider list ProvidersPage.tsx used before it was folded into
// this overlay (per explicit request -- "providers should bring us to
// the settings page at the providers menu", not its own standalone
// route). Descriptions have no per-provider field of their own on
// QUICK_CHAT_MODELS, so they're hand-written here, matching the
// reference screenshot's own one-line style.
const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  Claude: "Run chats and agents using Anthropic's Claude models",
  Codex: "Run chats and agents using OpenAI's ChatGPT models",
  Mistral: "Run chats and agents using Mistral's open and enterprise models",
  xAI: "Run chats and agents using xAI's Grok models",
  Qwen: "Run chats and agents using Alibaba's Qwen models",
  Kimi: "Run chats and agents using Moonshot AI's Kimi models",
  GitHub: "Run chats and agents using GitHub Copilot's models",
  Antigravity: "Run chats and agents using Gemini models via Google's Antigravity",
  DeepSeek: "Run chats and agents using DeepSeek's models",
};

// Shared by the provider grid's own "Install" link (ProviderCard) and the
// missing-CLI dialog's "Visit provider documentation" button
// (ProviderConnectionView) -- was duplicated inline in the dialog only,
// pulled out once ProviderCard needed the same lookup too. Only two real,
// confirmed doc URLs exist right now -- everything else in PROVIDERS has
// no real backend integration yet, so there's nothing real to link to for
// them (ProviderCard's own "Install" falls back to opening the provider
// picker instead when a provider has no entry here).
// Providers Alongside installs itself, with the provider's official installer (backend cli_install.rs):
// no terminal, npm or Homebrew. The others' + still opens their docs.
const INSTALLABLE_PROVIDERS = new Set(["claude", "codex", "antigravity", "grok"]);

const PROVIDER_DOCS_URLS: Record<string, string> = {
  claude: "https://code.claude.com/docs",
  codex: "https://github.com/openai/codex",
  antigravity: "https://antigravity.google/docs",
  grok: "https://docs.x.ai/build/overview",
};

// Grok, through xAI's Grok Build: installed and signed in from here, though chats can't run on it yet
// (alongsidedotrun/private#480), so it isn't in the model menu (QUICK_CHAT_MODELS).
const GROK_PROVIDER: Provider = {
  name: "Grok",
  displayName: "Grok",
  displayCaption: "via Grok Build",
  description: "Run chats and agents using xAI's Grok models",
  icon: "/icons/providers/grok.svg",
  value: "grok",
  invertInDark: true,
  configured: false,
};

// Originally just Claude/Gemini/Codex ("for now, lets focus on gemini,
// codex and chatgpt and for the others do coming soon instead of set
// up"), xAI added after -- per explicit request, since Grok is free with
// just a Twitter/X account. Every other provider (Mistral, Qwen, Kimi,
// GitHub, DeepSeek) still renders disabled with a "Coming soon" status in
// ProviderCard instead of a real Set up/Install/Log in action -- a
// deliberate product-scope gate, not a reflection of what
// useCliAvailability can actually detect for them.
// "Antigravity", not "Gemini" -- per explicit decision,
// github.com/alongsidedotrun/alongside/issues/10: Google's own servers
// reject the free-tier personal-account login the bare `gemini` CLI runs on
// entirely ("migrate to the Antigravity suite of products"), confirmed live
// with a real, freshly-signed-in account -- sign-in completed, but every
// actual turn failed. `agy` (Homebrew cask antigravity-cli, Google's own
// real terminal client for the same product) worked immediately against
// that same account with no separate re-auth step -- see
// backend/src/antigravity.rs's own top comment for the full integration.
const ACTIVE_PROVIDERS = new Set(["Claude", "Codex", "Antigravity"]);

type Provider = {
  name: string;
  displayName: string;
  displayCaption?: string;
  description: string;
  icon: string;
  value: string;
  invertInDark?: boolean;
  configured: boolean;
};

const PROVIDERS: Provider[] = Array.from(new Set(QUICK_CHAT_MODELS.map((m) => m.provider))).map((provider) => {
  const models = QUICK_CHAT_MODELS.filter((m) => m.provider === provider);
  const display = PROVIDER_DISPLAY[provider];
  return {
    name: provider,
    displayName: display?.primary ?? provider,
    displayCaption: display?.caption,
    description: PROVIDER_DESCRIPTIONS[provider] ?? `Run chats and agents using ${provider}'s models`,
    // Antigravity's own mark, not its models' Gemini icon -- every other
    // provider's card icon is also its models' own icon (Claude/Codex have
    // no separate "underlying tool" brand distinct from the model itself),
    // but Antigravity is a real, different product from Gemini the model,
    // and the user has the real asset for it (icons/providers/
    // antigravity.png) specifically to distinguish the two here.
    icon: provider === "Antigravity" ? "/icons/providers/antigravity.png" : models[0].icon,
    value: models[0].value,
    invertInDark: models[0].invertInDark,
    configured: models.some((m) => m.configured),
  };
});

// "Connected" (both the provider grid's own cards and ProviderConnectionView's own
// header badge) means "will this actually work right now", per explicit request -- not
// "is there a saved API key" (Claude, e.g., works via the personal-account fallback
// with no key at all now, backend/src/lib.rs's own build_options). backend/src/server.rs's
// cli_available route (which::which(bin).is_ok()) is the closest real signal this app
// has for that today -- it can't confirm the CLI is actually *logged in*, only that the
// binary exists on PATH, but that's still a real check instead of the static hardcoded
// `configured` QUICK_CHAT_MODELS carried before (every Claude model always `true`,
// everything else always `false`, regardless of what's actually installed).
// `error: true` (backend unreachable -- e.g. the web app open with no backend running
// behind it, confirmed directly as the real cause of a "no PATH available" report that
// turned out wrong: the CLI genuinely was on PATH, curl straight to the endpoint
// confirmed it) is now a distinct outcome from `available: false` (backend reached fine,
// genuinely didn't find the binary) -- collapsing both into one `false` before is what
// let a plain connectivity problem misreport as "this CLI isn't installed".
// Exported now -- WelcomePage's own "Initial setup" row uses this same live
// check (is the claude CLI on PATH) to decide whether initial setup is
// actually done, instead of the hardcoded INITIAL_SETUP_DONE = false that
// component used to carry.
// Real cache, per explicit request ("do a cache type... checks whenever we open if
// the provider settings has changed") -- module-level, not component state, so it
// survives ProviderConnectionView/ProviderCard unmounting when Settings closes and
// remounting the next time it opens. A provider whose status was already checked
// once this page session renders its last known state immediately (no "Checking..."
// flash) while a fresh check runs silently in the background; ConnectionBadge
// (below) is what animates the swap if that fresh check actually disagrees with
// the cached value.
//
// Backed by localStorage now, not just the in-memory Map -- confirmed
// directly as a real gap ("when we reload the page that does not have
// cached that we have setup a provider so it shows us the inactive...
// step and then flashes the actual menu items"): a module-level Map alone
// only survives client-side navigation within the same page load, not an
// actual reload (which resets every JS module), so WelcomePage.tsx's own
// initialSetupDone (this hook, "claude") flashed the not-yet-set-up state
// on every hard refresh even on a machine that's genuinely configured.
const AVAILABILITY_CACHE_KEY = "alongside_cli_availability_cache";

function loadAvailabilityCache(): Map<string, { available: boolean; installed: boolean }> {
  try {
    const raw = localStorage.getItem(AVAILABILITY_CACHE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

const availabilityCache = loadAvailabilityCache();

function persistAvailabilityCache() {
  try {
    localStorage.setItem(AVAILABILITY_CACHE_KEY, JSON.stringify(Object.fromEntries(availabilityCache)));
  } catch {
    // Best-effort -- a private/full-storage failure here just means the
    // next reload flashes again, not a real error to surface.
  }
}

export function useCliAvailability(binary: string): {
  available: boolean | undefined;
  // Distinct from `available` now -- see backend/src/server.rs's own cli_available
  // comment: "not available" used to always mean "no PATH available" in the UI, even
  // when the real problem was "installed but not signed in", a different, actionable
  // case (needs a login, not an install) -- reported directly as confusing.
  installed: boolean | undefined;
  error: boolean;
  // Re-runs the same check on demand -- used by ProviderConnectionView's own
  // post-"Setup now" poll (below) so the Connected badge updates live once sign-in
  // actually completes, instead of only ever refreshing on mount (reported directly:
  // closing the dialog after Setup now left the badge showing stale "Not connected"
  // until the whole Providers view was closed and reopened). Returns the fresh
  // `available` value directly so a caller polling in a loop doesn't have to wait a
  // render for the state update to land.
  refetch: () => Promise<boolean>;
} {
  const cached = availabilityCache.get(binary);
  // Seeded from the cache, not always undefined -- a provider already checked
  // once this page session starts already knowing the answer, instead of
  // flashing "Checking..." (ConnectionBadge, below, no longer even has that
  // state to render) on every single reopen of Settings.
  // ?noProvider=1 (development): every provider reads as not installed, to see the setup page.
  const forced = forcedNoProvider();
  const [available, setAvailable] = useState<boolean | undefined>(forced ? false : cached?.available);
  const [installed, setInstalled] = useState<boolean | undefined>(forced ? false : cached?.installed);
  const [error, setError] = useState(false);

  const check = useCallback(() => {
    return fetch(`/cli/${encodeURIComponent(binary)}/available`)
      .then((res) => {
        if (!res.ok) throw new Error(`cli_available responded ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const forced = forcedNoProvider();
        const isAvailable = !forced && Boolean(data.available);
        const isInstalled = !forced && Boolean(data.installed);
        // A forced answer isn't the real one: the cache keeps what the CLI said.
        if (!forced) {
          const before = availabilityCache.get(binary)?.available;
          availabilityCache.set(binary, { available: isAvailable, installed: isInstalled });
          persistAvailabilityCache();
          if (before !== undefined && before !== isAvailable) providersChanged();
        }
        setAvailable(isAvailable);
        setInstalled(isInstalled);
        setError(false);
        return isAvailable;
      })
      .catch(() => {
        setError(true);
        return false;
      });
  }, [binary]);

  useEffect(() => {
    // No reset to undefined here any more -- the cached value (if any) stays on
    // screen the whole time this real check runs in the background; only a
    // value that actually changes is worth animating (ConnectionBadge's own
    // job), not a "checking" state nobody asked to see.
    let cancelled = false;
    check().then(() => {
      if (cancelled) return;
    });
    // Installing a CLI or signing in to it happens in a terminal: coming back to the app
    // checks again, so the row catches up without reopening Settings.
    const recheck = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [binary, check]);

  return { available, installed, error, refetch: check };
}

// Real states only -- "checking" was removed as a *visible* state per explicit
// request; a first-ever check (no cache yet) with nothing to show renders
// nothing at all rather than a "Checking..." placeholder, and every later
// reopen already has a cached value to show immediately.
// "not-connected" split into "not-installed"/"not-signed-in" -- per
// explicit request ("we should show the different errors at the right
// corner"): ALS-003 (no CLI on PATH at all) and ALS-004 (CLI there, just
// not signed in) are different, differently-actionable problems (same
// reasoning ProviderCard's own statusLabel and the missing-CLI dialog's
// title/description already split on), and collapsing both into one
// generic "Not connected" here was the one place left still hiding that.
type ConnectionState = "connected" | "not-installed" | "not-signed-in" | "error" | "waiting";

// Cross-fades between states -- per explicit request ("update from Connected to
// not connected with a transition we do fade in and fade out"). Renders nothing
// while state is undefined (no cache yet, first check still in flight) rather
// than a placeholder pill -- there's nothing real to say yet, and a skeleton
// that immediately gets replaced reads as more noise than silence does for
// something this fast.
function ConnectionBadge({ state }: { state: ConnectionState | undefined }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(state);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (state === shown) return;
    if (state === undefined) return;
    if (shown === undefined) {
      // Nothing was on screen to fade out -- the first real value just fades
      // straight in.
      setShown(state);
      setVisible(true);
      return;
    }
    setVisible(false);
    const timeout = setTimeout(() => {
      setShown(state);
      setVisible(true);
    }, 150);
    return () => clearTimeout(timeout);
  }, [state, shown]);

  if (shown === undefined) return null;

  // Error shows just the code, not the full sentence -- per explicit
  // request ("reduce that size of the text to text-xs and only show the
  // error number"): the full ALS-002 message is already right there in
  // the "Use your own X account" card below it, so repeating the whole
  // sentence in this corner badge too was redundant next to the
  // provider's own name.
  const isError = shown === "error";
  const label =
    shown === "waiting"
      ? t("settings.providers.waitingForSignIn")
      : isError
        ? "(ALS-002)"
        : shown === "connected"
          ? t("common.connected")
          : shown === "not-signed-in"
            ? t("settings.providers.notSignedIn")
            : t("settings.providers.notInstalled");
  const tone =
    shown === "connected"
      ? "rounded-full px-2 py-0.5 text-ui-2xs font-medium bg-green-500/10 text-green-600 dark:text-green-400"
      : isError
        ? "text-xs font-normal text-muted-foreground"
        : "rounded-full px-2 py-0.5 text-ui-2xs font-medium bg-muted/50 text-muted-foreground";

  return (
    <span className={`shrink-0 transition-opacity duration-160 ${tone} ${visible ? "opacity-100" : "opacity-0"}`}>
      <ErrorText message={label} />
    </span>
  );
}

// A provider's setup, over Settings (there are no provider pages): what connecting it does, in words,
// and one action for where it stands -- install and sign in (Claude, Codex), its docs (the others),
// sign in, or disconnect -- plus Update when a newer version is out. Opened from its row (the row, the
// + and the check are one button). The row owns the state, so an install or sign-in carries on after
// the overlay is closed.
function ProviderSetupDialog({
  provider,
  open,
  onClose,
  status,
  setup,
  update,
  onDisconnected,
}: {
  provider: Provider;
  open: boolean;
  onClose: () => void;
  status: { available: boolean | undefined; installed: boolean | undefined; error: boolean };
  setup: ReturnType<typeof useProviderSetup>;
  update: ReturnType<typeof useCliUpdate>;
  onDisconnected: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const cliBinary = provider.name.toLowerCase();
  const installable = INSTALLABLE_PROVIDERS.has(cliBinary);
  const docsUrl = PROVIDER_DOCS_URLS[cliBinary];
  // "via Claude Code" -> "Claude Code": the app it runs through.
  const tool = provider.displayCaption?.replace(/^via\s+/, "") ?? provider.displayName;
  const names = { provider: provider.displayName, tool };
  const [disconnecting, setDisconnecting] = useState(false);
  const [code, setCode] = useState("");
  const { available, installed, error } = status;
  const askingForCode = setup.phase === "code" || setup.phase === "finishing";

  const state: ConnectionState | undefined =
    setup.phase === "signing-in" || askingForCode
      ? "waiting"
      : error
        ? "error"
        : available === undefined
          ? undefined
          : available
            ? "connected"
            : installed
              ? "not-signed-in"
              : "not-installed";

  const body =
    setup.phase === "installing"
      ? t("settings.providers.setup.installing", names)
      : askingForCode
        ? t("settings.providers.setup.code", names)
        : state === "waiting"
        ? t("settings.providers.setup.waiting", names)
        : state === "error"
          ? t("settings.providers.noConnection")
          : state === "connected"
            ? t("settings.providers.setup.connected", names)
            : state === "not-signed-in"
              ? t("settings.providers.setup.signIn", names)
              : installable
                ? t("settings.providers.setup.install", names)
                : t("settings.providers.setup.docs", names);

  async function disconnect() {
    setDisconnecting(true);
    const res = await fetch(`/cli/${encodeURIComponent(cliBinary)}/logout`, { method: "POST" }).catch(() => null);
    setDisconnecting(false);
    if (res?.ok) await onDisconnected();
    else showErrorToast(res ? t("settings.providers.couldNotDisconnect") : t("settings.providers.noConnection"), { id: `logout-${cliBinary}` });
  }

  const busy = setup.phase !== "idle";
  const codeFormId = useId();
  const primary = askingForCode
    ? {
        label: t("settings.providers.setup.finish"),
        type: "submit" as const,
        form: codeFormId,
        disabled: code.trim() === "" || setup.phase === "finishing",
        loading: setup.phase === "finishing",
      }
    : state === "error" || state === undefined
      ? undefined
      : state === "connected"
        ? { label: disconnecting ? t("settings.providers.disconnecting") : t("common.disconnect"), onClick: () => void disconnect(), disabled: disconnecting, destructive: true }
        : state === "waiting"
          ? { label: t("settings.providers.waitingForSignIn"), disabled: true, loading: true }
          : state === "not-signed-in"
            ? { label: t("settings.providers.signIn"), onClick: () => void setup.setUp(true), disabled: busy }
            : installable
              ? {
                  label: setup.phase === "installing" ? t("settings.providers.installing") : t("settings.providers.setup.installAndSignIn"),
                  onClick: () => void setup.setUp(false),
                  disabled: busy,
                  loading: setup.phase === "installing",
                }
              : docsUrl
                ? { label: t("settings.providers.visitDocs"), onClick: () => void window.open(docsUrl, "_blank", "noopener,noreferrer") }
                : undefined;

  return (
    <ShellDialog
      centered
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      icon={
        <span className={cn("grid size-8 place-items-center", SHELL_RADIUS, SHELL_SURFACE)}>
          <ProviderIcon model={provider} className="size-4.5" />
        </span>
      }
      title={provider.displayName}
      // Where it stands, under the name (no "via ..." here: the overlay is about connecting it).
      description={<ConnectionBadge state={state} />}
      actions={<ShellDialogActions cancelLabel={t("common.close")} onCancel={onClose} primary={primary} />}
    >
      <p className={cn("px-3 py-2.5 text-center text-ui-sm text-muted-foreground", SHELL_RADIUS, SHELL_SURFACE)}>
        <ErrorText message={body} />
      </p>
      {askingForCode && (
        <form
          id={codeFormId}
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim() && setup.phase === "code") void setup.submitCode(code.trim()).then(() => setCode(""));
          }}
        >
          <ShellField label={t("settings.providers.setup.codeLabel")} htmlFor={`${codeFormId}-code`}>
            <input
              id={`${codeFormId}-code`}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={t("settings.providers.setup.codePlaceholder")}
              className={SHELL_FIELD_INPUT}
            />
          </ShellField>
          {/* The tab Google opened, again, if it was closed or never showed. */}
          {setup.link && (
            <Button
              type="button"
              variant="tertiary"
              className={cn("h-8 w-full bg-white dark:bg-transparent", SHELL_RADIUS)}
              onClick={() => window.open(setup.link ?? undefined, "_blank", "noopener,noreferrer")}
            >
              {t("settings.providers.setup.openGoogle")}
            </Button>
          )}
        </form>
      )}
      {installed && update.updateAvailable && (
        <Button
          type="button"
          variant="tertiary"
          className={cn("h-8 w-full bg-white dark:bg-transparent", SHELL_RADIUS)}
          disabled={update.state === "updating"}
          loading={update.state === "updating"}
          title={update.state === "failed" && update.error ? update.error : undefined}
          onClick={() => void update.update()}
        >
          {update.state === "updating"
            ? t("settings.providers.updating")
            : update.state === "failed"
              ? t("settings.providers.updateFailed")
              : t("settings.providers.setup.update", names)}
        </Button>
      )}
    </ShellDialog>
  );
}

// Its own component, not inlined in ProvidersSection's own .map calls -- useCliAvailability
// is a hook, and hooks can't be called from inside a .map callback (Rules of Hooks), only
// from a real component's own top level. Row layout now (icon + name/status, a real
// action on the right), not a flex-col card with a model list -- per explicit request
// ("similar style to synara's where we can enable a toggle if cli and path are
// available but if not available then have a link Install or Log in if required"),
// matching Synara's own ProvidersSettingsPanel row (icon, name, status text, a Switch
// on the right) rather than this app's earlier model-list card. Two separate
// interactive elements now, not one big <button> -- an interactive element (the
// install/log-in action) can't nest inside another interactive element (this row's
// own open-detail button) without breaking keyboard nav/accessibility, so the
// icon+name portion is its own button and the right-hand action is a sibling, both
// inside a plain (non-interactive) row div.
// Whether a provider's CLI has a newer release, and updating it (backend cli_updates.rs).
function useCliUpdate(binary: string, enabled: boolean, onUpdated: () => void) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [state, setState] = useState<"idle" | "updating" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`/cli/${encodeURIComponent(binary)}/version`)
      .then((res) => (res.ok ? res.json() : null))
      .then((version: { update_available?: boolean } | null) => {
        if (!cancelled) setUpdateAvailable(version?.update_available === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [binary, enabled]);
  const update = async () => {
    setState("updating");
    setError(null);
    try {
      const res = await fetch(`/cli/${encodeURIComponent(binary)}/update`, { method: "POST" });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      const version = (await res.json()) as { update_available?: boolean };
      setUpdateAvailable(version.update_available === true);
      setState("idle");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("failed");
    }
  };
  return { updateAvailable, state, error, update };
}

// Setting a provider up from its row in one click: installing it when it isn't (Claude Code, Codex),
// then its own sign-in in the browser, watched until it's connected (2s, for up to 2 minutes, as the
// detail view's Setup now). A failed install says why in the toast (ALS-040), with no backend ALS-002.
function useProviderSetup(binary: string, providerName: string, refetch: () => Promise<boolean>) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"idle" | "installing" | "signing-in" | "code" | "finishing">("idle");
  // Antigravity's sign-in: the Google page it opened, which shows a code to paste here (antigravity_login.rs).
  const [link, setLink] = useState<string | null>(null);

  const install = async (): Promise<boolean> => {
    setPhase("installing");
    const res = await fetch(`/cli/${encodeURIComponent(binary)}/install`, { method: "POST" }).catch(() => null);
    const detail = res && !res.ok ? (await res.text().catch(() => "")).trim() : "";
    setPhase("idle");
    if (res?.ok) {
      await refetch();
      return true;
    }
    // Only the backend's own failure has a reason in its body; none (or the dev proxy's empty 502) is no backend.
    showErrorToast(detail ? t("settings.providers.installFailed", { provider: providerName, detail }) : t("settings.providers.noConnection"), { id: `install-${binary}` });
    return false;
  };

  const signIn = async () => {
    setPhase("signing-in");
    const res = await fetch(`/cli/${encodeURIComponent(binary)}/login`, { method: "POST" }).catch(() => null);
    // Antigravity answers with its Google link: the code from there finishes it (submitCode).
    const answer = res?.status === 200 ? ((await res.json().catch(() => null)) as { url?: string; needs_code?: boolean } | null) : null;
    if (answer?.needs_code && answer.url) {
      setLink(answer.url);
      setPhase("code");
      return;
    }
    if (res && !res.ok && res.status !== 404) {
      const detail = (await res.text().catch(() => "")).trim();
      setPhase("idle");
      showErrorToast(detail ? t("settings.providers.signInFailed", { provider: providerName, detail }) : t("settings.providers.noConnection"), { id: `login-${binary}` });
      return;
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (await refetch()) break;
    }
    setPhase("idle");
  };

  const setUp = async (installed: boolean | undefined) => {
    if (!installed && !(await install())) return;
    await signIn();
  };

  const submitCode = async (code: string) => {
    setPhase("finishing");
    const res = await fetch(`/cli/${encodeURIComponent(binary)}/login/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    if (res?.ok) {
      await refetch();
      setLink(null);
      setPhase("idle");
      return;
    }
    const detail = res ? (await res.text().catch(() => "")).trim() : "";
    // Expired or refused: it starts again from Sign in.
    setLink(null);
    setPhase("idle");
    showErrorToast(detail ? t("settings.providers.signInFailed", { provider: providerName, detail }) : t("settings.providers.noConnection"), { id: `login-${binary}` });
  };

  return { phase, link, install, setUp, submitCode };
}

// A provider's row: its icon, name and where it stands open its setup overlay (ProviderSetupDialog).
// Beside them, the next step, done straight away: a + that installs it (Claude, ChatGPT, Gemini), with
// a spinner in its place while it downloads; once installed, Sign in, which starts the provider's
// sign-in (Gemini's overlay opens by itself for the code Google shows); once signed in, Connected,
// which opens the overlay (to disconnect). Anything else (a provider to install from its docs, a failed
// check) opens the overlay.
function ProviderCard({
  provider,
  filter = "all",
  query = "",
  onStatus,
}: {
  provider: Provider;
  filter?: ConnectionFilter;
  query?: string;
  /** Whether it's connected, once known: Providers shows a placeholder when a tab has none. */
  onStatus?: (name: string, connected: boolean) => void;
}) {
  const { t } = useTranslation();
  const cliBinary = provider.name.toLowerCase();
  const { available, installed, error: cliCheckError, refetch: refetchAvailability } = useCliAvailability(cliBinary);
  const cliUpdate = useCliUpdate(cliBinary, installed === true, () => void refetchAvailability());
  const setup = useProviderSetup(cliBinary, provider.displayName, refetchAvailability);
  const installable = INSTALLABLE_PROVIDERS.has(cliBinary);
  const [open, setOpen] = useState(false);
  // Gemini's sign-in needs the code Google shows: its overlay opens for it.
  useEffect(() => {
    if (setup.phase === "code") setOpen(true);
  }, [setup.phase]);
  const checking = !cliCheckError && available === undefined;
  // `available` is seeded from availabilityCache, so a failed fresh check (cliCheckError) wins over it.
  const isConnected = available === true && !cliCheckError;
  const known = cliCheckError || available !== undefined;
  useEffect(() => {
    if (known) onStatus?.(provider.name, isConnected);
  }, [known, isConnected, provider.name, onStatus]);
  const statusLabel =
    setup.phase === "installing"
      ? t("settings.providers.installing")
      : setup.phase === "signing-in"
        ? t("settings.providers.waitingForSignIn")
        : setup.phase === "code" || setup.phase === "finishing"
          ? t("settings.providers.setup.waitingForCode")
          : cliCheckError
          ? t("settings.providers.noConnection")
          : checking
            ? t("settings.providers.checking")
            : isConnected
              ? t("common.connected")
              : installed
                ? t("settings.providers.notSignedInPlain")
                : t("settings.providers.notInstalledPlain");
  if (!showsUnder(filter, isConnected, query, provider.displayName)) return null;

  return (
    <>
      <div className={`flex select-none items-center gap-3 ${SETTINGS_CARD_RADIUS} p-2`}>
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 select-none items-center gap-3 text-left">
        <span className={PROVIDER_ICON_FRAME}>
          <ProviderIcon model={provider} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui-sm font-medium text-foreground">
            {provider.displayName}
            {provider.displayCaption && <span className="ml-1.5 font-normal text-muted-foreground">{provider.displayCaption}</span>}
          </span>
          <span className="line-clamp-2 text-ui-2xs font-normal text-muted-foreground"><ErrorText message={statusLabel} /></span>
        </span>
      </button>
        {/* A newer version is out: said here, updated from the overlay. */}
        {installed && cliUpdate.updateAvailable && (
          <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-[color-mix(in_oklab,var(--focus-accent)_12%,transparent)] px-1.5 text-ui-2xs leading-none font-medium whitespace-nowrap text-[var(--focus-accent)]">
            {t("settings.providers.updateAvailable")}
          </span>
        )}
        {isConnected && setup.phase === "idle" ? (
          <button type="button" onClick={() => setOpen(true)} className={cn(CONNECTED_MARK, "w-auto px-2 text-ui-xs font-medium")}>
            {t("common.connected")}
          </button>
        ) : (
          <button
            type="button"
            aria-label={installed ? t("settings.providers.signIn") : t("settings.providers.install")}
            aria-busy={setup.phase !== "idle"}
            disabled={setup.phase !== "idle" && setup.phase !== "code"}
            onClick={() => {
              if (setup.phase === "code" || cliCheckError || available === undefined) return setOpen(true);
              if (installed) return void setup.setUp(true);
              if (!installable) return setOpen(true);
              void setup.install();
            }}
            className={cn(
              CONNECTION_ADD,
              // Sign in: the same bordered control, wide enough for its word.
              installed && !cliCheckError && setup.phase === "idle" && "w-auto px-2 text-ui-xs font-medium",
              "disabled:cursor-default",
            )}
          >
            {setup.phase !== "idle" ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : installed && !cliCheckError ? (
              t("settings.providers.signIn")
            ) : (
              <Plus className="size-3.5" />
            )}
          </button>
        )}
      </div>
      <ProviderSetupDialog
        provider={provider}
        open={open}
        onClose={() => setOpen(false)}
        status={{ available, installed, error: cliCheckError }}
        setup={setup}
        update={cliUpdate}
        onDisconnected={refetchAvailability}
      />
    </>
  );
}

// Real integrations (issue #287) -- its own top-level Settings section
// (Settings > Apps), grouped under "Connections" alongside Provider (this
// file's own SETTINGS_NAV_GROUPS), per explicit correction ("Still inside
// providers its meant to be settings > apps and not settings > providers
// > apps") -- was a drill-in sub-page under Provider before that.
//
// Bring-your-own-OAuth-App wizard, per explicit direction: the user
// creates their own GitHub OAuth App and pastes its client id/secret
// here, rather than Alongside centrally owning one shared OAuth App.
// GET /integrations lists every connection this backend currently knows
// about (server.rs); this section only ever cares about the "github" row
// within it today -- Google Workspace repeats the same pattern once it
// exists.
// Real integrations (issue #287) -- a real page, not a popover, per
// explicit correction ("The github should not be a popover but open a
// page like it does in the provider and model so we have the steps to
// follow inside the page"). Same ?app=<name> query-param-driven swap
// ProvidersSection's own ?provider=<name> already uses (that function's
// own comment has the full "why a query param, not local state"
// reasoning -- the sidebar's own back chevron needs a real history entry
// to walk back to), not a second, differently-built navigation pattern.
function AppsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedApp = searchParams.get("app");
  function openApp(name: string) {
    setSearchParams({ app: name }, { replace: true });
  }
  const [filter, setFilter] = useState<ConnectionFilter>("all");
  const appsFade = useTabFade(filter);
  const [query, setQuery] = useState("");

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selectedApp === "github" ? (
        <motion.div
          key="connection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: spring.slow }}
          exit={{ opacity: 0, transition: spring.slow.exit }}
        >
          <GithubAppConnectionView onBack={() => navigate("/settings/apps", { replace: true })} />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: spring.slow }}
          exit={{ opacity: 0, transition: spring.slow.exit }}
        >
          <ConnectionToolbar
            filter={filter}
            onFilter={setFilter}
            itemCount={1 + GOOGLE_APPS.length}
            query={query}
            onQuery={setQuery}
            searchLabel={t("settings.connections.searchApps")}
          />
          <motion.div {...appsFade.motion}>
          <ConnectionList>
            <GithubIntegrationCard filter={appsFade.shown} query={query} onClick={() => openApp("github")} />
            {GOOGLE_APPS.map((app) =>
              showsUnder(appsFade.shown, false, query, app.name) ? (
                // No connection flow yet, so never connected, and the row does nothing for now.
                <AppRow key={app.id} name={app.name} description={t(app.descriptionKey)} icon={app.icon} connected={false} onClick={() => {}} />
              ) : null,
            )}
          </ConnectionList>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** An app in Settings > Apps: its icon in a bordered frame, name and description, and a + (or a check
 *  once connected) at the right end. */
function AppRow({ name, description, icon, connected, onClick }: { name: string; description: string; icon: ReactNode; connected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={CONNECTION_ROW}>
      <span className={PROVIDER_ICON_FRAME}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui-sm font-medium text-foreground">{name}</span>
        <span className="line-clamp-2 text-ui-2xs font-normal text-muted-foreground">{description}</span>
      </span>
      <span className={connected ? CONNECTED_MARK : CONNECTION_ADD} aria-hidden="true">
        {connected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      </span>
    </button>
  );
}

// Google's apps, listed with their marks (public/icons/google-*.svg) ahead of a connection flow.
const GOOGLE_APPS = (["drive", "docs", "sheets"] as const).map((id) => ({
  id,
  name: `Google ${id[0].toUpperCase()}${id.slice(1)}`,
  descriptionKey: `settings.apps.google.${id}.description`,
  icon: <img src={`/icons/google-${id}.svg`} alt="" className="size-5 object-contain" />,
}));

function GithubIntegrationCard({ onClick, filter = "all", query = "" }: { onClick: () => void; filter?: ConnectionFilter; query?: string }) {
  const { t } = useTranslation();
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch("/integrations")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { provider: string; connected_username: string | null }[]) => {
        setConnectedUsername(rows.find((r) => r.provider === "github")?.connected_username ?? null);
      });
  }, []);

  const isConnected = connectedUsername !== null;
  if (!showsUnder(filter, isConnected, query, "GitHub")) return null;

  // Its own description below the name (the + or check says whether it's connected); the row opens
  // GithubAppConnectionView either way.
  return (
    <AppRow
      name="GitHub"
      description={t("settings.apps.github.description")}
      icon={<img src="/icons/providers/github.svg" alt="" className="size-5 dark:invert" />}
      connected={isConnected}
      onClick={onClick}
    />
  );
}

// The 3 real steps, per explicit direction almost verbatim: (1) create your
// own GitHub OAuth App with this exact callback URL, (2) paste its client
// id/secret, (3) use it in chat via @github. Bring-your-own-app rather than
// one Alongside-owned OAuth App -- backend/src/integrations.rs has the
// full "why" (sidesteps a shared secret across every user, and Google's
// own "unverified app" limit once this same pattern extends there). A real
// page (this component), not a Dialog -- per explicit correction, same
// "icon+name header, content below" shape ProviderConnectionView uses.
function GithubAppConnectionView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const callbackUrl = `${location.protocol}//${location.host}/integrations/github/callback`;

  const refresh = () => {
    fetch("/integrations")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { provider: string; connected_username: string | null }[]) => {
        setConnectedUsername(rows.find((r) => r.provider === "github")?.connected_username ?? null);
      });
  };
  useEffect(refresh, []);

  async function connect() {
    if (!clientId.trim() || !clientSecret.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/integrations/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }),
      });
      setClientSecret("");
      // The real result (connected_username) only lands once the user
      // finishes GitHub's own consent screen in the system browser this
      // just opened -- polled for here rather than assumed, since this
      // response only means "the OAuth flow started", not "it finished".
      setTimeout(refresh, 3000);
    } finally {
      setSubmitting(false);
    }
  }

  async function disconnect() {
    await fetch("/integrations/github", { method: "DELETE" });
    refresh();
    onBack();
  }

  return (
    <div>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center">
          <img src="/icons/providers/github.svg" alt="" className="size-6 dark:invert" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-ui font-medium text-foreground">GitHub</div>
          <div className="truncate text-ui font-normal text-muted-foreground">
            {connectedUsername ? t("settings.apps.github.connectedAs", { username: connectedUsername }) : t("settings.apps.github.notConnected")}
          </div>
        </div>
      </div>
      {connectedUsername ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-ui text-muted-foreground">
            <Trans i18nKey="settings.apps.github.useInChat" components={[<span className="font-mono" key="0" />]} />
          </p>
          <Button variant="outline" className="w-fit" onClick={() => void disconnect()}>
            {t("common.disconnect")}
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-ui font-medium text-foreground">{t("settings.apps.github.step1.title")}</p>
            <p className="text-ui-sm text-muted-foreground">{t("settings.apps.github.step1.description")}</p>
            <code className="rounded-lg bg-muted px-2.5 py-1.5 text-ui-xs break-all text-foreground">{callbackUrl}</code>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-ui font-medium text-foreground">{t("settings.apps.github.step2.title")}</p>
            <Input placeholder={t("settings.apps.github.clientId.placeholder")} value={clientId} onChange={(event) => setClientId(event.target.value)} />
            <Input
              type="password"
              placeholder={t("settings.apps.github.clientSecret.placeholder")}
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
            />
            <p className="text-ui-xs text-muted-foreground">{t("settings.apps.github.secretWarning")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-ui font-medium text-foreground">{t("settings.apps.github.step3.title")}</p>
            <p className="text-ui-sm text-muted-foreground">
              <Trans i18nKey="settings.apps.github.step3.description" components={[<span className="font-mono" key="0" />]} />
            </p>
          </div>
          <Button className="w-fit" disabled={!clientId.trim() || !clientSecret.trim() || submitting} onClick={() => void connect()}>
            {t("common.connect")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ProvidersSection() {
  // No page per provider: each row opens its setup as an overlay (ProviderSetupDialog).
  const { t } = useTranslation();
  // Two real sections now, not one flat grid -- per explicit request
  // ("so we have two sections"), each under its own describer label
  // (the sidebar's own "Recent projects"/"Recent chats" describer
  // treatment, this file's own SettingsSidebarNav group-label comment has
  // the full history) matching Synara's own "Available"/"Coming soon"
  // language.
  const activeProviders = useMemo(
    () => PROVIDERS.filter((p) => ACTIVE_PROVIDERS.has(p.name)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    []
  );
  const [filter, setFilter] = useState<ConnectionFilter>("all");
  const [query, setQuery] = useState("");
  const listed = useMemo(() => [...activeProviders, GROK_PROVIDER], [activeProviders]);
  // Each provider's connection, as its row learns it: Connected or Available with none in it (once
  // every one has answered) gets a placeholder instead of an empty space.
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const reportStatus = useCallback((name: string, connected: boolean) => {
    setConnections((current) => (current[name] === connected ? current : { ...current, [name]: connected }));
  }, []);
  const tabFade = useTabFade(filter);
  const shownFilter = tabFade.shown;
  const tabEmpty =
    shownFilter !== "all" &&
    listed.every((provider) => connections[provider.name] !== undefined) &&
    !listed.some((provider) => showsUnder(shownFilter, connections[provider.name], query, provider.displayName));

  return (
    // Same crossfade AppLayout.tsx's own route transitions use (its
    // AnimatePresence/motion.div around {outlet}, 0.15s opacity fade) --
    // per explicit request, this list <-> connection-detail swap should
    // feel like "the same as our page transition" even though it's a
    // local view swap inside the modal, not a real route change.
    <div>
          {/* Search bar removed -- per explicit request ("lets remove the
              search bar from providers as that's not needed for now"):
              only ACTIVE_PROVIDERS.size real tiles plus Request a
              provider exist today, few enough that searching them adds
              nothing yet. */}
          {/* Two columns under All / Connected / Available tabs: rows without borders, the border
              on each provider's icon instead. */}
          {activeProviders.length > 0 && (
            <>
              <ConnectionToolbar
                filter={filter}
                onFilter={setFilter}
                itemCount={activeProviders.length + 1}
                query={query}
                onQuery={setQuery}
                searchLabel={t("settings.connections.searchProviders")}
              />
              <motion.div {...tabFade.motion}>
              <ConnectionList
                placeholder={
                  !tabEmpty ? undefined : shownFilter === "connected" ? (
                    <ProvidersEmptyState title={t("settings.providers.empty.connected.title")} body={t("settings.providers.empty.connected.body")} />
                  ) : (
                    <ProvidersEmptyState title={t("settings.providers.empty.available.title")} body={t("settings.providers.empty.available.body")} />
                  )
                }
              >
                {listed.map((provider) => (
                  <ProviderCard key={provider.name} provider={provider} filter={shownFilter} query={query} onStatus={reportStatus} />
                ))}
              </ConnectionList>
              </motion.div>
            </>
          )}
          {/* Each provider's usage, right here (it had its own page): a card each, with Filter and Sort.
              It fades with the list when the tab changes, rather than moving. */}
          <motion.div {...tabFade.motion}>
            <ProviderUsageSection />
          </motion.div>
          {/* Real integrations (issue #287) -- moved to their own top-level
              "Apps" settings section (AppsSection, below) per explicit
              correction ("Still inside providers its meant to be settings
              > apps and not settings > providers > apps") -- no longer
              reached from here at all. */}
    </div>
  );
}

// Resizes/re-encodes an uploaded photo before it ever reaches localStorage
// -- a raw phone photo can easily be several MB, and localStorage's own
// quota (~5-10MB total, shared with every other alongside_* key this app
// already keeps there) would fail outright, silently or otherwise, well
// before the user has any idea why. 256px is comfortably larger than
// every place this app actually renders an avatar today (the biggest,
// settings-overlay.tsx's own new preview below, is 80px) with real headroom
// for a future bigger surface, at a fraction of a typical photo's size.

// New, per explicit request ("add a new menu at settings for Profile where
// we can allow users to upload their avatar picture for now which is the
// only option that we will have and logout to go inside there instead of
// general"). Avatar upload is the one real control here; Log out moved
// down from General's own former Caution section (that section's own
// comment has the pointer).
function ProfileSection() {
  const { t } = useTranslation();
  const isSignedIn = useIsSignedIn();
  const avatarImage = useUserAvatarImage();
  const currentName = useUserDisplayName();
  // The plan the identity service reports; a signed-out device is on the free plan.
  const identityPlan = useIdentity().plan;
  const plan = identityPlan === "hosted" || identityPlan === "enterprise" ? identityPlan : "free";
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  // A newly picked file, resized but not yet saved -- per explicit
  // follow-up request ("upload new flips to Confirm"): picking a file now
  // previews it in the same dialog instead of saving immediately, and
  // Confirm is the one action that actually persists it. Cleared whenever
  // the dialog closes without confirming (the Dialog's own onOpenChange
  // below), so reopening it never shows a stale, unsaved preview.
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setError(t("settings.profile.avatar.invalidFile"));
      return;
    }
    try {
      const dataUrl = await resizeImageFile(file);
      setPendingImage(dataUrl);
    } catch {
      setError(t("settings.profile.avatar.unusable"));
    }
  }

  function handleConfirmUpload() {
    if (!pendingImage) return;
    setUserAvatarImage(pendingImage);
    setPendingImage(null);
    setManageOpen(false);
  }

  // A plain temporary <a download>, not a Tauri save-file dialog -- the
  // data URL already holds the full image, so the browser/webview's own
  // download handling is all a real file save needs here.
  function handleDownload() {
    if (!avatarImage) return;
    const link = document.createElement("a");
    link.href = avatarImage;
    link.download = "profile-picture.jpg";
    link.click();
  }

  return (
    <div className="mx-auto flex w-full max-w-[540px] flex-col gap-3 bg-[#FAFAFA] px-[max(2.5rem,15%)] py-20 dark:bg-[var(--redesign-primary-surface)]">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <div className="mb-2">
          <Avatar size="lg" className="size-16 shrink-0">
            <AvatarFallback className="text-xl">
              {avatarImage ? <img src={avatarImage} alt="" className="size-full rounded-full object-cover" /> : <DefaultAvatar name={currentName} />}
            </AvatarFallback>
          </Avatar>
        </div>
        <h2 className="text-ui-xl font-medium text-foreground">{t("settings.nav.profile")}</h2>
        <p className="text-ui-sm text-muted-foreground">{t("settings.nav.subtitle.profile")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <ShellField label={t("settings.profile.name.title")}>
          <span className="truncate text-ui text-foreground">{isSignedIn ? currentName : t("settings.profile.name.signedOut")}</span>
        </ShellField>
        <ShellField label={t("settings.profile.subscription.title")}>
          <span className="text-ui text-foreground">{t(`settings.profile.subscription.${plan}`)}</span>
        </ShellField>
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui-sm font-medium text-foreground">{t("settings.profile.avatar.title")}</p>
              <p className="mt-0.5 text-ui-sm text-muted-foreground">{t("settings.profile.avatar.description")}</p>
            </div>
            <button type="button" className={SETTINGS_ACTION_BUTTON_CLASS} disabled={!isSignedIn} onClick={() => setManageOpen(true)}>
              {t("settings.profile.avatar.managePhoto")}
            </button>
          </div>
          {error && <p className="text-ui-xs text-destructive"><ErrorText message={error} /></p>}
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => void handleFileSelected(event)} />
      </div>
      <Dialog
        open={manageOpen}
        onOpenChange={(open) => {
          setManageOpen(open);
          if (!open) setPendingImage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{t("settings.profile.avatar.dialogTitle")}</DialogTitle>
            <DialogDescription className="text-ui font-normal">
              {avatarImage ? t("settings.profile.avatar.dialogDescription.withPhoto") : t("settings.profile.avatar.dialogDescription.noPhoto")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <Avatar size="lg" className="size-16 shrink-0">
              <AvatarFallback className="text-xl">
                {pendingImage ? <img src={pendingImage} alt="" className="size-full rounded-full object-cover" /> : <DefaultAvatar name={currentName} />}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{currentName}</span>
          </div>
          <DialogFooter>
            {avatarImage && !pendingImage && (
              <Button variant="outline" className="h-8 gap-1.5 text-ui-xs" onClick={handleDownload}>
                <DownloadIcon className="size-3.5" />
                {t("common.download")}
              </Button>
            )}
            {avatarImage && !pendingImage && (
              <Button className="h-8 bg-red-600 text-ui-xs text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600" onClick={() => clearUserAvatarImage()}>
                {t("common.remove")}
              </Button>
            )}
            {pendingImage ? (
              <Button className="h-8 text-ui-xs" onClick={handleConfirmUpload}>{t("common.confirm")}</Button>
            ) : (
              <Button className="h-8 text-ui-xs" onClick={() => fileInputRef.current?.click()}>{t("common.add")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="accent"
        className="h-8 w-full rounded-[calc(32px*8/27)]"
        onClick={() => {
          if (isSignedIn) signOut();
          else openSignInDialog();
        }}
      >
        {isSignedIn ? t("common.logOut") : t("common.signIn")}
      </Button>
    </div>
  );
}

// General's settings page: language and timezone.
// Story: Settings "Application" section
// (alongsidedotrun/private#207). Appearance used to be a fourth
// sub-section here too; it now lives in its own AppearanceSection, below.
function GeneralSection() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <SettingsSection title={t("settings.general.languageAndTimezone")}>
        <LanguageRow />
        <TimezoneRow />
      </SettingsSection>
    </div>
  );
}

// Its own top-level section now, not a General sub-section -- per
// explicit request ("we should get an appearance menu at the sidebar as
// well as palette icon and move from general").
function AppearanceSection() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isMac = useIsMac();
  const isWindows = useIsWindows();
  const isTauriApp = useIsTauri();
  // Installed desktop app on macOS or Windows specifically, not a browser tab --
  // useIsMac()/useIsWindows() alone are also true viewing the web build in a
  // regular browser, where there's no native window for a transparency effect
  // to apply to at all. Real per-OS implementations now exist for both (issue
  // #276, src-tauri/src/lib.rs's own set_transparency comment has the full
  // window-vibrancy reasoning) -- Linux stays unsupported/hidden here since
  // compositor support is too inconsistent to promise a real effect the same
  // way.
  const transparencySupported = (isMac || isWindows) && isTauriApp;
  const [transparencyEnabled, setTransparencyEnabled] = useState(loadTransparencyEnabled);
  const [systemUiFont, setSystemUiFontState] = useState(loadSystemUiFont);
  const [fontSmoothing, setFontSmoothingState] = useState(loadFontSmoothing);
  const [chatWidth, setChatWidthState] = useState<ChatWidth>(loadChatWidth);

  // Applies the real Rust-side effect on mount (so reopening Settings, or a
  // fresh launch with transparency already turned on from a previous session,
  // actually shows it) and on every toggle -- previously this state had no
  // real consumer at all (confirmed directly: no `invoke` call anywhere),
  // so flipping the switch did nothing on any platform, not just the ones
  // without a real implementation.
  useEffect(() => {
    if (!transparencySupported) return;
    void import("@tauri-apps/api/core").then(({ invoke }) => invoke("set_transparency", { enabled: transparencyEnabled }));
  }, [transparencySupported, transparencyEnabled]);

  function updateTransparency(next: boolean) {
    setTransparencyEnabled(next);
    localStorage.setItem(TRANSPARENCY_STORAGE_KEY, String(next));
  }
  function setSystemUiFont(next: boolean) {
    setSystemUiFontState(next);
    localStorage.setItem("alongside_system_ui_font", String(next));
    applySystemUiFont(next);
  }
  function setFontSmoothing(next: boolean) {
    setFontSmoothingState(next);
    localStorage.setItem("alongside_font_smoothing", String(next));
    applyFontSmoothing(next);
  }
  function setChatWidth(next: ChatWidth) {
    setChatWidthState(next);
    localStorage.setItem("alongside_chat_width", next);
    applyChatWidth(next);
  }

  const themeOptions: { value: typeof theme; label: string }[] = [
    { value: "system", label: t("settings.appearance.theme.system") },
    { value: "light", label: t("settings.appearance.theme.light") },
    { value: "dark", label: t("settings.appearance.theme.dark") },
  ];
  const currentTheme = themeOptions.find((o) => o.value === theme) ?? themeOptions[0];

  const chatWidthOptions: { value: ChatWidth; label: string }[] = [
    { value: "standard", label: t("settings.appearance.contentSize.standard") },
    { value: "expanded", label: t("settings.appearance.contentSize.expanded") },
  ];
  const currentChatWidth = chatWidthOptions.find((o) => o.value === chatWidth) ?? chatWidthOptions[0];

  return (
    <div className="flex flex-col">
      {/* Theme owns the appearance choices that change the canvas itself,
          including the content size. */}
      <SettingsSection title={t("settings.appearance.theme")}>
        <SettingsRow id="setting-theme" title={t("settings.appearance.theme")} description={t("settings.appearance.theme.description")}>
          <BaseDropdownMenu size="compact">
            <BaseDropdownTrigger
              render={
                <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_CLASS}>
                  <span>{currentTheme.label}</span>
                  <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              }
            />
            {/* No explicit rounding override any more -- per explicit
                request ("all these dropdowns have different rounded
                borders, make sure that the style that we have at help and
                avatar dropdown is applied to the other dropdowns"), this
                now takes ui/dropdown.tsx's own shared DROPDOWN_PANEL_RADIUS
                instead of a one-off match to the search bar's rounding. No
                divider between these options any more either -- per
                earlier explicit request, that divider belongs between the
                Appearance card's own rows instead (SettingsSection's own
                divide-y comment has the full reasoning), not inside this
                popup. */}
            <BaseDropdownContent align="end" checkedIndex={themeOptions.findIndex((o) => o.value === theme)}>
              {themeOptions.map((option, i) => (
                <BaseMenuItem
                  key={option.value}
                  index={i}
                  label={option.label}
                  checked={theme === option.value}
                  onSelect={() => setTheme(option.value)}
                />
              ))}
            </BaseDropdownContent>
          </BaseDropdownMenu>
        </SettingsRow>
        <SettingsRow
          id="setting-content-size"
          title={t("settings.appearance.contentSize.title")}
          description={t("settings.appearance.contentSize.description")}
        >
          <BaseDropdownMenu size="compact">
            <BaseDropdownTrigger
              render={
                <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_CLASS}>
                  <span>{currentChatWidth.label}</span>
                  <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              }
            />
            <BaseDropdownContent align="end" checkedIndex={chatWidthOptions.findIndex((o) => o.value === chatWidth)}>
              {chatWidthOptions.map((option, i) => (
                <BaseMenuItem
                  key={option.value}
                  index={i}
                  label={option.label}
                  checked={chatWidth === option.value}
                  onSelect={() => setChatWidth(option.value)}
                />
              ))}
            </BaseDropdownContent>
          </BaseDropdownMenu>
        </SettingsRow>
        {transparencySupported && (
          <SettingsRow
            id="setting-transparency"
            title={t("settings.appearance.transparency.title")}
            description={t("settings.appearance.transparency.description")}
          >
            <Switch checked={transparencyEnabled} onToggle={() => updateTransparency(!transparencyEnabled)} aria-label="Enable transparency" />
          </SettingsRow>
        )}
      </SettingsSection>

      <SettingsSection title={t("settings.appearance.fonts")}>
        <SettingsRow
          id="setting-system-ui-font"
          title={t("settings.appearance.systemUiFont.title")}
          description={t("settings.appearance.systemUiFont.description")}
        >
          <Switch checked={systemUiFont} onToggle={() => setSystemUiFont(!systemUiFont)} aria-label="Use system UI font" />
        </SettingsRow>
        {/* macOS only, hidden (not shown-and-disabled) everywhere else,
            per the confirmed story text ("Only visible when using macOS"). */}
        {isMac && (
          <SettingsRow
            id="setting-font-smoothing"
            title={t("settings.appearance.fontSmoothing.title")}
            description={t("settings.appearance.fontSmoothing.description")}
          >
            <Switch checked={fontSmoothing} onToggle={() => setFontSmoothing(!fontSmoothing)} aria-label="Font smoothing" />
          </SettingsRow>
        )}
      </SettingsSection>

    </div>
  );
}

// One shared LanguageValue now drives both this dropdown's own choice and,
// via i18n.changeLanguage (issue #307) + spelling_language (issue #306),
// the UI language and the AI's own reply language -- per explicit
// confirmation ("one shared setting"), not two separate controls. The
// former "More languages... Soon" placeholder is gone now that
// LANGUAGE_OPTIONS (language.ts) actually lists six real, translated
// languages alongside the three English variants.
function LanguageRow() {
  const { t } = useTranslation();
  const [language, setLanguageState] = useState(loadLanguage);

  function setLanguage(value: LanguageValue) {
    setLanguageState(value);
    saveLanguage(value);
    void i18n.changeLanguage(uiLocaleFor(value));
  }

  return (
    <SettingsRow id="setting-language" title={t("settings.general.language.title")} description={t("settings.general.language.description")}>
      <LanguageDropdown
        value={language}
        onChange={setLanguage}
        trigger={(label) => (
          <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_FIT_CLASS}>
            {label}
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </button>
        )}
      />
    </SettingsRow>
  );
}

function TimezoneRow() {
  const { t } = useTranslation();
  const [timezone, setTimezoneState] = useState(loadTimezone);

  function setTimezone(value: string) {
    setTimezoneState(value);
    saveTimezone(value);
  }

  return (
    <SettingsRow id="setting-timezone" title={t("settings.general.timezone.title")} description={t("settings.general.language.description")}>
      <TimezoneDropdown
        value={timezone}
        onChange={setTimezone}
        trigger={(label) => (
          <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_CLASS}>
            <span className="truncate">{label}</span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      />
    </SettingsRow>
  );
}

// "Default provider" (FEATURES.md) -- primary location for the setting per
// that doc; the compose box's own model dropdown "Set as default" action
// (compose-box.tsx) is the secondary, overridable one. GET/POST
// /settings/default-model (backend/src/server.rs) -- a single stored
// QUICK_CHAT_MODELS[].value string, shared with that same compose-box
// action so either surface changing it is immediately reflected in the
// other the next time each is opened.
function DefaultModelRow() {
  const { t } = useTranslation();
  const [defaultModel, setDefaultModel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/settings/default-model")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { model: string | null } | null) => {
        if (!cancelled && data) setDefaultModel(data.model);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateDefaultModel(value: string | null) {
    setDefaultModel(value);
    await fetch("/settings/default-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: value }),
    });
  }

  const entry = defaultModel ? QUICK_CHAT_MODELS.find((m) => m.value === defaultModel) : undefined;

  return (
    <SettingsRow
      id="setting-default-provider"
      title={t("settings.chat.defaultProvider.title")}
      description={t("settings.chat.defaultProvider.description")}
    >
      <BaseDropdownMenu size="compact">
        <BaseDropdownTrigger
          render={
            <button
              type="button"
              className={`flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-ui-sm text-foreground hover:bg-muted/30 ${SETTINGS_CONTROL_RADIUS}`}
            >
              {/* size-3.5 (14px), not size-4 (16px) -- per an app-wide
                  compact-scale audit. */}
              {entry && <ProviderIcon model={entry} className="size-3.5" />}
              {entry ? modelDisplayName(entry) : t("common.none")}
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          }
        />
        {/* Base UI reference DropdownContent/MenuItem, per explicit
            request ("Lets keep all base ui"). `checked` (not a separate
            trailing CheckIcon) drives MenuItem's own animated checkmark
            for the current default. Each row's icon is a tiny per-model
            closure adapting ProviderIcon (which takes `model`, not
            IconComponent's own size/strokeWidth/className shape) to the
            shape MenuItem expects. "None" -- per explicit request ("Add
            the option none to the settings for the default provider") --
            is its own leading row (index 0, model rows shifted +1) so a
            default can be cleared from here rather than needing a direct
            DB edit; POSTs model: null, which the backend now deletes the
            stored row for instead of storing an empty-string sentinel. */}
        <BaseDropdownContent align="end" className="max-h-72 overflow-y-auto" checkedIndex={defaultModel == null ? 0 : QUICK_CHAT_MODELS.filter((m) => m.configured).findIndex((m) => m.value === defaultModel) + 1}>
          <BaseMenuItem
            index={0}
            label={t("common.none")}
            checked={defaultModel == null}
            onSelect={() => void updateDefaultModel(null)}
          />
          <DropdownSeparator />
          {QUICK_CHAT_MODELS.filter((m) => m.configured).map((m, i) => (
            <BaseMenuItem
              key={m.value}
              index={i + 1}
              icon={() => <ProviderIcon model={m} className="size-3.5" />}
              label={modelDisplayName(m)}
              checked={defaultModel === m.value}
              onSelect={() => void updateDefaultModel(m.value)}
            />
          ))}
        </BaseDropdownContent>
      </BaseDropdownMenu>
    </SettingsRow>
  );
}

// "Default effort" -- same dropdown shape as "Default provider" above
// (DefaultModelRow), per explicit request ("do the same as the model
// default but for effort as well in settings"). A per-provider mode existed
// before this -- dropped along with the swap, since only Claude actually
// runs with its own chosen effort today (compose-box.tsx's own comment on
// EFFORT_LEVELS has the full reasoning) and per-provider granularity had no
// real use yet. Read by compose-box.tsx's own defaultEffortFor
// (lib/effort.ts) -- every compose box's own Effort dropdown starts here.
function DefaultEffortRow() {
  const { t } = useTranslation();
  const [defaultEffort, setDefaultEffort] = useState<EffortLevel | null>(() => loadDefaultEffort());

  function update(level: EffortLevel | null) {
    setDefaultEffort(level);
    saveDefaultEffort(level);
  }

  return (
    <SettingsRow
      id="setting-default-effort"
      title={t("settings.chat.defaultEffort.title")}
      description={t("settings.chat.defaultEffort.description")}
    >
      <BaseDropdownMenu size="compact">
        <BaseDropdownTrigger
          render={
            <button
              type="button"
              className={`flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-ui-sm text-foreground hover:bg-muted/30 ${SETTINGS_CONTROL_RADIUS}`}
            >
              {defaultEffort ? effortLabel(defaultEffort) : t("common.none")}
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          }
        />
        <BaseDropdownContent align="end" checkedIndex={defaultEffort == null ? 0 : EFFORT_LEVELS.indexOf(defaultEffort) + 1}>
          <BaseMenuItem
            index={0}
            label={t("common.none")}
            checked={defaultEffort == null}
            onSelect={() => update(null)}
          />
          <DropdownSeparator />
          {EFFORT_LEVELS.map((level, i) => (
            <BaseMenuItem
              key={level}
              index={i + 1}
              label={effortLabel(level)}
              checked={defaultEffort === level}
              onSelect={() => update(level)}
            />
          ))}
        </BaseDropdownContent>
      </BaseDropdownMenu>
    </SettingsRow>
  );
}

// Real backend setting (server.rs's own get/set_autocompact_scope), not local storage --
// has to be consistent for every chat regardless of which device/tab set it. Two
// separate switches, not one binary toggle -- per explicit follow-up ("one toggle for
// context per chat and another context per project"): each switch IS its own scope
// value, mutually exclusive (turning one on turns the other off), rather than one
// switch whose "off" state has to be inferred as meaning the other option. Whichever
// is on also drives the Context dropdown's own label (compose-box.tsx's own
// ContextDropdown, via ChatPage.tsx's chat_defaults handling of this same stored
// value) -- "Context per chat"/"Context per project".
function CompactScopeRows() {
  const { t } = useTranslation();
  // Three independent flags, not one enum -- server.rs's own set_autocompact_scope
  // comment has the full resolution/invariant rules (chat > project > global,
  // disabling chat alone enables global without touching project, enabling global
  // directly overrides both).
  const [flags, setFlags] = useState({ chat: true, project: true, global: false });
  useEffect(() => {
    let cancelled = false;
    fetch("/settings/autocompact-scope")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { chat: boolean; project: boolean; global: boolean } | null) => {
        if (!cancelled && data) setFlags(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function update(field: "chat" | "project" | "global", value: boolean) {
    const res = await fetch("/settings/autocompact-scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value }),
    });
    if (res.ok) setFlags(await res.json());
  }

  return (
    <>
      <SettingsRow
        id="setting-compact-per-chat"
        title={t("settings.chat.compactPerChat.title")}
        description={t("settings.chat.compactPerChat.description")}
      >
        <Switch checked={flags.chat} onToggle={() => void update("chat", !flags.chat)} aria-label="Context per chat" />
      </SettingsRow>
      <SettingsRow
        id="setting-compact-per-project"
        title={t("settings.chat.compactPerProject.title")}
        description={t("settings.chat.compactPerProject.description")}
      >
        <Switch checked={flags.project} onToggle={() => void update("project", !flags.project)} aria-label="Context per project" />
      </SettingsRow>
      <SettingsRow
        id="setting-compact-global"
        title={t("settings.chat.compactGlobal.title")}
        description={t("settings.chat.compactGlobal.description")}
      >
        <Switch checked={flags.global} onToggle={() => void update("global", !flags.global)} aria-label="Global context" />
      </SettingsRow>
    </>
  );
}

function ChatSection() {
  const { t } = useTranslation();
  // Moved here from General's own Usage section -- per explicit request
  // ("Chat usage should move from general and be at Chat, in the same way
  // we did for Provider usage"): it's a stat about chats, not a general
  // app preference.
  const { usage, error: usageError } = useUsageStats();
  const [queueing, setQueueing] = useQueueing();

  return (
    <div className="flex flex-col">
      <SettingsSection title={t("settings.chat.title")}>
        <DefaultModelRow />
        <DefaultEffortRow />
        <SettingsRow id="setting-queue-messages" title={t("settings.chat.queueMessages.title")} description={t("settings.chat.queueMessages.description")}>
          <Switch checked={queueing} onToggle={() => setQueueing(!queueing)} aria-label={t("settings.chat.queueMessages.title")} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t("settings.chat.compact.title")}>
        <CompactScopeRows />
      </SettingsSection>

      <SettingsSection title={t("settings.chat.usage")}>
        <SettingsRow
          id="setting-chat-usage"
          title={t("settings.chat.usage.title")}
          description={t("settings.chat.usage.description")}
          status={usageError ? t("settings.providers.noConnection") : undefined}
        >
          <span className="text-ui-sm font-medium text-foreground">
            {usage ? formatStorageBytes(usage.storage_bytes) : usageError ? "--" : "..."}
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* The yellow note above the composer as a provider's 5-hour limit fills: 85% always,
          plus any levels added here (or from the note's own Reminders). */}
      <SettingsSection title={t("limits.reminders.title")}>
        <p className="px-3 py-2 text-ui-sm text-muted-foreground">{t("limits.reminders.hint")}</p>
        <LimitReminderRows variant="settings" />
      </SettingsSection>

    </div>
  );
}

// localStorage, not a backend setting -- purely a per-device display
// preference (like theme itself, use-theme.ts's own storage), not something
// that needs to sync across a person's other machines.
const TRANSPARENCY_STORAGE_KEY = "alongside_transparency_enabled";

function loadTransparencyEnabled(): boolean {
  return localStorage.getItem(TRANSPARENCY_STORAGE_KEY) === "true";
}

// Reuses sidebar-nav.tsx's own mobile-drawer overlay mechanics (fixed,
// full-viewport, tap-outside-to-close) per explicit request, styled to
// match a reference screenshot instead: a dimmed/blurred backdrop behind
// a centered card (the sidebar's own mobile drawer deliberately skips
// dimming -- see that component's own comment -- since it's a curtain
// sliding over content, not a floating modal like this one).
// ---------------------------------------------------------------------------
// Full page now, not a modal -- per explicit request ("we need to update our
// settings to be exactly like it... i want a full page setting page"),
// matching Synara's own structure exactly: Settings is a real route
// (/settings/:section) that swaps the app's own main sidebar for this one
// (AppLayout.tsx's own conditional render) rather than floating a modal
// above whatever page was already showing. Split into two exports instead
// of one modal component -- SettingsSidebarNav renders in AppLayout's own
// sidebar slot, SettingsSectionContent renders in its main content slot
// (SettingsPage.tsx) -- since the two now live in genuinely different
// parts of the app shell, not two halves of one floating panel.
// ---------------------------------------------------------------------------

// A settings-scoped back/forward stack, separate from the router's real
// history -- per explicit request ("its not returning to previous pages
// that i visited in settings and its also showing > as available even
// though i have not visited and return from a new page"): the router's
// own navigate(-1)/(1) can't answer "is there really somewhere to go"
// (there's no API for that), and every settings section switch below
// uses `replace: true` on purpose (so leaving Settings from a plain
// section page can't accidentally happen a page at a time) which also
// means the router's real history has no settings-to-settings entries to
// walk in the first place. Module-level, not component state -- the
// sidebar (this component) and the section content (SettingsSectionContent,
// a separate mount elsewhere in AppLayout.tsx) both need the current
// path, but only this component needs to read/drive the stack itself.
//
// No mount-time reset any more -- a first pass tied that to a ref
// ("first effect run since this component mounted"), which broke under
// React StrictMode/Fast Refresh remounts in dev, confirmed directly
// ("sometimes shows as active but if i keep changing pages sometimes
// that deactivate < and stays greyed out"): a spurious remount silently
// wiped the stack back down to one entry, disabling Go back even though
// there was real settings history to walk. pushSettingsHistory's own
// guard already handles the empty-stack case correctly on its own
// (stack[-1] is undefined, never equal to a real path, so the very first
// push naturally seeds a one-entry stack) -- there's nothing left for a
// separate reset step to do that isn't already both simpler and
// remount-proof this way. The stack does now persist across leaving and
// re-entering Settings within the same app session rather than always
// starting fresh, which is a real behavior change, not just a bugfix --
// still never lets Go back leave Settings, since a path only ever lands
// in this stack while this component (mounted only inside "/settings") is
// the one pushing it.
let settingsHistoryState: { stack: string[]; index: number } = { stack: [], index: -1 };
const settingsHistoryListeners = new Set<() => void>();

function notifySettingsHistory() {
  settingsHistoryListeners.forEach((listener) => listener());
}

// Truncates any "forward" entries past the current position before
// pushing -- standard back/forward stack semantics (browsing forward
// again after going back replaces the abandoned future, it doesn't keep
// it around). No-ops if `path` is already the current entry -- this is
// also what keeps a back/forward-triggered navigation (goBack/goForward
// below, which move `index` and then call `navigate`) from re-triggering
// a push through the pathname-watching effect that calls this on every
// location change: by the time that effect runs, the stack's current
// entry already equals the new pathname.
function pushSettingsHistory(path: string) {
  if (settingsHistoryState.stack[settingsHistoryState.index] === path) return;
  const truncated = settingsHistoryState.stack.slice(0, settingsHistoryState.index + 1);
  settingsHistoryState = { stack: [...truncated, path], index: truncated.length };
  notifySettingsHistory();
}

function useSettingsHistory() {
  return useSyncExternalStore(
    (listener) => {
      settingsHistoryListeners.add(listener);
      return () => settingsHistoryListeners.delete(listener);
    },
    () => settingsHistoryState
  );
}

type SettingsSidebarNavProps = {
  section: SettingsSection;
  /** Uses the compact navigation language of the redesign application shell. */
  variant?: "default" | "redesign";
};

export function SettingsSidebarNav({ section, variant = "default" }: SettingsSidebarNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isSignedIn = useIsSignedIn();
  const isMac = useIsMac();
  const displayName = useUserDisplayName();
  const settingsHistory = useSettingsHistory();
  // Account/Help dropdown triggers -- same refocus-blur fix sidebar-nav.tsx's
  // own identical footer row uses on each (that row's own comment has the
  // full Radix-refocus reasoning).
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);

  // Settings navigation is an isolated history session. Clear the module
  // stack when this sidebar leaves the settings route so its arrows can
  // never walk back into the page that opened Settings.
  useEffect(() => {
    settingsHistoryState = { stack: [], index: -1 };
    notifySettingsHistory();
    return () => {
      settingsHistoryState = { stack: [], index: -1 };
      notifySettingsHistory();
    };
  }, []);

  // pathname + search, not pathname alone -- confirmed directly as a real
  // bug ("the < to return to the providers is not working"): opening a
  // provider's connection view is a `?provider=<name>` query-string change
  // now (ProvidersSection's own comment on that), and `location.pathname`
  // never changes for those, so this effect never saw them as new
  // "pages" to push. Every location change pushes (or no-ops, for a
  // change this component's own back/forward buttons caused, or the very
  // first path of a fresh stack -- pushSettingsHistory's own comment above
  // covers both).
  useEffect(() => {
    const path = location.pathname + location.search;
    if (path.startsWith("/settings")) pushSettingsHistory(path);
  }, [location.pathname, location.search]);

  function goBackInSettings() {
    if (settingsHistory.index <= 0) return;
    const target = settingsHistory.stack[settingsHistory.index - 1];
    if (!target.startsWith("/settings")) return;
    settingsHistoryState = { ...settingsHistoryState, index: settingsHistoryState.index - 1 };
    notifySettingsHistory();
    navigate(target, { replace: true });
  }

  function goForwardInSettings() {
    if (settingsHistory.index >= settingsHistory.stack.length - 1) return;
    const target = settingsHistory.stack[settingsHistory.index + 1];
    if (!target.startsWith("/settings")) return;
    settingsHistoryState = { ...settingsHistoryState, index: settingsHistoryState.index + 1 };
    notifySettingsHistory();
    navigate(target, { replace: true });
  }

  const [query, setQuery] = useState("");
  const results = useMemo(() => rankSettingsSearch(query).filter((entry) => isSignedIn || entry.section !== "profile"), [isSignedIn, query]);
  const searching = query.trim().length > 0;
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+F -- per explicit request ("the search settings should have
  // the same command command F to search"), matching the real sidebar's
  // own SidebarSearch shortcut exactly (sidebar-nav.tsx, "F" for "Find").
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "f" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function goToResult(entry: SettingsSearchEntry) {
    setQuery("");
    const target = entry.target ? `?target=${entry.target}` : "";
    // replace: true -- see the section-row onClick's own comment below for
    // the full reasoning (same fix, same cause).
    navigate(`/settings/${entry.section}${target}`, { replace: true });
  }

  if (variant === "redesign") {
    return (
      <aside
        aria-label={t("settings.nav.ariaLabel")}
        className="relative -mx-[var(--redesign-sidebar-edge-padding)] flex h-full w-[calc(100%+2*var(--redesign-sidebar-edge-padding))] min-w-0 flex-col overflow-hidden bg-[var(--redesign-sidebar-surface)] px-[var(--redesign-sidebar-edge-padding)]"
      >
        <div className="flex min-h-0 flex-col">
          {/* Keeps Settings search in the same control rhythm as Quick Actions. */}
          {/* Focused, the ⌘F hint and the placeholder fade out, leaving just what's typed. */}
          <div className="group/settings-search relative mb-[var(--redesign-quick-actions-gap)] h-[var(--redesign-quick-actions-trigger-height)] w-full">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-[var(--redesign-quick-actions-padding)] z-10 flex -translate-y-1/2 items-center gap-[var(--redesign-quick-actions-shortcut-gap)] text-chat text-muted-foreground transition-opacity duration-160 group-focus-within/settings-search:opacity-0"
            >
              <Command strokeWidth={2} className="size-[var(--redesign-quick-actions-command-icon-size)]" />
              <span>F</span>
            </span>
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                } else if (event.key === "Enter" && results.length > 0) {
                  goToResult(results[0]);
                }
              }}
              placeholder={t("settings.search.placeholder")}
              className="h-full rounded-[var(--redesign-control-radius)] border-[var(--redesign-sidebar-border)] bg-transparent pr-[var(--redesign-quick-actions-padding)] pl-[calc(var(--redesign-quick-actions-padding)+var(--redesign-quick-actions-command-icon-size)+var(--redesign-quick-actions-shortcut-gap)+0.5rem+var(--redesign-quick-actions-icon-gap))] text-chat font-normal text-foreground hover:bg-muted/50 transition-[border-color,background-color] duration-160 placeholder:text-transparent focus:pl-[var(--redesign-quick-actions-padding)] focus-visible:border-focus-accent md:text-chat"
            />
            {/* The placeholder, drawn in place so it fades out where it is (with the ⌘F hint) while
                typed text starts at the left straight away. */}
            {!query && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-[calc(var(--redesign-quick-actions-padding)+var(--redesign-quick-actions-command-icon-size)+var(--redesign-quick-actions-shortcut-gap)+0.5rem+var(--redesign-quick-actions-icon-gap))] -translate-y-1/2 truncate text-chat text-muted-foreground transition-opacity duration-160 ease-in-out group-focus-within/settings-search:opacity-0 motion-reduce:transition-none"
              >
                {t("settings.search.placeholder")}
              </span>
            )}
          </div>

          {searching ? (
            <div className="flex flex-col gap-[var(--redesign-quick-actions-row-gap)]">
              {results.length === 0 && (
                <p className="px-[var(--redesign-quick-actions-padding)] py-2 text-chat font-normal text-muted-foreground">
                  {t("settings.search.noResults", { query })}
                </p>
              )}
              {results.map((entry) => {
                const s = SECTIONS.find((sec) => sec.key === entry.section)!;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => goToResult(entry)}
                    className="flex min-h-[var(--redesign-quick-actions-row-height)] flex-col items-start justify-center rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] py-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center gap-[var(--redesign-quick-actions-icon-gap)] text-chat font-medium text-muted-foreground">
                      {s.icon}
                      {t(s.labelKey)}
                    </span>
                    <span className="pl-[calc(var(--redesign-quick-actions-icon-size)+var(--redesign-quick-actions-icon-gap))] text-chat text-foreground">
                      {entry.title}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--redesign-sidebar-section-gap)]">
              {SETTINGS_NAV_GROUPS.map((group) => (
                <section key={group.labelKey} aria-labelledby={`settings-sidebar-group-${group.labelKey}`}>
                  <div className="flex h-[var(--redesign-quick-actions-row-height)] items-center px-[var(--redesign-quick-actions-padding)]">
                    <h2
                      id={`settings-sidebar-group-${group.labelKey}`}
                      className="text-ui-xs font-medium text-muted-foreground"
                    >
                      {t(group.labelKey)}
                    </h2>
                  </div>
                  <div className="mt-[var(--redesign-sidebar-section-row-offset)] flex flex-col gap-[var(--redesign-quick-actions-row-gap)]">
                    {group.keys.filter((key) => isSignedIn || key !== "profile").map((key) => {
                      const s = SECTIONS.find((sec) => sec.key === key)!;
                      const isActive = section === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => navigate(`/settings/${key}`, { replace: true })}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex h-[var(--redesign-quick-actions-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left text-chat font-normal text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isActive && "bg-muted font-medium text-foreground",
                          )}
                        >
                          <span className="flex size-[var(--redesign-quick-actions-icon-size)] shrink-0 items-center justify-center">
                            {s.icon}
                          </span>
                          <span className="truncate">{t(s.labelKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="mt-auto pt-[var(--redesign-sidebar-section-gap)]">
          <div className="-mx-[var(--redesign-sidebar-edge-padding)] border-t border-[var(--redesign-sidebar-border)] px-[var(--redesign-sidebar-edge-padding)] pt-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex h-[var(--redesign-sidebar-footer-account-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-chat font-normal text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowCircleBrokenLeftIcon aria-hidden="true" className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />
              <span className="truncate">{t("shell.returnToChats")}</span>
            </button>
          </div>
        </footer>
      </aside>
    );
  }

  return (
    // Same outer shape as the real <aside> it replaces (sidebar-nav.tsx) --
    // bg-sidebar/border-r, same SIDEBAR_WIDTH -- so the app shell doesn't
    // visibly jump width when AppLayout.tsx's own conditional render swaps
    // one for the other. Fixed width now, no collapse toggle -- per
    // explicit request ("at the top of the search bar instead of collapse
    // sidebar and <> add Return to app"), reversing the earlier collapse/
    // back-forward toggle row for a single dedicated row instead.
    <aside
      aria-label={t("settings.nav.ariaLabel")}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar"
      style={{ width: "var(--redesign-sidebar-width)" }}
    >
      <div className="flex min-h-0 shrink-0 flex-col pt-2" style={{ width: "var(--redesign-sidebar-width)" }}>
        {/* Same top-row shape as the real sidebar's own collapse-toggle +
            back/forward row (sidebar-nav.tsx) -- pt-2 wrapper + a 32px row
            containing the same 62px macOS traffic-light reserve -- per
            explicit request ("I want return to app to be where the
            collapse icon and <> are... so that the search bar in
            settings and home sidebar are at the same location"): "Return
            to app" sits in that same row/position now instead of being
            pushed below it, which is what actually lines Search up
            between the two sidebars (both now reach it via the exact
            same pt-2 + 32px-row path), not just clearing the traffic
            lights in isolation. */}
        <div className="h-[32px]">
        <div className="mx-2 flex h-6 shrink-0 items-center overflow-hidden" style={{ width: "calc(var(--redesign-sidebar-width) - 16px)" }}>
          {/* Reserved space for macOS's own native traffic-light buttons --
              see sidebar-nav.tsx's own identical span for the full
              reasoning. */}
          <span className="block h-full w-[62px] shrink-0" aria-hidden />
          {/* Back/forward chevrons, not the "Return to app"/"Return to
              Settings" text button this used to be -- per explicit request
              ("add <> instead of return to app/return to settings"),
              matching the main sidebar's own back/forward pair
              (sidebar-nav.tsx) exactly (same size-5/rounded-[6px]/gap-0.5
              treatment) now that this row sits at the same position as
              that one. Getting back to the app itself is the new
              "Application" row's job now, at the bottom of this sidebar
              (this component's own comment on that has the full
              reasoning) -- per explicit request ("that should... supersed
              the Home that we have beside <>"), replacing the Home button
              that used to sit right here. Driven by settingsHistory
              (this component's own stack above), not navigate(-1)/(1) --
              confirmed directly as broken ("its not returning to previous
              pages that i visited in settings and its also showing > as
              available even though i have not visited and return from a
              new page"): the router can't report whether real back/forward
              history actually exists, so navigate(1) always looked
              clickable regardless, and every settings section switch uses
              `replace: true` (on purpose, so a plain section page's own
              back button couldn't step out of Settings a page at a time),
              which also means the router's own history has no
              settings-to-settings entries for navigate(-1)/(1) to walk in
              the first place. */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={goBackInSettings}
              disabled={settingsHistory.index <= 0}
              aria-label={t("nav.goBack.ariaLabel")}
              className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-hover-2/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeftIcon className="size-[14px]" />
            </button>
            <button
              type="button"
              onClick={goForwardInSettings}
              disabled={settingsHistory.index >= settingsHistory.stack.length - 1}
              aria-label={t("nav.goForward.ariaLabel")}
              className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-hover-2/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRightIcon className="size-[14px]" />
            </button>
          </div>
        </div>
        </div>
        {/* Search -- per explicit request ("Also build search + reset-to-
            default + density", "make sure that the search bar on the
            setting page match the location of the main page"): same mx-2/
            h-7/w-[204px] position the real sidebar's own SidebarSearch
            sits at (that component's own row, sidebar-nav.tsx). Typing
            swaps the section list below for ranked results. Style now
            matches that same row exactly (icon size/position/color,
            border, input text color, placeholder, radius) -- per explicit
            follow-up request ("update the settings sidebar style to be
            exactly like the sidebar at home page including the colors"),
            plus the visible "⌘F"/"Ctrl+F" hint chip that row has and this
            one was missing (the Cmd/Ctrl+F shortcut itself already worked
            here, from the earlier request above -- just never rendered a
            visible hint for it). */}
        <div className="relative mx-2 mb-2 h-7" style={{ width: "calc(var(--redesign-sidebar-width) - 16px)" }}>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-[9px] size-[14px] -translate-y-1/2 text-foreground select-none" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
              } else if (event.key === "Enter" && results.length > 0) {
                goToResult(results[0]);
              }
            }}
            placeholder={t("settings.search.placeholder")}
            className="h-7 rounded-[var(--row-radius-sm)] border border-border bg-transparent pl-[30px] text-xs font-normal text-foreground placeholder:text-foreground placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-160 focus:placeholder:opacity-0 focus-visible:border-focus-accent md:text-xs"
          />
          {!query && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-1 flex -translate-y-1/2 items-center rounded-[4px]"
            >
              <Kbd className="h-5 min-w-0 gap-0 rounded-[4px] border-none bg-transparent px-1 text-2xs leading-none font-normal text-foreground">
                {isMac ? "⌘F" : "Ctrl+F"}
              </Kbd>
            </span>
          )}
        </div>
        {/* RailButton/GlideGroup, not a second hand-approximated row shape
            -- per explicit request ("the sidebar at settings needs to
            match our sidebar row sizes items and gaps and text and icon
            spacing"), reusing the exact same row component/hover system
            the real sidebar's own Projects/Chats rows use (both exported
            from sidebar-nav.tsx for this). */}
        {searching ? (
          // Search results -- two stacked rows per match, mirroring
          // Synara's own "section row, then indented matched-setting row"
          // pattern. Not RailButton here -- these aren't section rows
          // themselves, just ranked matches, same reasoning the sidebar's
          // own SidebarSearch results dropdown already has for its own
          // custom row shape.
          <div className="mx-2 flex flex-col gap-0.5">
            {results.length === 0 && (
              <p className="px-2 py-2 text-ui-xs font-normal text-muted-foreground">{t("settings.search.noResults", { query })}</p>
            )}
            {results.map((entry) => {
              const s = SECTIONS.find((sec) => sec.key === entry.section)!;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => goToResult(entry)}
                  className="flex flex-col items-start rounded-[8px] px-2 py-1 text-left transition-colors hover:bg-hover-2/50"
                >
                  <span className="flex items-center gap-1.5 text-ui-2xs font-normal text-muted-foreground">
                    {s.icon}
                    {t(s.labelKey)}
                  </span>
                  <span className="pl-[22px] text-ui-sm text-foreground">{entry.title}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <GlideGroup>
            {SETTINGS_NAV_GROUPS.map((group) => (
              <div key={group.labelKey} className="flex flex-col not-first:mt-3">
                {/* Group describer -- per explicit request ("we need to add
                    section describers like synara does"), same "Projects"/
                    "Chats" label treatment the real sidebar uses
                    (sidebar-nav.tsx) literal-for-literal. */}
                <div className="mx-2 mt-1 mb-0.5 flex h-5 items-center px-2 text-xs font-normal text-foreground select-none">
                  <span className="opacity-50">{t(group.labelKey)}</span>
                </div>
                {group.keys.filter((key) => isSignedIn || key !== "profile").map((key) => {
                  const s = SECTIONS.find((sec) => sec.key === key)!;
                  return (
                    <RailButton
                      key={key}
                      icon={s.icon}
                      label={t(s.labelKey)}
                      active={section === key}
                      // replace: true -- confirmed directly as a real bug
                      // ("Return to app is returning to the previous page
                      // after clicking through pages on the settings page
                      // and not bringing us back to main page"): every
                      // section switch was pushing a new history entry, so
                      // "Return to app" (navigate(-1) below) only ever
                      // walked back one settings section at a time instead
                      // of leaving settings entirely. Replacing keeps the
                      // single history entry from *entering* settings as
                      // the only one, so navigate(-1) always lands back on
                      // whatever page Settings was actually opened from,
                      // no matter how many sections were browsed first.
                      onClick={() => navigate(`/settings/${key}`, { replace: true })}
                    />
                  );
                })}
              </div>
            ))}
          </GlideGroup>
        )}
      </div>
      {/* Application + account/Help footer -- per explicit request ("for
          the settings sidebar, add our username and help button at the
          bottom and also the settings button but instead of the settings
          button, that should be the Alongside icon that with Application
          to return to home and supersed the Home that we have beside
          <>"): mirrors sidebar-nav.tsx's own bottom footer row
          (Settings row above an avatar+username/Help row) literal for
          literal, with two swaps -- "Application" (AlongsideLogo icon,
          navigates home) stands in for "Settings" (redundant here, since
          this sidebar already *is* Settings), and this replaces the old
          Home button that used to sit beside the <> above, not
          duplicating it. mt-auto on this wrapper (the outer <aside> is
          itself flex-col) pins it to the bottom regardless of how tall
          the nav list above happens to be, since that list's own
          wrapper is shrink-0, not flex-1. */}
      {/* pb-2 matches the parent sidebar's own py-2 footer inset, so the
          Alongside return row sits on the same bottom baseline as the
          parent settings trigger. */}
      <div className="mt-auto shrink-0 pb-2">
        <GlideGroup>
          <RailButton
            // size-[13px], not the row's usual 14px, and no hardcoded
            // text-black/dark:white -- per direct bug report ("alongside
            // icon at Application does not match the color of the
            // Application text and needs to be reduced to match the size
            // of the cog wheel icon in the home page"). The hardcoded
            // color fought RailButton's own icon-color span (currentColor,
            // text-muted-foreground/text-foreground below), so it never
            // matched the label; 13px is the same optical-match size
            // WELCOME_ITEM's own AlongsideLogo already uses against the
            // sidebar's usual 14px row icons (that constant's own comment
            // has the full reasoning -- this glyph's petals run edge to
            // edge in its viewBox with no internal margin, so 14px reads
            // visibly heavier than every other row icon at the same box).
            icon={<AlongsideLogo className="size-[13px]" />}
            label={t("settings.returnToAlongside")}
              onClick={() => navigate("/")}
          />
        </GlideGroup>
        {false && (
        <div className="mx-2 mt-1 flex h-7 shrink-0 items-center gap-1 overflow-hidden rounded-[var(--row-radius)]" style={{ width: "calc(var(--redesign-sidebar-width) - 16px)" }}>
          <BaseDropdownMenu
            size="compact"
            onOpenChange={(nowOpen) => {
              if (nowOpen) return;
              const button = accountTriggerRef.current;
              if (!button) return;
              const reblur = () => button.blur();
              button.addEventListener("focus", reblur, { once: true });
              setTimeout(() => button.removeEventListener("focus", reblur), 1000);
            }}
          >
            <BaseDropdownTrigger
              render={
                <button
                  ref={accountTriggerRef}
                  type="button"
                  aria-label={t("nav.account.ariaLabel")}
                  className="flex h-7 flex-1 min-w-0 shrink-0 transform-gpu items-center gap-2 rounded-[var(--row-radius)] px-1.5 text-left transition-[background-color] duration-160 hover:bg-hover-2/50"
                >
                  {/* DefaultAvatar (ui/avatar.tsx), not a hand-rolled flat
                      black/white badge -- same fix as sidebar-nav.tsx's own
                      matching badge, per the real bug confirmed directly
                      ("the avatar profile is using a different one at chat
                      and at sidebar"): both now render the exact same
                      component instead of two independently drifting
                      look-alikes. */}
                  <span className="size-5 shrink-0 overflow-hidden rounded-full">
                    <DefaultAvatar name={displayName} />
                  </span>
                  {/* AnimatePresence/motion.span -- same crossfade fix as
                      sidebar-nav.tsx's own identical footer row (that row's
                      own comment has the full bug report: the name used to
                      outlive signOut(), showing the just-logged-out
                      account's name instead of fading to Guest). */}
                  {/* text-foreground, not text-muted-foreground -- same
                      fix as sidebar-nav.tsx's own identical footer row
                      (that row's own comment has the full reasoning). */}
                  <span className="min-w-0 flex-1 truncate text-xs leading-none font-normal text-foreground">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={displayName}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="block truncate"
                      >
                        {displayName}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </button>
              }
            />
            {/* w-72, not w-40 -- same reasoning as sidebar-nav.tsx's own
                identical avatar dropdown (that one's own comment has the
                full explanation). */}
            <BaseDropdownContent side="top" align="start" sideOffset={8} className="w-72 min-w-0 rounded-3xl font-normal">
              <AccountMenuItems />
            </BaseDropdownContent>
          </BaseDropdownMenu>
          <BaseDropdownMenu
            size="compact"
            onOpenChange={(nowOpen) => {
              if (nowOpen) return;
              const button = helpTriggerRef.current;
              if (!button) return;
              const reblur = () => button.blur();
              button.addEventListener("focus", reblur, { once: true });
              setTimeout(() => button.removeEventListener("focus", reblur), 1000);
            }}
          >
            <BaseDropdownTrigger
              render={
                <button
                  ref={helpTriggerRef}
                  type="button"
                  aria-label={t("nav.help.ariaLabel")}
                  // text-foreground -- same fix as sidebar-nav.tsx's own
                  // identical Help trigger (that one's own comment has the
                  // full reasoning).
                  className="flex h-7 w-7 shrink-0 transform-gpu items-center justify-center rounded-[var(--row-radius)] text-foreground transition-colors duration-160 hover:text-ink data-[popup-open]:text-ink"
                >
                  {/* Default strokeWidth -- same fix as sidebar-nav.tsx's
                      own identical Help trigger (that one's own comment
                      has the full reasoning). */}
                  <HelpCircleIcon className="size-[14px]" />
                </button>
              }
            />
            <BaseDropdownContent side="top" align="start" sideOffset={8} className="w-40 min-w-0 rounded-3xl font-normal">
              <HelpMenuItems />
            </BaseDropdownContent>
          </BaseDropdownMenu>
        </div>
        )}
      </div>
    </aside>
  );
}

type ArchivedSnapshot = {
  workspaces: { id: string; name: string; logo?: string | null; color?: number | null }[];
  projects: { id: string; name: string; workspace_id: string | null; archive_scope: string; individually_archived: boolean }[];
  chats: { id: string; name: string; project_id: string | null; workspace_id: string | null; individually_archived: boolean }[];
};

// Solid red, for permanent deletes: the accent button (shell-dialog.tsx's ShellDialogActions does the same) on the destructive colour.
const DESTRUCTIVE_BUTTON = "text-white [--send-button-bg-active:color-mix(in_oklab,var(--destructive),black_25%)] [--send-button-bg-hover:color-mix(in_oklab,var(--destructive),black_12%)] [--send-button-bg:var(--destructive)]";

type ArchivedEntity = { kind: "workspace" | "project" | "chat"; id: string; name: string };

// One kind per page (Settings > Archived > Workspaces, Projects or Chats). A project or chat
// whose workspace (or project) is itself archived is listed with that, not here.
function ArchivedSection({ kind }: { kind: ArchivedEntity["kind"] }) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<ArchivedSnapshot>({ workspaces: [], projects: [], chats: [] });
  const [pendingDelete, setPendingDelete] = useState<ArchivedEntity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetch("/archived")
      .then((response) => response.ok ? response.json() as Promise<ArchivedSnapshot> : Promise.reject())
      .then(setSnapshot)
      .catch(() => setSnapshot({ workspaces: [], projects: [], chats: [] }));
  }, []);
  useEffect(load, [load]);

  const workspaceIds = new Set(snapshot.workspaces.map((item) => item.id));
  const rootProjects = snapshot.projects.filter((item) => item.individually_archived && (!item.workspace_id || !workspaceIds.has(item.workspace_id)));
  const subtreeProjectIds = new Set(snapshot.projects.filter((item) => item.archive_scope === "subtree").map((item) => item.id));
  const rootChats = snapshot.chats.filter((item) => item.individually_archived
    && (!item.workspace_id || !workspaceIds.has(item.workspace_id))
    && (!item.project_id || !subtreeProjectIds.has(item.project_id)));

  async function mutate(entity: ArchivedEntity, action: "restore" | "delete") {
    setBusy(`${entity.kind}:${entity.id}`);
    const plural = entity.kind === "workspace" ? "workspaces" : entity.kind === "project" ? "projects" : "sessions";
    const suffix = action === "restore" ? "/restore" : "";
    const base = entity.kind === "chat" && action === "delete" ? "/archived/sessions" : `/${plural}`;
    const response = await fetch(`${base}/${encodeURIComponent(entity.id)}${suffix}`, { method: action === "restore" ? "POST" : "DELETE" }).catch(() => null);
    setBusy(null);
    if (!response?.ok) return;
    setPendingDelete(null);
    load();
  }

  const rows: ArchivedEntity[] =
    kind === "workspace" ? snapshot.workspaces.map((item) => ({ id: item.id, name: item.name, kind }))
    : kind === "project" ? rootProjects.map((item) => ({ id: item.id, name: item.name, kind }))
    : rootChats.map((item) => ({ id: item.id, name: item.name, kind }));

  return (
    <div className="mt-4 flex flex-col gap-2">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-ui text-muted-foreground">{t(`archive.empty.${kind}`)}</div>
      ) : rows.map((entity) => {
        const childProjects = entity.kind === "workspace" ? snapshot.projects.filter((item) => item.workspace_id === entity.id).length : 0;
        const childChats = entity.kind === "workspace"
          ? snapshot.chats.filter((item) => item.workspace_id === entity.id).length
          : entity.kind === "project" ? snapshot.chats.filter((item) => item.project_id === entity.id).length : 0;
        const Icon = entity.kind === "project" ? FolderIcon : BubbleChatIcon;
        // A workspace shows its own tile: its logo, or its letter on its colour.
        const workspace = entity.kind === "workspace" ? snapshot.workspaces.find((item) => item.id === entity.id) : undefined;
        const monogram = workspace && !workspace.logo ? workspaceMonogram(workspace.name, workspace.color ?? null) : null;
        return (
          <div key={`${entity.kind}:${entity.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
            {workspace ? (
              workspace.logo ? <WorkspaceBrandIcon size={32} imageSrc={workspace.logo} /> : monogram ? <WorkspaceBrandIcon size={32} monogram={monogram} /> : null
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background"><Icon className="size-4" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui font-medium text-foreground">{entity.name}</p>
              <p className="text-ui-sm text-muted-foreground">{t(`archive.kind.${entity.kind}`)}{childProjects || childChats ? ` · ${t("archive.contents", { projects: childProjects, chats: childChats })}` : ""}</p>
            </div>
            <Button size="compact" variant="tertiary" leadingIcon={RotateCcw} onClick={() => void mutate(entity, "restore")} disabled={busy !== null}>{t("archive.restore")}</Button>
            <Button size="compact" variant="accent" leadingIcon={Trash2} className={DESTRUCTIVE_BUTTON} onClick={() => setPendingDelete(entity)} disabled={busy !== null}>{t("archive.deletePermanently")}</Button>
          </div>
        );
      })}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archive.delete.title")}</DialogTitle>
            <DialogDescription>{t("archive.delete.description", { name: pendingDelete?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="tertiary" onClick={() => setPendingDelete(null)}>{t("common.cancel")}</Button>
            <Button variant="accent" className={DESTRUCTIVE_BUTTON} onClick={() => pendingDelete && void mutate(pendingDelete, "delete")} disabled={busy !== null}>{t("archive.deletePermanently")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main content pane -- SettingsPage.tsx's own real content, reading the
// active section straight off the URL (/settings/:section) rather than a
// prop threaded down from a modal's own open/section state.
export function SettingsSectionContent({ section }: { section: SettingsSection }) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  // Deep-link scroll -- a search result (SettingsSidebarNav's own
  // goToResult) navigates here with ?target=setting-<id> attached; once
  // this section's own rows exist in the DOM, scroll to and briefly
  // highlight the matching one. Same plain-DOM-write flash as the row
  // itself needs, not React state (this file's own earlier reasoning on
  // that still applies here).
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("target");
    if (!target) return;
    const id = requestAnimationFrame(() => {
      const el = contentRef.current?.querySelector<HTMLElement>(`#${target}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "background-color 300ms ease-out";
      el.style.backgroundColor = "var(--accent)";
      setTimeout(() => {
        el.style.backgroundColor = "";
      }, 1000);
    });
    return () => cancelAnimationFrame(id);
  }, [section]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {/* Heading now scrolls with the rest of the page instead of staying
          pinned above it -- per explicit request ("the entire page like
          general should move including the headings", clarified as
          "when scrolling up and down"): it used to live in its own div
          outside the scrollable container below, which made it act like a
          fixed top bar while only the content under it scrolled. */}
      <ScrollArea className="min-h-0 flex-1" viewportRef={contentRef} viewportClassName="px-6 py-5">
        {/* PageContent (page-content.tsx), not a bare div -- per explicit
            request ("we need to use the content component as well to keep
            items at 800px like synara does"): same 800px-capped, centered
            column every other page (Home, Chat, Docs...) already uses,
            instead of this one running its own full-width layout.
            maxWidth="var(--chat-max-width)" -- per explicit request
            ("when we selecting expanded that should expand the settings
            content as well so we can see the difference being applied
            before going to homepage"): Appearance's own Chat width row
            sets this CSS variable (use-appearance-settings.ts's own
            applyChatWidth), which Home/Chat's compose wrappers already
            read -- without also reading it here, choosing Expanded had no
            visible effect until leaving Settings to check Home or a chat. */}
        {/* No border-b any more -- per explicit request ("There is a line
            divider under the heading and subheading of each page on
            settings, remove that"). */}
        <PageContent maxWidth="var(--chat-max-width)">
          {/* Profile and Skills draw their own header (Skills has actions beside it). */}
          {section !== "profile" && section !== "skills" && (
            <>
              <h2 className="text-ui-xl font-semibold text-foreground">
                {(() => {
                  const entry = SECTIONS.find((s) => s.key === section);
                  const key = entry?.titleKey ?? entry?.labelKey;
                  return key ? t(key) : null;
                })()}
              </h2>
              <p className="mt-0.5 text-ui font-normal text-muted-foreground">{t(SECTION_SUBTITLE_KEY[section])}</p>
            </>
          )}
        </PageContent>
        <PageContent maxWidth="var(--chat-max-width)">
          {section === "profile" && <ProfileSection />}
          {section === "general" && <GeneralSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "chat" && <ChatSection />}
          {section === "provider" && <ProvidersSection />}
          {section === "apps" && <AppsSection />}
          {section === "skills" && <SkillsSection />}
          {section === "archived-workspaces" && <ArchivedSection kind="workspace" />}
          {section === "archived-projects" && <ArchivedSection kind="project" />}
          {section === "archived-chats" && <ArchivedSection kind="chat" />}
        </PageContent>
      </ScrollArea>
    </div>
  );
}
