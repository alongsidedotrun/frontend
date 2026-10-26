import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShellDialog, ShellDialogActions, ShellPage } from "@/components/design-system/shell-dialog";
import { WorkspaceFields, WorkspaceTileMenu, type WorkspaceFieldValues } from "@/components/design-system/workspace-fields";

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Creates the workspace; resolves once it exists (the dialog then closes). */
  /** colorIndex: the palette colour picked for the letter tile, or null to use the name's. */
  onCreate: (name: string, logo: string | null, description: string | null, colorIndex: number | null) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
  /** In the main area (the sidebar's New workspace), not over it; Cancel calls onOpenChange(false). */
  asPage?: boolean;
};

const EMPTY: WorkspaceFieldValues = { name: "", description: "", logo: null, colorIndex: null };

/**
 * Create workspace, in the shell dialog's layout (ShellDialog): the new
 * workspace's tile on top, live as its logo, name and colour are set, then
 * the fields, then Cancel and Create workspace.
 */
export function CreateWorkspaceDialog({ open, onOpenChange, onCreate, saving = false, error, asPage = false }: CreateWorkspaceDialogProps) {
  const Frame = asPage ? ShellPage : ShellDialog;
  const { t } = useTranslation();
  const [values, setValues] = useState<WorkspaceFieldValues>(EMPTY);
  const formId = useId();

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (open) setValues(EMPTY);
  }, [open]);

  const trimmed = values.name.trim();
  const submit = () => {
    if (!trimmed || saving) return;
    void onCreate(trimmed, values.logo, values.description.trim() || null, values.colorIndex);
  };

  return (
    <Frame
      centered
      open={open}
      onOpenChange={onOpenChange}
      icon={<WorkspaceTileMenu values={values} onChange={setValues} />}
      title={t("workspace.create.title")}
      description={t("workspace.create.description")}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={() => onOpenChange(false)}
          primary={{ label: t("workspace.create.title"), type: "submit", form: formId, disabled: !trimmed || saving, loading: saving }}
        />
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <WorkspaceFields values={values} onChange={setValues} nameError={error} autoFocusName />
      </form>
    </Frame>
  );
}
