import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronsUpDown, CircleDashed, ImagePlus } from "lucide-react";
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
        "border border-[var(--redesign-overlay-border)]",
        expanded && "p-[var(--redesign-sidebar-footer-onboarding-padding)]",
      )}
      style={{ backgroundColor: "var(--redesign-sidebar-overlay-surface)" }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className={cn(
          "w-full text-[length:var(--redesign-font-size-base)] text-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerRadius,
          expanded
            ? "flex min-h-[var(--redesign-sidebar-footer-row-height)] flex-col items-stretch gap-2 p-0"
            : "flex h-[var(--redesign-sidebar-footer-row-height)] items-center gap-[var(--redesign-quick-actions-icon-gap)] px-[var(--redesign-quick-actions-padding)]",
          !expanded && "hover:bg-muted/50 hover:text-foreground",
        )}
      >
        {expanded ? (
          <>
            <span className="flex items-center">
              <SetupProgressRing completedSteps={completedSteps} totalSteps={steps.length} />
              <span className="ml-auto shrink-0 text-[length:var(--redesign-font-size-compact)] text-foreground/70">{count}</span>
              <ChevronDown aria-hidden="true" strokeWidth={2} className="ml-[var(--redesign-quick-actions-icon-gap)] size-[var(--redesign-sidebar-footer-chevron-size)] shrink-0 rotate-180 transition-transform duration-200" />
            </span>
            <span className="min-w-0 truncate py-2 text-left">{label}</span>
          </>
        ) : (
          <>
            <SetupProgressRing completedSteps={completedSteps} totalSteps={steps.length} />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            <span className="shrink-0 text-[length:var(--redesign-font-size-compact)] text-foreground/70">{count}</span>
            <ChevronDown aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-sidebar-footer-chevron-size)] shrink-0 transition-transform duration-200" />
          </>
        )}
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-200 ease-out", expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-[var(--redesign-quick-actions-row-gap)] p-0">
            {steps.map((step) => (
              <Popover key={step.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group flex h-[var(--redesign-sidebar-footer-task-row-height)] items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] text-left text-[length:var(--redesign-font-size-base)] text-foreground opacity-50 transition-[color,opacity] hover:bg-muted/70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    {step.description && <p className="mt-[var(--redesign-sidebar-footer-task-description-gap)] text-[length:var(--redesign-font-size-base)] leading-relaxed text-muted-foreground">{step.description}</p>}
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
                className="h-auto self-start rounded-[var(--redesign-control-radius)] pt-2 text-[length:var(--redesign-font-size-base)] font-medium leading-none text-[var(--focus-accent)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <span className="min-w-0 flex-1 truncate text-[length:var(--redesign-font-size-base)] text-foreground/70">{name}</span>
          <ChevronsUpDown aria-hidden="true" strokeWidth={1.5} className="size-[var(--redesign-workspace-chevron-size)] shrink-0 text-muted-foreground" />
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
                  className="mx-[-var(--redesign-workspace-menu-padding)] h-[var(--redesign-sidebar-footer-task-row-height)] gap-[var(--redesign-workspace-trigger-gap)] px-[var(--redesign-menu-horizontal-padding)]"
                />
              ))}
            </DropdownActionSection>
          </div>
        ))}
      </RedesignDropdownContent>
    </DropdownMenu>
  );
}
