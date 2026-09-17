import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PROVIDER_DISPLAY, ProviderIcon, QUICK_CHAT_MODELS, modelDisplayName } from "@/lib/quick-chat-models";
import { defaultEffortFor, EFFORT_LABELS, EFFORT_LEVELS, type EffortLevel } from "@/lib/effort";
import { loadLastEffort, loadLastPermissionMode, saveLastEffort, saveLastPermissionMode } from "@/lib/last-used";
import { cn } from "@/lib/utils";
import { getUserDisplayName } from "@/lib/user";
import { Button } from "@/components/ui/button";
// The fluidfunctionalism.com reference dropdown (Base UI Menu +
// proximity-hover animated backgrounds) -- this file's one dropdown
// system now, per explicit request ("Lets keep all base ui").
// DropdownSubMenuItem/DropdownSubItem (ui/dropdown.tsx) are a hand-built
// submenu pair -- the reference component ships no submenu wrapper at
// all -- used for the model/provider picker's provider > model tree and
// each model's own nested "Set as default" menu.
import { DropdownMenu as BaseDropdownMenu, DropdownTrigger as BaseDropdownTrigger, DropdownContent as BaseDropdownContent, DropdownLabel as BaseDropdownLabel, DropdownSubItem, DropdownSeparator, DropdownRowActionMenu, DropdownRowActionItem } from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { Textarea } from "@/components/ui/textarea";
import GlideMenu from "@/components/primitives/glide-menu";
import {
  ArrowUpIcon,
  AttachmentIcon,
  ChevronDownIcon,
  ClearIcon,
  CompareIcon,
  DocIcon,
  FileSearchIcon,
  IntegrationsIcon,
  MicIcon,
  PlusIcon,
  ShareIcon,
  SkillIcon,
  SquareIcon,
  SummarizeIcon,
  TaskIcon,
  XIcon,
} from "@/components/icons/untitled-ui";

type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Provider display name, not the internal `provider` string -- real bug,
// confirmed directly ("the model dropdown shows Claude and Codex but
// should show Claude and ChatGPT in alphabetical order"): PROVIDER_DISPLAY
// (quick-chat-models.tsx) is the same consumer-brand-name mapping
// settings-overlay.tsx's own provider grid already uses ("Codex" internal,
// "ChatGPT" shown), and sorting by that same display name is what actually
// reads as alphabetical to a user looking at the rendered list ("ChatGPT"
// before "Claude"), not the internal provider key.
const MODEL_PROVIDERS = Array.from(new Set(QUICK_CHAT_MODELS.map((m) => m.provider))).sort((a, b) =>
  (PROVIDER_DISPLAY[a]?.primary ?? a).localeCompare(PROVIDER_DISPLAY[b]?.primary ?? b)
);

// Module-level, survives across ComposeBox mounts within the same page
// session (a new chat, navigating between chats, closing/reopening the
// model dropdown) -- real bug, confirmed directly ("when creating a new
// chat, the dropdown shows only add model and then a couple secs later
// the models load... can we not have the models cached in memory once
// setup"): every fresh mount started cliAvailability at {} and re-ran the
// same /cli/*/available checks from scratch, so the model list visibly
// emptied out to just "Add model" for as long as those requests took, even
// though the exact same answer had already been fetched moments earlier
// for the previous chat. Seeding state from this cache means a remount
// shows the last known-good answer immediately while checkCliAvailability
// (below) still refreshes it in the background -- same "instant from
// cache, correct a moment later" shape lib/last-used.ts already uses.
let cliAvailabilityCache: Record<string, boolean> = {};

// Single-model only now -- "Model fusion"/multi-select (picking several
// models from different providers) removed per explicit request. Still
// takes the same `typeof QUICK_CHAT_MODELS` array `selectedModels` itself
// is (kept as a 0-or-1-length array rather than a plain nullable value)
// so the rest of the file, and both call sites' own onModelsChange prop,
// didn't need a wider API change for what's now just a stricter
// selection rule.
function modelSelectionLabel(selected: typeof QUICK_CHAT_MODELS) {
  if (selected.length === 0) return "Model";
  return modelDisplayName(selected[0]);
}

// How the agent asks before acting -- beside the model trigger, per
// explicit request. Real for all three providers now: Codex
// (server.rs's own spawn_agent_session comment on last_permission_mode/
// issue #265 Phase 3), Antigravity (antigravity.rs's own comment on this
// same setting, --mode plan), and Claude (claude_direct.rs's own
// permission_mode comment -- manual/acceptEdits/bypassPermissions,
// confirmed live via `claude --help` and real tool-call runs under each).
// Per explicit follow-up ("It should reflect each provider capability,
// after antigravity is done then move to claude and chatgpt permissions
// based on their capability"). "Manual" first/default: it's the safest
// stance (asks before every action), so it's what a session should open
// on rather than something more permissive.
// "Ask", not "Plan" -- per explicit request. description -- per explicit
// request ("do a quick description like Synara's one does but without the
// icon"): Synara's own RuntimeUsageControls (a real reference app cloned
// for comparison, BranchToolbar.tsx's own RUNTIME_MODE_PRESENTATION map)
// pairs a one-line description under each mode's own label; same shape
// here, own copy (this app has no real permission-scoping system to
// describe yet, so this states each stance's own actual behavior instead
// of Synara's file/internet-access-specific wording).
type PermissionModeOption = { value: "manual" | "ask" | "auto" | "plan"; label: string; description: string };

const MODES: PermissionModeOption[] = [
  { value: "manual", label: "Manual", description: "Always ask before making changes" },
  { value: "ask", label: "Ask", description: "Only ask when something looks risky" },
  { value: "auto", label: "Auto", description: "Act freely without asking" },
];

// Antigravity has no real per-action approval prompt at all (agy's own
// --help lists only two headless modes: --dangerously-skip-permissions
// and --mode plan -- confirmed directly, no ask/manual equivalent exists
// to map "Manual"/"Ask" onto), so those two are replaced with the one
// real stance it does have instead of showing choices that don't
// correspond to anything the CLI can actually do. Per explicit request
// ("change permissions from the standard to Plan instead of Manual,
// Remove Ask, and Keep Auto").
const ANTIGRAVITY_MODES: PermissionModeOption[] = [
  { value: "plan", label: "Plan", description: "Propose changes without writing files" },
  { value: "auto", label: "Auto", description: "Act freely without asking" },
];


// Real, working action -- pushes one of these placeholder filenames into
// the composer's attachment list when the + button (a direct action now,
// no menu -- see that button's own comment below) is clicked.
// Real image attachment -- dataUrl is the full data: URL (used for the local
// thumbnail preview); mediaType/base64 are split back out of it at send time
// (ChatPage.tsx's own sendMessage / HomePage.tsx's own createSession), matching
// what the backend's ImageInput (server.rs) and claude_agent_sdk_rs's own
// UserContentBlock::image_base64 both expect: a bare media type and base64
// payload, not a data: URL.
export type ImageAttachment = { id: string; name: string; dataUrl: string };

let imageIdCounter = 0;
function nextImageId() {
  imageIdCounter += 1;
  return `image-${imageIdCounter}`;
}

// Shared by HomePage.tsx's own createSession and ChatPage.tsx's own sendMessage --
// both send images to the same POST /sessions/{id}/messages endpoint (server.rs's
// own SendMessageRequest.images), which expects a bare media type and base64
// payload, not the data: URL a <img src> preview needs.
export function toImageInputs(images: ImageAttachment[]) {
  return images.map((image) => {
    const [header, data] = image.dataUrl.split(",", 2);
    const mediaType = header.match(/^data:(.+);base64$/)?.[1] ?? "image/png";
    return { media_type: mediaType, data };
  });
}

function readImageFile(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: nextImageId(), name: file.name, dataUrl: reader.result as string });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type SlashRow = {
  key: string;
  kind: "command" | "placeholder";
  label: string;
  desc: string;
  icon: ReactNode;
};

// / menu -- one real command (clear) plus the create/find actions moved in
// from the old + menu (these read more like invoked actions than tagged-in
// things). The @ menu (agent/colleague/team/skill/app tagging) was removed
// entirely per explicit request ("remove all @ commands actually we don't
// need that extra feature now") -- none of those rows were ever wired to a
// real roster, and this app already has a dedicated "Select model" picker
// (below) for the one thing @ might otherwise have been for. Each / row
// renamed to its own short /word label per explicit request (was full
// phrases like "Create tasks"/"Find previous chats"), and the old two-row
// Find pair (previous chats + previous files) collapsed into one combined
// row (/find) rather than staying split. /research (connected apps & the
// web) removed per a later explicit request. Plus a couple of technical
// ones with no command backend behind them yet.
const SLASH_ROWS: SlashRow[] = [
  { key: "clear", kind: "command", label: "/clear", desc: "Clear the draft", icon: <ClearIcon className="size-4" /> },
  // Real, but not a pick()-time action like /clear above -- picking this
  // just inserts "/share " into the draft the same way every other
  // placeholder-kind row below does; the actual behavior happens once
  // it's sent (ChatPage.tsx's own onSend, checking for this exact command
  // before treating a prompt as a real chat message). Per explicit
  // request: typing/sending /share is how hosting a chat is triggered
  // now, not a header button.
  { key: "share", kind: "placeholder", label: "/share", desc: "Get a link to invite someone to this chat", icon: <ShareIcon className="size-4" /> },
  { key: "compare", kind: "placeholder", label: "/compare", desc: "Compare two things", icon: <CompareIcon className="size-4" /> },
  { key: "summarize", kind: "placeholder", label: "/summarize", desc: "Summarize this chat", icon: <SummarizeIcon className="size-4" /> },
  { key: "task", kind: "placeholder", label: "/task", desc: "Turn this into a task list", icon: <TaskIcon className="size-4" /> },
  { key: "docs", kind: "placeholder", label: "/docs", desc: "Draft a new document", icon: <DocIcon className="size-4" /> },
  { key: "find", kind: "placeholder", label: "/find", desc: "Search your previous chats & files", icon: <FileSearchIcon className="size-4" /> },
];

