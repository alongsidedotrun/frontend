import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/springs";
import { isAutoScrollSuppressed, suppressAutoScroll } from "@/lib/chat-scroll-suppress";
import { getUserDisplayName } from "@/lib/user";
import { ComposeBox, toImageInputs, type ImageAttachment } from "@/components/compose-box";
import { JoinRequests, type JoinRequest } from "@/components/join-requests";
import { clearPresence, setPresence, type Person } from "@/lib/presence";
import { FileDiffGroup, diffToRows, type DiffRow } from "@/components/FileDiff";
import type { SettingsSection } from "@/components/settings-overlay";
import { effortLabel, type EffortLevel } from "@/lib/effort";
import { isMonthFirstDateOrder, loadLanguage } from "@/lib/language";
import { loadNotifyTurnComplete, notifyTurnComplete } from "@/lib/notify-turn-complete";
import { pushTurnNotification } from "@/lib/turn-notifications";
import { ErrorText } from "@/lib/error-code";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { DefaultAvatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EditIcon,
  ResearchIcon,
  RotateCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Volume2Icon,
  XIcon,
} from "@/components/icons/untitled-ui";
import { ProviderIcon, QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";
import { lastUsedReady, loadLastContext, loadLastModel, saveLastContext, saveLastModel } from "@/lib/last-used";
import { StreamingText } from "@/components/streaming-text";
import { ThinkingState } from "@/components/thinking-state";
import { ThinkingReasoning } from "@/components/thinking-reasoning";

// A real agent reply now shows its own provider's mark (ProviderIcon, same as every
// other place in this app a model icon renders), not always AlongsideLogo -- per
// explicit request, that mark is reserved for "command" rows (/share's own reply,
// below) specifically, since those come from Alongside itself, not whichever AI
// provider is running the chat.
//
// animate (agent/command rows only) -- per explicit request, a genuinely live reply
// reveals in via streamdown's own word-stagger animation (StreamingText, real
// markdown rendering now, not plain text -- see that file's own comment); history
// loaded from a chat being reopened renders instantly instead, same "don't replay
// old messages as if they're new" reasoning the old awaitingReply-during-replay
// guard already used
// elsewhere in this file. Set once at push time from historyReplayedRef.current, not
// read live -- a row's own animate-or-not is decided the moment it's created and
// shouldn't change afterward just because more history loads later.
type ChatRow =
  | {
      kind: "human";
      id: string;
      text: string;
      displayName: string;
      time: string;
      // Real chat_events row id (lib.rs's own attach_event_id), not set for
      // a not-yet-acknowledged failed send below -- backs the real Resend/
      // Edit actions (ChatRowView's own comment on those has the full
      // reasoning): Edit needs a stable id to tell the backend which
      // message an edited resend should branch from.
      eventId?: number;
      // Real only once this message has actually been edited before
      // (lib.rs's own attach_branch_info) -- backs the "< i/N >" switcher
      // (BranchSwitcher, below). Undefined for the overwhelming majority
      // of messages, which have never been edited at all.
      branch?: { group: string; index: number; total: number };
      // Set only for a message this tab itself failed to send (sendMessage,
      // below) -- real bug, confirmed directly ("my messaged should have
      // gone to the chat and with an error underneath so i can click
      // retry"): a failed POST used to just window.alert() and drop the
      // typed text entirely, since a "human" row only ever got created from
      // the backend's own human_message broadcast, which a failed send never
      // triggers. images/effort are kept here (not just text) so Retry can
      // resend the exact same attempt, attachments included.
      failed?: { errorText: string; images: ImageAttachment[]; effort: EffortLevel };
    }
  | {
      kind: "agent";
      id: string;
      text: string;
      modelLabel: string;
      model: (typeof QUICK_CHAT_MODELS)[number];
      animate: boolean;
      time: string;
      // Real value (effortRef, below) captured at send time, not read live off the
      // slider when this row is pushed -- the slider can move again while a turn's
      // still in flight, and this needs to stay the effort *that turn* actually
      // ran with. Only meaningful for Claude today (compose-box.tsx's own Effort
      // slider comment has the full reasoning); AgentMessageActions only renders
      // the dial when row.model's own provider is Claude.
      effort: EffortLevel;
      // "Worked for Xs" (alongsidedotrun/private#53) -- undefined until the matching
      // "result" event lands (see turnStartedAtRef's own comment), so an in-progress
      // reply just shows nothing here yet rather than a placeholder.
      durationLabel?: string;
      // Real thinking-block text (Claude only -- Codex/Antigravity's own tool-use
      // events, wired up separately, never carry this), captured off the "reasoning"
      // ChatRow this used to be pushed as its own separate row (removed -- folded
      // into the unified TurnWorkDisclosure this row itself now renders instead).
      reasoningText?: string;
      // One entry per non-file-writing tool call this turn actually made
      // (real ContentBlock::ToolUse blocks, same provider-agnostic pipeline
      // every other tool_use branch already shares) -- {label:"Bash",
      // detail:"sed -n '1,160p' Internet.md"}, {label:"WebSearch",
      // detail:"some query"}. Per explicit request: these used to render as
      // their own separate ToolRow in the middle of the transcript,
      // cluttering it with every intermediate command a turn happened to
      // run. Now collected silently while the turn is "Working"
      // (liveToolCallLines, below) and only surfaced here, inside the same
      // expand arrow "Worked for Ns" already offers -- undefined when a turn
      // made no such calls, same as reasoningText. Write/Edit calls are
      // deliberately excluded -- those still render their own real diff card
      // (FileDiffGroup), not a hidden line, since that's a dedicated feature
      // in its own right, not incidental plumbing. Structured (label+detail),
      // not a single formatted string, so ThinkingReasoning can render each
      // the same way a real editor's own tool-call trace does -- bold label,
      // muted monospace detail -- rather than one plain sentence.
      toolCallLines?: { label: string; detail?: string }[];
    }
  | { kind: "command"; id: string; text: string; time: string }
  // name/summary/input real, not fabricated -- name and input are the tool_use
  // block's own real fields (input is its own raw arguments, serde_json::Value on
  // the backend); summary is derived from input's own known field names
  // (summarizeToolInput, below), same idea as dray's own ToolCall.tsx SUMMARY_FIELDS.
  | { kind: "tool"; id: string; name: string; summary: string | null; input: unknown }
  // text real, not fabricated -- the ContentBlock::Thinking block's own `thinking`
  // field (claude_agent_sdk_rs's ThinkingBlock), collapsed by default (below).
  // requestId/toolName/input real, not fabricated -- the backend's own real
  // control_request (claude_direct.rs's own top comment has the confirmed wire
  // shape). status starts "pending" and is patched in place (updateRow, below)
  // once the backend's own permission_resolved event names how this was answered
  // -- from this tab, another tab, a timeout, or the CLI itself withdrawing the
  // question (control_cancel_request).
  | {
      kind: "permission";
      id: string;
      requestId: string;
      toolName: string;
      input: unknown;
      status: "pending" | "allow" | "deny" | "cancelled" | "timed_out";
    }
  | { kind: "marker"; id: string; text: string };

// Same idea as dray's own ToolCall.tsx SUMMARY_FIELDS -- the one input field most
// worth showing inline for a given tool, so a tool row reads as "Read app.py" or
// "Bash: npm test" instead of a bare tool name. Falls through in order since a
// block only ever has some of these; the first one present wins. TargetFile --
// Antigravity's own write_to_file names its path field differently than every
// other provider (db.rs's own FILE_PATH_KEYS has the same real, confirmed-
// directly discrepancy for Library's file list).
const TOOL_SUMMARY_FIELDS = ["file_path", "path", "TargetFile", "notebook_path", "command", "pattern", "query", "url", "description"];

function summarizeToolInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  for (const field of TOOL_SUMMARY_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value) return value;
  }
  return null;
}


// Maps a provider-specific tool name onto the name this file's own rendering
// already knows how to treat specially, so a tool row reads the same
// regardless of which provider's own internal name produced it -- per
// explicit request ("write_to_file should be hidden as that's a backend
// thing"): Antigravity's write_to_file is functionally the same action as
// Claude's own Write (replace a file's full contents), but showing its raw
// internal tool name verbatim in a "worked for Ns" row read as an
// implementation detail leaking through, not a real tool.
const TOOL_NAME_ALIASES: Record<string, string> = {
  write_to_file: "Write",
};

// Display-only rename for the hidden-tool-call drawer specifically (this
// file's own toolCallLines/addLiveToolCallLine), collapsing every provider's
// own real tool names onto one shared "main states" vocabulary per explicit
// request: Read/Write/Edit/Run. Write/Edit never actually reach this map --
// isFileWrite (below) routes those straight to their own FileDiffGroup card
// instead -- so in practice this only ever needs to cover Read and Run, but
// the mapping itself makes no assumption about that.
//
// Every key here is a REAL, live-confirmed tool name, not a guess:
// - "Bash" -- Claude's own real tool name, and what backend/src/codex.rs
//   explicitly renames commandExecution to.
// - "run_command" -- Antigravity's own real tool name for a shell command
//   (confirmed earlier this session, `agy --output-format stream-json`).
// - "view_file" -- Antigravity's own real tool name for reading a file
//   (confirmed live just now, the same way: `agy --print "Read the file
//   ..." --output-format stream-json` reported tool_name "view_file").
// Claude's own "Read" and Codex's own "Edit" (fileChange always maps to
// "Edit" in codex.rs, never "Write") already match this vocabulary exactly
// and need no entry here. Codex has no distinct read-file tool at all --
// it reads files via shell commands (`sed`, `cat`), which already fall
// under "Run" through the "Bash" mapping above; not fabricated as its own
// bucket since no such real tool exists.
const TOOL_DISPLAY_LABELS: Record<string, string> = {
  Bash: "Run",
  run_command: "Run",
  view_file: "Read",
};

function toolDisplayLabel(name: string): string {
  return TOOL_DISPLAY_LABELS[name] ?? name;
}

// Real bug, confirmed directly ("it should be showing Run bash command and
// not like Run /bin/bash because that is the exact command, the commands
// should stay like synara's"): Codex's own real commandExecution command
// string is always wrapped in a literal shell invocation --
// `/bin/bash -lc "pwd && rg --files -g 'CEOs.md' -g 'CEOs'"` -- confirmed
// directly from a real transcript. That wrapper is real, but it's Codex's
// own internal plumbing for running a command at all, not something the
// model chose to say -- showing it verbatim buried the actual command a
// reader cares about behind boilerplate. Strips the wrapper down to the
// real inner command when it matches that exact shape; anything else
// (Claude's own Bash tool already gives the bare command with no wrapper)
// passes through unchanged.
function cleanRunCommand(command: string): string {
  const match = command.match(/^\/bin\/bash -lc "(.*)"$/s);
  return match ? match[1] : command;
}

function normalizeToolName(name: string): string {
  return TOOL_NAME_ALIASES[name] ?? name;
}

function messageTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Per explicit request: a message's own displayed time should read differently
// depending on how old it is, not always just "HH:MM" -- today stays bare time,
// this week gets the day name, this year gets DD/MM, older than a year gets
// DD/MM/YY. All four keep the HH:MM suffix. "This week"/"this year" are judged
// against the viewer's own local calendar (via the Date object's own local
// getters), not the UTC instant itself -- a message from a few hours ago should
// never read as "yesterday" just because UTC's own day rolled over first.
// Per explicit request, after being asked directly "what actually changes"
// between the three Language options and having to answer honestly that
// nothing did yet -- US date order is month-before-day (09/06), IE/UK is
// day-before-month (06/09), so this is the one real, ready difference among
// them (lib/language.ts's own isMonthFirstDateOrder comment has the full
// reasoning for why this stays a three-way LanguageValue check rather than
// collapsed to a US/British boolean the way spelling is).
function formatMessageTimestamp(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return time;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysAgo = Math.floor((now.getTime() - date.getTime()) / oneDayMs);
  const isSameWeek = daysAgo < 7 && date.getDay() !== now.getDay();
  if (isSameWeek) {
    const dayName = date.toLocaleDateString([], { weekday: "long" });
    return `${dayName} ${time}`;
  }
  const monthFirst = isMonthFirstDateOrder(loadLanguage());
  const isSameYear = date.getFullYear() === now.getFullYear();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const first = monthFirst ? month : day;
  const second = monthFirst ? day : month;
  if (isSameYear) return `${first}/${second} ${time}`;
  const year = String(date.getFullYear()).slice(-2);
  return `${first}/${second}/${year} ${time}`;
}

// backend/src/db.rs's chat_events.created_at is SQLite's own datetime('now'), which
// is UTC but formatted with no timezone suffix ("YYYY-MM-DD HH:MM:SS") -- appending
// "Z" (after swapping the space for datetime's own "T" separator) is what makes
// Date() parse it as the UTC instant it actually is instead of the browser's local
// timezone, which would silently skew every duration by the viewer's own UTC offset.
function parseServerTimestampMs(createdAt: string): number {
  return new Date(`${createdAt.replace(" ", "T")}Z`).getTime();
}

// Same "Xs"/"Xm Ys" shape as Synara's own turn-duration label (dug into their repo
// directly rather than guessing a format) -- seconds alone under a minute, otherwise
// whole minutes plus leftover seconds.
function formatWorkedDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return `row-${rowIdCounter}`;
}


