import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { IconComponent } from "@/lib/icon-context";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useGettingStarted } from "@/hooks/use-getting-started";
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
import { spring } from "@/lib/springs";
import { modelDisplayName, PROVIDER_DISPLAY, ProviderIcon, QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";
import { effortLabel, EFFORT_LEVELS, loadDefaultEffort, saveDefaultEffort, type EffortLevel } from "@/lib/effort";
import { LANGUAGE_OPTIONS, loadLanguage, saveLanguage, uiLocaleFor, type LanguageValue } from "@/lib/language";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { loadNotifyTurnComplete, requestNotificationPermission, saveNotifyTurnComplete } from "@/lib/notify-turn-complete";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BubbleChatIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsInwardHorizontalIcon,
  DownloadIcon,
  ExpandedWidthIcon,
  HelpCircleIcon,
  IntegrationsIcon,
  LogOutIcon,
  MoonIcon,
  PaletteIcon,
  ProvidersIcon,
  ProviderUsageIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  SystemIcon,
  UserIcon,
} from "@/components/icons/untitled-ui";
import { GlideGroup, RailButton, SIDEBAR_WIDTH, SIDEBAR_ROW_WIDTH } from "@/components/sidebar-nav";
import { AccountMenuItems, HelpMenuItems } from "@/components/nav-user";
import {
  clearUserAvatarImage,
  getUserDisplayName,
  setUserAvatarImage,
  useUserAvatarImage,
  useUserDisplayName,
} from "@/lib/user";
import { signOut, useIsSignedIn } from "@/lib/auth";
import { useIdentity } from "@/lib/identity";

// Tips/Notifications/Usage are sub-sections *inside* General, not their
// own routes -- per explicit request ("Not as items but as menu items
// like synara's style"), matching Synara's own General page (several
// labeled sub-sections stacked on one page, not a separate nav entry per
// sub-section). Story: Settings "Application" section
// (alongsidedotrun/private#207). Appearance moved out to its own
// top-level section (AppearanceSection, below) -- per explicit request
// ("we should get an appearance menu at the sidebar as well as palette
// icon and move from general") -- no longer one of these sub-sections.
// #209 (an "Account" section with a Behaviors page for chat defaults, and
// the old Danger zone) was closed as superseded, not picked up -- Chat
// stays its own separate top-level section instead, and Danger zone was
// removed entirely rather than folded into a new section (SETTINGS_NAV_GROUPS'
// own comment below has the full reasoning).
export type SettingsSection = "profile" | "general" | "appearance" | "chat" | "provider" | "apps";

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
const SETTINGS_ACTION_BUTTON_CLASS = `flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-40 ${SETTINGS_CONTROL_RADIUS}`;

// Shared by every dropdown trigger in a settings row (Theme, Chat width)
// -- per explicit request ("the dropdown of theme and chat width should
// be the same width even though chat width has no icon"): a fixed width
// and justify-between (icon+label left, chevron right) instead of each
// trigger sizing to its own label's length, so the two line up instead of
// one being visibly narrower.
const SETTINGS_DROPDOWN_TRIGGER_BASE = `flex items-center justify-between gap-1.5 border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-muted/30 ${SETTINGS_CONTROL_RADIUS}`;
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
        <h3 className="text-[12px] font-normal text-muted-foreground/60">{title}</h3>
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
        <label className="text-[12px] font-medium text-foreground">{title}</label>
        {description && <p className="mt-0.5 text-[12px] font-normal text-muted-foreground">{description}</p>}
        {status && <p className="pt-1 text-[11px] font-normal text-muted-foreground"><ErrorText message={status} /></p>}
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
const SECTIONS: { key: SettingsSection; label: string; labelKey: string; icon: ReactNode }[] = [
  { key: "profile", label: "Profile", labelKey: "settings.nav.profile", icon: <UserIcon className="size-[14px]" /> },
  { key: "general", label: "General", labelKey: "settings.nav.general", icon: <SettingsIcon className="size-[14px]" /> },
  { key: "appearance", label: "Appearance", labelKey: "settings.nav.appearance", icon: <PaletteIcon className="size-[14px]" /> },
  { key: "chat", label: "Chat", labelKey: "settings.nav.chat", icon: <BubbleChatIcon className="size-[14px]" /> },
  { key: "provider", label: "Provider", labelKey: "settings.nav.provider", icon: <ProvidersIcon className="size-[14px]" /> },
  // Its own top-level section now, not a drill-in under Provider -- per
  // explicit correction ("Still inside providers its meant to be settings
  // > apps and not settings > providers > apps").
  { key: "apps", label: "Apps", labelKey: "settings.nav.apps", icon: <IntegrationsIcon className="size-[14px]" /> },
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
  { labelKey: "settings.nav.group.connections", keys: ["provider", "apps"] },
];

