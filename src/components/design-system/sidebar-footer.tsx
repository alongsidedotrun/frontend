import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, CircleDashed, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DropdownActionRow, DropdownActionSection, type DropdownAction } from "@/components/design-system/dropdown-action-list";
import { RedesignDropdownContent, RedesignDropdownSeparator } from "@/components/design-system/redesign-dropdown";

export type GettingStartedStep = {
  id: string;
  label: string;
  description?: string;
  image?: ReactNode;
  actionLabel?: string;
  complete?: boolean;
  onSelect?: () => void;
};

type GettingStartedSummaryProps = {
  label: string;
  steps: readonly GettingStartedStep[];
  completedSteps: number;
  defaultExpanded?: boolean;
  viewAllLabel?: string;
  onViewAll?: () => void;
};

function SetupProgressRing({ completedSteps, totalSteps }: { completedSteps: number; totalSteps: number }) {
  const progress = totalSteps ? Math.min(Math.max(completedSteps / totalSteps, 0), 1) : 0;
  const degrees = `${progress * 360}deg`;
  const ringMask = "radial-gradient(circle, transparent 0 calc(50% - var(--redesign-sidebar-footer-progress-inset)), #000 calc(50% - var(--redesign-sidebar-footer-progress-inset)))";
  return (
    <span
      key={`${completedSteps}-${totalSteps}`}
      aria-hidden="true"
      className="size-[var(--redesign-sidebar-footer-progress-size)] shrink-0 animate-[redesign-progress-ring_400ms_ease-out] rounded-full"
      style={{
        background: `conic-gradient(var(--focus-accent) 0deg ${degrees}, var(--redesign-progress-track) ${degrees} 360deg)`,
        maskImage: ringMask,
        WebkitMaskImage: ringMask,
      }}
    />
  );
}

