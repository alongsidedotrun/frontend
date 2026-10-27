import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArchiveWorkspaceItem, WorkspaceFields, WorkspaceTileMenu, WorkspaceTilePreview, type WorkspaceFieldValues } from "@/components/design-system/workspace-fields";
import { ShellDialog, ShellDialogActions, ShellPage } from "@/components/design-system/shell-dialog";

export type ManagedWorkspace = {
  id: string;
  name: string;
  is_personal: boolean;
  logo?: string | null;
  description?: string | null;
  color?: number | null;
};

export type ManagedProject = { id: string; name: string; workspace_id?: string | null };

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
  onSave: (change: WorkspaceChange) => Promise<void> | void;
  onArchive: () => Promise<void> | void;
  canArchive?: boolean;
  projects?: ManagedProject[];
  workspaces?: ManagedWorkspace[];
  onMoveProject?: (projectId: string, workspaceId: string) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
  nameError?: string | null;
  /** In the main area (the sidebar's Manage workspace), not over it; Cancel calls onOpenChange(false). */
  asPage?: boolean;
};

function valuesOf(workspace: ManagedWorkspace): WorkspaceFieldValues {
  return { name: workspace.name, description: workspace.description ?? "", logo: workspace.logo ?? null, colorIndex: workspace.color ?? null };
}

export function ManageWorkspaceDialog({ open, onOpenChange, workspace, onSave, onArchive, canArchive = false, projects = [], workspaces = [], onMoveProject, saving = false, error, nameError, asPage = false }: ManageWorkspaceDialogProps) {
  const Frame = asPage ? ShellPage : ShellDialog;
  const { t } = useTranslation();
  const [values, setValues] = useState<WorkspaceFieldValues>(() => valuesOf(workspace));
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const formId = useId();

  useEffect(() => {
    if (!open) return;
    setValues(valuesOf(workspace));
    setConfirmingArchive(false);
  }, [open, workspace]);

  const saved = valuesOf(workspace);
  const trimmedName = values.name.trim();
  const description = values.description.trim();
  const change: WorkspaceChange = {};
  if (trimmedName !== saved.name) change.name = trimmedName;
  if (values.logo !== saved.logo) change.logo = values.logo;
  if (description !== saved.description.trim()) change.description = description || null;
  if (values.colorIndex !== saved.colorIndex) change.color = values.colorIndex;
  const changed = Object.keys(change).length > 0;
  const previewValues = { ...values, name: trimmedName || workspace.name };
  const workspaceProjects = projects.filter((project) => project.workspace_id === workspace.id);
  const destinations = workspaces.filter((item) => item.id !== workspace.id);

  return (
    <Frame
      centered
      open={open}
      onOpenChange={onOpenChange}
      icon={confirmingArchive ? <WorkspaceTilePreview values={previewValues} /> : (
        <WorkspaceTileMenu
          values={previewValues}
          onChange={(next) => setValues({ ...next, name: values.name })}
          extra={<ArchiveWorkspaceItem label={t("common.archive")} disabled={!canArchive} title={canArchive ? undefined : t("workspace.delete.onlyWorkspace")} onSelect={() => setConfirmingArchive(true)} />}
        />
      )}
      title={confirmingArchive ? t("archive.workspace.title") : t("workspace.manage")}
      description={confirmingArchive ? t("archive.workspace.description") : t("workspace.manage.description")}
      actions={confirmingArchive ? (
        <ShellDialogActions pills={asPage} cancelLabel={t("common.cancel")} onCancel={() => setConfirmingArchive(false)} primary={{ label: t("common.archive"), type: "submit", form: formId, disabled: saving }} />
      ) : (
        <ShellDialogActions pills={asPage} cancelLabel={t("common.cancel")} onCancel={() => onOpenChange(false)} primary={{ label: t("workspace.manage.save"), type: "submit", form: formId, disabled: !changed || !trimmedName || saving, loading: saving }} />
      )}
    >
      {confirmingArchive ? (
        <form id={formId} className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); if (!saving) void onArchive(); }}>
          <p className="px-1 text-[12px] text-muted-foreground">{t("archive.workspace.projectsHint")}</p>
          {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}
        </form>
      ) : (
        <form id={formId} className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); if (changed && trimmedName && !saving) void onSave(change); }}>
          <WorkspaceFields values={values} onChange={setValues} nameError={nameError} labelsAbove={asPage} />
          {workspaceProjects.length > 0 && destinations.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <p className="px-1 text-[12px] font-medium text-foreground">{t("archive.workspace.moveProjects")}</p>
              {workspaceProjects.map((project) => (
                <label key={project.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-[12px]">
                  <span className="truncate">{project.name}</span>
                  <select className="max-w-40 rounded-md border border-border bg-background px-2 py-1" defaultValue="" onChange={(event) => { if (event.target.value) void onMoveProject?.(project.id, event.target.value); }}>
                    <option value="" disabled>{t("archive.workspace.moveTo")}</option>
                    {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}
        </form>
      )}
    </Frame>
  );
}
