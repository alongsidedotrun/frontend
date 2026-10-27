import { useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Check, ImagePlus, Palette, Trash2, Upload, X } from "lucide-react";
import { WorkspaceBrandIcon, workspaceMonogram } from "@/components/design-system/workspace-brand-icon";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
  DropdownLabel as BaseDropdownLabel,
  DropdownSubMenuItem,
  DropdownSubItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { LOGO_MIME_TYPES, MAX_DESCRIPTION_LENGTH, readLogoFile } from "@/lib/workspace-logos";
import { WORKSPACE_HUE_COUNT, WORKSPACE_PALETTE, WORKSPACE_SWATCH_ORDER, paletteIndexForName } from "@/lib/identity-palette";
import { SurfaceProvider } from "@/lib/surface-context";
import { cn } from "@/lib/utils";
import { ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";

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
  // On the workspace pages: each label sits above its box, at its top left, not inside it.
  labelsAbove?: boolean;
};

/**
 * A workspace's name and description: the shared body of the Create and
 * Manage workspace dialogs. Its logo and colour are set from the tile on top
 * (WorkspaceTileMenu).
 */
export function WorkspaceFields({ values, onChange, nameError, autoFocusName, labelsAbove }: WorkspaceFieldsProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const descriptionId = useId();
  const set = (patch: Partial<WorkspaceFieldValues>) => onChange({ ...values, ...patch });

  const nameInput = (
    <input
      id={nameId}
      autoFocus={autoFocusName}
      value={values.name}
      onChange={(event) => set({ name: event.target.value })}
      aria-invalid={nameError ? true : undefined}
      placeholder={t("workspace.fields.namePlaceholder")}
      maxLength={80}
      className={SHELL_FIELD_INPUT}
    />
  );
  const descriptionInput = (
    <textarea
      id={descriptionId}
      value={values.description}
      onChange={(event) => set({ description: event.target.value })}
      placeholder={t("workspace.fields.descriptionPlaceholder")}
      maxLength={MAX_DESCRIPTION_LENGTH}
      rows={2}
      className="resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
    />
  );
  const nameErrorLine = nameError && <p className="px-1 text-[12px] text-destructive">{nameError}</p>;

  if (labelsAbove) {
    const labelClass = "px-1 text-[12px] text-muted-foreground";
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className={labelClass}>{t("workspace.fields.name")}</label>
          <div className={cn("flex h-9 items-center px-3", SHELL_RADIUS, SHELL_SURFACE)}>{nameInput}</div>
          {nameErrorLine}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={descriptionId} className={labelClass}>{t("workspace.fields.description")}</label>
          <div className={cn("flex flex-col px-3 py-2", SHELL_RADIUS, SHELL_SURFACE)}>{descriptionInput}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <ShellField label={t("workspace.fields.name")} htmlFor={nameId}>
          {nameInput}
        </ShellField>
        {nameErrorLine}
      </div>

      {/* Description: a white card like the fields, its label on top. */}
      <section className={cn("flex flex-col gap-1 px-3 pt-2 pb-1", SHELL_RADIUS, SHELL_SURFACE)}>
        <label htmlFor={descriptionId} className="text-[12px] text-muted-foreground">{t("workspace.fields.description")}</label>
        {descriptionInput}
      </section>
    </>
  );
}

/**
 * The workspace's tile on top of its dialog, as a menu: upload a logo, or use
 * the default letter tile in one of the named colours (a submenu), remove an
 * uploaded logo, and whatever the dialog adds (Manage: Delete workspace).
 */
