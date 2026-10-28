import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleCheck, CircleDashed, X } from "lucide-react";
import { LogInIcon, SettingsIcon } from "@/components/icons/untitled-ui";
import { Backdrop } from "@/components/design-system/backdrop";
import { cn } from "@/lib/utils";
import { ICON_PRESS, PRESS_EFFECT } from "@/lib/press-effect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DropdownActionRow, DropdownActionSection, type DropdownAction } from "@/components/design-system/dropdown-action-list";
import { RedesignDropdownContent, RedesignDropdownSeparator } from "@/components/design-system/redesign-dropdown";
import { ProgressRing } from "@/components/design-system/task-progress";

export type GettingStartedStep = {
  id: string;
  label: string;
  description?: string;
  image?: ReactNode;
  actionLabel?: string;
  complete?: boolean;
  /** Not yet: shown dimmed, with no popover (e.g. everything but setting up a provider, until one is). */
  disabled?: boolean;
  onSelect?: () => void;
};

type GettingStartedSummaryProps = {
  label: string;
  steps: readonly GettingStartedStep[];
  completedSteps: number;
  defaultExpanded?: boolean;
  viewAllLabel?: string;
  onViewAll?: () => void;
  /** Once every step is done, the count becomes an X that calls this. */
  onDismiss?: () => void;
};

// Open or closed, as the person last left it on this device.
const EXPANDED_KEY = "alongside_getting_started_expanded";

function readExpanded(fallback: boolean) {
  try {
    const stored = localStorage.getItem(EXPANDED_KEY);
    return stored === null ? fallback : stored === "1";
  } catch {
    return fallback;
  }
}

