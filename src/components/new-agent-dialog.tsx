import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot } from "lucide-react";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { AGENT_NAME_PATTERN, type AddAgentError } from "@/lib/chat-agents";
import { BotAvatarPicker, BotSwatches } from "@/components/bot-avatar-picker";
import { BotFace, DEFAULT_BOT_AVATAR, type BotAvatar, type BotExpression } from "@/components/bot-face";
import { cn } from "@/lib/utils";

export type BotDraft = { name: string; description: string; instructions: string; avatar: BotAvatar };

export const EMPTY_DRAFT: BotDraft = { name: "", description: "", instructions: "", avatar: DEFAULT_BOT_AVATAR };

/** The name without a leading "@", and whether the draft can be saved. */
export function checkDraft(draft: BotDraft) {
  const name = draft.name.trim().replace(/^@/, "");
  return { name, ready: AGENT_NAME_PATTERN.test(name) && draft.instructions.trim().length > 0 };
}

/**
 * A bot's or agent's look, name and instructions -- the New bot page (#504) and the agent/bot dialogs.
 * The look opens the picker in place: inside a modal dialog, anything portalled outside it sits behind
 * it and can't be used.
 */
export function BotFields({
  draft,
  onChange,
  error,
  autoFocus = true,
  bare = false,
  withDescription = false,
  expression,
}: {
  draft: BotDraft;
  onChange: (draft: BotDraft) => void;
  error?: string | null;
  autoFocus?: boolean;
  /** The New bot page: no name (the page's title is) and plain fields, so it reads like the bot itself. */
  bare?: boolean;
  /** A bot's one-line description (bots have one; chat agents don't). */
  withDescription?: boolean;
  /** The face it's making; given, it's animated (the New bot page). */
  expression?: BotExpression;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const descriptionId = useId();
  const instructionsId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {/* The New bot page shows its colours under the bot; the dialogs open the picker from the face. */}
      {bare ? (
        <div className="flex flex-col items-center gap-4">
          <BotFace avatar={draft.avatar} expression={expression} animated={expression !== undefined} className="size-16" />
          <BotSwatches value={draft.avatar} onChange={(avatar) => onChange({ ...draft, avatar })} withUpload />
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
        <span className="text-[13px] text-muted-foreground">@</span>
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
      {!bare && withDescription && (
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
      {bare ? (
        <textarea
          aria-label={t("agents.fields.instructions")}
          value={draft.instructions}
          onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
          placeholder={t("bots.placeholder.instructions")}
          maxLength={8000}
          rows={4}
          className="resize-none bg-transparent px-4 py-3 text-center text-[length:var(--redesign-chat-text)] leading-[1.5] text-foreground outline-none placeholder:text-ink-3"
        />
      ) : (
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
      {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}
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
  const [error, setError] = useState<AddAgentError | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? EMPTY_DRAFT);
    setError(null);
    // Only when it opens: `initial` is rebuilt on every render of the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const { name, ready } = checkDraft(draft);
  const editing = Boolean(initial);
  const copy = kind === "bot" ? "bots" : "agents";

  return (
    <ShellDialog
      centered
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      icon={<span className={cn("grid size-8 place-items-center", SHELL_RADIUS, SHELL_SURFACE)}><Bot aria-hidden="true" className="size-4 text-foreground" /></span>}
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
          if (failed) setError(failed);
          else onClose();
        }}
      >
        <BotFields
          withDescription={kind === "bot"}
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            setError(null);
          }}
          error={error && t(kind === "bot" && error === "name_taken" ? "bots.errors.name_taken" : `agents.errors.${error}`)}
        />
      </form>
    </ShellDialog>
  );
}
