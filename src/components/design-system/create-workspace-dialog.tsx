import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Upload } from "lucide-react";
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
                  <WorkspaceBrandIcon size={48} imageSrc={logo} />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-[calc(var(--radius)*1.25)] border border-dashed border-border text-muted-foreground">
                    <ImagePlus aria-hidden="true" className="size-5" />
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

/** A mini sidebar showing how the new workspace will look in the switcher. */
function WorkspacePreview({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div
      aria-hidden="true"
      className="relative hidden overflow-hidden sm:block"
    >
      <Backdrop />
      <div className="absolute top-10 left-10 -right-6 -bottom-6 rounded-tl-[calc(var(--radius)*1.4)] border border-[var(--redesign-sidebar-border)] bg-[var(--redesign-sidebar-surface)] p-4">
        <div className="flex h-7 items-center gap-2">
          {logo ? (
            <WorkspaceBrandIcon size={18} imageSrc={logo} />
          ) : (
            <span className="size-[18px] shrink-0 rounded-[6px] bg-muted-foreground/25" />
          )}
          <span className={cn("min-w-0 truncate text-[13px] font-medium", name ? "text-foreground" : "text-muted-foreground")}>
            {name || "Your workspace"}
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />
        </div>
        <div className="mt-3 h-7 rounded-[var(--radius)] border border-[var(--redesign-sidebar-border)] bg-[var(--redesign-quick-actions-surface)]" />
        <div className="mt-5 flex flex-col gap-3.5">
          {[72, 56, 80, 48, 64, 40].map((width, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full bg-muted-foreground/20" />
              <span className="h-2 rounded-full bg-muted-foreground/15" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
