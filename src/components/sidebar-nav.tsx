import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useIsMobile } from "@/hooks/use-media-query";
import { useDebounce } from "@/hooks/use-debounce";
import { useGettingStarted } from "@/hooks/use-getting-started";
import { useIsMac } from "@/hooks/use-platform";
import { markTooltipTruncated } from "@/lib/tooltip";
import { spring } from "@/lib/springs";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// The fluidfunctionalism.com reference dropdown (Base UI Menu +
// proximity-hover animated selection/hover backgrounds) -- this file's
// one dropdown system now, per explicit request ("Lets keep all base
// ui"). CustomMenuItem (menu-item.tsx) covers the one row shape MenuItem
// itself can't (Models Usage' own usage-bar rows, nav-user.tsx).
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
import { AccountMenuItems, HelpMenuItems } from "@/components/nav-user";
import { DefaultAvatar } from "@/components/ui/avatar";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { getUserDisplayName, useUserDisplayName } from "@/lib/user";
import { hideChatLocally } from "@/lib/locally-hidden-chats";
import { QUICK_CHAT_MODELS, ProviderIcon } from "@/lib/quick-chat-models";
// Untitled UI is this app's one icon source -- import from here rather
// than @untitledui/icons directly, so every icon in use stays
// discoverable from one place.
import {
  ArchiveIcon,
  BlankPageIcon,
  BubbleChatIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DeleteIcon,
  EditIcon,
  FolderIcon,
  HelpCircleIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SidebarLeftIcon,
  XIcon,
} from "@/components/icons/untitled-ui";
import GlideMenu from "@/components/primitives/glide-menu";

/* ─────────────────────────────────────────────────────────
 * SIDEBAR NAV
 * Replaces the old shadcn Sidebar/SidebarProvider stack (source of the
 * "useSidebar must be used within a SidebarProvider" / "Can't find
 * variable: NavUser" Sentry reports) with a self-contained component: no
 * context provider. No workspace switcher (this app has no workspace
 * concept -- see app-sidebar.tsx's old comment). Collapse is internal,
 * self-managed state (useState below), not a controlled prop -- same as
 * every other local-only bit of UI state in this component (selectedProject
 * etc.); nothing outside this component currently needs to know whether
 * it's collapsed.
 * ───────────────────────────────────────────────────────── */

export const SIDEBAR_WIDTH = 220;
// The real drag range for the expanded sidebar's own width (below, "Real
// drag-resize" comment). MIN is SIDEBAR_WIDTH itself -- per explicit
// follow-up ("the minimum draggable should be where our collapse bar is
// at when expanded so we allow only users to expand the sidebar for the
// reading chats name if they want"): dragging only ever makes the
// sidebar wider than its own default, never narrower, so there's no
// separate "collapsed but not really collapsed" in-between width to
// design row layout around -- rows only ever need to handle "default" or
// "wider than default." MAX is a plain, generous cap against dragging it
// into taking over the whole window.
export const SIDEBAR_MIN_WIDTH = SIDEBAR_WIDTH;
export const SIDEBAR_MAX_WIDTH = 360;
// No longer actually reachable -- `collapsed` now always fully collapses
// the sidebar to width 0 on every platform (the <aside> below's own
// fullyCollapsed comment has the full reasoning), so this narrow-rail
// width never gets selected any more. Left in place (RailButton/
// SidebarSearch's own collapsed-icon rendering still computes against
// it) rather than ripped out -- that's a separate cleanup, not part of
// making Tauri and web match.
export const SIDEBAR_COLLAPSED_WIDTH = 48;
// RailButton's own row width (not the whole sidebar's) -- 204px expanded
// matches every row's existing mx-2 inset inside the 220px sidebar. The
// row's own side padding is a shared, single px-1.5 (6px) value at every
// width -- per explicit request ("use the new sidebar sizes... designer
// compact style"), matching the installed preset's own compact itemPx
// token (size-context.tsx). Was px-1 (4px, and before that px-2/8px,
// px-0.5/2px) -- fixing this one shared value is what fixes collapsed's
// own shape too: 32px collapsed is just the 20px icon plus that same 6px
// padding on both sides (6+20+6=32), one step up from the row's own h-7
// height (28px) -- accepted per explicit request (a real, disclosed
// tradeoff: keeping the collapsed rail square at the new 6px padding
// means it's no longer pixel-identical to the row's own height, unlike
// before) rather than a non-square box a mismatched padding would
// otherwise produce.
// Exported now -- settings-overlay.tsx's own SettingsSidebarNav reuses
// these directly (per explicit request, "make sure that the settings page
// sidebar be in the same width and location at the main page one") so its
// own row width can't drift independently from this sidebar's.
export const SIDEBAR_ROW_WIDTH = 204;
export const SIDEBAR_COLLAPSED_ROW_WIDTH = 32;
export const SIDEBAR_MOTION_MS = 280;
// Same easing reference implementations of this pattern use for a sidebar
// collapse -- decelerates smoothly into the resting width instead of a
// linear or ease-in-out feel.
export const SIDEBAR_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

// Real nav destinations, ported from app-sidebar.tsx's old `data.navMain`.
// Welcome renders on its own, above New Chat -- see GlideGroup usage below.
// size-[14px], not 18 -- paired with the row's own text-[12px] label, and
// 16px is the recommended icon size at that text scale (roughly a 1.3x
// icon-to-font ratio; 18px is the pairing for an 18-20px text scale not
// used here), so the icon no longer reads as oversized next to the label.
// key: "home" retired -- Welcome now has its own destination
// (/getting-started, which is also the app's overall default landing page
// now -- see App.tsx's own "/" redirect), separate from New Chat's own
// page (moved to /new-chat for the same reason), so it needs its own key
// rather than sharing New's own for active-row highlighting.
// size-[13px], not the row's usual 14px (FolderIcon etc. just below use
// 14) -- the Hugeicons glyphs those use are drawn with real breathing
// room inside their own viewBox, but AlongsideLogo's petals run
// edge-to-edge in its 48x48 viewBox (no internal margin), so at the same
// box it reads visibly heavier/bigger than every other row icon despite
// being numerically close. 13px is what actually matches their *optical*
// weight, not their box size.
const WELCOME_ITEM = { key: "welcome", label: "Getting started", url: "/getting-started", icon: <AlongsideLogo className="size-[13px]" /> };
// Sidebar's own Inbox row -- per explicit request. New chat/New
// project/New agent/New app no longer have their own standalone rows
// (NEW_CHAT_KEY/NAV_ITEMS retired) -- they're all one popup on the New
// row now (see GlideGroup's own comment below), "reducing the amount of
// buttons at the sidebar".
const INBOX_ITEM = { key: "inbox", label: "Inbox", url: "/inbox", icon: <InboxIcon className="size-[14px]" /> };
// Library (issue #286) -- every file the agent has actually touched,
// grouped per-project/per-chat. Directly under Inbox, per explicit request
// ("the library feature should be a menu under inbox").
const LIBRARY_ITEM = { key: "library", label: "Library", url: "/library", icon: <FolderIcon className="size-[14px]" /> };

// Positions a .t-tt-fixed tooltip (index.css's own "Transitions.dev —
// Tooltip open/close" section) against the trigger's real on-screen rect
// on hover/focus -- the sidebar's own <aside> needs overflow-hidden for
// its collapse/curtain animation, which would otherwise clip the default
// (position: absolute) tooltip variant for any row whose label is long
// enough to overflow the sidebar's own 220px width. Attach to the
// .t-tt-wrap span (onMouseEnter/onFocus), not the trigger itself -- the
// CSS custom properties it sets inherit down to the tooltip child
// automatically.
function positionFixedTooltip(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) {
  const wrap = event.currentTarget;
  // markTooltipTruncated (lib/tooltip.ts, shared with top-bar.tsx's own
  // search dropdown rows): only show the tooltip when the row's own
  // label is actually cut off -- short labels ("Customer Support" and
  // the like) were getting the exact same hover treatment as ones that
  // genuinely needed it, which is just noise for a row that already
  // displays its full name.
  if (!markTooltipTruncated(wrap)) return;
  const rect = wrap.getBoundingClientRect();
  // rect.top - 8 -- straight above (also tried vertically centered, and
  // straight below) landed the tooltip on top of whichever row sits
  // directly above/below/beside the hovered one's own vertical span in
  // the sidebar's own dense, gap-px-apart row list, reading as that
  // neighboring row's own text overlapping/interleaving with the
  // tooltip (confirmed directly, screenshots). Combined with --tt-left
  // below (to the row's own right, not flush with it), this opens
  // upward from a point past the row's own right edge, so it clears the
  // row directly above too -- that row's own text only occupies the
  // sidebar's narrow column, not the open space to its right.
  wrap.style.setProperty("--tt-top", `${rect.top}px`);
  // rect.right + 8, not rect.left (flush with the row's own left edge,
  // tried first) -- anchoring from the row's own left edge would overlap
  // the row itself once positioned above it; the right edge plus a small
  // gap clears it, growing into the sidebar's always-open neighboring
  // main content area (same reasoning that ruled out horizontal
  // centering before this: the sidebar's own rows sit flush against the
  // window's left edge, so anything growing further left than the row
  // itself risks running off the left side of the screen).
  wrap.style.setProperty("--tt-left", `${rect.right}px`);
}

export type SidebarRecent = {
  id: string;
  label: string;
  // Real, not decorative -- the delete-confirmation dialog below compares
  // this against getUserDisplayName() to show different copy (and take a
  // different real action) for a hosted chat's non-owner participant.
  // Undefined for a chat nobody has connected to yet (server.rs's own
  // ChatSummaryResponse comment has the matching reasoning).
  creatorName?: string | null;
  // Which project (if any) this chat currently belongs to -- backend/src/
  // db.rs's own chats.project_id, already stored there, now surfaced here
  // so the sidebar can group a chat under its project's own expandable
  // drawer instead of always showing it in the root "Chats" list. null/
  // undefined both mean "not in a project."
  projectId?: string | null;
  // Every distinct provider/model this chat has actually used, matching
  // Inbox's own multi-provider icon stack (InboxPage.tsx's own ModelStack) --
  // per explicit request ("if we add codex to it as well, that will show
  // codex... matching the behaviour of inbox"). server.rs's own
  // ChatSummaryResponse now carries the same real data Inbox's own endpoint
  // already did.
  models?: { provider: string; model: string }[];
};

// Same shape as SidebarRecent -- a separate type name only because the two
// lists are conceptually different sections (recent chats vs. project
// folders), not because the row itself renders any differently.
export type SidebarProject = {
  id: string;
  label: string;
};

// SidebarSearch's own unified result row -- a chat navigates directly, a
// project (no dedicated route of its own, sidebar-nav.tsx's own ProjectRow
// just expands/collapses in place) instead expands that project's drawer.
// snippet/matchedIn -- github.com/alongsidedotrun/alongside/issues/11's own
// real full-text search (backend/src/db.rs's own `search`): a message-body
// match shows the matching line itself, not just the chat's own name, so
// the result actually explains *why* it matched.
type SearchResult = {
  kind: "chat" | "project" | "model";
  id: string;
  label: string;
  snippet?: string;
  matchedIn?: "message" | "chat_name" | "project_name";
  // Only set for kind: "model" -- lets the result row render that
  // provider's real icon, the same describer treatment a Chat/Project
  // result gets from its own icon below.
  model?: (typeof QUICK_CHAT_MODELS)[number];
};

