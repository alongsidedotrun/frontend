import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BotIcon } from "@/components/icons/bot-icon";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { AGENT_NAME_PATTERN, type AddAgentError } from "@/lib/chat-agents";
import { BotAvatarPicker, BotEyesPicker, BotSwatches } from "@/components/bot-avatar-picker";
import { BotFace, DEFAULT_BOT_AVATAR, useBotMood, type BotAvatar, type BotExpression } from "@/components/bot-face";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/components/ui/app-toast";
import type { TFunction } from "i18next";

/**
 * Why adding an agent or making/saving a bot failed, in words, each with its error code (project/ERRORS.md):
 * no backend is ALS-002, a taken name ALS-035, a name not allowed ALS-036, missing instructions ALS-038,
 * and anything else the backend refused ALS-033 (creating a bot), ALS-034 (saving one) or ALS-037 (an
 * agent), with its HTTP status.
 */
export function addErrorMessage(t: TFunction, error: AddAgentError, kind: "agent" | "bot", editing = false) {
  const status = error.status ?? "-";
  switch (error.reason) {
    case "unreachable":
      return t("settings.providers.noConnection");
    case "name_taken":
      return t(kind === "bot" ? "bots.errors.name_taken" : "agents.errors.name_taken");
    case "invalid_name":
    case "invalid_instructions":
      return t(`agents.errors.${error.reason}`);
    default:
      return kind === "agent" ? t("agents.errors.failed", { status }) : t(editing ? "bots.errors.saveFailed" : "bots.errors.failed", { status });
  }
}

/** Shows that error in the app's toast (top middle); a new one replaces the one on screen. */
export function showAddError(t: TFunction, error: AddAgentError, kind: "agent" | "bot", editing = false) {
  showErrorToast(addErrorMessage(t, error, kind, editing), { id: "add-bot-or-agent" });
}

export type BotDraft = { name: string; description: string; instructions: string; avatar: BotAvatar };

export const EMPTY_DRAFT: BotDraft = { name: "", description: "", instructions: "", avatar: DEFAULT_BOT_AVATAR };

/** The name without a leading "@", and whether the draft can be saved: a bot needs only its name (its
 *  instructions can come later); a chat agent needs its instructions too. */
export function checkDraft(draft: BotDraft, needsInstructions = true) {
  const name = draft.name.trim().replace(/^@/, "");
  return { name, ready: AGENT_NAME_PATTERN.test(name) && (!needsInstructions || draft.instructions.trim().length > 0) };
}

/**
 * A bot's or agent's look, name and instructions -- the New bot page (#504) and the agent/bot dialogs.
 * The look opens the picker in place: inside a modal dialog, anything portalled outside it sits behind
 * it and can't be used.
 */