// Real port of frontend/chat.html's chat log + compose box + WebSocket
// wiring -- frontend/ is superseded now that the sidebar/auth/home shell
// lives here (see Story 4.14, github.com/alongsidedotrun/alongside/issues/92). Same backend
// endpoints and event shapes (the SDK's raw Message JSON over the
// `/sessions/{id}/ws` WebSocket, plus the app's own human_message/
// user_joined/host_notice/chat_name_updated/replay_complete/rate_limited/
// agent_timeout/turn_stopped events) as the old page, adapted to React
// state instead of direct DOM manipulation.
//
// Deliberately simplified from the old page: the character-by-character
// "typing" reveal (a cosmetic replay, not real token streaming -- the SDK
// only ever delivers a message's full text at once) isn't ported. Real
// interactive behavior (send, retry, stop, copy, read aloud, rename) all
// is; that's the part actually worth porting, the typing animation was
// pure flourish on top of it.
export function ChatPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  // Lifted to AppLayout now (per explicit request -- the chat's name lives
  // in the top bar's breadcrumb, not a second bar this page rendered
  // itself). chatName is read-only here (document.title below);
  // receiveChatNameFromServer is the one write path this page still needs
  // -- the WebSocket's own chat_name_updated event.
  // refreshSidebarLists: called on the chat's own first human_message below
  // -- per explicit request ("recents at the sidebar should only show once
  // we actually create the new chat"), the backend now only lists a chat in
  // Recents once it has real content (db.rs's own list_chats comment has
  // the full reasoning), but nothing previously re-fetched that list at the
  // exact moment a brand-new chat crosses into "has real content" if its
  // own auto-naming happened to fail (chat_name_failed, not
  // chat_name_updated) -- receiveChatNameFromServer's own existing refresh
  // call only fires on a successful rename, not on every real message.
  const { chatName, receiveChatNameFromServer, refreshSidebarLists, openSettings, openFile, rightPanelOpen, notifyFilesTouched } =
    useOutletContext<{
      chatName: string;
      receiveChatNameFromServer: (name: string) => void;
      refreshSidebarLists: () => void;
      openSettings: (section: SettingsSection) => void;
      openFile: (path: string) => void;
      rightPanelOpen: boolean;
      notifyFilesTouched: () => void;
    }>();
  // Real correction, per explicit follow-up ("we reduce to 400px but
  // there's so much space around it, instead of reducing the content to
  // 400px, keep that as 800px and reduce the outside paddings on left and
  // right"): forcing max-width down to 400px shrank the actual message
  // bubbles/readable line-length, leaving a visibly empty gutter on both
  // sides of that narrower content inside the now-wider-than-400px left
  // Panel -- not what was wanted. The real 800px (or Expanded) cap stays
  // untouched; only the side padding shrinks while the panel is open, so
  // content still grows to fill however much of that cap the narrower
  // Panel can actually offer, without an artificial extra margin.
  // px-[50px], not px-1.5 -- per explicit follow-up ("keep a padding of at
  // least 100px maybe? 50px on left and 50px right? because now its too
  // close to the borders").
  const chatSidePadding = rightPanelOpen ? "px-[50px]" : "px-3 sm:px-5";
  const [rows, setRows] = useState<ChatRow[]>([]);
  // People waiting for this chat's host to let them in (components/join-requests.tsx).
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  // Real bug, confirmed via a real CI build failure (TS6133, "awaitingReply declared
  // but never read"): the old `awaitingReply` React state was fully superseded by
  // turnInProgress below and awaitingReplyRef (the imperative guard used throughout
  // this file's own event handlers) once the Stop-button fix landed, leaving the
  // state itself write-only -- `npx tsc --noEmit` run manually throughout this
  // session never caught it (only the real `tsc -b` project-build step `npm run
  // build`/CI actually uses does), so this only surfaced once a real Tauri build ran.
  // awaitingReplyRef alone still does everything the old state's reads needed.
  //
  // turnInProgress tracks the actual turn boundary: true from the moment a message
  // is sent, false only at a real turn-ending event (result/agent_timeout/
  // turn_stopped/share_result/rate-limit give-up) -- never cleared by intermediate
  // content the way the old awaitingReply state was (that's the real bug report,
  // "the stop button is not showing... its reverting to arrow straight away", this
  // replaced: the old state cleared the instant ANY renderable content arrived,
  // vanishing the compose box's Stop button mid-turn on longer, multi-step runs).
  const [turnInProgress, setTurnInProgress] = useState(false);
  // "reasoning" added per explicit request ("add the effects like Claude, Codex and
  // others do") -- real signal, not fabricated: a claude_agent_sdk_rs ContentBlock of
  // type "thinking" means the CLI's own extended-thinking output has started, arriving
  // as its own assistant-message block before the final text block (see the "assistant"
  // event handler, below). Deliberately no separate "writing" phase -- there's no real
  // signal for it beyond "the text block arrived", which already clears this indicator
  // in favor of StreamingText's own reveal, itself already a real "the reply is being
  // written" indication -- adding a redundant label on top would just be decoration.
  // "searching" added per explicit request ("if i asked to research something that
  // would show Searching") -- real signal too: a ContentBlock::ToolUse block whose
  // name is "WebSearch" (see the "assistant" event handler's tool_use branch, below).
  // Only the query itself (searchQueryRef, below) is real and shown; the pasted
  // reference component's own expandable source-chip/citation list is NOT built here
  // -- that needs a tool_result block, which claude_agent_sdk_rs's own doc comment
  // marks "rarely used in stream output," and no session log in this repo has ever
  // actually carried one for a real WebSearch call to confirm its shape against.
  // Building that against a guessed shape risks exactly what this app already
  // declined to do once before (streaming-text.tsx's own comment has the full
  // reasoning) -- fabricating structure for data that may never arrive.
  // "working" added (alongsidedotrun/private#53) -- the real thinking-block content
  // (Claude only) has landed but the turn's own final reply/tool result hasn't yet,
  // matching Synara's own "Thinking" -> "Working" progression (dug into their repo
  // directly). Distinct from "thinking" itself, which is the earlier phase before
  // any content has arrived at all.
  const [waitingPhase, setWaitingPhase] = useState<"waiting" | "thinking" | "working" | "reasoning" | "searching" | null>(null);
  // Live mirror of the thinking block's own real content, shown in the unified
  // TurnWorkDisclosure's expand panel while a turn is still in flight -- cleared
  // once the turn settles (folded into the agent row's own reasoningText field
  // instead, ChatRowView's "agent" branch).
  const [liveReasoningText, setLiveReasoningText] = useState<string | null>(null);
  // Real bug, confirmed directly ("There's no arrow to expand the worked to
  // see bash allowed"): handleEvent (the WS effect's own onmessage handler,
  // below) is defined once per session -- its own useEffect deps only ever
  // include [sessionId] -- so any state variable it reads directly, not
  // through a ref, is frozen at whatever that state held the one time this
  // effect actually ran, forever, regardless of later setState calls
  // elsewhere. liveReasoningTextRef/liveToolCallLinesRef exist purely so
  // handleEvent can read the CURRENT value instead of that permanently
  // stale one; the matching useState above/below still drives the actual
  // live re-render (TurnWorkDisclosure's own live call site, further down,
  // reads the state directly from JSX -- a normal render, not handleEvent's
  // stale closure, so that one was never affected).
  const liveReasoningTextRef = useRef<string | null>(null);
  // Same idea as liveReasoningText, above, but for non-file-writing tool
  // calls (ChatRow's own toolCallLines comment has the full reasoning) --
  // accumulated silently while the turn runs, folded into the settled agent
  // row once the turn's own text block arrives, never shown in the LIVE
  // "Working" shimmer itself -- per explicit request, these stay genuinely
  // hidden until "Worked" and its own expand arrow exist to reveal them.
  // Plain ref, no matching useState needed at all (unlike liveReasoningText):
  // nothing ever renders this live, it only ever gets read once, when the
  // turn settles.
  const liveToolCallLinesRef = useRef<{ label: string; detail?: string }[]>([]);
  // Keeps liveReasoningTextRef in sync -- call this instead of the raw
  // setLiveReasoningText anywhere inside handleEvent (its own comment,
  // above, has the full reasoning for why the ref is the one that matters
  // there).
  function updateLiveReasoningText(value: string | null) {
    liveReasoningTextRef.current = value;
    setLiveReasoningText(value);
  }
  function addLiveToolCallLine(label: string, detail?: string) {
    liveToolCallLinesRef.current = [...liveToolCallLinesRef.current, { label, detail }];
  }
  const searchQueryRef = useRef<string | null>(null);
  const [prompt, setPrompt] = useState("");
  // Non-destructive Edit -- per explicit follow-up ("the resend should
  // keep the old messages in there but as inactive and have a cancel
  // button where edit was... instead of wiping the whole thing"): editing
  // a message used to delete it and everything after it from real history
  // the moment Edit was clicked. Now that deletion is deferred until the
  // user actually sends the edited text -- clicking Edit only sets this
  // boundary (and drops the text into the compose box), which the render
  // below uses purely to dim the affected rows and swap that one row's own
  // Resend/Edit pair for a single Cancel action. handleSend (below) is
  // what actually calls truncate_messages_from, right before sending the
  // edited text, only if this is still set at that point.
  const [pendingEditEventId, setPendingEditEventId] = useState<number | null>(null);
  // loadLastModel() first, not a hardcoded "Claude Sonnet 5" -- real
  // follow-up, confirmed directly ("the tool bar now is loading Sonnet 5
  // instead of saving what was the last_provider choosen for quick load"):
  // a fixed fallback was only ever right by coincidence. loadLastModel
  // (lib/last-used.ts) is whatever model actually last produced a reply,
  // anywhere in the app -- a far better provisional guess than a constant,
  // and still just as immediate (localStorage, synchronous). Not undefined
  // either way -- see this const's own history below (the hasModel/
  // Manual-Plan-Auto pop-in-late bug this replaced): reopening an existing
  // chat with nothing in sessionStorage left this undefined until history
  // replay finished, so compose-box.tsx's own hasModel-gated picker stayed
  // hidden the whole time. chat_defaults/replay_complete still silently
  // correct *which* model once they know this specific chat's own better,
  // without ever toggling hasModel back off in between.
  const [defaultModelValue, setDefaultModelValue] = useState<string | undefined>(
    () => loadLastModel() ?? (QUICK_CHAT_MODELS.find((m) => m.label === "Claude Sonnet 5") ?? QUICK_CHAT_MODELS[0])?.value
  );
  // This chat's own per-chat default effort -- arrives over the WS's
  // "chat_defaults" message (handleEvent below), same per-chat override
  // mechanism as defaultModelValue above, per explicit request ("update set
  // as default to set as default for this chat").
  const [defaultEffortValue, setDefaultEffortValue] = useState<EffortLevel | undefined>(undefined);
  // Real data for compose-box.tsx's own ContextDropdown -- built from each
  // provider's own `result` event `usage` field (backend/src/*.rs's own
  // spawn modules forward that field on the wire). No `max` here any more --
  // real bug, confirmed directly ("remove the silent denominator"): this
  // used to hardcode 200_000 as "the" context window size, but that was
  // never actually right even for Claude alone (its own CLI reports a real,
  // per-model contextWindow -- 1,000,000 for claude-sonnet-5, confirmed
  // live -- that this app doesn't currently forward), let alone for Codex/
  // Antigravity, which don't expose a window size at all (confirmed via
  // their own --help). A fabricated denominator is worse than none: it
  // asserts a specific number is true when it isn't. Only a real per-turn
  // token count is shown now, no percentage-of-an-invented-total.
  // loadLastContext() as the initial value, not null -- per explicit
  // request ("context is loading at the bottom right push both Manual and
  // Medium to the left... last_context saved as well for loading
  // purposes"): the meter popping in only once the first turn actually
  // completes visibly shoved its neighbors left the moment it appeared.
  // Seeding this with whatever usage was last actually reported (this file
  // itself, below) means the meter -- and the layout space it takes --
  // is already there from the first frame; the real "result" handler
  // below still corrects the numbers the moment this chat's own real
  // usage is known.
  const [contextUsage, setContextUsage] = useState<{ used: number } | null>(() => loadLastContext());
  // Antigravity has no real auto-compact CLI flag (confirmed via `agy
  // --help`), unlike Claude's own --autocompact -- so the same threshold the
  // Context dropdown lets a user pick is read back here and enforced
  // client-side for Antigravity (and Codex, via the real compact endpoint)
  // specifically: once usage first crosses it, this fires a real compact
  // itself. Per-chat now (db.rs's own default_autocompact comment has the
  // full "I want it to be per chat" reasoning), sourced from the same
  // "chat_defaults" WS message default_model/default_effort already use,
  // not a separate global settings fetch. autocompactThresholdRef avoids
  // re-checking on every usage update; compactedAboveRef stops this from
  // firing again on every later message once already above threshold (a
  // real compact naturally drops `used` back down, which re-arms it for
  // the next crossing).
  const autocompactThresholdRef = useRef(500_000);
  const compactedAboveRef = useRef(false);
  const [autocompactValue, setAutocompactValue] = useState("500000");
  // Per explicit request ("Compact per chat as a describer or Context per project as
  // a describer"): the Context dropdown's own label reflects which scope is actually
  // active, and writes route to the matching endpoint -- /sessions/{id}/... for
  // "chat", /projects/{id}/... for "project" (chat_defaults's own project_id, only
  // meaningful once autocompactScope is "project").
  const [autocompactScope, setAutocompactScope] = useState<"chat" | "project" | "global">("chat");
  const projectIdRef = useRef<string | null>(null);
  // Real bug, confirmed directly ("I can't see the context anymore"):
  // loadLastContext() above reads last-used.ts's own in-memory cache, which
  // is still empty at the exact moment this component's first render runs --
  // it only fills in once that module's own background GET actually lands
  // (lastUsedReady), a real network round trip that's always slower than a
  // synchronous useState initializer. Nothing ever re-read the cache once it
  // did resolve, so a freshly mounted ChatPage (a reload, or opening a chat
  // that hasn't produced a new reply yet this session) stayed stuck on null
  // forever, even though the backend genuinely had a real last-known value.
  useEffect(() => {
    let cancelled = false;
    void lastUsedReady.then(() => {
      if (cancelled) return;
      const cached = loadLastContext();
      if (cached) setContextUsage((prev) => prev ?? cached);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const chatLogRef = useRef<HTMLDivElement>(null);
  // The inner content column (rows.map + the waiting indicator), not
  // chatLogRef itself (the outer overflow-y-auto scroller, whose own box
  // size is fixed by its flex parent, not by how much content is inside
  // it) -- ResizeObserver below needs to watch *this* one to catch content
  // actually growing.
  const chatContentRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // The highest event id this chat view has received. Every event the backend records carries its
  // id and ids only grow within a chat, so this is both the point a dropped connection resumes from
  // (?after=) and the test for a duplicate: anything at or below it has already been shown.
  const lastEventIdRef = useRef(0);
  // Refs mirroring the state above, read from inside the WebSocket
  // onmessage handler -- that closure is set up once per session (not
  // re-subscribed on every render), so it needs a way to read the latest
  // value without becoming stale, same reason the old page could just read
  // its own top-level `let` variables directly.
  const awaitingReplyRef = useRef(false);
  const historyReplayedRef = useRef(false);
  const lastHumanPromptRef = useRef("");
  // Real bug, confirmed via a real transcript ("the retry did not do at the
  // first message but it sent a second message"): retryLastMessage (below)
  // used to call sendMessage with no edit_from_event_id at all, which is a
  // plain new send -- it genuinely appended a brand-new human row instead
  // of regenerating the existing turn, duplicating the prompt in the
  // transcript. Tracked here (alongside lastHumanPromptRef, same
  // human_message handler) so retry can pass it as editFromEventId instead,
  // the same real branch-and-locally-remove-old-rows path handleSend's own
  // Edit flow already uses correctly.
  const lastHumanEventIdRef = useRef<number | undefined>(undefined);
  // Turn-duration feature (alongsidedotrun/private#53), built the same way Synara's
  // own "Worked for Xs" is (dug into their repo directly): purely from message
  // timestamps, not any provider's own self-reported duration -- Claude and
  // Antigravity both self-report one, Codex doesn't, so a provider-duration-based
  // approach would silently leave Codex without one. turnStartedAtRef holds the
  // real server-recorded created_at (backend/src/lib.rs's own attach_created_at) off
  // the human_message that opened the current turn.
  //
  // Real bug, confirmed directly via screenshot ("We working should be at the
  // first message"): a turn that announces its own intent first ("I'll delete
  // the existing file...") before actually doing the work reads oddly with the
  // final "Worked for Ns" label attached to a LATER closing summary instead --
  // the reader sees a plain, label-less reply, then the real diff, then only
  // *then* a second reply that finally explains what happened. Patching the
  // FIRST agent row of the turn instead (firstAgentRowIdRef) puts "Worked for
  // Ns" right where the actual work started, which is also where a reader's
  // eye already is; a later closing summary this same turn produces still
  // renders as its own plain reply, just without a second (redundant) label.
  const turnStartedAtRef = useRef<number | null>(null);
  const firstAgentRowIdRef = useRef<string | null>(null);
  // Real bug, confirmed directly ("waiting for an answer should stop the
  // timer"): both the live counter and the final "Worked for Ns" used to
  // count straight through a pending permission request -- genuinely idle
  // time (the model can't do anything until a human answers) inflating a
  // number meant to represent how long the model actually worked.
  // pausedAtRef is when the CURRENT pause began (null while not paused);
  // pausedTotalMsRef accumulates every pause's own real duration across the
  // whole turn (a turn can hit more than one permission request). Both
  // subtracted from elapsed time everywhere it's computed, below.
  const pausedAtRef = useRef<number | null>(null);
  const pausedTotalMsRef = useRef(0);
  const [liveElapsedSec, setLiveElapsedSec] = useState<number | null>(null);
  // Same stale-closure reasoning as the refs above, for a real bug this one
  // caused directly: a chat's own auto-rename (chat_name_updated) and its
  // first turn's own completion (the "result" event, below) can land
  // moments apart on the very same WS message stream, but the "result"
  // handler's closure over the `chatName` *state* value was fixed at
  // whatever render set that closure up -- receiveChatNameFromServer's own
  // state update doesn't retroactively patch an already-running handler.
  // The turn-complete OS toast/in-app notification (notifyTurnComplete/
  // pushTurnNotification, below) could read the chat's just-replaced
  // "Untitled chat" name instead of its real new one -- confirmed directly
  // ("we keep getting notifications due to the chat starting as untitled
  // chat and changing to the name convention"), not a "hide Untitled chat"
  // problem (a chat can legitimately stay Untitled chat forever) but a
  // stale-value one.
  const chatNameRef = useRef(chatName);
  useEffect(() => {
    chatNameRef.current = chatName;
  }, [chatName]);

  useEffect(() => {
    document.title = chatName;
  }, [chatName]);
  // Full model object now, not just its label -- an agent row needs the model's own
  // icon/invertInDark to render that provider's real mark (ChatRow's own comment
  // above has the full reasoning), not only its display name.
  const modelRef = useRef<(typeof QUICK_CHAT_MODELS)[number]>(
    QUICK_CHAT_MODELS.find((m) => m.label === "Claude Sonnet 5") ?? QUICK_CHAT_MODELS[0]
  );
  // The model that actually produced the most recent reply row (rowModel,
  // set alongside pushRow below) -- the in-app notification pushed from
  // the "result" handler needs this same event.model-first attribution,
  // not modelRef.current alone, to avoid the confirmed "wrong model shown"
  // bug (that row's own comment has the full history) recurring here too.
  const lastReplyModelRef = useRef<(typeof QUICK_CHAT_MODELS)[number]>(modelRef.current);
  // Whether lastReplyModelRef actually reflects a real reply this chat ever
  // received, not just its own initial fallback value -- see
  // replay_complete's own comment below for what this gates.
  const sawRealReplyRef = useRef(false);
  // Whether this chat has a real per-chat pinned default ("Set as default
  // for this chat") -- see replay_complete's own comment below for what
  // this gates.
  const hasPinnedDefaultModelRef = useRef(false);
  // What the most recently *sent* turn actually ran with -- sendMessage (below)
  // sets this right before posting, from the effort value compose-box.tsx's own
  // onSubmit hands it directly (value-at-submit-time, same as images already
  // worked) -- the assistant-text handler reads this when pushing that turn's
  // own agent row. Was a second ref (effortRef) kept updated by a side-channel
  // onEffortChange callback before -- confirmed as a real bug (reported: "I set
  // Low, the reply's own dial showed Medium"), fixed by removing that whole
  // indirection rather than chasing its specific cause (compose-box.tsx's own
  // onSubmit comment has the full reasoning).
  const sentEffortRef = useRef<EffortLevel>("medium");

  // No removeItem after reading -- confirmed directly as a real bug: React 18
  // StrictMode (dev only) double-invokes this effect on mount (mount, cleanup, mount
  // again, specifically to catch missing cleanup, same behavior App.tsx's own
  // AppRoutes comment documents elsewhere in this app), so the "consume once" pattern
  // this used to have meant the *second* invocation always found sessionStorage
  // already cleared by the first, silently falling back to the hardcoded "Claude
  // Sonnet 5" default regardless of which model the chat actually started with (a
  // Codex reply was confirmed showing this exact stale "Claude Sonnet 5" label,
  // purely cosmetic -- the backend's own model routing was never affected, only this
  // ref). HomePage.tsx's own createSession always calls setItem fresh on the next real
  // "New chat", so there's no staleness risk from leaving these keys set between
  // chats either.
  useEffect(() => {
    const storedValue = sessionStorage.getItem("alongside_model_value");
    const found = storedValue ? QUICK_CHAT_MODELS.find((m) => m.value === storedValue) : undefined;
    if (found) modelRef.current = found;
    // Only overwrite when there's a real stored value -- leaving this as
    // `setDefaultModelValue(storedValue || undefined)` unconditionally
    // reset the provisional fallback the useState initializer above now
    // sets (that one's own comment has the full reasoning) back to
    // undefined for any chat with nothing in sessionStorage, undoing it a
    // tick after mount and re-triggering the exact pop-in this was meant
    // to prevent.
    if (storedValue) setDefaultModelValue(storedValue);
  }, []);

  function scrollToBottomIfNear() {
    const el = chatLogRef.current;
    if (!el) return;
    const threshold = 80;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (isNearBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }

  // Keeps following an agent reply as it streams in, not just once when its
  // row first appears -- confirmed directly as a real gap ("our scroll
  // should follow the behaviour of following the incoming texts... i have
  // to scroll down to see the text"). pushRow's own scrollToBottomIfNear
  // call only ever fires once, at the moment a row is created; everything
  // that happens *inside* an already-pushed row afterward -- StreamingText's
  // own word-by-word reveal chief among them, also a tool row expanding, an
  // image loading -- grows the content column's real height with no further
  // call to follow it, so the view fell behind and the user had to scroll
  // down manually to catch up. A ResizeObserver on the content column itself
  // catches every one of those cases generically (whatever caused the
  // growth) rather than needing a scroll call wired into each one by hand.
  // Still gated by scrollToBottomIfNear's own isNearBottom threshold -- per
  // explicit request ("if my scrollbar is not locked to the bottom... this
  // should not happen, that means i am reading an above text"), this only
  // ever follows when the user was already at the bottom, exactly the same
  // as the row-push case already worked.
  useEffect(() => {
    const el = chatContentRef.current;
    if (!el) return;
    // chat-scroll-suppress.ts's own comment has the full reasoning -- a
    // shared module, not a local variable, since a nested disclosure
    // (thinking-reasoning.tsx's own ToolDetailRow) needs to arm this same
    // suppression too, confirmed as a real gap directly ("the run command
    // is snapping the same way the parent was doing before"). Only
    // skipped HERE, not inside scrollToBottomIfNear itself: every other
    // caller of that function (a freshly sent message, a new row) is a
    // genuine "follow the new content" case that should still scroll even
    // if a disclosure happens to be mid-transition at the same moment.
    const observer = new ResizeObserver(() => {
      if (isAutoScrollSuppressed()) return;
      scrollToBottomIfNear();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Which rows arrived as part of history replay, not live -- per explicit
  // request ("when we open an existing chat that loads on a cascading
  // effect... I want a fade in the entire viewable chat, the other rest of
  // the chat that is not in view can load on a snap"): each row's own
  // t-row-in mount animation (index.css) firing as replay pushes rows in
  // quick succession was the actual cascade -- these rows skip it below.
  // Live rows pushed after replay finishes still get their own t-row-in,
  // same as before -- a real new message arriving on its own isn't a
  // cascade.
  const historicalRowIdsRef = useRef<Set<string>>(new Set());
  // DOM node per row, keyed by id -- replay_complete's own viewport check
  // below (once, after scrolling to bottom) needs each historical row's
  // real position to sort them into "fade together" vs "just there,
  // no animation" -- see that handler's own comment for the full mechanism.
  const rowElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // Historical rows found inside the actual visible viewport at the one
  // moment replay_complete checks -- these fade in together (one shared
  // transition, so no row starts its own fade later than another).
  // Everything else (scrolled out of view, above the fold) never enters
  // this set, so it renders at full opacity with no transition at all --
  // free, since the browser was never asked to animate something no one
  // can see yet.
  const [viewportVisibleRowIds, setViewportVisibleRowIds] = useState<Set<string>>(new Set());
  // Flips true once that one check has actually run -- until then, every
  // historical row stays at opacity-0 (see the render's own className
  // logic) so nothing flashes fully visible for a frame before the real
  // fade/snap decision lands.
  const [historicalRowsRevealed, setHistoricalRowsRevealed] = useState(false);

  // Non-null only while replaying after a branch switch's own reconnect
  // (branch_switched's handler, below) -- redirects every pushRow into
  // this buffer instead of touching `rows` directly, so the *previous*
  // branch's messages stay fully visible on screen until the new branch's
  // replay is actually ready to swap in as one atomic update (at
  // replay_complete, below), instead of the visible "everything
  // disappears, then rebuilds" flash confirmed directly ("the < return is
  // glitched when i come back, it flashes/disappears the message").
  const pendingBranchReplayRef = useRef<ChatRow[] | null>(null);

  function pushRow(row: ChatRow) {
    if (!historyReplayedRef.current) historicalRowIdsRef.current.add(row.id);
    if (pendingBranchReplayRef.current) {
      pendingBranchReplayRef.current.push(row);
      return;
    }
    setRows((prev) => [...prev, row]);
    scrollToBottomIfNear();
  }

  // Only real caller today: a "permission" row's own status, patched from
  // "pending" once the backend's own permission_resolved event names how it was
  // answered -- every other row kind is append-only (pushRow above), never
  // edited after the fact. Matched by requestId, not the row's own local id --
  // the backend only ever knows its own request_id, never this tab's id.
  function updatePermissionRow(requestId: string, status: Extract<ChatRow, { kind: "permission" }>["status"]) {
    let resolvedToolName: string | null = null;
    setRows((prev) =>
      prev.map((row) => {
        if (row.kind !== "permission" || row.requestId !== requestId) return row;
        resolvedToolName = row.toolName;
        return { ...row, status };
      })
    );
    // Same hidden-drawer treatment as every other tool call, per explicit
    // follow-up ("still showing Bash: Allowed... as a message and not under
    // Working") -- a resolved permission's own compact trace used to stay
    // inline forever (this row's own render branch, below, has the "that's
    // real chat history" reasoning that no longer applies now that every
    // other tool call already folds into the same drawer). requestId is
    // real and stable, but resolvedToolName only gets set synchronously
    // above if a matching row still exists.
    // Real bug, confirmed directly ("Claude now says Write Allowed instead
    // of Write Founders.md"): Write/Edit permission requests hit this same
    // path, but those tool calls already get their own real diff card
    // (FileDiffGroup, via the generic tool_use branch's own isFileWrite
    // check) with the actual file name -- adding a second "Write: Allowed"
    // trace here doesn't just duplicate that, it's strictly worse (loses
    // the real file name entirely). Skipped here the same way the generic
    // branch already skips them.
    const isFileWrite = resolvedToolName === "Write" || resolvedToolName === "Edit";
    // Real bug, confirmed directly ("Run Allowed should be not showing"):
    // an ALLOWED call already gets its own real entry the moment it
    // actually runs (the generic tool_use branch, below) -- "Run: Allowed"
    // was pure duplicate noise on top of that, unlike a genuine denial/
    // cancellation/timeout, which is the ONLY record that request ever
    // happened at all (the command never runs, so nothing else logs it).
    if (resolvedToolName && !isFileWrite && status !== "pending" && status !== "allow") {
      const label = status === "cancelled" ? i18n.t("chat.perm.withdrawn") : status === "timed_out" ? i18n.t("chat.perm.deniedTimedOut") : i18n.t("chat.perm.denied");
      addLiveToolCallLine(toolDisplayLabel(resolvedToolName), label);
    }
  }

  function pushMarker(text: string) {
    pushRow({ kind: "marker", id: nextRowId(), text });
  }

  // Requests still waiting on the host when this chat opens (events only carry changes).
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/sessions/${sessionId}/join-requests`)
      .then((response) => (response.ok ? response.json() : []))
      .then((pending: JoinRequest[]) => setJoinRequests(pending))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    function handleEvent(raw: string) {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(raw);
      } catch {
        pushMarker(raw);
        return;
      }

      const type = event.type as string;

      if (typeof event.event_id === "number") {
        if (event.event_id <= lastEventIdRef.current) return;
        lastEventIdRef.current = event.event_id;
      }

      // Sent once per connection, before history replay (server.rs's own
      // handle_socket) -- this chat's own per-chat default model/effort, if
      // "Set as default for this chat" has ever been used here. A null
      // field means no per-chat override exists, so that piece is left
      // alone (the sessionStorage-derived defaultModelValue below, or
      // compose-box.tsx's own global defaultEffortFor() fallback for
      // effort) rather than being overwritten with undefined.
      if (type === "chat_defaults") {
        const model = event.default_model as string | null;
        const effort = event.default_effort as EffortLevel | null;
        const autocompact = event.default_autocompact as string | null;
        const scope = event.autocompact_scope as "chat" | "project" | "global" | undefined;
        const projectId = event.project_id as string | null | undefined;
        if (model) {
          setDefaultModelValue(model);
          hasPinnedDefaultModelRef.current = true;
        }
        if (effort) setDefaultEffortValue(effort);
        if (autocompact) {
          setAutocompactValue(autocompact);
          const parsed = Number(autocompact);
          if (Number.isFinite(parsed)) autocompactThresholdRef.current = parsed;
        }
        if (scope) setAutocompactScope(scope);
        if (projectId !== undefined) projectIdRef.current = projectId;
        return;
      }

      // Real now (server.rs's own send_message) -- per explicit request: switching
      // models with nothing visible in the conversation read as if it hadn't worked
      // at all. Looks up the label from the raw model value the backend sends (it has
      // no access to QUICK_CHAT_MODELS' own display names), falling back to the raw
      // value itself if it's somehow not one of the known models. Also updates
      // modelRef so a *later* reply (after this client's own send, or another
      // participant's) labels itself correctly even if this client's own picker
      // wasn't what triggered the change.
      if (type === "model_changed") {
        const value = event.model as string;
        const found = QUICK_CHAT_MODELS.find((m) => m.value === value);
        if (found) modelRef.current = found;
        pushMarker(i18n.t("chat.switchedTo", { model: found?.label ?? value }));
        return;
      }

      if (type === "human_message") {
        const text = event.text as string;
        const sender = event.sender as string | undefined;
        lastHumanPromptRef.current = text;
        lastHumanEventIdRef.current = event.event_id as number | undefined;
        // Turn-duration feature (alongsidedotrun/private#53) -- this human_message
        // is the turn this reply belongs to, whether it's this client's own send, a
        // reconnect replaying history, or (once multiplayer sends land) another
        // participant's message.
        const createdAt = event.created_at as string | undefined;
        turnStartedAtRef.current = createdAt ? parseServerTimestampMs(createdAt) : null;
        // Reset here, not just at "result" -- a turn that never cleanly
        // reaches "result" (a timeout, an error) would otherwise leave this
        // pointed at some earlier turn's row forever, since the "set only if
        // still null" logic below (firstAgentRowIdRef's own comment) never
        // gets a chance to update it again once it's non-null. Same reasoning
        // for the two accumulators below -- a turn that never reaches
        // "result" (the only other place these reset, now that they
        // accumulate for the whole turn instead of resetting per text block)
        // would otherwise leak stray reasoning/tool-call data into the next.
        firstAgentRowIdRef.current = null;
        updateLiveReasoningText(null);
        liveToolCallLinesRef.current = [];
        pausedAtRef.current = null;
        pausedTotalMsRef.current = 0;
        // Real per-message value now (server.rs's own human_message event,
        // that file's own comment has the full reasoning) -- not a
        // client-side "whatever this tab most recently sent" ref, which
        // can't correctly attribute effort once more than one sender's
        // messages can interleave (Sprint 5's own multiplayer work) or even
        // solo once a second message queues before the first turn's own
        // reply lands. Read here, off the *real* preceding human_message,
        // so the very next assistant row (below) reflects what that
        // specific turn actually ran with, from any client's point of view
        // -- the sender's own tab, another participant's, or a fresh
        // reconnect replaying history.
        const effort = event.effort as EffortLevel | undefined;
        if (effort) sentEffortRef.current = effort;
        const myName = getUserDisplayName();
        const senderName = sender || myName;
        pushRow({
          kind: "human",
          id: nextRowId(),
          text,
          // Real name always, never pre-converted to "Me" here -- real bug,
          // confirmed directly while wiring up the new human-row header
          // (ChatRowView's own comment on that header has the full
          // reasoning): DefaultAvatar's "is this the local user" check
          // (ui/avatar.tsx) compares this field against getUserDisplayName()
          // to decide whether to use the persisted per-device avatar seed;
          // a literal "Me" string could never match that and would hash to
          // a fixed, wrong-in-intent color instead, the same for every
          // Alongside install. The "Me" label itself is now decided at
          // render time (ChatRowView), off this same real name.
          displayName: senderName,
          // Real server timestamp (relative-date display, alongsidedotrun/
          // private#53's own sibling request) when this event carried one --
          // every message before this feature existed, and any event type that
          // doesn't (see attach_created_at, backend/src/lib.rs), falls back to
          // this tab's own current time, same as before.
          time: turnStartedAtRef.current !== null ? formatMessageTimestamp(turnStartedAtRef.current) : messageTime(),
          eventId: event.event_id as number | undefined,
          branch: event.branch as { group: string; index: number; total: number } | undefined,
        });
        // Only show the waiting indicator for a live message, not while
        // replaying history -- otherwise every replayed human message
        // spawns its own indicator ahead of a reply that already exists a
        // few events later in the same replay burst. Same guard for
        // refreshSidebarLists (above) -- a genuinely new chat's first real
        // message is exactly the moment it should first appear in Recents;
        // replaying an existing chat's own already-recorded history isn't a
        // new "creation" and would just refetch the same list redundantly.
        if (historyReplayedRef.current) {
          awaitingReplyRef.current = true;
          setTurnInProgress(true);
          setWaitingPhase("waiting");
          refreshSidebarLists();
        }
        return;
      }

      // A guest asked to join, or the host decided one: the pending list is the source of truth,
      // so this only adds or removes the one request the event names.
      if (type === "join_requested") {
        setJoinRequests((current) => (current.some((r) => r.id === event.request_id) ? current : [...current, { id: event.request_id as string, display_name: event.name as string }]));
        return;
      }
      if (type === "join_decided") {
        setJoinRequests((current) => current.filter((r) => r.id !== event.request_id));
        return;
      }

      // Live: who is in the chat and who is online now (a full snapshot each time; never stored).
      if (type === "presence") {
        setPresence(event.participants as Person[]);
        return;
      }

      if (type === "user_joined") {
        pushMarker(i18n.t("chat.userJoined", { name: event.name }));
        return;
      }

      if (type === "host_notice") {
        pushMarker(i18n.t(event.enabled ? "chat.hostEnabled" : "chat.hostDisabled", { name: event.name }));
        return;
      }

      if (type === "chat_name_updated") {
        receiveChatNameFromServer(event.name as string);
        return;
      }

      // Backs the real "<"/">" branch switcher (BranchSwitcher, below) --
      // per explicit request ("if we replace the text, we should have a
      // new <> so we can go through the new text and old text with the
      // reply... similar to claude, codex does"). A branch switch can
      // change the *entire* downstream reply chain, not one row, so this
      // reloads by reconnecting the socket outright (clearing rows first)
      // rather than trying to patch the difference in place -- connect()
      // below replays whichever branch is active now from scratch, the
      // same real history every fresh page load already goes through.
      if (type === "branch_switched") {
        // Buffer, don't clear -- see pendingBranchReplayRef's own comment
        // (above pushRow) for why: the old branch's rows stay visible
        // until the new one is actually ready, swapped in atomically at
        // replay_complete below, instead of a blank flash in between.
        pendingBranchReplayRef.current = [];
        // A branch switch replaces earlier events, so this is a full replay, not a resume.
        lastEventIdRef.current = 0;
        wsRef.current?.close();
        connect();
        return;
      }

      // The server cannot extend this view (the chat has edit branches, or this view is ahead of
      // it): the history that follows replaces what is shown, swapped in at replay_complete the
      // same way a branch switch is.
      if (type === "replay_reset") {
        pendingBranchReplayRef.current = [];
        lastEventIdRef.current = 0;
        return;
      }

      if (type === "system") {
        if (awaitingReplyRef.current) setWaitingPhase("thinking");
        return;
      }

      // Real, provider-agnostic "a tool call just started" signal (backend/src/
      // antigravity.rs and codex.rs) -- both providers' own tool-lifecycle
      // events forward a real ToolUse row only once the call is already
      // finished (unlike Claude, which shows it immediately), so without this
      // a long Codex/Antigravity tool call showed nothing at all until it was
      // done. No row of its own -- just lights up the same "working" phase
      // Claude's own tool_use branch above sets, unconditionally (this can
      // arrive before or after awaitingReplyRef flips, and either way a tool
      // is now genuinely running).
      if (type === "tool_started") {
        setWaitingPhase("working");
        return;
      }

      // Real, provider-agnostic "reasoning has genuinely started" signal
      // (backend/src/codex.rs) -- Codex's own app-server emits a real
      // "reasoning"-typed item every turn (live-confirmed), same phase
      // Claude's own thinking-block branch above already shows, but Codex's
      // own item/started fires before any of its real text (if any ever
      // arrives -- often it does not) is known.
      if (type === "thinking_started") {
        if (awaitingReplyRef.current) setWaitingPhase("thinking");
        return;
      }

      // Real bug, confirmed via a real transcript (a raw {"type":"user",...}
      // tool_result blob showing up as visible chat text): the Claude Agent
      // SDK's own "user" message type echoes a completed tool call's own
      // result content back over the same stream (its own tool_use_id +
      // stdout/file-write confirmation) -- pure internal plumbing already
      // reflected by the real tool_use card (FileDiff/ToolRow) and the
      // model's own eventual reply, never meant to render as its own row.
      // Every other purely-internal event type (system, above) already
      // returns silently instead of falling through to the generic
      // pushMarker(raw) fallback -- this was simply missing that same
      // early return.
      if (type === "user") {
        return;
      }

      if (type === "replay_complete") {
        if (typeof event.last_event_id === "number" && event.last_event_id > lastEventIdRef.current) {
          lastEventIdRef.current = event.last_event_id;
        }
        // A resume after a dropped connection only sent what was missed: the transcript is already on
        // screen, so there is no first-load scroll or reveal to run again.
        if (event.resumed) return;
        // One atomic swap-in for a branch-switch reconnect's own buffered
        // replay (pendingBranchReplayRef's own comment, above pushRow, has
        // the full reasoning) -- the old branch's rows are still what's on
        // screen up to this exact point, then instantly become the new
        // branch's rows in the same render, never an empty state in
        // between.
        if (pendingBranchReplayRef.current) {
          setRows(pendingBranchReplayRef.current);
          pendingBranchReplayRef.current = null;
        }
        historyReplayedRef.current = true;
        // Land on the newest message once history has finished loading,
        // instead of leaving scroll position at the top of a long
        // conversation.
        const el = chatLogRef.current;
        if (el) el.scrollTop = el.scrollHeight;

        // One-time viewport check, right after the scroll-to-bottom above
        // -- per explicit request ("I want a fade in the entire viewable
        // chat, the other rest of the chat that is not in view can load on
        // a snap"). rAF, not this same tick: scrollTop was just written
        // above, and layout needs a frame to actually settle before
        // getBoundingClientRect below reads real positions. historicalRowIdsRef
        // (not `rows`, a stale closure this handler was set up before) has
        // every row id replay actually pushed.
        requestAnimationFrame(() => {
          const container = chatLogRef.current;
          if (!container) return;
          const containerRect = container.getBoundingClientRect();
          const visible = new Set<string>();
          for (const id of historicalRowIdsRef.current) {
            const node = rowElsRef.current.get(id);
            if (!node) continue;
            const rect = node.getBoundingClientRect();
            if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
              visible.add(id);
            }
          }
          setViewportVisibleRowIds(visible);
          setHistoricalRowsRevealed(true);
        });

        // Reopening an existing chat now defaults the model picker to
        // whichever model this chat's own history actually last replied
        // with -- real bug, confirmed directly ("the model that I
        // initially created or left at should remain because now after
        // opening an existing chat, i have to select the model again"):
        // without a real per-chat pin ("Set as default for this chat",
        // chat_defaults above), defaultModelValue only ever came from
        // sessionStorage's own "whichever model the last *newly created*
        // chat used" -- unrelated to this specific chat's own history.
        // hasPinnedDefaultModelRef takes priority when set (an explicit
        // pin beats "whatever it happened to end on"); sawRealReplyRef
        // guards a brand-new, still-empty chat, which has no real history
        // to derive this from yet.
        if (!hasPinnedDefaultModelRef.current && sawRealReplyRef.current) {
          setDefaultModelValue(lastReplyModelRef.current.value);
        }

        // HomePage.tsx's own createSession queues a brand-new chat's first message
        // here (sessionStorage, not sent before navigating) instead of POSTing it
        // itself -- per that file's own comment, sending it before this WS ever
        // subscribed was the real cause of a fast reply arriving as replayed
        // history (waiting indicator and streaming reveal both suppressed).
        // getItem+removeItem synchronously, before the actual send below --
        // this WS effect really does mount twice in dev (React 18 StrictMode,
        // this file's own WS-connect effect comment has the full reasoning), so a
        // second concurrent replay_complete (the doomed first socket, still
        // briefly alive) must find nothing left to send, not race the real one.
        const pendingRaw = sessionStorage.getItem("alongside_pending_message");
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw) as {
              sessionId: string;
              prompt: string;
              senderName: string;
              images?: { media_type: string; data: string }[];
              effort?: EffortLevel;
              model?: string;
            };
            if (pending.sessionId === sessionId) {
              sessionStorage.removeItem("alongside_pending_message");
              lastHumanPromptRef.current = pending.prompt;
              // No local sentEffortRef write here any more -- the server's own
              // human_message broadcast (which this POST triggers) is what sets
              // it now, the same authoritative path every other send uses.
              // pending.model (the value HomePage's createSession actually just
              // created this session with) first, modelRef.current.value only as
              // a fallback for an already-queued message from before this field
              // existed -- real bug, confirmed directly ("I had Opus selected...
              // showed Switched to GPT-5.6"): modelRef is restored by its own
              // separate mount effect (above) on a different re-run timing than
              // this one, so it could still hold a stale/wrong model (even
              // "Claude Sonnet 5", its own hardcoded initial value) the moment
              // this very first message went out, which the backend then read as
              // a deliberate mid-chat switch.
              void fetch(`/sessions/${sessionId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: pending.prompt,
                  sender_name: pending.senderName,
                  model: pending.model ?? modelRef.current.value,
                  images: pending.images,
                  effort: pending.effort,
                }),
              });
            }
          } catch {
            sessionStorage.removeItem("alongside_pending_message");
          }
        }
        return;
      }

      if (type === "rate_limited") {
        if (awaitingReplyRef.current) setWaitingPhase("waiting");
        return;
      }

      // Provider rate-limit events are rendered as a "command" row (Alongside's
      // own mark), not as a fake assistant reply. The legacy Claude event remains
      // accepted so persisted conversations from older builds still replay cleanly.
      // same treatment /share's own reply gets, since this notice is from Alongside
      // noticing the CLI's own real rate_limit_info, not the model itself talking.
      // resets_at is real Unix seconds from that event when the CLI actually
      // reported one (claude_direct.rs's own top comment has the source for the
      // field shape) -- formatted here in the viewer's own local time, same as
      // every other timestamp this page already shows (messageTime()).
      if (type === "provider_rate_limit" || type === "claude_rate_limit") {
        const resetsAt = typeof event.resets_at === "number" ? event.resets_at : null;
        const resetsAtLabel = resetsAt
          ? new Date(resetsAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : null;
        // Provider-agnostic wording now, not "Claude is..." -- per explicit
        // request ("ALS-011 and ALS-012 should be the same error for all
        // providers"), since only Claude has real rate-limit detection
        // today (claude_direct.rs's own rate_limit_info parsing) but the
        // copy should not bake that in as if it always will be true.
        const text = event.gave_up
          ? i18n.t("chat.usageLimit.gaveUp")
          : resetsAtLabel
            ? i18n.t("chat.usageLimit.resets", { time: resetsAtLabel })
            : i18n.t("chat.usageLimit.waiting");
        pushRow({ kind: "command", id: nextRowId(), text, time: messageTime() });
        if (awaitingReplyRef.current) setWaitingPhase("waiting");
        if (event.gave_up) {
          awaitingReplyRef.current = false;
          setTurnInProgress(false);
          setWaitingPhase(null);
        }
        return;
      }

      // Real event now (backend's own claude_direct.rs control-protocol handling)
      // -- the CLI is genuinely blocked on stdin waiting for this exact answer.
      // Real bug, confirmed directly, through two corrections: first "Waiting
      // disappears once we get the prompt for an answer but should stay there
      // as it's waiting on my answer" (fixed by no longer clearing the phase
      // entirely), then "Working should change to waiting when waiting for
      // the user to answer" -- leaving whichever phase was already active
      // (often "working", since a tool call's own start is what triggers a
      // permission request in the first place) was misleading: the MODEL
      // isn't doing anything right now, a human is being asked to. Forced to
      // "waiting" here instead, the same phase a turn starts in -- accurate
      // either way, since the model is genuinely idle until this resolves.
      if (type === "permission_request") {
        setWaitingPhase("waiting");
        // Real bug, confirmed directly ("waiting for an answer should stop
        // the timer") -- pausedAtRef/pausedTotalMsRef's own comment, above,
        // has the full reasoning. Guarded on already-null: this fires once
        // per real request, never twice for the same pause.
        if (pausedAtRef.current === null) pausedAtRef.current = Date.now();
        pushRow({
          kind: "permission",
          id: nextRowId(),
          requestId: event.request_id as string,
          toolName: event.tool_name as string,
          input: event.input,
          status: "pending",
        });
        return;
      }

      if (type === "permission_resolved") {
        const behavior = event.behavior as string;
        const status = behavior === "allow" ? "allow" : behavior === "cancelled" ? "cancelled" : "deny";
        updatePermissionRow(event.request_id as string, status);
        // Same pause tracking as permission_request, above -- this pause is
        // over, fold its real duration into the running total.
        if (pausedAtRef.current !== null) {
          pausedTotalMsRef.current += Date.now() - pausedAtRef.current;
          pausedAtRef.current = null;
        }
        // The turn is still genuinely in flight after an allow (the tool call the
        // question was about hasn't run yet) or a deny (the model still has to
        // react to being told no) -- back to a generic waiting state, same as
        // right after sending a message.
        if (awaitingReplyRef.current) setWaitingPhase("waiting");
        return;
      }

      // Real, per explicit request ("we should do a clear message, the model
      // failed to set a name to the chat") -- the backend's own auto-naming
      // (embeds a hidden instruction into the first message, lib.rs's own
      // with_chat_title_instruction) has no hard guarantee the model
      // actually complies; a silent "stayed Untitled chat" read as broken
      // rather than as a real, disclosed limitation of that approach. Just a
      // marker, not a waiting-state change -- fires alongside the turn's own
      // real reply, not instead of it.
      // (ALS-007) -- every user-facing error in this app carries a stable ID
      // now (project/ERRORS.md), per explicit request ("update all our
      // errors to give an ID to show in the docs what the ID actually
      // means"), so a report like "I'm seeing X" can be looked up precisely
      // instead of matched against message text that might reword over time.
      if (type === "chat_name_failed") {
        pushMarker(i18n.t("chat.errors.nameFailed"));
        return;
      }

      if (type === "agent_timeout") {
        awaitingReplyRef.current = false;
        setTurnInProgress(false);
        setWaitingPhase(null);
        pushMarker(i18n.t("chat.errors.timeout"));
        return;
      }

      if (type === "turn_stopped") {
        awaitingReplyRef.current = false;
        setTurnInProgress(false);
        setWaitingPhase(null);
        pushMarker(i18n.t("chat.turnStopped"));
        return;
      }

      if (type === "result") {
        awaitingReplyRef.current = false;
        setTurnInProgress(false);
        setWaitingPhase(null);
        setLiveElapsedSec(null);
        // Turn-duration feature (alongsidedotrun/private#53) -- this "result" is
        // this turn's own end, turnStartedAtRef (the preceding human_message) is
        // its start; patches the reply row a few lines above set
        // firstAgentRowIdRef to (that ref's own comment has the reasoning for
        // why the FIRST reply, not the last). Real server timestamps on both
        // ends (backend/src/lib.rs's own attach_created_at), not client-side
        // receive-time guesses, so a replayed history shows the same duration
        // every time, not however long this particular tab took to receive
        // each event.
        const resultCreatedAt = event.created_at as string | undefined;
        if (resultCreatedAt && turnStartedAtRef.current !== null) {
          // Real time spent genuinely paused (pausedAtRef/pausedTotalMsRef's
          // own comment, above, has the full reasoning) subtracted out --
          // "Worked for Ns" should reflect the model's own real working
          // time, not however long a human happened to take answering a
          // permission prompt in the middle of it.
          const pausedMs = pausedTotalMsRef.current + (pausedAtRef.current !== null ? Date.now() - pausedAtRef.current : 0);
          const durationSec = (parseServerTimestampMs(resultCreatedAt) - turnStartedAtRef.current - pausedMs) / 1000;
          const durationLabel = i18n.t("chat.workedFor", { duration: formatWorkedDuration(durationSec) });
          const rowId = firstAgentRowIdRef.current;
          if (rowId) {
            // reasoningText/toolCallLines patched here too, not at each text
            // block's own push -- real bug, confirmed directly ("The arrow
            // to expand and collapse is missing"): only the first reply ever
            // gets a durationLabel now, so it's the only row whose disclosure
            // can ever show anything; the *push-time* code's own comment has
            // the full reasoning. This is the whole turn's real accumulated
            // total, not just whatever happened before the first reply.
            const reasoningText = liveReasoningTextRef.current ?? undefined;
            const toolCallLines = liveToolCallLinesRef.current.length > 0 ? liveToolCallLinesRef.current : undefined;
            setRows((prev) =>
              prev.map((row) => (row.id === rowId && row.kind === "agent" ? { ...row, durationLabel, reasoningText, toolCallLines } : row))
            );
          }
        }
        turnStartedAtRef.current = null;
        firstAgentRowIdRef.current = null;
        updateLiveReasoningText(null);
        liveToolCallLinesRef.current = [];
        pausedAtRef.current = null;
        pausedTotalMsRef.current = 0;
        // Settings > General > Notifications ("Notify when a chat turn
        // completes", alongsidedotrun/private#207) -- this is the real
        // turn-completion point (the Claude Agent SDK's own "result"
        // event), same moment usage/context accounting below reacts to.
        // notifyTurnComplete itself checks the stored preference (global
        // or this specific chat's own override, chat-notifications.ts),
        // the OS permission, and whether the window is actually unfocused
        // before doing anything, so this call is unconditional here
        // beyond the sessionId guard (always real by this point in an
        // open chat, but notifyTurnComplete needs a real chat id, not
        // undefined).
        if (sessionId) notifyTurnComplete(chatNameRef.current, sessionId);
        // In-app companion to the OS toast above, per explicit request
        // ("the avatar dropdown inside the sidebar should be where we can
        // see real time notifications so we can [see] Notify when a chat
        // turn completes feature"): gated on the same stored preference
        // the OS toast checks, so a disabled setting means neither fires.
        // !document.hasFocus() too now -- real bug, confirmed directly
        // ("the inbox is showing our prompts as a notification even
        // though I had the page open... that does not make sense"):
        // ChatPage is only ever mounted for whichever chat is currently
        // open, so a reply landing while the window is focused is one
        // you're already watching stream in live -- a second "X replied"
        // banner about the exact thing on screen is just noise. Same
        // "already watching it" reasoning notifyTurnComplete's own OS
        // toast (just above) already applies internally; this call has no
        // such guard of its own.
        if (sessionId && loadNotifyTurnComplete() && !document.hasFocus()) {
          pushTurnNotification({
            chatId: sessionId,
            chatName: chatNameRef.current,
            modelLabel: lastReplyModelRef.current.label,
            timestamp: Date.now(),
          });
        }
        // usage.input_tokens is the uncached portion of this turn's prompt;
        // the remaining fields are each provider's own name for the cached
        // portion of that same prompt -- confirmed live against all three
        // real CLIs directly (not assumed from docs), and each provider only
        // ever sends its own subset, so summing every field below never
        // double-counts regardless of which one actually produced this
        // reply: Claude names them cache_creation_input_tokens/
        // cache_read_input_tokens, Codex cached_input_tokens/
        // cache_write_input_tokens, Antigravity cache_read_tokens (and also
        // hands back a precomputed total_tokens, used directly when present
        // since it's the provider's own real sum, not a re-derived one).
        // Summed with output_tokens (the reply just generated, now part of
        // the conversation), this gives the context size the *next* turn
        // will start from.
        const usage = event.usage as
          | {
              input_tokens?: number;
              output_tokens?: number;
              cache_creation_input_tokens?: number;
              cache_read_input_tokens?: number;
              cached_input_tokens?: number;
              cache_write_input_tokens?: number;
              cache_read_tokens?: number;
              total_tokens?: number;
            }
          | undefined;
        if (usage) {
          const used =
            usage.total_tokens ??
            (usage.input_tokens ?? 0) +
              (usage.output_tokens ?? 0) +
              (usage.cache_creation_input_tokens ?? 0) +
              (usage.cache_read_input_tokens ?? 0) +
              (usage.cached_input_tokens ?? 0) +
              (usage.cache_write_input_tokens ?? 0) +
              (usage.cache_read_tokens ?? 0);
          const usageValue = { used };
          setContextUsage(usageValue);
          saveLastContext(usageValue);
          // Codex (issue #265): same threshold-watcher pattern as Antigravity, but
          // through the real backend endpoint (thread/compact/start) instead of the
          // "/compact" text trick -- Codex's own compact only exists on that RPC.
          if (modelRef.current.provider === "Antigravity" || modelRef.current.provider === "Codex") {
            if (used >= autocompactThresholdRef.current) {
              if (!compactedAboveRef.current) {
                compactedAboveRef.current = true;
                if (modelRef.current.provider === "Codex") {
                  void fetch(`/sessions/${sessionId}/compact`, { method: "POST" });
                } else {
                  void sendMessage("/compact");
                }
              }
            } else {
              compactedAboveRef.current = false;
            }
          }
        }
        return;
      }

      if (type === "assistant" && event.message) {
        const content = (
          event.message as {
            content?: { type: string; text?: string; thinking?: string; name?: string; input?: Record<string, unknown> }[];
          }
        ).content;
        // "thinking" included here too now -- a message made up solely of a
        // thinking block (no text/tool_use alongside it) used to fall through this
        // guard entirely, so its own real content (below) never rendered.
        const hasRenderableContent = content?.some(
          (block) => block.type === "text" || block.type === "tool_use" || block.type === "thinking"
        );
        if (hasRenderableContent && content) {
          awaitingReplyRef.current = false;
          for (const block of content) {
            if (block.type === "thinking" && block.thinking) {
              // Real content now, not just a shimmer label -- the block's own
              // `thinking` field (claude_agent_sdk_rs's ThinkingBlock). Folded into
              // the unified TurnWorkDisclosure (alongsidedotrun/private#53) instead
              // of its own separate "reasoning" row: "working" keeps the live
              // indicator up (this turn's final reply/tool result hasn't landed
              // yet), with the real content available in its expand panel;
              // liveReasoningText carries over to the settled agent row's own
              // reasoningText field once the final text block below arrives.
              setWaitingPhase("working");
              updateLiveReasoningText(block.thinking);
            } else if (block.type === "text" && block.text) {
              setWaitingPhase(null);
              // event.model -- the real model that actually produced *this*
              // reply (backend/src/lib.rs's own record()/attach_model),
              // falling back to modelRef.current (the compose box's current
              // selection) only for an old chat recorded before that field
              // existed. Real bug, confirmed directly ("our chat show
              // Claude Sonnet 5... but then inbox shows GPT Sol 5.6 for
              // that chat, which one is wrong?"): every row here used to
              // read modelRef.current unconditionally, so a replayed
              // historical reply silently showed whichever model the
              // compose box currently has selected instead of the one that
              // actually generated it.
              const eventModel = typeof event.model === "string" ? QUICK_CHAT_MODELS.find((m) => m.value === event.model) : undefined;
              const rowModel = eventModel ?? modelRef.current;
              lastReplyModelRef.current = rowModel;
              sawRealReplyRef.current = true;
              // Only a genuinely live reply, not a replayed historical one
              // -- reopening some older, less-recently-used chat shouldn't
              // make its own history look like the most recent real usage
              // for every *other* chat's own provisional default.
              if (historyReplayedRef.current) saveLastModel(rowModel.value);
              const agentRowId = nextRowId();
              // Turn-duration feature (alongsidedotrun/private#53) -- this turn's
              // own "result" event (below) patches this exact row with the final
              // "Worked for Xs" label once it lands. Only the FIRST text block
              // this turn sets it (firstAgentRowIdRef's own comment has the
              // reasoning) -- a turn with a later closing summary just renders
              // that as its own plain reply, no second label.
              if (!firstAgentRowIdRef.current) firstAgentRowIdRef.current = agentRowId;
              pushRow({
                kind: "agent",
                id: agentRowId,
                text: block.text,
                modelLabel: rowModel.label,
                model: rowModel,
                animate: historyReplayedRef.current,
                // Real server timestamp (relative-date display) off this same
                // "assistant" event (backend/src/lib.rs's own attach_created_at),
                // not this tab's own current time -- otherwise every replayed
                // historical reply would show whatever moment it happened to be
                // replayed at instead of when it actually arrived.
                time: typeof event.created_at === "string" ? formatMessageTimestamp(parseServerTimestampMs(event.created_at)) : messageTime(),
                effort: sentEffortRef.current,
                // Real bug, confirmed directly via screenshot ("The arrow to
                // expand and collapse is missing to see all the states that
                // were ran"): this used to attach + reset liveReasoningTextRef/
                // liveToolCallLinesRef right here, on EVERY text block -- but
                // "Worked for Ns" (and its own expand arrow) only ever shows
                // on the turn's first reply now (firstAgentRowIdRef's own
                // comment). Any tool call that happened between a first reply
                // ("I'll verify...") and a later closing summary ("Created
                // Founders.md...") got attached to that SECOND row instead,
                // which never gets a durationLabel and so never renders its
                // own disclosure at all -- the data was real, just silently
                // orphaned. Left unset here; the "result" handler (below)
                // patches the actual first row with everything accumulated
                // across the WHOLE turn, once it's actually over.
              });
            } else if (block.type === "tool_use" && block.name === "WebSearch") {
              // No "tool" row for this one -- shown as the shimmer "Searching"
              // phase instead (waitingPhaseLabel, below), same treatment as
              // "thinking"/"reasoning". Settles the same way those do, once the
              // next text/tool_use block arrives.
              const query = (block.input?.query as string | undefined) ?? null;
              searchQueryRef.current = query;
              setWaitingPhase("searching");
              // Same treatment as the generic tool-call branch below -- the
              // query itself used to vanish the moment the turn settled
              // (searchQueryRef only ever backs the live shimmer); now it
              // survives in the same hidden, expandable list.
              if (query) addLiveToolCallLine("WebSearch", query);
            } else if (block.type === "tool_use" && block.name) {
              // summary/input real, not fabricated -- summarizeToolInput (this
              // file's own, above) reads the block's own real input fields; input
              // itself is kept on the row too so ChatRowView can show the full raw
              // arguments on expand, matching dray's own ToolCall.tsx.
              // "working", not null -- real bug, confirmed directly ("everything
              // falls in between Waiting, Worked"): this used to clear the phase
              // indicator the instant a tool_use block was merely seen, so a
              // long-running tool call showed nothing at all until the model's
              // own next block arrived. A tool call in flight is real, ongoing
              // work the same way a thinking block above is -- it settles back to
              // null the same way, once a text block (the actual reply) lands.
              setWaitingPhase("working");
              const toolName = normalizeToolName(block.name);
              const isFileWrite = toolName === "Write" || toolName === "Edit";
              if (isFileWrite) {
                // Only Write/Edit still render inline, as their own real
                // diff card (FileDiffGroup, via the render-time grouping
                // pass below) -- a dedicated feature in its own right, not
                // incidental plumbing a reader needs to dig for.
                pushRow({
                  kind: "tool",
                  id: nextRowId(),
                  name: toolName,
                  summary: summarizeToolInput(block.input),
                  input: block.input,
                });
                // Real bug, confirmed directly ("the files at the right
                // sidebar and library are not updating in real time so i
                // have to refresh"): right-panel.tsx's own ChatFileListPanel
                // only fetches once per chat, with nothing telling it a new
                // file just landed here. Write/Edit is exactly the moment
                // that becomes true.
                notifyFilesTouched();
              } else {
                // Every other tool call (Bash, Read, Grep, run_command,
                // etc. -- any provider, same ContentBlock::ToolUse shape)
                // per explicit request: no longer its own visible row
                // cluttering the transcript. Collected silently instead,
                // folded into the settled agent row's own toolCallLines
                // once this turn's text block arrives (above), revealed
                // only through that row's own "Worked for Ns" expand arrow.
                const displayLabel = toolDisplayLabel(toolName);
                const detail = summarizeToolInput(block.input);
                addLiveToolCallLine(displayLabel, detail && displayLabel === "Run" ? cleanRunCommand(detail) : (detail ?? undefined));
              }
            }
          }
        }
        return;
      }

      // /share's own reply (server.rs's own send_message, intercepted before it ever
      // reaches spawn_agent_session) -- rendered as a plain "agent" row per explicit
      // request ("show our icon replying"), which already always renders AlongsideLogo
      // regardless of modelLabel (see the agent-row JSX below) -- "Alongside" here is
      // just the label text next to that same icon, not a special-cased icon swap.
      // chat_path -> a full link: the backend doesn't know this page's own origin
      // (Tauri release vs. a self-hosted domain vs. 127.0.0.1:3000 in dev), only this
      // browser/webview does.
      if (type === "share_result") {
        awaitingReplyRef.current = false;
        setTurnInProgress(false);
        setWaitingPhase(null);
        // Story #412: the relay is the production path, so /share turns relay syncing on rather than
        // the host-embedded gateway; an invite still comes from the Share dialog's own "Create invite".
        const text = event.ok ? "Sharing is on. Open the Share menu to create an invite link." : (event.error as string);
        pushRow({ kind: "command", id: nextRowId(), text, time: messageTime() });
        return;
      }

      // Real @mention integrations (issue #287) -- server.rs's own send_message
      // short-circuits an unconnected @github/@gmail/@google-doc mention before
      // ever spawning a real turn, same "command"-row treatment share_result
      // (above) already uses for a comparable app-level (not model-generated)
      // answer.
      if (type === "integration_result") {
        awaitingReplyRef.current = false;
        setTurnInProgress(false);
        setWaitingPhase(null);
        pushRow({ kind: "command", id: nextRowId(), text: event.message as string, time: messageTime() });
        return;
      }

      // Fallback for any event shape not explicitly handled above.
      pushMarker(raw);
    }

    const wsUserName = encodeURIComponent(getUserDisplayName());
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    // React 19's StrictMode (dev only) mounts every effect, cleans it up,
    // then mounts it again -- specifically to catch missing cleanup. That
    // means this effect really does run twice on a fresh mount, and the
    // *first* socket's own intentional close() (from this same effect's
    // cleanup below, firing almost immediately) can raise its own onerror
    // before/instead of a clean onclose, depending on how far the
    // handshake got. Without this flag that read as a genuine "Lost
    // connection to the chat" marker on every single page load, confirmed
    // via direct WebSocket testing that a connection made and torn down
    // the same way outside this effect never errors on its own.
    let closingIntentionally = false;
    // Guards against registering the "online" listener twice if onerror
    // somehow fires more than once while already waiting for the network
    // to come back.
    let waitingForOnline = false;
    // Real bug, confirmed directly ("the web socket should automatically
    // detect it once backend is up"): the ALS-005 branch below used to just
    // show the marker and stop, with nothing left running to ever retry --
    // only the offline/online branch had a real reconnect path, via the
    // browser's own "online" event. This backend-down case has no
    // equivalent browser event to wait on, so it retries on a timer
    // instead: 1s, 2s, 4s, capped at 15s, doubling each failed attempt,
    // reset back to 1s the moment a connection actually opens. Only the
    // *first* failure in a run pushes the marker -- retrying silently in
    // the background instead of repushing it (and spamming the chat) on
    // every attempt.
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 1000;
    let hasShownDisconnectMarker = false;

    // Pulled out of the effect body so a network-outage/backend-down
    // reconnect (below) can call it again on the same session, instead of
    // duplicating the socket setup or forcing a full effect re-run.
    function connect() {
      // Resume from the last event this view has instead of replaying the whole chat on top of it.
      const after = lastEventIdRef.current > 0 ? `&after=${lastEventIdRef.current}` : "";
      const ws = new WebSocket(`${protocol}://${location.host}/sessions/${sessionId}/ws?name=${wsUserName}${after}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retryDelayMs = 1000;
        hasShownDisconnectMarker = false;
      };
      ws.onmessage = (event) => handleEvent(event.data);
      // An error and the close that follows it both mean the connection is gone; handling either
      // one (or both) is safe because every step below is guarded against running twice.
      ws.onerror = handleDrop;
      ws.onclose = () => {
        // A socket that was replaced on purpose (branch switch) closing is not a drop.
        if (wsRef.current !== ws) return;
        handleDrop();
      };
    }

    function scheduleReconnect() {
      if (closingIntentionally || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (closingIntentionally) return;
        retryDelayMs = Math.min(retryDelayMs * 2, 15000);
        connect();
      }, retryDelayMs);
    }

    function handleDrop() {
      if (closingIntentionally) return;
      // The WebSocket spec deliberately gives onerror no detail about
      // why it failed, but `navigator.onLine` distinguishes the one
      // cause that is genuinely not this app's problem: the browser
      // itself has no network route right now. Confirmed directly ("we
      // should never have a stale session id, if the connection drops
      // mid session we should not throw any errors as this is a network
      // issue at the user side") -- a dropped WiFi connection or a
      // laptop waking from sleep firing this same generic "WebSocket
      // error, is the session ID correct?" copy every time was
      // misleading (the session ID is essentially never the real cause)
      // and read as an alarming app error for something that is neither
      // alarming nor this app's fault. ALS-005 stays for a genuine
      // anomaly (the network is up but the socket still failed); a real
      // network outage gets its own calmer, distinct code instead.
      if (!navigator.onLine) {
        // Automatic reconnection once the network comes back -- per
        // explicit request. One-shot: the browser's own "online" event
        // fires at most once for this listener, and reconnecting calls
        // connect() again, which re-arms this same handling if that new
        // attempt also lands offline (a flaky connection flapping
        // between the two).
        if (!waitingForOnline) {
          pushMarker(i18n.t("models.noNetwork"));
          waitingForOnline = true;
          window.addEventListener("online", handleOnline, { once: true });
        }
        return;
      }
      if (!hasShownDisconnectMarker) {
        hasShownDisconnectMarker = true;
        pushMarker(i18n.t("chat.errors.lostConnection"));
      }
      scheduleReconnect();
    }

    function handleOnline() {
      waitingForOnline = false;
      if (closingIntentionally) return;
      connect();
    }

    connect();

    return () => {
      closingIntentionally = true;
      clearPresence();
      if (waitingForOnline) window.removeEventListener("online", handleOnline);
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Closing the tab (or navigating away) while a turn is in flight would
  // otherwise leave the backend generating -- and billing -- unattended.
  // sendBeacon fires reliably during unload, unlike a normal fetch.
  useEffect(() => {
    function onPageHide() {
      if (awaitingReplyRef.current && sessionId) {
        navigator.sendBeacon(`/sessions/${sessionId}/stop-turn`);
      }
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [sessionId]);

  // Turn-duration feature (alongsidedotrun/private#53), live half -- the "Worked
  // for Xs" row patch above only fires once a turn actually settles; this is
  // Synara's own "Working..." live counter (ChatPage.tsx's own waitingPhaseLabel,
  // below, appends it to whichever phase is currently showing). turnStartedAtRef
  // is the real server timestamp the human_message that opened this turn carried,
  // not when this effect happened to start -- a reconnect mid-turn should show
  // real elapsed time, not zero. Keyed on waitingPhase, not awaitingReply -- real
  // bug caught wiring this up: awaitingReply clears as soon as ANY renderable
  // content arrives, including just a thinking block, well before the turn's own
  // "result" event actually settles it, which would have frozen this counter the
  // instant the "Working" phase (below) started.
  useEffect(() => {
    if (waitingPhase === null) return;
    const tick = () => {
      if (turnStartedAtRef.current === null) return;
      // pausedAtRef/pausedTotalMsRef's own comment, above, has the full
      // reasoning -- ticking straight through a pending permission request
      // still runs every second while paused, but subtracting the
      // in-progress pause's own growing duration each time keeps the
      // displayed number frozen at whatever it was when the pause began,
      // exactly like the counter actually stopping.
      const pausedMs = pausedTotalMsRef.current + (pausedAtRef.current !== null ? Date.now() - pausedAtRef.current : 0);
      setLiveElapsedSec(Math.floor((Date.now() - turnStartedAtRef.current - pausedMs) / 1000));
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [waitingPhase]);

  async function sendMessage(
    text: string,
    images: ImageAttachment[] = [],
    effort: EffortLevel = sentEffortRef.current,
    editFromEventId?: number
  ) {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;

    // No local sentEffortRef write here any more -- that was the actual bug
    // (reported: "I set Low, the reply's own dial showed Medium," then again
    // after this file's own first attempted fix). It's a single client-side
    // ref, so it only ever reflects "what this tab most recently sent," not
    // what a given turn actually ran with -- wrong the moment a second
    // message queues before the first reply lands, or another participant's
    // own message interleaves (Sprint 5's own multiplayer work). The server's
    // own human_message broadcast (this POST triggers one) is the real source
    // now -- every client, this tab included, sets sentEffortRef from that
    // event instead (this file's own human_message handler, above).
    const res = await fetch(`/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // model: real now -- was silently dropped server-side (server.rs's own
      // SendMessageRequest had no field for it at all), confirmed directly via a
      // session log that picking a different model in the compose box never
      // actually changed which model a turn ran on. Always the current pick, not
      // just on a real change -- the backend only records a model_changed event
      // (and a visible marker, ChatPage's own handling of it below) when this
      // actually differs from the session's current model, so resending the same
      // value here on every turn is harmless.
      body: JSON.stringify({
        prompt: trimmed,
        sender_name: getUserDisplayName(),
        // Lets the backend ignore this send if it is repeated after a dropped connection.
        client_message_id: crypto.randomUUID(),
        model: modelRef.current.value,
        images: images.length > 0 ? toImageInputs(images) : undefined,
        // Real now (compose-box.tsx's own Effort slider, its own comment has the
        // confirmed --effort values) -- only actually applied server-side for
        // Claude today (server.rs's own SendMessageRequest comment has the same
        // reasoning), sent regardless of provider since it's harmless either way.
        effort,
        // Real "Edit" (server.rs's own SendMessageRequest.edit_from_event_id) --
        // branches instead of the plain append a normal send/Resend does.
        edit_from_event_id: editFromEventId,
        // Settings > General > Language -- per explicit follow-up, after
        // confirming the app's own UI copy has nothing to localize (every
        // apparent hit was a Tailwind class or a DOM API literal, not prose):
        // the one real lever is the agent's own generated reply text, via a
        // system-prompt instruction (backend/src/lib.rs's own
        // spelling_instruction). Sent on every turn, not just once, since the
        // preference can change mid-session.
        spelling_language: loadLanguage(),
      }),
    });

    if (!res.ok) {
      // Real bug, confirmed directly ("my messaged should have gone to the
      // chat and with an error underneath so i can click retry"): this used
      // to be a bare window.alert(), which both looks jarring (a native
      // browser popup inside a desktop app) and drops the typed message
      // entirely -- a "human" row only ever gets created from the backend's
      // own human_message broadcast (above), which a failed POST never
      // triggers. Pushed as a real row instead, showing the text the user
      // actually typed with the error and a Retry action underneath
      // (ChatRowView's own "human" branch, below).
      pushRow({
        kind: "human",
        id: nextRowId(),
        text: trimmed,
        displayName: getUserDisplayName(),
        time: messageTime(),
        failed: { errorText: i18n.t("chat.errors.sendFailed", { status: res.status }), images, effort },
      });
    }
  }

  function handleSend(images: ImageAttachment[], effort: EffortLevel) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setPrompt("");
    if (trimmed === "/summarize") {
      if (!sessionId) return;
      void fetch(`/sessions/${sessionId}/summarize`, { method: "POST" })
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          pushRow({
            kind: "command",
            id: nextRowId(),
            text: response.ok ? "Earlier messages were summarized for future context." : (body.error ?? "Unable to summarize this chat."),
            time: messageTime(),
          });
        })
        .catch(() => pushRow({ kind: "command", id: nextRowId(), text: "Unable to summarize this chat.", time: messageTime() }));
      return;
    }
    // Real branching only happens now, right as the edited text actually
    // goes out -- not the moment Edit was clicked (pendingEditEventId's
    // own comment, above, has the full reasoning). sendMessage's own
    // edit_from_event_id is what tells the backend to branch
    // (db::create_edit_branch) instead of just appending. A plain send
    // (no pending edit) passes undefined, same as it always has.
    const editEventId = pendingEditEventId ?? undefined;
    setPendingEditEventId(null);
    // Real bug, confirmed directly ("instead of replacing the current
    // message, it sent as a new message and i had to refresh to look
    // like it replaced the current one"): the backend genuinely does
    // branch (the old messages stop being the active branch), but this
    // tab's own already-rendered `rows` never had them removed --
    // pushRow only ever appends, so the edited send's own new rows just
    // landed underneath the still-visible old ones instead of appearing
    // to replace them. Only a full reload (a real reconnect, which
    // replays via the branch-aware, active-branch-only query) happened
    // to fix the *view* after the fact. Slicing the old branch's rows out
    // locally, right now, is what a real reconnect would show anyway,
    // just without waiting for one.
    if (editEventId !== undefined) {
      setRows((prev) => {
        const index = prev.findIndex((row) => row.kind === "human" && row.eventId === editEventId);
        return index === -1 ? prev : prev.slice(0, index);
      });
    }
    void sendMessage(trimmed, images, effort, editEventId);
  }

  async function stopTurn() {
    if (!sessionId) return;
    await fetch(`/sessions/${sessionId}/stop-turn`, { method: "POST" });
  }

  async function retryLastMessage() {
    if (!lastHumanPromptRef.current) return;
    // Real fix, confirmed via a real transcript ("the retry did not do at
    // the first message but it sent a second message"): retry now
    // branches from the same last human message instead of appending a
    // plain new one -- the exact same edit_from_event_id path/local-row-
    // slicing handleSend's own Edit flow already uses (that function's own
    // comment has the full "why slice locally" reasoning), just with the
    // text unchanged, since a retry re-asks the same question rather than
    // a different one.
    const editEventId = lastHumanEventIdRef.current;
    if (editEventId !== undefined) {
      setRows((prev) => {
        const index = prev.findIndex((row) => row.kind === "human" && row.eventId === editEventId);
        return index === -1 ? prev : prev.slice(0, index);
      });
    }
    await sendMessage(lastHumanPromptRef.current, [], sentEffortRef.current, editEventId);
  }

  // Distinct from retryLastMessage above -- that one (an agent reply's own
  // "regenerate" action) resends whatever text/effort a turn most recently
  // ran with; this resends one specific *failed send* row exactly as it
  // was typed, images and effort included (row.failed carries both, set
  // where the row itself was pushed, above). Removes the failed row first
  // so a second failure doesn't leave two copies of the same message
  // stacked in the log -- sendMessage pushes a fresh one of its own if this
  // attempt fails again too.
  async function retryFailedMessage(row: Extract<ChatRow, { kind: "human" }>) {
    if (!row.failed) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    await sendMessage(row.text, row.failed.images, row.failed.effort);
  }

  // "Resend" -- per explicit request, reversing this function's own earlier
  // "send it again as a brand-new message" decision ("the resend is
  // sending a new message and that should be retry and never send a new
  // message but resend the same"): now branches from this exact row's own
  // eventId instead, the same real branch-and-locally-remove-old-rows path
  // handleSend's own Edit flow (and retryLastMessage, above) already use --
  // just with the text unchanged, since a resend re-sends the same message
  // rather than a different one. No images to carry along regardless,
  // since a persisted human_message event never stores them (server.rs's
  // own send_message only keeps text/sender/effort in that event, images
  // are write-once to temp files at spawn time).
  async function resendMessage(row: Extract<ChatRow, { kind: "human" }>) {
    const editEventId = row.eventId;
    if (editEventId !== undefined) {
      setRows((prev) => {
        const index = prev.findIndex((r) => r.kind === "human" && r.eventId === editEventId);
        return index === -1 ? prev : prev.slice(0, index);
      });
    }
    await sendMessage(row.text, [], sentEffortRef.current, editEventId);
  }

  // "Edit" -- per explicit follow-up ("when we click edit the message, we
  // should get the message again in the compose box so we can switch
  // model, effort and permission"), then further revised ("keep the old
  // messages in there but as inactive and have a cancel button... instead
  // of wiping the whole thing"): no longer deletes anything itself -- just
  // drops the text into the compose box and marks the boundary (rendered
  // dimmed below). The real truncation is deferred to handleSend, only if
  // this edit is actually still pending by the time something gets sent.
  // Restores the compose box's own model selection to whatever this
  // exact message's own turn actually ran on -- per explicit request
  // ("can we fix this so it uses the focus of the model of the initial
  // message"). A human_message event carries no model of its own (only
  // effort), so this reads it off the very next "agent" row instead --
  // the real reply this message produced, whose own model is real (backend's
  // own attach_model), not the compose box's current, possibly-since-changed
  // pick. ComposeBox's own key (below) forces a remount when this changes,
  // since its defaultModelValue re-sync effect deliberately no-ops once a
  // model is already selected (compose-box.tsx's own comment on that has
  // the reasoning) -- a manual pick mid-chat should never get silently
  // overridden except for this one deliberate, explicit action.
  function editMessage(row: Extract<ChatRow, { kind: "human" }>) {
    if (row.eventId === undefined) return;
    const rowIndex = rows.findIndex((r) => r.id === row.id);
    const nextAgentRow = rowIndex === -1 ? undefined : rows.slice(rowIndex + 1).find((r) => r.kind === "agent");
    if (nextAgentRow?.kind === "agent") setDefaultModelValue(nextAgentRow.model.value);
    setPendingEditEventId(row.eventId);
    setPrompt(row.text);
  }

  // "Cancel" -- undoes editMessage above without ever having touched real
  // history (nothing was deleted yet), restoring every row to normal and
  // clearing the compose box back out.
  function cancelEdit() {
    setPendingEditEventId(null);
    setPrompt("");
  }

  // The "< i/N >" switcher's own click handler -- just tells the backend
  // which already-real branch to make active (db::select_branch); the
  // actual reload happens once its own "branch_switched" broadcast comes
  // back over the socket (this file's own handleEvent, above).
  async function switchBranch(group: string, index: number) {
    if (!sessionId) return;
    await fetch(`/sessions/${sessionId}/branch-groups/${group}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
  }

  // searchQueryRef -- real, not fabricated: the same WebSearch tool_use block's own
  // `input.query` field (see the "assistant" event handler above), shown only when
  // it actually arrived with one.
  const waitingPhaseLabel =
    (waitingPhase === "waiting"
      ? t("chat.phase.waiting")
      : waitingPhase === "working"
        ? t("chat.phase.working")
        : waitingPhase === "reasoning"
          ? t("chat.phase.reasoning")
          : waitingPhase === "searching"
            ? searchQueryRef.current
              ? t("chat.phase.searchingQuery", { query: searchQueryRef.current })
              : t("chat.phase.searchingWeb")
            : t("chat.phase.thinking")) +
    // Turn-duration feature (alongsidedotrun/private#53), live half -- Synara's
    // own "Working..." counter appends the same way, alongside whichever more
    // specific phase (Reasoning/Searching/etc.) is already known, rather than
    // replacing it. Real bug, confirmed directly ("remove the seconds at
    // waiting, that should only show at working"): a bare "Waiting" has no
    // real work happening yet to time (the model hasn't started, or a human
    // is being asked something) -- only "working" is genuine elapsed
    // work time worth surfacing a running counter for.
    (waitingPhase === "working" && liveElapsedSec !== null ? ` ${formatWorkedDuration(liveElapsedSec)}` : "");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1" viewportRef={chatLogRef} viewportClassName={chatSidePadding}>
        {/* max-w-[45rem] (720px) replaced with the shared PAGE_CONTENT_WIDTH
            (800px, page-content.tsx) -- same fix as the compose box below
            (this file's own comment a few lines down), which already uses it.
            The messages column was narrower than the compose box sitting
            right underneath it. */}
        {/* justify-end removed -- confirmed directly against dray's own real
            reference (apps/desktop/src/components/Chat.tsx), which starts
            messages at the top of the content and keeps the view pinned to
            the newest one via real scroll-follow logic (its own
            scrollTop = scrollHeight writes), not CSS bottom-anchoring.
            justify-end caused both real bugs reported together: a short
            conversation rendered pinned to the *bottom* of the viewport
            instead of starting at the top like every other AI provider
            (confusing -- there's no reason a 2-message chat should sit flush
            against the bottom with empty space above it), and every new row
            appended made the *entire* column reflow/jump upward at once to
            stay bottom-anchored, which read as a snap regardless of the row's
            own t-row-in fade-in (below) -- the fade was real, but the whole
            list shifting position underneath it wasn't animated at all. This
            app's own scroll-to-bottom behavior doesn't depend on justify-end
            at all -- scrollToBottomIfNear (this file, called from pushRow)
            and the replay_complete handler's own scrollTop = scrollHeight
            already handle it in JS, the exact same pattern dray uses. */}
        <div ref={chatContentRef} className="t-chat-width mx-auto flex w-full flex-1 flex-col gap-3 pt-16 pb-3" style={{ maxWidth: "var(--chat-max-width)" }}>
          {/* t-row-in -- per explicit request ("coming in very quickly, is there a
              transition like fade in"): every LIVE row mounting (human, agent, tool,
              reasoning, marker, command, permission alike) fades/slides in once,
              not gated behind row.animate the way StreamingText's own word reveal
              is -- a plain mount fade doesn't claim "this just happened live" the
              way a typing reveal would.

              Historical rows (replay) are handled entirely differently -- per
              further explicit follow-up ("the chat load still cascading...
              I want a fade in the entire viewable chat, the other rest of
              the chat that is not in view can load on a snap"): each one
              playing t-row-in at its own real push time during replay *was*
              the cascade, and a single fade on the whole column (tried
              first) still animated rows no one could see yet, for no
              reason. So a historical row instead: starts at opacity-0 and
              stays there until historicalRowsRevealed flips true
              (replay_complete's own one-time viewport check, above) --
              nothing flashes visible before that decision lands; once it
              lands, a row inside viewportVisibleRowIds gets a real
              transition (every such row's class changes in this same
              render, so they all start fading at the exact same moment --
              synchronized, not staggered); a row outside it just jumps to
              opacity-100 with no transition class at all, i.e. free. */}
          {/* pendingEditBoundaryIndex -- every row from here on (this
              message included) reads as "inactive" while an Edit is
              pending, per explicit request ("keep the old messages in
              there but as inactive... instead of wiping the whole
              thing"). Positional, same reasoning as the messages_truncated
              handler above: an agent reply doesn't carry its own eventId,
              so once the edited human row's own index is found, dimming
              (like the real deletion once it actually happens) applies by
              position, not by id alone. */}
          {(() => {
            const pendingEditBoundaryIndex =
              pendingEditEventId === null
                ? -1
                : rows.findIndex((r) => r.kind === "human" && r.eventId === pendingEditEventId);
            // Groups consecutive same-kind Write/Edit tool rows into one
            // FileDiffGroup card (per explicit request, "we should be
            // using the same component for all") -- a pure render-time
            // pass, not a change to `rows` itself/how it's pushed, so
            // history replay and live streaming both group the exact same
            // way with no separate logic. groupStarts maps a group's
            // first row id to the rows it stands in for; skipIds are
            // every other row in that run, rendered as nothing at all
            // (their own visual identity is now the group card).
            //
            // Real bug, confirmed directly via screenshot ("the filediff is
            // before the worked"): a Write/Edit run always happens BEFORE
            // the model's own final text block (the tool has to run before
            // the model can describe what it did), so it always rendered
            // above that reply -- read as backwards, since the natural
            // reading order is "here's what I did" then "here's the
            // change". A run immediately followed by an agent row (no
            // provider-specific check needed, every provider's own
            // tool_use/text ordering is identical) is deferred instead:
            // skipped at its own natural position (deferredAnchorIds) and
            // rendered again, via the same renderFileDiffGroupCard, right
            // after that agent row (deferredGroups, read in the render
            // loop below). A run with nothing after it, or followed by
            // anything other than an agent row (rare -- a turn that ends
            // mid-tool-call, or another tool group), still renders at its
            // own natural position, unchanged.
            const groupStarts = new Map<string, Extract<ChatRow, { kind: "tool" }>[]>();
            const deferredGroups = new Map<string, Extract<ChatRow, { kind: "tool" }>[]>();
            const skipIds = new Set<string>();
            for (let i = 0; i < rows.length; i++) {
              const r = rows[i];
              if (r.kind !== "tool" || (r.name !== "Write" && r.name !== "Edit")) continue;
              if (skipIds.has(r.id) || groupStarts.has(r.id) || deferredGroups.has(r.id)) continue;
              const run: Extract<ChatRow, { kind: "tool" }>[] = [r];
              let j = i + 1;
              while (j < rows.length) {
                const next = rows[j];
                if (next.kind !== "tool" || next.name !== r.name) break;
                run.push(next);
                skipIds.add(next.id);
                j++;
              }
              // Real bug, confirmed directly ("the claude provider does not
              // follow the same format we fixed"): this used to check
              // `rows[j]` directly, requiring literal index-adjacency --
              // Claude's own Write calls almost always have a real
              // "permission" row sitting between the tool run and the
              // model's own text reply (its permission_resolved trace
              // renders nothing at all, per ChatRowView's own "permission"
              // branch, but the ROW still exists in this array), which
              // broke the adjacency check even though there's genuinely
              // nothing visible in between. Skips forward past any row
              // that never renders anything of its own (today, only
              // "permission") to find the real next visible row instead.
              let k = j;
              while (k < rows.length && rows[k].kind === "permission") k++;
              const followingRow = rows[k];
              if (followingRow?.kind === "agent") {
                deferredGroups.set(followingRow.id, run);
                skipIds.add(r.id);
              } else {
                groupStarts.set(r.id, run);
              }
            }
            return rows.map((row, index) => {
            if (skipIds.has(row.id)) return null;
            const isHistorical = historicalRowIdsRef.current.has(row.id);
            const rowClassName = !isHistorical
              ? "t-row-in"
              : !historicalRowsRevealed
                ? "opacity-0"
                : viewportVisibleRowIds.has(row.id)
                  ? "opacity-100 transition-opacity duration-200"
                  : "opacity-100";
            // index > (not >=) -- confirmed directly as a real bug ("The
            // cancel button is not working"): the edited row itself is
            // what carries the Cancel button, so including it in
            // pointer-events-none disabled Cancel along with everything
            // else. Only rows strictly after it (what would actually be
            // deleted on send) dim/disable; the edited row stays fully
            // interactive.
            const isPendingEditInactive = pendingEditBoundaryIndex !== -1 && index > pendingEditBoundaryIndex;
            const deferredGroup = deferredGroups.get(row.id);
            const deferredCard = deferredGroup ? renderFileDiffGroupCard(deferredGroup, openFile) : null;
            // Real bug, confirmed directly via screenshot ("The state moved
            // instead of staying at the first message of the model"): the
            // LIVE Waiting/Working shimmer used to always render as its own
            // separate block at the very bottom of the whole rows list
            // (below), so once real content (a diff card, a permission
            // request) landed underneath the first reply this same turn,
            // the live indicator visibly drifted further down the page --
            // then, once the turn actually settled, "Worked for Ns" jumped
            // back up to attach to that first reply instead (firstAgentRowIdRef's
            // own fix). Rendered here instead, inline, in the exact same slot
            // the settled version will occupy (ChatRowView's own agent
            // branch, its own comment has that reasoning) -- the bottom
            // block (below) now only ever shows before any reply exists yet.
            const liveWorking =
              row.kind === "agent" && row.id === firstAgentRowIdRef.current && waitingPhase && !row.durationLabel
                ? { label: waitingPhaseLabel, detailText: liveReasoningText ?? undefined }
                : undefined;
            return (
            <Fragment key={row.id}>
              <div
                ref={(node) => {
                  if (node) rowElsRef.current.set(row.id, node);
                  else rowElsRef.current.delete(row.id);
                }}
                className={`${rowClassName} ${isPendingEditInactive ? "pointer-events-none opacity-40" : ""}`}
              >
                <ChatRowView
                  row={row}
                  isPendingEdit={row.kind === "human" && row.eventId === pendingEditEventId}
                  onCancelEdit={cancelEdit}
                  onRetry={retryLastMessage}
                  onRetryFailedMessage={retryFailedMessage}
                  onResendMessage={resendMessage}
                  onEditMessage={editMessage}
                  onSwitchBranch={switchBranch}
                  onOpenFile={openFile}
                  toolGroup={groupStarts.get(row.id)}
                  liveWorking={liveWorking}
                />
              </div>
              {deferredCard && <div className={rowClassName}>{deferredCard}</div>}
            </Fragment>
            );
          });
          })()}
          {/* Real bug, confirmed directly via screenshot ("The state moved
              instead of staying at the first message of the model"): this
              used to always render here regardless of whether a reply
              already existed, so it visibly drifted down the page as more
              content (a diff card, a permission request) landed below that
              first reply, then jumped back up once the turn settled
              (ChatRowView's own liveWorking prop, above, is the fix -- it
              takes over, inline, the moment a first reply exists). This
              block now only ever covers the gap before any reply exists yet
              -- real Waiting/Thinking with nothing to attach to. */}
          {waitingPhase && !firstAgentRowIdRef.current && (
            // No circle/orb any more -- per explicit request ("make sure
            // that we don't have any circle or placeholder for icons"):
            // the shimmering text on its own is the whole indicator now,
            // via thinking-state.tsx (installed with `npx shadcn@latest
            // add https://www.aicss.dev/r/thinking-state.json`, adapted
            // to accept this page's own four phase labels and to pull its
            // gradient from this app's real theme tokens instead of the
            // component's own hardcoded grays -- that file's own comment
            // has the full reasoning). text-[13px] to match this app's
            // own agent-reply text size, same reasoning the row's
            // previous size bump already established.
            <div className="flex items-center gap-2 py-1">
              <TurnWorkDisclosure label={waitingPhaseLabel} detailText={liveReasoningText ?? undefined} live />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* max-w-3xl (768px) replaced with the shared PAGE_CONTENT_WIDTH
          (800px, page-content.tsx) -- was drifting from HomePage's own
          compose box column by 32px; this is now the one width every
          page's primary content aligns to.
          px-3/sm:px-5 moved to this outer div, mx-auto+maxWidth to the inner
          one -- was one div carrying both, which put the side padding
          *inside* the 800px cap (ComposeBox itself capped at 800px minus
          the padding, ~752-720px). The messages column above (this file's
          own ref="chatLogRef" div) already keeps padding on its outer
          scroll container and the 800px cap on an inner div with none of
          its own, which is why they'd landed at two different real widths
          -- same structure now, so both actually reach 800px. pb-4, not
          pb-6 -- matches HomePage.tsx's own compose wrapper (that file's
          own comment has the full reasoning: pb-4 keeps the box's toolbar
          row centered with the sidebar's own account row). */}
      <div className={`shrink-0 pb-4 ${chatSidePadding}`}>
        <div className="t-chat-width mx-auto w-full" style={{ maxWidth: "var(--chat-max-width)" }}>
        {/* A pending permission sits here, full-width above the compose
            box, matching Claude Code/Codex's own CLI approval prompt --
            per explicit correction ("that actually should be similar to
            codex/claude where the action opens at the top of the compose
            box and be full length of the compose box"), not inline as a
            chat message (ChatRowView's own "permission" branch returns
            null for a pending one now, specifically so this is the only
            place it renders while still pending). At most one at a time
            in practice -- the CLI blocks on this exact answer before
            asking anything else -- so this only ever needs the first
            match, not a list. */}
        {/* AnimatePresence + a plain opacity fade -- per explicit request
            ("The answer popup at the compose box is snapping, we need a
            fade in and fade out effect"), same spring.moderate tier
            InboxPage.tsx's own card-list/empty-state crossfade already
            uses for a comparable "content appears/disappears above other
            content" moment. Keyed by requestId so a *different* pending
            permission (a fresh one appearing right as the previous one
            resolves) still triggers its own fade-in rather than being
            treated as the same element just updating in place. */}
        <AnimatePresence>
          {(() => {
            const pendingPermission = rows.find((r): r is Extract<ChatRow, { kind: "permission" }> => r.kind === "permission" && r.status === "pending");
            if (!pendingPermission) return null;
            return (
              <motion.div
                key={pendingPermission.requestId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: spring.moderate }}
                exit={{ opacity: 0, transition: spring.moderate.exit }}
                className="mb-2"
              >
                <PermissionCard
                  sessionId={sessionId}
                  requestId={pendingPermission.requestId}
                  toolName={pendingPermission.toolName}
                  input={pendingPermission.input}
                  status={pendingPermission.status}
                  hasProject={!!projectIdRef.current}
                  onStopTurn={stopTurn}
                />
              </motion.div>
            );
          })()}
        </AnimatePresence>
        {sessionId && <JoinRequests sessionId={sessionId} requests={joinRequests} onDecided={(id) => setJoinRequests((current) => current.filter((r) => r.id !== id))} />}
        <ComposeBox
          // Forces a remount whenever a *new* edit starts (editMessage's
          // own comment above has the full reasoning) -- ComposeBox's own
          // model-selection state only ever initializes from
          // defaultModelValue once, on mount, so this is what actually
          // makes it pick the edited message's own model back up instead
          // of keeping whatever was selected a moment before Edit was
          // clicked.
          key={pendingEditEventId ?? "default"}
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSend}
          placeholder={t("chat.sendPlaceholder")}
          // turnInProgress, not awaitingReply -- see this file's own comment on
          // turnInProgress's declaration for the full bug report ("stop button... reverting
          // to arrow straight away"). ComposeBox's only use of this prop is the Stop/Send
          // button swap, so this rename is safe here without touching awaitingReply's own
          // separate role driving the "Waiting"/"Thinking" shimmer above.
          awaitingReply={turnInProgress}
          onStop={stopTurn}
          defaultModelValue={defaultModelValue}
          defaultEffortValue={defaultEffortValue}
          chatId={sessionId}
          contextUsage={contextUsage}
          autocompactValue={autocompactValue}
          autocompactScope={autocompactScope}
          onSetAutocompact={(value) => {
            setAutocompactValue(value);
            const parsed = Number(value);
            if (Number.isFinite(parsed)) autocompactThresholdRef.current = parsed;
            // Real routing per the active scope -- writing to the chat's own row
            // while scope is "project" would silently do nothing (get_chat_defaults
            // ignores it in that mode), so this has to write through whichever
            // endpoint is actually authoritative right now.
            if (autocompactScope === "project" && projectIdRef.current) {
              void fetch(`/projects/${projectIdRef.current}/default-autocompact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value }),
              });
              return;
            }
            if (autocompactScope === "global") {
              void fetch("/settings/autocompact-global", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value }),
              });
              return;
            }
            if (!sessionId) return;
            void fetch(`/sessions/${sessionId}/default-autocompact`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value, sender_name: getUserDisplayName() }),
            });
          }}
          // Claude/Antigravity: sends the literal "/compact" text as an
          // actual turn (bypasses the draft entirely, so no async
          // value/onChange race) -- live-tested, both recognize it as a
          // real command outside interactive mode (Claude's own response:
          // "Not enough messages to compact" on a fresh session, not an
          // echo of the text). Codex (issue #265): a real backend call
          // instead -- `codex exec`'s own "/compact" is just ordinary text
          // (confirmed live), but `codex app-server`'s real
          // `thread/compact/start` RPC now backs this same button via
          // POST /sessions/{id}/compact (server.rs's own compact_turn).
          onCompactNow={() => {
            if (modelRef.current.provider === "Codex") {
              void fetch(`/sessions/${sessionId}/compact`, { method: "POST" });
            } else {
              void sendMessage("/compact");
            }
          }}
          // Codex only (compose-box.tsx's own onSteer comment has the full reasoning) --
          // real mid-turn injection via turn/steer, per explicit request ("press enter to
          // send the prompt mid way but keep the send as stop"). undefined for
          // Claude/Antigravity, so Enter during their own awaitingReply window keeps
          // doing nothing, unchanged from before this existed.
          onSteer={
            modelRef.current.provider === "Codex"
              ? (text: string) => {
                  const trimmed = text.trim();
                  if (!trimmed || !sessionId) return;
                  void fetch(`/sessions/${sessionId}/steer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: trimmed, sender_name: getUserDisplayName() }),
                  });
                }
              : undefined
          }
          onOpenSettings={() => openSettings("provider")}
          onModelsChange={(models) => {
            // Cosmetic only, matching the old page: switching the agent
            // mid-chat isn't implemented (the session's model is fixed at
            // creation), so this just updates the label/icon shown above
            // future agent replies -- always the first selected model, since
            // that's the one the session actually runs on.
            modelRef.current = models[0];
            saveLastModel(models[0].value);
          }}
        />
        </div>
      </div>
    </div>
  );
}

