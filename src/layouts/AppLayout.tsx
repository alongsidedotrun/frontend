import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutlet, useLocation, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { RightPanel } from "@/components/right-panel";
import { spring } from "@/lib/springs";
import { BellIcon, CheckIcon, FolderIcon, InfoCircleIcon, ShareIcon, SidebarLeftIcon, SidebarRightIcon, XIcon } from "@/components/icons/untitled-ui";
import SidebarNav, { SIDEBAR_EASING, SIDEBAR_MOTION_MS } from "@/components/sidebar-nav";
import { SettingsSidebarNav, type SettingsSection } from "@/components/settings-overlay";
import { useIsFullscreen, useIsTauri } from "@/hooks/use-tauri";
import { useIsMac } from "@/hooks/use-platform";
import { useIsMobile } from "@/hooks/use-media-query";
import { preloadProviderIcons, QUICK_CHAT_MODELS, ProviderIcon } from "@/lib/quick-chat-models";
import { pushTurnNotification } from "@/lib/turn-notifications";
import { loadNotifyTurnComplete, requestNotificationPermission, saveNotifyTurnComplete } from "@/lib/notify-turn-complete";
import { loadLocallyHiddenChatIds } from "@/lib/locally-hidden-chats";
import { isChatNotificationsEnabled, setChatNotificationsEnabled } from "@/lib/chat-notifications";
import { useIsSignedIn } from "@/lib/auth";
import { getUserDisplayName } from "@/lib/user";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
  DropdownLabel as BaseDropdownLabel,
  DropdownSubMenuItem,
  DropdownSubItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { MoreTrigger } from "@/components/ui/more-trigger";

// Only two real routes exist today (Home, Chat), so this is a plain
// pathname check rather than route-handle-driven breadcrumbs -- revisit
// once there are enough routes/nesting for that to actually pay for itself.
//
// chatName/onSaveChatName: the chat's own name, editable right here now --
// per explicit request, this used to be a raw `Chat · {sessionId}` label,
// with the *real*, editable name living in a second, separate bar ChatPage
// rendered directly below this one. Moving it up here (and deleting that
// second bar -- see ChatPage.tsx's own comment) means a chat has exactly
// one header row, not two stacked ones that told a viewer nothing about
// which was authoritative.
// Matches index.css's own --text-swap-dur -- the two have to agree since
// the timeout below is what actually re-triggers the CSS transition (see
// the class-toggle sequence's own comment).
const CHAT_NAME_SWAP_MS = 150;
// Sentinel for AlongsideLayout's own lastSessionIdRef -- see that ref's own
// comment; sessionId itself is a legitimate value (undefined on Home), so
// this has to be something no real sessionId (or its absence) can equal.
const NOT_YET_RUN = Symbol("not-yet-run");