export function WorkspaceTileMenu({ values, onChange, extra }: { values: WorkspaceFieldValues; onChange: (values: WorkspaceFieldValues) => void; extra?: ReactNode }) {
  const { t } = useTranslation();
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trimmed = values.name.trim();
  const selectedColor = values.colorIndex ?? (trimmed ? paletteIndexForName(trimmed, WORKSPACE_HUE_COUNT) : null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const result = await readLogoFile(file);
    if ("error" in result) {
      setLogoError(t(result.error));
      return;
    }
    setLogoError(null);
    onChange({ ...values, logo: result.dataUrl });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Above the dialog (z-120), so the menu opens over it. */}
      <SurfaceProvider value={8}>
        <BaseDropdownMenu size="compact">
          <BaseDropdownTrigger
            render={
              <button
                type="button"
                aria-label={t("workspace.fields.tileMenu")}
                className="rounded-[8px] transition-shadow outline-none hover:shadow-[0_0_0_3px_var(--redesign-sidebar-border)] focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:shadow-[0_0_0_3px_var(--redesign-sidebar-border)]"
              >
                <WorkspaceTilePreview values={values} />
              </button>
            }
          />
          <BaseDropdownContent side="bottom" align="center" sideOffset={6} className="w-56 min-w-0">
            <BaseMenuItem index={0} icon={Upload} label={t("workspace.fields.uploadLogo")} className="gap-[7px]" onSelect={() => fileRef.current?.click()} />
            <DropdownSubMenuItem index={1} icon={Palette} label={t("workspace.fields.useDefault")} chevron className="gap-[7px] text-[12px]">
              <BaseDropdownLabel>{t("workspace.fields.tileColour")}</BaseDropdownLabel>
              {WORKSPACE_SWATCH_ORDER.map((index) => {
                const swatch = WORKSPACE_PALETTE[index];
                const name = t(`workspace.colors.${swatch.name.toLowerCase()}`);
                const selected = !values.logo && selectedColor === index;
                return (
                  <DropdownSubItem
                    key={swatch.name}
                    className="flex items-center gap-2 py-1.5 pl-2.5 text-[12px]"
                    // The default tile: the name's letter on this colour, in place of any logo.
                    onClick={() => onChange({ ...values, logo: null, colorIndex: index })}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("size-3 shrink-0 rounded-full", swatch.swatch && "shadow-[inset_0_0_0_1px_var(--redesign-sidebar-border)]")}
                      style={{ backgroundColor: swatch.swatch ?? swatch.fg }}
                    />
                    <span className="flex-1">{name}</span>
                    {selected && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
                  </DropdownSubItem>
                );
              })}
            </DropdownSubMenuItem>
            {values.logo && <BaseMenuItem index={2} icon={X} label={t("workspace.fields.removeLogo")} className="gap-[7px]" onSelect={() => onChange({ ...values, logo: null })} />}
            {extra && (
              <>
                <DropdownSeparator />
                {extra}
              </>
            )}
          </BaseDropdownContent>
        </BaseDropdownMenu>
      </SurfaceProvider>
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
      {logoError && <p className="text-[12px] text-destructive">{logoError}</p>}
    </div>
  );
}

// Delete workspace in the tile's menu (Manage workspace).
export function DeleteWorkspaceItem({ label, disabled, onSelect }: { label: string; disabled?: boolean; title?: string; onSelect: () => void }) {
  return (
    <span>
      <BaseMenuItem index={3} icon={Trash2} label={label} className="gap-[7px] text-destructive" disabled={disabled} onSelect={onSelect} />
    </span>
  );
}

export function ArchiveWorkspaceItem({ label, disabled, onSelect }: { label: string; disabled?: boolean; title?: string; onSelect: () => void }) {
  return (
    <span>
      <BaseMenuItem index={3} icon={Archive} label={label} disabled={disabled} onSelect={onSelect} />
    </span>
  );
}

/**
 * A workspace's tile (32px): its logo, its letter on its colour, or a dashed
 * placeholder until it has a name.
 */
export function WorkspaceTilePreview({ values }: { values: WorkspaceFieldValues }) {
  const monogram = workspaceMonogram(values.name.trim(), values.colorIndex);
  if (values.logo) return <WorkspaceBrandIcon size={32} imageSrc={values.logo} />;
  if (monogram) return <WorkspaceBrandIcon size={32} monogram={monogram} />;
  // 8px: the tile radius formula at 32px (8 x sqrt(32/32)), so the placeholder matches a logo.
  return (
    <span className="grid size-8 place-items-center rounded-[8px] border border-dashed border-border text-muted-foreground">
      <ImagePlus aria-hidden="true" className="size-4" />
    </span>
  );
}