/** Collapsible setup summary for any sidebar surface. Open the first time; then as last left. */
export function GettingStartedSummary({
  label,
  steps,
  completedSteps,
  defaultExpanded = true,
  viewAllLabel,
  onViewAll,
  onDismiss,
}: GettingStartedSummaryProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(() => readExpanded(defaultExpanded));
  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
    } catch {
      // storage blocked: as toggled, for this session
    }
  };
  const count = t("shell.gettingStarted.count", { done: completedSteps, total: steps.length });
  const allDone = steps.length > 0 && completedSteps >= steps.length;
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
      <div className="relative">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={toggleExpanded}
        className={cn(
          // Full colour in both states: unlike the muted sidebar rows, this is a
          // reminder that should stand out.
          "w-full text-chat font-normal text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerRadius,
          // One row in both states (ring, label, count), per request -- the
          // label stays beside the ring when expanded instead of wrapping under it.
          "flex h-[var(--redesign-sidebar-footer-row-height)] items-center gap-[var(--redesign-quick-actions-icon-gap)]",
          expanded ? "p-0" : "px-[var(--redesign-quick-actions-padding)]",
          !expanded && "hover:bg-muted/50 hover:text-foreground",
        )}
      >
        {allDone ? (
          // Everything done: a solid green tick in place of the ring.
          <span className="flex size-[var(--redesign-sidebar-footer-progress-size)] shrink-0 items-center justify-center rounded-full bg-[var(--redesign-success)] text-white animate-[redesign-progress-ring_400ms_ease-out]">
            <Check aria-hidden="true" strokeWidth={3} style={{ vectorEffect: "none" }} className="size-[65%]" />
          </span>
        ) : (
          <ProgressRing completedSteps={completedSteps} totalSteps={steps.length} />
        )}
        <span className="min-w-0 flex-1 truncate text-left font-medium">{label}</span>
        {/* Room for the X (a sibling, as buttons can't nest) once all done. */}
        {allDone && onDismiss ? <span aria-hidden="true" className="size-5 shrink-0" /> : <span className="shrink-0 text-ui-xs">{count}</span>}
      </button>
      {allDone && onDismiss && (
        <button
          type="button"
          aria-label={t("shell.gettingStarted.dismiss")}
          onClick={onDismiss}
          className={cn(
            "absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-[var(--redesign-dropdown-row-radius)] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            expanded ? "right-0" : "right-[var(--redesign-quick-actions-padding)]",
            PRESS_EFFECT,
            ICON_PRESS,
          )}
        >
          <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </button>
      )}
      </div>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-160 ease-out", expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="-mx-[var(--redesign-sidebar-footer-task-hover-bleed)] min-h-0 w-[calc(100%+2*var(--redesign-sidebar-footer-task-hover-bleed))] overflow-hidden px-[var(--redesign-sidebar-footer-task-hover-bleed)]">
          <div className="flex flex-col gap-1.5 pt-1.5">
            {steps.map((step) =>
              step.disabled ? (
                // Inactive: the same row, dimmed, doing nothing.
                <div
                  key={step.id}
                  aria-disabled="true"
                  className="-mx-[var(--redesign-sidebar-footer-task-hover-bleed)] flex h-[var(--redesign-sidebar-footer-task-row-height)] w-[calc(100%+2*var(--redesign-sidebar-footer-task-hover-bleed))] cursor-default items-center gap-[var(--redesign-quick-actions-icon-gap)] px-[var(--redesign-sidebar-footer-task-hover-bleed)] text-chat font-medium text-foreground/25"
                >
                  {step.complete ? (
                    <CircleCheck aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-sidebar-footer-task-indicator-size)] shrink-0" />
                  ) : (
                    <CircleDashed aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-sidebar-footer-task-indicator-size)] shrink-0" />
                  )}
                  <span className={cn("truncate", step.complete && "line-through")}>{step.label}</span>
                </div>
              ) : (
              <Popover key={step.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group -mx-[var(--redesign-sidebar-footer-task-hover-bleed)] flex h-[var(--redesign-sidebar-footer-task-row-height)] w-[calc(100%+2*var(--redesign-sidebar-footer-task-hover-bleed))] items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-sidebar-footer-task-hover-bleed)] text-left text-chat font-medium text-foreground/50 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {step.complete ? (
                      // Done: an outlined tick and the label struck through.
                      <CircleCheck aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-sidebar-footer-task-indicator-size)] shrink-0 text-muted-foreground" />
                    ) : (
                      <CircleDashed aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-sidebar-footer-task-indicator-size)] shrink-0 text-current" />
                    )}
                    <span className={cn("truncate", step.complete && "text-muted-foreground line-through decoration-muted-foreground/70")}>{step.label}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="end" className="w-[var(--redesign-sidebar-footer-task-popover-width)] gap-[var(--redesign-sidebar-footer-task-popover-gap)] rounded-[var(--redesign-workspace-menu-radius)] border border-[var(--redesign-sidebar-border)] bg-[var(--redesign-primary-surface)] p-[var(--redesign-sidebar-footer-task-popover-padding)] ring-0">
                  <div className="relative flex aspect-[var(--redesign-sidebar-footer-task-image-ratio)] items-center justify-center overflow-hidden rounded-[var(--redesign-control-radius)] bg-muted/70 text-muted-foreground/55">
                    {step.image ?? <Backdrop />}
                  </div>
                  <div>
                    <h3 className="text-ui-xl font-medium text-foreground">{step.label}</h3>
                    {step.description && <p className="mt-[var(--redesign-sidebar-footer-task-description-gap)] text-chat font-medium leading-relaxed text-muted-foreground">{step.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={step.onSelect}
                    className="h-[var(--redesign-sidebar-footer-task-action-height)] self-start rounded-[var(--redesign-dropdown-row-radius)] bg-[var(--focus-accent)] px-[var(--redesign-sidebar-footer-upgrade-padding)] text-ui-xs font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {step.actionLabel ?? t("shell.gettingStarted.startTask")}
                  </button>
                </PopoverContent>
              </Popover>
              ),
            )}
            {viewAllLabel && (
              <button
                type="button"
                onClick={onViewAll}
                className="h-auto self-start rounded-[var(--redesign-control-radius)] pt-1.5 text-chat font-medium leading-none text-[var(--focus-accent)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  /** Signed out: the left side is a Sign in button instead of the profile. */
  signedIn: boolean;
  onSignIn: () => void;
  /** The settings button on the right goes straight to Settings. */
  onOpenSettings: () => void;
  /** Menu opened by clicking the profile once signed in (profile, help, upgrade, sign out). */
  profileSections: readonly (readonly DropdownAction[])[];
};

/**
 * Account row: Sign in (signed out) or the profile (signed in, opening the
 * profile menu) on the left, and a settings button on the right.
 */
export function SidebarAccountFooter({ name, avatar, signedIn, onSignIn, onOpenSettings, profileSections }: SidebarAccountFooterProps) {
  const { t } = useTranslation();
  const rowButton =
    "flex h-full min-w-0 flex-1 items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left text-chat font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="flex h-[var(--redesign-sidebar-footer-account-row-height)] w-full items-center gap-1">
      {signedIn ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t("shell.profileMenu.open")} className={rowButton}>
              <span className="size-[var(--redesign-sidebar-footer-avatar-size)] shrink-0 overflow-hidden rounded-full">{avatar}</span>
              <span className="min-w-0 flex-1 truncate">{name}</span>
            </button>
          </DropdownMenuTrigger>
          <RedesignDropdownContent
            side="top"
            align="start"
            sideOffset={6}
            viewportClassName="overflow-visible rounded-[var(--redesign-workspace-menu-radius)] p-0"
          >
            {profileSections.map((section, index) => (
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
      ) : (
        // Muted like New chat; the signed-in name above keeps the full text colour.
        <button type="button" onClick={onSignIn} className={cn(rowButton, "text-muted-foreground hover:text-foreground")}>
          <LogInIcon aria-hidden="true" className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />
          <span className="truncate">{t("common.signIn")}</span>
        </button>
      )}
      <button
        type="button"
        aria-label={t("nav.settings")}
        onClick={onOpenSettings}
        className={cn("grid size-7 shrink-0 place-items-center rounded-[var(--redesign-control-radius)] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", PRESS_EFFECT, ICON_PRESS)}
      >
        <SettingsIcon aria-hidden="true" className="size-[var(--redesign-workspace-chevron-size)]" />
      </button>
    </div>
  );
}