// Per explicit request ("the chat name should have an effect when
// changing... where the name from untitled starts shining and changes to
// the name the agent gives") -- both halves already existed separately in
// this codebase rather than needing anything new: .t-shimmer
// (index.css's own "Transitions.dev — Shimmer text" section, already used
// by ChatPage.tsx's own waiting-phase indicator) for the "shining" while
// still "Untitled chat", and .t-text-swap (index.css's own "Transitions.dev
// — Text states swap" section, already used by compose-box.tsx's own
// AnimatedPlaceholder) for the crossfade when it actually changes. Reused
// verbatim, not reimplemented, so all three call sites share one real
// mechanism instead of three that could drift.
//
// Same imperative ref-driven three-phase sequence AnimatedPlaceholder
// itself uses (that component's own comment has the full reasoning for why
// this has to be imperative DOM mutation, not React state, to land the
// reflow at the right moment) -- adapted here to react to an external prop
// change instead of an internal timer. Renders prevNameRef.current in JSX,
// not `name` directly: React's own reconciliation would otherwise update
// the DOM text instantly the moment the `name` prop changes (before this
// effect's own delayed animation ever runs), which would make the exit
// animation play against text that's already been silently swapped to the
// new value -- exactly the snap this exists to avoid.
function ChatNameText({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevNameRef = useRef(name);

  useEffect(() => {
    const el = ref.current;
    if (!el || name === prevNameRef.current) return;
    prevNameRef.current = name;
    el.classList.add("is-exit");
    const timer = setTimeout(() => {
      el.textContent = name;
      // Shimmer only while still the placeholder -- stops the moment a
      // real name (from the agent's own auto-naming, or a manual rename)
      // actually lands.
      el.classList.toggle("t-shimmer", name === "Untitled chat");
      el.classList.remove("is-exit");
      el.classList.add("is-enter-start");
      // Force a reflow -- same reason AnimatedPlaceholder's own identical
      // line exists: without reading a layout property here, the browser
      // can coalesce the add-then-remove of .is-enter-start into one style
      // recalc, skipping straight past the jumped-to starting point instead
      // of actually painting it first.
      void el.offsetWidth;
      el.classList.remove("is-enter-start");
    }, CHAT_NAME_SWAP_MS);
    return () => clearTimeout(timer);
  }, [name]);

  return (
    <span
      ref={ref}
      data-text="Untitled chat"
      className={`t-text-swap ${prevNameRef.current === "Untitled chat" ? "t-shimmer" : ""}`}
    >
      {prevNameRef.current}
    </span>
  );
}

// Lists this chat's own saved "always allow" permission rules (scoped to
// its project if it has one, otherwise the chat itself -- server.rs's own
// list_permission_rules resolves that the same way find_permission_rule/
// create_permission_rule already do) with a delete button per row -- the
// only way to undo one of ChatPage.tsx's own PermissionCard "always allow"
// choices short of editing the database directly.
function AllowedCommandsDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rules, setRules] = useState<{ id: string; scope_type: string; tool_name: string; pattern: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/sessions/${sessionId}/permission-rules`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setRules(data);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  async function removeRule(id: string) {
    setRules((current) => current.filter((rule) => rule.id !== id));
    await fetch(`/permission-rules/${id}`, { method: "DELETE" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allowed commands</DialogTitle>
          <DialogDescription>
            Commands and file edits you chose "always allow" for -- scoped to this chat's project if it has one, otherwise just this
            chat.
          </DialogDescription>
        </DialogHeader>
        {rules.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-muted-foreground">Nothing allowed yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[13px]">
                <span className="shrink-0 text-2xs text-muted-foreground">{rule.tool_name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-foreground">{rule.pattern}</span>
                <button
                  type="button"
                  aria-label={`Remove ${rule.pattern}`}
                  onClick={() => void removeRule(rule.id)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2/50 hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PageBreadcrumb({
  chatName,
  onSaveChatName,
  models,
  active,
}: {
  chatName: string;
  onSaveChatName: (name: string) => void;
  // Mirrors the parent header's own showChatHeader -- real bug, confirmed
  // directly ("I am at Library page with no chat open and I move to new
  // chat and then the topbar changes from Library to the chat name
  // instead of fading out Library and not show anything else"): this
  // component picks its branch (Home/Library/chat-name) purely from the
  // *current* route, but the header itself stays mounted and only fades
  // its opacity out rather than unmounting (see that header's own
  // comment) -- so the instant the route changed away from /library, this
  // swapped straight to the chat-name branch (showing whatever stale
  // chatName was left over from the last real chat) for the entire
  // fade-out, instead of continuing to show "Library" the whole time
  // nothing else is visible yet. Freezing the rendered output while
  // inactive (below) instead of always deriving it live fixes this the
  // same way the header's own chatName-preservation comment already
  // fixes the analogous "leaving a chat" case -- both are really the
  // same bug (visible content briefly disagreeing with what should still
  // be showing during a fade-out), just triggered from a different route.
  active: boolean;
  // Every distinct provider/model this chat has actually used -- per
  // explicit request ("we need to add the model at the chat name like
  // the name of the sidebar has the icon of the model so that we can
  // easily see all the models in the chat"), matching sidebar-nav.tsx's
  // own SidebarModelStack. Not reused directly -- that component isn't
  // exported, matching this codebase's own established pattern (its own
  // comment: "Same overlapping-icon-stack technique as InboxPage.tsx's
  // own ModelStack... not reused directly since it isn't exported" --
  // each row gets its own small version tuned to its own width/icon size
  // rather than one shared component threading every caller's own
  // spacing needs).
  models?: { provider: string; model: string }[];
}) {
  const location = useLocation();
  const { sessionId } = useParams();
  // Click-to-edit, not a permanently-live input -- per explicit request
  // ("allow the name... to be edited by clicking at it and having a check to
  // confirm or x to cancel"). editing/draft are local: draft holds whatever's
  // being typed, chatName (the prop, this chat's real saved name) is only
  // touched on confirm, so a cancel (or clicking away) can throw the draft
  // away and land back on the real name untouched, which a single always-
  // editable input firing onSaveChatName straight from onChange couldn't do.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chatName);
  const contentRef = useRef<React.ReactNode>(null);

  function startEditing() {
    setDraft(chatName);
    setEditing(true);
  }

  function confirm() {
    onSaveChatName(draft);
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  let content: React.ReactNode;
  if (location.pathname === "/getting-started") {
    content = (
      <Breadcrumb>
        {/* text-[13px]: matches dray's own --text-ui token (0.8125rem =
            13px) -- their session-header row (SessionHeader.tsx) sets this
            once on the whole row rather than per-segment, per explicit
            request to match their font size. Overrides BreadcrumbList's
            own default text-sm (14px). */}
        <BreadcrumbList className="text-[13px]">
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  } else if (location.pathname === "/library") {
    // Real bug, confirmed directly (pasted rendered HTML showing this whole
    // header at opacity: 0 on the Library page): this header is always
    // mounted on every page -- even one with no open chat -- specifically
    // to *reserve its own real height* so opacity/visibility toggling never
    // causes a layout jump (this component's own header comment has the
    // full reasoning). LibraryPage.tsx used to build its own second, real
    // 40px header on top of that already-reserved-but-invisible space,
    // which is what actually produced "the library topbar is huge" --
    // never a border or padding bug, two real headers stacked. The fix is
    // this branch, not more CSS on Library's own page: reuse this same
    // reserved slot instead of adding another one.
    content = (
      <Breadcrumb>
        {/* pl-2 on top of the header's own pl-2 (its <header> above) --
            per explicit request ("give the top bar title... the same
            indentation as the describer so it looks aligned"): matches
            LibraryPage.tsx's own left column, whose "Projects"/"Chats"
            labels sit at px-2 (the column) + px-2 (the label row) = 16px
            from the page edge, while this title otherwise only had the
            header's own 8px. */}
        <BreadcrumbList className="pl-2 text-[11px]">
          <BreadcrumbItem>
            <BreadcrumbPage>Library</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  } else {
    content = (
    <Breadcrumb>
      {/* No "Home >" leading crumb any more -- per explicit request: projects are
          real data now (GET /projects, backend/src/server.rs -- the SQLite
          migration), but there's still no real per-project route/page (only a
          placeholder ProjectsPage) or a way to actually assign a chat to one, so
          every chat still sits at the top level on its own. "Home" isn't a
          project, and showing it as a fake parent for every chat was wrong
          regardless. Just the title itself now, same as a chat that *does*
          belong to a real project would still show past its own project's
          name once that assignment exists. */}
      {/* text-[11px], down from 13px -- per explicit follow-up ("the chat
          name should be reduce to match the font size at icon + library
          and icon + terminal"): matches the right panel's own Library/
          Terminal pill labels (right-panel.tsx, reduced to 11px in the
          same pass). */}
      <BreadcrumbList className="text-[11px]">
        <BreadcrumbItem>
          {/* Model icon stack -- per explicit request ("we need to add
              the model at the chat name like the name of the sidebar has
              the icon of the model so that we can easily see all the
              models in the chat"), overlapping with a real 1px ring per
              a follow-up ("the models... should be stacked with a 1px
              border that's the same color as our bg"), matching sidebar-
              nav.tsx's own SidebarModelStack (that component's own
              comment has the full precedent chain back to
              InboxPage.tsx's ModelStack/ui/avatar.tsx's AvatarGroup).
              size-4 icon inside a slightly larger circle, one step up
              from SidebarModelStack's own size-3 (this row has more
              breathing room to spend it in).
              Real overflow handling, not just a silent slice(0, 2) --
              per a further explicit follow-up ("that only shows 2
              providers... we should show up to 4 providers but stacked
              and then if we get more then we do all the 3 stacked and
              fourth be the number of providers in total so when someone
              hovers over it then a popover shows all the providers"):
              up to 4 real icons when that's everything; past 4, only the
              first 3 are real provider icons and the 4th slot is the
              real total count (not "+N" remaining, the actual number of
              providers this chat has used) instead of a 4th icon.
              Wrapped in a HoverCard either way so hovering always shows
              the complete real list, including ones the stack itself
              never had room to show a icon for. */}
          {models && models.length > 0 && (
            <HoverCard openDelay={150} closeDelay={0}>
              <HoverCardTrigger asChild>
                <span className="mr-1 flex shrink-0 -space-x-1 align-middle">
                  {(models.length > 4 ? models.slice(0, 3) : models.slice(0, 4)).map((entry, index) => {
                    const found = QUICK_CHAT_MODELS.find((m) => m.value === entry.model);
                    if (!found) return null;
                    return (
                      <span
                        key={`${entry.provider}-${entry.model}`}
                        className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-background"
                        style={{ zIndex: models.length - index }}
                      >
                        <ProviderIcon model={found} className="size-4" />
                      </span>
                    );
                  })}
                  {models.length > 4 && (
                    <span
                      className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-hover-2 text-[9px] font-medium text-muted-foreground ring-1 ring-background"
                      style={{ zIndex: 0 }}
                    >
                      {models.length}
                    </span>
                  )}
                </span>
              </HoverCardTrigger>
              <HoverCardContent align="start" className="w-auto p-1.5">
                <div className="flex flex-col gap-1">
                  {models.map((entry) => {
                    const found = QUICK_CHAT_MODELS.find((m) => m.value === entry.model);
                    return (
                      <div key={`${entry.provider}-${entry.model}`} className="flex items-center gap-1.5 text-xs text-foreground">
                        {found && <ProviderIcon model={found} className="size-3.5 shrink-0" />}
                        <span className="truncate">{found?.label ?? entry.model}</span>
                      </div>
                    );
                  })}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          {/* No more `sessionId ? ... : <BreadcrumbPage>Untitled chat</BreadcrumbPage>`
              branch -- confirmed directly as the real cause of "this changing
              to Untitled and is moving to the left a bit... happens when
              leaving an existing chat": that branch swapped this whole
              breadcrumb over to a completely different element (a static
              BreadcrumbPage, different padding than the button it replaced)
              the instant sessionId cleared -- ignoring the chatName the
              parent was already correctly freezing during the header's own
              fade-out (that state's own comment), and both hard-coding the
              literal text "Untitled chat" *and* shifting the whole label
              left because BreadcrumbPage's own padding differs from the
              button's px-1. The header itself is always mounted now (see
              that element's own comment) and non-interactive while
              invisible (pointer-events-none), so there's no reason left for
              this to render differently depending on whether a session is
              currently open -- it can always be the same button/ChatNameText
              structure below, driven by chatName exactly like every other
              case already is. */}
          {(
            editing ? (
              <div className="flex items-center gap-0.5">
                {/* id="chatNameInput" -- read by ChatPage's own WebSocket
                    handler (receiveChatNameFromServer) to avoid overwriting
                    whatever's mid-edit here if a chat_name_updated event
                    arrives while this is open. onBlur falls back to cancel
                    (clicking away from the input with neither button) --
                    safe against the confirm/cancel buttons themselves
                    stealing focus first, since both preventDefault on
                    mousedown (below) rather than letting the click blur
                    this input at all. */}
                <Input
                  id="chatNameInput"
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={(event) => event.target.select()}
                  onBlur={cancel}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirm();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancel();
                    }
                  }}
                  // md:text-[13px], not just text-[13px] -- ui/input.tsx's own base
                  // classes carry md:text-sm (14px), which wins over a plain
                  // text-[13px] at this app's real widths (always past md) since
                  // twMerge doesn't collapse a bare utility against a differently-
                  // scoped md: variant. Same bug/fix as sidebar-nav.tsx's own
                  // search input (that file's own comment has the full reasoning) --
                  // without this, "Home" (13px, no competing md: class) and the
                  // chat title (14px, md:text-sm winning) rendered at visibly
                  // different sizes.
                  // dark:bg-transparent, not just bg-transparent -- same bug/fix as the
                  // md:text-[13px] above: ui/input.tsx's own base classes carry
                  // dark:bg-input/30, which wins over a plain bg-transparent in dark
                  // mode since twMerge doesn't collapse a bare utility against a
                  // differently-scoped dark: variant. Confirmed directly as the real
                  // cause of a visible background color on this input specifically in
                  // dark mode.
                  className="h-6 w-48 border-none bg-transparent px-1 text-[11px] font-normal text-foreground shadow-none focus-visible:ring-0 md:text-[11px] dark:bg-transparent"
                />
                <button
                  type="button"
                  aria-label="Confirm chat name"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={confirm}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-hidden hover:bg-hover-2/50 hover:text-foreground"
                >
                  <CheckIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel editing chat name"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={cancel}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-hidden hover:bg-hover-2/50 hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ) : (
              // Click to edit -- per explicit request. Not a BreadcrumbPage (a
              // role="link" aria-disabled span, not something clickable) --
              // a plain button instead, matching the editing Input's own
              // size/padding so nothing shifts position when toggling
              // between the two.
              // text-[11px], not 13px -- real bug, confirmed directly via
              // a follow-up screenshot ("The chat name still pretty big
              // compared to library and terminal"): this button's own
              // explicit text-[13px] overrode the parent BreadcrumbList's
              // text-[11px] (above) outright, since it's set directly on
              // the element rather than inherited -- reducing the parent
              // alone was never going to reach this.
              <button
                type="button"
                onClick={startEditing}
                className="h-6 max-w-48 truncate rounded px-1 text-left text-[11px] font-normal text-foreground hover:bg-hover-2/50"
              >
                {/* key={sessionId} -- confirmed directly as a real bug
                    ("switching from new chat to an existing chat quickly
                    shows Untitled chat, then it plays again the initial
                    transition... this should only happen once"): without a
                    key, this same component instance carries over across a
                    chat switch, so its own prevNameRef still held the
                    *previous* chat's name (or "Untitled chat", coming from
                    Home) the moment `chatName` above already jumped straight
                    to the new chat's real, already-known name (this file's
                    own recents-lookup reset effect) -- which made ChatNameText
                    play its shimmer-then-swap transition on every single chat
                    open, not just the one real "agent just named this chat"
                    moment it's meant for. Keying by sessionId remounts it on
                    every chat switch, which resets its own prevNameRef to
                    the correct name immediately (no animation, via its
                    useRef initializer) -- the animated crossfade still plays
                    normally for a name change *within* the same session
                    (live auto-naming, a manual rename), since the instance
                    isn't remounted for those. */}
                <ChatNameText key={sessionId} name={chatName} />
              </button>
            )
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
    );
  }

  // Freeze the rendered output while inactive instead of always returning
  // freshly-derived content -- see the `active` prop's own comment above
  // for the real bug this fixes (Library -> New Chat briefly showing a
  // stale chat name instead of continuing to show "Library" for the
  // header's whole fade-out). Only updates while active, so the frozen
  // value is always whatever was last genuinely visible.
  if (active) contentRef.current = content;
  return contentRef.current ?? content;
}

// Code/Design -- reached from the compose box's own Chat/Code/Design
// switcher now (compose-box.tsx; the top bar these used to live in is gone
// entirely, per explicit request), not a sidebar destination, so the
// sidebar itself has no real navigation state for either. SidebarNav swaps
// its own top rows to a generic placeholder while on one of these (see
// that component's own placeholderNav prop). Agent used to be in this list
// too -- it's a real sidebar destination now (NAV_ITEMS' own "Agents" row,
// sidebar-nav.tsx), so it no longer triggers the placeholder rail.
const PLACEHOLDER_NAV_ROUTES = ["/code", "/design"];

// Every route reached from the avatar dropdown (Settings/Docs/Help/Models)
// -- these read as a separate, full-page area outside the main app shell
// (same idea as a "Settings" screen in most apps), so the sidebar doesn't
// render at all here rather than showing a placeholder-ified version of
// it. The content column is already `position: absolute; inset: 0`
// spanning the row's full width regardless of the sidebar (see that
// element's own comment below), so simply not rendering SidebarNav is
// enough for the content to take the full width on its own -- no other
// layout change needed.
// "/settings" itself dropped (settings now swaps the sidebar instead of
// hiding it -- see the sidebar render below) -- exact-match routes only,
// checked against location.pathname directly, so this deliberately does
// NOT match /settings/:section's own prefix.
// "/models" dropped too -- that page moved under /settings (per explicit
// request), so isSettingsRoute's own sidebar swap covers it now instead
// of this list.
const SIDEBAR_HIDDEN_ROUTES = ["/docs", "/help"];
// The four real SettingsSection nav destinations -- same list
// SettingsPage.tsx's own VALID_SECTIONS keeps, duplicated rather than
// shared since each file's own fallback behavior differs slightly.
const SETTINGS_NAV_SECTIONS: SettingsSection[] = ["profile", "general", "appearance", "chat", "provider", "apps"];

export function AppLayout() {
  // Quick chat/Memory/Share/members only make sense once there's an actual
  // chat open -- they're all chat-scoped concepts (which model this chat
  // uses, this chat's memory, sharing *this* chat, who's *in* this chat),
  // so showing them on Home (no chat open yet) was offering controls with
  // nothing real for them to act on.
  const { sessionId } = useParams();
  const hasOpenChat = Boolean(sessionId);
  const location = useLocation();
  // Real bug, confirmed directly (pasted rendered HTML showing this
  // header at opacity: 0 on Library): this header stays mounted and
  // reserved-but-invisible on every page without an open chat, so a
  // second page (LibraryPage.tsx) building its own separate header
  // stacked a real, visible header underneath an already-reserved
  // invisible one -- two headers, not a padding/border bug. Library now
  // reuses this same slot (PageBreadcrumb's own /library branch) instead
  // of building a second one, so this header needs to actually show
  // (not just reserve space) on that route too.
  const showChatHeader = hasOpenChat || location.pathname === "/library";
  const navigate = useNavigate();
  // Gates only the chat header's own Share action below -- per explicit
  // request/correction ("we should not gate the send because they don't
  // have an account. We will gate only share because that requires an
  // account for user management at chats").
  const isSignedIn = useIsSignedIn();
  // Real React state, not a plain isChatNotificationsEnabled(sessionId)
  // call read fresh on every render -- that read the right value on the
  // menu's *next* open, but toggling it wouldn't flip the label inside the
  // same open menu, since writing to localStorage alone doesn't trigger a
  // re-render. Re-synced whenever sessionId changes so switching chats
  // doesn't carry over the previous chat's own toggle state.
  const [chatNotifyEnabled, setChatNotifyEnabledState] = useState(
    () => !!sessionId && isChatNotificationsEnabled(sessionId)
  );
  useEffect(() => {
    setChatNotifyEnabledState(!!sessionId && isChatNotificationsEnabled(sessionId));
  }, [sessionId]);
  // Persisted "always allow" permission rules (real reference screenshot's
  // own "Yes, allow ... for this project" choice, ChatPage.tsx's own
  // PermissionCard) -- surfaced here, in the same "..." menu Share chat/
  // Add to project already live in, since there's otherwise no way to ever
  // undo a saved rule short of editing the database directly.
  const [allowedCommandsOpen, setAllowedCommandsOpen] = useState(false);
  // Chat header's own "..." menu -- "Add to project" -- per explicit
  // request ("the chat three dots at the sidebar and at the top right
  // icons should allow us to attach the chat an existing project or new
  // project"), same actions sidebar-nav.tsx's own ChatRow menu already has.
  // Existing projects only -- per direct follow-up ("remove new project
  // from add to project").
  async function assignChatToProject(projectId: string | null) {
    if (!sessionId) return;
    await fetch(`/sessions/${sessionId}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    void refreshSidebarLists();
  }
  // Once, at the real top of the app (this layout mounts for every route) --
  // see quick-chat-models.tsx's own preloadProviderIcons comment for why.
  useEffect(() => {
    preloadProviderIcons();
  }, []);
  // Requests the OS notification permission proactively at startup, not
  // only when the user happens to visit Settings and toggle the switch --
  // now that loadNotifyTurnComplete defaults to true for a fresh install
  // (notify-turn-complete.ts's own comment has the full reasoning), the
  // feature needs the real OS permission granted from the very first
  // launch for that default to actually do anything. Idempotent to call
  // on every app start: requestNotificationPermission short-circuits to
  // true without re-prompting once already granted, and the OS itself
  // doesn't re-prompt after a past denial either. A denial here saves the
  // setting back to false, same as a denial from the Settings toggle
  // itself (setNotifyEnabled, settings-overlay.tsx) -- so the switch
  // reflects reality the next time Settings is opened, instead of showing
  // "on" with no way to ever actually notify.
  useEffect(() => {
    if (!loadNotifyTurnComplete()) return;
    void requestNotificationPermission().then((granted) => {
      if (!granted) saveNotifyTurnComplete(false);
    });
  }, []);
  // Backfills a turn-complete notification for a chat that finished while
  // its own ChatPage wasn't mounted to see it happen live -- real gap,
  // confirmed directly ("I purposely created multiple chats without
  // waiting for the AI to reply and those did not register as a
  // notification"): ChatPage.tsx's own notification push only runs from
  // that specific chat's own WebSocket "result" handler, which tears down
  // the moment its page unmounts (navigating to create another chat, say)
  // -- the turn itself still finishes and persists server-side (visible
  // once you reopen it), but nothing client-side was left listening to
  // notice. Polling /inbox-items (already has last_activity + a snippet +
  // who sent it) every 6s and diffing against what this ref last saw
  // catches that case too, without needing a real per-user push channel.
  // Skips the currently-open chat entirely -- that one's own ChatPage
  // already handles its own notification (with its own, more precise
  // "was this window actually focused" check) the moment it happens live;
  // this is purely a backstop for chats that aren't the one on screen.
  const lastSeenActivityRef = useRef<Map<string, string>>(new Map());
  // Read inside poll() below via this ref, not the `location` closed over
  // by the effect's own [] deps (which would stay pinned to whatever route
  // was current the moment this effect first ran) -- keeps the "skip the
  // currently-open chat" check correct across navigation without tearing
  // the polling interval down and rebuilding it on every route change.
  const currentPathnameRef = useRef(location.pathname);
  useEffect(() => {
    currentPathnameRef.current = location.pathname;
  }, [location.pathname]);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch("/inbox-items").catch(() => null);
      if (!res?.ok || cancelled) return;
      const items: {
        id: string;
        name: string;
        model: string | null;
        last_activity: string | null;
        snippet_kind: "human" | "assistant" | null;
      }[] = await res.json();
      if (cancelled) return;
      // Real bug, confirmed directly ("the untitled chat when creating one
      // chat and moving to another new chat to create only updates after
      // the new untitled chat reaches the sidebar"): the sidebar's own
      // chat list (SidebarNav's `recents` prop, refreshSidebarLists below)
      // has exactly the same "nothing refetches it in the background" gap
      // as the notification backfill above -- a chat's real auto-generated
      // title only ever reached the sidebar as a side effect of some OTHER
      // action calling refreshSidebarLists (creating a second chat, say),
      // never on its own. Refreshed unconditionally on every poll tick
      // (not gated on loadNotifyTurnComplete -- that setting has nothing
      // to do with whether chat names are current), catching a rename
      // that landed while its own chat wasn't the open page.
      let anyRenamed = false;
      for (const item of items) {
        const seen = lastSeenActivityRef.current.get(item.id);
        lastSeenActivityRef.current.set(item.id, item.last_activity ?? "");
        const notifyEnabled = loadNotifyTurnComplete();
        if (notifyEnabled && item.last_activity && seen !== undefined && seen !== item.last_activity) {
          if (item.snippet_kind === "assistant" && currentPathnameRef.current !== `/chat/${item.id}`) {
            const model = item.model ? QUICK_CHAT_MODELS.find((m) => m.value === item.model) : undefined;
            pushTurnNotification({
              chatId: item.id,
              chatName: item.name,
              modelLabel: model?.label ?? item.model ?? "",
              timestamp: Date.now(),
            });
          }
        }
        if (seen !== undefined && seen !== item.last_activity) anyRenamed = true;
      }
      if (anyRenamed) void refreshSidebarLists();
    }
    void poll();
    const interval = setInterval(() => void poll(), 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  // Mirrors SidebarNav's own internal collapsed state (via its
  // onCollapsedChange callback -- collapsed itself still isn't a
  // controlled prop, see that component's own top comment) purely so
  // this layout knows whether to show the standalone toggle below.
  // Always matches sidebarCollapsed now -- per explicit request, Tauri
  // and web collapse the same way (SidebarNav's own fullyCollapsed
  // comment has the full reasoning); this and that value need to keep
  // agreeing on when the sidebar is actually gone (width 0), since the
  // standalone toggle exists specifically to undo that.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // !isMobile -- must agree with SidebarNav's own fullyCollapsed (that
  // component's own comment has the full reasoning): mobile's "collapsed"
  // means its drawer is closed, not fully hidden to width 0, so this
  // layout's own standalone re-expand button below must stay hidden
  // there too, not just on desktop.
  const isMobile = useIsMobile();
  const sidebarFullyCollapsed = sidebarCollapsed && !isMobile;
  // Only still needed for the standalone re-expand button's own left
  // offset below (clearing macOS's real traffic lights on the desktop
  // app) -- no longer part of deciding *whether* the sidebar fully
  // collapses, which now happens the same way on every platform.
  const isTauriApp = useIsTauri();
  const isMac = useIsMac();
  const fullscreen = useIsFullscreen();
  const trafficLightsVisible = isTauriApp && isMac && !fullscreen;
  // Bumped to re-expand SidebarNav from outside it -- see that
  // component's own expandSignal prop comment for why a signal, not a
  // controlled value.
  const [sidebarExpandSignal, setSidebarExpandSignal] = useState(0);
  // Settings is a real route now (/settings/:section, App.tsx), not a modal
  // -- per explicit request ("i want a full page setting page", matching
  // Synara's own structure exactly). openSettings just navigates there;
  // reachable from the sidebar's own account menu (onOpenSettings, threaded
  // into SidebarNav below) and from any routed page via useOutletContext
  // (WelcomePage's own "Initial setup" row opens straight to "provider").
  // isSettingsRoute drives the sidebar swap further down.
  const isSettingsRoute = location.pathname.startsWith("/settings");
  // /settings/provider/usage (the Provider usage page, ModelsPage.tsx) is
  // a real settings route but not one of SettingsSection's own values --
  // it's a drill-in page reached from the Provider page's own Usage card,
  // not a top-level nav destination with its own row to highlight, same
  // treatment ProviderConnectionView's own drill-in already gets. Its
  // second segment is "provider", the same value the real Provider
  // section itself uses (settings-overlay.tsx's own SettingsSection,
  // singular per explicit request -- "http://localhost:5173/settings/providers
  // should be provider"), so the plain includes() check below already
  // highlights Provider as active for this drill-in page too, with no
  // separate special case needed (a previous version of this logic had
  // one, back when the section key was still "providers" and didn't
  // match this route's own "provider" segment). Any other unrecognized
  // segment still falls back to "general" rather than passing through an
  // invalid value, same guard SettingsPage.tsx's own VALID_SECTIONS check
  // uses.
  const rawSettingsSegment = location.pathname.split("/")[2];
  const activeSettingsSection = SETTINGS_NAV_SECTIONS.includes(rawSettingsSegment as SettingsSection)
    ? (rawSettingsSegment as SettingsSection)
    : "general";
  const openSettings = (section: SettingsSection) => navigate(`/settings/${section}`);
  // Lifted up from ChatPage (per explicit request -- see PageBreadcrumb's
  // own comment above): this is the one place a chat's name now lives,
  // since it's rendered here (the breadcrumb) rather than in a second bar
  // ChatPage used to render itself. lastSavedChatNameRef, same role it had
  // in ChatPage -- dedupes saveChatName's own POST so re-focusing and
  // blurring the input without actually changing the text doesn't refire
  // the request.
  const [chatName, setChatName] = useState("Untitled chat");
  const lastSavedChatNameRef = useRef("Untitled chat");
  // NOT_YET_RUN, not sessionId's own initial value -- sessionId is
  // legitimately undefined on Home, so seeding this ref with it directly
  // would make the very first render (a page load/refresh landing straight
  // on an existing chat's own URL) look like "nothing changed" and skip the
  // lookup below entirely, leaving chatName stuck on its own "Untitled
  // chat" default instead of resolving the real name on first load.
  const lastSessionIdRef = useRef<string | undefined | typeof NOT_YET_RUN>(NOT_YET_RUN);
  // Real chats/projects now (GET /sessions, GET /projects -- the SQLite
  // migration's own new endpoints, backend/src/server.rs), not the sample
  // data SAMPLE_RECENTS/SIDEBAR_PROJECTS (this file's own comment further
  // down, lib/sample-recents.ts) used to be. Refetched on mount and on every
  // sessionId change (a newly created chat, or navigating between two
  // existing ones, both need this list current) and after this tab's own
  // rename actually lands (saveChatName below) or one arrives from the
  // server (receiveChatNameFromServer below) -- a rename doesn't otherwise
  // have any other reason to refetch.
  const [recents, setRecents] = useState<
    {
      id: string;
      label: string;
      creatorName?: string | null;
      projectId?: string | null;
      // Already fetched below (models: c.models) but missing from this
      // type until now -- needed for PageBreadcrumb's own model icon
      // stack, per explicit request ("we need to add the model at the
      // chat name... so that we can easily see all the models in the
      // chat").
      models?: { provider: string; model: string }[];
    }[]
  >([]);
  const [sidebarProjects, setSidebarProjects] = useState<{ id: string; label: string }[]>([]);
  async function refreshSidebarLists() {
    const [sessionsRes, projectsRes] = await Promise.all([fetch("/sessions"), fetch("/projects")]);
    // Both .json() bodies parsed together (Promise.all), not one `await`ed
    // and applied (setRecents) before the other's parse even starts --
    // confirmed directly as the cause of a real visible bug ("the projects
    // is not loading together with the page, that snaps later once the
    // page is loaded"): the previous sequential awaits meant setRecents
    // and setSidebarProjects landed as two separate React commits whenever
    // the second body took any measurably longer to parse than the first,
    // so Chats appeared to populate first and Projects visibly popped in
    // after. Resolving both bodies first means both setState calls happen
    // back to back in the same synchronous block, batching into one commit.
    const [chats, projectsJson] = await Promise.all([
      sessionsRes.ok
        ? (sessionsRes.json() as Promise<
            {
              id: string;
              name: string;
              creator_name?: string | null;
              project_id?: string | null;
              models?: { provider: string; model: string }[];
            }[]
          >)
        : Promise.resolve(null),
      projectsRes.ok ? (projectsRes.json() as Promise<{ id: string; name: string }[]>) : Promise.resolve(null),
    ]);
    if (chats) {
      const hidden = loadLocallyHiddenChatIds();
      setRecents(
        chats
          .filter((c) => !hidden.has(c.id))
          .map((c) => ({ id: c.id, label: c.name, creatorName: c.creator_name, projectId: c.project_id, models: c.models }))
      );
    }
    if (projectsJson) {
      setSidebarProjects(projectsJson.map((p) => ({ id: p.id, label: p.name })));
    }
  }
  useEffect(() => {
    void refreshSidebarLists();
  }, [sessionId]);
  // Adjusts chatName the moment sessionId itself changes -- during render,
  // not a useEffect -- per React's own documented "adjusting state when a
  // prop changes" pattern (comparing against a ref of the previous value).
  // Confirmed directly as the fix a useEffect-based reset couldn't give:
  // an effect only runs *after* commit, so ChatNameText (keyed by sessionId
  // just above, in PageBreadcrumb) would already have mounted fresh with
  // whichever *stale* chatName value was still sitting in state from the
  // previous chat, and only get corrected a tick later -- which is exactly
  // what still played its shimmer/crossfade transition on every single chat
  // open ("still playing the transition animation when we enter an existing
  // chat"), since from that mounted instance's own perspective its `name`
  // prop genuinely changed after mount. Doing this adjustment in the render
  // body instead means the corrected value is already in place on the very
  // same commit the new key mounts against, so there's nothing left for
  // ChatNameText's own prop-change effect to react to.
  // Only actually resets when sessionId truly points at a real session --
  // leaving one entirely (sessionId -> undefined, back to Home) deliberately
  // leaves chatName/lastSavedChatNameRef untouched, still showing whichever
  // real chat's name was last open, for as long as the header itself (now
  // always mounted, see that element's own comment) is still fading out.
  // Confirmed directly as the other half of this same bug report ("when
  // leaving that name goes to Untitled chat before fading out") -- resetting
  // unconditionally swapped the *visible* text to "Untitled chat" the
  // instant sessionId cleared, mid-fade, well before Home (which never
  // shows this header at all) was actually what the user was looking at.
  if (sessionId !== lastSessionIdRef.current) {
    lastSessionIdRef.current = sessionId;
    if (sessionId) {
      const known = recents.find((r) => r.id === sessionId)?.label ?? "Untitled chat";
      if (known !== chatName) setChatName(known);
      lastSavedChatNameRef.current = known;
    }
  }

  async function saveChatName(name: string) {
    const trimmed = name.trim() || "Untitled chat";
    setChatName(trimmed);
    if (!sessionId || trimmed === lastSavedChatNameRef.current) return;
    lastSavedChatNameRef.current = trimmed;
    await fetch(`/sessions/${sessionId}/name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    void refreshSidebarLists();
  }

  // Called by ChatPage's own WebSocket handler on a chat_name_updated
  // event -- a name change arriving from the server (another
  // collaborator's rename, or this same edit echoed back), not something
  // to POST again (hence updating lastSavedChatNameRef directly instead of
  // going through saveChatName, which would re-fire the request). The
  // document.activeElement check guards against a live edit in progress
  // here getting clobbered by a same-tick echo of the *previous* value.
  function receiveChatNameFromServer(name: string) {
    lastSavedChatNameRef.current = name;
    setChatName((current) => (document.activeElement?.id === "chatNameInput" ? current : name));
    void refreshSidebarLists();
  }
  // useOutlet(), captured once per render into a plain element, not
  // <Outlet/> rendered directly inside the AnimatePresence child below --
  // <Outlet/> is a live context consumer, so the *still-exiting* old
  // motion.div's own <Outlet/> would keep tracking the router's current
  // (already-changed) route during its own exit animation, mounting the
  // *new* page early inside the *old*, about-to-unmount wrapper -- which
  // then unmounts it again the moment that exit finishes, right before
  // the real new-keyed motion.div mounts it a second time. Confirmed
  // directly (mount/unmount logging on PlaceholderPage): a single
  // navigation was mounting it, unmounting it, then mounting it again,
  // which is exactly the extra fade-to-black-and-back the transition
  // visibly showed. Capturing the outlet element once here means the
  // exiting motion.div keeps whatever element it was already given
  // (the old page), since a plain element reference doesn't re-subscribe
  // to route context the way the <Outlet/> component does.
  // Right-side editor panel (issue #288, phase 1) -- lifted up here (not
  // local state in ChatPage.tsx/LibraryPage.tsx) since it needs to render
  // beside <Outlet/> itself, outside either page's own content, and
  // survive a route change between them. Threaded into every page the
  // same way chatName/openSettings/etc. already are (useOutletContext),
  // not a separate React Context -- this file's own established pattern.
  // Two real modes now, not just an open file -- per explicit follow-up
  // ("When we click the sidebar at right that should open the library of
  // this chat and show multiple files/ one per row file and when i click
  // at it i should be able to see, edit and save changes to the file"):
  // "list" shows this one chat's own files (GET /library, filtered to
  // this chatId -- the same real data Library's own page already shows
  // globally), "file" is the existing single-file editor.
  //
  // Real back/forward history + persisted position, per a later explicit
  // follow-up ("beside the x at the right we should have the <> buttons
  // so we can navigate from library to files and come back and when
  // collapsing the right sidebar that should save the state we were at,
  // example i was reading the example.md and i collapsed and opened
  // again, should be in the same place"): panelNav is a real, small
  // history stack (like browser back/forward) that survives closing the
  // panel (panelVisible false) -- only a real chat switch (the effect
  // below) resets it, since an old file/list from a *different* chat
  // wouldn't mean anything once you've navigated away.
  type RightPanelEntry = { type: "list"; chatId: string } | { type: "file"; path: string };
  const [panelNav, setPanelNav] = useState<{ history: RightPanelEntry[]; index: number }>({ history: [], index: -1 });
  const [panelVisible, setPanelVisible] = useState(false);
  const rightPanel = panelVisible ? (panelNav.history[panelNav.index] ?? null) : null;

  useEffect(() => {
    setPanelNav({ history: [], index: -1 });
    setPanelVisible(false);
  }, [sessionId]);

  // Real bug, confirmed directly ("when I open the file at library and
  // move to new chat, that stays open, it should stay open at library
  // page only"): the effect above only resets on a real sessionId change,
  // but Library and New Chat both have no sessionId at all (undefined on
  // both), so leaving Library for New Chat never tripped it -- a file
  // opened from Library kept showing in the panel on a page that has
  // nothing to do with it. Checked directly against location.pathname
  // (not the isLibraryRoute const further below, which is declared after
  // this point in the function) -- fires exactly when leaving /library.
  useEffect(() => {
    if (location.pathname !== "/library") {
      setPanelNav({ history: [], index: -1 });
      setPanelVisible(false);
    }
  }, [location.pathname]);

  function navigateRightPanel(entry: RightPanelEntry) {
    setPanelNav(({ history, index }) => ({ history: [...history.slice(0, index + 1), entry], index: index + 1 }));
    setPanelVisible(true);
  }
  function rightPanelGoBack() {
    setPanelNav(({ history, index }) => ({ history, index: Math.max(0, index - 1) }));
  }
  function rightPanelGoForward() {
    setPanelNav(({ history, index }) => ({ history, index: Math.min(history.length - 1, index + 1) }));
  }
  function onRightPanelClose() {
    // Hides without clearing history/index -- per the same explicit
    // request, reopening (the header icon below) should land back on
    // exactly this same spot, not reset to the chat's own file list.
    setPanelVisible(false);
  }

  // Real drag-resize (mouse-driven width state), not react-resizable-panels
  // -- per explicit request ("make sure we are using the same drawer
  // transition as the left sidebar collapse"): the left sidebar's own open/
  // close is a plain CSS width transition (SIDEBAR_MOTION_MS/SIDEBAR_EASING,
  // sidebar-nav.tsx's own <aside>), not react-resizable-panels, and that
  // library's own mount/unmount-driven open/close had no such transition at
  // all -- it just appeared/disappeared at whatever percentage width the
  // library computed. Switching the open/close animation to that same
  // width-transition technique meant dropping that library's own drag-resize
  // for this panel in favor of a small manual equivalent below, so resizing
  // still works.
  const [rightPanelWidth, setRightPanelWidth] = useState(420);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  // LibraryPage.tsx's own main column only ever holds its own w-64 project/
  // chat sidebar -- real bug, confirmed directly via screenshot: opening a
  // file there left a large empty gap between that sidebar and the
  // (normally narrow) right panel, since the panel kept its ordinary fixed
  // chat-editing width instead of using the space Library has nothing else
  // to put there. Shrinking mainContent to exactly LibraryPage's own
  // sidebar width (not to 0 -- a first pass at this collapsed the sidebar
  // itself too, hiding it behind the now full-width panel instead of
  // keeping it visible alongside the file) lets the right panel absorb
  // everything past it, on this one route only -- a real open chat still
  // needs that middle column for its own conversation.
  const isLibraryRoute = location.pathname === "/library";
  const libraryFullPanel = isLibraryRoute && rightPanel !== null;
  // Must match LibraryPage.tsx's own left column ("w-64").
  const LIBRARY_SIDEBAR_WIDTH = 256;

  // Real bug, confirmed directly ("we need our transition again when
  // opening the file, the right sidebar should transition like it does
  // on chat"): mainContent/the right panel below normally transition
  // between two explicit pixel widths (that's what actually makes the
  // width change animatable at all -- see this file's own comments on
  // the right panel's width style). On Library, mainContent's own two
  // states are "flex-1" (an implicit, auto-computed width) and a literal
  // 256px, and there's nothing to interpolate *from* a flex-1 box's
  // width isn't a real authored value CSS can transition. Measuring the
  // actual available row width (this row's own real pixel width, minus
  // nothing else -- it already excludes the left sidebar just by being
  // its flex sibling) turns that implicit state into a real number too,
  // so both Library states become plain pixel-to-pixel transitions like
  // every other width animation in this file already is.
  const contentRowRef = useRef<HTMLDivElement>(null);
  const [contentRowWidth, setContentRowWidth] = useState(0);
  useEffect(() => {
    const el = contentRowRef.current;
    if (!el) return;
    const update = () => setContentRowWidth(el.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const rightPanelTargetWidth = isLibraryRoute
    ? rightPanel
      ? Math.max(0, contentRowWidth - LIBRARY_SIDEBAR_WIDTH)
      : 0
    : rightPanel
      ? rightPanelWidth
      : 0;

  function startRightPanelResize(event: React.MouseEvent) {
    event.preventDefault();
    setIsResizingRightPanel(true);
    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    function onMove(moveEvent: MouseEvent) {
      setRightPanelWidth(Math.min(800, Math.max(320, startWidth - (moveEvent.clientX - startX))));
    }
    function onUp() {
      setIsResizingRightPanel(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const outlet = useOutlet({
    chatName,
    receiveChatNameFromServer,
    openSettings,
    refreshSidebarLists,
    openFile: (path: string) => navigateRightPanel({ type: "file", path }),
    // Per explicit request ("The right sidebar is not expanding enough, it
    // should expand to compact the chat message so instead of being 800px
    // default that be 400px with the sidebar open") -- ChatPage.tsx reads
    // this to swap its own message-column/compose-box max-width down to
    // 400px while the panel is open, instead of leaving the normal
    // Standard/Expanded --chat-max-width (index.css/use-appearance-
    // settings.ts) unchanged and just letting the panel fight it for
    // space via the resizable split alone.
    rightPanelOpen: rightPanel !== null,
  });
  const mainContent = (
    <>
          {/* max-w-[1440px]/mx-auto: caps how far the main content area
              (both this chat-scoped bar and every page below, via Outlet)
              can stretch to the sides on a wide window -- without this,
              pages ran fully edge-to-edge with no ceiling, which felt
              increasingly empty/stretched-out the wider the window got.
              One shared cap here instead of every page re-deriving its
              own (pages can still cap their own inner content further/
              differently within this, same as HomePage's own greeting
              column and ChatPage's own message width already do).
              A fixed pixel ceiling, not a percentage (lg:max-w-[75%],
              tried first, even with a transition -- see this file's own
              git history) -- 75% of a window is mathematically always
              narrower than 100% of that *same* window, so switching from
              full-width to any percentage cap is inherently a step down
              with no continuous path between them, however that step
              itself gets animated. Live-dragging the window wider kept
              re-triggering that same step every frame while still below
              the breakpoint (racing to 100% of a constantly growing
              width), so the eventual snap down to 75% read as an
              overshoot-then-correct rather than a clean stop. A fixed
              width has no such discontinuity: content just grows 1:1
              with the window below 1440px and stops -- literally nothing
              changes -- once it's wide enough to hit that ceiling, so
              there's no jump to animate away in the first place.
              Plain mx-auto centering now, no translateX/dynamic maxWidth
              (tried first) -- those existed only to match this column's
              own center to the top bar's own search box, which no longer
              lives there (sidebar-nav.tsx's own SidebarSearch, per
              explicit request) and needed no such compensation itself.
              With nothing left off-center to match, this just centers on
              the true window width directly. */}
          {/* The chat-scoped bar below (breadcrumb, Quick chat, Memory/Share,
              members) is separate from the global TopBar above -- it only
              has anything real to show once a chat is open, the breadcrumb
              it carries has nothing real to show on Home (no chat open
              yet).
              Always mounted now, never conditionally added/removed -- per
              explicit request ("remove completely this up and down
              animation... all component pages should have the top bar but
              invisible to hold items in there... never do this up and down
              animation, only fade out and fade in"): a real height-animated
              mount/unmount (tried first) still visibly grew/shrank this
              row, which read as its own "up and down" motion even smoothed
              out -- reserving its space on every page and only ever
              animating its opacity is what actually removes any height
              change from happening at all, on any page, not just chat/home.
              pointer-events-none while invisible so its buttons/breadcrumb
              (holding whatever the last known chat state was) can't be
              hovered/clicked through their own zero-opacity space.
              Settings is the one exception -- per explicit request ("we
              should have no top bar"): that page is a real full-height
              layout of its own with nothing chat-scoped to show here, so
              it skips this row (and the space it reserves) entirely
              instead of just fading it to invisible. */}
          {!isSettingsRoute && (
              // border-b border-border added back -- per a later explicit
            // follow-up ("Our chat name as well has a top bar together with
            // the buttons at the top right so we need to add a topbar
            // bottom border too"), matching the same border now added to
            // Library's own header (LibraryPage.tsx) and the right panel's
            // (right-panel.tsx). This reverses the "no top bar" decision
            // below -- both its border and (see h-10, next) its "sizes to
            // its own content, no fixed height" half -- since a border
            // shared across a real seam (this header sits directly left of
            // the right panel's own header, screenshot confirmed) has to
            // land at the exact same y for the two to actually read as one
            // continuous line rather than two separately-drawn ones a pixel
            // or two apart. h-10, not py-1.5 -- real bug, confirmed
            // directly via a follow-up screenshot ("the chat and right
            // sidebar topbar bottom borders are not aligned to be
            // seamless"): matching content sizing to a coincidentally
            // similar height (both landing near 40px) isn't the same
            // guarantee as both rows sharing one real fixed height, and it
            // showed. h-10 mirrors dray's own reference (the comment this
            // replaces already cited its `h-(--titlebar-h)`, 40px) and is
            // now also set explicitly on right-panel.tsx's own two headers
            // and LibraryPage.tsx's, so all three are pinned to the same
            // value instead of three independent paddings that happen to
            // land close.
            //
            // Below: the original "no top bar" decision's own reasoning,
            // for the parts that still hold (no background, dray's own
            // session-name-only header contents).
            // relative z-10 -- confirmed directly as the real root cause of
            // "still not working" (neither the hover background nor the
            // tooltip pill, on either fix attempt): this row sits at the
            // very top of the window, inside the fixed, full-width
            // data-tauri-drag-region strip's own 0-40px band (above, this
            // file's own comment has the full reasoning) -- that strip is
            // position:fixed with an explicit z-0 and pointer-events-auto,
            // and per real CSS stacking rules, a positioned element still
            // paints *above* plain non-positioned in-flow content even at
            // z-index:0. This header never had any z-index of its own, so
            // the invisible drag strip was silently intercepting every
            // hover/click meant for these buttons before it ever reached
            // them -- no amount of fixing the buttons themselves (the
            // forwardRef fix, the plain-<button> swap) could have ever
            // touched this, it's a completely separate stacking bug. z-10
            // matches the sidebar's own real stacking level (that div's
            // own comment), safely above the drag region's z-0.
            <motion.header
              animate={{ opacity: showChatHeader ? 1 : 0, transition: spring.slow }}
              className={`relative z-10 flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border pr-3 pl-2 ${showChatHeader ? "" : "pointer-events-none"}`}
            >
              <div className="flex items-center gap-2">
                <PageBreadcrumb
                  chatName={chatName}
                  onSaveChatName={saveChatName}
                  models={recents.find((r) => r.id === sessionId)?.models}
                  active={showChatHeader}
                />
              </div>
              {/* gap-0.5, not gap-2 -- icon-sm's own 28px box already has visible
                  empty margin around each 16px glyph, so gap-2 on top of that read
                  as a massive gap between icon-only buttons with no label to fill it. */}
              <div className="flex items-center gap-0.5">
                {/* Quick chat/AvatarStack (the model picker and the member-presence
                    stack) still gone per an earlier request -- small icon-only
                    buttons instead, each with this app's own Tooltip (not a native
                    title= attribute, which triggers the OS's own delayed
                    accessibility tooltip styling instead of a custom one) as the
                    "custom hover" asked for. size="icon-sm": Button's own smallest
                    icon variant, matching "small icons" per explicit request. */}
                {/* Plain <button>, not ui/button.tsx's own <Button> -- confirmed
                    directly as the real cause of "the hover pills... nothing
                    appears at all": Button isn't wrapped in React.forwardRef,
                    so when TooltipTrigger asChild (Radix's own Slot.Root)
                    tries to attach its own ref to it -- needed to track the
                    real DOM node for hover/position -- that ref never reaches
                    the actual <button> element, silently breaking the
                    tooltip's own hover detection. ChatPage.tsx's own working
                    tooltips (Copy/rate/Effort) all wrap a plain host <button>
                    for exactly this reason -- host elements always forward
                    refs correctly, no forwardRef needed. Reused directly,
                    not reimplemented: same size-7/rounded-[10px] the old
                    Button size="icon-sm" rendered, same hover-2 background.
                    size-3.5 (14px) on every icon here, not size-4 (16px) --
                    per an app-wide compact-scale audit: this row's own
                    button box already matches the compact control token
                    (size-7/28px), but the icons inside it hadn't been
                    stepped down to the matching compact icon token (14px)
                    yet. */}
                {/* Real "..." menu now, not a decorative Share icon -- per
                    explicit request ("at the top right of the chat once
                    created where it shows the name we should add a three
                    dots vertically so that users can click on that and
                    Share chat or Enable notification"). Share chat posts
                    the exact same "/share" prompt the compose box's own
                    slash command sends (server.rs's send_message
                    intercepts that literal text before it ever reaches
                    the agent, server.rs:570) -- the currently-open
                    ChatPage's own WebSocket picks up the resulting
                    "share_result" event and renders it same as always, no
                    separate share logic duplicated here. Enable/Disable
                    notification writes chat-notifications.ts's own
                    per-chat override -- real per-chat opt-in, confirmed as
                    a genuine gap: notifyTurnComplete used to only ever
                    check the one global toggle, so a chat had no way to
                    get notified while that toggle was off. Only rendered
                    once a chat actually exists (sessionId, hasOpenChat --
                    matches this whole header's own guard above), since
                    neither action means anything on the Home/new-chat
                    screen. */}
                {sessionId && (
                  // size="compact" -- per explicit request ("Share chat
                  // and enable notifications dropdown needs to be smaller
                  // maybe text-xs and icon to match that size"), the same
                  // SizeProvider step every other "make this dropdown
                  // smaller" request in this app already reaches for
                  // (nav-user.tsx's own Provider usage rows,
                  // settings-overlay.tsx's own account-row dropdown) --
                  // steps MenuItem's own icon/text size tokens down a tier
                  // instead of hand-picking a one-off text-xs override
                  // that would drift from those the moment the shared
                  // scale changes.
                  <BaseDropdownMenu size="compact">
                    <BaseDropdownTrigger
                      render={
                        <MoreTrigger orientation="vertical" size="md" bg autoHide={false} aria-label="Chat options" />
                      }
                    />
                    <BaseDropdownContent align="end" className="w-40">
                      <BaseDropdownLabel>More</BaseDropdownLabel>
                      {/* Gated on sign-in, not on anything provider-related --
                          per explicit request/correction ("the send button
                          should be available once users have setup their
                          providers, we should not gate the send because
                          they don't have an account. We will gate only
                          share because that requires an account for user
                          management at chats"). Disabled (not hidden), with
                          an info icon + tooltip explaining why -- per
                          explicit follow-up ("change that to an i for
                          information... The share feature is only
                          available when signed in"), replacing the earlier
                          "(sign in required)" suffix on the label itself.
                          pointer-events-auto on the icon -- the row's own
                          disabled styling sets pointer-events-none
                          (menu-item.tsx), which would otherwise swallow the
                          hover needed to show this tooltip too. */}
                      <BaseMenuItem
                        index={0}
                        icon={ShareIcon}
                        label="Share chat"
                        disabled={!isSignedIn}
                        className="gap-[7px]"
                        badge={
                          !isSignedIn && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="pointer-events-auto flex shrink-0 items-center text-muted-foreground">
                                  <InfoCircleIcon className="size-3.5" />
                                </span>
                              </TooltipTrigger>
                              {/* z-[9999] -- real bug, confirmed directly
                                  ("the hover for the i is behind the
                                  dropdown"): this tooltip renders nested
                                  inside the "..." dropdown's own popup,
                                  which climbs its own z-index with nesting
                                  depth (ui/dropdown.tsx's own zIndexSubstrate
                                  comment) well past the tooltip's default
                                  z-50. A safely high fixed value, not just
                                  enough to clear this one menu's own depth,
                                  so it stays correct if this tooltip pattern
                                  ever gets reused inside a deeper nested
                                  menu. */}
                              <TooltipContent className="z-[9999]">The share feature is only available when signed in.</TooltipContent>
                            </Tooltip>
                          )
                        }
                        onSelect={() =>
                          void fetch(`/sessions/${sessionId}/messages`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: "/share", sender_name: getUserDisplayName() }),
                          })
                        }
                      />
                      <BaseMenuItem
                        index={1}
                        icon={BellIcon}
                        label={chatNotifyEnabled ? "Disable notification" : "Enable notification"}
                        className="gap-[7px]"
                        onSelect={() => {
                          setChatNotificationsEnabled(sessionId, !chatNotifyEnabled);
                          setChatNotifyEnabledState(!chatNotifyEnabled);
                        }}
                      />
                      <BaseMenuItem
                        index={2}
                        icon={CheckIcon}
                        label="Allowed commands"
                        className="gap-[7px]"
                        onSelect={() => setAllowedCommandsOpen(true)}
                      />
                      <DropdownSeparator />
                      {/* Add to project -- per explicit request ("the chat
                          three dots at the sidebar and at the top right
                          icons should allow us to attach the chat an
                          existing project or new project"), same actions
                          sidebar-nav.tsx's own ChatRow menu already has,
                          including that same file's own later follow-up
                          ("remove the third menu and flip add project to
                          remove from project"): a chat already in a project
                          gets a plain "Remove from project" instead of the
                          submenu. */}
                      {recents.find((r) => r.id === sessionId)?.projectId ? (
                        <BaseMenuItem
                          index={3}
                          icon={FolderIcon}
                          label="Remove from project"
                          className="gap-[7px]"
                          onSelect={() => void assignChatToProject(null)}
                        />
                      ) : sidebarProjects.length > 0 ? (
                        <DropdownSubMenuItem index={3} icon={FolderIcon} label="Add to project" className="gap-[7px] text-[12px]">
                          <BaseDropdownLabel>Projects</BaseDropdownLabel>
                          {sidebarProjects.map((project) => (
                            <DropdownSubItem
                              key={project.id}
                              className="py-1.5 pl-2.5 text-[12px]"
                              onClick={() => void assignChatToProject(project.id)}
                            >
                              {project.label}
                            </DropdownSubItem>
                          ))}
                        </DropdownSubMenuItem>
                      ) : (
                        // Plain, disabled row, not a submenu -- same fix as
                        // sidebar-nav.tsx's own ChatRow (that file's own
                        // comment has the full reasoning/screenshot).
                        <BaseMenuItem index={3} icon={FolderIcon} label="Add to project" className="gap-[7px]" disabled />
                      )}
                    </BaseDropdownContent>
                  </BaseDropdownMenu>
                )}
                {sessionId && <AllowedCommandsDialog sessionId={sessionId} open={allowedCommandsOpen} onOpenChange={setAllowedCommandsOpen} />}
                {/* Memory button removed -- per explicit request ("we won't
                    do that now"), same decorative/placeholder status it
                    always had, just not shipped for now. */}
                {/* Right-hand sidebar toggle -- brought back per explicit
                    report ("The right sidebar icon is missing at the top
                    right row"), opening this *chat's own* file list per a
                    later explicit follow-up ("that should open the
                    library of this chat and show multiple files/ one per
                    row file and when i click at it i should be able to
                    see, edit and save changes to the file"). Restores
                    wherever panelNav was left (a real file, mid-scroll,
                    etc.) if there's already history for this chat --
                    per a further explicit follow-up ("when collapsing the
                    right sidebar that should save the state we were at...
                    should be in the same place") -- only starting a fresh
                    list when there's no history yet (a real chat switch
                    already resets it, the effect above). Disabled only
                    when there's no open chat to list files for at all
                    (Home, Library, etc.). */}
                <button
                  type="button"
                  aria-label="Chat files"
                  // !sessionId && !rightPanel, not just !sessionId -- real
                  // bug, confirmed directly ("the collapse right sidebar
                  // should be active only when we open a file so we can
                  // close that sidebar again... right now it doesn't
                  // work"): Library opens a file via openFile ->
                  // navigateRightPanel directly, with no chat session at
                  // all (sessionId is only ever set on a real chat route),
                  // so the old !sessionId gate disabled this button
                  // outright on Library, even with a file open -- there
                  // was no way to close it again except navigating away.
                  disabled={!sessionId && !rightPanel}
                  onClick={() => {
                    // Toggles closed when already open -- per explicit
                    // request ("when we click at the icon of the right
                    // sidebar when right is open, that should collapse
                    // the sidebar again"), same open/close pairing every
                    // other icon-toggled panel in this app already has.
                    // Checked first, before the sessionId gate below: a
                    // Library-opened file has no sessionId at all, but
                    // should still be closable.
                    if (rightPanel) {
                      onRightPanelClose();
                      return;
                    }
                    if (!sessionId) return;
                    if (panelNav.history.length === 0) navigateRightPanel({ type: "list", chatId: sessionId });
                    else setPanelVisible(true);
                  }}
                  // disabled:hover:text-muted-foreground -- real bug,
                  // confirmed directly ("The button looks disabled as i
                  // hover that changes color"): a disabled <button> still
                  // matches CSS :hover (disabled only blocks click/focus,
                  // not the pseudo-class), so hover:text-foreground was
                  // firing regardless of the disabled state, reading as
                  // "not actually disabled" even though clicking correctly
                  // did nothing.
                  //
                  // text-foreground at rest, not text-muted-foreground --
                  // real bug, confirmed directly ("the color of the right
                  // sidebar icon does not match the three dot beside it"):
                  // the "..." trigger right next to this one is MoreTrigger
                  // with autoHide={false}, which per that shared
                  // component's own comment rests at text-foreground (the
                  // always-visible-icon convention every standalone header
                  // icon in this app follows) -- this button was the one
                  // standalone header icon still resting dimmer, at
                  // text-muted-foreground, instead of matching it.
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-hover-2/50 disabled:text-muted-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <SidebarRightIcon className="size-3.5" />
                </button>
              </div>
            </motion.header>
          )}
          {/* Plain opacity crossfade on route change -- not a slide or
              stagger, for the "one simple unit" reasoning below. Covers
              every route
              through this one shared Outlet -- Chat/Agent/Code/Design's
              own mode-switching (what this was asked for), but also
              Welcome/Projects/Apps and the avatar dropdown's Settings/
              Docs/Help/Models pages, since they all flow through here too.
              No mode="wait" (tried first, reverted per explicit request) --
              that fully unmounted the outgoing page, held on a blank gap,
              then faded the new one in from scratch, which read as two
              separate fades with a dead pause between them rather than one
              continuous dissolve. Default mode instead lets both animate at
              once: outgoing fades out while incoming fades in, overlapping.
              relative on this wrapper + absolute inset-0 on the animated
              child is what makes that overlap safe -- both pages can differ
              in content height and briefly coexist without fighting each
              other for layout space, since neither is in normal flow; this
              wrapper's own height still comes from the flex chain above it
              (ultimately AppLayout's own h-dvh), not from whichever page
              happens to be inside it. key={location.pathname}: this is what
              actually tells AnimatePresence a *different* page mounted (a
              plain route change alone doesn't remount anything on its own).
              initial={false}: skips this fade on first load -- only real
              navigations get it. duration 0.15 -> 0.28 -- per explicit
              request ("the transition... is giving a snappy feel, maybe...
              too quick and not a fade out fade in"): the mechanism itself
              was already what was being asked for (whole-page fade, existing
              per-row animations untouched), it just ran too fast to read as
              an actual fade. Now spring.slow (lib/springs.ts) -- 0.24s in,
              0.16s out -- the closest named tier to that same "deliberate,
              not snappy" feel, and it keeps the "exit faster than entrance"
              principle that duration-0.28-both-ways never had. Per-row
              animations inside `outlet` (ChatPage's own reply/message
              reveals) are unaffected -- this only wraps the page-level
              container, not anything inside it. */}
          {/* z-10 -- same fix, same cause as the chat header's own comment
              above: this wrapper (and everything inside it, via `outlet`)
              had no z-index of its own, so the fixed, page-spanning
              data-tauri-drag-region strip (z-0) painted above it instead
              of below, regardless of DOM order. Confirmed directly on
              Settings -- scrolling the page moved its content up behind
              that invisible strip instead of it reaching the full height
              of the page. */}
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
          <div className="relative z-10 min-h-0 flex-1">
            <AnimatePresence initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: spring.slow }}
                exit={{ opacity: 0, transition: spring.slow.exit }}
                className="absolute inset-0 flex flex-col"
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </div>
          </div>
    </>
  );
  return (
    // h-dvh, not h-svh -- svh pins this to the *smallest* possible viewport
    // height (Safari's own bottom toolbar fully expanded) and never grows
    // past that, so once that toolbar collapses on scroll (real extra
    // space now available) this stayed exactly svh-tall, leaving a black
    // gap between the app and Safari's own chrome underneath it. dvh
    // instead tracks the *current* visual viewport live, growing/shrinking
    // in step with the toolbar itself.
    // No top-level flex-col wrapper any more -- that only existed to stack
    // the global TopBar (a full-width row) above the sidebar + main
    // content row; with TopBar removed entirely (per explicit request --
    // Chat/Code/Design switching now lives in the compose box instead,
    // compose-box.tsx), this relative row is the whole layout. No fragment
    // wrapper any more either -- Settings used to float here as a second
    // top-level sibling (SettingsOverlay, a modal), but it's a real route
    // now (/settings/:section, App.tsx), rendered through the normal
    // Outlet below like every other page, so there's nothing left needing
    // a second sibling slot.
    <div className="relative flex h-dvh min-h-0">
      {/* The decorative bg-sidebar/border-b strip that used to span this
          row (matching where a native title bar would sit) is gone
          entirely, per explicit request -- matching dray's own "no top
          bar at the content page" treatment, the same reasoning that
          already stripped the chat-scoped header's own border/height/bg
          below. It was purely visual continuity (pointer-events-none, no
          functional role), so removing it is safe -- Home/Getting Started
          pages now show no bar at all across their own top edge, same as
          an open chat's own header row. */}
      {/* Window drag region -- per explicit request ("so i can click and
          drag my tauri app around"). Checked this repo directly: no
          element anywhere ever carried data-tauri-drag-region, so
          clicking empty space at the window's own top edge to move it
          never actually worked, on any page, even before the decorative
          strip above was removed -- that strip was pointer-events-none
          (explicitly inert to clicks), so it was never what enabled
          this either. titleBarStyle: "Overlay" + hiddenTitle: true
          (src-tauri/tauri.conf.json) hide the native title bar entirely,
          which is exactly the case Tauri's own docs say needs this
          attribute added back in explicitly -- macOS does not make an
          overlay-style window draggable by default the way a normal
          title bar is. z-0 + pointer-events-auto: sits *behind* the
          sidebar (z-10), the chat header's own controls, and the
          standalone sidebar toggle (z-20) in stacking order, so a real
          click on any of those still reaches them first -- this only
          ever receives a click where the page truly has nothing else
          drawn at that pixel, which on every page is most of this
          h-[40px] strip's own width once the sidebar's real content
          ends. h-[40px]: same height the removed strip used, matching
          sidebar-nav.tsx's own collapse-toggle row. inset-x-0, not just
          the content column's own width -- the strip needs to span the
          *entire* window, sidebar included, since the sidebar's own
          empty margins in that row (right of its collapse icon) should
          be draggable too, not just the main content side. Web-only
          no-op: data-tauri-drag-region does nothing outside the Tauri
          webview, so this is harmless in a plain browser tab.
          select-none: without it, confirmed directly, a click-drag on
          this region started a text-selection drag instead of moving the
          window -- the webview's own default mousedown behavior (start
          selecting) wins the race against Tauri's native drag-start
          unless user-select is explicitly turned off here. */}
      <div
        data-tauri-drag-region
        className="pointer-events-auto fixed inset-x-0 top-0 z-0 h-[40px] select-none"
        aria-hidden
      />
      {/* DesktopOnlyOverlay (components/desktop-only-overlay.tsx) disabled,
          not removed -- top-bar.tsx's own responsive work (icon-only
          tabs/compression, the mobile hamburger menu below the xs
          breakpoint) since made the app genuinely usable at phone widths,
          so blocking the view there no longer makes sense. Kept in the
          tree, unrendered, in case a real "desktop only" need comes back
          at some later stage -- re-add `<DesktopOnlyOverlay />` here (and
          its import above) to bring it back. */}
        {/* relative z-10: without an explicit stacking order, the content
            column below (position: absolute, see its own comment) would
            paint over this sidebar wherever the two overlap, since later
            DOM order wins between equally-unstacked positioned elements --
            this keeps the sidebar's own opaque background on top instead. */}
        {/* Settings swaps the main sidebar for its own nav entirely while
            active -- per explicit request (exact Synara match: "Swap the
            main sidebar for settings nav"), not just hidden the way
            docs/help/models are (SIDEBAR_HIDDEN_ROUTES, below). AnimatePresence
            + a plain opacity crossfade, keyed by isSettingsRoute -- per
            explicit request ("we need to add a transiction from going to
            settings and leaving settings"): this was a hard unmount/remount
            between two different components before (SidebarNav <->
            SettingsSidebarNav), same width so nothing needs to move, just
            fade. mode="wait" so the two never both render mid-transition
            (they're two real, differently-behaved sidebars, not one
            resizing) -- spring.fast, this app's own plain-fade tier. */}
        <AnimatePresence mode="wait" initial={false}>
          {isSettingsRoute ? (
            <motion.div
              key="settings-sidebar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: spring.fast }}
              exit={{ opacity: 0, transition: spring.fast.exit }}
              className="relative z-10 flex"
            >
              <SettingsSidebarNav section={activeSettingsSection} />
            </motion.div>
          ) : !SIDEBAR_HIDDEN_ROUTES.includes(location.pathname) && (
          <motion.div
            key="app-sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: spring.fast }}
            exit={{ opacity: 0, transition: spring.fast.exit }}
            className="relative z-10 flex"
          >
            <SidebarNav
              fill
              placeholderNav={PLACEHOLDER_NAV_ROUTES.includes(location.pathname)}
              activeNav={
                location.pathname === "/new-chat"
                  ? "home"
                  : location.pathname === "/getting-started"
                    ? "welcome"
                    : location.pathname === "/inbox"
                      ? "inbox"
                      : location.pathname === "/library"
                        ? "library"
                        : location.pathname === "/agent"
                        ? "agents"
                        : location.pathname === "/apps"
                          ? "integrations"
                          : undefined
              }
              onNewChat={() => navigate("/new-chat")}
              onNavigate={(key) => {
                if (key === "home") navigate("/new-chat");
              }}
              projects={sidebarProjects}
              recents={recents}
              onRecentsChanged={refreshSidebarLists}
              onCollapsedChange={setSidebarCollapsed}
              expandSignal={sidebarExpandSignal}
              onOpenSettings={() => openSettings("general")}
            />
            {/* Standalone re-expand toggle -- only exists while the
                sidebar is fully collapsed to width 0 (every platform now,
                per explicit request -- sidebar-nav.tsx's own
                fullyCollapsed comment has the full reasoning), since that
                sidebar's own internal toggle button collapses away along
                with everything else in it then, same as dray's own
                SidebarToggle living outside its Sidebar for the same
                reason. left-[74px] only while real macOS traffic lights
                are actually on screen to clear (the desktop app, not
                fullscreen) -- past this file's own known-good 62px
                reserve (sidebar-nav.tsx's own collapse-toggle row uses
                the same number) plus this button's own small inset;
                left-2 everywhere else (web, Tauri fullscreen), where
                there's nothing to clear and 74px would just be an
                oversized, unexplained gap from the window's own edge.
                top-2 matches where the sidebar's own internal toggle sits
                (that row's own pt-2). */}
            {sidebarFullyCollapsed && (
              <button
                type="button"
                aria-label="Expand sidebar"
                onClick={() => setSidebarExpandSignal((n) => n + 1)}
                className={`fixed top-2 ${trafficLightsVisible ? "left-[74px]" : "left-2"} z-20 flex size-5 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors duration-150 hover:bg-hover-2/50 hover:text-foreground active:scale-[0.98]`}
              >
                <SidebarLeftIcon className="size-[16px]" />
              </button>
            )}
          </motion.div>
          )}
        </AnimatePresence>
        {/* flex-1 min-w-0, a real flex sibling after the sidebar above --
            per explicit request: this used to be position: absolute;
            inset: 0, spanning the *entire* row's width (true window
            width) regardless of the sidebar's own width, so this column's
            own mx-auto/max-w-[1440px] centering (below) centered on the
            true window center rather than the center of the space actually
            left over beside the sidebar -- with the sidebar visible, that
            reads as visibly off-center (shifted left) in the space a user
            actually sees next to it. Was a real flex sibling once before
            too, but paired with a separate translateX counter-transform to
            land back on that *same* true-window-center goal -- two
            independently animated values (the sidebar's own width
            transition, main-thread, and this column's own compositor-only
            transform) that occasionally fell a frame or two out of phase
            under real paint scheduling, reading as a brief drift-then-snap.
            That old bug was the *manual counter-transform* fighting
            reflow, not flex reflow itself -- centering on the remaining
            space instead (this version) needs no compensating transform at
            all: the column just reflows as part of the same layout pass
            that resizes the sidebar, nothing to desync. min-w-0: without
            it this won't shrink below its content's intrinsic width (e.g.
            long chat text), so wide content grows the whole box instead of
            wrapping/scrolling. */}
        {/* Right-side editor panel (issue #288, phase 1) -- a real drawer,
            width-animated with the exact same transition the left
            sidebar's own collapse uses (SIDEBAR_MOTION_MS/SIDEBAR_EASING,
            sidebar-nav.tsx's own <aside>), per explicit request ("make
            sure we are using the same drawer transition as the left
            sidebar collapse"). Previously a real react-resizable-panels
            split, conditionally mounted -- that library's own mount/
            unmount had no open/close transition at all (it just
            appeared/disappeared), and mounting it unconditionally instead
            (tried first) broke the left sidebar's own collapse animation
            (a real bug, confirmed directly: "The left sidebar now when
            collapsing has the chat name on top of it" -- the library's own
            layout/stacking machinery interfered even with no right panel
            ever open). This plain width-transition div avoids both: always
            mounted, width animates between 0 and rightPanelWidth, and
            startRightPanelResize (above) is a small manual drag-resize
            standing in for that library's own resize handle. mainContent
            is defined once and referenced from both the always-mounted
            main column and this drawer's sibling position, so neither
            duplicates the whole content column's own JSX. */}
        <div ref={contentRowRef} className="flex min-h-0 min-w-0 flex-1">
          <div
            className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${isLibraryRoute ? "flex-none" : "flex-1"}`}
            style={
              isLibraryRoute
                ? {
                    width: libraryFullPanel ? LIBRARY_SIDEBAR_WIDTH : contentRowWidth,
                    transitionProperty: "width",
                    transitionDuration: `${SIDEBAR_MOTION_MS}ms`,
                    transitionTimingFunction: SIDEBAR_EASING,
                  }
                : undefined
            }
          >
            {mainContent}
          </div>
        {/* relative z-10 -- real bug, confirmed directly ("Any of the
            buttons at the right sidebar is not working"): without an
            explicit position, this drawer was a plain in-flow element,
            which paints *before* the fixed drag-region strip above
            (data-tauri-drag-region, z-0) in stacking order -- the exact
            same category of bug this file's own sidebar/content column
            already carry "relative z-10" to avoid. The strip is
            pointer-events-auto and spans the full window width, so it
            silently absorbed every click landing in this panel's own
            header row (close/back/forward/preview/save), all within that
            strip's own 40px band, reading as "none of the buttons work"
            even though each one's own onClick was correct. The earlier
            react-resizable-panels Panel this replaced happened to apply
            position: relative internally, which is why this never
            surfaced before that swap. */}
          <div
            className={`relative z-10 flex h-full overflow-hidden ${isLibraryRoute ? "flex-none" : "shrink-0"}`}
            style={{
              width: rightPanelTargetWidth,
              transitionProperty: "width",
              transitionDuration: isResizingRightPanel ? "0ms" : `${SIDEBAR_MOTION_MS}ms`,
              transitionTimingFunction: SIDEBAR_EASING,
            }}
          >
            {rightPanel && (
              <>
                {/* Real bug, confirmed directly ("our right sidebar has a
                    thick border because the left panel inside library has a
                    right border already"): LibraryPage.tsx's own sidebar
                    used to always draw its own border-r, which doubled up
                    against this always-present strip into a visibly
                    thicker line whenever a file was open there. Capping
                    just this strip's own height to the header row (tried
                    first) left a real gap instead -- LibraryPage's border-r
                    starts a hair below the exact pixel this strip's own
                    capped height ended at, however that's actually
                    computed. Fixed at the actual source instead:
                    LibraryPage.tsx now drops its own border-r whenever the
                    right panel is open (rightPanelOpen, from this same
                    outlet context), leaving this one full-height strip as
                    the only vertical line -- same as a real chat's body
                    already gets from it, nothing competing. */}
                <div
                  onMouseDown={libraryFullPanel ? undefined : startRightPanelResize}
                  className={`w-px shrink-0 bg-border transition-colors ${libraryFullPanel ? "" : "cursor-col-resize hover:bg-focus-accent"}`}
                />
                <div style={{ width: rightPanelTargetWidth }} className="h-full shrink-0">
                  <RightPanel
                    state={rightPanel}
                    onClose={onRightPanelClose}
                    onSelectFile={(path) => navigateRightPanel({ type: "file", path })}
                    onBack={rightPanelGoBack}
                    onForward={rightPanelGoForward}
                    canGoBack={panelNav.index > 0}
                    canGoForward={panelNav.index < panelNav.history.length - 1}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
  );
}
