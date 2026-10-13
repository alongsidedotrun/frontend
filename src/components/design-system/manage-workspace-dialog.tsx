import { useEffect, useId, useState } from "react";
import { workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import { WorkspaceFields, type WorkspaceFieldValues } from "@/components/design-system/workspace-fields";
import { WorkspacePreview } from "@/components/design-system/create-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
 * Two-pane dialog for the current workspace, laid out like Create workspace:
 * its logo or letter tile, name and description on the left with a live
 * sidebar preview on the right, and deleting it at the bottom. Every
 * workspace, Personal included, works the same way; only the last one can't
 * be deleted.
 */
export function ManageWorkspaceDialog({ open, onOpenChange, workspace, onSave, onDelete, canDelete = false, saving = false, error, nameError }: ManageWorkspaceDialogProps) {
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

  const previewName = trimmedName || workspace.name;

  return (
    // !z-[120]: above the app top bar (z-[110]), like the other shell dialogs.
    <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
      <DialogContent size="xl" className="!z-[120] max-h-[calc(100dvh-2rem)] max-w-[min(760px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="grid min-h-[420px] grid-cols-1 sm:grid-cols-2">
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col gap-6 overflow-y-auto bg-[var(--redesign-primary-surface)] p-8">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-[18px] font-medium text-foreground">Manage workspace</DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground">
                Change how this workspace looks, or delete it.
              </DialogDescription>
            </div>

            <>
                <form
                  className="flex flex-col gap-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (changed && trimmedName && !saving) void onSave(change);
                  }}
                >
                  <WorkspaceFields values={values} onChange={setValues} nameError={nameError} />
                  {error && !confirmingDelete && <p className="text-[12px] text-destructive">{error}</p>}
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" className="flex-1" disabled={!changed || !trimmedName || saving}>
                      Save changes
                    </Button>
                  </div>
                </form>

                <section className="flex flex-col gap-2 border-t border-[var(--redesign-sidebar-border)] pt-5">
                  <span className="text-[13px] font-medium text-foreground">Delete workspace</span>
                  <span className="text-[12px] text-muted-foreground">
                    {canDelete ? "Removes this workspace from Alongside. This can't be undone." : "This is your only workspace, so it can't be deleted. Create another workspace first."}
                  </span>
                  {!canDelete ? null : confirmingDelete ? (
                    <form
                      className="flex flex-col gap-2 pt-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (confirmName.trim() === workspace.name && !saving) void onDelete();
                      }}
                    >
                      <label htmlFor={confirmId} className="text-[12px] text-muted-foreground">
                        Type <span className="font-medium text-foreground">{workspace.name}</span> to confirm.
                      </label>
                      <Input
                        id={confirmId}
                        autoFocus
                        value={confirmName}
                        onChange={(event) => setConfirmName(event.target.value)}
                        autoComplete="off"
                        className="h-8 border-[var(--redesign-sidebar-border)] bg-background text-[13px]"
                      />
                      {error && <p className="text-[12px] text-destructive">{error}</p>}
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="tertiary" size="compact" onClick={() => { setConfirmingDelete(false); setConfirmName(""); }}>
                          Keep workspace
                        </Button>
                        <Button
                          type="submit"
                          variant="tertiary"
                          size="compact"
                          disabled={confirmName.trim() !== workspace.name || saving}
                          className="text-destructive"
                        >
                          Delete workspace
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="pt-1">
                      <Button type="button" variant="tertiary" size="compact" className="text-destructive" onClick={() => setConfirmingDelete(true)}>
                        Delete workspace…
                      </Button>
                    </div>
                  )}
                </section>
            </>
          </div>

          <WorkspacePreview
            name={previewName}
            logo={values.logo}
            monogram={workspaceMonogram(previewName, values.colorIndex)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