/** Collapsible setup summary for any sidebar surface. */
export function GettingStartedSummary({
  label,
  steps,
  completedSteps,
  defaultExpanded = false,
  viewAllLabel,
  onViewAll,
}: GettingStartedSummaryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const count = `${completedSteps} of ${steps.length}`;
  const panelRadius = expanded
    ? "rounded-[var(--redesign-sidebar-footer-onboarding-radius)]"
    : "rounded-[var(--redesign-sidebar-footer-onboarding-collapsed-radius)]";
  const triggerRadius = expanded
    ? "rounded-t-[var(--redesign-sidebar-footer-onboarding-trigger-radius)]"
    : "rounded-[var(--redesign-sidebar-footer-onboarding-collapsed-trigger-radius)]";

  return (
    <div
      className={cn(
        panelRadius,
        "border border-[var(--redesign-sidebar-footer-onboarding-border)]",
        "shadow-[var(--redesign-sidebar-footer-onboarding-shadow)]",
        // Same side inset as the collapsed row; 6px top / 8px bottom. The
        // last task row carries ~5.5px of its own space under its circle, so
        // these make the visible gaps equal: panel edge to ring = last circle
        // to panel edge (13.5px). The header shifts down 6px on open.
        expanded && "px-[var(--redesign-quick-actions-padding)] pt-1.5 pb-2",
      )}
      style={{ backgroundColor: "var(--redesign-getting-started-surface)" }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className={cn(
          "w-full text-[length:var(--redesign-font-size-base)] font-normal text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerRadius,
          // One row in both states (ring, label, count), per request -- the
          // label stays beside the ring when expanded instead of wrapping under it.
          "flex h-[var(--redesign-sidebar-footer-row-height)] items-center gap-[var(--redesign-quick-actions-icon-gap)]",
          expanded ? "p-0" : "px-[var(--redesign-quick-actions-padding)]",
          !expanded && "hover:bg-muted/50 hover:text-foreground",
        )}
      >
        <SetupProgressRing completedSteps={completedSteps} totalSteps={steps.length} />
        <span className="min-w-0 flex-1 truncate text-left font-medium">{label}</span>
        <span className="shrink-0 text-[length:var(--redesign-font-size-compact)] text-foreground/70">{count}</span>
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-200 ease-out", expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="-mx-[var(--redesign-sidebar-footer-task-hover-bleed)] min-h-0 w-[calc(100%+2*var(--redesign-sidebar-footer-task-hover-bleed))] overflow-hidden px-[var(--redesign-sidebar-footer-task-hover-bleed)]">
          <div className="flex flex-col gap-1.5 pt-1.5">
            {steps.map((step) => (
              <Popover key={step.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group -mx-[var(--redesign-sidebar-footer-task-hover-bleed)] flex h-[var(--redesign-sidebar-footer-task-row-height)] w-[calc(100%+2*var(--redesign-sidebar-footer-task-hover-bleed))] items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-sidebar-footer-task-hover-bleed)] text-left text-[length:var(--redesign-font-size-base)] font-medium text-foreground/50 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {step.complete ? (
                      <span className="flex size-[var(--redesign-sidebar-footer-task-indicator-size)] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check aria-hidden="true" strokeWidth={2} className="size-[65%]" />
                      </span>
                    ) : (
                      <CircleDashed aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-sidebar-footer-task-indicator-size)] shrink-0 text-current" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="end" className="w-[var(--redesign-sidebar-footer-task-popover-width)] gap-[var(--redesign-sidebar-footer-task-popover-gap)] rounded-[var(--redesign-workspace-menu-radius)] border border-[var(--redesign-sidebar-border)] bg-[var(--redesign-primary-surface)] p-[var(--redesign-sidebar-footer-task-popover-padding)] ring-0">
                  <div className="flex aspect-[var(--redesign-sidebar-footer-task-image-ratio)] items-center justify-center overflow-hidden rounded-[var(--redesign-control-radius)] bg-muted/70 text-muted-foreground/55">
                    {step.image ?? <ImagePlus aria-hidden="true" strokeWidth={1.5} className="size-[var(--redesign-sidebar-footer-task-image-icon-size)]" />}
                  </div>
                  <div>
                    <h3 className="text-[length:var(--redesign-font-size-md)] font-medium text-foreground">{step.label}</h3>
                    {step.description && <p className="mt-[var(--redesign-sidebar-footer-task-description-gap)] text-[length:var(--redesign-font-size-base)] font-medium leading-relaxed text-muted-foreground">{step.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={step.onSelect}
                    className="h-[var(--redesign-sidebar-footer-task-action-height)] self-start rounded-[var(--redesign-dropdown-row-radius)] bg-[var(--focus-accent)] px-[var(--redesign-sidebar-footer-upgrade-padding)] text-[length:var(--redesign-font-size-compact)] font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {step.actionLabel ?? "Start task"}
                  </button>
                </PopoverContent>
              </Popover>
            ))}
            {viewAllLabel && (
              <button
                type="button"
                onClick={onViewAll}
                className="h-auto self-start rounded-[var(--redesign-control-radius)] pt-1.5 text-[length:var(--redesign-font-size-base)] font-medium leading-none text-[var(--focus-accent)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {viewAllLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type SidebarAccountFooterProps = {
  name: string;
  avatar: ReactNode;
  actionSections: readonly (readonly DropdownAction[])[];
};

/** Account dropdown matching the workspace menu's action rows and spacing. */
export function SidebarAccountFooter({ name, avatar, actionSections }: SidebarAccountFooterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          className="flex h-[var(--redesign-sidebar-footer-account-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="size-[var(--redesign-sidebar-footer-avatar-size)] shrink-0 overflow-hidden rounded-full">{avatar}</span>
          <span className="min-w-0 flex-1 truncate text-[length:var(--redesign-sidebar-primary-font-size)] font-medium text-foreground">{name}</span>
          <ChevronsUpDown aria-hidden="true" strokeWidth={1.5} className="size-[var(--redesign-workspace-chevron-size)] shrink-0 text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <RedesignDropdownContent
        side="top"
        align="start"
        sideOffset={6}
        viewportClassName="overflow-visible rounded-[var(--redesign-workspace-menu-radius)] p-0"
      >
        {actionSections.map((section, index) => (
          <div key={section.map((action) => action.id).join("-")}>
            {index > 0 && <RedesignDropdownSeparator />}
            <DropdownActionSection className="gap-[var(--redesign-quick-actions-row-gap)] py-0">
              {section.map((action) => (
                <DropdownActionRow
                  key={action.id}
                  action={action}
                  className="h-[var(--redesign-sidebar-footer-task-row-height)] gap-[var(--redesign-workspace-trigger-gap)] px-[var(--redesign-menu-horizontal-padding)]"
                />
              ))}
            </DropdownActionSection>
          </div>
        ))}
      </RedesignDropdownContent>
    </DropdownMenu>
  );
}
