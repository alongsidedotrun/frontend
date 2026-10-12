import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { ChevronDownIcon } from "@/components/icons/untitled-ui";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DropdownActionRow, DropdownActionSection, type DropdownAction } from "@/components/design-system/dropdown-action-list";
import { RedesignDropdownContent, RedesignDropdownSeparator } from "@/components/design-system/redesign-dropdown";

export type WorkspaceOption = {
  id: string;
  name: string;
  icon?: ReactNode;
  iconSurfaceClassName?: string;
};

export type WorkspaceMenuAction = DropdownAction;

type WorkspaceSelectorProps = {
  workspaces: readonly WorkspaceOption[];
  value: string;
  onValueChange: (workspaceId: string) => void;
  workspaceSectionActions?: readonly WorkspaceMenuAction[];
  actionSections: readonly (readonly WorkspaceMenuAction[])[];
  ariaLabel: string;
  className?: string;
};

/**
 * A controlled workspace switcher. Workspace data and menu copy are supplied
 * by its caller, keeping this control reusable across product areas.
 */
export function WorkspaceSelector({
  workspaces,
  value,
  onValueChange,
  workspaceSectionActions,
  actionSections,
  ariaLabel,
  className,
}: WorkspaceSelectorProps) {
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === value) ?? workspaces[0];

  if (!selectedWorkspace) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Height and padding are rounded to whole pixels (even height so
            items-center splits evenly): the raw cqw values left the brand tile
            on fractional coordinates, which blurred its mark unevenly. */}
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-[round(var(--redesign-workspace-trigger-height),2px)] w-[var(--redesign-workspace-trigger-width)] max-w-full items-center gap-[var(--redesign-workspace-trigger-gap)] px-[round(var(--redesign-workspace-trigger-padding),1px)] text-left text-[length:var(--redesign-sidebar-primary-font-size)] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <WorkspaceAvatar icon={selectedWorkspace.icon} iconSurfaceClassName={selectedWorkspace.iconSurfaceClassName} />
          <span className="min-w-0 truncate">{selectedWorkspace.name}</span>
          <ChevronDownIcon aria-hidden="true" strokeWidth={1.5} className="size-[var(--redesign-workspace-chevron-size)] shrink-0 text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <RedesignDropdownContent
        align="start"
        sideOffset={4}
      >
        <div className="max-h-[var(--redesign-workspace-list-max-height)] overflow-y-auto overscroll-contain">
          <DropdownActionSection className="gap-[var(--redesign-quick-actions-row-gap)] py-0">
              {workspaces.map((workspace) => {
                const selected = workspace.id === value;
                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    onSelect={() => onValueChange(workspace.id)}
                    className="mx-[-var(--redesign-workspace-menu-padding)] h-[round(var(--redesign-sidebar-footer-task-row-height),2px)] gap-[var(--redesign-workspace-trigger-gap)] rounded-[var(--redesign-dropdown-row-radius)] px-[round(var(--redesign-menu-horizontal-padding),1px)] text-[length:var(--redesign-sidebar-primary-font-size)] font-medium text-foreground/70"
                  >
                    <WorkspaceAvatar
                      icon={workspace.icon}
                      iconSurfaceClassName={workspace.iconSurfaceClassName}
                    />
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="relative flex size-[var(--redesign-workspace-check-size)] shrink-0 rounded-full bg-focus-accent !text-white [&_*]:![color:inherit]"
                      >
                        <Check
                          strokeWidth={1.5}
                          className="absolute left-1/2 top-1/2 size-[var(--redesign-workspace-checkmark-size)] -translate-x-1/2 -translate-y-1/2"
                        />
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
          </DropdownActionSection>
        </div>

          {workspaceSectionActions && workspaceSectionActions.length > 0 && (
            <>
              <RedesignDropdownSeparator />
              <DropdownActionSection className="gap-[var(--redesign-quick-actions-row-gap)] py-0">
                {workspaceSectionActions.map((action) => (
                  <DropdownActionRow
                    key={action.id}
                    action={action}
                    className="mx-[-var(--redesign-workspace-menu-padding)] h-[var(--redesign-sidebar-footer-task-row-height)] px-[var(--redesign-menu-horizontal-padding)]"
                  />
                ))}
              </DropdownActionSection>
            </>
          )}

          {actionSections.map((section, sectionIndex) => (
            <div key={section.map((action) => action.id).join("-")}>
              <RedesignDropdownSeparator />
              <DropdownActionSection
                className={
                  sectionIndex === actionSections.length - 1
                    ? "pb-[var(--redesign-menu-last-section-bottom-padding)]"
                    : undefined
                }
              >
                {section.map((action) => <DropdownActionRow key={action.id} action={action} />)}
              </DropdownActionSection>
            </div>
          ))}
      </RedesignDropdownContent>
    </DropdownMenu>
  );
}


function WorkspaceAvatar({
  icon,
  iconSurfaceClassName,
  className,
}: {
  icon?: ReactNode;
  iconSurfaceClassName?: string;
  className?: string;
}) {
  if (icon) {
    return (
      <span
        aria-hidden="true"
        // No fixed size: a supplied icon (e.g. a WorkspaceBrandIcon) carries
        // its own canvas, and boxing it in the 16px placeholder slot made it
        // overflow unevenly into the trigger padding and the label gap.
        className={cn(
          "flex shrink-0 items-center justify-center text-foreground",
          className,
          iconSurfaceClassName,
        )}
      >
        {icon}
      </span>
    );
  }

  return <span aria-hidden="true" className={cn("size-[var(--redesign-workspace-avatar-size)] shrink-0 rounded-[var(--redesign-workspace-brand-radius)] bg-muted-foreground/30", className)} />;
}