// The last /word being typed, if any. + is gone from this (used to open
// its own PLUS_ROWS menu) -- + is a direct attach-file action now, not a
// menu, so there's no token-triggered menu left for it to open (see the +
// button's own comment below).
function parseToken(draft: string): { query: string; start: number } | null {
  const match = /(^|\s)\/([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    query: match[2].toLowerCase(),
    start: match.index + match[1].length,
  };
}

// @ is back (issue #287) -- explicitly reintroduced after the earlier "remove
// all @ commands" request, but with a real roster behind it this time: every
// known integration always shows here, connected or not, so `@github`/
// `@gmail`/`@google-doc` are always typeable -- send_message (server.rs)
// explicitly tells the user to connect it in Settings if they mention one
// that isn't, rather than this menu only ever showing what's already
// connected (which would make an unconnected integration look like it
// doesn't exist at all, not just "not set up yet").
function parseAtToken(draft: string): { query: string; start: number } | null {
  const match = /(^|\s)@([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    query: match[2].toLowerCase(),
    start: match.index + match[1].length,
  };
}

const AT_ROWS: SlashRow[] = [
  { key: "github", kind: "placeholder", label: "@github", desc: "Ask GitHub -- issues, PRs, repos", icon: <IntegrationsIcon className="size-4" /> },
  { key: "gmail", kind: "placeholder", label: "@gmail", desc: "Ask Gmail -- read or draft email", icon: <IntegrationsIcon className="size-4" /> },
  { key: "google-doc", kind: "placeholder", label: "@google-doc", desc: "Ask Google Docs", icon: <IntegrationsIcon className="size-4" /> },
];

export type ComposeBoxHandle = {
  selectedModels: typeof QUICK_CHAT_MODELS;
};

// Per explicit request: cycles through `messages` using the t-text-swap
// CSS transition (index.css's own "Transitions.dev — Text states swap"
// section), which that section's own comment documents as a three-phase
// JS-driven sequence -- exit (blur/fade/slide out), swap the real text
// content while hidden, then enter (blur/fade/slide back in). Mirrored
// here with plain DOM class manipulation via a ref (imperative, not
// React state, so "force a reflow" -- reading offsetWidth between adding
// and removing .is-enter-start -- actually forces the browser to paint
// the jumped-to starting position before the transition-less state is
// removed; doing that through a state-driven className would need an
// extra render + effect pass to land the same reflow at the right
// moment).
//
// Hold durations, per explicit request: messages[0] ("Start a new
// chat...", the same string the box's own real `placeholder` prop
// carries) holds the *initial* delay the very first time it's shown (the
// page's own pause before anything starts moving), then swaps through the
// rest of `messages` at that same normal pace each. Once the sequence has
// cycled all the way back around to messages[0] again, per a later
// correction, *that* reappearance is what holds for 15s (was 30s,
// shortened per a later request) before the next lap starts -- that
// longer hold belongs to messages[0] coming back after the last message,
// not to the last message itself. The normal/initial pace
// itself was 5s at first, bumped to 8s per a later request -- 5s read as
// too fast to actually read a full tip before it swapped away.
const TEXT_SWAP_DUR_MS = 150;
const TEXT_SWAP_HOLD_MS = 8000;
const TEXT_SWAP_FINAL_HOLD_MS = 15000;

function AnimatedPlaceholder({ messages }: { messages: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let index = 0;
    // True only for messages[0]'s very first appearance (page load) --
    // every later time index wraps back around to 0, this is already
    // false, which is what makes that reappearance hold 30s instead of
    // the initial 5s (see scheduleNext below).
    let firstShow = true;
    let timer: ReturnType<typeof setTimeout>;

    function swapTo(next: number) {
      const el = ref.current;
      if (!el) return;
      el.classList.add("is-exit");
      timer = setTimeout(() => {
        index = next;
        el.textContent = messages[index];
        el.classList.remove("is-exit");
        el.classList.add("is-enter-start");
        // Force a reflow -- without reading a layout property here, the
        // browser can coalesce the add-then-remove of .is-enter-start
        // into a single style recalc, skipping straight to the final
        // (no-transition) state instead of actually painting the jumped-
        // to starting point first.
        void el.offsetWidth;
        el.classList.remove("is-enter-start");
        scheduleNext();
      }, TEXT_SWAP_DUR_MS);
    }

    function scheduleNext() {
      let hold = TEXT_SWAP_HOLD_MS;
      if (index === 0) {
        hold = firstShow ? TEXT_SWAP_HOLD_MS : TEXT_SWAP_FINAL_HOLD_MS;
        firstShow = false;
      }
      timer = setTimeout(() => swapTo((index + 1) % messages.length), hold);
    }

    scheduleNext();
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="t-text-swap pointer-events-none block truncate text-[13px] font-normal text-ink-3"
    >
      {messages[0]}
    </span>
  );
}

function compactTokenCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

// How full the model's context is, as a ring next to the model trigger --
// real data (ChatPage's own `contextUsage`, built from the SDK's actual
// `result` event `usage` field), not decorative. Undefined/null (no result
// event has landed yet -- a fresh chat, or HomePage, which never passes
// this at all) renders nothing at all rather than an empty/zeroed ring --
// per explicit request, this should stay fully invisible until a real
// turn actually completes and reports real usage, not just visually faded.
// Claude and Antigravity only (Codex has no compact capability at all --
// see canCompact's own comment below). For Claude this is the real
// --autocompact flag (claude_direct.rs), a documented value within its own
// "auto, or 100k-1M tokens" range. Antigravity has no such flag, so the same
// stored value is instead read back client-side (ChatPage.tsx's own usage
// handler) to fire a real "/compact" turn once usage crosses it -- one
// shared threshold setting driving a real mechanism either way, just a
// different mechanism per provider. Per explicit request ("Compact at 500k
// set by default, Compact at 250k, Compact at 100k"), 500k is the default,
// not "Auto".
const AUTOCOMPACT_OPTIONS = [
  { value: "500000", label: "Compact at 500k" },
  { value: "250000", label: "Compact at 250k" },
  { value: "100000", label: "Compact at 100k" },
] as const;

// Moved to sit beside the model name (was its own separate item further along
// the toolbar) and turned into a real dropdown instead of a hover-only tooltip,
// per explicit request. First row is the same real usage readout the old
// tooltip showed; "Set auto compact levels" (Claude only) is new.
// Ring fill denominator -- per explicit request ("Default context window
// should be 500K"), one flat default applied to every provider/model rather
// than a per-model table (Codex/Antigravity's CLIs report no window size at
// all, and no verified real number was available for the current model set).
const DEFAULT_CONTEXT_WINDOW_TOKENS = 500_000;

// Ring color per provider -- per explicit request ("black for chatgpt,
// orange for claude, blue for gemini").
const PROVIDER_RING_COLOR: Record<string, string> = {
  Codex: "#000000",
  Claude: "#F97316",
  Antigravity: "#4285F4",
};

function ContextRing({ fraction, color }: { fraction: number; color: string }) {
  const size = 14;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
      />
    </svg>
  );
}

function ContextDropdown({
  used,
  model,
  modelCount,
  onCompactNow,
  autocompactValue,
  autocompactScope,
  onSetAutocompact,
}: {
  used: number;
  model?: (typeof QUICK_CHAT_MODELS)[number];
  modelCount: number;
  onCompactNow?: () => void;
  // Per-chat now (per explicit request, "I want it to be per chat") -- owned by
  // ChatPage.tsx (its own "chat_defaults" WS handler comment has the full
  // reasoning), not fetched here, so every caller shares one real source of truth
  // instead of this dropdown racing its own separate fetch against it.
  autocompactValue: string;
  // Drives the dropdown's own label ("Context per chat"/"Context per project") --
  // per explicit request. Settings > General > Compact's own scope toggle.
  autocompactScope: "chat" | "project" | "global";
  onSetAutocompact: (value: string) => void;
}) {
  // "Compact now" -- Claude/Antigravity via a real "/compact" chat turn,
  // Codex (issue #265) via the real `thread/compact/start` RPC behind
  // POST /sessions/{id}/compact (see ChatPage.tsx's own call site comment).
  const canCompact = model?.provider === "Claude" || model?.provider === "Antigravity" || model?.provider === "Codex";
  // Threshold auto-compact -- Claude's real --autocompact flag, and a client-side
  // threshold watcher (ChatPage.tsx) for both Antigravity (sends "/compact") and Codex
  // (calls the real thread/compact/start endpoint) once usage crosses the chosen value.
  const canAutoCompact = model?.provider === "Claude" || model?.provider === "Antigravity" || model?.provider === "Codex";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Real bug, confirmed directly ("I changed to compact at 100K so that should have
  // updated the text"): the dropdown's own denominator was hardcoded to
  // DEFAULT_CONTEXT_WINDOW_TOKENS (500k) regardless of the actually-selected
  // threshold, so picking 100k/250k never changed what "X out of Y" showed. The
  // selected autocompact value is exactly the real ceiling being watched against, so
  // it's the right denominator to show.
  const compactThreshold = Number(autocompactValue) || DEFAULT_CONTEXT_WINDOW_TOKENS;

  // Opens on hover, stays open once clicked -- Base UI's own native
  // openOnHover/delay/closeDelay on Menu.Trigger (real, documented API, not
  // a hand-rolled mouseenter/mouseleave pair), which already tracks the
  // pointer across the trigger AND the portalled popup content together via
  // its own floating-ui wiring -- a manual pair on a wrapping <div> can't do
  // that, since the popup itself renders through Menu.Portal, outside that
  // div entirely. Same shared DropdownContent/motion.div fade already used
  // by every other dropdown in the app (this file's own comment above it),
  // so open/close now plays that same transition instead of snapping.
  return (
    <BaseDropdownMenu size="compact">
      <BaseDropdownTrigger
        openOnHover
        delay={80}
        closeDelay={150}
        render={
          // Plain text, not an icon -- same reasoning as the Effort control's
          // own recent fix (that component's own comment has the full
          // context): a small glyph here would need its own hover/tooltip to
          // explain itself, same complaint that one drew.
          <button
            type="button"
            aria-label={`Context: ${compactTokenCount(used)} tokens used`}
            className={`flex shrink-0 items-center gap-1 rounded-full px-1 text-[11px] text-ink-3 transition-opacity duration-300 hover:text-foreground focus:outline-none ${mounted ? "opacity-100" : "opacity-0"}`}
          >
            <ContextRing
              fraction={used / (compactThreshold * Math.max(1, modelCount))}
              color={PROVIDER_RING_COLOR[model?.provider ?? ""] ?? "currentColor"}
            />
          </button>
        }
      />
      <BaseDropdownContent side="top" align="center" sideOffset={6} className="w-52 min-w-0">
        <BaseDropdownLabel>
          {autocompactScope === "project" ? "Context per project" : autocompactScope === "global" ? "Global context" : "Context per chat"}
        </BaseDropdownLabel>
        {/* No provider icon/name here any more -- per explicit request ("remove the
            providers at the dropdown as that does not make sense"): the compact
            threshold is a per-chat setting now, not tied to any one provider's
            identity, so showing a provider mark next to it implied a scoping that
            no longer exists. */}
        <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">
          {compactTokenCount(used)} out of {compactTokenCount(compactThreshold * Math.max(1, modelCount))} tokens
        </div>
        {(canCompact || canAutoCompact) && (
          <>
            <DropdownSeparator />
            {canAutoCompact &&
              AUTOCOMPACT_OPTIONS.map((option, i) => (
                // Not `checked` -- that prop bolds the label (MenuItem's own shared
                // styling), and per explicit request the selected option here should
                // read as an active background at normal weight instead, not bold text.
                <BaseMenuItem
                  key={option.value}
                  index={i}
                  label={option.label}
                  className={autocompactValue === option.value ? "bg-hover-2" : undefined}
                  onSelect={() => onSetAutocompact(option.value)}
                />
              ))}
            {canCompact && onCompactNow && (
              <>
                <DropdownSeparator />
                <BaseMenuItem index={AUTOCOMPACT_OPTIONS.length} label="Compact now" onSelect={onCompactNow} />
              </>
            )}
          </>
        )}
      </BaseDropdownContent>
    </BaseDropdownMenu>
  );
}

// Screenshot-matched redesign, per explicit request ("lets build a slider
// again but instead of the icon on the left with the thunder, we will say
// Effort"): a discrete 5-stop dot track (one stop per EFFORT_LEVELS entry),
// not a continuous native <input type="range"> -- effort only ever has five
// real values, so a slider that could stop between them would just round back
// to the nearest one anyway.
function EffortSliderPanel({
  effort,
  onChange,
}: {
  effort: EffortLevel;
  onChange: (level: EffortLevel) => void;
}) {
  const activeIndex = EFFORT_LEVELS.indexOf(effort);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">Effort</span>
        {/* text-[var(--send-button-bg)] -- the exact same blue the send
            button's own background uses (index.css's own --send-button-bg
            token, itself just var(--focus-accent)), per explicit request
            ("the same color as our send button"), not this app's generic
            --accent token (a low-contrast near-transparent hover tint here,
            not a real color). */}
        {/* No trailing chevron any more -- per explicit request. This value
            isn't a nested nav target (nothing expands from clicking it), so
            the arrow was implying an affordance that didn't exist. */}
        <span className="text-[13px] font-medium text-[var(--send-button-bg)]">{EFFORT_LABELS[effort]}</span>
      </div>
      {/* Real bug, confirmed directly ("the effort slider is not working",
          then "i have to click at the dots instead of dragging"): this was
          never actually a slider -- discrete click targets (first a plain
          <button>, then a real Base UI Menu.Item once the button's own
          clicks turned out unreliable inside Menu.Popup) rather than
          something you could drag the thumb along. Neither primitive
          supports a free-form pointer-drag gesture the way a native
          <input type="range"> does out of the box (real browser-native
          drag/touch/keyboard handling, no custom pointer-capture code to get
          wrong) -- switched to that instead, step-snapped to the 5 real
          EFFORT_LEVELS so it still only ever lands on a real value. Track is
          solid var(--send-button-bg) (the send button's own blue) the whole
          way across, not a filled-vs-unfilled split -- per explicit follow-up
          ("the actual bg of the slider should be the blue colour of our send
          button"); the thumb itself is now the real visible white circle
          (also per that follow-up, "the slider circle should be our...
          white colour"), not a transparent native thumb with a separate
          decorative dot standing in for it. The 5 tick dots behind it are
          still purely decorative (pointer-events-none) -- they mark the real
          stop positions, the thumb is what actually shows the current value.
          stopPropagation on pointerDown -- same reasoning as every other
          non-menu-item interactive element inside this Menu system elsewhere
          in this file -- keeps Base UI's own Menu.Popup from treating a drag
          gesture as an outside interaction and closing mid-drag. */}
      <div className="relative flex h-3.5 items-center">
        <input
          type="range"
          min={0}
          max={EFFORT_LEVELS.length - 1}
          step={1}
          value={activeIndex}
          aria-label="Effort"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onChange(EFFORT_LEVELS[Number(event.target.value)])}
          // h-3.5, matching the thumb's own size-3.5 -- per explicit follow-up
          // ("the bg should be the same size as the white slider"): the track
          // used to be a thin h-1 line with a much larger thumb sitting on
          // top of it; now both are the same 14px so the track reads as one
          // solid blue pill the thumb slides along, not a line with an
          // oversized circle overflowing it. The old webkit-only
          // mt-[-5px] vertical-centering hack is gone with it -- that was
          // only ever needed to re-center a thumb taller than its own track,
          // which no longer applies now they match.
          className="relative h-3.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--send-button-bg)] outline-none [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_1px_2px_rgba(0,0,0,0.35)] [&::-moz-range-track]:h-3.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-3.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        />
        {/* Inactive stop markers, per explicit follow-up ("add the inactive
            markers in the back of the bg") -- rendered *after* the input in
            DOM (paints on top of its solid blue background, the literal
            "on/against the bg" this asks for), pointer-events-none so they
            never intercept the drag/click the input itself handles. No
            marker drawn at the current activeIndex -- that position already
            has the real white thumb sitting on it, and a second dot right
            under/beside it would just look like visual noise. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[6px]">
          {EFFORT_LEVELS.map((level, i) => (
            <span key={level} className={i === activeIndex ? "" : "size-1 rounded-full bg-white/50"} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ComposeBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  placeholderCycle,
  autoFocus,
  awaitingReply,
  onStop,
  defaultModelValue,
  onModelsChange,
  contextUsage,
  onOpenSettings,
  chatId,
  defaultEffortValue,
  onPinDefaultModel,
  onCompactNow,
  onSteer,
  autocompactValue,
  autocompactScope,
  onSetAutocompact,
}: {
  value: string;
  onChange: (value: string) => void;
  // Real images (compose-box.tsx's own images state, below), not lifted to the
  // parent the way `value` is -- attachments only ever exist here, between pick
  // and send, so keeping them local avoids threading a second piece of state
  // through both HomePage.tsx and ChatPage.tsx for no benefit. Cleared here right
  // after this fires (both call sites, below), same as `value` is cleared by the
  // parent's own onSubmit handler. effort passed the same way now -- real bug,
  // confirmed directly: the old onEffortChange side-channel (a ref the parent
  // kept updated from a useEffect keyed on `effort` state) could read stale by
  // the time sendMessage actually fired, reported as "I set Low, the reply's own
  // dial showed Medium." Reading it here, at the exact moment Send is pressed,
  // makes that whole class of timing bug structurally impossible rather than
  // chasing the specific cause.
  onSubmit: (images: ImageAttachment[], effort: EffortLevel) => void;
  placeholder: string;
  // HomePage-only, per explicit request: additional messages that rotate
  // in after `placeholder` itself (index 0 of the full sequence), using
  // the t-text-swap CSS transition (index.css's own "Transitions.dev —
  // Text states swap" section). Omitted entirely on ChatPage, which keeps
  // a single static placeholder. See AnimatedPlaceholder below for the
  // actual swap sequence/timing.
  placeholderCycle?: string[];
  autoFocus?: boolean;
  // Chat-only: while true, the send button becomes a stop button.
  awaitingReply?: boolean;
  onStop?: () => void;
  // Sonnet is the app's own existing default -- ChatPage passes the model
  // handed off from Home instead, so a chat doesn't appear to reset back
  // to Sonnet the moment it opens.
  defaultModelValue?: string;
  onModelsChange?: (models: typeof QUICK_CHAT_MODELS) => void;
  // Chat-only, real data (ChatPage's own contextUsage state, built from the
  // SDK's actual `result` event `usage` field) -- undefined until the
  // first turn actually completes and reports it, which is what keeps the
  // meter (ContextMeter above) fully absent until then rather than showing
  // an empty/zeroed ring from the moment the chat opens. Never passed on
  // HomePage, which has no session/turns yet for there to be usage of.
  contextUsage?: { used: number } | null;
  // Opens the real SettingsOverlay at Providers (AppLayout's own outlet
  // context openSettings("provider"), threaded down by HomePage.tsx/
  // ChatPage.tsx) -- the model picker's own "Add provider" row (below)
  // calls this instead of navigating to a route, same mechanism
  // WelcomePage.tsx's own Initial setup row already uses.
  onOpenSettings?: () => void;
  // ChatPage-only -- an existing chat's own id. Present, "Set as default"
  // (both the model and effort rows' own three-dot menus) writes THIS
  // chat's own default via the real per-chat endpoint. Absent on HomePage
  // (no chat exists yet there) -- "Set as default" there instead calls
  // onPinDefaultModel/onPinDefaultEffort below, per explicit request ("we
  // should be able to create a chat by pre defining this before per chat
  // and not for every chat like in settings"): this three-dot menu is
  // *never* the global Settings-wide default anymore (that's Settings'
  // own DefaultModelRow/DefaultEffortRow, settings-overlay.tsx, exclusively
  // now) -- it always means "for this specific chat," whether that chat
  // already exists or is still being composed.
  chatId?: string;
  // ChatPage-only, mirrors defaultModelValue's own shape -- this chat's own
  // per-chat default effort, arriving async over the WS's "chat_defaults"
  // message (ChatPage.tsx), not known at mount either.
  defaultEffortValue?: EffortLevel;
  // HomePage-only -- "Set as default for new chat" on a model/effort row,
  // called instead of writing anywhere directly (there's no chatId yet to
  // write to). HomePage holds the pinned value in a ref and applies it to
  // the real per-chat endpoint itself, right after the chat is actually
  // created, before navigating to it -- session-only until then (lost on
  // refresh, per explicit request), a real per-chat default after.
  onPinDefaultModel?: (modelValue: string) => void;
  onPinDefaultEffort?: (level: EffortLevel) => void;
  // Claude/Antigravity only -- see ChatPage.tsx's own call site comment for
  // the live-tested reasoning behind that split.
  onCompactNow?: () => void;
  // Codex only, real mid-turn injection (issue #265's own turn/steer) -- per explicit
  // request ("press enter to send the prompt mid way but keep the send as stop so i can
  // cancel the prompt as well"): while awaitingReply is true (a turn genuinely still
  // running, not just "no reply yet"), Enter routes here instead of onSubmit, and the
  // Stop button itself stays exactly as-is so the whole turn can still be cancelled
  // outright. Undefined for Claude/Antigravity (no real steer capability), so Enter
  // during their own awaitingReply window keeps doing nothing, same as before this.
  onSteer?: (text: string) => void;
  // Per-chat compact threshold (ChatPage.tsx owns the real state/persistence --
  // see ContextDropdown's own comment for the full reasoning). HomePage.tsx never
  // renders ContextDropdown at all (contextUsage is always null pre-chat), so
  // these two are only ever exercised from ChatPage's own call site.
  autocompactValue: string;
  autocompactScope: "chat" | "project" | "global";
  onSetAutocompact: (value: string) => void;
}) {
  const [selectedModels, setSelectedModels] = useState(() => {
    const initial = QUICK_CHAT_MODELS.find((m) => m.value === defaultModelValue);
    return initial ? [initial] : [];
  });
  // Real, custom scroll thumb for the model list below, not the native
  // scrollbar -- per explicit request ("make the scrollbar inside the
  // dropdown always visible so we know that there's more content to the
  // bottom... at models i have to scroll down to show the scrollbar"):
  // WKWebView (this app's own Tauri shell on macOS) follows the OS's
  // "Show scroll bars: Automatically/When scrolling" system setting for
  // *native* scrollbars regardless of any ::-webkit-scrollbar CSS -- there
  // is no CSS override for that overlay-only behavior. A real, absolutely-
  // positioned div driven by real scroll position sidesteps it entirely:
  // always rendered once content actually overflows the row cap, never
  // dependent on hover/scroll/OS prefs. null (not rendered at all) exactly
  // when there's nothing to scroll, per explicit follow-up ("always
  // visible once we exceed the dropdown size limit of course").
  // Direct DOM mutation (thumbRef.current.style.*), not React state -- real
  // bug, confirmed directly ("two scrollbars... glitches and gets the
  // scroll super slow"): onScroll fires many times per frame during
  // momentum scrolling, and running a setState + re-render on every single
  // one of those was real, measurable jank stacked on top of the native
  // scrollbar. Mutating the thumb element's own style imperatively costs
  // nothing per event -- no re-render, no reconciliation, the same
  // technique a real custom-scrollbar library would use.
  const modelListRef = useRef<HTMLDivElement>(null);
  const modelThumbRef = useRef<HTMLDivElement>(null);
  const updateModelScrollThumb = useCallback(() => {
    const el = modelListRef.current;
    const thumb = modelThumbRef.current;
    if (!el || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      thumb.style.display = "none";
      return;
    }
    const height = Math.max(24, (clientHeight / scrollHeight) * clientHeight);
    const maxTop = clientHeight - height;
    const rawTop = maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    // Clamped, not the raw computed value -- real bug, confirmed directly
    // ("when scrolling up and down that reaches the boundary... rounded
    // flatten before moving back... maybe because there's a gap"): macOS's
    // own rubber-band overscroll briefly reports a scrollTop past the real
    // [0, scrollHeight-clientHeight] range while bouncing, which pushed
    // this raw calc's own `top` slightly negative or past maxTop -- with
    // the thumb rendered inside an overflow-hidden wrapper (this list's
    // own comment above has why), that sliver poking past the boundary got
    // clipped flat instead of showing its real rounded-full cap. Clamping
    // here means the thumb itself never renders outside the track
    // regardless of what scrollTop reports mid-bounce.
    const top = Math.max(0, Math.min(rawTop, maxTop));
    thumb.style.display = "block";
    thumb.style.top = `${top}px`;
    thumb.style.height = `${height}px`;
  }, []);
  // Stable ref callback, not an inline arrow function -- real bug, confirmed
  // directly ("Something went wrong. Try reloading the app."): an inline
  // `ref={(el) => {...}}` is a brand-new function every render, so React
  // detaches and reattaches it on every single render; since attaching it
  // called setModelScrollThumb (a state update), that produced a genuine
  // infinite render loop. useCallback keeps the same function identity
  // across renders, so React only calls it on real mount/unmount.
  const modelListRefCallback = useCallback(
    (el: HTMLDivElement | null) => {
      modelListRef.current = el;
      updateModelScrollThumb();
      // Real bug, confirmed directly ("at first when the page loads for
      // first time the scrollbar does not appear, i have to scroll down
      // and then stays there"): the very first time this popup mounts, the
      // ref attaches before the browser has actually laid out/painted the
      // just-rendered rows, so clientHeight/scrollHeight both still read
      // as 0 (or equal) at that instant -- the immediate call above sees
      // "nothing to scroll" and hides the thumb, and nothing re-measures
      // it again until a real scroll event does. A rAF re-check runs after
      // the browser has committed a real layout pass, the same "measure
      // once now, once more after paint" pattern already used elsewhere in
      // this app for this exact class of bug (use-proximity-hover.ts's own
      // measurementAttempts).
      if (el) requestAnimationFrame(updateModelScrollThumb);
    },
    [updateModelScrollThumb]
  );
  // Whether the current selection came from this component's own
  // defaultModelValue re-sync below, not a real user pick -- lets that
  // effect keep re-syncing to a *later*, more correct defaultModelValue
  // (ChatPage.tsx's own chat-history-derived one arrives after an earlier,
  // less correct sessionStorage-derived one) without also being able to
  // clobber a genuine manual re-pick. Starts true: the useState initializer
  // above is itself just as much an auto-derived guess as the effect is.
  const autoSelectedModelRef = useRef(true);
  // Re-syncs when `defaultModelValue` itself changes, not just once at mount --
  // confirmed directly as a real bug: ChatPage.tsx's own defaultModelValue starts
  // undefined and only gets its real value a render later (a useEffect reading
  // sessionStorage, after this component has already mounted with the stale
  // undefined), so the useState initializer above ran too early and picked up
  // nothing, permanently -- a fresh chat handed off from Home showed "Select your
  // model" at the bottom even though a model was genuinely selected when the chat
  // was created. Only fires while nothing's selected yet (selectedModels.length ===
  // 0 short-circuits it after that), so it can't fight a later manual re-pick.
  // onModelsChange also called here, not just set locally -- confirmed
  // directly as a second real bug on top of the above: HomePage.tsx's own
  // selectedModelsRef (what createSession actually reads to build the POST
  // /sessions body) is only ever updated by selectModel's own manual-pick
  // path below, so a model that only ever arrived via this async re-sync
  // left that ref permanently empty. This component's own visible trigger
  // and shake-check (selectedModels, local state) looked correctly
  // selected, so nothing here ever shook or errored -- createSession
  // itself just silently no-opped on its own `if (!model) return` guard,
  // reported as "I can't send the message... the model was selected
  // already [so shaking didn't happen]" with no other visible symptom.
  useEffect(() => {
    // autoSelectedModelRef, not just selectedModels.length -- real bug,
    // confirmed directly ("the model that I initially created or left at
    // should remain because now after opening an existing chat, i have to
    // select the model again"): ChatPage.tsx now corrects defaultModelValue
    // a *second* time, once history replay reveals this chat's own real
    // last-used model -- the plain length check here would have already
    // seen a first (wrong, sessionStorage-derived) value and silently
    // ignored that correction, since something was already "selected" by
    // then. A real manual pick (selectModel below) still still blocks this
    // for good, exactly like the length check used to.
    if (selectedModels.length > 0 && !autoSelectedModelRef.current) return;
    const initial = QUICK_CHAT_MODELS.find((m) => m.value === defaultModelValue);
    if (initial) {
      autoSelectedModelRef.current = true;
      setSelectedModels([initial]);
      onModelsChange?.([initial]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultModelValue]);
  // Real, live check -- was just the static `configured` flag (below, still checked
  // too), which only means "this provider has real backend integration at all", not
  // "is it actually signed in right now". Per explicit request: a provider whose CLI
  // isn't logged in (e.g. Codex before `codex login`) must show as unselectable here,
  // the same live check settings-overlay.tsx's own provider cards use
  // (backend/src/server.rs's cli_available route). Checked once per provider, not per
  // model (every model under one provider shares that provider's own CLI) -- undefined
  // until the fetch resolves, which the disabled check below treats as "not available
  // yet" (safe default: never selectable before confirmed available).
  const [cliAvailability, setCliAvailability] = useState<Record<string, boolean>>(() => cliAvailabilityCache);
  // Re-run on demand (the model dropdown's own onOpenChange, below), not just once on
  // mount -- confirmed directly as a real gap: after signing into a provider via
  // settings-overlay.tsx's "Setup now", this picker kept showing that provider's
  // models as unavailable until the whole page was reloaded, since the mount-only
  // fetch never ran again on its own.
  // All providers settle together, one setCliAvailability call, not one
  // fetch resolving (and re-rendering the filtered list) at a time -- real
  // bug, confirmed directly ("chatgpt loads first then claude models loads
  // after it"): QUICK_CHAT_MODELS.filter() below always iterates in that
  // array's own declared order (Claude, then Codex), so
  // whichever provider's own /available check happened to resolve first
  // rendered its rows immediately, and a slower provider's rows then
  // visibly popped in ABOVE those already-mounted rows the moment it
  // caught up -- reads as a reorder even though the array order itself
  // never actually changed.
  function checkCliAvailability() {
    void Promise.all(
      MODEL_PROVIDERS.map((provider) =>
        fetch(`/cli/${encodeURIComponent(provider.toLowerCase())}/available`)
          .then((res) => res.json())
          .then((data) => [provider, Boolean(data.available)] as const)
          .catch(() => [provider, false] as const)
      )
    ).then((entries) => {
      const next = Object.fromEntries(entries);
      cliAvailabilityCache = next;
      setCliAvailability(next);
    });
  }
  useEffect(checkCliAvailability, []);
  // loadLastPermissionMode() first -- per explicit request ("all these
  // three should have a last_effort, last_permission, last_context saved
  // as well for loading purposes"): was a bare hardcoded "manual" with no
  // memory of what was actually last chosen anywhere in the app.
  const [mode, setMode] = useState<PermissionModeOption["value"]>(() => loadLastPermissionMode() ?? "manual");
  // Antigravity's own real-capability set (ANTIGRAVITY_MODES's own comment
  // has the reasoning) instead of the standard Manual/Ask/Auto once an
  // Antigravity model is the current pick.
  const modes = selectedModels[0]?.provider === "Antigravity" ? ANTIGRAVITY_MODES : MODES;
  // Keeps the persisted mode valid for whichever list is now showing --
  // "manual"/"ask" mean nothing to Antigravity (no such capability), and
  // "plan" means nothing to every other provider, so switching models
  // must not leave the trigger showing a choice that isn't even in its
  // own dropdown any more.
  useEffect(() => {
    if (modes.some((m) => m.value === mode)) return;
    const fallback = modes[0].value;
    setMode(fallback);
    saveLastPermissionMode(fallback);
  }, [modes, mode]);
  // Real default now (settings-overlay.tsx's own "Default effort" control,
  // lib/effort.ts's own defaultEffortFor) -- was a bare hardcoded "medium",
  // still the fallback inside defaultEffortFor itself when nothing's been
  // set in Settings yet ("None" there). defaultEffortValue (ChatPage's own
  // per-chat default, arriving over the WS) wins when present;
  // loadLastEffort() -- whatever was actually last used, same "quick load"
  // reasoning as loadLastPermissionMode above -- wins over the Settings
  // default when THAT'S absent too.
  const [effort, setEffort] = useState<EffortLevel>(() => defaultEffortValue ?? loadLastEffort() ?? defaultEffortFor());
  // True once the user has actually picked an effort level this session --
  // defaultEffortValue arrives async, a render or more after mount (same
  // timing gap defaultModelValue's own comment above documents), so without
  // this guard its late arrival would clobber a manual pick made in the
  // meantime.
  const effortTouchedRef = useRef(false);
  useEffect(() => {
    if (effortTouchedRef.current) return;
    if (defaultEffortValue) setEffort(defaultEffortValue);
  }, [defaultEffortValue]);
  // Drives the Manual/Plan/Auto trigger's own fade-in below -- per explicit
  // request, appearing once a model is picked shouldn't be an abrupt pop-in
  // (a plain conditional render, tried first). Starts already-visible when
  // a model is already selected at mount -- real bug, confirmed directly
  // ("only permission needs to be fixed as that's not loading together
  // with everything else"): this always started false regardless, so even
  // once selectedModels was populated from the very first render
  // (ChatPage.tsx's own provisional-model fix, its comment has the full
  // history), this row still sat at opacity-0 for a tick + the 10ms timer
  // below before fading in, alone, after the rest of the toolbar. Only a
  // real transition -- no model selected yet at mount, one picked a moment
  // later (HomePage's own new-chat flow) -- still gets the fade.
  const [modeVisible, setModeVisible] = useState(() => selectedModels.length > 0);
  const hasModel = selectedModels.length > 0;
  useEffect(() => {
    if (!hasModel) {
      setModeVisible(false);
      return;
    }
    const timer = setTimeout(() => setModeVisible(true), 10);
    return () => clearTimeout(timer);
  }, [hasModel]);
  const [listening, setListening] = useState(false);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  // Drives AnimatedPlaceholder's own fade below -- per explicit request,
  // that hint fades out on focus (not just once real text is typed) and
  // fades back in on blur, same as it would if the box were cleared.
  const [textareaFocused, setTextareaFocused] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Real auto-grow -- confirmed directly as a gap ("when our text goes to
  // the second row, the compose box does not increase size"): rows={1} plus
  // a fixed max-h alone doesn't grow a textarea at all, the browser just
  // scrolls its own single-row box internally as text wraps. Resets height
  // to auto first so scrollHeight reports the content's real height (not
  // the previous explicit px height, which would otherwise floor every
  // measurement at whatever it last grew to and never shrink back down).
  // Capped at 40% of the viewport height (max-h-[40vh] on the Textarea
  // itself, below, is the actual clamp -- this only ever measures/sets a
  // height up to that same value so the two can't disagree) -- past that,
  // the Textarea's own overflow-y-auto takes over as a real scrollbar.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = window.innerHeight * 0.4;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value]);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  // Keyed by model value, not index -- sortedModelRows' own order can
  // shift (cliAvailability settling in after mount), so a stable key is
  // what actually survives that. Backs the real open-highlight fix below
  // (this dropdown's own onOpenChange) -- DropdownSubItem's own top
  // comment confirms it isn't part of the proximity-hover/checkedIndex
  // system at all, so a checkedIndex prop here would be a silent no-op;
  // moving real DOM focus onto the correct row is what actually drives
  // Base UI's own native highlight for these rows.
  const modelRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const modeTriggerRef = useRef<HTMLButtonElement>(null);
  const effortTriggerRef = useRef<HTMLButtonElement>(null);
  // Kept current every render (no dependency array to go stale) -- read
  // by the "press space to focus" listener below, which registers itself
  // exactly once for this component's whole lifetime instead of tearing
  // down/re-adding whenever `placeholderCycle` changes identity (see that
  // effect's own comment for why that mattered).
  const hasPlaceholderCycleRef = useRef(Boolean(placeholderCycle));
  hasPlaceholderCycleRef.current = Boolean(placeholderCycle);

  // Replaces the selection outright, not a toggle -- single-model only
  // now, per explicit request (was an add/remove toggle supporting
  // multi-select "Model fusion"). Picking a model always leaves exactly
  // one selected; there's no way to get back to zero selected once one
  // has been picked, same as most single-select model pickers.
  function selectModel(model: (typeof QUICK_CHAT_MODELS)[number]) {
    autoSelectedModelRef.current = false;
    setSelectedModels([model]);
    onModelsChange?.([model]);
  }

  // "Set as default" -- always scoped to a specific chat now, never the
  // global Settings-wide default (that's Settings' own DefaultModelRow's
  // job exclusively, settings-overlay.tsx). With a chatId (an existing
  // chat), writes that chat's own default straight to the real per-chat
  // endpoint. Without one (HomePage, no chat created yet), there's nothing
  // to write to yet -- onPinDefaultModel just hands the pick up to
  // HomePage, which holds it and applies it to the real endpoint itself
  // once the chat actually exists (this file's own prop comment above has
  // the full reasoning).
  async function setAsDefaultModel(model: (typeof QUICK_CHAT_MODELS)[number]) {
    if (!chatId) {
      onPinDefaultModel?.(model.value);
      return;
    }
    // sender_name -- the chat-scoped endpoint owner-gates on it
    // (server.rs's own comment on set_chat_default_model has the full
    // reasoning).
    await fetch(`/sessions/${chatId}/default-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.value, sender_name: getUserDisplayName() }),
    });
  }

  function toggleSpeechToText() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      window.alert("Speech-to-text is not supported in this browser. (ALS-010)");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onChange(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const slashToken = dismissed ? null : parseToken(value);
  const atToken = dismissed ? null : parseAtToken(value);
  const token = slashToken ?? atToken;
  const menu: "slash" | "at" | null = slashToken ? "slash" : atToken ? "at" : null;
  const query = token?.query ?? "";

  const rows =
    menu === "slash"
      ? SLASH_ROWS.filter((r) => r.label.slice(1).startsWith(query))
      : menu === "at"
        ? AT_ROWS.filter((r) => r.label.slice(1).startsWith(query))
        : [];

  useEffect(() => {
    setActive(0);
  }, [menu, query]);

  const closeMenus = () => {
    setDismissed(true);
  };

  // No menu any more (the + button used to open PLUS_ROWS; that menu's own
  // "commands" moved into @/. above, per explicit request), so this opens a real
  // native file picker instead -- a plain, direct click action, not something
  // pick() below handles.
  function openFilePicker() {
    fileInputRef.current?.click();
  }

  // Shared by the file picker's onChange and the composer's own onDrop, below --
  // per explicit request, both are real entry points for the same real attach
  // action, not one real and one decorative.
  async function addImageFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const read = await Promise.all(imageFiles.map(readImageFile));
    if (read.length > 0) setImages((current) => [...current, ...read]);
  }

  // index.css's own "Transitions.dev — Error state shake" -- called when
  // Send is actually attempted (click or Enter, below) with no model
  // selected, instead of silently doing nothing (the previous behavior:
  // the button was disabled outright, so a click landed nowhere and
  // Enter's own guard just swallowed the keystroke) or HomePage's own
  // blocking window.alert (removed -- see createSession's own comment).
  // Remove-reflow-readd, not just adding the class: without forcing a
  // reflow in between, two attempts close together (e.g. mashing Enter)
  // wouldn't restart the animation the second time -- the class was
  // already present, so re-adding it is a no-op as far as the DOM is
  // concerned.
  function triggerModelShake() {
    const el = modelTriggerRef.current;
    if (!el) return;
    el.classList.remove("is-shaking");
    void el.offsetWidth;
    el.classList.add("is-shaking");
  }

  function pick(row: SlashRow) {
    if (row.key === "clear") {
      onChange("");
    } else if (row.kind === "placeholder") {
      // No real destination yet (see SLASH_ROWS' own comment), but
      // picking one -- via Enter or a click -- should still do something
      // visible instead of just closing the menu with nothing to show for
      // it: inserts the row as text, replacing whatever was typed after
      // the trigger character. / labels already carry their own leading
      // "/", so no sigil needs prepending here any more (the @ menu that
      // used to need one was removed).
      const start = token ? token.start : value.length;
      onChange(`${value.slice(0, start)}${row.label} `);
    }
    setDismissed(true);
    textareaRef.current?.focus();
  }

  // latestRef: the outside-click effect below only re-registers when
  // `menu` itself changes (its own dependency array), not on every
  // keystroke -- reading `value`/`token` directly in that handler would
  // close over whatever they were the moment the menu *opened*, silently
  // reverting any further typing the moment a stale close() fired. This
  // ref stays current every render so the handler always deletes the
  // token as it actually stands at click time.
  const latestRef = useRef({ value, token });
  latestRef.current = { value, token };

  // Clicking anywhere outside the composer closes the inline / menu --
  // the model picker (DropdownMenu, below) handles its own outside-click
  // and Escape natively, no separate handling needed for it here.
  // Also deletes whatever the open trigger inserted (same as toggling the
  // same button closed, above), so clicking e.g. the top bar's search box
  // right after opening + doesn't leave a stray "+" sitting in the text.
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-compose-box]")) {
        const { value: currentValue, token: currentToken } = latestRef.current;
        if (currentToken) onChange(currentValue.slice(0, currentToken.start));
        closeMenus();
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  // HomePage-only (gated on placeholderCycle, same as AnimatedPlaceholder
  // itself -- see that component's own comment): per explicit request,
  // this box no longer autofocuses on page load, and its own rotating
  // hint spells out "Press space to enter the compose box" as the actual
  // way in. This is what makes that literal -- Space, pressed anywhere
  // else on the page (not already typing in this or some other field),
  // focuses the textarea instead of just scrolling the page the way an
  // unhandled Space normally would.
  //
  // hasPlaceholderCycleRef + an empty dependency array, not a plain
  // `if (!placeholderCycle) return` gating a `[placeholderCycle]` effect
  // (tried first, reverted per explicit request -- repeated enter/exit
  // cycles eventually stopped re-entering). HomePage passes a brand new
  // array literal as this prop on every one of its own renders, so that
  // dependency never actually stayed equal render to render; each
  // one tore the *entire* listener down and re-added it, and if a
  // keydown landed in the same tick as one of those add/remove pairs
  // (StrictMode's own double-invoke in dev makes this more likely, but
  // it's a real ordering risk in prod too, not just a dev artifact), it
  // could be dropped instead of handled. This version registers the
  // listener exactly once, for this component's entire mounted lifetime,
  // and reads whether the feature is even active from a ref that's kept
  // current every render instead -- "always accept" on this page, as
  // requested, since it's the main way in.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!hasPlaceholderCycleRef.current) return;
      if (event.key !== " ") return;
      const target = event.target as Element | null;
      // Already typing somewhere (this textarea included, any other
      // input/textarea, or a contentEditable node) -- let Space behave
      // normally there instead of hijacking it.
      if (target?.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      textareaRef.current?.focus();
    };
    // capture: true -- runs before any other handler further down the
    // tree could stopPropagation() this keydown away first, so this
    // stays reliable regardless of what else on the page might otherwise
    // swallow it.
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Sorted by provider's own display name -- pulled out of the render
  // below so checkedIndex (the model dropdown's own BaseDropdownContent,
  // below) and the actual rendered row order read off the exact same
  // array, not two independently-sorted copies that could drift.
  const sortedModelRows = useMemo(
    () =>
      QUICK_CHAT_MODELS.filter((m) => m.configured && cliAvailability[m.provider] === true).sort((a, b) =>
        (PROVIDER_DISPLAY[a.provider]?.primary ?? a.provider).localeCompare(PROVIDER_DISPLAY[b.provider]?.primary ?? b.provider)
      ),
    [cliAvailability]
  );

  return (
    // @container: its own width, not the host page's -- ChatPage doesn't
    // wrap this in a @container the way HomePage does, so the @[...]:
    // classes below (button row wrapping, padding/radius scaling) need
    // their own container context to work on both pages.
    <div data-compose-box className="relative @container">
      {/* ── / (slash) menu -- bottom-full, not top-full: this composer is
          pinned to the bottom of the page on both HomePage and ChatPage
          now, so opening downward (tried first) could run the menu off
          the bottom of the viewport; growing upward over the box instead
          -- same direction the reference component this was ported from
          uses -- keeps it fully on screen regardless of where the
          composer itself sits. ─────────────────────────────────────── */}
      {menu && (
        <div className="absolute inset-x-0 bottom-full z-20 mb-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {/* onClick/onMouseDown only -- DOM focus deliberately never
              moves to these rows (arrow-key nav below stays on the
              textarea itself and just updates `active`). GlideMenu's own
              hover/focus tracking still glides for mouse users; the
              bg-hover/50 class covers keyboard nav's own highlight without
              needing focus to move there, since actually focusing a row
              was stealing keystrokes away from the textarea entirely --
              Backspace/Escape stopped reaching it the moment this menu
              opened. */}
          {/* Plain overflow-y-auto, not ScrollArea -- confirmed directly
              as a real bug ("the scroll inside the drawer does not
              work"): ScrollArea's Viewport sizes itself at height:100% of
              its Root, which here only ever got a max-height (no explicit
              height), and a percentage height can't resolve against an
              auto-height parent capped only by max-height -- the exact
              same class of ScrollArea layout bug sidebar-nav.tsx's own
              recents list already hit and reverted for (that div's own
              comment above has the fuller history). p-1, on this wrapper
              now, not the outer container -- max-h-[224px] + overflow-y-
              auto caps the menu to a scrollable window instead of growing
              indefinitely as AT_ROWS/SLASH_ROWS grow, and keeping the
              outer container itself unpadded is what lets the guide
              text's own border-t below span the box's full width edge-to-
              edge, same as top-bar.tsx's search dropdown footer, instead
              of stopping short at this padding's own inset. */}
          <div className="max-h-[224px] overflow-y-auto p-1">
            <GlideMenu rowSelector="[data-menu-row]" className="flex flex-col gap-px">
              {rows.map((row, i) => (
                <button
                  key={row.key}
                  type="button"
                  data-menu-row
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(row)}
                  className={cn(
                    "relative z-10 flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left outline-none",
                    i === active && "bg-hover-2/50"
                  )}
                >
                  {row.icon && <span className="flex size-5 shrink-0 items-center justify-center text-ink-2">{row.icon}</span>}
                  {/* font-normal/text-ink-2, not font-medium/text-ink -- matches
                      the search dropdown's own row text exactly (top-bar.tsx,
                      TopBarSearch's results.map), per explicit request. */}
                  <span className="shrink-0 truncate text-[12px] font-normal text-ink-2">{row.label}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.desc}</span>
                </button>
              ))}
              {rows.length === 0 && (
                <div className="flex h-8 items-center px-2 text-[12px] text-ink-3">No matches for "{query}"</div>
              )}
            </GlideMenu>
          </div>
          {/* Moved below the rows, not above -- matches the search
              dropdown's own footer-hint placement (top-bar.tsx) instead
              of this menu being the only one with its guide text at the
              top. font-normal/text-ink-3/50, not the plain text-ink-3 this
              had -- matches that dropdown's own "Press Escape to close"
              hint's exact color/weight, per explicit request. */}
          <div className="border-t border-border px-3 py-2 text-[11px] font-normal text-ink-3/50">Type to search commands</div>
        </div>
      )}

      {/* flex flex-col, no fixed/min height any more -- the box just hugs
          whatever its one content row (textarea + mic/send, both now on one
          row -- see that row's own comment below) actually needs. py-2 /
          @[420px]:py-3, symmetric top and bottom (was the asymmetric pt-2/
          pb-1.5 an older two-row layout needed, back when a separate
          toolbar row sank to the box's own bottom edge via its own mt-auto)
          -- with only one row left, asymmetric padding just pushed that
          row's whole contents a couple px above the box's own true vertical
          center, which is what made the placeholder/mic/send read as "not
          centered" even though the row's own internal alignment (items-
          center, below) was already correct. */}
      {/* rounded-[var(--row-radius)] now, no @container escalation --
          went through a few wrong turns first: rounded-2xl (itself
          replacing the old mobile-first ascending tiers rounded-2xl ->
          @[280px]:rounded-3xl -> @[420px]:rounded-[24px]), then rounded-xl
          at the base tier only with the escalating
          @[420px]:rounded-3xl/@[640px]:rounded-4xl tiers still in place
          (PAGE_CONTENT_WIDTH is 800px, comfortably past both breakpoints,
          so the box's real everyday rendered width always landed on
          rounded-3xl/rounded-4xl regardless of what the base tier said --
          confirmed directly as having no real visible effect), then a
          flat literal rounded-[8px] once the escalation was dropped
          (matching the sidebar's own row radius exactly instead of
          --radius-xl's close-but-not-equal 8.4px). --row-radius
          (index.css's :root) is the real fix: a single shared, viewport-
          responsive value both this box and every sidebar row
          (sidebar-nav.tsx) read, per explicit request ("setup a dynamic
          value so it matches... depending on the size of the screen").
          Neither element can drift from the other any more, and both now
          actually grow together on a wider screen instead of staying
          flat. */}
      {/* transition-[padding]: the px-2/@[420px]:px-3/py-2/@[420px]:py-3
          tiers above are container-query breakpoints, so they flip
          *instantly* the moment the box's own width crosses one -- with no
          transition at all, dragging the browser window (or docking it
          beside another app) to slowly resize through one of those
          thresholds made the padding visibly snap mid-drag instead of
          scaling smoothly with everything else that's actually continuous
          (the box's own width). This doesn't make the breakpoint itself
          less discrete (Tailwind's own container queries can't be
          continuous), but it interpolates the *visual result* smoothly
          across it instead of jumping. */}
      {/* border-border/bg-background, no dark: override any more (was
          dark:border-[#282828]/dark:bg-[#212121], a distinct "surface"
          shade) -- per explicit request, this box now matches the main
          content area's own background/border exactly in both themes,
          not just light mode. */}
      {/* --row-radius (index.css's :root) is a real viewport-media-query
          value, not a @container one -- the sidebar's own width barely
          changes with the window (it's a fixed rail), so a shared
          *screen*-size signal is what actually keeps this box and every
          sidebar row moving together, unlike each reading its own
          independent element width the way the old @container tiers
          did. See that variable's own comment (index.css) for the exact
          breakpoints. */}
      {/* Hidden -- the "+" button below (openFilePicker) is the real trigger, same
          pattern as a styled upload control anywhere: the native input itself is
          never meant to be seen. accept="image/*": per explicit request, this pass
          is images only, not arbitrary files. multiple: one drag or one picker
          trip can attach more than one image. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void addImageFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {/* onDragOver/onDrop -- per explicit request, dropping an image anywhere on
          the composer attaches it, not just the file-picker button. dragActive
          only drives the border below; it's not itself a real attachment. */}
      <div
        ref={composerRef}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragActive(true);
          }
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void addImageFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col rounded-[var(--row-radius)] border border-border bg-background px-2 py-2 transition-[padding,border-color] duration-200 [contain:layout_style] @[420px]:px-3 @[420px]:py-3",
          dragActive && "border-ring",
          // border-focus-accent -- matches the sidebar/inbox search inputs'
          // own focus-visible:border-focus-accent exactly (sidebar-nav.tsx's
          // own comment on that class has the full history), per explicit
          // request ("we are highlighting as blue, lets do the same...
          // at compose box"). textareaFocused, not a CSS :focus-within --
          // this border lives on the outer wrapper, not the textarea
          // itself, and was already tracked (this file's own
          // AnimatedPlaceholder fade uses the same state) but never
          // consumed for a border change until now.
          !dragActive && textareaFocused && "border-focus-accent"
        )}
      >
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {images.map((image) => (
              <span key={image.id} className="group/attachment relative block size-12 shrink-0">
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  className="size-12 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove ${image.name}`}
                  onClick={() => setImages((current) => current.filter((i) => i.id !== image.id))}
                  className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full border border-border bg-background text-ink-3 opacity-0 transition-opacity group-hover/attachment:opacity-100 hover:text-ink"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* relative: anchors AnimatedPlaceholder's own absolute overlay
            (below) to this textarea's real position -- only rendered at
            all when placeholderCycle was actually passed (HomePage
            only). The real `placeholder` prop below still carries
            `placeholder` itself when no cycle is given (ChatPage) --
            when one IS given, it's blanked out here so the two don't
            double-render on top of each other; AnimatedPlaceholder's own
            first frame renders that exact same string instead (see its
            own `messages[0]`). */}
        {/* items-end, not items-center -- per explicit request, now that the
            textarea actually auto-grows (the effect above): the mic/send
            buttons should stay pinned to the row's original bottom position
            as it grows, so the box visually grows *upward* rather than the
            buttons drifting down to stay centered against a taller box.
            Was items-center specifically because auto-grow didn't exist yet
            -- with the textarea always exactly one row tall, item-center
            vs. items-end made no visible difference at the time, and
            items-end alone (button baseline tuning) wasn't worth chasing
            for a box that could never actually grow. */}
        <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          {placeholderCycle && (
            // Stays mounted regardless of `value` now (was conditional on
            // !value, unmounting it outright the instant typing started)
            // -- per explicit request, typing should fade this out
            // smoothly, not snap it away; a plain opacity transition on a
            // wrapper needs the thing it's fading to still be in the DOM
            // to animate at all. Keeping it mounted also means its own
            // swap-cycle timers (AnimatedPlaceholder's own effect) just
            // keep running underneath while hidden, so clearing the box
            // again resumes mid-cycle instead of restarting from
            // messages[0] every time. pointer-events-none: this sits on
            // top of the real textarea in the DOM; without it, typed
            // clicks while the hint is still fading out would land on
            // this instead of focusing the textarea underneath.
            // absolute inset-0 + flex items-center: centers the placeholder
            // span vertically within this now-stretched wrapper, same
            // center line the real Textarea (below) and the mic/send
            // buttons share.
            <div
              className={`pointer-events-none absolute inset-0 flex items-center px-1 transition-opacity duration-300 ${value || textareaFocused ? "opacity-0" : "opacity-100"}`}
            >
              <AnimatedPlaceholder messages={[placeholder, ...placeholderCycle]} />
            </div>
          )}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setDismissed(false);
          }}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          onKeyDown={(event) => {
            if (menu && rows.length > 0) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                return;
              }
              if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                event.preventDefault();
                pick(rows[active]);
                return;
              }
            }
            if (event.key === "Escape") {
              // preventDefault -- without it, Escape also falls through to
              // whatever the browser/OS does with an unhandled Escape
              // keystroke (the same bug top-bar.tsx's own search input had
              // -- see that file's own comment on its Escape handler).
              event.preventDefault();
              if (menu) {
                closeMenus();
              } else {
                // No / menu open to close -- per explicit request
                // (HomePage's own placeholder now says so directly:
                // "escape to exit"), Escape blurs the textarea instead,
                // the reverse of the "press space to enter" listener
                // above. Real text already typed is left alone -- this
                // only gives up focus, not the draft.
                textareaRef.current?.blur();
              }
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!value.trim()) return;
              if (awaitingReply && onSteer) {
                onSteer(value);
                onChange("");
                return;
              }
              if (selectedModels.length === 0) {
                triggerModelShake();
                return;
              }
              onSubmit(images, effort);
              setImages([]);
            }
          }}
          placeholder={placeholderCycle ? "" : placeholder}
          rows={1}
          autoFocus={autoFocus}
          // placeholder:text-ink-3, not text-ink-2 -- lighter than the +/@
          // buttons' own "inactive" color, one tier further per request.
          // placeholder:opacity-100 + focus:placeholder:opacity-0 fades the
          // placeholder out on focus (in on blur) instead of it just
          // vanishing the instant typing starts -- ::placeholder supports
          // its own opacity transition independent of the real typed text.
          // max-h-[40vh] + overflow-y-auto -- per explicit request ("max
          // size of height to be increase should be 40% of the screen
          // height then add a scrollbar"), replacing the old flat max-h-40
          // (160px, unrelated to viewport size) with a real percentage cap;
          // the auto-grow effect above measures/sets height against this
          // exact same 40vh value. transition-[height] duration-150, not a
          // plain height jump -- per explicit request ("should smoothly
          // increase the height").
          // [field-sizing:fixed] overrides ui/textarea.tsx's own base
          // field-sizing-content -- that's a native CSS auto-grow mechanism,
          // but support is inconsistent across engines (notably WebKit,
          // which the Tauri desktop app's own webview is built on), so
          // relying on it is what actually left this not growing at all in
          // practice. Fixed instead, so the JS effect above (which works
          // identically everywhere) is the one real mechanism, not competing
          // with a native behavior that may or may not be applying.
          className="max-h-[40vh] min-h-0 resize-none overflow-y-auto border-none bg-transparent px-1 py-1 font-normal shadow-none transition-[height] duration-150 ease-out [field-sizing:fixed] placeholder:text-ink-3 placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0 dark:bg-transparent"
        />
        </div>
        {/* Attach button moved out entirely (per explicit request) -- it
            now sits to the left of the Select model trigger in the row
            below the box's own closing tag, not in here any more.
            shrink-0: this group keeps its own natural width when the
            textarea sibling (above) is the one that grows/shrinks with the
            box's own width. */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Speech-to-text via the browser's built-in SpeechRecognition --
              same "real browser API, not an AI feature" honesty as
              ChatPage's own read-aloud (Web Speech API's other half).
              Equalizer bars while listening (index.css's own eq-bounce
              keyframe), instead of a static mic glyph, so it actually
              reads as "recording" rather than just a toggled color. */}
          <Button
            size="icon"
            variant={listening ? "default" : "ghost"}
            onClick={toggleSpeechToText}
            aria-label={listening ? "Stop dictation" : "Start dictation"}
            // text-foreground, not text-ink-2 -- per explicit request ("the
            // compose box... tools needs to be updated to the new color"),
            // matching the sidebar's own move off its dimmer resting tone.
            className={cn("size-[30px]", !listening && "text-foreground")}
          >
            {listening ? (
              <span className="flex h-3.5 items-end gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-current"
                    style={{ height: "100%", animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite` }}
                  />
                ))}
              </span>
            ) : (
              // strokeWidth 1.5, not the icon's own default 2 -- per
              // explicit request ("reduce the stroke of the mic to 1.5?
              // for some reason looks too strong").
              <MicIcon className="size-[18px]" strokeWidth={1.5} />
            )}
          </Button>
          {awaitingReply ? (
            <Button size="icon" variant="outline" onClick={onStop} aria-label="Stop" className="size-[30px]">
              <SquareIcon className="fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              // disabled only on empty text, not on missing model any more
              // -- a disabled button swallows its own click entirely, which
              // is what made "tried to send with no model" produce no
              // feedback at all before. Still clickable with no model
              // selected so the onClick below can actually see the attempt
              // and shake the model trigger instead.
              disabled={!value.trim()}
              onClick={() => {
                if (selectedModels.length === 0) {
                  triggerModelShake();
                  return;
                }
                onSubmit(images, effort);
                setImages([]);
              }}
              aria-label="Send"
              // hover/active reference index.css's own
              // --send-button-bg-hover/-active tokens (color-mix computed
              // there, in plain CSS, not inline here -- see that token's
              // own comment for why: an inline color-mix(...) arbitrary
              // value silently never applied at all). This had no hover/
              // click feedback at all before (hover:bg was set to the
              // exact same value as the resting bg, which silently
              // canceled ghost's own hover:bg-muted instead of replacing
              // it with anything). active darkens further than hover so a
              // press still reads as a press even with the cursor sitting
              // in the hover state already; Button's own base class
              // already adds a 1px active:translate-y-px on top of this.
              className="relative size-[30px] rounded-lg bg-[var(--send-button-bg)] hover:bg-[var(--send-button-bg-hover)] active:bg-[var(--send-button-bg-active)] disabled:opacity-100"
            >
              <ArrowUpIcon className="absolute top-1/2 left-1/2 size-[14px] -translate-x-1/2 -translate-y-1/2 text-white" strokeWidth={2} />
            </Button>
          )}
        </div>
        </div>
      </div>
      {/* Attach + access mode (left group) / model + effort (right group),
          one row below the bordered box entirely (moved out of the
          toolbar row above, per explicit request), split into two groups
          matching Synara's own composer footer (a real reference app
          cloned for comparison, apps/web/src/components/ChatView.tsx:
          leading controls -- add/access-mode -- on the left with flex-1,
          trailing controls -- model/effort/mic/send -- on the right, the
          gap between them just `justify-between` rather than an explicit
          spacer), per explicit request ("the +, type of access for the
          AI, then space, model selector plus the dropdown and the option
          to add provider there, effort, mic and send"). mt-1.5: a little
          breathing room from the box's own border, not flush against it.
          Plus glyph, not the paperclip AttachmentIcon this used before --
          per explicit request to match dray's own attach button, which is
          a bare lucide Plus, not a paperclip. size-[28px], matching every
          trigger's own h-[28px] in this row -- all sized to dray's own
          toolbar convention (its attach button is size="icon-sm" = 28px,
          its model-selector trigger is size="sm" = h-7 = 28px, the same
          fixed height across its whole row) rather than the 26px this
          used before. */}
      <div className="mt-1.5 flex items-center justify-between gap-1">
      <div className="flex items-center gap-1">
        <BaseDropdownMenu size="compact">
          <BaseDropdownTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Add attachment"
                className="size-[28px] text-foreground hover:bg-hover-2/50"
              >
                {/* size-3.5 (14px), not size-4 (16px) -- per an app-wide
                    compact-scale audit: this button's own box already matches
                    the compact control token (28px), the icon inside hadn't
                    been stepped down to match yet. */}
                <PlusIcon className="size-3.5" />
              </Button>
            }
          />
          <BaseDropdownContent side="top" align="start" sideOffset={6} className="w-40 min-w-0">
            <BaseDropdownLabel>Add</BaseDropdownLabel>
            <DropdownSubItem className="text-[12px] whitespace-nowrap" onClick={openFilePicker}>
              <AttachmentIcon className="mr-2 inline size-3.5 shrink-0 align-[-3px]" />
              Files
            </DropdownSubItem>
            <DropdownSubItem className="text-[12px] whitespace-nowrap" disabled>
              <SkillIcon className="mr-2 inline size-3.5 shrink-0 align-[-3px]" />
              Skills
              <span className="ml-1.5 shrink-0 rounded-[4px] bg-hover-2 px-1 py-0.5 text-[10px] font-normal text-muted-foreground">
                Soon
              </span>
            </DropdownSubItem>
          </BaseDropdownContent>
        </BaseDropdownMenu>
        <BaseDropdownMenu
          size="compact"
          onOpenChange={(nowOpen) => {
            if (nowOpen) {
              // Real fix, confirmed directly ("when i click at models
              // after edit, the active hover is at gpt terra and not at
              // the model the message selected before"): DropdownSubItem
              // rows don't use the checkedIndex/proximity-hover system at
              // all (that component's own top comment says so directly --
              // a checkedIndex prop here would've been a silent no-op),
              // they use Base UI's native highlight, which follows real
              // DOM focus. rAF: the popup's own rows haven't mounted yet
              // in this same tick the menu opens in.
              requestAnimationFrame(() => {
                const value = selectedModels[0]?.value;
                if (value) modelRowRefs.current.get(value)?.focus();
              });
              return;
            }
            const button = modelTriggerRef.current;
            if (!button) return;
            const reblur = () => button.blur();
            button.addEventListener("focus", reblur, { once: true });
            setTimeout(() => button.removeEventListener("focus", reblur), 1000);
          }}
        >
          <BaseDropdownTrigger
            render={
            <Button
              ref={modelTriggerRef}
              variant="ghost"
              size="sm"
              // whitespace-nowrap + max-w-[160px] truncate: without a
              // nowrap guard, this label wrapped letter-by-letter (flex
              // items don't get a natural min-width from text alone).
              // 160px (was 140px -- bumped once the default label became
              // "Select your model", a few chars longer) -- the cap should
              // only ever bite once a real model name is long enough to
              // need it, not the default label itself. No @max-[300px]
              // icon-only collapse any more -- that existed to share a
              // cramped line with mic/send inside the box; out here on its
              // own row, this trigger has the box's own full width to
              // itself.
              className="t-input h-[28px] max-w-[160px] min-w-0 pr-1 pl-1.5 text-xs font-normal text-foreground hover:bg-hover-2/50 aria-expanded:bg-hover-2/50"
            >
              {/* size-3.5 (14px), not size-4 (16px) -- per an app-wide
                  compact-scale audit: this trigger's own h-[28px] already
                  matches the compact control token, the icon hadn't been
                  stepped down to match yet. */}
              {selectedModels.length === 1 && <ProviderIcon model={selectedModels[0]} className="size-3.5 shrink-0" />}
              <span className="truncate whitespace-nowrap">{modelSelectionLabel(selectedModels)}</span>
              <ChevronDownIcon className="size-3.5 shrink-0" />
            </Button>
            }
          />
          {/* border + shadow-sm, not this component's own default
              shadow-md ring-1 ring-foreground/10 -- same thin-border,
              soft-shadow treatment the inline / menu above uses, so the
              two menus in this composer read as one family. side="top",
              align="start" -- this trigger now sits at the very bottom of
              the whole composer, so the menu has to open upward to stay
              on screen (same reasoning the inline / menu itself already
              uses -- see that menu's own top-level comment), and left-
              aligned under a left-aligned trigger instead of the old
              align="end" (which matched this being the *right*-most
              item in its old row -- no longer true out here on its own,
              left-aligned row). */}
          {/* p-1 on both this and DropdownMenuSubContent below: this
              component's own default rows have no inset padding, so
              their focus:bg-hover-accent highlight spans the popover's
              full edge-to-edge width/height -- p-1 plus each row's own
              rounded-[7px] + bg-hover-2/50 (overriding the default
              focus:bg-hover-accent) below matches the inset, rounded
              row-hover the +/@// menu and nav-user.tsx's own dropdown
              already use. No more hardcoded border/shadow-sm/ring-0 --
              per explicit request ("switch from hardcoded code to the
              drop its own background"): the base DropdownMenuContent
              (ui/dropdown-menu.tsx) now supplies a real nesting-aware
              surface background/shadow itself (lib/surface-context.tsx),
              so a per-callsite override here just fought it for no
              reason. */}
          <BaseDropdownContent
            side="top"
            align="start"
            sideOffset={6}
            className="w-40 min-w-0"
          >
            {/* Was one Radix RadioGroup wrapping every provider's own
                submenu (a single value/onValueChange covering the whole
                provider > model tree). Each provider row here is its own
                DropdownSubMenuItem (ui/dropdown.tsx) with its own
                independent submenu popup, so selection is handled
                directly via each model row's own onSelect instead of a
                shared RadioGroup value -- providerIndex only needs to be
                unique for this *parent* dropdown's own proximity/keyboard
                order, not shared with anything inside the submenus. */}
            {/* Flattened to a single "Models" list, no per-provider submenu
                layer -- per explicit request ("I still see provider when
                I click at Model, we should see Models"): a Provider row
                (DropdownSubMenuItem) and a Model row (DropdownSubItem)
                never actually rendered at identical heights despite
                several attempts to reconcile their two independent class
                lists, so the provider tier is gone rather than patched
                again. DropdownSubItem's own comment already notes it works
                directly under "any raw Menu.Popup", not only nested inside
                a DropdownSubMenuItem's own submenu -- exactly what's used
                here now. */}
            <BaseDropdownLabel>Models</BaseDropdownLabel>
            {/* Capped at 6 rows (6 * h-7 = 168px), scrolling beyond that --
                same cap-then-scroll treatment as the notifications list
                (nav-user.tsx's own max-h-[208px] for 4 * 52px rows), per
                explicit request ("this is the maximum size we should have
                for models, once we reach more than 6 then we should get a
                scrollbar like we do in notifications"). */}
            {/* overflow-hidden on this outer wrapper, width/padding pushing
                the inner scroll container's own right edge (and whatever
                native scrollbar renders there) past it -- real bug,
                confirmed directly ("we still getting two scrollbars, it
                looks like when it goes active it places another scrollbar
                on top"): this app's own Tauri shell is WKWebView on macOS,
                and its OS-drawn overlay scrollbar (System Settings ->
                Appearance -> "Show scroll bars: When scrolling"/
                "Automatically") is a native AppKit NSScroller overlay, not
                the CSS scrollbar-styling API's own "classic" scrollbar --
                scrollbar-width:none/::-webkit-scrollbar{{display:none}}
                (still kept below) only suppress the latter, so that native
                overlay could still appear on top of the real custom thumb
                the instant an actual scroll gesture activates it. Widening
                the inner container past its own clipped parent physically
                moves wherever that native overlay draws itself (always at
                the scrollable element's own right edge) outside the
                visible area entirely, regardless of which hiding API the
                OS/WebKit version actually honors. */}
            <div className="relative overflow-hidden">
            <div
              ref={modelListRefCallback}
              onScroll={updateModelScrollThumb}
              // overscroll-y-contain -- per explicit request/screenshot
              // ("when scrolling up and down that reaches the boundary and
              // make the top or bottom which are rounded flatten before
              // moving back"): macOS's own rubber-band/elastic overscroll
              // lets the content bounce past its real top/bottom edge for a
              // moment, which pushed a square-cornered row past this
              // panel's own rounded clip and read as the corner briefly
              // "flattening". overscroll-behavior stops the scroll dead at
              // the real boundary instead of letting it bounce past, so
              // there's never a past-the-edge frame to clip oddly in the
              // first place.
              className="max-h-[168px] w-[calc(100%+20px)] overflow-y-auto overscroll-y-contain pr-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
            {/* Sorted by provider's own display name (MODEL_PROVIDERS'
                own comparator above), not QUICK_CHAT_MODELS' raw
                declaration order -- confirmed directly as a real bug
                ("the provider dropdown is not alphabetical, Claude models
                are showing first than ChatGPT ones"): flattening this
                list (this block's own comment above has the full history)
                dropped the provider-grouping tier MODEL_PROVIDERS was
                originally sorted for, so this flat list kept iterating
                QUICK_CHAT_MODELS in its own file order (Claude declared
                first) regardless. .sort() is stable, so models within the
                same provider keep their existing relative order -- only
                which provider's models come first changes. Model rows
                themselves stay unprefixed (just the model's own name),
                per explicit follow-up ("just the name of model, don't
                need to include the provider"). */}
            {sortedModelRows.map((m) => {
              const isSelected = selectedModels[0]?.value === m.value;
              return (
                <DropdownSubItem
                  key={m.value}
                  ref={(el) => {
                    if (el) modelRowRefs.current.set(m.value, el);
                    else modelRowRefs.current.delete(m.value);
                  }}
                  // pr-11, not pr-9 -- per explicit request ("increase the
                  // space/padding right when the row finishes as the three
                  // dots is almost behind the scrollbar now"): the custom
                  // scroll thumb (this list's own comment above) sits right
                  // at the panel's edge, and pr-9's own reserved space no
                  // longer left enough breathing room between it and the
                  // "..." trigger just inside it.
                  className={cn(
                    "group/model-row relative py-1.5 pr-11 pl-2.5 text-[12px] whitespace-nowrap",
                    isSelected && "bg-hover-2"
                  )}
                  onClick={() => selectModel(m)}
                >
                  <ProviderIcon model={m} className="mr-2 inline size-3.5 shrink-0 align-[-3px]" />
                  {modelDisplayName(m)}
                  {/* Set as default -- per explicit request ("the three
                      dots should show the options to set as default, i
                      don't mind that this is the only option at the
                      dropdown of the three dots"): a real menu (one real
                      item today), not a direct click-to-set action.
                      DropdownRowActionMenu (ui/dropdown.tsx) is a self-
                      contained popover, not a Base UI Menu primitive --
                      two Menu-based attempts before this one each broke
                      differently (an independent Menu.Root wasn't
                      recognized by the ancestor submenu's own outside-
                      interaction bookkeeping and closed the whole chain on
                      click; a real nested Menu.SubmenuRoot fought the
                      row's own hover-intent and closed the instant the
                      cursor moved off the "..." button toward its own
                      content) -- see that component's own comment for the
                      full history. DropdownRowActionItem, not
                      DropdownSubItem, for the same reason: this popover
                      isn't a Menu.Popup, so Menu.Item has no Menu.Root/
                      SubmenuRoot context to attach to. */}
                  <DropdownRowActionMenu
                    triggerLabel={`Options for ${modelDisplayName(m)}`}
                    // Same shared MoreTrigger every "..." in the app now
                    // renders through (ui/more-trigger.tsx), color-only
                    // (no bg) per explicit request -- DropdownRowActionMenu
                    // itself now owns rendering it, describer included
                    // ("make sure that the reusable three dots contains
                    // the dropdown as well"). autoHide off: this row's own
                    // group is named ("group/model-row", avoiding collision
                    // with an ancestor's own unnamed "group"), so the real
                    // visibility rule is passed through triggerClassName
                    // instead of MoreTrigger's own default unnamed rule.
                    autoHide={false}
                    triggerClassName="absolute top-1/2 right-3 -translate-y-1/2 opacity-0 transition-opacity group-hover/model-row:opacity-100"
                  >
                    <DropdownRowActionItem
                      className="py-1.5 pr-2.5 pl-2.5 text-[12px] whitespace-nowrap"
                      onClick={() => void setAsDefaultModel(m)}
                    >
                      {chatId ? "Set as default for this chat" : "Set as default for new chat"}
                    </DropdownRowActionItem>
                  </DropdownRowActionMenu>
                </DropdownSubItem>
              );
            })}
            </div>
            <div
              ref={modelThumbRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-0.5 hidden w-1 rounded-full bg-[color:rgb(var(--overlay)/0.3)]"
            />
            </div>
            {/* Add provider -- matches Synara's own model picker (a real
                reference app cloned for comparison, apps/web/src/
                components/chat/ProviderModelPicker.tsx: a footer MenuItem
                after a separator, navigating to Settings' Providers
                section), per explicit request ("model selector plus the
                dropdown and the option to add provider there"). Same
                onOpenSettings("provider") mechanism WelcomePage.tsx's own
                Initial setup row already uses -- threaded down from
                HomePage.tsx/ChatPage.tsx via AppLayout's own outlet
                context. */}
            <DropdownSeparator />
            {/* DropdownSubItem, not BaseMenuItem -- BaseMenuItem tracks the
                mouse via the proximity-hover system (registerItem/
                activeIndex), which always highlights the *nearest*
                registered proximity item to the cursor. With every model
                row above now a DropdownSubItem (Base UI's own
                data-highlighted, not proximity-tracked), this was the only
                proximity item left in the whole popup, so it was "nearest"
                no matter where the mouse actually was, lighting up
                alongside whichever model row Base UI itself highlighted. */}
            <DropdownSubItem
              className="flex items-center gap-2 py-1.5 pr-2.5 pl-2.5 text-[12px] whitespace-nowrap text-foreground"
              onClick={() => onOpenSettings?.()}
            >
              <PlusIcon className="size-3.5 shrink-0" />
              Add model
            </DropdownSubItem>
          </BaseDropdownContent>
        </BaseDropdownMenu>
        {/* Moved here from its own separate spot next to Effort, per explicit
            request ("move context to the right side of the model name"). */}
        {contextUsage && (
          <ContextDropdown
            used={contextUsage.used}
            model={selectedModels[0]}
            modelCount={selectedModels.length}
            onCompactNow={onCompactNow}
            autocompactValue={autocompactValue}
            autocompactScope={autocompactScope}
            onSetAutocompact={onSetAutocompact}
          />
        )}
      </div>
      <div className="flex items-center gap-1">
        {/* Manual / Plan / Auto -- how the agent asks before acting
            ("type of access for the AI", matching Synara's own
            RuntimeUsageControls: approval-required/auto/full-access, the
            same underlying concept). In the trailing group, next to Effort
            -- swapped with the model selector's own old spot here per
            explicit request ("Switch the buttons location Permission
            should go where models are and models should go where
            permission are"). Only rendered
            once a model is actually selected (selectedModels.length > 0)
            -- per explicit request, since which stances even exist
            depends on the provider (e.g. GitHub Copilot has its own "Ask"
            stance, not necessarily this same three-item set), so there's
            nothing real to offer here until a specific model -- and so a
            specific provider -- has been picked. Same ghost-trigger
            treatment as the model picker (h-[28px], same text size),
            single-select RadioGroup same as that menu, no submenu needed
            since there's no provider-style grouping here. Defaults to
            "manual" (state above) -- the safest stance, so a session
            opens asking before every action rather than something more
            permissive. */}
        {hasModel && (
        <div className={`transition-opacity duration-300 ${modeVisible ? "opacity-100" : "opacity-0"}`}>
        {/* size="compact" -- matches the app's own 28px row height
            everywhere else (BaseMenuItem's own useSize() would otherwise
            default to the reference's 36px "default" step). */}
        <BaseDropdownMenu
          size="compact"
          onOpenChange={(nowOpen) => {
            if (!nowOpen) {
              const button = modeTriggerRef.current;
              if (!button) return;
              const reblur = () => button.blur();
              button.addEventListener("focus", reblur, { once: true });
              setTimeout(() => button.removeEventListener("focus", reblur), 1000);
            }
          }}
        >
          <BaseDropdownTrigger
            render={
              <Button
                ref={modeTriggerRef}
                variant="ghost"
                size="sm"
                className="h-[28px] px-1.5 text-xs font-normal text-foreground hover:bg-hover-2/50 aria-expanded:bg-hover-2/50"
              >
                {modes.find((m) => m.value === mode)?.label}
                <ChevronDownIcon className="size-3.5 shrink-0" />
              </Button>
            }
          />
          {/* DropdownSubItem, not BaseMenuItem -- per explicit request ("do
              a quick description like Synara's one does but without the
              icon"), each row needs a second, smaller description line
              under its label (Synara's own RuntimeModeMenuItem,
              BranchToolbar.tsx: icon + stacked label/description grid --
              same stacked label/description here, just without the icon
              column, per "without the icon"), which BaseMenuItem's own
              fixed single-line layout can't fit. Manual checkmark, not a
              real radio role -- same reasoning as the model/effort rows'
              own comments. No hardcoded border/shadow-sm/ring-0 --
              BaseDropdownContent's own Elevated surface supplies a real
              nesting-aware background/shadow. */}
          <BaseDropdownContent
            side="top"
            align="start"
            sideOffset={6}
            className="w-40 min-w-0"
          >
            {/* "Permission" describer -- matching the Provider/Model/Effort
                describer pattern elsewhere in this toolbar. Claude Code's
                own CLI calls this exact concept "permission mode"
                (--permission-mode), the primary provider here, so that term
                over Synara's own "runtime mode" naming. */}
            <BaseDropdownLabel>Permission</BaseDropdownLabel>
            {modes.map((m) => (
              <DropdownSubItem
                key={m.value}
                // bg-hover-2/50 when selected, not a trailing checkmark --
                // per explicit request ("the models and permissions still
                // have the icon for check but should have the bg active
                // like effort"), matching Provider/Model/Effort's own
                // isSelected treatment above.
                className={cn(
                  "h-auto flex-col items-start gap-0.5 py-1.5 pr-2.5 pl-2.5 text-[12px]",
                  m.value === mode && "bg-hover-2"
                )}
                onClick={() => {
                  setMode(m.value);
                  saveLastPermissionMode(m.value);
                }}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span>{m.label}</span>
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">{m.description}</span>
              </DropdownSubItem>
            ))}
          </BaseDropdownContent>
        </BaseDropdownMenu>
        </div>
        )}
        {/* Effort -- now its own standalone trigger+dropdown next to the
            model selector, matching Synara's own split layout (a real
            reference app cloned for comparison: ProviderModelPicker +
            TraitsPicker side by side for a fresh draft thread,
            apps/web/src/components/ChatView.tsx), per explicit request
            ("model selector plus the dropdown... effort, mic and send" --
            effort called out as its own step, and a follow-up choice
            confirming a separate button over keeping it nested in the
            model dropdown). Unlike the access-mode picker in the leading
            group, NOT gated on hasModel -- EFFORT_LEVELS is a fixed set
            regardless of provider (unlike the access-mode picker's own
            provider-dependent stance set), and gating this on hasModel
            made it vanish entirely once the compose box stopped
            pre-selecting a default model, confirmed directly as a real
            regression ("Effort is missing from the tool row"). */}
        <BaseDropdownMenu
          size="compact"
          onOpenChange={(nowOpen) => {
            if (!nowOpen) {
              const button = effortTriggerRef.current;
              if (!button) return;
              const reblur = () => button.blur();
              button.addEventListener("focus", reblur, { once: true });
              setTimeout(() => button.removeEventListener("focus", reblur), 1000);
            }
          }}
        >
          <BaseDropdownTrigger
            render={
              <Button
                ref={effortTriggerRef}
                variant="ghost"
                size="sm"
                className="h-[28px] px-1.5 text-xs font-normal text-foreground hover:bg-hover-2/50 aria-expanded:bg-hover-2/50"
              >
                {/* Shows the current choice (e.g. "Low"), not a static
                    "Effort" label -- per explicit request ("it should
                    update from effort to the choice we did"). */}
                {EFFORT_LABELS[effort]}
                <ChevronDownIcon className="size-3.5 shrink-0" />
              </Button>
            }
          />
          <BaseDropdownContent side="top" align="end" sideOffset={6} className="w-56 min-w-0 p-3">
            <EffortSliderPanel
              effort={effort}
              onChange={(level) => {
                effortTouchedRef.current = true;
                setEffort(level);
                saveLastEffort(level);
              }}
            />
          </BaseDropdownContent>
        </BaseDropdownMenu>
      </div>
    </div>
    </div>
  );
}
