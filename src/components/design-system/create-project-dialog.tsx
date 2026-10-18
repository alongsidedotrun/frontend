import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT } from "@/components/design-system/shell-dialog";

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  /** Creates the project; the host closes the dialog once it exists. */
  onCreate: () => void;
  saving?: boolean;
  error?: string | null;
};

/**
 * New project, in the shell dialog's layout (ShellDialog) like New workspace:
 * the Alongside tile, title and description, the name field, then Cancel and
 * Create project.
 */
export function CreateProjectDialog({ open, onOpenChange, name, onNameChange, onCreate, saving = false, error }: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const formId = useId();
  const nameId = useId();
  const trimmed = name.trim();

  return (
    <ShellDialog
      centered
      open={open}
      onOpenChange={onOpenChange}
      title={t("nav.newProject.ariaLabel")}
      description={t("shell.newProject.description")}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={() => onOpenChange(false)}
          primary={{ label: t("shell.newProject.create"), type: "submit", form: formId, disabled: !trimmed || saving, loading: saving }}
        />
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed && !saving) onCreate();
        }}
      >
        <ShellField label={t("workspace.fields.name")} htmlFor={nameId}>
          <input
            id={nameId}
            autoFocus
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            placeholder={t("shell.newProject.placeholder")}
            maxLength={80}
            className={SHELL_FIELD_INPUT}
          />
        </ShellField>
        {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}
      </form>
    </ShellDialog>
  );
}
