import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";
import { ComposeBox, toImageInputs, type ImageAttachment } from "@/components/compose-box";
import { type EffortLevel } from "@/lib/effort";
import { WorkspaceBrandIcon } from "@/components/design-system/workspace-brand-icon";
import type { SettingsSection } from "@/components/settings-overlay";
import { getUserDisplayName } from "@/lib/user";

// Real port of frontend/index.html's "start a new chat" compose box --
// frontend/ is superseded now that the sidebar/auth shell lives here (see
// Story 4.14, github.com/alongsidedotrun/alongside/issues/92), so this is the one place that
// flow should exist going forward, not a second copy kept in sync. Same
// backend endpoints (POST /sessions, then POST /sessions/{id}/messages)
// and the same alongside_api_key/alongside_user_name localStorage keys -- there's
// still no real Settings UI to set the API key from inside this app, that
// gap already exists independent of this page.
export type HomePageShellContext = {
  openSettings: (section: SettingsSection) => void;
  workspaceName?: string;
};

type HomePageProps = {
  /** Allows the redesign to reuse New Chat inside its own shell. */
  shellContextOverride?: HomePageShellContext;
  onSessionCreated?: (sessionId: string) => void;
};

export function HomePage({ shellContextOverride, onSessionCreated }: HomePageProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const { openSettings, workspaceName = t("home.defaultWorkspaceName") } = shellContextOverride ?? outletContext;
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [transitioningToChat, setTransitioningToChat] = useState(false);
  const handoffTimerRef = useRef<number | null>(null);
  // ComposeBox owns which models are selected (supports multi-select /
  // "Model fusion"); this just mirrors the current selection so
  // createSession can read it without lifting all of ComposeBox's state up.
  // Starts empty -- ComposeBox itself defaults to no model selected
  // ("Select model") until defaultModel (below) resolves, at which point
  // ComposeBox's own defaultModelValue re-sync effect picks it up.
  const selectedModelsRef = useRef<typeof QUICK_CHAT_MODELS>([]);
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
  // Real bug, confirmed directly ("the context is showing at new chat, that should
  // fade in only after the chat is created"): this used to seed contextUsage from
  // the last known value (last-used.ts), which is real data but from a DIFFERENT,
  // already-existing chat -- showing it here, before this brand-new chat has even
  // been created, implied it already had real usage it doesn't have yet. HomePage's
  // own compose box never shows the Context indicator at all now (always null);
  // ChatPage.tsx picks up the real per-chat value the moment a chat actually exists.
  const contextUsage = null;

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
  async function createSession(images: ImageAttachment[], effort: EffortLevel) {
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
    try {
      const apiKey = localStorage.getItem("alongside_api_key") ?? "";
      // Only the first selected model actually starts the session --
      // real multi-model "fusion" sessions aren't a thing the backend
      // supports yet, so a multi-select just picks which one leads today.
      const res = await fetch("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, model: model.value }),
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
          ? fetch(`/sessions/${data.session_id}/default-model`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: pinnedDefaultModelRef.current, sender_name: senderName }),
            })
          : undefined,
        pinnedDefaultEffortRef.current
          ? fetch(`/sessions/${data.session_id}/default-effort`, {
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
          ? fetch(`/sessions/${data.session_id}/project`, {
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
          navigate(`/chat/${data.session_id}`);
        }
      }, 520);
      return;
    } finally {
      if (handoffTimerRef.current === null) setSending(false);
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-background @container">
      <div
        className={`absolute inset-x-0 z-10 px-3 pb-4 transition-[top,transform] duration-500 ease-in-out sm:px-5 ${transitioningToChat ? "top-full -translate-y-full" : "top-1/2 -translate-y-1/2"}`}
      >
        <div className="t-chat-width mx-auto w-full" style={{ maxWidth: "var(--chat-max-width)" }}>
          {/* Heading scales with the page's own width (the @container above):
              full size at a ~1000px content area, clamped down to 15px text /
              a 20px icon at ~450px. Icon size rounds to even pixels so the
              brand tile stays crisp; the name truncates rather than spill. */}
          <div
            className={`flex items-center justify-center gap-[clamp(6px,calc(4.36px+0.364cqw),8px)] overflow-hidden text-center transition-[max-height,margin,transform] duration-200 ${transitioningToChat ? "pointer-events-none invisible mb-0 max-h-0 -translate-y-2" : "mb-5 max-h-8 translate-y-0"}`}
          >
            <h1 className="shrink-0 text-[length:clamp(15px,calc(12.55px+0.545cqw),18px)] font-normal text-foreground">{t("home.workspacePrompt")}</h1>
            <WorkspaceBrandIcon size={24} monochrome invertOnLight className="size-[round(clamp(20px,calc(16.73px+0.727cqw),24px),2px)]" />
            <span className="min-w-0 truncate text-[length:clamp(15px,calc(12.55px+0.545cqw),18px)] font-medium text-foreground">{workspaceName}</span>
          </div>
        <ComposeBox
          value={prompt}
          onChange={setPrompt}
          onSubmit={createSession}
          initialHeight={!transitioningToChat}
          contextUsage={contextUsage}
          // ContextDropdown never actually renders here (contextUsage is always null
          // pre-chat), so these two are dead props in practice -- kept simple, static
          // values just to satisfy ComposeBox's required prop types rather than
          // making them optional there for the sake of this one non-using caller.
          autocompactValue="500000"
          autocompactScope="chat"
          onSetAutocompact={() => {}}
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
            t("home.placeholderCycle.mention"),
            t("home.placeholderCycle.slash"),
          ]}
          onModelsChange={(models) => {
            selectedModelsRef.current = models;
          }}
        />
        </div>
      </div>
    </div>
  );
}
