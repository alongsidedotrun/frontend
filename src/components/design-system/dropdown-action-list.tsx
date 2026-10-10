import type { ComponentType, ReactNode } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DropdownAction = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: "default" | "accent";
  onSelect?: () => void;
};

/** Shared compact action rows for the workspace and account dropdowns. */
export function DropdownActionRow({ action, className }: { action: DropdownAction; className?: string }) {
  const Icon = action.icon;
  return (
    <DropdownMenuItem
      onSelect={action.onSelect}
      className={cn(
        "h-[var(--redesign-workspace-row-height)] rounded-[var(--redesign-dropdown-row-radius)] px-[var(--redesign-menu-row-padding)] text-[length:var(--redesign-dropdown-font-size)] font-normal text-foreground/70",
        action.tone === "accent" && "!text-focus-accent hover:!text-focus-accent focus:!text-focus-accent",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn(
          "size-[var(--redesign-workspace-action-icon-size)] shrink-0",
          action.tone === "accent" && "!text-focus-accent",
        )}
      />
      <span className={cn("min-w-0 flex-1 truncate", action.tone === "accent" && "!text-focus-accent")}>
        {action.label}
      </span>
    </DropdownMenuItem>
  );
}

export function DropdownActionSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-[var(--redesign-menu-row-gap)] py-[var(--redesign-menu-section-block-padding)]", className)}>{children}</div>;
}
