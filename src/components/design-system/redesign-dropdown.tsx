import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DropdownMenuContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type RedesignDropdownContentProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

/** Shared shell for redesign dropdowns, keeping workspace and account menus visually aligned. */
export function RedesignDropdownContent({
  children,
  className,
  viewportClassName,
  ...props
}: RedesignDropdownContentProps) {
  return (
    <DropdownMenuContent
      className={cn(
        "w-[var(--redesign-workspace-menu-width)] max-h-[calc(100vh-2rem)] rounded-[var(--redesign-workspace-menu-radius)] border !shadow-none",
        className,
      )}
      style={{
        backgroundColor: "var(--redesign-sidebar-overlay-surface)",
        borderColor: "var(--redesign-overlay-border)",
        boxShadow: "none",
      }}
      viewportClassName={cn(
        "max-h-[calc(100vh-2rem)] overflow-visible rounded-[var(--redesign-workspace-menu-radius)] p-0",
        viewportClassName,
      )}
      {...props}
    >
      <div className="flex min-h-full flex-col px-[var(--redesign-workspace-menu-padding)] py-[var(--redesign-workspace-menu-vertical-padding)]">
        {children}
      </div>
    </DropdownMenuContent>
  );
}

export function RedesignDropdownSeparator() {
  return <DropdownMenuSeparator className="mx-[-var(--redesign-workspace-menu-padding)] my-1 bg-foreground/5" />;
}
