import { useEffect, useId, useState } from "react";
import { workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
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
  /** Whether another workspace is showing, so this one can be archived. */
  canArchive?: boolean;
  /** Archives (hides) the built-in workspace; resolves once done. */
  onArchive?: () => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
};

function valuesOf(workspace: ManagedWorkspace): WorkspaceFieldValues {
  return { name: workspace.name, description: workspace.description ?? "", logo: workspace.logo ?? null, colorIndex: workspace.color ?? null };
}

/**
 * Two-pane dialog for the current workspace, laid out like Create workspace:
 * its logo or letter tile, name and description on the left with a live
 * sidebar preview on the right, and deleting it at the bottom. The built-in
 * Alongside workspace can't be changed or deleted.
 */
export function ManageWorkspaceDialog({ open, onOpenChange, workspace, onSave, onDelete, canArchive = false, onArchive, saving = false, error }: ManageWorkspaceDialogProps) {
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
                {workspace.is_personal ? "Your built-in workspace." : "Change how this workspace looks, or delete it."}
              </DialogDescription>
            </div>

            {workspace.is_personal ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {/* Same 40px tile and 18px glyph as Create workspace's logo placeholder. */}
                  <span className="grid size-10 shrink-0 place-items-center rounded-[8.94px] border border-[var(--redesign-sidebar-footer-onboarding-border)] bg-white text-black dark:border-transparent">
                    <AlongsideLogo aria-hidden="true" className="size-[18px]" />
                  </span>
                  <span className="text-[13px] font-medium text-foreground">{workspace.name}</span>
                </div>
                <div className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  <p>It comes with the app, so it can't be renamed or deleted.</p>
                  <p>Once you've created another workspace, you can archive this one and restore it later from the workspace menu.</p>
                </div>
                {error && <p className="text-[12px] text-destructive">{error}</p>}
                <div className="mt-auto flex items-center gap-2">
                  <Button type="button" variant="tertiary" size="compact" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="compact"
                    disabled={!canArchive || saving}
                    title={canArchive ? undefined : "Create another workspace first"}
                    onClick={() => void onArchive?.()}
                  >
                    Archive workspace
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <form
                  className="flex flex-col gap-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (changed && trimmedName && !saving) void onSave(change);
                  }}
                >
                  <WorkspaceFields values={values} onChange={setValues} nameError={error} />
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
                  <span className="text-[12px] text-muted-foreground">Removes this workspace from Alongside. This can't be undone.</span>
                  {confirmingDelete ? (
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
            )}
          </div>

          <WorkspacePreview
            name={previewName}
            logo={workspace.is_personal ? null : values.logo}
            monogram={workspace.is_personal ? null : workspaceMonogram(previewName, values.colorIndex)}
            builtIn={workspace.is_personal}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
