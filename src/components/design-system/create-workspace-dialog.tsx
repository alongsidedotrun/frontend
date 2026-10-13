import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Command, ImagePlus, Plus, Search, Upload } from "lucide-react";
import { Backdrop } from "@/components/design-system/backdrop";
import { WorkspaceBrandIcon } from "@/components/design-system/workspace-brand-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LOGO_MIME_TYPES, MAX_DESCRIPTION_LENGTH, readLogoFile } from "@/lib/workspace-logos";
import { cn } from "@/lib/utils";

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Creates the workspace; resolves once it exists (the dialog then closes). */
  onCreate: (name: string, logo: string | null, description: string | null) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
};

/**
 * Two-pane create-workspace dialog: the form on the left, and on the right a
 * live preview of the sidebar showing the new workspace's tile and name as
 * they're entered.
 */
export function CreateWorkspaceDialog({ open, onOpenChange, onCreate, saving = false, error }: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const descriptionId = useId();

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setLogo(null);
    setLogoError(null);
  }, [open]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const result = await readLogoFile(file);
    if ("error" in result) {
      setLogoError(result.error);
      return;
    }
    setLogoError(null);
    setLogo(result.dataUrl);
  }

  const trimmed = name.trim();
  const submit = () => {
    if (!trimmed || saving) return;
    void onCreate(trimmed, logo, description.trim() || null);
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

            <section className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-foreground">Upload logo</span>
                <span className="text-[12px] text-muted-foreground">We recommend to use SVG format for logos. PNG, JPG are also supported.</span>
              </div>
              <div className="flex items-center gap-2">
                {logo ? (
                  <WorkspaceBrandIcon size={40} imageSrc={logo} />
                ) : (
                  <span
                    // 8.94px: the tile radius formula at 40px (8 x sqrt(40/32)),
                    // so the placeholder and an uploaded logo share one shape.
                    className="grid size-10 shrink-0 place-items-center rounded-[8.94px] border border-dashed border-border text-muted-foreground">
                    <ImagePlus aria-hidden="true" className="size-[18px]" />
                  </span>
                )}
                <Button type="button" variant="tertiary" size="compact" leadingIcon={Upload} onClick={() => fileRef.current?.click()}>
                  Upload
                </Button>
                <Button type="button" variant="tertiary" size="compact" disabled={!logo} onClick={() => setLogo(null)}>
                  Remove
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={LOGO_MIME_TYPES.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    void handleFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
              {logoError && <p className="text-[12px] text-destructive">{logoError}</p>}
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <label htmlFor={nameId} className="text-[13px] font-medium text-foreground">Name</label>
                <span id={`${nameId}-hint`} className="text-[12px] text-muted-foreground">Shown in the sidebar and to people you invite</span>
              </div>
              <Input
                id={nameId}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby={`${nameId}-hint`}
                placeholder="Enter a workspace name"
                maxLength={80}
                className="h-8 border-[var(--redesign-sidebar-border)] bg-background text-[13px]"
              />
              {error && <p className="text-[12px] text-destructive">{error}</p>}
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={descriptionId} className="text-[13px] font-medium text-foreground">Description</label>
                <span className="text-[12px] text-muted-foreground">Optional</span>
              </div>
              <Textarea
                id={descriptionId}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What's this workspace for?"
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={3}
                className="min-h-[4.5rem] resize-none border-[var(--redesign-sidebar-border)] bg-background text-[13px]"
              />
            </section>

            <div className="mt-auto flex items-center gap-2">
              <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={!trimmed || saving}>
                Create workspace
              </Button>
            </div>
          </form>

          <WorkspacePreview name={trimmed} logo={logo} />
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
function WorkspacePreview({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div aria-hidden="true" className="relative hidden overflow-hidden sm:block">
      <Backdrop />
      <div data-icon-stroke className="absolute top-10 -bottom-6 left-10 -right-6 flex flex-col rounded-tl-[calc(var(--radius)*1.4)] border border-r-0 border-b-0 border-[var(--redesign-sidebar-border)] bg-[var(--redesign-sidebar-surface)] px-[var(--redesign-sidebar-edge-padding)] pt-4">
        {/* Workspace row: live tile + name, chevron, search on the right. */}
        <div className="flex h-7 items-center gap-2 pr-6">
          {logo ? (
            <WorkspaceBrandIcon size={18} imageSrc={logo} />
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