export function BotFields({
  draft,
  onChange,
  autoFocus = true,
  bare = false,
  forBot = false,
  expression,
  footer,
}: {
  draft: BotDraft;
  onChange: (draft: BotDraft) => void;
  autoFocus?: boolean;
  /** The New bot page: no name (the page's title is) and plain fields, so it reads like the bot itself. */
  bare?: boolean;
  /** A bot (its description; no "@" or instructions box) rather than a chat's agent. */
  forBot?: boolean;
  /** The face it's making; given, it's animated (the New bot page). */
  expression?: BotExpression;
  /** The New bot page's buttons, under the colours and as wide as them. */
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const descriptionId = useId();
  const instructionsId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {/* The New bot page shows its colours under the bot; the dialogs open the picker from the face. */}
      {/* A bot's look -- colours, Randomise, Upload, expressions -- shows under its face, on the New bot
          page and in Edit bot alike; a chat's agent opens the picker from its face. */}
      {bare || forBot ? (
        <div className="flex flex-col items-center gap-4">
          <BotFace avatar={draft.avatar} expression={expression} animated={expression !== undefined} className="size-16" />
          <div className="flex w-fit flex-col items-center gap-4">
            <BotSwatches value={draft.avatar} onChange={(avatar) => onChange({ ...draft, avatar })} withUpload />
            <BotEyesPicker value={draft.avatar} onChange={(avatar) => onChange({ ...draft, avatar })} />
            {footer}
          </div>
        </div>
      ) : (
      <div className="relative flex justify-center">
        <button
          type="button"
          aria-label={t("bots.avatar.change")}
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BotFace avatar={draft.avatar} expression={expression} animated={expression !== undefined} className="size-16" />
        </button>
        {pickerOpen && (
          <div
            className="absolute top-full z-10 mt-2"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setPickerOpen(false);
              }
            }}
          >
            <BotAvatarPicker value={draft.avatar} onChange={(avatar) => onChange({ ...draft, avatar })} onClose={() => setPickerOpen(false)} />
          </div>
        )}
      </div>
      )}
      {!bare && <ShellField label={t("agents.fields.name")} htmlFor={nameId}>
        {/* An agent is asked by @name in its chat; a bot is talked to directly, so no @. */}
        {!forBot && <span className="text-[13px] text-muted-foreground">@</span>}
        <input
          id={nameId}
          autoFocus={autoFocus}
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value.replace(/\s/g, "-") })}
          placeholder={t("agents.fields.namePlaceholder")}
          maxLength={33}
          className={SHELL_FIELD_INPUT}
        />
      </ShellField>}
      {!bare && forBot && (
        <ShellField label={t("bots.fields.description")} htmlFor={descriptionId}>
          <input
            id={descriptionId}
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            placeholder={t("bots.fields.descriptionPlaceholder")}
            maxLength={300}
            className={SHELL_FIELD_INPUT}
          />
        </ShellField>
      )}
      {/* The New bot page has no instructions: they're given once the bot exists. */}
      {/* A bot's instructions are given in its chat; only a chat's agent is told its speciality here. */}
      {!bare && !forBot && (
        <section className={cn("flex flex-col gap-1 px-3 pt-2 pb-1", SHELL_RADIUS, SHELL_SURFACE)}>
          <label htmlFor={instructionsId} className="text-[12px] text-muted-foreground">{t("agents.fields.instructions")}</label>
          <textarea
            id={instructionsId}
            value={draft.instructions}
            onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
            placeholder={t("agents.fields.instructionsPlaceholder")}
            maxLength={8000}
            rows={5}
            className="resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </section>
      )}
    </div>
  );
}

/**
 * Adds a specialised agent to this chat (#507 part 2): a name people ask it by ("@reviewer") and the
 * instructions that make it a specialist. Anyone in the chat can then ask it; it works in the
 * background while the chat goes on. With kind="bot" and `initial`, it edits one of your bots (#504).
 */
export function NewAgentDialog({
  open,
  onClose,
  onAdd,
  kind = "agent",
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, instructions: string, avatar: BotAvatar, description: string) => Promise<AddAgentError | null>;
  kind?: "agent" | "bot";
  /** Editing: the bot as it is now. */
  initial?: BotDraft;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [draft, setDraft] = useState<BotDraft>(initial ?? EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  // A bot reacts here as on the New bot page: happy while it's named and described; a new look shows at once.
  const [mood, react] = useBotMood();
  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? EMPTY_DRAFT);
    // Only when it opens: `initial` is rebuilt on every render of the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const { name, ready } = checkDraft(draft, kind !== "bot");
  const editing = Boolean(initial);
  const copy = kind === "bot" ? "bots" : "agents";

  return (
    <ShellDialog
      centered
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      icon={<span className={cn("grid size-8 place-items-center", SHELL_RADIUS, SHELL_SURFACE)}><BotIcon aria-hidden="true" className="size-4 text-foreground" /></span>}
      title={t(editing ? "bots.editTitle" : `${copy}.new`)}
      description={t(`${copy}.dialog.description`)}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={onClose}
          primary={{ label: t(editing ? "common.save" : kind === "bot" ? "bots.create" : "agents.add"), type: "submit", form: formId, disabled: !ready || busy }}
        />
      }
    >
      <form
        id={formId}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!ready || busy) return;
          setBusy(true);
          const failed = await onAdd(name, draft.instructions.trim(), draft.avatar, draft.description.trim());
          setBusy(false);
          // Errors show in the app's toast, top middle, not inside the dialog.
          if (failed) showAddError(t, failed, kind, editing);
          else onClose();
        }}
      >
        <BotFields
          forBot={kind === "bot"}
          expression={kind === "bot" ? mood : undefined}
          draft={draft}
          onChange={(next) => {
            if (kind === "bot") {
              if (next.name !== draft.name || next.description !== draft.description) react("happy");
              else if (next.avatar !== draft.avatar) react("default");
            }
            setDraft(next);
          }}
        />
      </form>
    </ShellDialog>
  );
}
