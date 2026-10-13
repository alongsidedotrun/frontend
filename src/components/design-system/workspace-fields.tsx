import { useId, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { WorkspaceBrandIcon, workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LOGO_MIME_TYPES, MAX_DESCRIPTION_LENGTH, readLogoFile } from "@/lib/workspace-logos";
import { WORKSPACE_PALETTE, paletteIndexForName } from "@/lib/identity-palette";
import { cn } from "@/lib/utils";

export type WorkspaceFieldValues = {
  name: string;
  description: string;
  logo: string | null;
  // null until a swatch is picked: the letter tile then follows the name.
  colorIndex: number | null;
};

type WorkspaceFieldsProps = {
  values: WorkspaceFieldValues;
  onChange: (values: WorkspaceFieldValues) => void;
  // Shown under the name, e.g. a name already taken.
  nameError?: string | null;
  autoFocusName?: boolean;
};

/**
 * The logo (upload, or a letter tile with a colour), name and description of
 * a workspace: the shared body of the Create and Manage workspace dialogs.
 */
export function WorkspaceFields({ values, onChange, nameError, autoFocusName }: WorkspaceFieldsProps) {
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const descriptionId = useId();
  const set = (patch: Partial<WorkspaceFieldValues>) => onChange({ ...values, ...patch });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const result = await readLogoFile(file);
    if ("error" in result) {
      setLogoError(result.error);
      return;
    }
    setLogoError(null);
    set({ logo: result.dataUrl });
  }

  const trimmed = values.name.trim();
  // Without a logo, the workspace gets its first letter on a palette colour.
  const monogram = workspaceMonogram(trimmed, values.colorIndex);
  const selectedColor = values.colorIndex ?? (trimmed ? paletteIndexForName(trimmed, WORKSPACE_PALETTE.length) : null);

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-foreground">Upload logo</span>
            <span className="text-[12px] text-muted-foreground">Optional</span>
          </div>
          <span className="text-[12px] text-muted-foreground">Supported file formats are SVG, PNG, JPG and max upload size is 1MB.</span>
        </div>
        <div className="flex items-center gap-2">
          {values.logo ? (
            <WorkspaceBrandIcon size={40} imageSrc={values.logo} />
          ) : monogram ? (
            <WorkspaceBrandIcon size={40} monogram={monogram} />
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
          <Button type="button" variant="tertiary" size="compact" disabled={!values.logo} onClick={() => set({ logo: null })}>
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
        {/* Colour for the letter tile; hidden once a logo replaces it. */}
        {!values.logo && (
          <div role="radiogroup" aria-label="Tile colour" className="flex items-center gap-2 pt-1">
            {WORKSPACE_PALETTE.map((swatch, index) => {
              const selected = selectedColor === index;
              return (
                <button
                  key={swatch.name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={swatch.name}
                  title={swatch.name}
                  onClick={() => set({ colorIndex: index })}
                  className={cn(
                    "size-5 rounded-full outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "ring-2 ring-offset-2 ring-offset-[var(--redesign-primary-surface)]",
                  )}
                  style={{ backgroundColor: swatch.fg, ...(selected ? { ["--tw-ring-color" as string]: swatch.fg } : {}) }}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <label htmlFor={nameId} className="text-[13px] font-medium text-foreground">Name</label>
          <span id={`${nameId}-hint`} className="text-[12px] text-muted-foreground">Shown in the sidebar and to people you invite</span>
        </div>
        <Input
          id={nameId}
          autoFocus={autoFocusName}
          value={values.name}
          onChange={(event) => set({ name: event.target.value })}
          aria-describedby={`${nameId}-hint`}
          aria-invalid={nameError ? true : undefined}
          placeholder="Enter a workspace name"
          maxLength={80}
          className="h-8 border-[var(--redesign-sidebar-border)] bg-background text-[13px]"
        />
        {nameError && <p className="text-[12px] text-destructive">{nameError}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={descriptionId} className="text-[13px] font-medium text-foreground">Description</label>
          <span className="text-[12px] text-muted-foreground">Optional</span>
        </div>
        <Textarea
          id={descriptionId}
          value={values.description}
          onChange={(event) => set({ description: event.target.value })}
          placeholder="What's this workspace for?"
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
          className="min-h-[4.5rem] resize-none border-[var(--redesign-sidebar-border)] bg-background text-[13px]"
        />
      </section>
    </>
  );
}