// Sidebar's own search entry point -- moved here from top-bar.tsx (that
// file's own former TopBarSearch), per explicit request: search is now the
// sidebar's first row instead of a box centered in the top bar, and
// Getting started (this row's old position) becomes a plain nav row like
// New Chat/Project/Apps, no longer sharing space with the collapse toggle
// or crossfading its own icon into the expand-toggle glyph while collapsed
// (this component's own collapsed state handles expanding now). Same
// debounced-filter/keyboard-nav dropdown behavior as the old top-bar
// version, just anchored to this row instead of a max-w-sm box in the top
// bar's own center lane.
//
// position: fixed on the dropdown (computed on focus from this row's own
// real getBoundingClientRect(), not the plain position: absolute the top
// bar version used) is what lets it escape the sidebar's own
// overflow-hidden (needed for the collapse animation) -- same fix
// positionFixedTooltip (this file's own helper) already uses for long row
// labels, just with the position computed once on focus (a real state
// update, not a CSS custom property) instead of on every hover, since this
// is a real interactive control with its own React state already, not a
// hover-only CSS affordance.
function SidebarSearch({
  value,
  onChange,
  collapsed,
  onExpandSidebar,
}: {
  value: string;
  onChange: (value: string) => void;
  collapsed: boolean;
  onExpandSidebar: () => void;
}) {
  const { t } = useTranslation();
  const isMac = useIsMac();
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd+F on macOS, Ctrl+F everywhere else -- was Cmd/Ctrl+S (for
  // "Search"), changed to F (for "Find") per explicit request along with
  // the row's own label/placeholder below. Also expands the sidebar
  // first if it's currently collapsed, since the shortcut should work
  // regardless of collapse state, not just when the row happens to
  // already be visible.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "f" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (collapsed) {
          onExpandSidebar();
          // requestAnimationFrame, not an immediate focus call -- while
          // collapsed, this component's own render returns the icon-only
          // button branch (no <Input>, so searchRef.current is still
          // null); onExpandSidebar() flips `collapsed` in the parent, but
          // React hasn't re-rendered the expanded branch yet by the time
          // this same synchronous handler reaches the focus call below.
          // Deferring to the next frame gives that re-render (and the
          // real input mounting) time to happen first (confirmed
          // directly: focus silently no-op'd on a null ref without this).
          requestAnimationFrame(() => searchRef.current?.focus());
        } else {
          searchRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, onExpandSidebar]);

  // Icon-only while the sidebar itself is collapsed -- same role Welcome's
  // own collapsed icon used to play (click expands), just a search glyph
  // instead of a swapped-in expand arrow, since this row no longer needs
  // to crossfade between two different icons to communicate that.
  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={t("nav.search.ariaLabel")}
        onClick={onExpandSidebar}
        // h-7 (28px), not h-8 -- was h-8 while every real nav row
        // (RailButton) stays a fixed h-7 in both collapsed and expanded
        // states (only its *width* animates, never its height) -- that
        // mismatch made this row 4px taller than its siblings the instant
        // `collapsed` flips (a discrete render swap, not an animated
        // one), pushing every row below it down before the sidebar's own
        // width transition even finished. Confirmed directly as the real
        // cause of "the icons when collapsed move down during the close
        // drawer effect". w-8 (32px) stays -- that's this row's own
        // *width*, matching SIDEBAR_COLLAPSED_ROW_WIDTH like every other
        // collapsed row's own width does; only the height was ever the
        // mismatch.
        className="mx-2 flex h-7 w-8 shrink-0 transform-gpu items-center justify-center rounded-[var(--row-radius)] text-foreground transition-[opacity,background-color,color] duration-150 hover:bg-hover-2/50 active:scale-[0.98]"
      >
        <SearchIcon className="size-[14px]" />
      </button>
    );
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Label htmlFor="sidebar-search" className="sr-only">
        {t("nav.search.ariaLabel")}
      </Label>
      <Input
        ref={searchRef}
        id="sidebar-search"
        placeholder={t("nav.search.ariaLabel")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Escape clears, same as Settings' own search (settings-overlay.tsx)
        // -- no dropdown of its own any more to close (see this component's
        // own top comment: results now render inline in the sidebar body
        // itself, owned by the parent, not a floating popup here).
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onChange("");
            searchRef.current?.blur();
          }
        }}
        // h-7, not h-6 -- matches the collapsed Search button's own h-7
        // square (below) exactly. Left at h-6 before, this row was 4px
        // shorter expanded than collapsed, so every row underneath it
        // visibly shifted down by that same 4px whenever the sidebar
        // collapsed -- confirmed directly, and by the same reasoning
        // size-[14px] on the icon two lines down matches the collapsed
        // button's own icon size too (both dropped from 16px to 14px
        // together, per the "designer compact" icon token below, so this
        // parity holds), instead of visibly growing on collapse.
        // md:text-[12px]: Input's own base classes (ui/input.tsx) carry
        // "text-base md:text-sm" -- both scoped variants distinct from this
        // plain "text-[12px]" in twMerge's eyes (different breakpoint
        // groups don't get merged away), and md:text-sm's own media query
        // wins the cascade at this app's actual sidebar widths (always
        // well past the md breakpoint), rendering at 14px instead of the
        // sidebar's real 12px row text size (RailButton's own label span)
        // -- confirmed directly via getComputedStyle. Repeating the same
        // raw-px value under md: is what actually beats it.
        // pl-[32px] -- matches RailButton's own icon-to-label gap exactly
        // (measured directly, getBoundingClientRect on both): that row's
        // own icon-glyph-right-edge to label-left-edge gap is 10px, not
        // the 8px its own ml-2 label margin alone would suggest --
        // RailButton's icon glyph itself (16px) sits centered inside a
        // slightly larger 20px span, so the *visible* icon edge is 2px
        // inside that span's own edge, adding 2px on top of the 8px
        // margin. Was pl-[30px] -- confirmed via screenshot as still 2px
        // short (the icon below was the same 2px short of RailButton's
        // own left inset, so the whole row read as shifted left) -- both
        // fixed together here.
        // border-border -- per explicit request ("add a border to the
        // Find, the same border color as the sidebar"), same token the
        // sidebar's own edge (<aside>'s own border-r border-border) already
        // uses.
        // text-xs -- per explicit request ("do like dray's [sidebar text
        // sizes], because I want to be consistent" -> "keep all text-xs at
        // the sidebar"): dray's own reference size is a real rem-based
        // token (--text-ui, 0.8125rem/13px), not a raw px value, and this
        // app's own Tailwind theme already has a matching real token in
        // text-xs (0.75rem/12px, unmodified default) -- landing on the
        // *shared utility class* is what actually matters for "consistent"
        // and "responsive" here (it scales with the root font-size the same
        // way dray's own token does), not chasing dray's exact 13px via a
        // one-off text-[0.8125rem] arbitrary value that isn't a real shared
        // token in this app at all. md:text-xs alongside the bare text-xs
        // -- ui/input.tsx's own base classes carry a competing md:text-sm
        // that otherwise wins the cascade at this app's real widths (always
        // past md); repeating the same class under that variant is what
        // actually beats it (confirmed directly via getComputedStyle,
        // same bug/fix this row's search input already had before).
        // focus-visible:border-focus-accent only, no ring any more -- per
        // explicit request (re-using just this one color detail from a
        // pasted reference sidebar's own search field, "that once we
        // click at it that goes blue"), not the rest of that reference's
        // own components/structure. Was border + ring together (a "too
        // blue" complaint was raised and then retracted -- "sorry, its
        // not, my fault"), but confirmed directly as a real, separate gap
        // later ("still getting the extra highlight instead of the
        // border going blue"): the ring read as an unwanted glow on top
        // of the border, not the plain border-color change that was
        // actually asked for.
        // rounded-[var(--row-radius-sm)], not the full --row-radius --
        // went through rounded-xl (index.css's --radius-xl token, 8.4px,
        // near-but-not-equal), then a literal rounded-[8px], then the
        // full shared --row-radius, each confirmed directly as still not
        // matching the compose box ("the sidebar search still too
        // rounded compared to the compose"): this input is only 28px
        // tall vs. the compose box's own ~85px+, so the *same* px radius
        // reads visibly rounder here purely from that height difference
        // -- literal-equal was never going to fix it. --row-radius-sm
        // (index.css's :root, a calc()'d fraction of --row-radius, so it
        // still can't drift independently and inherits the same
        // responsive scaling) is sized for this input's own height
        // instead.
        // text-foreground for the real typed text -- per explicit request
        // ("the icons at the search bar, text and collapse icon and <>
        // need to be updated to the new font color"), matching the rest
        // of the sidebar's own move off text-muted-foreground. The
        // placeholder itself stays muted -- that's normal input UX, not
        // part of this fix.
        // placeholder:text-foreground too now, not text-muted-foreground --
        // per explicit follow-up ("the search and command f should be
        // updated to the new color").
        className="h-7 rounded-[var(--row-radius-sm)] border border-border bg-transparent pl-[30px] text-xs font-normal text-foreground placeholder:text-foreground placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0 focus-visible:border-focus-accent md:text-xs"
      />
      {/* left-[9px], not left-1.5 -- matches RailButton's own icon
          *visible* left edge exactly, recomputed for its own current
          numbers: that row's icon glyph (14px, the compact icon token)
          sits centered inside a 20px span itself inset px-1.5/6px (the
          compact itemPx token) from the row's edge, so its own visible
          left edge sits 3px past that span's edge (6+3=9px total). This
          used to be left-1.5 (6px), correct for RailButton's *pre-compact*
          numbers (px-1/4px padding + a 16px icon, 4+2=6) -- confirmed
          directly as a real, now-stale mismatch ("the icon at the search
          bar does not align in a vertical line compared to the getting
          started, inbox, new icons") once RailButton's own numbers moved
          on without this row following. pl-[30px] on the input above --
          same recompute: row edge (6px) + icon span width (20px) + the
          row's own icon-to-label gap (ml-1/4px) = 30px, was pl-[32px]. */}
      {/* text-foreground, not text-muted-foreground -- same sidebar-wide
          fix as the input's own text just above. */}
      <SearchIcon className="pointer-events-none absolute top-1/2 left-[9px] size-[14px] -translate-y-1/2 text-foreground select-none" />
      <AnimatePresence mode="popLayout" initial={false}>
        {value ? (
          <motion.button
            key="clear"
            type="button"
            aria-label={t("nav.search.clearAriaLabel")}
            onClick={() => {
              onChange("");
              searchRef.current?.focus();
            }}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: spring.fast }}
            exit={{ y: 8, opacity: 0, transition: spring.fast.exit }}
            className="absolute top-1/2 right-1 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-hover-2/50 hover:text-ink"
          >
            <XIcon className="size-[10px]" />
          </motion.button>
        ) : (
          <motion.button
            key="kbd"
            type="button"
            aria-label={t("nav.search.findAriaLabel")}
            tabIndex={-1}
            onClick={() => searchRef.current?.focus()}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: spring.fast }}
            exit={{ y: 8, opacity: 0, transition: spring.fast.exit }}
            // Real <button>, not a plain <motion.div> -- per explicit
            // request ("make the command f be a button in case someone
            // hovers over it and not be a selectable text"): was
            // pointer-events-none (couldn't be hovered/clicked at all) and
            // wrapped a <kbd> (Kbd's own base classes already carry
            // select-none/pointer-events-none, but the outer wrapper being
            // non-interactive meant nothing above it responded to a hover
            // either). rounded-[4px]/hover:bg-hover-2/50, same hover
            // treatment every other icon-only button in this sidebar uses.
            // tabIndex={-1} -- this duplicates the Find input's own focus
            // (Cmd/Ctrl+F, or clicking directly into the input itself),
            // not a second real tab stop for the same action.
            className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center rounded-[4px] transition-colors hover:bg-hover-2/50"
          >
            {/* Combined chip ("⌘F"/"Ctrl+F") -- per explicit request
                ("remove the command k border and make then together but
                also smaller font size"): border-none (was border
                border-border) and text-2xs (10px, was text-[12px]) --
                smaller than the sidebar's own row text size now,
                deliberately, since this reads as a light hint next to Find's
                own placeholder. */}
            {/* text-foreground, not text-muted-foreground -- per explicit
                request ("the search and command f should be updated to
                the new color"), matching the rest of the sidebar's own
                move off text-muted-foreground. */}
            <Kbd className="h-5 min-w-0 gap-0 rounded-[4px] border-none bg-transparent px-1 text-2xs leading-none font-normal text-foreground">
              {isMac ? "⌘F" : "Ctrl+F"}
            </Kbd>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

type SidebarNavProps = {
  className?: string;
  fill?: boolean;
  onNewChat?: () => void;
  activeNav?: string;
  onNavigate?: (key: string) => void;
  projects?: SidebarProject[];
  recents?: SidebarRecent[];
  // Fired after a recent chat is archived or deleted (its own "..." menu,
  // below) so AppLayout.tsx's own refreshSidebarLists can refetch --
  // SidebarNav has no fetch of its own for `recents`, it's owned by the
  // caller (this file's own top comment on why projects/recents are props,
  // not local state), so a change made here has to be reported back up
  // rather than just mutating a local copy.
  onRecentsChanged?: () => void;
  // Fired whenever collapsed state changes -- collapsed itself stays
  // internal, self-managed state (see this file's own top comment), this
  // is just a notification so top-bar.tsx can keep its own search-bar
  // spacer in sync with this sidebar's real current width.
  onCollapsedChange?: (collapsed: boolean) => void;
  // Bumped (any new value) by AppLayout.tsx's own standalone toggle --
  // the desktop-app-only button that re-expands this sidebar when it's
  // fully collapsed to width 0 (see the <aside>'s own comment on
  // fullyCollapsed), a state this sidebar's own internal toggle button
  // is no longer visible/reachable in to undo from the inside. collapsed
  // itself still isn't a controlled prop (this file's own top comment) --
  // this is a one-way trigger, not a mirrored value, so external code
  // still can't read or drive collapsed the rest of the time.
  expandSignal?: number;
  // Threaded down to the sidebar's own standalone Settings row (below)
  // -- navigates straight to /settings/general (AppLayout.tsx's own
  // openSettings) instead of that row's own plain navigate("/settings")
  // fallback, so it lands on a real section immediately rather than
  // bouncing through the /settings -> /settings/general redirect
  // (App.tsx) first.
  onOpenSettings?: () => void;
  // True on any route that isn't one of this sidebar's own real
  // destinations (Home, Welcome, Projects, Apps, an actual chat) -- the
  // top bar's Agent/Code/Design tabs, the avatar dropdown's Settings/Docs/
  // Help/Models rows, and the top bar's Notifications/Activity/Invite
  // buttons all land somewhere this sidebar has no real navigation state
  // for, so its own top rows (Welcome/New Chat/Project/Apps) swap to a
  // generic blank-page-icon + "Placeholder" row instead of misleadingly
  // still showing their normal chat-mode icons/labels. The Projects and
  // Recents lists below are unaffected either way -- see their own
  // rendering further down, untouched by this prop.
  placeholderNav?: boolean;
};

// Exported now -- settings-overlay.tsx's own SettingsSidebarNav reuses this
// too, alongside RailButton (that export's own comment has the full
// reasoning), for the same magnetic proximity-hover highlight.
export function GlideGroup({ children }: { children: ReactNode }) {
  return (
    // bg-hover-2/50, not the full-strength bg-hover-2 the active row itself
    // uses -- the sliding hover indicator now needs to read as visibly
    // lighter than "active", since the active row keeps its own background
    // showing underneath it while hovering elsewhere (see RailButton).
    // inset-x-2 -- GlideMenu measures the hovered row's own top/height, not
    // its width, so the highlight's horizontal extent is independent of
    // the row and has to be matched here by hand. Rows now fill the same
    // mx-2 inset this container itself uses (w-[204px], see RailButton),
    // so a plain symmetric inset-x-2 lines up exactly with every row's own
    // edges -- no more hand-tuned asymmetric right inset needed.
    <GlideMenu
      rowSelector="[data-row]"
      highlightClassName="inset-x-2 rounded-[7px] bg-hover-2/50"
      // gap-px -> gap-1 -- per explicit request ("increase the gap in
      // between the Find and the next menu item... make sure that we have
      // that gap for all menu items in the sidebar"): one shared component
      // behind every row list in the sidebar (main nav, Projects, Recents),
      // so bumping it here applies everywhere at once, Find's own row
      // included (it renders as a plain child of this same flex-col, just
      // not a [data-row] itself -- see its own comment).
      className="group/glide flex flex-col gap-1"
    >
      {children}
    </GlideMenu>
  );
}