// One real shared component now, not three separately-sized copies of the same
// idea -- confirmed directly as a real bug (reported: "our time at our message
// is not the same size... I thought it was the same component"), human/command
// rows were still on the old text-xs span, only the agent row's own had been
// resized to text-2xs. showDisclaimer is the one real difference between them:
// only an actual AI reply carries "AI can make mistakes" -- a human's own
// message or Alongside's own /share reply doesn't need reviewing the same way.
function MessageTime({ time, showDisclaimer }: { time: string; showDisclaimer?: boolean }) {
  const { t } = useTranslation();
  return (
    <p className="px-1 text-2xs text-muted-foreground">
      {time}
      {showDisclaimer && <span className="opacity-50"> {t("chat.disclaimer")}</span>}
    </p>
  );
}

function ChatRowView({
  row,
  isPendingEdit,
  onCancelEdit,
  onRetry,
  onRetryFailedMessage,
  onResendMessage,
  onEditMessage,
  onSwitchBranch,
  onOpenFile,
  toolGroup,
  liveWorking,
}: {
  row: ChatRow;
  isPendingEdit: boolean;
  onCancelEdit: () => void;
  onRetry: () => void;
  onRetryFailedMessage: (row: Extract<ChatRow, { kind: "human" }>) => void;
  onResendMessage: (row: Extract<ChatRow, { kind: "human" }>) => void;
  onEditMessage: (row: Extract<ChatRow, { kind: "human" }>) => void;
  onSwitchBranch: (group: string, index: number) => void;
  onOpenFile: (path: string) => void;
  // Set only on the first row of a run of consecutive same-kind Write/Edit
  // tool rows (computeToolGroups, below) -- the full run this one row
  // stands in for, rendered as a single FileDiffGroup card instead of N
  // separate rows. Every other row in that run isn't rendered at all
  // (rows.map's own grouping pass, further down).
  toolGroup?: Extract<ChatRow, { kind: "tool" }>[];
  // Only ever set on the turn's own first agent row, while that turn is
  // still genuinely in progress (rows.map's own comment, above, has the
  // full reasoning) -- rendered in the exact slot row.durationLabel's own
  // settled disclosure will occupy once the turn finishes, so nothing
  // visibly jumps between the live and settled states.
  liveWorking?: { label: string; detailText?: string };
}) {
  const { t } = useTranslation();
  // Gates the actions row + disclaimer (agent branch, further down) until
  // the reply's own StreamingText reveal genuinely finishes -- per explicit
  // request ("copy, rate, re-try... source and time and advise shows before
  // the actual text loads... makes no sense to show the source before the
  // text is even there"). History replay (row.animate false) has nothing to
  // wait for -- there's no reveal happening at all -- so those rows start
  // already visible; only a genuinely live reply (animate true) starts
  // hidden and flips true via StreamingText's own onDone.
  const [actionsVisible, setActionsVisible] = useState(() => row.kind === "agent" && !row.animate);
  // Gates the whole agent row (icon, label, reply text) until the provider
  // icon has actually painted -- per explicit request ("the icon of the
  // provider... loads after the text loads, everything should load
  // together"). The label/text render synchronously (no network of their
  // own) while ProviderIcon's <img> is a real, if usually
  // preloadProviderIcons-cached, image load with its own latency -- without
  // this, that's the one part of the row that can still visibly lag a frame
  // or two behind the rest. Starts true (not gated) for a row that isn't an
  // agent reply at all, so this never delays a human/command/marker row.
  // Also starts true for a HISTORICAL agent reply (row.animate false --
  // set at push time from historyReplayedRef.current, this file's own
  // pushRow) -- real bug, confirmed directly ("the cascade effect still
  // happening"): each historical row's own <img> onLoad firing at a
  // slightly different real tick (even from cache, the load event itself
  // is still async) was a *second*, independent source of staggered
  // reveal on top of the per-row t-row-in cascade already fixed --
  // ChatPage's own viewport-based reveal (replay_complete) is what
  // actually gates historical rows visible now, in one synchronized
  // moment, so gating this too on top of it only ever adds delay, never
  // correctness (these icons are effectively always
  // preloadProviderIcons-cached well before that reveal fires anyway).
  const [iconLoaded, setIconLoaded] = useState(() => row.kind !== "agent" || !row.animate);
  if (row.kind === "marker") {
    return <div className="text-center text-xs text-muted-foreground/70"><ErrorText message={row.text} /></div>;
  }

  if (row.kind === "tool") {
    // Real Write/Edit -> FileDiffGroup (issue #288, phase 1, extended per
    // explicit request "we should be using the same component for all"),
    // manual-expand-only per that issue's own explicit direction --
    // everything else keeps the existing generic ToolRow treatment.
    // toolGroup (set only on a group's first row, computeToolGroups below)
    // covers every provider uniformly: Claude/Codex's real content
    // resolves synchronously via buildFileDiffRows; Antigravity's
    // write_to_file (no content in its own tool_use, only the path) has
    // no syncRows, and FileDiffGroup's own ResolvedFile fetches the real
    // file content off disk instead -- same card either way.
    if (toolGroup && (row.name === "Write" || row.name === "Edit")) {
      const card = renderFileDiffGroupCard(toolGroup, onOpenFile);
      if (card) return card;
    }
    return <ToolRow name={row.name} summary={row.summary} input={row.input} />;
  }

  if (row.kind === "permission") {
    // Pending ones move above the compose box (this file's own render,
    // near <ComposeBox>) -- per explicit correction ("that actually should
    // be similar to codex/claude where the action opens at the top of the
    // compose box and be full length of the compose box"), not shown
    // inline as a chat message. A resolved one used to leave its own
    // compact one-line trace here permanently ("Bash: Allowed") -- per
    // explicit follow-up, that's the same clutter every other tool call
    // already folds away: updatePermissionRow (above) already pushes this
    // same trace into liveToolCallLines the moment it resolves, so nothing
    // renders inline for it at all anymore, resolved or pending.
    return null;
  }

  if (row.kind === "human") {
    // Real bug, confirmed directly ("there are two human responses at the
    // right in one of my chats, alongside and me... Me should stay always
    // in the right, other human responses or Ai should stay at the
    // left"): this row used to be unconditionally right-aligned regardless
    // of sender, so a historical message from someone else (or an old chat
    // recorded under a different sender_name before this device's own
    // display name changed) sat on the right same as this device's own
    // messages, both indistinguishable from "me." Only a message that is
    // genuinely this device's own now gets the right-aligned treatment;
    // anyone else reads left, same side as an agent reply.
    const isSelf = row.displayName === getUserDisplayName();
    return (
      <div className={`flex flex-col gap-1 ${isSelf ? "items-end" : "items-start"}`}>
        {/* Header row now matches the agent row's own exact structure below
            (icon + label, always shown) instead of a bubble-inline avatar
            hidden outside multiplayer -- per explicit request ("Human
            messages should follow similar format as the ai messages,
            avatar the same size as the icon of the ai and the name of the
            human either Me or Another person then the message in the
            bottom"). "Me" for this device's own messages -- DefaultAvatar's
            own comment (ui/avatar.tsx) has the matching reasoning for why
            this same isSelf comparison is also what picks the
            persisted-seed color instead of a name hash. Any other name (a
            real multiplayer participant) shows as itself, same as it
            always did. */}
        {/* No px-1 here (unlike the agent row's own header) -- real bug,
            confirmed directly ("the human messages has a gap if at the
            right side that has a gap at the right and if at left has a
            gap at left"): the agent row's own px-1 lines up with its own
            content div's matching px-1 (both plain text, no bubble), but
            this row's bubble below has no outer padding of its own (its
            border is the row's real edge) -- px-1 here left the header
            sitting 4px inset from that same edge instead of flush with it,
            reading as a gap on whichever side the row is aligned to. */}
        <div className="flex items-center gap-1.5">
          {/* size-5 (20px), matching ProviderIcon's own size on the agent
              row below exactly -- both sides of the conversation keep the
              same size mark now. */}
          <span className="size-5 shrink-0 overflow-hidden rounded-full">
            <DefaultAvatar name={row.displayName} />
          </span>
          <span className="text-xs text-muted-foreground">{isSelf ? "Me" : row.displayName}</span>
        </div>
        {/* transition-[max-width]: sm: is a real viewport breakpoint, so
            without this the bubble snapped width instantly at 640px while
            resizing the window -- same fix as AppLayout.tsx's own content
            column. */}
        {/* max-w-[85%] -- per explicit request, 85% of the shared
            PAGE_CONTENT_WIDTH (800px) content column, replacing the old
            two-tier 85%/75% responsive scheme with one flat value. w-fit
            plus ml-auto/mr-auto (isSelf), not just the parent's own
            items-end/items-start -- real bug, confirmed directly via
            screenshot ("the human messages has a gap... at the right...
            at the left"): the header row above (a single-line flex row)
            picked up the parent's cross-axis alignment correctly, but this
            div, itself a flex container wrapping a wrapping text node, was
            rendering at a width the parent's items-end/start didn't
            actually pin to the true edge -- text sat flush left
            regardless of which side the row was meant to align to. w-fit
            forces this box to size to its own content (never wider than
            max-w-[85%]) and the margin push is a plain, unambiguous CSS
            mechanism that doesn't depend on flex cross-axis sizing at all. */}
        <div
          className={`flex w-fit max-w-[85%] items-center gap-2.5 transition-[max-width] duration-200 ${isSelf ? "ml-auto" : "mr-auto"}`}
        >
          {/* text-[13px] leading-relaxed -- matches the agent reply's own text exactly
              (the block below this one's own comment has the same values), was text-sm
              (14px, no leading-relaxed) -- per explicit request, "our own text is quite
              big[,] make that match the size of the texts of the agent". */}
          {/* bg-accent, not bg-sidebar -- per explicit request ("human messages should
              be a bg active and none at ai responses to make easier to read between
              messages"): the same active-row token RailButton's own active state reads
              (sidebar-nav.tsx), so a human message now visually reads as "active"
              exactly the way the sidebar's own active row does, while an agent reply
              stays plain text with no background at all (already true -- the agent
              branch below has never had a bubble). No border in either mode any more
              -- per explicit request ("our messages has a bg color which is expected
              but also got a border, remove that border"): the bg alone is enough to
              read as a distinct bubble, same as every other "active" surface in the
              app (RailButton's own active row has no border of its own either).
              text-foreground -- per explicit request, "should not be straight
              000000 or FFFFFF but match our active style at the sidebar": this is
              RailButton's own active-row text color (sidebar-nav.tsx's own
              className), which now reads the same var(--foreground) token as this
              element does -- both were a matching pair of independently hardcoded
              hex values before the app-wide Synara color pass (index.css's own
              --foreground comment has the full history), so this is now a literal
              shared token rather than two colors that happened to match. */}
          <div
            className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground ${
              row.failed ? "border border-destructive/40" : ""
            } bg-accent`}
          >
            {row.text}
          </div>
        </div>
        {row.failed ? (
          // Real bug, confirmed directly ("my messaged should have gone to
          // the chat and with an error underneath so i can click retry") --
          // see sendMessage's own comment (above) for why this row exists
          // at all instead of the window.alert() it replaced.
          <div className="flex items-center gap-2 px-1">
            <span className="text-2xs text-destructive"><ErrorText message={row.failed.errorText} /></span>
            <button
              type="button"
              onClick={() => onRetryFailedMessage(row)}
              className="text-2xs font-medium text-muted-foreground underline hover:text-foreground"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          // justify-between -- per explicit request ("the icons... should
          // come before the time of the message, the time of the message
          // stays at the right side"): the icon/switcher group now sits as
          // its own leading cluster, MessageTime pinned to the far right
          // instead of immediately following it on the left.
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {/* "< i/N >" -- per explicit request ("if we replace the
                  text, we should have a new <> so we can go through the
                  new text and old text with the reply... similar to
                  claude, codex does"). Only once a message actually has
                  more than one branch (row.branch is set at all once it's
                  ever been edited, but total stays 1 until a second branch
                  genuinely exists) -- most messages never show this. */}
              {row.branch && row.branch.total > 1 && (
                <div className="flex items-center gap-0.5 text-2xs text-muted-foreground">
                  <button
                    type="button"
                    disabled={row.branch.index <= 0}
                    onClick={() => onSwitchBranch(row.branch!.group, row.branch!.index - 1)}
                    className="flex size-4 items-center justify-center rounded transition-colors hover:bg-hover-2/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeftIcon className="size-2.5" />
                  </button>
                  <span className="tabular-nums">
                    {row.branch.index + 1}/{row.branch.total}
                  </span>
                  <button
                    type="button"
                    disabled={row.branch.index >= row.branch.total - 1}
                    onClick={() => onSwitchBranch(row.branch!.group, row.branch!.index + 1)}
                    className="flex size-4 items-center justify-center rounded transition-colors hover:bg-hover-2/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRightIcon className="size-2.5" />
                  </button>
                </div>
              )}
              {/* Resend/Edit -- per explicit request ("we should have the
                  option below our chat to resend the chat or edit it"),
                  then revised to icon buttons ("resend should be a circled
                  arrow, edit a pencil and cancel an X"). size-5/size-3 --
                  per explicit follow-up ("what size are the tools at our
                  messages... should they be a bit smaller?"), shrunk from
                  size-6/size-3.5 to match, along with AgentMessageActions'
                  own iconButtonClass (below) shrinking the same amount for
                  consistency between the two rows. While this exact row is
                  the one being edited (isPendingEdit), the pair swaps for
                  a single Cancel -- per further explicit request ("keep
                  the old messages in there but as inactive and have a
                  cancel button where edit was... instead of wiping the
                  whole thing"): nothing was deleted yet at this point
                  (editMessage only sets state + fills the compose box), so
                  Cancel just undoes that, real history untouched either
                  way. */}
              {isPendingEdit ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="flex size-5 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-transform duration-100 ease-out hover:bg-hover-2/50 hover:text-foreground active:scale-[0.97]"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.cancelEdit")}</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onResendMessage(row)}
                        className="flex size-5 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-transform duration-100 ease-out hover:bg-hover-2/50 hover:text-foreground active:scale-[0.97]"
                      >
                        <RotateCcwIcon className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("chat.resend")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onEditMessage(row)}
                        className="flex size-5 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-transform duration-100 ease-out hover:bg-hover-2/50 hover:text-foreground active:scale-[0.97]"
                      >
                        <EditIcon className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("chat.edit")}</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
            <MessageTime time={row.time} />
          </div>
        )}
      </div>
    );
  }

  if (row.kind === "command") {
    // /share's own reply (and any future slash-command response) -- Alongside's own
    // mark, not a provider's, since this came from the app itself, not whichever AI
    // is running the chat. Same row shape as an agent message otherwise (actions,
    // disclaimer, timestamp) minus the model label, since there isn't one.
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5 px-1">
          {/* text-black dark:text-white -- AlongsideLogo inherits color
              (fill-current) rather than carrying its own dark/light opinion
              (alongside-logo.tsx's own comment has the full reasoning), so
              this message-row usage sets that theme-adaptive look itself. */}
          <AlongsideLogo className="size-4 text-black dark:text-white" />
          {/* text-xs, no font-medium -- matches the "human" row's own sender-name
              label (row.displayName above) exactly: both are identity labels above
              a message, and this one read larger/bolder than its symmetric
              counterpart for no reason tied to anything on screen. */}
          <span className="text-xs text-muted-foreground">Alongside</span>
        </div>
        {/* max-w-[95%], matching the agent row's own reply width below (not
            the human bubble's 80%) -- this is Alongside's own /share reply,
            not a human message. */}
        <div className="max-w-[95%] px-1 text-sm whitespace-pre-wrap transition-[max-width] duration-200"><ErrorText message={row.text} /></div>
        <MessageTime time={row.time} />
      </div>
    );
  }

  // Agent message -- the real provider's own mark (ProviderIcon, same component every
  // other model icon in this app renders through), not AlongsideLogo, per explicit
  // request: that mark is for "command" rows above now, not real AI replies.
  return (
    <div className={`flex flex-col items-start gap-1 ${iconLoaded ? "" : "invisible"}`}>
      {/* Unified Waiting/Thinking/Working/Worked disclosure (alongsidedotrun/
          private#53) -- per explicit request ("that should be in the same
          area where Waiting was... when opening the dropdown, thinking and
          worked can be seen"), and above the model name row, not below
          (explicit follow-up). Settled (row.durationLabel, once the matching
          "result" event has landed) takes priority; liveWorking (this row's
          own comment has the full reasoning) renders in that exact same slot
          while the turn's still genuinely in progress, so nothing visibly
          jumps between the two. Neither yet -- the brief gap between this
          row's own text arriving and either landing -- shows nothing here,
          same trade-off Synara's own settled-vs-live split has. */}
      {/* mb-2 on the wrapper, not the outer flex column's own gap-1 --
          real bug, confirmed directly via screenshot ("Increase the
          bottom space/margin/space between worked and other states to
          the message of the AI"): gap-1 applies uniformly to every child
          in this column, so widening it would have also pushed the model-
          name row away from the reply text below it, not just this one
          gap. Only rendered when the disclosure itself renders something
          -- an empty wrapper would still add its own margin with nothing
          inside to justify it. */}
      {(row.durationLabel || liveWorking) && (
        <div className="mb-2">
          {row.durationLabel ? (
            <TurnWorkDisclosure label={row.durationLabel} detailText={row.reasoningText} toolLines={row.toolCallLines} />
          ) : (
            liveWorking && <TurnWorkDisclosure label={liveWorking.label} detailText={liveWorking.detailText} live />
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5 px-1">
        {/* size-5 (20px), not size-6 -- per explicit request ("make sure
            that both icons are size 5 to match the size of the font at
            the messages"), matching the row's own text-xs label next to
            it instead of running larger than it. */}
        <ProviderIcon model={row.model} className="size-5" onLoad={() => setIconLoaded(true)} />
        {/* text-xs, no font-medium -- same fix as the "command" row's own
            "Alongside" label just above: matches the "human" row's sender-name
            label exactly, its real symmetric counterpart. */}
        <span className="text-xs text-muted-foreground">{row.modelLabel}</span>
      </div>
      {/* text-[13px] leading-relaxed -- matches the reference component's own reply
          text size exactly (was text-sm/14px with Tailwind's default leading), per
          explicit request. No more whitespace-pre-wrap -- streamdown (streaming-
          text.tsx) now renders real markdown blocks with their own real paragraph/
          line-break semantics, not raw preserved text; pre-wrap on top of that would
          double up on newline handling that streamdown already does correctly. */}
      {/* max-w-[95%] -- per explicit request, matching Claude/Codex's own
          reply width (a real reply column, not a narrow bubble the way a
          human message reads as one). Was 85%/75%, the same two-tier scheme
          the human bubble used -- the two should read differently now, an
          AI reply spans nearly the full column while a human message stays
          visually distinct as a bubble. */}
      <div className="max-w-[95%] px-1 text-[13px] leading-relaxed transition-[max-width] duration-200">
        <StreamingText text={row.text} animate={row.animate} onDone={() => setActionsVisible(true)} />
      </div>
      {/* Sources now lives inside AgentMessageActions' own row, after effort --
          per explicit request (was its own separate block below the row before).
          Following this group into view as the Source drawer expands (or as
          the reply streams in) is the chat log's own chatContentRef
          ResizeObserver's job now (this file, top level) -- a dedicated
          per-frame scroll loop used to live here too, removed once that
          became genuinely redundant (its own comment, AgentMessageActions,
          has the full reasoning for why keeping both actually caused a
          regression: two independent scroll writers disagreeing on the
          target position every frame read as a snap, not a missing follow). */}
      {/* Not mounted at all until actionsVisible (above) -- per explicit
          request, showing Copy/Retry/Source/the disclaimer before the reply
          text has even finished appearing made no sense (a Source drawer
          for a reply that isn't fully there yet, chief among them). t-row-in
          (index.css's own row-mount fade, already used for every row's own
          mount) reused here for this group's own first appearance, same
          motion, not a separate animation to maintain. */}
      {actionsVisible && (
        <div className="t-row-in flex w-full flex-col items-start gap-1">
          <AgentMessageActions text={row.text} onRetry={onRetry} effort={row.effort} />
          <MessageTime time={row.time} showDisclaimer />
        </div>
      )}
    </div>
  );
}

// Expandable, collapsed by default -- matching dray's own ToolCall.tsx (a full
// diff/code-view render isn't built here, that's a much larger surface than this
// pass covers; this is the summary-row half of it: the tool's real name, its own
// input's most relevant field inline, and the full raw input on expand).
// Real diff rows (issue #288, phase 1) for a Write/Edit tool_use, built
// from whatever real before/after text each provider's own tool_use
// actually carries -- Claude's Write (input.content, no old text) and
// Edit (input.old_string/new_string) are both handled; Codex's own Edit
// (input.diff, a pre-rendered diff string, not structured old/new text --
// this session's own earlier fileChange->Edit mapping, codex.rs) has no
// real old/new pair to line-diff here, so it falls back to the generic
// ToolRow instead of mis-rendering it as a FileDiff with no real added/
// removed counts.
function buildFileDiffRows(name: string, input: unknown): DiffRow[] | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  let oldText: string | null = null;
  let newText: string | null = null;
  if (name === "Write" && typeof record.content === "string") {
    oldText = "";
    newText = record.content;
  } else if (name === "Edit" && typeof record.old_string === "string" && typeof record.new_string === "string") {
    oldText = record.old_string;
    newText = record.new_string;
  }
  if (oldText === null || newText === null) return null;
  return diffToRows(oldText, newText);
}

// Shared by ChatRowView's own "tool" branch (a group not immediately
// followed by the model's own text reply) and the render loop's own
// deferred-group handling further up (a group immediately followed by the
// reply, moved to render after it instead -- see that loop's own comment) --
// one real FileDiffGroup-building path, not two copies that could drift.
function renderFileDiffGroupCard(
  toolGroup: Extract<ChatRow, { kind: "tool" }>[],
  onOpenFile: (path: string) => void
): ReactNode {
  const name = toolGroup[0].name;
  const files = toolGroup
    .map((r) => {
      const path = summarizeToolInput(r.input);
      if (!path) return null;
      return { name: path.split("/").filter(Boolean).pop() ?? path, path, syncRows: buildFileDiffRows(r.name, r.input) };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
  if (files.length === 0) return null;
  return <FileDiffGroup kind={name === "Write" ? "New" : "Edited"} files={files} onExpandFile={onOpenFile} />;
}

function ToolRow({ name, summary, input }: { name: string; summary: string | null; input: unknown }) {
  const [open, setOpen] = useState(false);
  const hasInput = input !== undefined && input !== null && Object.keys(input as object).length > 0;
  return (
    <div className="px-1">
      <button
        type="button"
        disabled={!hasInput}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-muted-foreground italic disabled:cursor-default"
      >
        <span>
          {name}
          {summary ? `: ${summary}` : ""}
        </span>
        {hasInput && (
          <ChevronRightIcon className={`size-3 shrink-0 not-italic transition-transform ${open ? "rotate-90" : ""}`} />
        )}
      </button>
      {open && (
        <pre className="mt-1 max-w-full overflow-x-auto rounded-lg bg-muted px-2.5 py-2 text-[11px] whitespace-pre-wrap text-muted-foreground">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Collapsed by default -- matching dray's own Reasoning.tsx: this is scrollback the
// reader rarely needs, so showing it open by default would be a permanent block of
// dimmed text ahead of every real reply.
// Real links only, pulled out of the reply's own markdown -- Codex's own
// citations and Claude's own WebSearch results both write these directly into
// the reply text (confirmed directly against a real session log: a Codex reply
// cited "[Official OpenAI documentation](https://help.openai.com/...)"), so
// this just recovers what's already there rather than tracking anything new
// server-side. Deduped by href -- the same source cited twice in one reply
// only lists once.
function extractSources(text: string): { label: string; href: string }[] {
  // Map keyed by href, not a seen-Set + first-match-wins array -- the same
  // href can be cited more than once with different anchor text (a generic
  // "here" earlier in the reply, the real page title later), and keeping
  // whichever occurrence came first showed "here" as the source's title even
  // when the same reply also cited it correctly elsewhere -- confirmed
  // directly ("the source shows here as the title... which is not true").
  // Keeps the longest label seen for a given href instead, since a generic
  // inline word like "here" is reliably shorter than a real page title.
  const byHref = new Map<string, { label: string; href: string }>();
  for (const match of text.matchAll(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g)) {
    const [, rawLabel, href] = match;
    const label = rawLabel.trim();
    const existing = byHref.get(href);
    if (!existing || label.length > existing.label.length) {
      byHref.set(href, { label, href });
    }
  }
  return Array.from(byHref.values());
}

// Real favicon of the actual cited domain, not a generic glyph -- Google's own
// public favicon service (no API key, no account, widely used for exactly this)
// fetches whatever icon that real site actually serves; there's no fabrication
// here, just not hosting/scraping favicons ourselves. Falls back to the globe
// glyph (ResearchIcon) on a load error (a domain with no favicon, or the
// service itself failing), via the <img>'s own onError below, rather than
// leaving a broken-image icon on screen.
function faviconUrl(hostname: string) {
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(hostname)}`;
}

// A vertical line connecting each source's own favicon down to the next, per
// explicit request (matches the pasted reference screenshot). Statically
// positioned at the icon column's own real X (drawer's own p-1 + each row's
// own px-2 + half the 14px favicon = 19px), spanning from the first icon's
// center to near the last one's -- not individually measured per icon, same
// simple approach the reference screenshot itself uses. Scrolls together with
// the rows since it's absolutely positioned inside that same scrollable
// container, not the page.
function SourceLine() {
  // -z-10: absolutely positioned elements paint above static in-flow content
  // by default regardless of DOM order, which put this in front of each
  // row's own favicon instead of behind it.
  return <span aria-hidden className="absolute -z-10 w-px bg-border" style={{ left: 19, top: 19, bottom: 19 }} />;
}

function SourceLink({ source }: { source: { label: string; href: string } }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  let hostname = source.href;
  try {
    hostname = new URL(source.href).hostname.replace(/^www\./, "");
  } catch {
    // Leave hostname as the raw href -- not a real absolute URL.
  }
  return (
    // items-start (not baseline/center): the favicon anchors to the text
    // block's own first line, which matters once that block wraps. Title and
    // link are one real inline text run now, not two separate flex items --
    // per explicit request ("always suit... in the same row" regardless of
    // length): plain text flow is what actually guarantees that robustly --
    // the link stays glued to wherever the title's own text ends and only the
    // whole unit wraps together if it doesn't fit, with no baseline-alignment
    // quirks a flex row has once its own title item spans multiple lines. No
    // truncate on the title -- the full page title still shows.
    <a
      href={source.href}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-hover-2/50"
    >
      {faviconFailed ? (
        <ResearchIcon className="mt-0.5 size-3.5 shrink-0" />
      ) : (
        <img
          src={faviconUrl(hostname)}
          alt=""
          className="mt-0.5 size-3.5 shrink-0 rounded-[3px]"
          onError={() => setFaviconFailed(true)}
        />
      )}
      <span className="min-w-0 text-xs text-foreground">
        {source.label || hostname} <span className="font-mono text-2xs text-muted-foreground opacity-50">{hostname}</span>
      </span>
    </a>
  );
}

// Unified Waiting/Thinking/Working/Worked control (alongsidedotrun/private#53) --
// replaces the old separate always-visible ThinkingState shimmer plus its own
// distinct "reasoning"-row Thought disclosure with one control, per explicit
// request ("that should be in the same area where Waiting was... when opening the
// dropdown, thinking and worked can be seen"). Same live component both while a
// turn is in flight (ChatPage.tsx's own waitingPhase-driven indicator, label
// shimmers) and once it settles (the agent row's own header, label reads "Worked
// for Xs"). detailText is Claude's real thinking-block content when there is one;
// Codex/Antigravity (no thinking block at all) and a Claude turn with none this
// time still get the same expand affordance per explicit request ("be expandable
// as well"), just with an honest "nothing to show" line rather than fabricated
// content.
function TurnWorkDisclosure({
  label,
  detailText,
  toolLines,
  live,
}: {
  label: string;
  detailText?: string;
  // Real tool calls this turn made (ChatRow's own toolCallLines comment has
  // the full reasoning) -- per explicit request ("that should have an arrow
  // to open the drawer so we can see the hidden commands"). Never passed by
  // the LIVE call site (ChatPage.tsx's own waitingPhase-driven indicator,
  // below) -- these stay genuinely hidden while "Working", only surfacing
  // once the turn settles and this same expand arrow already exists.
  toolLines?: { label: string; detail?: string }[];
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trimmedDetail = detailText?.trim();
  const hasToolLines = !!toolLines && toolLines.length > 0;
  // No expand affordance at all when there's nothing real to show -- per
  // explicit follow-up ("hide the expand arrow entirely for these replies"):
  // Codex/Antigravity never emit a thinking block at all, so every one of
  // their replies used to offer a chevron that only ever expanded to an
  // honest but useless "No additional detail for this reply." placeholder.
  // Plain, non-interactive label instead, exactly like Claude's own replies
  // that genuinely didn't use extended thinking this turn.
  if (!trimmedDetail && !hasToolLines) {
    const labelEl = live ? <ThinkingState text={label} /> : <span className="text-xs text-muted-foreground">{label}</span>;
    return <div className="px-1">{labelEl}</div>;
  }
  // ThinkingReasoning (per explicit request, adopted from
  // https://www.aicss.dev/r/thinking-reasoning.json -- that file's own
  // comment has the full adaptation reasoning) owns the reveal animation
  // and collapsed/expanded rendering; this app's own "Worked for Ns"
  // label (not the reference's own "Thought for Ns") passes straight
  // through unchanged, per explicit decision.
  return (
    <div className="px-1">
      <ThinkingReasoning
        label={label}
        text={trimmedDetail ?? ""}
        toolLines={toolLines}
        live={!!live}
        open={open}
        onToggleOpen={() => {
          // chat-scroll-suppress.ts's own comment has the full reasoning.
          suppressAutoScroll();
          setOpen((prev) => !prev);
        }}
      />
    </div>
  );
}

// Adapted from the pasted reference component -- simplified down to this app's
// real question, not the reference's own generic multi-question quiz (odometer
// step counter, radio/checkbox question stack): the CLI only ever asks one real
// question at a time here ("may this tool call run?"), so none of that stacking
// machinery applies. "Other: type an answer" maps to Claude's own real "tell
// Claude what to do differently" option from an interactive terminal's own
// permission prompt -- a deny with a custom reason, not a fourth wire-level
// behavior (the real control protocol only has allow/deny, this file's own
// claude_direct.rs comment has the confirmed shape). Restyled as a numbered
// vertical list (was three horizontal buttons) with a persisted "always
// allow" choice, per explicit request against a real reference screenshot of
// Claude Code's own terminal approval UI -- this reverses the "No 'always
// allow'/persisted rule option... deliberately not built here" scope note
// that used to sit here; that decision was explicit at the time, and this
// request explicitly supersedes it.
function PermissionCard({
  sessionId,
  requestId,
  toolName,
  input,
  status,
  hasProject,
  onStopTurn,
}: {
  sessionId: string | undefined;
  requestId: string;
  toolName: string;
  input: unknown;
  status: "pending" | "allow" | "deny" | "cancelled" | "timed_out";
  hasProject: boolean;
  onStopTurn: () => void;
}) {
  const { t } = useTranslation();
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const otherInputRef = useRef<HTMLInputElement>(null);

  async function answer(decision: "allow" | "deny", message?: string, alwaysAllow?: { toolName: string; pattern: string }) {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/sessions/${sessionId}/permissions/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          message,
          always_allow: alwaysAllow ? true : undefined,
          tool_name: alwaysAllow?.toolName,
          pattern: alwaysAllow?.pattern,
        }),
      });
      // No local status update here -- the backend's own permission_resolved
      // event (broadcast right after it actually writes the control_response
      // back to the CLI) is what patches this row's status, same source of
      // truth every other tab/reconnect sees.
    } finally {
      setSubmitting(false);
    }
  }

  // The command/file text (summarizeToolInput's own TOOL_SUMMARY_FIELDS
  // lookup -- same fields ToolRow already reads for a completed tool call)
  // rendered as its own block below the title, not squeezed onto the same
  // row -- per explicit correction against the pasted reference component's
  // own "command" variant (ApprovalCard.tsx: a header row, then a distinct
  // .cmdBlock, then an .actions row, three real rows, not one). Computed
  // unconditionally (used by the keyboard effect below too, which itself has
  // to be unconditional per React's rules of hooks) even though it's only
  // ever rendered once status is actually "pending".
  const commandText = summarizeToolInput(input);

  // Keyboard: 1/2/3 pick the matching row, 4 focuses the always-visible
  // "Other" text field (below) instead of submitting anything itself --
  // per explicit follow-up ("the other should be 4 and other so we can
  // press 4 and we can type at it"), Escape denies. Gated inside the
  // handler itself so a resolved card (which returns early below, before
  // ever rendering these rows) never double-handles a keystroke, and
  // skipped entirely while focus is already inside an input/textarea
  // (typing "1"/"2"/etc into the Other field shouldn't trigger these).
  useEffect(() => {
    if (status !== "pending") return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") {
        event.preventDefault();
        void answer("deny");
      } else if (event.key === "1") {
        event.preventDefault();
        void answer("allow");
      } else if (event.key === "2" && commandText) {
        event.preventDefault();
        void answer("allow", undefined, { toolName, pattern: commandText });
      } else if ((event.key === "2" && !commandText) || (event.key === "3" && commandText)) {
        event.preventDefault();
        void answer("deny");
      } else if (event.key === "4") {
        event.preventDefault();
        otherInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, submitting, commandText]);

  if (status !== "pending") {
    const label =
      status === "allow"
        ? t("chat.perm.allowed")
        : status === "cancelled"
          ? t("chat.perm.withdrawnLong")
          : status === "timed_out"
            ? t("chat.perm.deniedNoResponse")
            : t("chat.perm.denied");
    return (
      <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        {status === "allow" ? <CheckIcon className="size-3.5 shrink-0" /> : <XIcon className="size-3.5 shrink-0" />}
        <span>
          {toolName}: {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-2xl border border-border bg-sidebar p-3">
      {/* No icon beside the title any more -- per explicit follow-up
          ("we should have no icons there at the title"). */}
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{t("chat.perm.allowToRun", { tool: toolName })}</p>
        {/* Per explicit follow-up ("is missing the x at the right top to
            cancel it and fully stop the command") -- denies this specific
            permission (the same real endpoint Deny already calls) and
            stops the whole turn (stopTurn, same real action the compose
            box's own Stop button already triggers), not just this one
            question. */}
        <button
          type="button"
          aria-label={t("chat.perm.cancelAndStop")}
          disabled={submitting}
          onClick={() => {
            void answer("deny");
            onStopTurn();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2/50 hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      {commandText && (
        <pre className="max-w-full overflow-x-auto rounded-lg bg-muted px-2.5 py-2 text-[11px] whitespace-pre-wrap text-foreground">
          {commandText}
        </pre>
      )}
      {/* Vertical numbered list, not horizontal buttons -- per explicit
          correction against a real reference screenshot of Claude Code's
          own terminal approval UI. Row 2 (always allow) only renders when
          there's real command/file text to persist (commandText) -- an
          empty pattern would be a rule that matches nothing meaningful.
          "Other" is always numbered 4 (not shifted up when row 2 is
          absent) and is a real always-visible text field, not a button
          that reveals one -- per explicit follow-up correction. */}
      <div className="flex flex-col gap-1">
        <PermissionOptionRow number={1} label={t("common.yes")} onClick={() => void answer("allow")} disabled={submitting} />
        {commandText && (
          <PermissionOptionRow
            number={2}
            label={
              <>
                <Trans
                  i18nKey={hasProject ? "chat.perm.alwaysAllowProject" : "chat.perm.alwaysAllowChat"}
                  values={{ command: commandText }}
                  components={[<span className="font-mono" key="0" />]}
                />
              </>
            }
            onClick={() => void answer("allow", undefined, { toolName, pattern: commandText })}
            disabled={submitting}
          />
        )}
        <PermissionOptionRow number={commandText ? 3 : 2} label={t("common.no")} onClick={() => void answer("deny")} disabled={submitting} />
        <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
          <span className="flex size-4 shrink-0 items-center justify-center rounded bg-hover-2/50 text-[10px] font-semibold text-muted-foreground">
            4
          </span>
          <input
            ref={otherInputRef}
            value={otherText}
            disabled={submitting}
            onChange={(event) => setOtherText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && otherText.trim()) void answer("deny", otherText.trim());
            }}
            placeholder={t("chat.perm.other")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <p className="px-2.5 text-2xs text-muted-foreground">{t("chat.perm.escToCancel")}</p>
    </div>
  );
}

// One row of PermissionCard's own numbered list -- a leading number badge
// (also the real keyboard shortcut, PermissionCard's own keydown effect)
// plus the choice's label, matching the reference screenshot's row shape.
function PermissionOptionRow({
  number,
  label,
  onClick,
  disabled,
}: {
  number: number;
  label: ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover-2/50 disabled:opacity-50"
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded bg-hover-2/50 text-[10px] font-semibold text-muted-foreground">
        {number}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function AgentMessageActions({
  text,
  onRetry,
  effort,
}: {
  text: string;
  onRetry: () => void;
  effort: EffortLevel;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sources = useRef(extractSources(text)).current;
  const sourcesPanelRef = useRef<HTMLDivElement>(null);
  const sourcesButtonRef = useRef<HTMLButtonElement>(null);
  // Real gap, confirmed directly ("I have to scroll down to see the drawer") --
  // opening the drawer grows this row in place, but the chat log's own scroll
  // position doesn't follow that growth on its own, so a drawer opened near the
  // bottom of the viewport renders mostly (or entirely) off-screen.
  //
  // Used to be a dedicated per-frame rAF loop here (this file's own git
  // history), calling groupRef.scrollIntoView every frame for the drawer's
  // own 200ms expand transition. Removed -- confirmed directly as the actual
  // cause of a real regression ("when I click to expand the source, that's
  // snapping down"): ChatPage's own chatContentRef ResizeObserver (added
  // later, for streaming replies) now also fires scrollToBottomIfNear on
  // this exact same grid-row growth, since it's a real content-height change
  // like any other. Two independent per-frame scroll writers -- this one's
  // own scrollIntoView({block:"end"}) and the observer's plain
  // scrollTop = scrollHeight -- disagreeing on the exact target position
  // every frame is what actually read as a snap, not a genuinely missing
  // follow. The ResizeObserver alone already covers this drawer the same
  // way it covers a streaming reply's own growing height, so this dedicated
  // loop was purely redundant once that existed, not still doing anything
  // the general mechanism doesn't.
  // Left edge measured off the Source button's own real position (its
  // offsetLeft within this row), not ml-auto -- per explicit request, the
  // drawer starts at the button's own icon, not wherever a fixed-width box
  // happens to land. Plain Tailwind can't express "align to an arbitrary
  // earlier sibling's position" without either this real measurement or
  // absolute positioning (ruled out -- this is a drawer, not a popover).
  const [sourcesOffsetPx, setSourcesOffsetPx] = useState(0);
  useEffect(() => {
    if (sourcesOpen && sourcesButtonRef.current) setSourcesOffsetPx(sourcesButtonRef.current.offsetLeft);
  }, [sourcesOpen]);

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  }

  // Browser built-in TTS (Web Speech API) -- not any AI voice, just
  // whatever voice the OS/browser ships with.
  function toggleReadAloud() {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(utterance);
  }

  // hover:bg-hover-2/50, not the generic ghost-button hover:bg-muted --
  // matches this app's own real hover/active convention (sidebar-nav.tsx's
  // RailButton, compose-box.tsx's Manual/Plan/Auto trigger), which is built
  // on this app's own hover-2/ink tokens rather than shadcn's default muted
  // ones. Active also gets that same background now, not just a text-color
  // change -- RailButton's own active state pairs a background with the
  // text-color change (bg-accent + darker text), so a
  // toggled rating/copied/speaking state here carries the same pairing
  // rather than reading as a fainter version of hover.
  // size-5, not size-6 -- per explicit request ("what size are the tools
  // at our messages... should they be a bit smaller?"), shrunk to match
  // the human row's own Resend/Edit/Cancel buttons (ChatRowView's own
  // comment on those has the matching note).
  const iconButtonClass = (active: boolean) =>
    `flex size-5 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-transform duration-100 ease-out hover:bg-hover-2/50 hover:text-foreground active:scale-[0.97] ${active ? "bg-hover-2/50 text-foreground" : ""}`;

  return (
    // Outer flex-col: the sources panel (below) is a real block sibling under
    // the button row now, not an absolutely-positioned overlay -- per explicit
    // request ("should expand like a drawer not a popover"), so opening it
    // pushes MessageTime (this component's own sibling, rendered by the
    // caller) down instead of floating over it. w-full -- confirmed directly
    // as the actual cause of a real title/link still wrapping onto two lines
    // despite fitting easily: this div's own parent is a flex-col with
    // items-start (not stretch), so with no width of its own this shrank to
    // its narrowest child (the icon button row, ~250px) instead of the page's
    // real content width -- the drawer's own max-w-[85%] below was computing
    // against that narrow box, not the reply text's actual column width.
    <div className="flex w-full flex-col gap-1.5">
      {/* Tooltip/TooltipContent, not the native title attribute (what these
          used to carry) -- title falls back to the browser/OS's own default
          tooltip styling, not this app's, same fix already applied to the
          sidebar rail's own toggle button (sidebar.tsx). */}
      {/* relative: makes this row the Source button's own offsetParent, so
          sourcesButtonRef.current.offsetLeft (above) measures the button's
          real position within *this* row, not relative to some unrelated
          positioned ancestor further up the page. */}
      <div className="relative flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={copy} className={iconButtonClass(copied)}>
            <CopyIcon className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("common.copy")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setRating((prev) => (prev === "up" ? null : "up"))}
            className={iconButtonClass(rating === "up")}
          >
            <ThumbsUpIcon className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("chat.goodResponse")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setRating((prev) => (prev === "down" ? null : "down"))}
            className={iconButtonClass(rating === "down")}
          >
            <ThumbsDownIcon className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("chat.badResponse")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onRetry} className={iconButtonClass(false)}>
            <RotateCcwIcon className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("common.retry")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={toggleReadAloud} className={iconButtonClass(speaking)}>
            <Volume2Icon className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("chat.readAloud")}</TooltipContent>
      </Tooltip>
      {/* Plain text, not the old EffortDial graph-plus-hover-tooltip -- per
          explicit request ("lets just write the effort there instead of
          having a graph that we can only see when we hover bc is not
          clear"): the graph on its own read as decorative until you
          hovered it, unlike every other real value on this row. */}
      <span className="px-1 text-xs text-muted-foreground">{effortLabel(effort)} effort</span>
      {/* Sources -- same row as every other action, after effort, per explicit
          request (was its own separate block below the row before). A real
          dropdown trigger now, not a hover tooltip -- per explicit request:
          this button already carries its own real text label ("Source"/count),
          so it doesn't need a Tooltip to explain itself the way the icon-only
          actions above do; the chevron (rotates open/closed) is what actually
          signals "this expands a panel" instead. Nothing rendered at all when
          the reply cited nothing (sources.length === 0). */}
      {sources.length > 0 && (
        <button
          ref={sourcesButtonRef}
          onClick={() => setSourcesOpen((prev) => !prev)}
          aria-expanded={sourcesOpen}
          className={`${iconButtonClass(sourcesOpen)} w-auto gap-1 px-1.5`}
        >
          <ResearchIcon className="size-3 shrink-0" />
          <span className="text-2xs">{t("chat.sources", { count: sources.length })}</span>
          <ChevronDownIcon className={`size-3 shrink-0 transition-transform ${sourcesOpen ? "rotate-180" : ""}`} />
        </button>
      )}
      </div>
      {sources.length > 0 && (
        // Always mounted (gated on sources.length, not sourcesOpen) so the
        // open/close is a real height transition instead of an instant
        // mount/unmount snap -- confirmed directly as a gap ("moves slowly
        // when expanding as a transition and not snap quickly"). grid-rows
        // 0fr/1fr (not max-height) is the trick that can animate to an
        // unknown/content-driven height at all -- max-height would need a
        // guessed cap, and this drawer's real height already varies with
        // however many sources a given reply cited.
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${sourcesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            {/* marginLeft measured to the Source button's own real position
                (sourcesOffsetPx, above), not ml-auto -- per explicit request, the
                drawer starts at the button's own web icon, not the row's right
                edge. w-fit, not w-full/max-w-[85%] -- per explicit request
                ("flexible to the content... bigger name one controls the width"),
                sized to whichever source's own title+link is widest, capped at
                max-w-full so a genuinely long one still wraps within the row
                instead of overflowing it. No border/bg -- per explicit request,
                blends into the page instead of reading as a separate card.
                max-h-[220px] + overflow-y-auto, not a "+N more" toggle -- per
                explicit request ("not the option to see more but to scroll down to
                see the others"), caps the visible list to roughly 5 short rows and
                scrolls for the rest instead of hiding them behind a click. relative
                (below) anchors the connecting line (SourceLine, its own comment has
                the full reasoning) to this same list. */}
            <div
              ref={sourcesPanelRef}
              style={{ marginLeft: sourcesOffsetPx }}
              className="relative flex max-h-[220px] w-fit max-w-full flex-col gap-0.5 overflow-y-auto p-1"
            >
              {sources.length > 1 && <SourceLine />}
              {sources.map((source) => (
                <SourceLink key={source.href} source={source} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
