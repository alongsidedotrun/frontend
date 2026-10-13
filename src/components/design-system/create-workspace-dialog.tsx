import { useEffect, useState } from "react";
import { ChevronDown, Command, Plus, Search } from "lucide-react";
import { Backdrop } from "@/components/design-system/backdrop";
import { WorkspaceBrandIcon, workspaceMonogram, type WorkspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import { WorkspaceFields, type WorkspaceFieldValues } from "@/components/design-system/workspace-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Creates the workspace; resolves once it exists (the dialog then closes). */
  /** colorIndex: the palette colour picked for the letter tile, or null to use the name's. */
  onCreate: (name: string, logo: string | null, description: string | null, colorIndex: number | null) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
};

const EMPTY: WorkspaceFieldValues = { name: "", description: "", logo: null, colorIndex: null };

/**
 * Two-pane create-workspace dialog: the form on the left, and on the right a
 * live preview of the sidebar showing the new workspace's tile and name as
 * they're entered.
 */
export function CreateWorkspaceDialog({ open, onOpenChange, onCreate, saving = false, error }: CreateWorkspaceDialogProps) {
  const [values, setValues] = useState<WorkspaceFieldValues>(EMPTY);

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
    // !z-[120]: above the app top bar (z-[110]), so the dim overlay covers it
    // too -- same as the command menu.
    <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
      <DialogContent size="xl" className="!z-[120] max-w-[min(760px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="grid min-h-[420px] grid-cols-1 sm:grid-cols-2">
          <form
            className="flex flex-col gap-6 bg-[var(--redesign-primary-surface)] p-8"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-[18px] font-medium text-foreground">Create workspace</DialogTitle>
              <DialogDescription className="sr-only">Add a logo and a name for your new workspace.</DialogDescription>
            </div>

            <WorkspaceFields values={values} onChange={setValues} nameError={error} autoFocusName />

            <div className="mt-auto flex items-center gap-2">
              <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={!trimmed || saving}>
                Create workspace
              </Button>
            </div>
          </form>

          <WorkspacePreview name={trimmed} logo={values.logo} monogram={workspaceMonogram(trimmed, values.colorIndex)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Grey stand-in for a line of text or an icon in the preview. */
function Bar({ className }: { className?: string }) {
  return <span className={cn("block shrink-0 rounded-full bg-muted-foreground/15", className)} />;
}

/**
 * A mini sidebar mirroring the top of the real one (workspace row, Quick
 * actions, New chat, Projects/Chats sections), running off the bottom edge,
 * with the new workspace's tile and name live, everything that's the same in
 * every workspace shown as is, and only the project and chat names as grey
 * placeholders.
 * Same 28px rows and spacing as the sidebar.
 */
export function WorkspacePreview({ name, logo, monogram, builtIn = false }: { name: string; logo: string | null; monogram: WorkspaceMonogram | null; builtIn?: boolean }) {
  return (
    <div aria-hidden="true" className="relative hidden overflow-hidden sm:block">
      <Backdrop />
      <div data-icon-stroke className="absolute top-10 -bottom-6 left-10 -right-6 flex flex-col rounded-tl-[calc(var(--radius)*1.4)] border border-r-0 border-b-0 border-[var(--redesign-sidebar-border)] bg-[var(--redesign-sidebar-surface)] px-[var(--redesign-sidebar-edge-padding)] pt-4">
        {/* Workspace row: live tile + name, chevron, search on the right. */}
        <div className="flex h-7 items-center gap-2 pr-6">
          {builtIn ? (
            // The built-in Alongside workspace shows the Alongside mark, as in the sidebar.
            <WorkspaceBrandIcon size={18} />
          ) : logo ? (
            <WorkspaceBrandIcon size={18} imageSrc={logo} />
          ) : monogram ? (
            <WorkspaceBrandIcon size={18} monogram={monogram} />
          ) : (
            <span className="size-[18px] shrink-0 rounded-[6px] bg-muted-foreground/25" />
          )}
          <span className={cn("min-w-0 truncate text-[13px] font-medium", name ? "text-foreground" : "text-muted-foreground")}>
            {name || "Your workspace"}
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />
          <Search aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </div>

        {/* Quick actions field -- the same in every workspace, so shown as is. */}
        <div className="mt-3 mr-6 flex h-7 items-center justify-between rounded-[var(--radius)] border border-[var(--redesign-sidebar-border)] bg-[var(--redesign-quick-actions-surface)] px-3 text-muted-foreground">
          <span className="text-[13px]">Quick actions</span>
          <span className="flex items-center gap-1 text-[11px]">
            <Command aria-hidden="true" className="size-[11px]" />
            K
          </span>
        </div>

        {/* New chat. */}
        <div className="mt-3 flex h-7 items-center gap-[9px] px-[var(--redesign-quick-actions-padding)] text-[13px] font-medium text-muted-foreground">
          <Plus aria-hidden="true" className="size-[15px] shrink-0" />
          New chat
        </div>

        {/* Projects and Chats: real headers with their +, and grey bars for
            the project/chat names -- the only part that varies. */}
        {[{ label: "Projects", items: ["w-24", "w-16"] }, { label: "Chats", items: ["w-28", "w-20", "w-24"] }].map((section) => (
          <div key={section.label} className="mt-[var(--redesign-sidebar-section-gap)] flex flex-col">
            <div className="flex h-7 items-center justify-between px-[var(--redesign-quick-actions-padding)] pr-8 text-muted-foreground">
              <span className="text-[11px] font-medium">{section.label}</span>
              <Plus aria-hidden="true" className="size-2.5 shrink-0" />
            </div>
            {section.items.map((width, index) => (
              <div key={index} className="flex h-7 items-center px-[var(--redesign-quick-actions-padding)]">
                <Bar className={cn("h-2", width)} />
              </div>
            ))}
          </div>
        ))}

      </div>
    </div>
  );
}
