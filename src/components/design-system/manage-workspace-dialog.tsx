import { useEffect, useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { DeleteWorkspaceItem, WorkspaceFields, WorkspaceTileMenu, WorkspaceTilePreview, type WorkspaceFieldValues } from "@/components/design-system/workspace-fields";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT } from "@/components/design-system/shell-dialog";

export type ManagedWorkspace = {
  id: string;
  name: string;
  is_personal: boolean;
  logo?: string | null;
  description?: string | null;
  color?: number | null;
};

// Only the fields that changed; null clears one.
export type WorkspaceChange = {
  name?: string;
  logo?: string | null;
  description?: string | null;
  color?: number | null;
};

type ManageWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: ManagedWorkspace;
  /** Saves the changes; resolves once saved (the dialog then closes). */
  onSave: (change: WorkspaceChange) => Promise<void> | void;
  /** Deletes the workspace; resolves once deleted (the dialog then closes). */
  onDelete: () => Promise<void> | void;
  /** Whether another workspace exists: the last one can't be deleted. */
  canDelete?: boolean;
  saving?: boolean;
  /** A save or delete error, shown by the button that caused it. */
  error?: string | null;
  /** A problem with the name (e.g. taken), shown under the Name field. */
  nameError?: string | null;
};

function valuesOf(workspace: ManagedWorkspace): WorkspaceFieldValues {
  return { name: workspace.name, description: workspace.description ?? "", logo: workspace.logo ?? null, colorIndex: workspace.color ?? null };
}

/**
 * Manage workspace, in the shell dialog's layout (ShellDialog), like Create
 * workspace: its tile on top, live as it's edited, its logo, name and
 * description, and Delete beside the logo's Remove. Every
 * workspace, the branded default included, works the same way; only the last one can't
 * be deleted.
 */
export function ManageWorkspaceDialog({ open, onOpenChange, workspace, onSave, onDelete, canDelete = false, saving = false, error, nameError }: ManageWorkspaceDialogProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<WorkspaceFieldValues>(() => valuesOf(workspace));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const confirmId = useId();

  // Each opening starts from the workspace as saved.
  useEffect(() => {
    if (!open) return;
    setValues(valuesOf(workspace));
    setConfirmingDelete(false);
    setConfirmName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace.id]);

  const saved = valuesOf(workspace);
  const trimmedName = values.name.trim();
  const description = values.description.trim();
  const change: WorkspaceChange = {};
  if (trimmedName !== saved.name) change.name = trimmedName;
  if (values.logo !== saved.logo) change.logo = values.logo;
  if (description !== saved.description.trim()) change.description = description || null;
  if (values.colorIndex !== saved.colorIndex) change.color = values.colorIndex;
  const changed = Object.keys(change).length > 0;

  const formId = useId();
  // The tile shows the saved name until a new one is typed.
  const previewValues = { ...values, name: trimmedName || workspace.name };
  const deleteConfirmed = confirmName.trim() === workspace.name;

  return (
    <ShellDialog
      centered
      open={open}
      onOpenChange={onOpenChange}
      icon={
        confirmingDelete ? (
          <WorkspaceTilePreview values={previewValues} />
        ) : (
          <WorkspaceTileMenu
            values={previewValues}
            onChange={(next) => setValues({ ...next, name: values.name })}
            extra={
              // The last workspace can't be deleted; the tooltip says why.
              <DeleteWorkspaceItem
                label={t("workspace.delete.title")}
                disabled={!canDelete}
                title={canDelete ? undefined : t("workspace.delete.onlyWorkspace")}
                onSelect={() => setConfirmingDelete(true)}
              />
            }
          />
        )
      }
      title={confirmingDelete ? t("workspace.delete.title") : t("workspace.manage")}
      description={confirmingDelete ? t("workspace.delete.description") : t("workspace.manage.description")}
      actions={
        confirmingDelete ? (
          <ShellDialogActions
            cancelLabel={t("workspace.delete.keep")}
            onCancel={() => {
              setConfirmingDelete(false);
              setConfirmName("");
            }}
            primary={{ label: t("workspace.delete.title"), type: "submit", form: formId, disabled: !deleteConfirmed || saving, destructive: true }}
          />
        ) : (
          <ShellDialogActions
            cancelLabel={t("common.cancel")}
            onCancel={() => onOpenChange(false)}
            primary={{ label: t("workspace.manage.save"), type: "submit", form: formId, disabled: !changed || !trimmedName || saving, loading: saving }}
          />
        )
      }
    >
      {confirmingDelete ? (
        // Deleting: in place of the form, until they keep it or confirm with its name.
        <form
          id={formId}
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (deleteConfirmed && !saving) void onDelete();
          }}
        >
          <ShellField label={t("workspace.fields.name")} htmlFor={confirmId}>
            <input id={confirmId} autoFocus value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoComplete="off" className={SHELL_FIELD_INPUT} />
          </ShellField>
          <p className="px-1 text-[12px] text-muted-foreground">
            <Trans i18nKey="workspace.delete.confirm" values={{ name: workspace.name }} components={[<span className="font-medium text-foreground" key="0" />]} />
          </p>
          {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}
        </form>
      ) : (
        <form
          id={formId}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (changed && trimmedName && !saving) void onSave(change);
          }}
        >
          <WorkspaceFields
            values={values}
            onChange={setValues}
            nameError={nameError}
          />
          {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}
        </form>
      )}
    </ShellDialog>
  );
}
