import { useEffect, useId, useRef, useState } from "react";
import { clearDraft, HOME_DRAFT_KEY, readDraft, saveDraft } from "@/lib/compose-drafts";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { ShapeProvider } from "@/lib/shape-context";
import { checkDraft, EMPTY_DRAFT, showAddError, type BotDraft } from "@/components/new-agent-dialog";
import { BotEyesPicker, BotSwatches } from "@/components/bot-avatar-picker";
import { ShellDialogActions, ShellField, ShellPage, SHELL_CARD_BOX, SHELL_FIELD_INPUT } from "@/components/design-system/shell-dialog";
import { BotFace, randomBotAvatar } from "@/components/bot-face";
import { createBot, type Bot } from "@/lib/bots";
import { useBotMood } from "@/components/bot-face";
import { fade } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { ProviderGate } from "@/components/provider-gate";
import { QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";
import { useLimitWarning } from "@/components/limit-warning";
import { ComposeBox, toImageInputs, type ImageAttachment } from "@/components/compose-box";
import { type EffortLevel } from "@/lib/effort";
import { WorkspaceBrandIcon, workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import type { SettingsSection } from "@/components/settings-overlay";
import { getUserDisplayName } from "@/lib/user";
import type { PermissionMode } from "@/lib/last-used";
import { CHATS_API } from "@/lib/chats-api";

// Real port of frontend/index.html's "start a new chat" compose box --
// frontend/ is superseded now that the sidebar/auth shell lives here (see
// Story 4.14, github.com/alongsidedotrun/alongside/issues/92), so this is the one place that
// flow should exist going forward, not a second copy kept in sync. Same
// backend endpoints (POST /chats, then POST /chats/{id}/messages)
// and the same alongside_api_key/alongside_user_name localStorage keys -- there's
// still no real Settings UI to set the API key from inside this app, that
// gap already exists independent of this page.
export type HomePageShellContext = {
  openSettings: (section: SettingsSection) => void;
  workspaceId?: string;
  workspaceName?: string;
  // The current workspace's uploaded logo and letter-tile colour, so the
  // heading shows the same tile as the sidebar.
  workspaceLogo?: string | null;
  workspaceColor?: number | null;
  /** #504: a bot made on this page, to open its chat. */
  onBotCreated?: (bot: Bot) => void;
  /** Whether a provider is connected (null: not known yet). With none, the page asks to connect one. */
  providerReady?: boolean | null;
};

type HomePageProps = {
  /** Allows the redesign to reuse New Chat inside its own shell. */
  shellContextOverride?: HomePageShellContext;
  onSessionCreated?: (sessionId: string) => void;
  /** #504: a bot made here, to open its chat. */
  onBotCreated?: (bot: Bot) => void;
};

// Same pill segmented control as Settings > Skills.

export function HomePage({ shellContextOverride, onSessionCreated, onBotCreated }: HomePageProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // New (#504): a chat, or a bot (?new=bot, as the sidebar's Bots "+" opens it).
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: "chat" | "bot" = searchParams.get("new") === "bot" ? "bot" : "chat";
  // Set when this page was reached via a project row's own "+" (sidebar-nav.tsx) --
  // per explicit request ("we should get an + beside the > at projects to create a
  // chat inside the project"). There's no real session to assign a project_id to
  // until createSession (below) actually creates one, so the intent rides in
  // navigation state until then, the same way pinnedDefaultModelRef/
  // pinnedDefaultEffortRef already carry a pre-session pick forward.
  const location = useLocation();
  const pendingProjectId = (location.state as { projectId?: string } | null)?.projectId;
  // Set when this page was reached via SidebarSearch's own "Model" result
  // row -- carries the picked model forward the same way pendingProjectId
  // (above) already does for a project's own "+", so ComposeBox opens with
  // that model preselected instead of falling back to the fetched default.
  const pendingModel = (location.state as { selectedModel?: string } | null)?.selectedModel;
  // AppLayout's own outlet context (useOutlet({ ..., openSettings, ... })) --
  // same mechanism WelcomePage.tsx's own Initial setup row already uses to
  // open the real SettingsOverlay modal directly, threaded down to
  // ComposeBox's own "Add provider" row.
  const outletContext = useOutletContext<HomePageShellContext>();
  const shellContext = shellContextOverride ?? outletContext;
  const { openSettings, workspaceId, workspaceName = t("home.defaultWorkspaceName"), workspaceLogo = null, workspaceColor = null } = shellContextOverride ?? outletContext;
  const workspaceTile = workspaceMonogram(workspaceName, workspaceColor);
  // Kept as a draft so leaving Home (Settings, a chat) doesn't lose it (#565).
  const [prompt, setPrompt] = useState(() => readDraft(HOME_DRAFT_KEY));
  const [sending, setSending] = useState(false);
  const [transitioningToChat, setTransitioningToChat] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState<string | null>(null);
  const [choosingDirectory, setChoosingDirectory] = useState(false);
  const handoffTimerRef = useRef<number | null>(null);
  // ComposeBox owns which models are selected (supports multi-select /
  // "Model fusion"); this just mirrors the current selection so
  // createSession can read it without lifting all of ComposeBox's state up.
  // Starts empty -- ComposeBox itself defaults to no model selected
  // ("Select model") until defaultModel (below) resolves, at which point
  // ComposeBox's own defaultModelValue re-sync effect picks it up.
  const selectedModelsRef = useRef<typeof QUICK_CHAT_MODELS>([]);
  // The selected model's provider, for the 5-hour limit warning on top of the composer.
  const [modelProvider, setModelProvider] = useState<string | null>(null);
  // Below the composer here: a new chat's composer sits mid-page.
  const limitWarning = useLimitWarning(modelProvider);
  // ComposeBox's own "Set as default for new chat" (compose-box.tsx's own
  // onPinDefaultModel/onPinDefaultEffort props) -- there's no chat yet for
  // that to write a real per-chat default to, so it lands here instead,
  // session-only (a plain ref, not persisted anywhere) until createSession
  // below actually creates the chat and applies it for real. Per explicit
  // request ("we should be able to create a chat by pre defining this
  // before per chat and not for every chat like in settings").
  const pinnedDefaultModelRef = useRef<string | undefined>(undefined);
  const pinnedDefaultEffortRef = useRef<EffortLevel | undefined>(undefined);
  // getUserDisplayName(), not a raw localStorage read with a hardcoded
  // "Alongside" fallback -- real bug, confirmed via screenshot (a guest's
  // very first message rendered left-aligned as someone else's, labeled
  // "Alongside" instead of "Me"): ChatPage.tsx's own isSelf check compares
  // a row's displayName against this exact function's own return value
  // ("Guest" when signed out with no name set yet), so a different literal
  // fallback here could never match it.
  const userName = getUserDisplayName();
  // FEATURES.md's "Default provider" -- which model a new chat's compose
  // box preselects. Settings -> Chats' own DefaultModelRow
  // (settings-overlay.tsx) is now the ONLY thing that writes GET/POST
  // /settings/default-model this reads -- compose-box.tsx's own "Set as
  // default" three-dot action no longer does (it's chat-scoped now, this
  // file's own pinnedDefaultModelRef comment above has the full reasoning).
  // undefined (not fetched yet) is a no-op for ComposeBox's own
  // defaultModelValue prop, same as it always was before this existed.
  const [defaultModel, setDefaultModel] = useState<string | undefined>(undefined);

  async function chooseWorkingDirectory() {
    if (choosingDirectory) return;
    setChoosingDirectory(true);
    try {
      const response = await fetch(`${CHATS_API}/working-directory/pick`, { method: "POST" });
      if (!response.ok) throw new Error(`Folder picker failed: ${response.status}`);
      const result: { path: string | null } = await response.json();
      if (result.path) setWorkingDirectory(result.path);
    } catch {
      window.alert(t("compose.folderPickerFailed"));
    } finally {
      setChoosingDirectory(false);
    }
  }

  useEffect(() => {
    document.title = t("home.title");
  }, [t]);

  useEffect(() => () => {
    if (handoffTimerRef.current !== null) window.clearTimeout(handoffTimerRef.current);
  }, []);

  useEffect(() => {
    if (pendingModel) {
      setDefaultModel(pendingModel);
      return;
    }
    let cancelled = false;
    fetch("/settings/default-model")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { model: string | null } | null) => {
        if (!cancelled && data?.model) setDefaultModel(data.model);
      });
    return () => {
      cancelled = true;
    };
  }, [pendingModel]);

  // effort read directly from compose-box.tsx's own onSubmit now (value-at-
  // submit-time, like images already worked), not a side-channel ref -- real
  // bug, confirmed directly: that ref (onEffortChange keeping it updated) could
  // read stale by the time this actually posted, reported as "I set Low, the
  // reply's own dial showed Medium".
  async function createSession(images: ImageAttachment[], effort: EffortLevel, permissionMode: PermissionMode) {
    const trimmed = prompt.trim();
    if (!trimmed || sending || transitioningToChat) return;
    // compose-box.tsx's own Send button/Enter handler already blocks
    // submitting without a model selected (shaking its model trigger
    // instead -- see that file's own triggerModelShake) -- createSession
    // is only ever reached once one is, so this is just a type-narrowing
    // guard, not a user-facing state.
    const model = selectedModelsRef.current[0];
    if (!model) return;
    setSending(true);
    // Cleared right away so the compose box fades the sent text out (its
    // own ghost) instead of holding it until the chat page swaps in.
    const sentPrompt = prompt;
    setPrompt("");
    clearDraft(HOME_DRAFT_KEY);
    try {
      const apiKey = localStorage.getItem("alongside_api_key") ?? "";
      // Only the first selected model actually starts the session --
      // real multi-model "fusion" sessions aren't a thing the backend
      // supports yet, so a multi-select just picks which one leads today.
      const res = await fetch(CHATS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          model: model.value,
          working_directory: workingDirectory,
          title_seed: sentPrompt,
          workspace_id: workspaceId,
        }),
      });
      if (!res.ok) {
        window.alert(t("home.createSessionFailed", { status: res.status }));
        return;
      }
      const data: { session_id: string } = await res.json();

      // Applies any "Set as default for new chat" pick (compose-box.tsx's
      // own onPinDefaultModel/onPinDefaultEffort) now that the chat this
      // was actually pinned for finally has a real id -- awaited, not
      // fire-and-forget, so it's genuinely set before ChatPage's own WS
      // connects and reads it back via "chat_defaults" (server.rs), rather
      // than racing that first read.
      const senderName = userName;
      await Promise.all([
        pinnedDefaultModelRef.current
          ? fetch(`${CHATS_API}/${data.session_id}/default-model`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: pinnedDefaultModelRef.current, sender_name: senderName }),
            })
          : undefined,
        pinnedDefaultEffortRef.current
          ? fetch(`${CHATS_API}/${data.session_id}/default-effort`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ effort: pinnedDefaultEffortRef.current, sender_name: senderName }),
            })
          : undefined,
        // Assigns this brand-new chat to whichever project's own "+" started
        // it (pendingProjectId, above) -- awaited alongside the pinned
        // model/effort calls for the same reason: real before ChatPage's own
        // WS connects, not a race.
        pendingProjectId
          ? fetch(`${CHATS_API}/${data.session_id}/project`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: pendingProjectId }),
            })
          : undefined,
      ]);

      // Real bug, confirmed directly via a session log: sending the first message
      // *before* navigating meant it (and often the whole reply -- turns as fast as
      // ~2s beat the navigation+WS-connect race easily) was already recorded before
      // ChatPage's own WebSocket ever subscribed, so it arrived there as replayed
      // history -- which deliberately suppresses both the waiting indicator and the
      // streaming reveal, since that same replay path is what stops every *old*
      // message from re-animating on every page load. Queuing it instead (read and
      // sent by ChatPage itself, once its own WS is confirmed connected --
      // replay_complete has fired) guarantees the send happens after subscription,
      // not before it, so the reply always arrives live.
      // model included directly (the value this session was actually just
      // created with above), not read back later from alongside_model_value --
      // real bug, confirmed directly ("I had Opus selected... after sending
      // the new chat that showed Switched to GPT-5.6"): that restore lived in
      // its own separate mount effect with different re-run timing than the
      // one that fires this queued send, so it could resend a stale/wrong
      // model on this very first message, which the backend then treated as
      // a deliberate switch.
      sessionStorage.setItem(
        "alongside_pending_message",
        JSON.stringify({
          sessionId: data.session_id,
          prompt: trimmed,
          senderName: userName,
          images: images.length > 0 ? toImageInputs(images) : undefined,
          effort,
          model: model.value,
          permissionMode,
        })
      );

      // Read by ChatPage on mount, both for the label shown above the
      // first agent reply and to preselect the same model in its own
      // compose box -- sessionStorage (not localStorage), same as the old
      // frontend/index.html -> chat.html handoff, since this is only
      // meaningful for the one chat being landed on right now.
      sessionStorage.setItem("alongside_model_label", model.label);
      sessionStorage.setItem("alongside_model_value", model.value);
      setTransitioningToChat(true);
      handoffTimerRef.current = window.setTimeout(() => {
        handoffTimerRef.current = null;
        setSending(false);
        if (onSessionCreated) {
          onSessionCreated(data.session_id);
        } else {
          // composeHandoff: the compose box has already slid to where the
          // chat page keeps it, so the shell swaps pages without its
          // fade-out/fade-in (RedesignPage's surface key).
          navigate(`/chat/${data.session_id}`, { state: { composeHandoff: true } });
        }
      }, 520);
      return;
    } finally {
      if (handoffTimerRef.current === null) {
        setSending(false);
        // Didn't get to the chat: the text comes back to try again.
        setPrompt((current) => {
          const restored = current || sentPrompt;
          saveDraft(HOME_DRAFT_KEY, restored);
          return restored;
        });
      }
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-background @container">
      {/* No provider yet: nothing here can run, so the page asks for one instead (Settings > Providers). */}
      {shellContext.providerReady === false && !transitioningToChat ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-3 sm:px-5">
          <ProviderGate onConnect={() => navigate("/settings/provider")} />
        </div>
      ) : (
      <>
      {!transitioningToChat && (
        <div className="absolute inset-x-0 top-5 z-20 flex justify-center">
          <ShapeProvider defaultShape="pill">
            <Tabs
              size="compact"
              value={mode}
              // newTab: the shell keeps the page (and these tabs) in place; only the form below fades.
              onValueChange={(next) => setSearchParams(next === "bot" ? { new: "bot" } : {}, { replace: true, state: { newTab: true } })}
            >
              <TabsList>
                <TabItem value="chat" label={t("new.chat")} />
                <TabItem value="bot" label={t("new.bot")} />
              </TabsList>
            </Tabs>
          </ShapeProvider>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {mode === "bot" ? (
          <motion.div
            key="bot"
            className="absolute inset-0 z-10 flex items-center justify-center px-3 sm:px-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: fade }}
            exit={{ opacity: 0, transition: fade }}
          >
            <NewBotForm onCreated={(bot) => (onBotCreated ?? shellContext.onBotCreated)?.(bot)} />
          </motion.div>
        ) : (
      <motion.div
        key="chat"
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: fade }}
        exit={{ opacity: 0, transition: fade }}
      >
      <div
        className={`absolute inset-x-0 z-10 px-3 pb-4 transition-[top,transform] duration-500 ease-in-out sm:px-5 ${transitioningToChat ? "top-full -translate-y-full" : "top-1/2 -translate-y-1/2"}`}
      >
        <div className="t-chat-width mx-auto w-full" style={{ maxWidth: "var(--chat-max-width)" }}>
          {/* Heading scales with the page's own width (the @container above):
              full size at a ~1000px content area, clamped down to 15px text /
              a 20px icon at ~450px. Icon size rounds to even pixels so the
              brand tile stays crisp; the name truncates rather than spill. */}
          <div
            className={`flex items-center justify-center gap-[clamp(6px,calc(4.36px+0.364cqw),8px)] overflow-hidden text-center transition-[max-height,margin,transform] duration-160 ${transitioningToChat ? "pointer-events-none invisible mb-0 max-h-0 -translate-y-2" : "mb-5 max-h-8 translate-y-0"}`}
          >
            <h1 className="shrink-0 text-[length:clamp(15px,calc(12.55px+0.545cqw),18px)] font-normal text-foreground">{t("home.workspacePrompt")}</h1>
            {/* The workspace's own tile: its logo, or its letter on its colour. */}
            <WorkspaceBrandIcon
              size={24}
              imageSrc={workspaceLogo ?? undefined}
              monogram={workspaceLogo ? undefined : workspaceTile ?? undefined}
              className="size-[round(clamp(20px,calc(16.73px+0.727cqw),24px),2px)]"
            />
            <span className="min-w-0 truncate text-[length:clamp(15px,calc(12.55px+0.545cqw),18px)] font-medium text-foreground">{workspaceName}</span>
          </div>
        <ComposeBox
          value={prompt}
          onChange={(value) => {
            setPrompt(value);
            saveDraft(HOME_DRAFT_KEY, value);
          }}
          onSubmit={createSession}
          initialHeight={!transitioningToChat}
          workFromFolderPath={workingDirectory}
          onSelectWorkFromFolder={chooseWorkingDirectory}
          defaultModelValue={defaultModel}
          onOpenSettings={() => openSettings("provider")}
          onPinDefaultModel={(value) => {
            pinnedDefaultModelRef.current = value;
          }}
          onPinDefaultEffort={(level) => {
            pinnedDefaultEffortRef.current = level;
          }}
          placeholder={t("home.composePlaceholder")}
          placeholderCycle={[
            t("home.placeholderCycle.multiplayer"),
            t("home.placeholderCycle.slash"),
          ]}
          onModelsChange={(models) => {
            selectedModelsRef.current = models;
            setModelProvider(models[0]?.provider ?? null);
          }}
          notice={limitWarning.notice}
        />
        </div>
      </div>
      </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}

/**
 * New > Bot (#504), in the same card as the other create pages (without the Alongside mark: the Chat | Bot
 * tabs are its header): its face on top (reacting as it's named),
 * its name and description, its look (colours, Randomise, Upload, expressions) in one box, then Reset and
 * Create. Creating it opens its chat; its instructions are given there.
 */
function NewBotForm({ onCreated }: { onCreated: (bot: Bot) => void }) {
  const { t } = useTranslation();
  // A new bot starts with a random colour (never the old default grey, so it never looks unset) and
  // face; Reset draws another.
  const fresh = (): BotDraft => ({ ...EMPTY_DRAFT, avatar: randomBotAvatar("#7A7A7A") });
  const [draft, setDraft] = useState<BotDraft>(fresh);
  const [startAvatar, setStartAvatar] = useState(draft.avatar);
  const [busy, setBusy] = useState(false);
  const { name, ready } = checkDraft(draft, "bot");
  // The bot reacts as it's made: happy while it's named and described.
  const [mood, react] = useBotMood();
  const formId = useId();
  const nameId = useId();
  const descriptionId = useId();
  // A new look (colour, expression, Randomise) shows at once, as it will rest: no reaction over it.
  const setAvatar = (avatar: BotDraft["avatar"]) => {
    react("default");
    setDraft({ ...draft, avatar });
  };
  const untouched = !draft.name && !draft.description && draft.avatar === startAvatar;
  return (
    <ShellPage
      open
      onOpenChange={() => {}}
      brand={false}
      icon={<BotFace avatar={draft.avatar} expression={mood} animated className="size-12" />}
      // The bot as it's made: its name and description replace the heading as they're typed.
      title={<span className="break-all">{draft.name.trim() || t("bots.new")}</span>}
      description={<span className="line-clamp-2 break-words">{draft.description.trim() || t("bots.subtitle")}</span>}
      actions={
        <ShellDialogActions
          cancelLabel={t("bots.reset")}
          cancelDisabled={busy || untouched}
          onCancel={() => {
            const next = fresh();
            setDraft(next);
            setStartAvatar(next.avatar);
            react("default");
          }}
          primary={{ label: t("bots.createShort"), type: "submit", form: formId, disabled: !ready || busy, loading: busy }}
        />
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-2.5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!ready || busy) return;
          setBusy(true);
          const result = await createBot(name, draft.instructions.trim(), draft.avatar, draft.description.trim());
          setBusy(false);
          // Errors show in the app's toast, top middle.
          if ("reason" in result) showAddError(t, result, "bot");
          else onCreated(result);
        }}
      >
        <ShellField label={t("agents.fields.name")} htmlFor={nameId}>
          <input
            id={nameId}
            autoFocus
            value={draft.name}
            onChange={(event) => {
              setDraft({ ...draft, name: event.target.value });
              react("happy");
            }}
            maxLength={33}
            className={SHELL_FIELD_INPUT}
          />
        </ShellField>
        <ShellField label={t("bots.fields.description")} htmlFor={descriptionId}>
          <input
            id={descriptionId}
            value={draft.description}
            onChange={(event) => {
              setDraft({ ...draft, description: event.target.value });
              react("happy");
            }}
            maxLength={300}
            className={SHELL_FIELD_INPUT}
          />
        </ShellField>
        {/* Its look in one box: colours (with Randomise and Upload), then expressions. */}
        <section className={cn("flex flex-col items-center gap-2.5 px-4 pt-2.5 pb-3", SHELL_CARD_BOX)}>
          <span className="self-start text-ui-sm text-muted-foreground">{t("bots.look")}</span>
          <BotSwatches value={draft.avatar} onChange={setAvatar} withUpload />
          <BotEyesPicker value={draft.avatar} onChange={setAvatar} />
        </section>
      </form>
    </ShellPage>
  );
}

