import type { ComponentType } from "react";
import { Command } from "lucide-react";
import { fontWeights } from "@/lib/font-weight";
import { useSize } from "@/lib/size-context";
import { cn } from "@/lib/utils";

export type QuickActionItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  onSelect?: () => void;
};

type QuickActionsProps = {
  label: string;
  shortcut: string;
  actions: readonly QuickActionItem[];
  activeId?: string;
  onActionSelect?: (actionId: string) => void;
  onOpen?: () => void;
  /** The search field can't be used yet (no provider set up): dimmed, not clickable. */
  disabled?: boolean;
  className?: string;
};

/**
 * Reusable compact navigation for a sidebar. Its actions and command handler
 * are supplied by the owning surface so this primitive never owns routes.
 */
export function QuickActions({ label, shortcut, actions, activeId, onActionSelect, onOpen, disabled = false, className }: QuickActionsProps) {
  const size = useSize();
  // h-7 (28px), matching the sidebar rows -- slimmer, per request.
  const searchFieldHeight = "h-7";

  return (
    <nav aria-label={label} className={cn("flex flex-col gap-[var(--redesign-quick-actions-gap)]", className)}>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className={cn(
          "group/quick-actions-trigger flex w-full items-center disabled:pointer-events-none disabled:opacity-50 rounded-[var(--redesign-control-radius)] border border-[var(--redesign-sidebar-border)] bg-[var(--redesign-quick-actions-surface)] px-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          searchFieldHeight,
          size.text,
        )}
      >
        <span
          className="min-w-0 flex-1 text-left text-muted-foreground transition-colors group-hover/quick-actions-trigger:text-foreground group-focus-visible/quick-actions-trigger:text-foreground"
          style={{ fontVariationSettings: fontWeights.medium }}
        >
          {label}
        </span>
        <span
          className={cn(
            "ml-2 flex shrink-0 items-center gap-1 text-muted-foreground transition-colors group-hover/quick-actions-trigger:text-foreground group-focus-visible/quick-actions-trigger:text-foreground",
            size.type.micro,
          )}
          aria-label={`Command ${shortcut}`}
        >
          <Command aria-hidden="true" strokeWidth={1.5} className="size-[1em]" />
          <span style={{ fontVariationSettings: fontWeights.medium }}>{shortcut}</span>
        </span>
      </button>
      <div className="flex flex-col gap-[var(--redesign-quick-actions-row-gap)]">
        {actions.map((action) => {
          const Icon = action.icon;
          const isActive = action.id === activeId;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                onActionSelect?.(action.id);
                action.onSelect?.();
              }}
              aria-current={isActive ? "page" : undefined}
              className="flex h-[var(--redesign-quick-actions-row-height)] items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-chat font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />
              <span className="truncate">{action.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
