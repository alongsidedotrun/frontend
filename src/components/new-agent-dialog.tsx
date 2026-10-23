import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot } from "lucide-react";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { AGENT_NAME_PATTERN, type AddAgentError } from "@/lib/chat-agents";
import { BotAvatarPicker } from "@/components/bot-avatar-picker";
import { BotFace, DEFAULT_BOT_AVATAR, type BotAvatar } from "@/components/bot-face";
import { cn } from "@/lib/utils";

/**
 * Adds a specialised agent to this chat (#507 part 2): a name people ask it by ("@reviewer") and the
 * instructions that make it a specialist. Anyone in the chat can then ask it; it works in the
 * background while the chat goes on.
 */
export function NewAgentDialog({
  open,
  onClose,
  onAdd,
  kind = "agent",
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, instructions: string, avatar: BotAvatar) => Promise<AddAgentError | null>;
  /** "bot": a new bot for your Bots page, not an agent in this chat. */
  kind?: "agent" | "bot";
}) {
  const { t } = useTranslation();
  const formId = useId();
  const nameId = useId();
  const instructionsId = useId();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<AddAgentError | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<BotAvatar>(DEFAULT_BOT_AVATAR);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName("");
    setInstructions("");
    setError(null);
    setAvatar(DEFAULT_BOT_AVATAR);
  }, [open]);
  const cleanName = name.trim().replace(/^@/, "");
  const copy = kind === "bot" ? "bots" : "agents";
  const ready = AGENT_NAME_PATTERN.test(cleanName) && instructions.trim().length > 0 && !busy;

  return (
    <ShellDialog
      centered
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      icon={<span className={cn("grid size-8 place-items-center", SHELL_RADIUS, SHELL_SURFACE)}><Bot aria-hidden="true" className="size-4 text-foreground" /></span>}
      title={t(`${copy}.new`)}
      description={t(`${copy}.dialog.description`)}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={onClose}
          primary={{ label: t(kind === "bot" ? "bots.create" : "agents.add"), type: "submit", form: formId, disabled: !ready }}
        />
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!ready) return;
          setBusy(true);
          const failed = await onAdd(cleanName, instructions.trim(), avatar);
          setBusy(false);
          if (failed) setError(failed);
          else onClose();
        }}
      >
        {/* Its look: the bot face in a colour, or an uploaded image (#504). */}
        {/* In the dialog itself, not a popover: the dialog is modal, so anything portalled outside
            it sits behind it and can't be used. */}
        <div className="relative flex justify-center">
          <button
            type="button"
            aria-label={t("bots.avatar.change")}
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
            className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BotFace avatar={avatar} className="size-16" />
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
              <BotAvatarPicker value={avatar} onChange={setAvatar} onClose={() => setPickerOpen(false)} />
            </div>
          )}
        </div>
        <ShellField label={t("agents.fields.name")} htmlFor={nameId}>
          <span className="text-[13px] text-muted-foreground">@</span>
          <input
            id={nameId}
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value.replace(/\s/g, "-"));
              setError(null);
            }}
            placeholder={t("agents.fields.namePlaceholder")}
            maxLength={33}
            className={SHELL_FIELD_INPUT}
          />
        </ShellField>
        <section className={cn("flex flex-col gap-1 px-3 pt-2 pb-1", SHELL_RADIUS, SHELL_SURFACE)}>
          <label htmlFor={instructionsId} className="text-[12px] text-muted-foreground">{t("agents.fields.instructions")}</label>
          <textarea
            id={instructionsId}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder={t("agents.fields.instructionsPlaceholder")}
            maxLength={8000}
            rows={5}
            className="resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </section>
        {error && <p className="px-1 text-[12px] text-destructive">{t(kind === "bot" && error === "name_taken" ? "bots.errors.name_taken" : `agents.errors.${error}`)}</p>}
      </form>
    </ShellDialog>
  );
}
