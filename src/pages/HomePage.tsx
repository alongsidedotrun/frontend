import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";
import { ComposeBox, toImageInputs, type ImageAttachment } from "@/components/compose-box";
import { type EffortLevel } from "@/lib/effort";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
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
  const { openSettings } = shellContextOverride ?? outletContext;
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
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
    if (!trimmed || sending) return;
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
      if (onSessionCreated) {
        onSessionCreated(data.session_id);
      } else {
        navigate(`/chat/${data.session_id}`);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    // @container: makes the compose box's own width tiers react to THIS
    // box's own actual rendered width instead of the browser viewport.
    <div className="relative flex flex-1 flex-col overflow-hidden @container">
      {/* Heading + subheading -- real vertical centering now, but within
          the space *above* the compose box specifically, not the page's
          full height (which visually includes the box's own footprint at
          the bottom) -- per explicit request ("centralised to the page...
          compared to the compose box", the previous fixed pt-[210px]
          guess wasn't actually centered relative to where the box sits).
          bottom-[104px] (104 = the compose box's own real height, ~54px,
          + its attach/model/context row just below it, ~34px, + this
          page's own pb-4 bottom inset, 16px -- see compose-box.tsx and
          this file's own wrapper below) on this container instead of
          inset-0 is what actually shrinks the *real* height percentages
          resolve against for the absolutely-positioned children below;
          padding-bottom on an inset-0 container does NOT do this --
          padding doesn't change a flex-sized box's own outer height, so a
          child's `top: 50%` still measured against the *full* page height
          regardless (confirmed: that's why the previous pt-[210px]
          attempt needed a hand-guessed constant instead of just centering
          in the first place).
          Only the logo itself is centered here (top-1/2/-translate-y-1/2)
          -- not the whole heading+subheading block. WelcomePage's own
          content below its own logo is much taller (5 menu rows + footer
          vs. this page's 2 short lines), so centering each page's *whole*
          block by its own midpoint landed the two logos at different Y
          positions regardless of matching containers. Centering only the
          shared element (the logo) and positioning everything after it
          via an explicit `top: calc(50% + ...)` offset (not part of the
          centering) is what keeps both pages' logos pinned to the exact
          same real, viewport-responsive Y regardless of what each page
          shows below it -- WelcomePage.tsx uses this identical pattern. */}
      <div className="absolute inset-x-0 top-0 bottom-[104px] px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <AlongsideLogo className="size-[32px] text-black dark:text-white" />
        </div>
        {/* calc(50% + 16px + 12px): 16 = half the logo's own 32px height
            (clearing its circle), 12 = the mb-3 gap this heading used to
            carry to the logo directly above it -- now expressed as a top
            offset since this block is no longer a flex sibling of the
            logo. Reverted back off a brief fixed-top-offset experiment
            (tried to match WelcomePage.tsx's own Y) -- per explicit
            request ("revert new chat and inbox to keep the heading and
            icon at the middle as i prefer how that looks and accept that
            we won't be able to match getting started"). */}
        <div
          className="absolute left-1/2 w-full max-w-[22rem] -translate-x-1/2 text-center"
          style={{ top: "calc(50% + 16px + 12px)" }}
        >
        {/* AlongsideLogo, size-[32px] -- per explicit request, same size
            WelcomePage's own logo was just shrunk to. text-black dark:text-
            white -- AlongsideLogo now inherits color (fill-current) rather
            than carrying its own dark/light opinion (alongside-logo.tsx's
            own comment has the full reasoning -- that change was for the
            sidebar's own Getting started row, which needs this mark to
            match its active/inactive row color instead); this page sits on
            the open page background, not a sidebar row, so it sets that
            same "dark mark in light mode, light mark in dark mode" look
            itself. */}
          <h1 className="text-[18px] font-normal text-foreground">{t("home.heading")}</h1>
          <p className="mt-2 text-[13px] font-normal text-muted-foreground">{t("home.subheading")}</p>
        </div>
      </div>
      {/* ComposeBox pinned to the bottom of the page -- absolute now (was a
          shrink-0 flex sibling), so it overlays the heading above instead of
          sharing flex space with it (see that div's own comment). z-10 so
          its own opaque background actually covers the heading text it
          overlaps rather than the two blending. var(--chat-max-width), not
          the hardcoded PAGE_CONTENT_WIDTH this used to carry -- confirmed
          directly as a real bug ("the expanded is not updating our content
          component... it should move from 800px to 95% width of the
          page"): Settings -> Appearance -> Chat width's own Expanded
          option (use-appearance-settings.ts's own applyChatWidth) sets
          this CSS variable to 95vw, which ChatPage.tsx's own compose
          wrapper already reads -- this page's wrapper just wasn't wired to
          the same variable, so it stayed fixed at 800px regardless of the
          setting. The per-page arrow-diagonal expand/wide toggle that used
          to sit at the box's own top-right corner is still gone entirely,
          per that earlier explicit request -- this is the global Settings
          toggle, a different, still-wanted feature. pb-4 (was pb-10, then pb-6)
          -- per explicit request, moves the whole group (the bordered box
          and its own attach/model/context-meter row directly below it,
          both rendered inside ComposeBox itself) further down toward the
          page's true bottom edge; a smaller bottom inset here is what
          actually does that, since both move as one unit already. This
          exact value is also what sidebar-nav.tsx's own account row (the
          avatar chip at the sidebar's own bottom) computes its own bottom
          offset from, so the two stay aligned -- see that row's own
          comment for the shared math. */}
      {/* px-3/sm:px-5/pb-4 on this outer div, maxWidth on the inner one --
          matches ChatPage.tsx's own compose wrapper structure exactly (see
          that file's comment): padding has to sit *outside* the
          var(--chat-max-width) cap, not on the same div carrying it, or the box
          renders 32px narrower than ChatPage's own -- real bug, confirmed
          directly ("the new chat and chat compose box are different sizes
          and different heights"), this div's old px-4/pb-4 was doing both at
          once. pb-4, not the pb-6 this had silently drifted to (the comment
          right above already claimed pb-4 -- confirmed directly as a real,
          stale mismatch: "the compose box... should be lowered... to match
          the location of the avatar at the sidebar"): that drift is what
          decoupled this from the account row's own pb-4/h-7 math below,
          landing the box's own toolbar-row center 8px higher than the
          avatar's. */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-5">
        <div className="t-chat-width mx-auto w-full" style={{ maxWidth: "var(--chat-max-width)" }}>
        <ComposeBox
          value={prompt}
          onChange={setPrompt}
          onSubmit={createSession}
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
          // No autoFocus any more, per explicit request -- landing on
          // this page shouldn't jump straight into the compose box;
          // this placeholder's own text spells out the real way in
          // (compose-box.tsx's own "press space" listener, gated on
          // placeholderCycle below). No "Start a new chat." lead-in any
          // more either (tried, reverted per explicit request) -- just
          // the instruction itself.
          placeholder={t("home.composePlaceholder")}
          // HomePage-only rotating hint (compose-box.tsx's own
          // AnimatedPlaceholder) -- per explicit request, not passed on
          // ChatPage, which keeps a single static placeholder. No "Ask
          // anything." lead-in any more either, same reasoning as
          // `placeholder` above. New "single player/multiplayer" tip
          // added right after the base `placeholder` (per explicit
          // request: "after press space... have this new one"), ahead
          // of the existing @ / . tips.
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
