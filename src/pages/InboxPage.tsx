import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { PageContent } from "@/components/page-content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchIcon, UserIcon } from "@/components/icons/untitled-ui";
import { spring } from "@/lib/springs";
import { modelDisplayName, ProviderIcon, QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";
import { AlongsideLogo } from "@/components/icons/alongside-logo";

type InboxModel = { provider: string; model: string };

type InboxItem = {
  id: string;
  name: string;
  provider: string | null;
  model: string | null;
  lastActivity: string | null;
  snippet: string | null;
  snippetKind: "human" | "assistant" | null;
  snippetSender: string | null;
  // Every distinct provider/model this chat has actually used, most
  // recently used first -- more than one entry once a chat has switched
  // providers mid-conversation.
  models: InboxModel[];
};

// SQLite's own datetime('now') format ("YYYY-MM-DD HH:MM:SS", no timezone
// marker, always UTC) -- browsers don't reliably parse that as-is (some
// treat the space-separated form as local time instead of UTC), so this
// reshapes it into a real ISO 8601 string first.
function parseSqliteTimestamp(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

// No date-fns/dayjs in this app yet -- one small relative-time formatter is
// simpler than adding a dependency for it.
function formatRelativeTime(value: string): string {
  const date = parseSqliteTimestamp(value);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// Overlapping icon stack, one per distinct provider a chat has actually
// used -- per explicit request ("if I switch to claude or codex that should
// show both but in a stack card format"). -space-x-1.5 + ring-2
// ring-background is the same overlap technique ui/avatar.tsx's own
// AvatarGroup already uses (its own "group/avatar-group flex -space-x-2..."
// className), reused here directly rather than pulling in the full Avatar
// component for plain provider-mark <img>s. Capped at 3 -- a real, visible
// "+N" count past that would need actual UI of its own to be honest about
// what's hidden, not built here since no chat has hit that in practice yet.
function ModelStack({ models }: { models: InboxModel[] }) {
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {models.slice(0, 3).map((entry, index) => {
        const found = QUICK_CHAT_MODELS.find((m) => m.value === entry.model);
        if (!found) return null;
        return (
          <span
            key={`${entry.provider}-${entry.model}`}
            className="flex size-3.5 items-center justify-center rounded-full bg-background ring-2 ring-background"
            style={{ zIndex: models.length - index }}
          >
            <ProviderIcon model={found} className="size-3" />
          </span>
        );
      })}
    </span>
  );
}

function SearchBar({ query, onChange }: { query: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Label htmlFor="inbox-search" className="sr-only">
        Search conversations
      </Label>
      {/* h-7/text-xs/size-[14px] icon/rounded-[var(--row-radius-sm)] --
          matches the sidebar's own search input exactly (sidebar-nav.tsx),
          confirmed directly as a real drift: this one was still on h-9/
          text-sm/size-4 icon/rounded-xl (the old token this app moved off
          everywhere else), none of which matched the sidebar's own
          established compact-scale/shared-radius conventions. left-[9px],
          not left-3 -- same icon-position math the sidebar's own search
          uses (row edge + icon-span centering inset). */}
      <SearchIcon className="pointer-events-none absolute top-1/2 left-[9px] size-[14px] -translate-y-1/2 text-muted-foreground" />
      <Input
        id="inbox-search"
        placeholder="Search conversations"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        // focus-visible:border-focus-accent -- matches the sidebar's own
        // search input exactly (sidebar-nav.tsx's own comment on this
        // class has the full history), per explicit request ("we are
        // highlighting as blue, lets do the same once we are inside the
        // search at inbox").
        className="h-7 rounded-[var(--row-radius-sm)] border border-border pl-[30px] text-xs focus-visible:border-focus-accent md:text-xs"
      />
    </div>
  );
}

// Real search bar, per explicit request ("we should a search bar first
// saying Search conversations"). Cards below it, per a later explicit
// request: full-width rows, chat name + provider icon, "X minutes ago"
// beside the name, and a snippet of the last message underneath -- backed
// by GET /inbox-items (backend/src/db.rs's own list_inbox).
export function InboxPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InboxItem[]>([]);
  // Gates the empty state below -- without this, `items` starting at []
  // (before the fetch below resolves) would flash "See your chats
  // activity" for a real, non-empty inbox on every load.
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "Inbox";
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/inbox-items");
      if (!res.ok || cancelled) return;
      setLoaded(true);
      const data: {
        id: string;
        name: string;
        provider: string | null;
        model: string | null;
        last_activity: string | null;
        snippet: string | null;
        snippet_kind: "human" | "assistant" | null;
        snippet_sender: string | null;
        models: InboxModel[];
      }[] = await res.json();
      if (cancelled) return;
      setItems(
        data.map((item) => ({
          id: item.id,
          name: item.name,
          provider: item.provider,
          model: item.model,
          lastActivity: item.last_activity,
          snippet: item.snippet,
          snippetKind: item.snippet_kind,
          snippetSender: item.snippet_sender,
          models: item.models,
        }))
      );
    }
    void load();
    // Real bug, confirmed directly ("I purposely create a new chat and
    // moved to inbox and the chat did not update the name in the
    // background to match my initial prompt... when I opened the chat then
    // the name of the chat updated"): a chat's own auto-rename
    // (chat_name_updated) only ever reaches that chat's own open
    // WebSocket -- this page has no per-chat WS connections of its own to
    // receive it on, and this fetch only ever ran once, on mount. A light
    // 4s poll while Inbox stays open is the simplest way to eventually
    // reflect a rename that happened after this page's own initial load,
    // without building a real push channel for a page that isn't watching
    // any one specific chat.
    const interval = setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const trimmedQuery = query.trim();
  // Real backend search (github.com/alongsidedotrun/alongside/issues/11),
  // not a chat-title-only substring filter over whatever's already loaded
  // -- same real gap/fix as SidebarSearch's own identical change
  // (sidebar-nav.tsx: "I searched for 'via codex'... that should scope
  // through all chats to find places where via codex is written"). Only
  // the *set* of matching chat ids comes from the backend; the actual row
  // still renders through this page's own already-loaded `items` (real
  // provider/model/snippet/last-activity), ordered by search relevance
  // (message match > chat name > project name) instead of `items`' own
  // last-activity order once a query is typed.
  const debouncedQuery = useDebounce(trimmedQuery, 200);
  const [matchedChatIds, setMatchedChatIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!debouncedQuery) {
      setMatchedChatIds(null);
      return;
    }
    let cancelled = false;
    fetch(`/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { chat_id: string }[]) => {
        if (!cancelled) setMatchedChatIds(rows.map((r) => r.chat_id));
      })
      .catch(() => {
        if (!cancelled) setMatchedChatIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);
  const filtered = useMemo(() => {
    if (!trimmedQuery || matchedChatIds === null) return items;
    const byId = new Map(items.map((item) => [item.id, item]));
    return matchedChatIds.map((id) => byId.get(id)).filter((item): item is InboxItem => item !== undefined);
  }, [items, trimmedQuery, matchedChatIds]);
  const isEmpty = loaded && items.length === 0;

  return (
    // @container/relative: mirrors HomePage.tsx's own outer wrapper exactly
    // -- the empty state below reuses its identical absolute-positioned
    // logo/heading formula (bottom-[104px], calc(50% + 16px + 12px)) so the
    // two pages' logos land on the *same real page-relative Y*, not just a
    // visually-close guess. Confirmed directly as a real gap ("the see
    // your chat activity does not match the same location as the new chat
    // ask anything because of the search bar at the top"): that formula
    // only produces the same Y when it's measured against the *full* page
    // height, the same denominator HomePage's own version uses -- so the
    // search bar has to sit *outside* that measured region entirely (an
    // absolute overlay pinned to the top, out of normal flow, same
    // technique HomePage's own compose box uses pinned to the *bottom*),
    // not push it down by its own real rendered height the way a normal
    // in-flow sibling would.
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
            {/* Reverted back off a brief fixed-top-offset experiment (tried
                to match WelcomePage.tsx's own Y) -- per explicit request
                ("revert new chat and inbox to keep the heading and icon at
                the middle as i prefer how that looks and accept that we
                won't be able to match getting started"). */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <AlongsideLogo className="size-[32px] text-black dark:text-white" />
            </div>
            <div className="absolute left-1/2 w-full max-w-[22rem] -translate-x-1/2 text-center" style={{ top: "calc(50% + 16px + 12px)" }}>
              <h1 className="text-[18px] font-normal text-foreground">See your chats activity</h1>
              <p className="mt-2 text-[13px] font-normal text-muted-foreground">
                At inbox you are able to see your most recent chats activity before entering the entire chat
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: spring.moderate }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            // px-4 moved here (off PageContent below), matching the search
            // bar's own wrapper exactly (below) -- per explicit request
            // ("the cards for the chats don't have the same width as the
            // search conversations"): px-4 living *inside* PageContent's
            // own max-w-800px box (as it did before) inset the cards an
            // extra 16px on each side beyond that already-centered column,
            // while the search bar's own px-4 sits outside its PageContent
            // instead -- same value, different position, so the two ended
            // up different real widths despite looking like they should
            // match. ScrollArea (fluidfunctionalism.com's own reference,
            // installed via shadcn), not plain overflow-y-auto -- per
            // explicit request, a real scrollbar on the right edge that
            // only appears once there's enough content to actually
            // overflow (Radix's own native behavior), instead of the
            // browser's default one.
            className="absolute inset-0 top-[56px] px-4"
          >
            {/* Plain overflow-y-auto, not ScrollArea -- two rounds of
                padding tweaks (pr-2.5, then pr-4) never actually stopped
                cards from running past the visible page boundary
                (confirmed directly, repeatedly: "still exiting the page
                boundary"). Real cause: Base UI's ScrollArea wraps
                children in its own Content element for horizontal-
                overflow measurement, which can make a w-full child (the
                card button below, via PageContent) size against its own
                intrinsic content width instead of the padded viewport box
                -- the exact same class of ScrollArea layout bug
                sidebar-nav.tsx's own recents list already hit and
                reverted for (that div's own comment has the fuller
                history), and compose-box.tsx's own / menu hit a sibling
                version of (percentage height that time, not width).
                No extra pr-* reserve any more -- per explicit correction
                ("the inbox cards are not centralised like the search bar
                in box"), confirmed via a real screenshot: a fixed pr-4
                on top of this whole section's own px-4 held the cards
                16px further from the edge than the search bar above them
                *regardless* of whether a scrollbar was even present (a
                single card, nothing to scroll, still showed the gap) --
                the browser's own native overflow-y-auto scrollbar already
                carves its own space out of this box when content actually
                overflows, so reserving room for it externally isn't
                needed here. */}
            <div className="h-full overflow-y-auto">
            <PageContent className="gap-2 pb-6">
              {filtered.map((item) => {
                const model = item.model ? QUICK_CHAT_MODELS.find((m) => m.value === item.model) : undefined;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/chat/${item.id}`)}
                    // min-w-0 -- confirmed directly as a real bug ("the
                    // error in the description and other longer texts are
                    // escaping the cards size... that should go ... before
                    // escaping"): the snippet <p> below already has
                    // truncate/min-w-0 on itself, but this card is a flex
                    // item inside PageContent's own flex-col stack, and a
                    // flex item's default min-width is "auto" -- computed
                    // from its own children's min-content size -- not 0.
                    // white-space:nowrap text (an unbroken error message,
                    // here) has no wrap points, so its min-content width
                    // is its full, un-truncated width, which was
                    // propagating up through this un-set card and forcing
                    // the whole card wider than its container instead of
                    // letting the inner ellipsis actually take effect.
                    className="relative flex w-full min-w-0 flex-col gap-1 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-hover-2/50"
                  >
                    {/* Absolute top-right, not inline in the name row -- per
                        explicit request ("last updated... at the right top").
                        pr-16 on the name row (below) reserves room so a long
                        name's own truncation point still lands before this,
                        instead of running underneath it. */}
                    {item.lastActivity && (
                      <span className="absolute top-3 right-4 shrink-0 text-2xs text-muted-foreground">
                        {formatRelativeTime(item.lastActivity)}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 pr-16">
                      {model && <ProviderIcon model={model} className="size-4 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">{item.name}</span>
                    </div>
                    {item.snippet && (
                      // Who actually sent the snippet -- per explicit request
                      // ("should show the agent icon and the message or our
                      // profile avatar and our message"): a generic person-badge
                      // for a human message (this app has no real per-user
                      // avatar yet -- sidebar-nav.tsx's own account row uses
                      // this exact same theme-inverted circle+glyph stand-in for
                      // the same reason), or -- for an assistant reply -- a
                      // stack of every provider this chat has actually used
                      // (ModelStack above) plus their real names as text.
                      // Stacked vertically (sender row, then message below), not
                      // inline beside the name -- per explicit request ("the
                      // message should not be beside the name of the model but
                      // underneath like the message from the agent"), matching
                      // ChatPage.tsx's own agent-row layout (icon+label row,
                      // reply text below it).
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {item.snippetKind === "human" ? (
                            <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-black dark:bg-white">
                              <UserIcon className="size-2 text-white dark:text-black" />
                            </span>
                          ) : (
                            item.models.length > 0 && <ModelStack models={item.models} />
                          )}
                          {item.snippetKind !== "human" && item.models.length > 0 && (
                            // min-w-0 + truncate, not shrink-0 -- confirmed
                            // directly as a real bug ("the inbox cards is
                            // not fitting to the size of the screen and
                            // its being cropped instead of reduce the
                            // width of each card"): with several providers
                            // joined into one long name string, shrink-0
                            // refused to let this span shrink at all,
                            // forcing the whole row (and card) to overflow
                            // horizontally rather than truncating this
                            // text with an ellipsis the way the snippet
                            // line below it already does.
                            <span className="min-w-0 truncate text-2xs text-muted-foreground">
                              {item.models
                                .map((entry) => {
                                  const found = QUICK_CHAT_MODELS.find((m) => m.value === entry.model);
                                  return found ? modelDisplayName(found) : entry.model;
                                })
                                .join(", ")}
                            </span>
                          )}
                        </div>
                        {/* Same active-font/50%-dimmed treatment as the
                            sidebar's own Projects/Recents empty-state
                            placeholders (sidebar-nav.tsx), reused here directly
                            rather than the generic text-muted-foreground this
                            used before. */}
                        <p className="min-w-0 truncate text-2xs text-foreground opacity-50">{item.snippet}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </PageContent>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Search bar -- absolutely positioned at the top, out of normal
          flow, same technique HomePage.tsx's own compose box uses (pinned
          independently of the centered content above it). This is what
          actually keeps it from pushing the empty state's own logo down by
          its real rendered height -- see this file's own top-level
          comment. z-10 so it stays clickable above the cards list while
          that list scrolls underneath it (top-[56px] on that list already
          reserves this exact height so nothing starts hidden behind it).
          pt-1, not pt-6 -- per explicit request ("search conversations in
          the inbox should be in the same vertical height as the search in
          the sidebar"), confirmed via screenshot as still off by a small
          amount after an earlier pt-2 attempt: the sidebar's own <aside>
          clears the drag-strip region itself (pt-2/8px + its 32px
          collapse-toggle row = 40px) before a gap-1 (4px) and then Find,
          landing Find's own top at 40+4=44px from the very top of the
          window. This page's own root, by contrast, already starts at
          y=40 (AppLayout.tsx's own always-mounted 40px chat-scoped header
          sits *above* it, a different mechanism achieving the same
          clearance) -- so this wrapper's own top-0 is already that same
          y=40 baseline, and it only needs pt-1 (4px) on top of that to
          land this search at the same y=44 Find sits at, not pt-2's 8px
          (which overshot by exactly the same 4px difference). */}
      <div className="absolute inset-x-0 top-0 z-10 px-4 pt-1 pb-4">
        <PageContent>
          <SearchBar query={query} onChange={setQuery} />
        </PageContent>
      </div>
    </div>
  );
}
