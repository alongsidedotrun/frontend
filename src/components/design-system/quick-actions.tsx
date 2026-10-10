import type { ComponentType } from "react";
import { Command } from "lucide-react";
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
  className?: string;
};

/**
 * Reusable compact navigation for a sidebar. Its actions and command handler
 * are supplied by the owning surface so this primitive never owns routes.
 */
export function QuickActions({ label, shortcut, actions, activeId, onActionSelect, onOpen, className }: QuickActionsProps) {
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-[var(--redesign-quick-actions-gap)]", className)}>
      <button
        type="button"
        onClick={onOpen}
        className="group/quick-actions-trigger flex h-[var(--redesign-quick-actions-trigger-height)] w-full items-center rounded-[var(--redesign-control-radius)] border border-[var(--redesign-sidebar-border)] px-[var(--redesign-quick-actions-padding)] text-[length:var(--redesign-font-size-base)] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-[var(--redesign-quick-actions-shortcut-gap)] text-[length:var(--redesign-font-size-base)] text-muted-foreground transition-colors group-hover/quick-actions-trigger:text-foreground group-focus-visible/quick-actions-trigger:text-foreground" aria-label={`Command ${shortcut}`}>
          <Command aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-command-icon-size)]" />
          <span className="text-[length:var(--redesign-font-size-base)]">{shortcut}</span>
        </span>
        <span className="ml-[var(--redesign-quick-actions-icon-gap)] min-w-0 flex-1 text-left">{label}</span>
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
              className={cn(
                "flex h-[var(--redesign-quick-actions-row-height)] items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-[length:var(--redesign-font-size-base)] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "bg-muted text-foreground",
              )}
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
