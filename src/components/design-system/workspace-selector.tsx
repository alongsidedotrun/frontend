import type { ReactNode } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DropdownActionRow, DropdownActionSection, type DropdownAction } from "@/components/design-system/dropdown-action-list";

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
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-[var(--redesign-workspace-trigger-height)] w-[var(--redesign-workspace-trigger-width)] max-w-full items-center gap-[var(--redesign-workspace-trigger-gap)] px-[var(--redesign-workspace-trigger-padding)] text-left text-[length:var(--redesign-font-size-base)] font-normal text-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <WorkspaceAvatar icon={selectedWorkspace.icon} iconSurfaceClassName={selectedWorkspace.iconSurfaceClassName} />
          <span className="min-w-0 flex-1 truncate">{selectedWorkspace.name}</span>
          <ChevronsUpDown aria-hidden="true" strokeWidth={1.5} className="size-[var(--redesign-workspace-chevron-size)] shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="w-[var(--redesign-workspace-menu-width)] max-h-[calc(100vh-2rem)] rounded-[var(--redesign-workspace-menu-radius)] border !shadow-none"
        style={{
          backgroundColor: "var(--redesign-sidebar-overlay-surface)",
          borderColor: "var(--redesign-sidebar-border)",
          boxShadow: "none",
        }}
        viewportClassName="max-h-[calc(100vh-2rem)] overflow-visible rounded-[var(--redesign-workspace-menu-radius)] p-0"
      >
        <div className="flex min-h-full flex-col px-[var(--redesign-menu-horizontal-padding)]">
          <div className="max-h-[var(--redesign-workspace-list-max-height)] overflow-y-auto overscroll-contain">
            <DropdownActionSection className="pt-[var(--redesign-menu-first-section-top-padding)]">
              {workspaces.map((workspace) => {
                const selected = workspace.id === value;
                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    onSelect={() => onValueChange(workspace.id)}
                    className="h-[var(--redesign-workspace-row-height)] rounded-[var(--redesign-dropdown-row-radius)] px-[var(--redesign-menu-row-padding)] text-[length:var(--redesign-dropdown-font-size)] font-normal text-foreground/70"
                  >
                    <WorkspaceAvatar
                      icon={workspace.icon}
                      iconSurfaceClassName={workspace.iconSurfaceClassName}
                      className="size-[var(--redesign-menu-avatar-size)]"
                    />
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="relative flex size-[var(--redesign-workspace-check-size)] shrink-0 rounded-full bg-focus-accent !text-white"
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
              <DropdownMenuSeparator />
              <DropdownActionSection>
                {workspaceSectionActions.map((action) => <DropdownActionRow key={action.id} action={action} />)}
              </DropdownActionSection>
            </>
          )}

          {actionSections.map((section, sectionIndex) => (
            <div key={section.map((action) => action.id).join("-")}>
              <DropdownMenuSeparator />
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
        </div>
      </DropdownMenuContent>
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
        className={cn(
          "flex size-[var(--redesign-workspace-avatar-size)] shrink-0 items-center justify-center text-foreground",
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
