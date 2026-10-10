import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type SidebarAction = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  onSelect?: () => void;
};

type SidebarActionsProps = {
  actions: readonly SidebarAction[];
  className?: string;
};

/** Reusable action rows that sit above a surface's grouped sidebar content. */
export function SidebarActions({ actions, className }: SidebarActionsProps) {
  return (
    <div className={cn("flex flex-col gap-[var(--redesign-quick-actions-row-gap)]", className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={action.onSelect}
            className="flex h-[var(--redesign-quick-actions-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left text-[length:var(--redesign-font-size-base)] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />
            <span className="truncate">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