const SECTION_SUBTITLE_KEY: Record<SettingsSection, string> = {
  profile: "settings.nav.subtitle.profile",
  general: "settings.nav.subtitle.general",
  appearance: "settings.nav.subtitle.appearance",
  chat: "settings.nav.subtitle.chat",
  provider: "settings.nav.subtitle.provider",
  apps: "settings.nav.subtitle.apps",
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
  { id: "getting-started", section: "general", title: "Getting started", keywords: "welcome onboarding hide show sidebar tips", target: "setting-getting-started" },
  { id: "default-provider", section: "chat", title: "Default provider", keywords: "model claude codex ai new chat", target: "setting-default-provider" },
  { id: "default-effort", section: "chat", title: "Default effort", keywords: "reasoning low medium high xhigh max", target: "setting-default-effort" },
  { id: "providers", section: "provider", title: "Provider", keywords: "api key connect claude codex mistral xai qwen kimi github gemini deepseek providers", target: null },
  { id: "apps", section: "apps", title: "Apps", keywords: "integrations github gmail google docs connect oauth mention", target: null },
  { id: "theme", section: "appearance", title: "Theme", keywords: "light dark system color mode appearance", target: "setting-theme" },
  { id: "transparency", section: "appearance", title: "Enable transparency", keywords: "blur vibrancy mac window appearance", target: "setting-transparency" },
  { id: "system-ui-font", section: "appearance", title: "Use system UI font", keywords: "font typography native system appearance", target: "setting-system-ui-font" },
  { id: "chat-width", section: "appearance", title: "Chat width", keywords: "standard expanded wide column appearance", target: "setting-chat-width" },
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
const PROVIDER_DOCS_URLS: Record<string, string> = {
  claude: "https://code.claude.com/docs",
  codex: "https://github.com/openai/codex",
  antigravity: "https://antigravity.google/docs",
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
  const [available, setAvailable] = useState<boolean | undefined>(cached?.available);
  const [installed, setInstalled] = useState<boolean | undefined>(cached?.installed);
  const [error, setError] = useState(false);

  const check = useCallback(() => {
    return fetch(`/cli/${encodeURIComponent(binary)}/available`)
      .then((res) => {
        if (!res.ok) throw new Error(`cli_available responded ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const isAvailable = Boolean(data.available);
        const isInstalled = Boolean(data.installed);
        availabilityCache.set(binary, { available: isAvailable, installed: isInstalled });
        persistAvailabilityCache();
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
    return () => {
      cancelled = true;
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
      ? "rounded-full px-2 py-0.5 text-[9px] font-medium bg-green-500/10 text-green-600 dark:text-green-400"
      : isError
        ? "text-xs font-normal text-muted-foreground"
        : "rounded-full px-2 py-0.5 text-[9px] font-medium bg-muted/50 text-muted-foreground";

  return (
    <span className={`shrink-0 transition-opacity duration-150 ${tone} ${visible ? "opacity-100" : "opacity-0"}`}>
      <ErrorText message={label} />
    </span>
  );
}

// Reached by clicking any provider row -- per explicit request, connected
// to check what connection is currently in use, not-connected to set one
// up, both landing on the same view. Account only now -- API Key
// connections are disabled and hidden (this component's own comment
// further down has the full reasoning).
function ProviderConnectionView({ provider }: { provider: Provider }) {
  const { t } = useTranslation();
  // Guessed, not looked up anywhere real -- per explicit request to check "all
  // providers", not just Claude/Codex (the two with a confirmed real binary name and
  // login-status check, backend/src/server.rs's own cli_available). This may report
  // unavailable for a provider that never had a CLI to begin with, not just one that's
  // missing its install -- there's no per-provider metadata yet to distinguish those.
  const cliBinary = provider.name.toLowerCase();
  const [cliMissing, setCliMissing] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  // Header badge below -- real, not the static QUICK_CHAT_MODELS `configured` any
  // more (useCliAvailability's own comment has the full reasoning). Reused by "Log
  // in" (below) too -- was a second, separate fetch on click before, which is what
  // let this go straight to "nothing happens" once the CLI *was* found (the only
  // branch that used to do anything was the missing-CLI dialog) -- there was no
  // feedback at all for the success case. Same availability value either way, so
  // there's nothing this second fetch could tell handleLogIn that useCliAvailability
  // doesn't already know.
  const { available, installed, error: cliCheckError, refetch: refetchAvailability } = useCliAvailability(cliBinary);

  // Set while polling for sign-in to complete after "Setup now" (below) -- distinct
  // from `loggingIn` (just the moment of spawning the login command itself, over in
  // a second or two either way).
  const [waitingForSignIn, setWaitingForSignIn] = useState(false);
  // Distinct from the header badge's own "Connected" -- that's "will this work at
  // all" (CLI present *and* signed in), this is "did clicking Log in specifically
  // just confirm that". A already-available CLI is reported as already logged in via
  // the personal account; one that's installed but not signed in opens the
  // missing-CLI dialog (its own title/copy now branch on `installed` -- see below --
  // since "not signed in" and "not installed at all" are different, differently
  // actionable problems, confirmed directly as confusing when both showed the same
  // "no PATH available" wording).
  const [loggedInMessage, setLoggedInMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogIn() {
    setLoggedInMessage(null);
    if (cliCheckError) {
      // Not the same dialog as a genuinely missing CLI -- confirmed directly (curl
      // straight to /cli/{bin}/available) that a "PATH not available" report here
      // was actually just this: the backend wasn't reachable at all (e.g. the web
      // app open with no Tauri/backend process running), not that the CLI was
      // really missing. Surfacing that distinction inline instead of the
      // missing-CLI dialog avoids telling the user to (re)install something that's
      // already installed.
      setLoggedInMessage(t("settings.providers.noConnection"));
    } else if (installed) {
      // Straight to the real login flow, no overlay -- per explicit request
      // ("when we click sign in we should do what the setup now does and
      // completely avoid this overlay screen"). The missing-CLI dialog
      // still has a real job for the OTHER case just below (genuinely not
      // installed, nothing to log into yet -- "Visit provider
      // documentation" is the only actionable step there).
      void handleSetupNow();
    } else {
      setCliMissing(true);
    }
  }

  // Replaces the old "Manage" click, which just re-stated "Already using
  // your personal X account" every time -- confirmed directly as unwanted
  // ("we should not spam" that message): a CLI-based personal-account
  // connection has no real "manage" surface beyond signing out, so this is
  // the one real action that button can actually take now.
  async function handleDisconnect() {
    setLoggedInMessage(null);
    setLoggingOut(true);
    try {
      const res = await fetch(`/cli/${encodeURIComponent(cliBinary)}/logout`, { method: "POST" });
      if (res.ok) {
        await refetchAvailability();
      } else {
        setLoggedInMessage(t("settings.providers.couldNotDisconnect"));
      }
    } catch {
      setLoggedInMessage(t("settings.providers.noConnection"));
    } finally {
      setLoggingOut(false);
    }
  }

  // "Setup now" (the missing-CLI dialog, below) -- was a pure no-op placeholder,
  // confirmed directly as a real gap when the CLI genuinely needed signing in and
  // clicking it did nothing. Real now: backend/src/server.rs's own cli_login route
  // spawns the provider's actual login command (`codex login`/`claude auth login`),
  // which opens the user's own default browser for them to complete. Only makes
  // sense once the binary is confirmed installed (`installed`) -- there's nothing to
  // log into if the CLI isn't even there, that case still routes to "Visit provider
  // documentation" instead (its own onClick below).
  //
  // Polls afterward instead of just closing the dialog -- confirmed directly as a
  // real gap: closing immediately after spawning login left the Connected badge
  // showing stale "Not connected" until the whole Providers view was closed and
  // reopened (useCliAvailability's own fetch only ever ran once, on mount), even
  // though sign-in had genuinely completed in the browser tab that opened. 2s
  // interval, 2 minutes max (60 attempts) -- long enough for a real OAuth flow
  // (email, password, 2FA) without polling forever if the user abandons it.
  async function handleSetupNow() {
    setLoggingIn(true);
    try {
      await fetch(`/cli/${encodeURIComponent(cliBinary)}/login`, { method: "POST" });
    } finally {
      setLoggingIn(false);
      setCliMissing(false);
    }
    setWaitingForSignIn(true);
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const isAvailable = await refetchAvailability();
      if (isAvailable) break;
    }
    setWaitingForSignIn(false);
  }

  return (
    <div>
      {/* Connected/Not connected badge, per explicit request -- icon stays left
          (unchanged), min-w-0 flex-1 on the name/description column absorbs the
          remaining space so the badge itself lands flush right, same "icon left,
          badge right" layout the provider grid's own cards already use. */}
      <div className="mt-4 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center">
          <ProviderIcon model={provider} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          {/* One shared size (13px) across name/caption/description/status
              now, differentiated by weight and color instead of size --
              per explicit request ("make these texts and icons consistent,
              maybe icon 24px and text size medium"): the previous 14/12/10
              mix (plus the icon's own 28px) read as an unintentional
              mismatch rather than a deliberate hierarchy. */}
          <div className="truncate text-[13px] font-medium text-foreground">
            {provider.displayName}
            {provider.displayCaption && (
              <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">{provider.displayCaption}</span>
            )}
          </div>
          <div className="truncate text-[13px] font-normal text-muted-foreground">{provider.description}</div>
        </div>
        <ConnectionBadge
          state={
            waitingForSignIn
              ? "waiting"
              : cliCheckError
                ? "error"
                : available === undefined
                  ? undefined
                  : available
                    ? "connected"
                    : installed
                      ? "not-signed-in"
                      : "not-installed"
          }
        />
      </div>

      {/* Account only -- API Key connections are removed entirely, per
          explicit decision: most people (including Team/Enterprise seats,
          which still authenticate through a personal OAuth login, not a
          shared key) use the Account path day to day, a real usage
          endpoint (Story #217) only exists for that path anyway (an API
          key is billed pay-per-token with no rate-limit window to show),
          and an unused-but-present feature is worse for a new team
          member reading this codebase than one that's genuinely gone --
          the backend side (secrets.rs, /secrets/*, /settings/secret-backend,
          the SecretStorageSection component) was deleted outright rather
          than kept dormant. If a real API-key feature is ever requested,
          that's new work built from scratch, not a tab re-added here. */}
      <div className="mt-5">
        <div className={`${SETTINGS_CARD_RADIUS} border border-border p-4`}>
          <p className="text-[12px] font-medium text-foreground">{t("settings.providers.useOwnAccount", { provider: provider.displayName })}</p>
          {/* Two variants, not one fixed sentence -- per explicit request
              ("needs to be consistent around all providers"): the same
              wording applies to every provider (no provider name in
              either sentence), but which one shows depends on whether
              there's actually a CLI to sign into yet (`installed`) --
              ALS-003 (nothing installed) genuinely needs a different next
              step (download it first) than ALS-004/already-connected
              (just sign in, or check on an existing sign-in). */}
          <p className="mt-1 text-[13px] font-normal text-muted-foreground">
            {installed ? t("settings.providers.reusesLoginInstalled") : t("settings.providers.reusesLoginNotInstalled")}
          </p>
          <Button
            variant="outline"
            className="mt-3 h-8 text-[11px]"
            onClick={available ? () => void handleDisconnect() : handleLogIn}
            // `available`/`installed` both survive a connectivity error
            // (useCliAvailability's check() only ever touches `error` in
            // its catch, never resets these) -- so they still reflect the
            // last real, persisted (availabilityCache/localStorage) answer
            // even while cliCheckError is true, which is what lets
            // "Disconnect"/"Set up" show up correctly instead of defaulting
            // to "Log in" for a provider whose real state is already known.
            // Disabled during a connectivity error outright -- per explicit
            // request, logging in isn't the fix for "can't reach Alongside".
            disabled={cliCheckError || available === undefined || loggingOut}
          >
            {available
              ? loggingOut
                ? t("settings.providers.disconnecting")
                : t("common.disconnect")
              : installed
                ? t("settings.providers.signIn")
                : t("settings.providers.setUp")}
          </Button>
          {loggedInMessage && (
            <p className="mt-2 text-[10px] font-normal text-green-600 dark:text-green-400"><ErrorText message={loggedInMessage} /></p>
          )}
        </div>
      </div>

      {/* installed vs not -- two different, differently-actionable problems
          (backend/src/server.rs's own cli_available comment), confirmed directly as
          confusing when both showed the same "no PATH available" copy: a binary
          that's genuinely installed but not signed in needs a login (Setup now, real
          now -- handleSetupNow's own comment above), not a reinstall. The built-in
          top-right X (DialogContent's own showCloseButton, default true) is the
          "skip it" affordance per explicit request -- dismissing doesn't sign
          anyone in, that's still only the real "Setup now" button above. */}
      <Dialog open={cliMissing} onOpenChange={setCliMissing}>
        <DialogContent>
          <DialogHeader>
            {/* Dynamic per-provider copy, not a generic "Not signed in yet"
                -- per explicit request/screenshot ("looks not professional...
                Sign in to {provider} is required... You are trying to use
                Gemini via Antigravity... and sign in is required."):
                provider.displayCaption already carries the real "via X"
                wrapper name (PROVIDER_DISPLAY, quick-chat-models.tsx --
                "via Antigravity" for Gemini, "via Claude Code" for Claude,
                "via Codex" for Codex), so this reads correctly for every
                provider without hardcoding one. */}
            <DialogTitle>
              {installed ? t("settings.providers.signInRequired", { provider: provider.displayName }) : t("settings.providers.notInstalledTitle")}
            </DialogTitle>
            <DialogDescription>
              <ErrorText
                message={
                  installed
                    ? t("settings.providers.tryingToUse", {
                        name: `${provider.displayName}${provider.displayCaption ? ` ${provider.displayCaption}` : ""}`,
                      })
                    : t("settings.providers.commandNotFound", { binary: cliBinary })
                }
              />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              // variant="secondary", not "outline" -- per explicit request
              // ("should be our typical button style and not this
              // transparent and black corner style"): outline's own
              // dark:bg-input/30 fill reads as nearly invisible against
              // this dialog's own dark surface, secondary is this app's
              // real filled secondary-action style used elsewhere.
              variant="secondary"
              className="h-8 text-[11px]"
              onClick={() => {
                const url = PROVIDER_DOCS_URLS[cliBinary];
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              {t("settings.providers.visitDocs")}
            </Button>
            {installed && (
              // type="button" -- per explicit request/bug report ("I
              // pressed setup now and we should have been brought to sign
              // in... as a new tab and not refresh our entire page"): a
              // native <button> with no explicit type defaults to
              // type="submit", which (if this dialog's portal ever renders
              // inside an ancestor <form>) submits and navigates the whole
              // page instead of just running onClick's own handler. The
              // actual sign-in tab itself is opened by the backend's own
              // spawned CLI login process (server.rs's own cli_login), not
              // by this button directly -- this only has to stop being a
              // stray form submit.
              <Button type="button" onClick={handleSetupNow} disabled={loggingIn} className="h-8 text-[11px]">
                {loggingIn ? t("settings.providers.opening") : t("settings.providers.setupNow")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
function ProviderCard({ provider, onClick }: { provider: Provider; onClick: () => void }) {
  const { t } = useTranslation();
  const cliBinary = provider.name.toLowerCase();
  const { available, installed, error: cliCheckError } = useCliAvailability(cliBinary);
  // Every caller of this component now only ever passes an
  // ACTIVE_PROVIDERS member (ProvidersSection's own activeProviders) --
  // the "Coming soon" section stopped rendering real provider tiles
  // entirely, per explicit request ("remove the providers at coming soon
  // as we will only have the request a provider at our launch"), so the
  // disabled/dimmed/"Coming soon" branch this component used to have for
  // an inactive provider is dead code now, removed rather than kept
  // around unreachable.
  const checking = !cliCheckError && available === undefined;
  // `available` alone isn't enough here -- it's seeded from
  // availabilityCache (useCliAvailability's own comment), so a provider
  // that connected earlier this session can still read `available: true`
  // from cache even while a fresh check just failed with cliCheckError
  // (backend unreachable). Gating on both keeps the chevron/hover
  // affordance in sync with the status text instead of showing a stale
  // "Connected"-shaped row next to an ALS-002 message.
  const isConnected = available === true && !cliCheckError;
  const statusLabel = cliCheckError
    // Same coded message as ConnectionBadge's own "error" state -- per
    // explicit request, a clear error instead of a vague "can't check"
    // (that badge's own comment has the full ALS-002 reasoning).
    ? t("settings.providers.noConnection")
    : checking
      ? t("settings.providers.checking")
      : isConnected
        ? t("common.connected")
        : installed
          ? t("settings.providers.notSignedInPlain")
          : t("settings.providers.notInstalledPlain");
  const docsUrl = PROVIDER_DOCS_URLS[cliBinary];
  // Same shrink-0/text sizing as before, just no hover of its own any more
  // (see the outer row's own comment below).
  const actionButtonClassName = "shrink-0 rounded-lg px-2 py-1 text-[11px] font-normal text-muted-foreground";
  // Every row now gets the exact same edge-to-edge hover, regardless of
  // connection state -- confirmed directly as a real inconsistency ("the
  // hover for gemini should be the exact same as claude and chatgpt"): a
  // not-yet-signed-in provider (Gemini, or Claude/Codex if they were ever
  // logged out) used to carry a narrower hover on just its icon+name
  // portion, stopping short of the Log in/Install button, while a
  // Connected row got the full card. The border/padding/hover now live on
  // this outer div unconditionally, and CSS's own hover bubbling means
  // hovering the inner action button still lights up this same background
  // -- no separate hover style needed on that button any more, so it can't
  // visually compete with or fall out of step with the row's own.
  const isFullCardButton = isConnected || cliCheckError;

  return (
    <div className={`flex select-none items-center gap-2 ${SETTINGS_CARD_RADIUS} border border-border p-3 transition-colors hover:bg-hover-2/50`}>
      <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 flex-1 select-none items-center gap-2 text-left ${isFullCardButton ? "w-full" : ""}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center">
          <ProviderIcon model={provider} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-foreground">
            {provider.displayName}
            {provider.displayCaption && (
              <span className="ml-1.5 font-normal text-muted-foreground">{provider.displayCaption}</span>
            )}
          </span>
          {/* line-clamp-2, not truncate -- per explicit request ("make the
              requested providers description suit into two or more
              lines/rows, we will need to allow this to other agents"). */}
          <span className="line-clamp-2 text-[10px] font-normal text-muted-foreground"><ErrorText message={statusLabel} /></span>
        </span>
        {isConnected && (
          // A plain open/chevron affordance now, not a toggle -- per
          // explicit request ("for connected we should do the arrow open
          // icon style instead of the toggle button"). Inside this same
          // button (was a sibling element after it, outside its
          // clickable/hoverable area entirely) -- confirmed directly
          // ("the > arrow is not getting the effect to click") that
          // living outside the button meant clicking or hovering it did
          // nothing at all. This app has no "hide this provider" setting
          // the way Synara's own Switch toggles (that one controls
          // provider-picker visibility) -- a toggle implied a control
          // that doesn't exist here; this just signals "click to open"
          // instead, matching the row's own real behavior.
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        {cliCheckError && (
          // Can't tell installed (ALS-003) from not-signed-in (ALS-004)
          // apart when the check itself failed -- `installed` here can
          // still be a stale cache hit from an earlier successful check,
          // so this must come before that branch rather than fall through
          // to a Log in/Install action that isn't actually knowable right
          // now. Inside the same button as the chevron above (not a
          // sibling span) so it shares that full-card hover instead of
          // sitting outside it looking inert.
          <span className="shrink-0 text-[11px] font-normal text-muted-foreground">{t("settings.providers.noConnectionPlain")}</span>
        )}
      </button>
      {isFullCardButton ? null : installed ? (
        // Not signed in but the CLI is there -- opens this same provider's
        // detail view (onClick, same as the row's own button), which
        // already has the real "Log in"/"Setup now" flow wired up
        // (ProviderConnectionView's own handleLogIn/handleSetupNow).
        <button type="button" onClick={onClick} className={actionButtonClassName}>
          {t("settings.providers.logIn")}
        </button>
      ) : docsUrl ? (
        // Not installed -- straight to the provider's own install docs,
        // not into the detail view (stopPropagation so this doesn't also
        // trigger the row's own onClick underneath it).
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            window.open(docsUrl, "_blank", "noopener,noreferrer");
          }}
          className={actionButtonClassName}
        >
          {t("settings.providers.install")}
        </button>
      ) : (
        // No confirmed docs URL for this provider (PROVIDER_DOCS_URLS'
        // own comment) -- falls back to the detail view, same as before.
        <button type="button" onClick={onClick} className={actionButtonClassName}>
          {t("settings.providers.setUp")}
        </button>
      )}
    </div>
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
          <div className="mt-4 mb-2 text-xs font-normal text-foreground select-none">
            <span className="opacity-50">{t("settings.apps.available")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GithubIntegrationCard onClick={() => openApp("github")} />
          </div>
          <div className="mt-4 mb-2 text-xs font-normal text-foreground select-none">
            <span className="opacity-50">{t("settings.apps.comingSoon")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Same row shape/reasoning as ProvidersSection's own "Request a
                provider" row -- a standing action, not filtered by anything,
                a real button ahead of a real request form (onClick still a
                no-op placeholder, same status that row's own has). */}
            <button
              type="button"
              onClick={() => {}}
              className={`flex w-full select-none items-center gap-2 ${SETTINGS_CARD_RADIUS} border border-border p-3 text-left transition-colors hover:bg-hover-2/50`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center">
                <AlongsideLogo className="size-5 text-black dark:text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">{t("settings.apps.requestApp.title")}</span>
                <span className="line-clamp-2 text-[10px] font-normal text-muted-foreground">
                  {t("settings.apps.requestApp.description")}
                </span>
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GithubIntegrationCard({ onClick }: { onClick: () => void }) {
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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full select-none items-center gap-2 ${SETTINGS_CARD_RADIUS} border border-border p-3 text-left transition-colors hover:bg-hover-2/50`}
    >
      {/* Real GitHub mark (icons/providers/github.svg), not the generic
          puzzle-piece IntegrationsIcon -- per explicit request ("Use
          the github.svg from icons/providers"). dark:invert -- this
          svg's only ink is solid near-black (#1B1F23), the exact same
          treatment every other solid-black provider mark already gets
          (quick-chat-models.tsx's own invertInDark flag/comment). */}
      <span className="flex size-8 shrink-0 items-center justify-center">
        <img src="/icons/providers/github.svg" alt="" className="size-5 dark:invert" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-foreground">GitHub</span>
        {/* Same Connected/Disconnected vocabulary ProviderCard's own status
            label uses -- per explicit request ("update from checking to be
            the same as our providers, connected or disconnected"), with no
            separate "Checking..." transient state (per a later explicit
            follow-up, "remove checking..."). */}
        <span className="line-clamp-2 text-[10px] font-normal text-muted-foreground">
          {isConnected ? t("common.connected") : t("common.disconnected")}
        </span>
      </span>
      {/* Per explicit request ("we are missing the arrow > at github like
          the models have") -- always shown, not gated on isConnected the
          way ProviderCard's own chevron is, since this row is always a
          real drill-in into GithubAppConnectionView regardless of
          connection state (unlike a provider row, which only drills in
          once actually connected). */}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
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
          <div className="truncate text-[13px] font-medium text-foreground">GitHub</div>
          <div className="truncate text-[13px] font-normal text-muted-foreground">
            {connectedUsername ? t("settings.apps.github.connectedAs", { username: connectedUsername }) : t("settings.apps.github.notConnected")}
          </div>
        </div>
      </div>
      {connectedUsername ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            <Trans i18nKey="settings.apps.github.useInChat" components={[<span className="font-mono" key="0" />]} />
          </p>
          <Button variant="outline" className="w-fit" onClick={() => void disconnect()}>
            {t("common.disconnect")}
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-medium text-foreground">{t("settings.apps.github.step1.title")}</p>
            <p className="text-[12px] text-muted-foreground">{t("settings.apps.github.step1.description")}</p>
            <code className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] break-all text-foreground">{callbackUrl}</code>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium text-foreground">{t("settings.apps.github.step2.title")}</p>
            <Input placeholder={t("settings.apps.github.clientId.placeholder")} value={clientId} onChange={(event) => setClientId(event.target.value)} />
            <Input
              type="password"
              placeholder={t("settings.apps.github.clientSecret.placeholder")}
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{t("settings.apps.github.secretWarning")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-medium text-foreground">{t("settings.apps.github.step3.title")}</p>
            <p className="text-[12px] text-muted-foreground">
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
  // Driven by a real query param (?provider=<name>) now, not local state --
  // confirmed directly as a real bug ("the < to return to the providers is
  // not working"): opening a provider's connection view used to be a pure
  // React-state swap with no URL of its own, so it never became an entry
  // in SettingsSidebarNav's own settingsHistory stack (that stack only
  // sees pathname changes) -- the sidebar's back chevron had nothing to
  // walk back to. Routing this through the URL means selecting a provider
  // is a real navigate(), which the existing stack already picks up for
  // free.
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProviderName = searchParams.get("provider");
  const selectedProvider = selectedProviderName ? (PROVIDERS.find((p) => p.name === selectedProviderName) ?? null) : null;
  function openProvider(provider: Provider) {
    // replace: true -- matches every other settings-internal navigation in
    // this file (RailButton's onClick, goToResult), keeping the router's
    // own history from growing a separate entry per click; settingsHistory
    // (this file's own back/forward stack) is what actually tracks steps
    // now, not the router's history.
    setSearchParams({ provider: provider.name }, { replace: true });
  }
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

  return (
    // Same crossfade AppLayout.tsx's own route transitions use (its
    // AnimatePresence/motion.div around {outlet}, 0.15s opacity fade) --
    // per explicit request, this list <-> connection-detail swap should
    // feel like "the same as our page transition" even though it's a
    // local view swap inside the modal, not a real route change.
    <AnimatePresence mode="wait" initial={false}>
      {selectedProvider ? (
        <motion.div
          key="connection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: spring.slow }}
          exit={{ opacity: 0, transition: spring.slow.exit }}
        >
          <ProviderConnectionView provider={selectedProvider} />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: spring.slow }}
          exit={{ opacity: 0, transition: spring.slow.exit }}
        >
          {/* Search bar removed -- per explicit request ("lets remove the
              search bar from providers as that's not needed for now"):
              only ACTIVE_PROVIDERS.size real tiles plus Request a
              provider exist today, few enough that searching them adds
              nothing yet. */}
          {/* grid-cols-2, not a single-column list -- per explicit
              request, matching the reference screenshot's own two-column
              "Connected Apps" layout. */}
          {activeProviders.length > 0 && (
            <>
              <div className="mt-4 mb-2 text-xs font-normal text-foreground select-none">
                <span className="opacity-50">{t("settings.apps.available")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {activeProviders.map((provider) => (
                  <ProviderCard key={provider.name} provider={provider} onClick={() => openProvider(provider)} />
                ))}
              </div>
            </>
          )}
          {/* Real integrations (issue #287) -- moved to their own top-level
              "Apps" settings section (AppsSection, below) per explicit
              correction ("Still inside providers its meant to be settings
              > apps and not settings > providers > apps") -- no longer
              reached from here at all. */}
          {/* Coming soon -- per explicit request ("remove the providers at
              coming soon as we will only have the request a provider at
              our launch"): the real Mistral/xAI/Qwen/Kimi/GitHub/DeepSeek
              tiles that used to render here (PROVIDERS filtered by
              !ACTIVE_PROVIDERS) are gone from this section entirely for
              launch, not just visually de-emphasized. */}
          <div className="mt-4 mb-2 text-xs font-normal text-foreground select-none">
            <span className="opacity-50">{t("settings.apps.comingSoon")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Request provider -- per explicit request, its own row using
                this app's own mark (AlongsideLogo) instead of a real
                provider's icon or an empty slot, since it isn't one of
                them. Always shown, not filtered by the search box above
                -- it's a standing action, not a provider that can match
                or fail to match a query. One grid cell like every real
                provider tile (not col-span-2, tried first) and the same
                solid border-border (not border-dashed) -- both per
                explicit request, so this reads as one more row in the
                grid rather than a visually distinct footer action.
                Same row shape as ProviderCard now (icon+name/status left,
                text below the icon+name instead of a description line),
                per explicit request ("Request a provider should be in the
                same format as the other"). A real button now, not a
                decorative div -- per explicit request ("request a
                provider should be a full button as well for the future
                form"), so the whole row is clickable/hoverable ahead of a
                real request form being wired up (onClick is still a
                no-op placeholder, same status as the rest of this page's
                own connect flow). */}
            <button
              type="button"
              onClick={() => {}}
              className={`flex w-full select-none items-center gap-2 ${SETTINGS_CARD_RADIUS} border border-border p-3 text-left transition-colors hover:bg-hover-2/50`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center">
                <AlongsideLogo className="size-5 text-black dark:text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">{t("settings.providers.requestProvider.title")}</span>
                {/* line-clamp-2, not truncate -- per explicit request
                    ("make the requested providers description suit into
                    two or more lines/rows, we will need to allow this to
                    other agents"): the same wrap allowance ProviderCard's
                    own status label got below, since a real provider's
                    description (now shown there for every Coming soon
                    row too) can run just as long as this one. */}
                <span className="line-clamp-2 text-[10px] font-normal text-muted-foreground">
                  {t("settings.providers.requestProvider.description")}
                </span>
              </span>
            </button>
          </div>

          {/* Its own section, under Coming soon -- per explicit request
              ("Usage should be under Coming soon section"): a real,
              working link, so its own describer rather than sitting among
              placeholder cards, and a single full-width row (no
              grid-cols-2 half-width) since it's the only item in this
              section. */}
          <div className="mt-4 mb-2 text-xs font-normal text-foreground select-none">
            <span className="opacity-50">{t("settings.providers.usage")}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/settings/provider/usage")}
            className={`flex w-full select-none items-center gap-2 ${SETTINGS_CARD_RADIUS} border border-border p-3 text-left transition-colors hover:bg-hover-2/50`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              <ProviderUsageIcon className="size-5 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-foreground">{t("settings.providers.usage.title")}</span>
              <span className="line-clamp-2 text-[10px] font-normal text-muted-foreground">
                {t("settings.providers.usage.description")}
              </span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
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
function resizeImageFile(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("failed to decode image"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// New, per explicit request ("add a new menu at settings for Profile where
// we can allow users to upload their avatar picture for now which is the
// only option that we will have and logout to go inside there instead of
// general"). Avatar upload is the one real control here; Log out moved
// down from General's own former Caution section (that section's own
// comment has the pointer).
function ProfileSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
    <div className="flex flex-col">
      <SettingsSection title={t("settings.profile.personal")}>
        {/* The name is the identity provider's (lib/identity.ts) and cannot be edited here. */}
        <SettingsRow
          id="setting-name"
          title={t("settings.profile.name.title")}
          description={isSignedIn ? t("settings.profile.name.description") : t("settings.profile.name.signedOut")}
        >
          <span className="text-[12px] font-medium text-foreground">{currentName}</span>
        </SettingsRow>
        <SettingsRow
          id="setting-avatar"
          title={t("settings.profile.avatar.title")}
          // No (i) tooltip any more -- per explicit request, after
          // confirming directly against the real upload code: there's no
          // actual size requirement (resizeImageFile below auto-resizes
          // any uploaded image to fit 256px, so "400x400" was never a
          // real constraint), only a real format restriction (the file
          // picker's own accept="image/jpeg,image/png" and this row's own
          // upload handler both reject anything else) -- kept visible in
          // plain text instead of behind an icon, since it's the one part
          // of the old copy that was actually true.
          description={t("settings.profile.avatar.description")}
          status={error ?? undefined}
        >
          {/* disabled when signed out -- per explicit request ("profile
              items inside like upload picture or logout should show as
              inactive because those are signed in options"): a profile
              picture belongs to a real signed-in identity, so managing one
              isn't meaningful yet without one. Subscription (below) is
              deliberately NOT gated the same way -- per that same
              request, "membership is fine as it is". */}
          <button
            type="button"
            className={SETTINGS_ACTION_BUTTON_CLASS}
            disabled={!isSignedIn}
            onClick={() => setManageOpen(true)}
          >
            {t("settings.profile.avatar.managePhoto")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(event) => void handleFileSelected(event)}
          />
        </SettingsRow>
        {/* Manage photo -- per explicit request ("instead of be Upload
            photo and Remove Photo, it should be Manage photo so we can
            click that and open a overlay where it shows the existing
            photo then the option to download, remove or upload a new
            one"). Download/Remove only make sense when a photo actually
            exists; Upload a new one is always available. Removing falls
            back to the generated logo-on-color mark automatically -- per
            direct follow-up confirming that's the expected behavior --
            DefaultAvatar (ui/avatar.tsx) already renders that mark
            whenever getUserAvatarImage() is empty, no extra state needed
            here for it. */}
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
              {/* Format note lives here now, not the Settings row's own
                  description -- per explicit request. */}
              <DialogDescription className="text-[13px] font-normal">
                {avatarImage
                  ? t("settings.profile.avatar.dialogDescription.withPhoto")
                  : t("settings.profile.avatar.dialogDescription.noPhoto")}
              </DialogDescription>
            </DialogHeader>
            {/* Photo on the left, name on the right -- per explicit
                request ("the photo should be at the left and the name of
                the user at the right to give an example on how it will
                look like"), the same layout the sidebar's own account row
                and a chat message's own header both already use. Shows
                pendingImage (a picked-but-not-yet-confirmed file) once one
                exists, in place of the actually-saved avatarImage. */}
            <div className="flex items-center gap-3 py-2">
              <Avatar size="lg" className="size-16 shrink-0">
                <AvatarFallback className="text-xl">
                  {pendingImage ? (
                    <img src={pendingImage} alt="" className="size-full rounded-full object-cover" />
                  ) : (
                    <DefaultAvatar name={getUserDisplayName()} />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{getUserDisplayName()}</span>
            </div>
            <DialogFooter>
              {avatarImage && !pendingImage && (
                <Button variant="outline" className="h-8 gap-1.5 text-[11px]" onClick={handleDownload}>
                  <DownloadIcon className="size-3.5" />
                  {t("common.download")}
                </Button>
              )}
              {/* Same red as the chat delete-confirmation dialog's own
                  Delete button (sidebar-nav.tsx) -- per explicit request. */}
              {avatarImage && !pendingImage && (
                <Button
                  className="h-8 bg-red-600 text-[11px] text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                  onClick={() => clearUserAvatarImage()}
                >
                  {t("common.remove")}
                </Button>
              )}
              {/* Flips to Confirm once a file has been picked -- per
                  explicit request ("upload new flips to Confirm") --
                  handleConfirmUpload is the one place that actually calls
                  setUserAvatarImage now. */}
              {pendingImage ? (
                <Button className="h-8 text-[11px]" onClick={handleConfirmUpload}>
                  {t("common.confirm")}
                </Button>
              ) : (
                <Button className="h-8 text-[11px]" onClick={() => fileInputRef.current?.click()}>
                  {t("common.add")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Static, not a live account/billing lookup -- there is no real
            subscription/plan concept anywhere in this app yet (confirmed:
            no backend endpoint, no per-user account system at all, Free
            tier is the only mode a local install actually runs in), so
            this states that plainly rather than fabricating a Pro/
            Enterprise upgrade flow that doesn't exist. Revisit once a real
            subscription system exists. */}
        <SettingsRow title={t("settings.profile.subscription.title")} description={t("settings.profile.subscription.description")}>
          <span className="text-[12px] font-medium text-foreground">{t(`settings.profile.subscription.${plan}`)}</span>
        </SettingsRow>
      </SettingsSection>

      {/* Caution -- same page-ending convention every other Settings page
          follows ("Caution should be the last item in all pages"). Log
          out is real (signOut, lib/auth.ts) -- real bug, confirmed
          directly ("The logout button is not working"). Since signing in
          is now optional (App.tsx's own comment on removing RequireAuth's
          blanket gate has the full reasoning) rather than a forced
          redirect off every route, this row shows "Sign in" instead once
          signed out -- /auth is a real, voluntarily reachable page now,
          not just something to escape. Logging out itself stays right
          here in Settings instead of navigating anywhere -- per direct
          follow-up ("logout is bringing me to the /auth page and that
          should stay in settings") -- signOut() alone is enough to
          reactively flip this row (and the disabled Manage photo button
          above) to their signed-out state; only Sign in still navigates,
          since that one genuinely needs the real sign-in form. state:
          { from } lets AuthPage return here (not always Getting started)
          once signed back in. */}
      <SettingsSection title={t("settings.profile.caution")}>
        <SettingsRow
          id="setting-log-out"
          title={isSignedIn ? t("common.logOut") : t("common.signIn")}
          description={isSignedIn ? t("settings.profile.logOut.description") : t("settings.profile.signIn.description")}
        >
          <button
            type="button"
            className={SETTINGS_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (isSignedIn) {
                signOut();
              } else {
                navigate("/auth", { state: { from: location.pathname } });
              }
            }}
          >
            <LogOutIcon className="size-3.5" />
            {isSignedIn ? t("common.logOut") : t("common.signIn")}
          </button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// One page, three sub-sections underneath it (Tips/Notifications/Usage,
// plus Caution), per explicit confirmation ("Not as items but as menu
// items like synara's style"): Synara's own General page stacks several
// labeled sub-sections on one page rather than giving each its own nav
// entry, and this app's existing SettingsSection/SettingsRow already
// render exactly that shape, so nothing new needed building beyond
// composing them here. Story: Settings "Application" section
// (alongsidedotrun/private#207). Appearance used to be a fourth
// sub-section here too; it now lives in its own AppearanceSection, below.
function GeneralSection() {
  const { t } = useTranslation();
  const { show: showGettingStarted, setShow: setShowGettingStarted } = useGettingStarted();
  const [notifyEnabled, setNotifyEnabledState] = useState(loadNotifyTurnComplete);

  // Requests the OS notification permission the first time this is turned
  // on -- a denial reflects back into the toggle instead of showing "on"
  // with no way to ever actually notify.
  async function setNotifyEnabled(next: boolean) {
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setNotifyEnabledState(false);
        saveNotifyTurnComplete(false);
        return;
      }
    }
    setNotifyEnabledState(next);
    saveNotifyTurnComplete(next);
  }

  const gettingStartedChanged = showGettingStarted !== true;
  // Baseline flipped to true along with loadNotifyTurnComplete's own new
  // default (notify-turn-complete.ts's own comment has the full
  // reasoning) -- otherwise Reset would show as available on a completely
  // untouched, fresh install, and "restoring the default" would actually
  // turn notifications *off*.
  const notifyChanged = notifyEnabled !== true;
  const anyChanged = gettingStartedChanged || notifyChanged;

  function restoreDefaults() {
    setShowGettingStarted(true);
    void setNotifyEnabled(true);
  }

  return (
    <div className="flex flex-col">
      <SettingsSection title={t("settings.general.tips")}>
        <SettingsRow
          id="setting-getting-started"
          title={t("settings.general.gettingStarted.title")}
          description={t("settings.general.gettingStarted.description")}
        >
          <Switch checked={showGettingStarted} onToggle={() => setShowGettingStarted(!showGettingStarted)} aria-label="Getting started" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t("settings.general.languageAndTimezone")}>
        <LanguageRow />
        <TimezoneRow />
      </SettingsSection>

      <SettingsSection title={t("settings.general.notifications")}>
        {/* Copy per explicit request/follow-up, with the two disputed
            claims in the original wording resolved for real rather than
            just dropped: "human or provider turn" narrowed to "provider
            turn" (notifyTurnComplete only ever fires on the agent's own
            reply, never on another participant's message -- that file's
            own comment has the full reasoning), and "notifications can be
            specifically enabled at chats" is now actually true --
            AppLayout.tsx's own new chat-header "..." menu (Share chat/
            Enable notification) writes a real per-chat override
            (chat-notifications.ts) that notifyTurnComplete also checks. */}
        <SettingsRow
          id="setting-notify-turn-complete"
          title={t("settings.general.notifyTurnComplete.title")}
          description={t("settings.general.notifyTurnComplete.description")}
        >
          <Switch
            checked={notifyEnabled}
            onToggle={() => void setNotifyEnabled(!notifyEnabled)}
            aria-label="Receive a notification from every chat when a turn completes"
          />
        </SettingsRow>
      </SettingsSection>

      {/* Caution -- per explicit request, its own sub-section and last on
          the page, matching every other page's own convention going
          forward ("Caution should be the last item in all pages"). Not
          styled destructive -- resetting this page isn't irreversible the
          way the old Danger zone's own "Reset all settings" was, this
          heading is just calling it out as worth a second thought. Log
          out moved to its own new Profile section -- per explicit request
          ("logout to go inside there instead of general"). */}
      <SettingsSection title={t("settings.general.caution")}>
        <SettingsRow title={t("settings.general.resetDefaults.title")} description={t("settings.general.resetDefaults.description")}>
          <button type="button" className={SETTINGS_ACTION_BUTTON_CLASS} disabled={!anyChanged} onClick={restoreDefaults}>
            <RotateCcwIcon className="size-3.5" />
            {t("settings.general.resetDefaults.button")}
          </button>
        </SettingsRow>
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

  // The raw icon component, not pre-rendered JSX -- BaseMenuItem's own
  // `icon` prop (menu-item.tsx) calls this itself with its own size/
  // strokeWidth/className (the invisible-sizer-plus-visible-icon grid
  // overlay that keeps a row's icon centered against its label), so a
  // pre-rendered `<SystemIcon className="size-3.5" />` handed to it
  // ignores every one of those and renders slightly off -- confirmed
  // directly as the cause of "the icons are not straight to the text
  // vertically". Every other real `icon={...}` call site in this app
  // (nav-user.tsx's own Settings/Docs/Help rows, compose-box.tsx's own
  // Plus row) already passes the bare component this same way.
  const themeOptions: { value: typeof theme; label: string; icon: IconComponent }[] = [
    { value: "system", label: t("settings.appearance.theme.system"), icon: SystemIcon },
    { value: "light", label: t("settings.appearance.theme.light"), icon: SunIcon },
    { value: "dark", label: t("settings.appearance.theme.dark"), icon: MoonIcon },
  ];
  const currentTheme = themeOptions.find((o) => o.value === theme) ?? themeOptions[0];

  const chatWidthOptions: { value: ChatWidth; label: string; icon: IconComponent }[] = [
    { value: "standard", label: t("settings.appearance.chatWidth.standard"), icon: ChevronsInwardHorizontalIcon },
    { value: "expanded", label: t("settings.appearance.chatWidth.expanded"), icon: ExpandedWidthIcon },
  ];
  const currentChatWidth = chatWidthOptions.find((o) => o.value === chatWidth) ?? chatWidthOptions[0];

  const transparencyChanged = transparencyEnabled !== false;
  const systemUiFontChanged = systemUiFont !== true;
  const fontSmoothingChanged = fontSmoothing !== true;
  const chatWidthChanged = chatWidth !== "standard";
  const anyChanged = transparencyChanged || systemUiFontChanged || fontSmoothingChanged || chatWidthChanged;

  function restoreDefaults() {
    updateTransparency(false);
    setSystemUiFont(true);
    setFontSmoothing(true);
    setChatWidth("standard");
  }

  return (
    <div className="flex flex-col">
      {/* Four sections now, not one flat "Appearance" card -- per explicit
          request ("inside appearance we have only one section called
          appearance but we should have four sections, Theme, fonts
          (macOS only), layout, caution"). Fonts groups both font-related
          rows even though only Font smoothing is actually macOS-gated
          (Use system UI font applies everywhere); Layout groups the
          window/column-shape rows, including transparency (macOS-only,
          same gate as before). */}
      <SettingsSection title={t("settings.appearance.theme")}>
        <SettingsRow id="setting-theme" title={t("settings.appearance.theme")} description={t("settings.appearance.theme.description")}>
          <BaseDropdownMenu size="compact">
            <BaseDropdownTrigger
              render={
                <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_CLASS}>
                  <span className="flex items-center gap-1.5">
                    <currentTheme.icon size={14} />
                    {currentTheme.label}
                  </span>
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
                  icon={option.icon}
                  label={option.label}
                  checked={theme === option.value}
                  onSelect={() => setTheme(option.value)}
                />
              ))}
            </BaseDropdownContent>
          </BaseDropdownMenu>
        </SettingsRow>
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

      <SettingsSection title={t("settings.appearance.layout")}>
        <SettingsRow
          id="setting-chat-width"
          title={t("settings.appearance.chatWidth.title")}
          description={t("settings.appearance.chatWidth.description")}
        >
          {/* A dropdown now, not a segmented control -- per explicit
              request ("Chat width... should use a dropdown like [Theme's
              own dropdown]"), matching that row's own BaseDropdownMenu/
              BaseDropdownTrigger/BaseDropdownContent shape exactly rather
              than the pill-style SettingsSegmentedControl this used to be. */}
          <BaseDropdownMenu size="compact">
            <BaseDropdownTrigger
              render={
                <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_CLASS}>
                  <span className="flex items-center gap-1.5">
                    <currentChatWidth.icon size={14} />
                    {currentChatWidth.label}
                  </span>
                  <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              }
            />
            <BaseDropdownContent align="end" checkedIndex={chatWidthOptions.findIndex((o) => o.value === chatWidth)}>
              {chatWidthOptions.map((option, i) => (
                <BaseMenuItem
                  key={option.value}
                  index={i}
                  icon={option.icon}
                  label={option.label}
                  checked={chatWidth === option.value}
                  onSelect={() => setChatWidth(option.value)}
                />
              ))}
            </BaseDropdownContent>
          </BaseDropdownMenu>
        </SettingsRow>
        {/* macOS only, hidden (not shown-and-disabled) everywhere else,
            per the confirmed story text ("Only visible when using macOS"). */}
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

      <SettingsSection title={t("settings.appearance.caution")}>
        <SettingsRow title={t("settings.appearance.resetDefaults.title")} description={t("settings.appearance.resetDefaults.description")}>
          <button type="button" className={SETTINGS_ACTION_BUTTON_CLASS} disabled={!anyChanged} onClick={restoreDefaults}>
            <RotateCcwIcon className="size-3.5" />
            {t("settings.general.resetDefaults.button")}
          </button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// localStorage, not a backend setting -- same reasoning as theme/transparency
// above (TRANSPARENCY_STORAGE_KEY's own comment): a per-device display
// preference, not something a Hosted/Enterprise account needs synced across
// machines yet.
const TIMEZONE_STORAGE_KEY = "alongside_timezone";

// Real detection -- Intl.DateTimeFormat's own resolvedOptions, the same
// mechanism every other app on the machine uses to know its own timezone.
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function loadTimezone(): string {
  return localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? detectTimezone();
}

type TimezoneEntry = { value: string; label: string };
// subregions is only ever set for "America" today (below) -- every other
// region renders as one flat, collapsible list, per explicit request (only
// America was called out as "enormous").
type TimezoneGroup = { region: string; zones: TimezoneEntry[]; subregions?: { name: string; zones: TimezoneEntry[] }[] };

// The tz database itself has no North/Central/South American distinction --
// confirmed directly, "America/*" is one flat 143-zone list with no metadata
// beyond the zone name -- so this is a real, hand-built classification by
// each zone's own actual country, not something Intl provides. Grouped by
// country/territory below (comments mark each block), not by zone name
// pattern-matching, since neither the country nor the continent is reliably
// derivable from the zone string alone (e.g. "America/Belize" -> Belize is
// obvious, but "America/Nassau" -> Bahamas isn't spelled out anywhere in the
// string). Caribbean nations classed under North America (the common 3-way
// convention when Caribbean isn't its own bucket, which is what was asked
// for here), not their own fourth group.
const CENTRAL_AMERICA_ZONES = new Set([
  "America/Belize",
  "America/Costa_Rica",
  "America/El_Salvador",
  "America/Guatemala",
  "America/Managua",
  "America/Panama",
  "America/Tegucigalpa",
]);
const SOUTH_AMERICA_ZONES = new Set([
  // Argentina
  "America/Argentina/La_Rioja",
  "America/Argentina/Rio_Gallegos",
  "America/Argentina/Salta",
  "America/Argentina/San_Juan",
  "America/Argentina/San_Luis",
  "America/Argentina/Tucuman",
  "America/Argentina/Ushuaia",
  "America/Buenos_Aires",
  "America/Catamarca",
  "America/Cordoba",
  "America/Jujuy",
  "America/Mendoza",
  // Bolivia
  "America/La_Paz",
  // Brazil
  "America/Araguaina",
  "America/Bahia",
  "America/Belem",
  "America/Boa_Vista",
  "America/Campo_Grande",
  "America/Cuiaba",
  "America/Eirunepe",
  "America/Fortaleza",
  "America/Maceio",
  "America/Manaus",
  "America/Noronha",
  "America/Porto_Velho",
  "America/Recife",
  "America/Rio_Branco",
  "America/Santarem",
  "America/Sao_Paulo",
  // Chile
  "America/Santiago",
  "America/Punta_Arenas",
  // Colombia, Ecuador, French Guiana, Guyana, Paraguay, Peru, Suriname, Uruguay, Venezuela
  "America/Bogota",
  "America/Guayaquil",
  "America/Cayenne",
  "America/Guyana",
  "America/Asuncion",
  "America/Lima",
  "America/Paramaribo",
  "America/Montevideo",
  "America/Caracas",
]);
function americaSubregion(zone: string): "North America" | "Central America" | "South America" {
  if (CENTRAL_AMERICA_ZONES.has(zone)) return "Central America";
  if (SOUTH_AMERICA_ZONES.has(zone)) return "South America";
  return "North America";
}

// Real IANA zone list, not a hand-picked subset -- Intl.supportedValuesOf
// (Baseline across every browser this app targets) returns every zone the
// runtime itself actually supports, the same list any of its own
// Intl.DateTimeFormat calls could be given -- confirmed directly, this is
// genuinely 400+ real zones (the tz database tracks every region with its own
// distinct DST history, not one entry per country), not a bug to trim down.
// Grouped by the zone's own region prefix ("Europe/London" -> "Europe"),
// per explicit request, rather than one flat 400-row list -- Etc/* and other
// no-slash zones group under "Other". Region groups and the zones within each
// are both alphabetical; each zone's own label drops the repeated region
// prefix and swaps underscores for spaces ("Los_Angeles" -> "Los Angeles"),
// since the group header already says "America". America itself further
// splits into North/Central/South (americaSubregion, above) -- per explicit
// follow-up ("america has all americas which makes enormous").
function listTimezoneGroups(): TimezoneGroup[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [detectTimezone()];
  }
  const byRegion = new Map<string, TimezoneEntry[]>();
  for (const zone of zones) {
    const slash = zone.indexOf("/");
    const region = slash === -1 ? "Other" : zone.slice(0, slash);
    // Real bug, confirmed directly ("Argentina / La Rioja" leaking through):
    // slicing after the *first* slash only strips the region prefix
    // ("America/"), but a handful of real zones have a second path segment
    // (America/Argentina/La_Rioja, America/Indiana/Knox, America/Kentucky/
    // Monticello, America/North_Dakota/Beulah) -- the group header (region,
    // and for America, its own North/Central/South subregion) already gives
    // that country/state context, so the label itself only needs the final
    // city component, after the *last* slash.
    const lastSlash = zone.lastIndexOf("/");
    const label = (lastSlash === -1 ? zone : zone.slice(lastSlash + 1)).replaceAll("_", " ");
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push({ value: zone, label });
  }
  return [...byRegion.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, zonesInRegion]) => {
      const sortedZones = zonesInRegion.sort((a, b) => a.label.localeCompare(b.label));
      if (region !== "America") return { region, zones: sortedZones };
      const bySubregion = new Map<string, TimezoneEntry[]>([
        ["North America", []],
        ["Central America", []],
        ["South America", []],
      ]);
      for (const zone of sortedZones) bySubregion.get(americaSubregion(zone.value))!.push(zone);
      return {
        region,
        zones: sortedZones,
        subregions: [...bySubregion.entries()].map(([name, zonesInSub]) => ({ name, zones: zonesInSub })),
      };
    });
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

  const entry = LANGUAGE_OPTIONS.find((l) => l.value === language) ?? LANGUAGE_OPTIONS[0];

  return (
    <SettingsRow id="setting-language" title={t("settings.general.language.title")} description={t("settings.general.language.description")}>
      <BaseDropdownMenu size="compact">
        <BaseDropdownTrigger
          render={
            <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_FIT_CLASS}>
              {entry.label}
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          }
        />
        <BaseDropdownContent align="end" className="min-w-52 whitespace-nowrap" checkedIndex={LANGUAGE_OPTIONS.findIndex((l) => l.value === language)}>
          {LANGUAGE_OPTIONS.map((l, i) => (
            <BaseMenuItem key={l.value} index={i} label={l.label} checked={language === l.value} onSelect={() => setLanguage(l.value)} />
          ))}
        </BaseDropdownContent>
      </BaseDropdownMenu>
    </SettingsRow>
  );
}

function TimezoneRow() {
  const { t } = useTranslation();
  const [timezone, setTimezoneState] = useState(loadTimezone);
  const groups = useMemo(listTimezoneGroups, []);
  const flatValues = useMemo(() => groups.flatMap((g) => g.zones.map((z) => z.value)), [groups]);
  const currentLabel = groups.flatMap((g) => g.zones).find((z) => z.value === timezone)?.label ?? timezone;

  // Collapsed by default, per explicit request ("so it doesn't load
  // everything") -- 417 real zones (confirmed directly via
  // Intl.supportedValuesOf) rendered flat, even scrollable, is still a lot to
  // mount at once. Only the current value's own region (and, for America,
  // its own subregion too) starts expanded -- computed once via useState's
  // own lazy initializer, not recalculated if timezone changes later, so
  // picking a zone in a different region doesn't yank other regions open
  // underneath the user. Subregion keys are namespaced "America/North
  // America" (not just "North America") so this one Set can track both
  // levels without a region and a same-named subregion ever colliding.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const group of groups) {
      if (group.zones.some((z) => z.value === timezone)) initial.add(group.region);
      for (const sub of group.subregions ?? []) {
        if (sub.zones.some((z) => z.value === timezone)) {
          initial.add(group.region);
          initial.add(`${group.region}/${sub.name}`);
        }
      }
    }
    return initial;
  });

  function toggleKey(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setTimezone(value: string) {
    setTimezoneState(value);
    localStorage.setItem(TIMEZONE_STORAGE_KEY, value);
  }

  return (
    <SettingsRow id="setting-timezone" title={t("settings.general.timezone.title")} description={t("settings.general.language.description")}>
      <BaseDropdownMenu size="compact">
        <BaseDropdownTrigger
          render={
            <button type="button" className={SETTINGS_DROPDOWN_TRIGGER_CLASS}>
              <span className="truncate">{currentLabel}</span>
              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          }
        />
        {/* max-h-72 overflow-y-auto -- same cap-then-scroll treatment as the
            compose box's own model dropdown. checkedIndex/each row's own index
            count against flatValues (every zone across every group, in the
            same order rendered below, collapsed or not), not per-group --
            BaseMenuItem's keyboard nav and highlight both need one continuous
            index across the whole popup, the same reason the model dropdown's
            own per-provider rows never restart their own index either; a
            collapsed region just means its own indices render nothing right
            now, the same as the model list's own add/remove case. */}
        <BaseDropdownContent align="end" className="max-h-72 overflow-y-auto" checkedIndex={flatValues.indexOf(timezone)}>
          {groups.map((group) => {
            const expanded = expandedKeys.has(group.region);
            return (
              <div key={group.region}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleKey(group.region);
                  }}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  <span>{group.region}</span>
                  <ChevronRightIcon className={`size-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
                </button>
                {expanded && group.subregions
                  ? group.subregions.map((sub) => {
                      const subKey = `${group.region}/${sub.name}`;
                      const subExpanded = expandedKeys.has(subKey);
                      return (
                        <div key={subKey}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleKey(subKey);
                            }}
                            className="flex w-full items-center justify-between py-1.5 pr-2.5 pl-5 text-[12px] text-muted-foreground hover:text-foreground"
                          >
                            <span>{sub.name}</span>
                            <ChevronRightIcon className={`size-3 shrink-0 transition-transform ${subExpanded ? "rotate-90" : ""}`} />
                          </button>
                          {subExpanded &&
                            sub.zones.map((zone) => (
                              <BaseMenuItem
                                key={zone.value}
                                index={flatValues.indexOf(zone.value)}
                                label={zone.label}
                                checked={timezone === zone.value}
                                onSelect={() => setTimezone(zone.value)}
                              />
                            ))}
                        </div>
                      );
                    })
                  : expanded &&
                    group.zones.map((zone) => (
                      <BaseMenuItem
                        key={zone.value}
                        index={flatValues.indexOf(zone.value)}
                        label={zone.label}
                        checked={timezone === zone.value}
                        onSelect={() => setTimezone(zone.value)}
                      />
                    ))}
              </div>
            );
          })}
        </BaseDropdownContent>
      </BaseDropdownMenu>
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
              className={`flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-muted/30 ${SETTINGS_CONTROL_RADIUS}`}
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
              className={`flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-muted/30 ${SETTINGS_CONTROL_RADIUS}`}
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
  const [defaultModel, setDefaultModel] = useState<string | null | undefined>(undefined);
  const [defaultEffort, setDefaultEffort] = useState<EffortLevel | null>(() => loadDefaultEffort());
  // Moved here from General's own Usage section -- per explicit request
  // ("Chat usage should move from general and be at Chat, in the same way
  // we did for Provider usage"): it's a stat about chats, not a general
  // app preference.
  const { usage, error: usageError } = useUsageStats();

  // Mirrors DefaultModelRow's own fetch, just for the section-level Restore
  // defaults button's own disabled state -- DefaultModelRow keeps its own
  // separate copy for its own dropdown, this doesn't try to share state
  // across the two (a second, harmless GET, not a source-of-truth split:
  // both read the same real /settings/default-model).
  useEffect(() => {
    let cancelled = false;
    fetch("/settings/default-model")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { model: string | null } | null) => {
        if (!cancelled) setDefaultModel(data?.model ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anyChanged = Boolean(defaultModel) || defaultEffort != null;
  // Bumped on restore, used as both rows' own `key` -- forces a full
  // remount so each row's own internal state (DefaultModelRow/
  // DefaultEffortRow both keep their own copy for their own dropdown, not
  // shared with this section) re-reads the now-cleared value instead of
  // going stale until Settings is closed and reopened.
  const [resetCount, setResetCount] = useState(0);

  async function restoreDefaults() {
    setDefaultModel(null);
    setDefaultEffort(null);
    saveDefaultEffort(null);
    setResetCount((n) => n + 1);
    await fetch("/settings/default-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: null }),
    });
  }

  return (
    <div className="flex flex-col">
      <SettingsSection title={t("settings.chat.title")}>
        <DefaultModelRow key={resetCount} />
        <DefaultEffortRow key={resetCount} />
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
          <span className="text-[12px] font-medium text-foreground">
            {usage ? formatStorageBytes(usage.storage_bytes) : usageError ? "--" : "..."}
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* Caution -- same pattern as General/Appearance's own Caution
          section (each page's own comment on that) -- per explicit
          request ("chat should have the same as general, caution section
          with default chat settings option"), replacing the bespoke
          RestoreDefaultsButton row this used to end on. */}
      <SettingsSection title={t("settings.chat.caution")}>
        <SettingsRow title={t("settings.chat.resetDefaults.title")} description={t("settings.chat.resetDefaults.description")}>
          <button type="button" className={SETTINGS_ACTION_BUTTON_CLASS} disabled={!anyChanged} onClick={() => void restoreDefaults()}>
            <RotateCcwIcon className="size-3.5" />
            {t("settings.general.resetDefaults.button")}
          </button>
        </SettingsRow>
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

export function SettingsSidebarNav({ section }: { section: SettingsSection }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMac = useIsMac();
  const displayName = useUserDisplayName();
  const settingsHistory = useSettingsHistory();
  // Account/Help dropdown triggers -- same refocus-blur fix sidebar-nav.tsx's
  // own identical footer row uses on each (that row's own comment has the
  // full Radix-refocus reasoning).
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);

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
    pushSettingsHistory(location.pathname + location.search);
  }, [location.pathname, location.search]);

  function goBackInSettings() {
    if (settingsHistory.index <= 0) return;
    const target = settingsHistory.stack[settingsHistory.index - 1];
    settingsHistoryState = { ...settingsHistoryState, index: settingsHistoryState.index - 1 };
    notifySettingsHistory();
    navigate(target, { replace: true });
  }

  function goForwardInSettings() {
    if (settingsHistory.index >= settingsHistory.stack.length - 1) return;
    const target = settingsHistory.stack[settingsHistory.index + 1];
    settingsHistoryState = { ...settingsHistoryState, index: settingsHistoryState.index + 1 };
    notifySettingsHistory();
    navigate(target, { replace: true });
  }

  const [query, setQuery] = useState("");
  const results = useMemo(() => rankSettingsSearch(query), [query]);
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
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="flex min-h-0 shrink-0 flex-col pt-2" style={{ width: SIDEBAR_WIDTH }}>
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
        <div className="mx-2 flex h-6 shrink-0 items-center overflow-hidden" style={{ width: SIDEBAR_ROW_WIDTH }}>
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
        <div className="relative mx-2 mb-2 h-7 w-[204px]">
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
            className="h-7 rounded-[var(--row-radius-sm)] border border-border bg-transparent pl-[30px] text-xs font-normal text-foreground placeholder:text-foreground placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0 focus-visible:border-focus-accent md:text-xs"
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
              <p className="px-2 py-2 text-[11px] font-normal text-muted-foreground">{t("settings.search.noResults", { query })}</p>
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
                  <span className="flex items-center gap-1.5 text-[10px] font-normal text-muted-foreground">
                    {s.icon}
                    {t(s.labelKey)}
                  </span>
                  <span className="pl-[22px] text-[12px] text-foreground">{entry.title}</span>
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
                {group.keys.map((key) => {
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
      <div className="mt-auto shrink-0 pb-4">
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
            onClick={() => navigate("/new-chat")}
          />
        </GlideGroup>
        <div className="mx-2 mt-1 flex h-7 shrink-0 items-center gap-1 overflow-hidden rounded-[var(--row-radius)]" style={{ width: SIDEBAR_ROW_WIDTH }}>
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
                  className="flex h-7 flex-1 min-w-0 shrink-0 transform-gpu items-center gap-2 rounded-[var(--row-radius)] px-1.5 text-left transition-[background-color] duration-150 hover:bg-hover-2/50"
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
                  className="flex h-7 w-7 shrink-0 transform-gpu items-center justify-center rounded-[var(--row-radius)] text-foreground transition-colors duration-150 hover:text-ink data-[popup-open]:text-ink"
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
      </div>
    </aside>
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
          <h2 className="text-[16px] font-semibold text-foreground">
            {(() => {
              const labelKey = SECTIONS.find((s) => s.key === section)?.labelKey;
              return labelKey ? t(labelKey) : null;
            })()}
          </h2>
          <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">{t(SECTION_SUBTITLE_KEY[section])}</p>
        </PageContent>
        <PageContent maxWidth="var(--chat-max-width)">
          {section === "profile" && <ProfileSection />}
          {section === "general" && <GeneralSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "chat" && <ChatSection />}
          {section === "provider" && <ProvidersSection />}
          {section === "apps" && <AppsSection />}
        </PageContent>
      </ScrollArea>
    </div>
  );
}
