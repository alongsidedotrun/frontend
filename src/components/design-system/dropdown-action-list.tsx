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
export function DropdownActionRow({ action }: { action: DropdownAction }) {
  const Icon = action.icon;
  return (
    <DropdownMenuItem
      onSelect={action.onSelect}
      className={cn(
        "h-[var(--redesign-workspace-row-height)] rounded-[var(--redesign-dropdown-row-radius)] px-[var(--redesign-menu-row-padding)] text-[length:var(--redesign-dropdown-font-size)] font-normal text-foreground/70",
        action.tone === "accent" && "text-focus-accent focus:text-focus-accent",
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-[var(--redesign-workspace-action-icon-size)] shrink-0" />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
    </DropdownMenuItem>
  );
}

export function DropdownActionSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-[var(--redesign-menu-row-gap)] py-[var(--redesign-menu-section-block-padding)]", className)}>{children}</div>;
}