// A project row -- expandable drawer (chevron) plus a "..." menu
// (rename/delete). Drag-and-drop was removed entirely per explicit request
// ("remove the drag and drop features, we don't need that for now, remove
// everything about it and keep the drawer open and close at projects") --
// this used to also be a dnd-kit sortable/droppable target; that's gone
// now, only the expand/collapse and rename/delete behavior remains.
function ProjectRow({
  item,
  expanded,
  hasChats,
  onToggleExpand,
  onSelect,
  onNewChat,
  menuOpen,
  onMenuOpenChange,
  onRename,
  onDeleteRequest,
  rowWidth,
}: {
  item: SidebarProject;
  expanded: boolean;
  hasChats: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onNewChat: () => void;
  menuOpen: boolean;
  // Same real bug/fix as ChatRow's own identical prop -- that component's
  // own comment has the full reasoning.
  rowWidth: number;
  onMenuOpenChange: (open: boolean) => void;
  onRename: (name: string) => void;
  onDeleteRequest: () => void;
}) {
  const { t } = useTranslation();
  // Inline rename -- per explicit request ("the three dots to rename or
  // delete project"). Same compact input+check+x shape the "New project"
  // popover already uses, swapped in over the row's own label instead of a
  // separate dialog, since there's no dedicated project detail page (yet)
  // to host a bigger rename UI the way a chat's own breadcrumb does.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.label) onRename(trimmed);
    setEditing(false);
  }
  // Same reblur fix as the avatar/help triggers' own onOpenChange
  // (this file's own comment on those has the full reasoning) -- real bug,
  // confirmed directly ("when closing the dropdown of the three dots...
  // it should actually fade out, i have to click somewhere at the sidebar
  // to make that fade out"): Base UI returns real DOM focus to this
  // trigger a beat after the menu closes, and group-focus-within:opacity-100
  // (added so the icon stays visible while genuinely keyboard-focused) was
  // reading that returned focus as still-focused indefinitely, until an
  // unrelated click moved focus elsewhere.
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  function handleMenuOpenChange(open: boolean) {
    onMenuOpenChange(open);
    if (open) return;
    const button = menuTriggerRef.current;
    if (!button) return;
    const reblur = () => button.blur();
    button.addEventListener("focus", reblur, { once: true });
    setTimeout(() => button.removeEventListener("focus", reblur), 1000);
  }
  // Swaps this row's own "..." menu content in place (below), not the
  // shared modal Dialog this used to open -- per explicit request ("remove
  // the overlay when we try to delete a project or chat, i want us to get
  // a popover similar to when we want to create a project, either to
  // confirm delete or cancel").
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Measured once the "More" content actually mounts/lays out -- keeps the
  // panel from shrinking to the shorter Delete confirm's own height without
  // permanently double-mounting real, proximity-hover-registered MenuItems
  // (this row's own comment on the wrapper below has the full bug report).
  const [moreContentHeight, setMoreContentHeight] = useState<number>();
  const moreContentRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setMoreContentHeight((prev) => Math.max(prev ?? 0, el.offsetHeight));
  }, []);
  return (
    <span
      // No data-row -- per explicit request ("the bg hover still there as
      // well"): GlideGroup's own sliding hover highlight (GlideMenu,
      // matched via rowSelector="[data-row]") is a separate mechanism from
      // the active-state bg-accent already removed below, and applies to
      // any element carrying this attribute regardless.
      // t-row-in -- same fade/slide-in-on-real-mount treatment chat rows
      // already have (index.css), added here per explicit follow-up
      // ("still snapping"): without it, a project row has no transition at
      // all between not existing and existing, so the moment
      // GET /projects actually resolves (necessarily after this sidebar's
      // own initial paint -- a network round trip can't finish before the
      // page first renders) it appears with a hard, instant snap instead
      // of the same graceful entrance every chat row gets.
      className="t-tt-wrap t-row-in group mx-2 block rounded-[var(--row-radius)]"
      style={{ width: rowWidth }}
      onMouseEnter={positionFixedTooltip}
      onFocus={positionFixedTooltip}
    >
      <span className="t-tt-trigger relative z-10 flex h-7 w-full transform-gpu items-center rounded-[var(--row-radius)] px-2 pr-12 text-left transition-[background-color,color,transform] duration-150 select-none">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraft(item.label);
                setEditing(false);
              }
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="h-5 min-w-0 flex-1 border-none bg-transparent px-1 text-xs focus-visible:ring-0"
          />
        ) : (
          // flex-1/text-left, no icon and no extra ml -- per explicit
          // request ("both icon and text should be all the way to the
          // left and not centralised"): the chevron above is now the only
          // leading element, so the label sits immediately after it.
          <button type="button" aria-describedby={`project-tt-${item.id}`} onClick={onSelect} className="flex min-w-0 flex-1 items-center text-left">
            {/* Always the same color regardless of active state, per that
                same earlier request -- now text-foreground, not text-
                muted-foreground, per a later explicit follow-up ("our
                entire sidebar font color items apart from describer needs
                to be the same color as the help button... match our font
                color at the chat"). */}
            <span className="min-w-0 flex-1 truncate text-xs font-normal text-foreground">{item.label}</span>
          </button>
        )}
      </span>
      <span id={`project-tt-${item.id}`} role="tooltip" className="t-tt t-tt-fixed">
        {item.label}
      </span>
      {/* Chevron + "..." grouped together at the right edge -- per explicit
          request ("the arrows to expand and collapse should be at the left
          of the three dots horizontal"), moved out of its old spot right
          after the drag handle. hasChats-gated, not always rendered -- per
          explicit request/screenshot ("when created a project but there's
          no chat inside the > is visible, that should only show when we
          have a chat inside the project"): an empty project has nothing to
          expand into, so the affordance would open onto a blank drawer.
          (The old "always rendered" reasoning here was about drag-and-drop,
          removed entirely since -- see this row's own top comment.) */}
      <div className="absolute top-1/2 right-1 z-20 flex -translate-y-1/2 items-center gap-0.5">
        {hasChats && (
          <button
            type="button"
            aria-label={expanded ? "Collapse project" : "Expand project"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand();
            }}
            // Plain text-muted-foreground, no hover bg/color change -- per
            // explicit request ("the > is getting the hover and active
            // effect, it should match the text style"), matching the row's
            // own label (also a static text-muted-foreground, never
            // active-dependent, per the same earlier request). -mr-1 -- the
            // chevron glyph itself doesn't fill its own box the way "+" and
            // "..." do, so the same DOM gap read as visually bigger here than
            // between the other two -- confirmed directly ("there's a bigger
            // space between > and +"). Pulls the next button in to match.
            className="-mr-1 flex size-5 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground"
          >
            {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
          </button>
        )}
        {/* "..." menu -- per explicit request ("we should add at right side
            the three dots to rename or delete project"), same shape as a
            chat row's own menu (ChatRow, below). */}
        <BaseDropdownMenu
          size="compact"
          open={menuOpen}
          onOpenChange={(open) => {
            handleMenuOpenChange(open);
            // Reset back to the plain menu, not the confirm prompt -- per
            // explicit request ("remove the overlay when we try to delete a
            // project or chat, i want us to get a popover similar to when
            // we want to create a project, either to confirm delete or
            // cancel"), simplified after a first, more complex pass (a
            // separate anchored Popover) to just this: Delete swaps the
            // SAME already-open "..." menu's own content in place, no
            // second popup, no anchor math -- and closing/reopening this
            // menu should never reopen straight onto that swapped prompt.
            if (!open) setConfirmingDelete(false);
          }}
        >
        <BaseDropdownTrigger
          render={
            <MoreTrigger
              ref={menuTriggerRef}
              aria-label={`More options for ${item.label}`}
              onClick={(event) => event.stopPropagation()}
              active={menuOpen}
            />
          }
        />
        <BaseDropdownContent align="start" side="right" className="w-40 overflow-hidden">
          {/* AnimatePresence mode="wait", real unmount, min-height pinned to
              the measured "More" content -- real bug, confirmed directly
              via screenshot ("it looks like there are some rows in there
              and the hover is going on top"): an earlier grid-stacked
              version kept the "More" MenuItems permanently mounted (just
              opacity-0) so the panel wouldn't shrink for the shorter
              Delete confirm, but a mounted MenuItem stays registered with
              the shared proximity-hover system regardless of its own
              opacity/pointer-events -- moving the mouse over the confirm
              view's own buttons still picked the nearest *hidden* row and
              rendered its hover-highlight overlay on top, since that
              overlay is computed from container-level mousemove, not each
              item's own (disabled) pointer events. Measuring the "More"
              view's real height once and applying it as this wrapper's own
              min-height keeps the same "don't shrink for Delete" result
              without ever double-mounting real menu items.
              */}
          <div style={{ minHeight: moreContentHeight }} className="flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {confirmingDelete ? (
              <motion.div
                key="confirm"
                className="flex flex-1 flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <BaseDropdownLabel>{t("common.delete")}</BaseDropdownLabel>
                {/* text-foreground, not text-muted-foreground -- per explicit
                    request ("would you like to delete font color is not the
                    same font color as new chat or rename, is looks like is
                    not our active color"), matching every row's own always-
                    foreground color (menu-item.tsx's own app-wide fix). */}
                <div className="px-2 pb-2 text-[11px] font-normal text-foreground">
                  Would you like to delete this project?
                </div>
                {/* mt-auto -- per explicit follow-up ("move cancel and
                    delete to the bottom as there's space"): this view's own
                    content is shorter than the panel's own reserved
                    min-height (pinned to "More"'s own taller content just
                    above), so the button row now sits flush at the bottom
                    of that reserved space instead of right under the
                    question. */}
                <div className="mt-auto flex gap-1.5 px-2 pb-1.5">
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
                      onDeleteRequest();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                ref={moreContentRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <BaseDropdownLabel>{t("common.more")}</BaseDropdownLabel>
                {/* Moved in from its own standalone "+" beside the chevron --
                    per explicit request ("add the create chat inside more and
                    not beside >"). */}
                <BaseMenuItem
                  index={0}
                  icon={PlusIcon}
                  label={t("common.newChat")}
                  className="gap-[7px]"
                  onSelect={onNewChat}
                />
                <BaseMenuItem
                  index={1}
                  icon={EditIcon}
                  label={t("common.rename")}
                  className="gap-[7px]"
                  onSelect={() => {
                    setDraft(item.label);
                    setEditing(true);
                  }}
                />
                {/* closeOnClick={false} -- selecting this must swap the
                    menu's own content in place (the confirm prompt above),
                    not close the popup out from under it, which Menu.Item's
                    own default closeOnClick would otherwise do immediately
                    on select. */}
                <BaseMenuItem
                  index={2}
                  icon={DeleteIcon}
                  label={t("common.delete")}
                  destructive
                  closeOnClick={false}
                  className="gap-[7px]"
                  onSelect={() => setConfirmingDelete(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </BaseDropdownContent>
        </BaseDropdownMenu>
      </div>
    </span>
  );
}

// Same overlapping-icon-stack technique as InboxPage.tsx's own ModelStack
// (that component's own comment has the full reasoning) -- not reused
// directly since it isn't exported, and this row's own much narrower width
// needs a smaller cap and icon size than an inbox card affords.
//
// Overlapping, with a real ring -- per explicit follow-up ("the models in
// the sidebar and at topbar should be stacked with a 1px border that's the
// same color as our bg so users can see the multiple models but not take
// all the space"), reversing an earlier "no circle/ring, small positive
// gap" decision. Back to InboxPage.tsx's own ModelStack technique (that
// component's own comment has the full precedent, also ui/avatar.tsx's
// AvatarGroup) -- -space-x-1 overlap, ring-1 ring-background (1px, not
// that component's 2px: a request for "1px border" specifically).
//
// Real overflow handling, matching AppLayout.tsx's own chat-header model
// stack (that component's own comment has the full request chain: up to
// 4 real icons if that's everything, else the first 3 stay real icons
// and the 4th slot is the real total provider count) -- per explicit
// follow-up ("The top bar is correct but not the sidebar"). No HoverCard
// here though, unlike that one -- per a further explicit follow-up ("the
// sidebar should not have the hover"); this row is already a real link
// with its own hover state, so a popover on top of that read as one
// hover behavior too many. size-4/size-4.5, not size-3/size-3.5 -- per a
// further follow-up ("increase the size a little bit more on the
// sidebar as well, its hard to see").
export function SidebarModelStack({ models }: { models: { provider: string; model: string }[] }) {
  const visible = models.length > 4 ? models.slice(0, 3) : models.slice(0, 4);
  return (
    <span className="mr-1 flex shrink-0 -space-x-1">
      {visible.map((entry, index) => {
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
  );
}

// A chat row -- Archive/Delete via its own "..." menu. Drag-and-drop was
// removed entirely per explicit request ("remove the drag and drop
// features, we don't need that for now"); this used to also be a dnd-kit
// sortable item with a drag handle.
function ChatRow({
  item,
  active,
  projects,
  menuOpen,
  onMenuOpenChange,
  onSelect,
  onArchive,
  onDeleteRequest,
  onAssignToProject,
  rowWidth,
}: {
  item: SidebarRecent;
  active: boolean;
  projects: SidebarProject[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onArchive: () => void;
  onDeleteRequest: () => void;
  onAssignToProject: (projectId: string | null) => void;
  // Real bug, confirmed directly ("the chat name... width are not
  // expanding dynamically"): this row's own w-[204px] Tailwind class was
  // a fixed value, independent of the sidebar's own live, now-draggable
  // width -- an inline style (below) is what actually lets it track a
  // runtime value; a Tailwind class can't interpolate one.
  rowWidth: number;
}) {
  const { t } = useTranslation();
  // Same reblur fix as ProjectRow's own "..." trigger (that row's own
  // comment has the full bug report).
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  function handleMenuOpenChange(open: boolean) {
    onMenuOpenChange(open);
    if (open) return;
    const button = menuTriggerRef.current;
    if (!button) return;
    const reblur = () => button.blur();
    button.addEventListener("focus", reblur, { once: true });
    setTimeout(() => button.removeEventListener("focus", reblur), 1000);
  }
  // Delete swaps this same "..." menu's own content in place, no separate
  // popup/modal -- see ProjectRow's own identical comment for the full
  // reasoning. hostingEnabled/isNonOwnerHostedDelete moved down here from
  // the parent (same real check, just now scoped to this row instead of a
  // single shared dialog's own state) -- see the parent's own former
  // comment on this, still true: a hosted chat's non-owner sees different
  // copy ("removed from your device") since server.rs's own delete_session
  // only really deletes it for the chat's real owner.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Same measured-min-height fix as ProjectRow's own identical pair -- that
  // row's own comment on the wrapper below has the full bug report.
  const [moreContentHeight, setMoreContentHeight] = useState<number>();
  const moreContentRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setMoreContentHeight((prev) => Math.max(prev ?? 0, el.offsetHeight));
  }, []);
  const [hostingEnabled, setHostingEnabled] = useState(false);
  useEffect(() => {
    if (!confirmingDelete) return;
    let cancelled = false;
    fetch("/host/status")
      .then((res) => res.json())
      .then((data: { hosting: boolean }) => {
        if (!cancelled) setHostingEnabled(data.hosting);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [confirmingDelete]);
  const isNonOwnerHostedDelete =
    hostingEnabled && item.creatorName != null && item.creatorName !== getUserDisplayName();
  return (
    <span
      data-chat-id={item.id}
      className="t-tt-wrap t-row-in group relative mx-2 block"
      style={{ width: rowWidth }}
      onMouseEnter={positionFixedTooltip}
      onFocus={positionFixedTooltip}
    >
      <button
        data-row
        type="button"
        aria-describedby={`recent-tt-${item.id}`}
        onClick={onSelect}
        className={`t-tt-trigger relative z-10 flex h-7 w-full transform-gpu items-center rounded-[var(--row-radius)] px-2 pr-7 text-left transition-[background-color,color,transform] duration-150 select-none active:scale-[0.98] ${active ? "bg-accent" : ""}`}
      >
        {/* text-foreground always now, not muted while inactive -- per
            explicit request ("our entire sidebar font color items apart
            from describer needs to be the same color as the help
            button... match our font color at the chat"). */}
        {/* Every distinct provider this chat has actually used, matching
            Inbox's own multi-provider icon stack (InboxPage.tsx's own
            ModelStack) -- per explicit request ("if we add codex to it as
            well, that will show codex... matching the behaviour of inbox").
            Capped at 2, not Inbox's own 3 -- this row (w-[204px]) has far
            less width to spare than an inbox card. Before the label, not
            after -- real bug, confirmed directly ("showing at the right side
            and not left side"): the label's own flex-1 grows to fill all
            remaining space, which pushed a trailing sibling all the way to
            the row's right edge instead of sitting beside the label on the
            left. */}
        {item.models && item.models.length > 0 && <SidebarModelStack models={item.models} />}
        <span className="min-w-0 flex-1 truncate text-xs font-normal text-foreground">{item.label}</span>
      </button>
      <span id={`recent-tt-${item.id}`} role="tooltip" className="t-tt t-tt-fixed">
        {item.label}
      </span>
      <BaseDropdownMenu
        size="compact"
        open={menuOpen}
        onOpenChange={(open) => {
          handleMenuOpenChange(open);
          // Reset to the plain menu, not the confirm prompt -- same reason
          // as ProjectRow's own identical reset.
          if (!open) setConfirmingDelete(false);
        }}
      >
        <BaseDropdownTrigger
          render={
            <MoreTrigger
              ref={menuTriggerRef}
              aria-label={`More options for ${item.label}`}
              onClick={(event) => event.stopPropagation()}
              active={menuOpen}
              className="absolute top-1/2 right-1 z-20 -translate-y-1/2"
            />
          }
        />
        <BaseDropdownContent align="start" side="right" className="w-40 overflow-hidden">
          {/* AnimatePresence mode="wait", real unmount, min-height pinned to
              the measured "More" content -- see ProjectRow's own identical
              comment for the full bug report (a ghost hover-highlight from
              a permanently-mounted-but-invisible "More" row, confirmed via
              screenshot). */}
          <div style={{ minHeight: moreContentHeight }} className="flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {confirmingDelete ? (
              <motion.div
                key="confirm"
                className="flex flex-1 flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <BaseDropdownLabel>{t("common.delete")}</BaseDropdownLabel>
                {/* text-foreground, not text-muted-foreground -- see
                    ProjectRow's own identical fix/comment. */}
                <div className="px-2 pb-2 text-[11px] font-normal text-foreground">
                  {isNonOwnerHostedDelete
                    ? "This chat will be removed from your device only. Other participants will not be affected."
                    : "Would you like to delete this chat?"}
                </div>
                {/* mt-auto -- see ProjectRow's own identical follow-up
                    ("move cancel and delete to the bottom as there's
                    space"). */}
                <div className="mt-auto flex gap-1.5 px-2 pb-1.5">
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
                      onDeleteRequest();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                ref={moreContentRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <BaseDropdownLabel>{t("common.more")}</BaseDropdownLabel>
                {/* A chat already inside a project shows a plain "Remove from
                    project" -- no submenu, no list of other projects to move to
                    -- per explicit follow-up ("remove the third menu and flip add
                    project to remove from project"). Only a chat with no project
                    yet gets the real "Add to project" submenu. */}
                {item.projectId ? (
                  <BaseMenuItem
                    index={0}
                    icon={FolderIcon}
                    label={t("nav.chat.removeFromProject")}
                    className="gap-[7px]"
                    onSelect={() => onAssignToProject(null)}
                  />
                ) : projects.length > 0 ? (
                  <DropdownSubMenuItem index={0} icon={FolderIcon} label={t("nav.chat.addToProject")} className="gap-[7px] text-[12px]">
                    <BaseDropdownLabel>{t("nav.projects")}</BaseDropdownLabel>
                    {projects.map((project) => (
                      <DropdownSubItem
                        key={project.id}
                        className="py-1.5 pl-2.5 text-[12px]"
                        onClick={() => onAssignToProject(project.id)}
                      >
                        {project.label}
                      </DropdownSubItem>
                    ))}
                  </DropdownSubMenuItem>
                ) : (
                  // Plain, disabled row -- not a submenu -- when there's nothing to
                  // add to yet. Per explicit request/screenshot ("the add to
                  // project should only show the other dropdown when there's a
                  // project created which at the moment doesn't and show the
                  // projects dropdown as empty"): a submenu that always opens onto
                  // an empty "Projects" panel read as broken, not as "no projects
                  // yet."
                  <BaseMenuItem index={0} icon={FolderIcon} label={t("nav.chat.addToProject")} className="gap-[7px]" disabled />
                )}
                <DropdownSeparator />
                <BaseMenuItem index={1} icon={ArchiveIcon} label={t("common.archive")} className="gap-[7px]" onSelect={onArchive} />
                {/* closeOnClick={false} -- see ProjectRow's own identical
                    Delete row for the full reasoning (swaps this menu's own
                    content in place instead of closing it). */}
                <BaseMenuItem
                  index={2}
                  icon={DeleteIcon}
                  label={t("common.delete")}
                  destructive
                  closeOnClick={false}
                  className="gap-[7px]"
                  onSelect={() => setConfirmingDelete(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </BaseDropdownContent>
      </BaseDropdownMenu>
    </span>
  );
}

// Exported now -- settings-overlay.tsx's own SettingsSidebarNav reuses this
// directly for its section rows (per explicit request, "the sidebar at
// settings needs to match our sidebar row sizes items and gaps and text and
// icon spacing") instead of a second, hand-approximated row shape that
// could drift from this one.
export function RailButton({
  icon,
  label,
  ariaLabel,
  active = false,
  url,
  onClick,
  fullWidth = true,
  collapsed = false,
  pressEffect = true,
  danger = false,
  glideRow = true,
  // Defaults to SIDEBAR_ROW_WIDTH -- settings-overlay.tsx's own
  // (non-resizable) SettingsSidebarNav calls this with no override and
  // keeps that fixed width; sidebar-nav.tsx's own real, now-draggable
  // <aside> passes its live computed rowWidth instead, per explicit
  // request ("the chat name and the search bar width are not expanding
  // dynamically").
  rowWidth = SIDEBAR_ROW_WIDTH,
}: {
  icon: ReactNode;
  label: string;
  // Defaults to `label` -- only Welcome needs to override this (to
  // "Expand sidebar" while its icon shows the collapse/expand toggle
  // instead of the waving hand), since every other row's accessible name
  // and visible label are always the same string.
  ariaLabel?: string;
  active?: boolean;
  url?: string;
  onClick?: (event: MouseEvent) => void;
  // false for the Welcome row, which shares its (expanded-only) row with
  // the sidebar toggle button instead of owning the full 204px inset on
  // its own -- mx-2/w-[204px] moves to that shared wrapper, and this
  // button just grows to fill whatever's left of it (flex-1 min-w-0)
  // instead of hardcoding its own width. Ignored while collapsed (below).
  fullWidth?: boolean;
  // Icon-only rendering for the collapsed rail: fixed 32px square, no
  // label at all (not just visually hidden -- the label doesn't mount, so
  // there's nothing to truncate/overflow mid-collapse), centered on its
  // own instead of using fullWidth's mx-2/flex-1 sizing.
  collapsed?: boolean;
  // No current callers override this -- kept as an escape hatch for any
  // row that shouldn't visibly "press" on click.
  pressEffect?: boolean;
  // false for Welcome while collapsed -- GlideGroup's own hover highlight
  // (glide-menu.tsx, matched via data-row) is for real nav destinations;
  // the collapsed rail's icon is just the collapse/expand toggle at that
  // point, same reasoning as pressEffect/no active bg above, so it opts
  // out of data-row entirely rather than showing a hover bg that implies
  // it's a selectable nav row.
  glideRow?: boolean;
  // Destructive red in both idle/hover and active states instead of the
  // usual gray/dark ramp -- settings-overlay.tsx's own "Danger zone" row
  // (this component's own export comment has the full reasoning), same
  // semantic color that row already carried before reusing this component.
  danger?: boolean;
  rowWidth?: number;
}) {
  // bg-accent (var(--accent), index.css) on the active row -- the same
  // token the hover highlight itself reads at half opacity
  // (bg-hover-2/50), so active reads as a settled, full-strength version
  // of hover rather than a separate color, matching Synara's own sidebar
  // (both its hover and active rows share one --sidebar-accent token) per
  // explicit request ("copy synara's dark and light mode colors... keep
  // the design component of transparency we agreed earlier"). transform-gpu: the row's own icon/text
  // don't actually move on hover (confirmed directly --
  // getBoundingClientRect is pixel-identical before/during/after), but
  // Chromium can still subpixel-round a hover-triggered repaint
  // differently from its resting paint, reading as a tiny nudge. Forcing
  // this row onto its own stable GPU compositing layer keeps that repaint
  // from ever re-snapping the icon/text's subpixel position.
  // Icon position never changes between collapsed/expanded -- it stays
  // exactly where it already sits in the expanded layout (px-2 = 8px
  // padding from the row's own left edge, unaffected by the row's own
  // width since padding is a fixed px value, not a fraction of it). The
  // row's own *width* (for fullWidth rows -- Welcome, fullWidth=false,
  // is sized by its own wrapper instead) DOES animate now, same duration/
  // easing as the sidebar's own collapse -- without that, an active row's
  // own background (bg-accent below) stayed a full
  // 204px wide bar that the *outer* wrapper's overflow-hidden just cut
  // off mid-shape at 52px, instead of actually shrinking down to match
  // the collapsed rail's own icon-sized real estate. overflow-hidden here
  // is what clips the label as this row's own box narrows around it, on
  // top of the label's own opacity fade below -- both effects together.
  const className = `relative z-10 flex h-7 shrink-0 transform-gpu items-center overflow-hidden rounded-[var(--row-radius)] px-1.5 text-left ${pressEffect ? "active:scale-[0.98]" : ""} ${
    fullWidth ? "mx-2" : "min-w-0 flex-1"
  } ${danger ? "hover:bg-destructive/10" : active ? "bg-accent" : ""}`;
  const style = fullWidth
    ? {
        width: collapsed ? SIDEBAR_COLLAPSED_ROW_WIDTH : rowWidth,
        transition: `background-color 150ms, color 150ms, transform 150ms, width ${SIDEBAR_MOTION_MS}ms ${SIDEBAR_EASING}`,
      }
    : { transition: "background-color 150ms, color 150ms, transform 150ms" };
  const content = (
    <>
      {/* Icon and text both dim together for an inactive row
          (text-muted-foreground, both below) and both go to the same
          text-foreground when active -- one token pair for both, driving
          light/dark automatically via var(--muted-foreground)/
          var(--foreground) (index.css), not a hardcoded hex pair per
          theme; text no longer stays full white in dark mode regardless
          of active state the way it used to. */}
      {/* relative: lets Welcome's own icon prop (the only caller that needs
          it) position a crossfading pair of absolutely-positioned icons
          inside this box -- harmless for every other row, which just
          renders a plain static icon here same as always. */}
      {/* text-foreground always now, not text-muted-foreground while
          inactive -- per explicit request ("our entire sidebar font color
          items apart from describer needs to be the same color as the
          help button... this will match our font color at the chat"):
          active/inactive read via the row's own background highlight
          (bg-accent/bg-hover-2) already, not a separate dimmer text tone. */}
      <span className={`relative flex size-5 shrink-0 items-center justify-center ${danger ? "text-destructive" : "text-foreground"}`}>
        {icon}
      </span>
      {/* flex items-center size-5, same box as the icon span above -- a
          plain inline text node here centers on its own line-height/font
          metrics, not on box height, which put it a couple px off from the
          icon span's flex-centered box (most visible next to a symmetric
          glyph like New Chat's "+", where any offset reads immediately).
          leading-none removes the line-height ambiguity entirely so both
          spans center purely by box height instead. Stays mounted always
          now (not conditionally rendered) -- opacity fades it out in sync
          with the outer wrapper's own width animation (same duration),
          rather than popping instantly, per explicit request -- on top of
          the row's own width shrinking around it (above), for a combined
          fade + clip effect. */}
      {/* ml-1 (4px), not ml-2 (8px) -- per explicit request ("use the new
          sidebar sizes... we are using the designer compact style"): the
          installed preset's own compact size scale (size-context.tsx)
          defines gap: "gap-1" for a dense sidebar's icon-to-label spacing,
          against our own hand-picked 8px. */}
      <span
        className={`ml-1 flex h-5 min-w-0 flex-1 items-center truncate text-xs leading-none font-normal transition-opacity duration-[280ms] ${collapsed ? "opacity-0" : "opacity-100"} ${danger ? "text-destructive" : "text-foreground"}`}
      >
        {label}
      </span>
    </>
  );

  if (url && url.startsWith("/")) {
    return (
      <Link {...(glideRow ? { "data-row": true } : {})} to={url} onClick={onClick} aria-label={ariaLabel ?? label} className={className} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <button {...(glideRow ? { "data-row": true } : {})} type="button" onClick={onClick} aria-label={ariaLabel ?? label} className={className} style={style}>
      {content}
    </button>
  );
}

export default function SidebarNav({
  className = "",
  fill = false,
  onNewChat,
  activeNav,
  onNavigate,
  projects = [],
  recents = [],
  onRecentsChanged,
  onCollapsedChange,
  expandSignal,
  onOpenSettings,
  placeholderNav = false,
}: SidebarNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = useUserDisplayName();
  const isMac = useIsMac();
  // Own in-memory back/forward stack, not react-router's navigate(-1)/(1)
  // (raw History API deltas) -- per explicit request/bug report ("the <>
  // at the sidebar... should reset at refresh? What does other companies
  // do? right now it shows active the < and keeps coming back to new chat
  // twice before going to settings and also has > even though is not
  // going anywhere"). The real browser/webview session history includes
  // entries from BEFORE this app session too (and can carry duplicate
  // entries from redirects), so navigate(-1) had nothing reliable to
  // reflect a "can go back" state from, and navigate(1) had no way to know
  // whether there was ever anything to go forward to. Every reference app
  // (VS Code, Notion, Slack) instead keeps its own bounded, per-session nav
  // stack that starts fresh on reload and disables each arrow the moment
  // there's genuinely nothing on that side.
  const [navStack, setNavStack] = useState<string[]>([location.pathname]);
  const [navIndex, setNavIndex] = useState(0);
  // Set right before navStack/navIndex change in response to a back/
  // forward click below, so the location-tracking effect can tell "the
  // user clicked Back" apart from "a new real navigation happened" instead
  // of re-pushing the page it just navigated FROM as a brand-new entry.
  const navigatingViaHistoryRef = useRef(false);
  useEffect(() => {
    if (navigatingViaHistoryRef.current) {
      navigatingViaHistoryRef.current = false;
      return;
    }
    setNavStack((stack) => {
      if (stack[navIndex] === location.pathname) return stack;
      const truncated = stack.slice(0, navIndex + 1);
      return [...truncated, location.pathname];
    });
    setNavIndex((index) => index + (navStack[index] === location.pathname ? 0 : 1));
    // navStack/navIndex deliberately excluded -- this effect only reacts to
    // a real location change, and reading their current values above
    // (inside the updater functions) already avoids a stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navStack.length - 1;
  function goBack() {
    if (!canGoBack) return;
    navigatingViaHistoryRef.current = true;
    setNavIndex(navIndex - 1);
    navigate(navStack[navIndex - 1]);
  }
  function goForward() {
    if (!canGoForward) return;
    navigatingViaHistoryRef.current = true;
    setNavIndex(navIndex + 1);
    navigate(navStack[navIndex + 1]);
  }
  // "New project" popover -- per explicit request ("we are redirecting when
  // trying to create a project but that should give the popover... project
  // name: then check or x button"), replacing the old plain
  // navigate("/projects") (ProjectsPage.tsx is still just a placeholder red
  // block, not a real create-project destination). newProjectOpen is
  // controlled (not just Popover's own uncontrolled open state) so the x
  // button's own two-stage behavior below can close it programmatically.
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  async function handleCreateProject() {
    const name = newProjectName.trim();
    if (!name || creatingProject) return;
    setCreatingProject(true);
    try {
      const response = await fetch("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        onRecentsChanged?.();
        setNewProjectName("");
        setNewProjectOpen(false);
      }
    } finally {
      setCreatingProject(false);
    }
  }

  // Two-stage, not a single clear-and-close -- per explicit request ("check
  // or x button to delete the name but not close, users should click again
  // to close"): the first click only clears a non-empty draft, so a typo
  // can be wiped without losing the popover itself; a second click (now on
  // an already-empty field) is what actually dismisses it.
  function handleDismissProject() {
    if (newProjectName) {
      setNewProjectName("");
    } else {
      setNewProjectOpen(false);
    }
  }

  // Sidebar drag-and-drop (per explicit request: expandable project
  // drawers, chats reorganizable and droppable into projects, projects
  // reorderable among themselves but not draggable out of their own
  // section). Which projects are currently expanded -- local UI state
  // only, same as selectedProject above; nothing server-side tracks this.
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  // Shared by both the chevron and clicking the row's own label (below) --
  // per explicit request, expanding/collapsing shouldn't require touching
  // the chevron specifically.
  function toggleProjectExpanded(id: string) {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // Force-expand, not toggleProjectExpanded -- SidebarSearch's own "pick a
  // project result" needs the drawer to definitely be open afterward, not
  // to accidentally collapse one that was already open.
  function expandProject(id: string) {
    setExpandedProjectIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }
  // Groups chats by their project_id -- still real, unrelated to the
  // drag-and-drop that used to also live here (removed entirely per
  // explicit request, "remove the drag and drop features, we don't need
  // that for now, remove everything about it and keep the drawer open and
  // close at projects"). A chat's project_id can currently only be set
  // directly against the backend (no UI action sets it any more), but
  // existing assignments still render correctly.
  const rootChats = recents.filter((r) => !r.projectId);
  const chatsForProject = (projectId: string) => recents.filter((r) => r.projectId === projectId);

  // Sidebar search's own state, lifted up from SidebarSearch (now a plain
  // controlled input with no dropdown of its own) -- per explicit request
  // ("I want the search bar at the sidebar in homepage to behave like the
  // search bar of settings... it uses the sidebar to show the findings"):
  // Settings' own search (settings-overlay.tsx) swaps its section list for
  // ranked results in place, not a floating popup layered on top -- this
  // does the same, swapping the Projects/Chats sections below for a flat
  // results list while a query is active.
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const trimmedSearchQuery = debouncedSearchQuery.trim();
  const searching = trimmedSearchQuery.length > 0;
  // Real backend search (github.com/alongsidedotrun/alongside/issues/11),
  // not a client-side title-only substring filter over whatever chats/
  // projects this sidebar already happened to have loaded -- real gap,
  // confirmed directly ("I searched for 'via codex' and that should scope
  // through all chats... to find places where via codex is written"): the
  // old filter could only ever match a chat's own name, never anything
  // actually said inside it.
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  // Models aren't chat/project rows in the backend's own search (there's
  // no per-model row to index), so per explicit request ("we should be
  // able to search for specific models as well") they're matched
  // client-side against the same QUICK_CHAT_MODELS list the compose box's
  // own model picker already uses -- label or provider name, substring,
  // same dynamic-search behavior the backend now gives chats/projects.
  useEffect(() => {
    if (!searching) {
      setSearchResults([]);
      return;
    }
    const needle = trimmedSearchQuery.toLowerCase();
    const modelMatches: SearchResult[] = QUICK_CHAT_MODELS.filter(
      (m) => m.configured && (m.label.toLowerCase().includes(needle) || m.provider.toLowerCase().includes(needle))
    ).map((m) => ({ kind: "model", id: m.value, label: m.label, model: m }));
    let cancelled = false;
    fetch(`/search?q=${encodeURIComponent(trimmedSearchQuery)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(
        (
          rows: {
            chat_id: string;
            chat_name: string;
            project_id: string | null;
            matched_in: "message" | "chat_name" | "project_name";
            snippet: string;
          }[]
        ) => {
          if (cancelled) return;
          setSearchResults([
            ...modelMatches,
            ...rows.map((row) => ({
              kind: "chat" as const,
              id: row.chat_id,
              label: row.chat_name,
              matchedIn: row.matched_in,
              snippet: row.matched_in === "message" ? row.snippet : undefined,
            })),
          ]);
        }
      )
      .catch(() => {
        if (!cancelled) setSearchResults(modelMatches);
      });
    return () => {
      cancelled = true;
    };
  }, [searching, trimmedSearchQuery]);
  function pickSearchResult(item: SearchResult) {
    setSearchQuery("");
    if (item.kind === "model") {
      navigateAndClose(() => navigate("/", { state: { selectedModel: item.id } }));
    } else if (item.kind === "chat") {
      navigateAndClose(() => navigate(`/chat/${item.id}`));
    } else {
      navigateAndClose(() => expandProject(item.id));
    }
  }

  // A recent row's own id IS a real chat id now (recents, its own prop doc
  // comment, is backed by GET /sessions -- the SQLite migration) -- its
  // click handler (below) navigates to /chat/:id for real. Derived directly
  // from the URL (not local click-only state) so the highlight actually
  // clears when the route changes some other way -- New Chat, browser
  // back/forward, etc. -- instead of staying stuck on whichever row was
  // last clicked.
  const selectedRecent = location.pathname.startsWith("/chat/")
    ? location.pathname.slice("/chat/".length)
    : null;
  // Reveals the active chat in the sidebar whenever it changes via some
  // route OTHER than clicking its own row here -- per explicit request
  // ("when opening a chat via inbox that's inside of a project or not
  // visible at the chat because there are multiple chats and i have to
  // scroll, we should focus that chat on the sidebar"). Expands its
  // project first if it's nested and currently collapsed, then scrolls it
  // into view once that expand has actually rendered (a rAF, not the same
  // tick -- the row doesn't exist in the DOM yet if the project just
  // switched from collapsed to expanded this same effect run).
  useEffect(() => {
    if (!selectedRecent) return;
    const projectId = recents.find((r) => r.id === selectedRecent)?.projectId;
    if (projectId && !expandedProjectIds.has(projectId)) {
      setExpandedProjectIds((prev) => new Set(prev).add(projectId));
    }
    const raf = requestAnimationFrame(() => {
      document
        .querySelector(`[data-chat-id="${selectedRecent}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedRecent, recents]);
  // Per-chat "..." menu (Archive/Delete) -- per explicit request. menuOpenId
  // keeps the "..." trigger visible for whichever row's own menu is
  // genuinely open even after the mouse leaves it (group-hover alone would
  // otherwise hide it mid-interaction). Delete's own confirm/cancel now
  // lives inside ChatRow itself (swaps the "..." menu's own content in
  // place -- that component's own comment has the full reasoning, per
  // explicit request "remove the overlay when we try to delete a project
  // or chat, i want us to get a popover similar to when we want to create
  // a project"), not a shared modal Dialog here any more.
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // Same "..." menu pattern as chats above, for projects -- per explicit
  // request ("we should add at right side the three dots to rename or
  // delete project"). A separate id, not reused with menuOpenId: a project
  // row and a chat row inside its own expanded drawer could both want
  // their own menu open independently.
  const [projectMenuOpenId, setProjectMenuOpenId] = useState<string | null>(null);

  async function handleRenameProject(id: string, name: string) {
    await fetch(`/projects/${id}/name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    onRecentsChanged?.();
  }

  // ChatRow's own "Add to project" submenu -- per explicit request ("the
  // chat three dots... should allow us to attach the chat an existing
  // project or new project"). project_id: null clears it back to the root
  // "Chats" list ("Remove from project").
  async function assignChatToProject(chatId: string, projectId: string | null) {
    await fetch(`/sessions/${chatId}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    onRecentsChanged?.();
  }

  async function handleConfirmDeleteProject(id: string) {
    await fetch(`/projects/${id}`, { method: "DELETE" });
    onRecentsChanged?.();
  }

  async function handleArchiveRecent(id: string) {
    setMenuOpenId(null);
    await fetch(`/sessions/${id}/archive`, { method: "POST" });
    onRecentsChanged?.();
  }

  // Real bug, confirmed directly ("delete in multiplayer should be
  // something like: The chat will be deleted at your local storage, other
  // users will not be affected"): server.rs's own delete_session only
  // takes the local-only path when hosting is actually on AND this device
  // isn't the chat's owner. The hosting-status check that used to gate
  // which confirm copy to show now lives in ChatRow itself (its own
  // comment on isNonOwnerHostedDelete has the full reasoning); this just
  // performs the delete `local_only` already tells the truth about,
  // regardless of what copy the row showed beforehand.
  async function handleConfirmDelete(id: string) {
    const res = await fetch(`/sessions/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_name: getUserDisplayName() }),
    });
    // local_only: true means server.rs's own delete_session left the
    // shared chat/session completely untouched (this device isn't its
    // owner, hosting is on) -- the only real effect is on this device,
    // so it has to be recorded here to keep the chat hidden past a
    // reload (the shared GET /sessions list still returns it forever
    // otherwise, since nothing about it actually changed server-side).
    const data: { local_only: boolean } | null = res.ok ? await res.json() : null;
    if (data?.local_only) hideChatLocally(id);
    // Currently-open chat just got deleted out from under the user --
    // that route is dead now, so leave it rather than showing a 404'd
    // chat page.
    if (location.pathname === `/chat/${id}`) navigate("/");
    onRecentsChanged?.();
  }
  // Below the sm breakpoint (use-media-query.ts's own useIsMobile, 640px),
  // this sidebar behaves like ChatGPT/Claude's own mobile web: starts
  // collapsed (just the icon rail) instead of AppLayout's usual expanded
  // default, and expanding it opens a full drawer that overlays the
  // content (position: fixed, see the <aside> below) instead of pushing/
  // sliding it over -- there's no room at that width to push content out
  // of the way the way desktop's collapse does.
  const isMobile = useIsMobile();
  // Internal, self-managed -- see this file's own top comment on why this
  // isn't a controlled prop. isMobile is read synchronously here (real
  // matchMedia value, not a post-mount correction -- see that hook's own
  // comment), so this seeds the *right* initial value for the current
  // viewport on first render, not just "always expanded" then a flash to
  // collapsed. setCollapsed itself stays internal (below); toggleCollapsed
  // also notifies onCollapsedChange so top-bar.tsx can mirror the value
  // without this becoming a fully controlled component.
  const [collapsed, setCollapsed] = useState(isMobile);
  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    onCollapsedChange?.(next);
  };
  // expandSignal: a one-way external trigger (this prop's own comment has
  // the full reasoning) -- any *new* value re-expands the sidebar.
  // Skips the very first render (the ref guard) so passing an initial
  // expandSignal={0} from AppLayout doesn't immediately fire this on
  // mount; only a later, real bump should.
  const seenExpandSignal = useRef(expandSignal);
  useEffect(() => {
    if (expandSignal === undefined || expandSignal === seenExpandSignal.current) return;
    seenExpandSignal.current = expandSignal;
    toggleCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandSignal]);
  const { show: showGettingStarted } = useGettingStarted();
  // Matches `collapsed` on every non-mobile platform now -- per explicit
  // request ("our collapsed sidebar should be like the collapsed one at
  // tauri where gets hidden... tauri and web should be the exact same"):
  // this used to only fully collapse to width 0 on the desktop app while
  // not fullscreen (originally to clear real native traffic-light
  // buttons), falling back to a narrow icon rail on web -- now desktop
  // Tauri and desktop web collapse to width 0 the same way, dray's own
  // "collapses to nothing" pattern (confirmed via their real source,
  // Sidebar.tsx: `if (collapsed) return null`), with AppLayout.tsx's own
  // standalone toggle taking over as the way back to expanded, same as
  // before. !isMobile -- out of scope for this request, and mobile's own
  // "collapsed" already means something different (the drawer's closed
  // state, with its own mobileDrawerOpen-gated backdrop below) rather
  // than a push-layout rail/hidden choice, so it keeps its existing
  // persistent-narrow-rail-when-closed behavior unchanged.
  const fullyCollapsed = collapsed && !isMobile;
  // Real drag-resize, matching AppLayout.tsx's own right-panel drag handle
  // (that file's own startRightPanelResize has the identical shape) --
  // per explicit request ("make the left sidebar to be draggable like the
  // right sidebar but keep a minimum draggable width so it does not snap
  // for collapsed"). SIDEBAR_MIN_WIDTH sits well above SIDEBAR_WIDTH's own
  // row-layout needs (SIDEBAR_ROW_WIDTH + its own insets), so dragging
  // narrower never approaches the fully-collapsed (width: 0) look -- that
  // stays a separate, discrete toggle (toggleCollapsed above), never
  // reachable by dragging. Not applied while collapsed/fullyCollapsed:
  // there's nothing meaningful to drag at 0 or at the (unreachable, see
  // SIDEBAR_COLLAPSED_WIDTH's own comment) narrow-rail width.
  const [width, setWidth] = useState(SIDEBAR_WIDTH);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  function startResize(event: React.MouseEvent) {
    event.preventDefault();
    setIsResizingWidth(true);
    const startX = event.clientX;
    const startWidth = width;
    // globalThis.MouseEvent, not the bare MouseEvent this file's own top
    // import already shadows with React's synthetic event type -- the
    // native window listener below hands this a real DOM event, not a
    // React one.
    function onMove(moveEvent: globalThis.MouseEvent) {
      setWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + (moveEvent.clientX - startX))));
    }
    function onUp() {
      setIsResizingWidth(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  // Real bug, confirmed directly ("the chat name and the search bar
  // width are not expanding dynamically"): every row's own width (search
  // bar, chat rows via RailButton, the avatar/help row) was computed off
  // the fixed SIDEBAR_ROW_WIDTH constant regardless of this sidebar's own
  // live, now-draggable width -- dragging wider grew the <aside> itself
  // but left every row still clipped at the old 204px. Same margin math
  // as SIDEBAR_WIDTH/SIDEBAR_ROW_WIDTH's own fixed relationship (220-204
  // = 16px of mx-2 inset on both sides), just computed off the live width
  // instead of the constant.
  const rowWidth = width - (SIDEBAR_WIDTH - SIDEBAR_ROW_WIDTH);
  // Wraps a real navigation/selection action so picking a destination on
  // mobile also closes the drawer back to the collapsed rail, same as
  // ChatGPT/Claude -- desktop's own push-layout collapse doesn't need
  // this, tapping a destination there doesn't cover anything up.
  const navigateAndClose = (action: () => void) => {
    action();
    if (isMobile) toggleCollapsed(true);
  };
  // Refocus-blur fix for the account dropdown's own trigger -- see that
  // DropdownMenu's own onOpenChange comment below.
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  // Same refocus-blur fix, for the new Help dropdown's own trigger
  // (below, alongside the account trigger in the same row).
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  // True only while the mobile drawer is actually open (expanded on a
  // mobile viewport) -- drives the backdrop below and the <aside>'s own
  // fixed positioning.
  const mobileDrawerOpen = isMobile && !collapsed;

  return (
    <>
      {/* Tap-outside-to-close catcher -- mobile drawer only. No dimming
          (no bg color at all) per explicit request: the <aside> itself
          now carries an opaque bg-sidebar (== bg-background, index.css's
          own --sidebar: var(--background)) to hide the content behind it
          via plain z-index layering -- a curtain, not a modal -- so a
          separate darkened overlay over the rest of the page was more
          than this actually needed. This div only exists to catch the
          close tap; nothing to animate since it's invisible either way.
          z-40, one below the <aside>'s own z-50, so the drawer itself
          still reads on top. inset-0, not top: some offset -- there's no
          separate top bar any more for this to start below (that offset
          used to match top-bar.tsx's own header height; that file is
          gone, per explicit request elsewhere, and this catcher covering
          the *entire* viewport is what the <aside>'s own top: 0 below
          now needs to match it). */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40" onClick={() => toggleCollapsed(true)} aria-hidden />
      )}
    {/* width animates here (SIDEBAR_WIDTH <-> SIDEBAR_COLLAPSED_WIDTH) --
        on desktop this is the flex item AppLayout's own content column
        sits after in normal flex flow, so animating it is what slides the
        content column over as this collapses/expands (see this file's own
        top comment); AppLayout gives that column a fixed width instead of
        flex-1 growth (its own comment) specifically so it *only* slides,
        never resizes, in step with this -- per explicit request. On
        mobile (isMobile), position switches to fixed/left-0/z-50 instead
        of the desktop relative flow -- the same width animation then
        reads as the drawer growing to *cover* content rather than push
        it, since AppLayout's own content column is itself absolutely
        positioned (see that file's own comment) and simply sits underneath
        whatever width this currently covers. top: 0 (style, below), not
        some offset to start below a top bar -- there's no separate top
        bar any more (top-bar.tsx is gone, per explicit request
        elsewhere) for this to clear; starting at the true top instead
        lets this <aside>'s own collapse-toggle row (below) land in
        AppLayout.tsx's own shared strip exactly the way it already does
        on desktop (that strip's own z-[5] sits below this <aside>'s
        z-50, same relationship desktop's z-10 has with it), instead of
        rendering as a second, redundant row underneath a phantom gap --
        confirmed as a real bug via screenshot: the collapse icon read as
        misaligned from the rest of the collapsed rail, and the strip's
        own border-b never carried over into the <aside>'s own -- same
        symptom this fixes on desktop already having one continuous line,
        mobile now matches. */}
    <aside
      aria-label={t("nav.workspace.ariaLabel")}
      // bg-sidebar (== bg-background, index.css's own --sidebar: var(
      // --background)) -- opaque, so on mobile (position: fixed, above)
      // this reliably hides whatever content sits behind it via z-index
      // alone, the "curtain" effect the tap-outside catcher's own comment
      // above describes, instead of needing a separate dimming overlay
      // over the rest of the page to hide that content some other way.
      // Harmless on desktop too, where nothing ever renders underneath it.
      className={`relative flex shrink-0 overflow-hidden bg-sidebar transition-[width] ${fullyCollapsed ? "" : "border-r border-border"} ${isMobile ? "fixed top-0 left-0 z-50 h-dvh" : `relative ${fill ? "h-full" : "h-[600px]"}`} ${className}`}
      style={{
        width: fullyCollapsed ? 0 : collapsed ? SIDEBAR_COLLAPSED_WIDTH : width,
        transitionDuration: isResizingWidth ? "0ms" : `${SIDEBAR_MOTION_MS}ms`,
        transitionTimingFunction: SIDEBAR_EASING,
      }}
    >
      {/* Real drag-resize handle -- per explicit request ("make the left
          sidebar to be draggable like the right sidebar"), matching
          AppLayout.tsx's own right-panel resize handle in spirit (a thin
          hover-highlighted strip, mousedown starts the drag). Only while
          genuinely expanded and not on mobile (the drawer's own width
          there is a fixed, non-resizable cover-the-content value, not
          this push-layout one) -- collapsed/fullyCollapsed have nothing
          meaningful to drag. absolute right-0, not a flex sibling: this
          sits *inside* the already width-animated <aside>, so it tracks
          the live edge automatically through the same collapse/expand
          transition without needing its own separate position math. */}
      {!collapsed && !isMobile && (
        <div
          onMouseDown={startResize}
          // w-px, not w-1 (4px) -- real bug, confirmed directly ("the left
          // sidebar is getting an thicker blue highlight when i drag
          // compared to the right sidebar"); matches AppLayout.tsx's own
          // right-panel handle width exactly. bg-transparent at rest, not
          // bg-border like that handle -- this sidebar's own <aside>
          // already draws border-r border-border along this same edge, so
          // a resting bg-border here would double that line up, the same
          // class of bug the right panel's own containers had fixed
          // earlier (border-l removed there for the identical reason).
          className="absolute top-0 right-0 z-10 h-full w-px shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-focus-accent"
        />
      )}
      {/* width animates in step with the <aside> above (same value, same
          transition) -- this was left fixed at 220px after the <aside>
          itself went back to animating its own outer width, which made
          RailButton's collapsed centering (mx-auto within *this* column)
          center every icon around x~110 of a still-220px-wide column
          instead of the ~26px center of the now-52px-wide visible strip --
          the icons weren't gone, just centered outside the <aside>'s own
          clipped viewport. */}
      {/* pt-2 -- back to the original value. A pt-[14px] version was tried
          here first to chase alignment with macOS's own native traffic
          lights by nudging *this* row down to match wherever they
          happened to sit -- reverted, because that's the wrong side to
          adjust: the lights' own position is itself configurable
          (src-tauri/tauri.conf.json's own trafficLightPosition, requires
          titleBarStyle: "Overlay" + decorations: true, both already set),
          which is how apps that get this pixel-perfect actually do it --
          move the lights to match the toolbar, not nudge the toolbar
          hoping to land on wherever the OS defaulted the lights. */}
      <div
        className="flex min-h-0 shrink-0 flex-col pt-2 transition-[width]"
        style={{
          width: fullyCollapsed ? 0 : collapsed ? SIDEBAR_COLLAPSED_WIDTH : width,
          transitionDuration: isResizingWidth ? "0ms" : `${SIDEBAR_MOTION_MS}ms`,
          transitionTimingFunction: SIDEBAR_EASING,
        }}
      >
        <GlideGroup>
        {/* Collapse toggle -- its own row, above Search.
            No border-b any more -- per explicit request ("remove the
            divider line between the find and the collapse icon"): tried
            first as a full-width rule matching AppLayout.tsx's own top
            strip/line, reverted since it read as an unwanted seam between
            this row and Search directly below it.
            h-[32px] (raw px, not h-8 -- exact pixel match matters here so
            this row's own bottom edge doesn't land 1px past
            AppLayout.tsx's own h-[40px] strip): the 24px-tall row inside
            sits at this wrapper's own top, leaving 8px of empty space
            below it -- matching the icon's own 8px gap above (the column's
            own pt-2, before this wrapper) with an equal gap below it too,
            per explicit request (was just the row's own 2px icon-centering
            inset before, asymmetric against the 8+2=10px above it). No logo
            here any more (tried, reverted per explicit request --
            this app's logo already appears on most pages elsewhere, so a
            second copy here was redundant). Right-aligned via ml-auto on
            the button now (was justify-end on the row itself -- with the
            traffic-light inset below sometimes mounted as a real leading
            child, justify-end would fight it for the row's own start;
            ml-auto pins the button right regardless of what else is in
            the row). Stays visible in both states (not opacity-0 while
            collapsed, tried first -- that left the rail's top row as a
            dead gap with no way back to expanded except clicking
            Search's own icon) -- re-purposed as the expand trigger while
            collapsed rather than swapped for a second icon, and not
            rotated to signal that either (tried, also reverted -- turning
            180deg on every collapse/expand read as the button itself
            moving rather than a stable, static control). width animates
            collapsed <-> expanded the same way every other fullWidth row
            here does (RailButton's own style prop, mirrored by hand since
            this isn't a RailButton). */}
        <div className="h-[32px]">
        <div
          className="mx-2 flex h-6 shrink-0 items-center overflow-hidden"
          style={{
            width: collapsed ? SIDEBAR_COLLAPSED_ROW_WIDTH : rowWidth,
            transition: `width ${SIDEBAR_MOTION_MS}ms ${SIDEBAR_EASING}`,
          }}
        >
          {/* Reserved space for macOS's own native traffic-light buttons
              (titleBarStyle: "Overlay", src-tauri/tauri.conf.json), which
              float on top of this row's own top-left corner when running
              in the desktop app -- without this, Search below (while
              expanded) would render right underneath them. No separate
              vertical divider next to it any more (tried, reverted per
              explicit request) -- just this reserved gap, plus the
              horizontal border-b above marking the boundary now.
              Traffic-light *clearance* for this row's own toggle button
              is no longer this span's job while collapsed -- see the
              <aside>'s own comment below: on the desktop app specifically
              (and only while not fullscreen), `collapsed` now drops the
              whole sidebar to width 0 instead of this narrow rail, so
              this row (and everything in it) is only ever visible
              un-collapsed, or collapsed somewhere the lights aren't a
              problem (web, or the desktop app fullscreen) -- both cases
              this reserve going to 0 while collapsed is exactly right. */}
          <span
            className="block h-full shrink-0"
            style={{ width: collapsed || !isMac ? 0 : 62, transition: `width ${SIDEBAR_MOTION_MS}ms ${SIDEBAR_EASING}` }}
            aria-hidden
          />
          {/* ml-1, not ml-auto, while collapsed -- per explicit request
              (confirmed via screenshot: this icon sat visibly off from
              the rest of the collapsed rail's own icon column). ml-auto
              pushes this button (and, since it's a flex sibling before
              them in DOM order, the back/forward buttons right after it
              too -- see that group's own comment) flush to the row's own
              *right* edge, both together, while expanded -- but
              collapsed, that right-edge anchor landed its left edge 16px
              in from the <aside>'s own edge, while every RailButton icon
              (search/getting-started/new chat/agents/apps) sits at a
              fixed 12px in (mx-2 + that component's own px-1). ml-1 on
              an 8px mx-2 row reproduces that exact same 12px inset
              instead, so this icon lines up with the column below it at
              every width, collapsed rail included -- not just past some
              sm+ breakpoint. Safe to sit this close to the window's own
              left edge now specifically because this row is only ever
              shown collapsed where there are no traffic lights to clash
              with (see the span's own comment above) -- the
              desktop-app-not-fullscreen case that *does* have them
              skips this narrow rail entirely. */}
          {/* Restored as the collapse toggle -- briefly replaced with a
              Home button (navigate to /new-chat), reverted per explicit
              request ("the sidebar at homepage got broken... please
              restore our previous collapse feature to the homepage
              sidebar and keep the settings sidebar as it is"): the
              settings sidebar's own separate way back to the app (now its
              own "Application" row at the bottom, settings-overlay.tsx's
              own comment on that) stays as-is, this one goes back to what
              it was. */}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => toggleCollapsed(!collapsed)}
            className={`${collapsed ? "ml-1" : "ml-auto"} flex size-5 shrink-0 transform-gpu items-center justify-center rounded-[6px] text-foreground transition-[background-color,color] duration-150 hover:bg-hover-2/50 active:scale-[0.98]`}
          >
            <SidebarLeftIcon className="size-[14px]" />
          </button>
          {/* Back/forward -- per explicit request, matching a reference
              screenshot of macOS window chrome with these sitting next
              to the sidebar toggle. Shown in the web app too now (was
              Tauri-only) per explicit request -- navigate(-1)/navigate(1):
              react-router-dom's own History API delta navigation, the
              same mechanism a browser's own back/forward buttons use --
              no custom history stack needed. No margin of its own --
              the toggle button right before it carries the ml-auto (see
              its own comment), which pushes this whole trailing run (
              toggle + these two buttons, DOM-order flex siblings) to the
              row's right edge together rather than leaving the toggle
              stranded mid-row with the arrows off on their own further
              right (what a separate ml-auto here, tried first, produced
              once the toggle stopped being scoped to Tauri only). */}
          {/* opacity fade, same 280ms as every other row's own collapse
              fade (RailButton's own label, above) -- confirmed directly
              as a real gap ("the <> buttons is not disappearing at the
              drawer like it should, its disappearing only when the
              sidebar is collapsed"): these had no fade of their own at
              all, so their apparent "disappearance" was really just the
              toggle button's own ml-auto -> ml-1 class swap (right above)
              snapping instantly the moment `collapsed` flips, yanking
              this whole trailing group left well before the row's own
              width transition finishes -- not a real fade in sync with
              the drawer closing. pointer-events-none while collapsed so
              a rail with no room for these can't still register clicks
              on them mid-fade. */}
          <div
            className={`flex shrink-0 items-center gap-0.5 transition-opacity duration-[280ms] ${collapsed ? "pointer-events-none opacity-0" : "opacity-100"}`}
          >
            <button
              type="button"
              aria-label={t("nav.goBack.ariaLabel")}
              disabled={!canGoBack}
              onClick={goBack}
              className="flex size-5 shrink-0 transform-gpu items-center justify-center rounded-[6px] text-foreground transition-[background-color,color] duration-150 hover:bg-hover-2/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeftIcon className="size-[14px]" />
            </button>
            <button
              type="button"
              aria-label={t("nav.goForward.ariaLabel")}
              disabled={!canGoForward}
              onClick={goForward}
              className="flex size-5 shrink-0 transform-gpu items-center justify-center rounded-[6px] text-foreground transition-[background-color,color] duration-150 hover:bg-hover-2/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRightIcon className="size-[14px]" />
            </button>
          </div>
        </div>
        </div>
        {/* mb-2, on top of GlideGroup's own shared gap-1 (4px) between every
            other row -- per explicit request ("add a bigger gap between
            getting started and search bar"): only this one gap needed to
            grow, not the uniform spacing between Getting started/Inbox/New
            chat too, so it's added here on Search's own wrapper rather than
            raising GlideGroup's shared gap (which an earlier explicit
            request specifically set for every row in the sidebar at once). */}
        <div className="mb-2">
        {collapsed ? (
          <SidebarSearch value={searchQuery} onChange={setSearchQuery} collapsed={collapsed} onExpandSidebar={() => toggleCollapsed(false)} />
        ) : (
          <div className="mx-2 flex h-7 items-center" style={{ width: rowWidth }}>
            <SidebarSearch value={searchQuery} onChange={setSearchQuery} collapsed={collapsed} onExpandSidebar={() => toggleCollapsed(false)} />
          </div>
        )}
        </div>
          {/* Search, Getting started, Inbox, New -- this exact order, per
              explicit request. New (below) replaces the old standalone New
              Chat/Agents/Apps rows with one popup covering every "create"
              action (New chat/New project/New agent/New app), "reducing
              the amount of buttons at the sidebar" -- Getting started and
              Inbox aren't creation actions, so they stay real nav rows
              rather than folding into that popup. Hidden entirely (not
              just disabled) once use-getting-started.tsx's own toggle is
              off -- settings-overlay.tsx's General section, or
              WelcomePage's own "hide this page" control -- matching "hide
              this page" meaning the page and its nav entry are both gone,
              not just unreachable via one of the two. */}
          {showGettingStarted && (
            <RailButton
              collapsed={collapsed}
              rowWidth={rowWidth}
              icon={placeholderNav ? <BlankPageIcon className="size-[14px]" /> : WELCOME_ITEM.icon}
              label={placeholderNav ? t("common.placeholder") : t("nav.welcome")}
              url={WELCOME_ITEM.url}
              active={activeNav === WELCOME_ITEM.key}
              onClick={() => navigateAndClose(() => onNavigate?.(WELCOME_ITEM.key))}
            />
          )}
          <RailButton
            collapsed={collapsed}
            rowWidth={rowWidth}
            icon={placeholderNav ? <BlankPageIcon className="size-[14px]" /> : INBOX_ITEM.icon}
            label={placeholderNav ? t("common.placeholder") : t("nav.inbox")}
            url={INBOX_ITEM.url}
            active={activeNav === INBOX_ITEM.key}
            onClick={() => navigateAndClose(() => onNavigate?.(INBOX_ITEM.key))}
          />
          <RailButton
            collapsed={collapsed}
            rowWidth={rowWidth}
            icon={placeholderNav ? <BlankPageIcon className="size-[14px]" /> : LIBRARY_ITEM.icon}
            label={placeholderNav ? t("common.placeholder") : t("nav.library")}
            url={LIBRARY_ITEM.url}
            active={activeNav === LIBRARY_ITEM.key}
            onClick={() => navigateAndClose(() => onNavigate?.(LIBRARY_ITEM.key))}
          />
          {/* New chat -- a plain RailButton now (its own no-url branch
              renders a plain <button>), not a dropdown, per explicit
              request ("remove new agent, we will create in another way
              which i can't think for now, and update new to New chat"):
              New project/New app were already removed above (equivalent
              actions exist elsewhere -- the sidebar's own "+" next to
              Projects, and Settings, per that same request), and New
              agent's removal here leaves New chat as the dropdown's only
              real action, so the dropdown itself is gone rather than a
              one-item menu. RailButton itself, not a hand-rolled <button>
              copying its classes, per a follow-up report ("the + New chat
              is not centralised in line with Getting started and Inbox")
              -- guarantees byte-identical markup with its neighbors
              instead of two copies of the same classes drifting apart. */}
          <RailButton
            collapsed={collapsed}
            rowWidth={rowWidth}
            icon={<PlusIcon className="size-[14px]" />}
            label={t("common.newChat")}
            active={activeNav === "home"}
            onClick={() => navigateAndClose(() => onNewChat?.())}
          />
        </GlideGroup>

        {/* Projects/Recents fade out while collapsed instead of instantly
            unmounting -- same opacity transition, same duration, as
            RailButton's own label fade above, so the whole sidebar reads
            as one synchronized motion. Stays mounted throughout (not
            conditionally rendered) so there's something to actually
            transition; pointer-events-none while collapsed keeps a
            fully-transparent row from still being clickable/focusable. */}
        {/* Plain overflow-y-auto here, not ScrollArea -- reverted after a
            real regression: ScrollArea's extra Root/Viewport/Content
            wrapper layers changed how this list's own layout resolved
            during the sidebar's width collapse animation, reintroducing
            the exact "items jump down while collapsing" bug a past pass
            already fixed (this block's own comment above). Not worth
            re-attempting without a way to visually verify the collapse
            transition frame by frame first. */}
        <div
          className={`mt-3 min-h-0 flex-1 overflow-y-auto transition-opacity duration-[280ms] ${collapsed ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          {/* Search results swap in for the whole Projects/Chats body below
              -- per explicit request ("sidebar at main should not have the
              drawer anymore, it should behave exactly like the search at
              settings where it uses the sidebar to show the findings"),
              same in-place swap Settings' own search already does
              (settings-overlay.tsx: `searching ? <results> : <nav list>`)
              instead of a floating popup layered on top of the sidebar. */}
          {searching ? (
            <div className="mx-2 flex flex-col gap-0.5">
              {searchResults.length === 0 ? (
                <p className="px-2 py-2 text-[12px] font-normal text-muted-foreground opacity-50">
                  No matches found for "{searchQuery}"
                </p>
              ) : (
                searchResults.map((item) => {
                  // Same "icon + label describer above the actual match"
                  // treatment settings-overlay.tsx's own search results use
                  // (its own SECTIONS.icon/label row) -- per explicit
                  // request ("show a describer at the top of each item...
                  // so we know which is a Chat, Project or Model"), a
                  // project_name match describes as Project even though it
                  // still opens the chat it matched in (there's no
                  // standalone project route to navigate to instead).
                  const describerLabel =
                    item.kind === "model" ? "Model" : item.matchedIn === "project_name" ? "Project" : "Chat";
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => pickSearchResult(item)}
                      // h-auto/py-1.5, not the fixed h-7 every other row uses --
                      // a message match's own snippet line (below) needs real
                      // room a single-line title-only row never had to make for.
                      className="flex h-auto w-full flex-col items-start gap-0.5 rounded-[7px] px-2 py-1.5 text-left transition-colors hover:bg-hover-2/50"
                    >
                      <span className="flex items-center gap-1.5 text-[10px] font-normal text-muted-foreground">
                        {item.kind === "model" && item.model ? (
                          <ProviderIcon model={item.model} className="size-3 shrink-0" />
                        ) : describerLabel === "Project" ? (
                          <FolderIcon className="size-3 shrink-0" />
                        ) : (
                          <BubbleChatIcon className="size-3 shrink-0" />
                        )}
                        {describerLabel}
                      </span>
                      <span className="flex w-full min-w-0 items-center gap-1.5 pl-[19px]">
                        <span className="min-w-0 flex-1 truncate text-xs font-normal text-foreground">{item.label}</span>
                      </span>
                      {/* The matching message line itself -- per explicit
                          request ("I searched for 'via codex' and that
                          should scope through all chats... to find places
                          where via codex is written"), so a message match
                          explains *why* it matched, not just which chat. */}
                      {item.snippet && (
                        <span className="w-full min-w-0 truncate pl-[19px] text-[11px] font-normal text-muted-foreground">
                          {item.snippet}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
          <>
          {/* h-5, not h-8 (matched a search button that sat next to this
              label and no longer exists) -- the fixed 32px box left a lot
              of empty space above/below the 12.5px text, reading as an
              oversized gap before the first project/chat row. justify-
              between + the "+" button below: project creation moved here
              (per explicit request), same "+" now on Recent chats' own
              label below it too. "Recent projects", not "Projects" -- per
              explicit request.
              text-foreground opacity-50 (was
              text-[#636363]/dark:text-ink-3, before that plain text-ink-3)
              -- per explicit request ("the describer should be 50% dimmed
              active color, because that looks too close to the color of
              the chat/project"): the active row color (text-foreground --
              RailButton's own active-state color, var(--foreground))
              at 50% opacity, same "50% dimmed" pattern the empty-state
              placeholder below already used -- a flat #636363 read too
              close to an active row's own full-strength color to tell the
              two apart. The placeholder below moved the *other* direction
              in the same request -- to the row's inactive color
              (text-muted-foreground) at 50%, not the active
              one -- since "Projects will show here" is describing an empty
              state, not itself an active/selected thing. text-xs (12px
              nominal, rem-
              based/responsive) -- briefly tried a raw text-[10px], then
              index.css's own new text-2xs token (0.625rem, still
              responsive), both reverted back to plain text-xs per later
              requests. font-normal, not font-medium -- per
              explicit request ("Projects/Recent chats should be exact like
              Repositories at dray's, so maybe its regular instead of
              medium?"): dray's real equivalent here is its own
              project-group heading row (its `<div>` with `text-ui
              text-muted-foreground/70`, no font-weight class at all --
              *not* its DropdownMenuLabel/ContextMenuLabel, a different UI
              context this was compared against first, and wrongly). dray's
              sidebar doesn't use a weight below normal (400) anywhere
              either, which is why every other row/hint/menu-item text in
              this file also dropped from font-light to font-normal at the
              time -- and every remaining font-light spot elsewhere in this
              app followed in a later pass, per explicit request ("Update
              our font weights to match the font weight at Synara's...
              our texts are not as crisp as Synara's"): Synara's own
              sidebarRowStyles.ts makes the same claim about dray's
              sidebar -- "doesn't use a weight below normal (400)
              anywhere" -- and its own base UI font weight follows suit
              app-wide, not just in the sidebar. */}
          <div className="group mx-2 mb-0.5 flex h-5 items-center justify-between px-2 text-xs font-normal text-foreground select-none">
            {/* opacity-50 moved onto this span specifically, not the whole
                row -- real bug, confirmed directly ("the plus at projects
                sttill not the same color as projects word"): the row div
                used to carry opacity-50 itself, and the button (below,
                also opacity-50) sits *inside* it as a child -- CSS opacity
                compounds multiplicatively across nesting (0.5 * 0.5 =
                0.25), so the "+" rendered at 25% while this text sat at
                50%, and even the button's own hover:opacity-100 couldn't
                reach true full strength since the parent's 50% still
                capped it from outside. Keeping opacity-50 scoped to just
                the text (this span) is what lets the button's own
                independent opacity actually land at the colors this row's
                comment above intends. select-none on the row -- confirmed
                directly as a real gap ("we are able to select as a text
                and that should only be my pointer"): this label reads as
                a section header, not real selectable body copy. */}
            {/* "Projects", not "Recent projects" -- per explicit request. */}
            <span className="opacity-50">{t("nav.projects")}</span>
            <div className="flex items-center gap-0.5">
              {/* Popover, not navigate("/projects") -- confirmed directly as
                  a real gap ("we are redirecting when trying to create a
                  project but that should give the popover"): ProjectsPage.tsx
                  is still just a placeholder red block, not a real
                  create-project destination. onOpenChange resets the draft
                  name so reopening this never shows a stale typed value. */}
              {/* BaseDropdownMenu/BaseDropdownContent, not Radix Popover --
                  real bug, confirmed directly ("the rounded borders and bg
                  and border color are not the same as more and delete"):
                  Radix's own PopoverContent carries a completely separate
                  default look (rounded-lg, bg-popover, ring-1) from this
                  app's shared dropdown panel (DROPDOWN_PANEL_RADIUS's own
                  rounded-3xl, Elevated's own surface bg, no ring) --
                  matching it by hand would drift the moment either changed.
                  Using the literal same component the "..." menu's own
                  More/Delete panel renders through guarantees they can
                  never mismatch again. */}
              <BaseDropdownMenu
                size="compact"
                open={newProjectOpen}
                onOpenChange={(open) => {
                  setNewProjectOpen(open);
                  if (!open) setNewProjectName("");
                }}
              >
                <BaseDropdownTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t("nav.newProject.ariaLabel")}
                      // opacity-0, not visible by default -- confirmed directly as
                      // a real gap ("when we scroll over that should show the +
                      // icon and not active by default"): only reveal on hover of
                      // the row (group-hover), not sitting there dimmed-but-visible
                      // at rest. Full strength on the button's own direct hover.
                      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] text-foreground opacity-0 transition-[color,opacity] duration-150 group-hover:opacity-50 hover:text-ink hover:opacity-100"
                    >
                      <PlusIcon className="size-[12px]" />
                    </button>
                  }
                />
                {/* Same "Create" describer + field + Cancel/Create button
                    row layout as the "..." menu's own Delete confirm
                    (ProjectRow/ChatRow, above) -- per explicit request
                    ("when we create our project we should get a similar to
                    the more/delete, then describer says Create and then
                    the field to enter the name and then either cancel or
                    create"), replacing the old inline X/check-icon design. */}
                <BaseDropdownContent align="start" className="w-40">
                  <BaseDropdownLabel>{t("common.create")}</BaseDropdownLabel>
                  <div className="px-2 pb-2">
                    <Input
                      autoFocus
                      value={newProjectName}
                      onChange={(event) => setNewProjectName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleCreateProject();
                        if (event.key === "Escape") handleDismissProject();
                      }}
                      placeholder={t("nav.projectName.placeholder")}
                      // md:text-2xs, not just text-2xs -- the shared Input
                      // component (ui/input.tsx) bakes in its own
                      // md:text-sm, which otherwise wins over a plain
                      // unprefixed override at this sidebar's actual
                      // (desktop, >=768px) rendered width -- confirmed
                      // directly ("Still big").
                      className="h-7 bg-background text-2xs focus-visible:border-focus-accent md:text-2xs"
                    />
                  </div>
                  <div className="flex gap-1.5 px-2 pb-1.5">
                    <Button variant="outline" className="h-7 flex-1 text-[11px]" onClick={handleDismissProject}>
                      Cancel
                    </Button>
                    <Button
                      className="h-7 flex-1 text-[11px]"
                      disabled={!newProjectName.trim() || creatingProject}
                      onClick={() => void handleCreateProject()}
                    >
                      Create
                    </Button>
                  </div>
                </BaseDropdownContent>
              </BaseDropdownMenu>
            </div>
          </div>

          <GlideGroup>
            {/* Short "No projects" placeholder, not a bare invisible spacer
                -- per explicit follow-up request ("we should say No
                projects, No chats, No notifications like chatgpt does
                instead of being empty"), reversing an earlier "remove the
                placeholder text" request: reads as an intentional empty
                state instead of a blank gap that could pass for a loading
                glitch. */}
            {projects.length === 0 && (
              <div className="mx-2 flex h-7 items-center px-2 text-xs font-normal text-muted-foreground opacity-50">{t("nav.projects.empty")}</div>
            )}
            {projects.map((item) => {
                const projectChats = chatsForProject(item.id);
                const expanded = expandedProjectIds.has(item.id);
                return (
                  <div key={item.id}>
                    <ProjectRow
                      item={item}
                      expanded={expanded}
                      hasChats={projectChats.length > 0}
                      rowWidth={rowWidth}
                      // Only when there's something to expand into -- per
                      // explicit request ("we should not expand when its
                      // empty"): an empty project just gets selected, no
                      // drawer opens (there'd be nothing in it anyway).
                      onToggleExpand={() => projectChats.length > 0 && toggleProjectExpanded(item.id)}
                      // Clicking the row expands/collapses it -- confirmed
                      // directly as a real gap ("once i click at the
                      // project that activate the font but don't expand,
                      // that should be the behaviour and not expect me to
                      // specifically touch the >"): the chevron shouldn't
                      // be the only way to open the drawer. Only when
                      // there's something to expand into -- per explicit
                      // follow-up ("we should not expand when its empty").
                      onSelect={() =>
                        navigateAndClose(() => {
                          if (projectChats.length > 0) toggleProjectExpanded(item.id);
                        })
                      }
                      // Carries the target project forward via navigation
                      // state -- HomePage.tsx's own comment has the full
                      // reasoning (no real session exists to assign a
                      // project_id to until one is actually created there).
                      onNewChat={() =>
                        navigateAndClose(() => navigate("/new-chat", { state: { projectId: item.id } }))
                      }
                      menuOpen={projectMenuOpenId === item.id}
                      onMenuOpenChange={(open) => setProjectMenuOpenId(open ? item.id : null)}
                      onRename={(name) => void handleRenameProject(item.id, name)}
                      onDeleteRequest={() => void handleConfirmDeleteProject(item.id)}
                    />
                    {/* Nested drawer -- per explicit request ("that should
                        become an expandable option like a drawer... keep
                        the drawer open and close at projects"). No extra
                        left indent any more -- confirmed directly as too
                        much dead space before the chat name ("the chat's
                        name inside project has a left padding"): the pl-4
                        wrapper this used to have, stacked on top of
                        ChatRow's own px-2, pushed the label noticeably
                        further right than the project row's own label
                        starts. Being grouped directly under the expanded
                        project row (same mx-2/gap-1 as every other row) is
                        enough of a nesting cue on its own. */}
                    {/* AnimatePresence/motion, not a plain conditional render
                        -- real bug, confirmed directly ("the projects close
                        and open should have a drawer transition as that at
                        the moment is very snappy"): height:"auto" (framer
                        motion supports animating to/from auto directly) plus
                        a fade, same duration/easing as every other sidebar
                        motion here (SIDEBAR_MOTION_MS/SIDEBAR_EASING). */}
                    <AnimatePresence initial={false}>
                      {expanded && projectChats.length > 0 && (
                        <motion.div
                          key="drawer"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: SIDEBAR_MOTION_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 flex flex-col gap-1">
                            {projectChats.map((chatItem) => (
                              <ChatRow
                                key={chatItem.id}
                                item={chatItem}
                                active={selectedRecent === chatItem.id}
                                projects={projects}
                                rowWidth={rowWidth}
                                menuOpen={menuOpenId === chatItem.id}
                                onMenuOpenChange={(open) => setMenuOpenId(open ? chatItem.id : null)}
                                onSelect={() => navigateAndClose(() => navigate(`/chat/${chatItem.id}`))}
                                onArchive={() => void handleArchiveRecent(chatItem.id)}
                                onDeleteRequest={() => void handleConfirmDelete(chatItem.id)}
                                onAssignToProject={(projectId) => void assignChatToProject(chatItem.id, projectId)}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
          </GlideGroup>
          {/* Always shown now, header included -- reverted per explicit
              request ("add recents back... add a placeholder... that looks
              like its broken"): hiding the section entirely (this file's
              own git history) read as more broken than a real "nothing
              here yet" placeholder does, once there was one to show
              (below). "Recent chats", not "Recents" -- per explicit
              request. */}
          <>
              {/* justify-between + trailing "+" -- per explicit request
                  ("keep the + at our Projects... and also keep at Recent
                  chats"), same New-project pattern Recent projects' own
                  label uses above (that block's own comment has the full
                  opacity/color/select-none/group-hover reasoning -- reused
                  verbatim here). */}
              <div className="group mx-2 mt-3 mb-0.5 flex h-5 items-center justify-between px-2 text-xs font-normal text-foreground select-none">
                {/* "Chats", not "Recent chats" -- per explicit request. */}
                <span className="opacity-50">{t("nav.chats")}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={t("common.newChat")}
                    onClick={() => navigateAndClose(() => onNewChat?.())}
                    className="flex size-4 shrink-0 items-center justify-center rounded-[4px] text-foreground opacity-0 transition-[color,opacity] duration-150 group-hover:opacity-50 hover:text-ink hover:opacity-100"
                  >
                    <PlusIcon className="size-[12px]" />
                  </button>
                </div>
              </div>

              <GlideGroup>
                {/* Same "No chats" placeholder as Projects' own empty state
                    above -- see that block's own comment for the full
                    reasoning. */}
                {rootChats.length === 0 && (
                  <div className="mx-2 flex h-7 items-center px-2 text-xs font-normal text-muted-foreground opacity-50">{t("nav.chats.empty")}</div>
                )}
                {rootChats.map((item) => (
                  <ChatRow
                    key={item.id}
                    item={item}
                    active={selectedRecent === item.id}
                    projects={projects}
                    rowWidth={rowWidth}
                    menuOpen={menuOpenId === item.id}
                    onMenuOpenChange={(open) => setMenuOpenId(open ? item.id : null)}
                    onSelect={() => navigateAndClose(() => navigate(`/chat/${item.id}`))}
                    onArchive={() => void handleArchiveRecent(item.id)}
                    onDeleteRequest={() => void handleConfirmDelete(item.id)}
                    onAssignToProject={(projectId) => void assignChatToProject(item.id, projectId)}
                  />
                ))}
              </GlideGroup>
            </>
          </>
          )}
        </div>

        {/* placeholderNav: not rendered at all on Agent/Code/Design -- same
            reasoning as the rest of this rail's own real nav rows not
            showing there (this row's own top rows already read as
            Placeholder there).
            Account row -- replaces the former "Connect apps" placeholder
            footer (no real app-connection flow existed in this app either,
            same status this row itself doesn't carry). Stays visible while
            collapsed now (unlike Connect apps, which faded out) -- this is
            the only way to reach Settings/Appearance/Log out from the
            sidebar at all, so hiding it behind expanding first would strand
            those behind an extra click for no reason. No top divider --
            per explicit request.
            pb-4 (was pb-2) -- per explicit request, lines this row's own
            vertical center up with HomePage.tsx's own compose box toolbar
            row (the attach/model/context-meter row just below the bordered
            box), not the sidebar's own bottom edge. That row's own center
            sits 30px up from the window's bottom edge (HomePage.tsx's own
            pb-4 = 16px, plus half its own 28px-tall toolbar row = 14px);
            this row's own center is pb + half its own 28px height (h-7),
            so pb-4 (16px) here lands its center at the same 30px mark --
            not flush against the sidebar's own bottom edge like before.
            No pt-2 any more either (confirmed via screenshot: it was
            extra padding *inside* this wrapper on top of mt-3's own
            spacing from the nav list above, with no equivalent on the
            compose row's own side, so the two "bands" didn't actually
            match even once their centers did) -- mt-3 alone now plays the
            same "space before this row" role mt-1.5 plays for the compose
            toolbar row, so both rows are the same real height (28px, h-7)
            framed the same way, not just centered on the same point. */}
        {!placeholderNav && (
        <div className="mt-3 shrink-0 pb-4">
          {/* Settings -- a standalone nav row now, directly above the
              avatar+Help row below, per explicit request ("Settings go
              abover the avatar as a sidebar menu but at the bottom and
              top of the avatar and help row"). Plain RailButton, same as
              every other top-level nav row -- its own single-row
              GlideGroup gives it the same magnetic hover highlight those
              rows share, even though it's the only row in this
              particular group. */}
          <GlideGroup>
            <RailButton
              collapsed={collapsed}
              rowWidth={rowWidth}
              icon={<SettingsIcon className="size-[14px]" />}
              label={t("nav.settings")}
              onClick={() => (onOpenSettings ? onOpenSettings() : navigate("/settings"))}
            />
          </GlideGroup>
          {/* mx-2/width/transition: same fullWidth row pattern every other
              row in this rail uses (RailButton's own style prop, mirrored
              by hand since the triggers here need their own DropdownMenu
              wrapper instead of a plain Link/button). Avatar+Help now sit
              side by side in this one row -- per explicit request ("we
              will have avatar and help then inside help a dropdown...").
              Help hides entirely while collapsed -- the collapsed rail is
              only 32px wide (SIDEBAR_COLLAPSED_ROW_WIDTH), room for one
              icon, same as every other row in this rail. */}
          <div
            // rounded-[var(--row-radius)] -- real bug, confirmed directly
            // ("the hover at avatar dropdown and help do not match the
            // rounded borders"): this wrapper's own overflow-hidden (needed
            // to clip the width transition below) had no matching radius of
            // its own, so it clipped the avatar/help buttons' rounded hover
            // fill into sharp corners instead of following their actual
            // rounded-[var(--row-radius)] shape.
            className="mx-2 mt-1 flex h-7 shrink-0 items-center gap-1 overflow-hidden rounded-[var(--row-radius)]"
            style={{
              width: collapsed ? SIDEBAR_COLLAPSED_ROW_WIDTH : rowWidth,
              transition: `width ${SIDEBAR_MOTION_MS}ms ${SIDEBAR_EASING}`,
            }}
          >
            {/* onOpenChange blurring the trigger on close -- same fix
                NavUser's own desktop dropdown uses (nav-user.tsx): Radix
                returns real DOM focus to a trigger a beat after its menu
                closes, and that specific programmatic refocus registers as
                genuine :focus-visible in-browser, leaving the focus ring
                stuck visible indefinitely otherwise. side="top": this row
                sits at the very bottom of the sidebar, so the menu has to
                open upward to stay on screen -- NavUser's own top-bar
                trigger (side="bottom") sits at the top of the window
                instead, where the same problem doesn't exist. */}
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
                  // px-1.5 (6px), not px-0.5 (2px) -- per explicit request
                  // ("verify the avatar... especially the size and
                  // location"): the reference sidebar's own footer row
                  // deliberately lands its avatar on "the same leading icon
                  // axis every other row uses" (sidebar-app/user-footer.tsx's
                  // own comment) -- ours wasn't actually matching *our own*
                  // other rows either, since RailButton's own icon sits
                  // inset by px-1.5 (the compact itemPx token) while this
                  // row was still on its pre-compact px-0.5, landing its
                  // avatar 4px further left than every row above it.
                  // No active:scale-[0.98] here any more, same reasoning
                  // as the New button's own fix (this file's own comment
                  // on that trigger has the full explanation): scaling the
                  // *whole* row down uniformly shifts everything inside it
                  // slightly toward the row's own center, since a plain
                  // CSS scale() isn't per-child-aware -- barely visible on
                  // a thin 14px line icon, but this row's own avatar is a
                  // 20px solid black/white filled circle, exactly the
                  // high-contrast/large-enough case where that shift reads
                  // as real, distracting movement. Confirmed directly ("it
                  // also happens to the avatar profile pic") after the
                  // transition-property fix just above (which made the
                  // shift *more* visible, not less -- it went from an
                  // instant snap to an eased, clearly-animated slide).
                  // transition-[background-color] alone is enough now that
                  // transform isn't part of what's being transitioned.
                  className="flex h-7 flex-1 min-w-0 shrink-0 transform-gpu items-center gap-2 rounded-[var(--row-radius)] px-1.5 text-left transition-[background-color] duration-150 hover:bg-hover-2/50"
                >
                  {/* DefaultAvatar (ui/avatar.tsx), not a hand-rolled flat
                      black/white badge -- real bug, confirmed directly
                      ("the avatar profile is using a different one at chat
                      and at sidebar"): this badge and ChatPage.tsx's own
                      human-row avatar were two separate implementations
                      that had drifted apart. Now the same component
                      everywhere, deterministic per-person color included.
                      size-5 (20px) kept as-is -- matches the installed
                      preset's own SidebarUserFooter avatar size (that
                      comment's own history is unrelated to this swap). */}
                  <span className="size-5 shrink-0 overflow-hidden rounded-full">
                    <DefaultAvatar name={displayName} />
                  </span>
                  {/* Same collapsed opacity-fade-in-sync-with-width-shrink
                      treatment as RailButton's own label span above.
                      text-muted-foreground, not text-ink --
                      this row lives in the rail itself (not a floating
                      popover on the main content surface), so it follows
                      the sidebar's own resting-text color pair, same as
                      every other row's label here, not the main content
                      --foreground/--muted-foreground tokens text-ink reads
                      from. AnimatePresence/motion.span inside it -- real
                      bug, confirmed directly ("when I log out still show
                      Giovanni Andrade/Alongside, that should fade out the
                      user name and fade in Guest"): the name itself now
                      crossfades on change (sign in/out, a real rename) via
                      its own opacity transition, nested inside this span's
                      unrelated collapse-width opacity transition. */}
                  {/* text-foreground, not text-muted-foreground -- per
                      explicit request ("our entire sidebar font color
                      items apart from describer needs to be the same
                      color as the help button... match our font color at
                      the chat"). */}
                  <span
                    className={`min-w-0 flex-1 truncate text-xs leading-none font-normal text-foreground transition-opacity duration-[280ms] ${collapsed ? "opacity-0" : "opacity-100"}`}
                  >
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
              {/* Same box treatment as NavUser's own desktop dropdown
                  (nav-user.tsx) -- radius matched so the account menu reads
                  identically regardless of which trigger opened it. No
                  hardcoded border/shadow any more -- per explicit request
                  ("switch from hardcoded code to the drop its own
                  background"), same as that file's own dropdown -- both
                  inherit the same real nesting-aware surface background
                  from the base DropdownMenuContent now. No more explicit
                  px-[12px]/pt-[4px]/pb-[12px] either -- that rhythm existed
                  to space this content around the profile header this menu
                  used to have; now that it's a plain label+items list (same
                  shape as every other dropdown here), the base
                  DropdownMenuContent's own p-1 is the right amount and the
                  extra padding was just making the sides read too wide. */}
              <BaseDropdownContent
                side="top"
                align="start"
                sideOffset={8}
                // w-72, not w-40 like every other dropdown -- per explicit
                // request ("the notifications height and width increases
                // as we get more notifications"): this is the one dropdown
                // whose real content (a chat name + reply preview +
                // timestamp) genuinely needs more than the shared 160px,
                // unlike every other dropdown's plain single-line rows.
                className="w-72 min-w-0 rounded-3xl font-normal"
              >
                {/* No profile header (avatar + name) here any more -- per
                    explicit request ("remove the avatar and name because it
                    doesn't make sense to show that in there"): the trigger
                    right below this menu already shows both for the same
                    account, so repeating them inside the menu it opens was
                    redundant. No "App" section label above Log out any
                    more either -- that grouped Settings/Docs/Help/Log out
                    together, but this menu now only holds Log out (plus
                    its own Models Usage section below), so a single-item
                    group label was redundant. Base UI Dropdown/MenuItem,
                    per explicit request ("Lets keep all base ui") --
                    AccountMenuItems itself (nav-user.tsx) uses the same
                    Base UI primitives, since its rows only render
                    correctly inside this same Base UI DropdownContext. */}
                <AccountMenuItems />
              </BaseDropdownContent>
            </BaseDropdownMenu>
            {/* Help -- new trigger alongside the avatar, per explicit
                request ("we will have avatar and help then inside help a
                dropdown like synara's for Docs,Keybindings"). Hidden while
                collapsed (see the row wrapper's own comment above) -- no
                room for a second icon in the 32px collapsed rail. */}
            {!collapsed && (
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
                    // No hover/active background -- same fix as the "..."
                    // menus' own triggers (sidebar-nav.tsx's own comment on
                    // those has the full bug report): color-only, via
                    // hover:text-ink and data-[popup-open]:text-ink (Base
                    // UI's own open-state attribute), not a filled box.
                    // text-foreground, not text-muted-foreground -- real
                    // bug, confirmed directly ("the help icon is not the
                    // same color as our icons"): every other sidebar icon
                    // just moved to text-foreground (this file's own
                    // comment on that fix), leaving this one the sole
                    // remaining muted holdout.
                    className="flex h-7 w-7 shrink-0 transform-gpu items-center justify-center rounded-[var(--row-radius)] text-foreground transition-colors duration-150 hover:text-ink data-[popup-open]:text-ink"
                  >
                    {/* Default strokeWidth (2), same as every other icon
                        here -- the earlier 2.5 override (tried first for a
                        perceived color mismatch that was actually a wrong
                        text color token, since fixed above) was the real
                        cause of a *new* mismatch, confirmed directly ("why
                        does it look that dark, are we using the same
                        weight as the other ones?"): once the color itself
                        matched, the extra stroke weight was the only thing
                        left making this one bolder than the rest. */}
                    <HelpCircleIcon className="size-[14px]" />
                  </button>
                  }
                />
                <BaseDropdownContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="w-40 min-w-0 rounded-3xl font-normal"
                >
                  <HelpMenuItems />
                </BaseDropdownContent>
              </BaseDropdownMenu>
            )}
          </div>
        </div>
        )}
      </div>
    </aside>
    </>
  );
}
