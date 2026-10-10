import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SplitViewProps = {
  sidebar: ReactNode;
  children: ReactNode;
  topBar?: ReactNode;
  sidebarCollapsed?: boolean;
  className?: string;
  sidebarClassName?: string;
  sidebarContentClassName?: string;
  contentClassName?: string;
};

/**
 * A layout primitive for sections whose navigation controls a single content
 * area. The width is deliberately owned by the design token, rather than by
 * individual screens, so it can be tuned once for every future use.
 */
export function SplitView({
  sidebar,
  children,
  topBar,
  sidebarCollapsed = false,
  className,
  sidebarClassName,
  sidebarContentClassName,
  contentClassName,
}: SplitViewProps) {
  return (
    <main className={cn("relative h-dvh overflow-hidden bg-background", className)}>
      {topBar}
      <div className="flex h-full pt-10">
        <aside
          className={cn(
            "shrink-0 overflow-hidden border-r border-[var(--redesign-sidebar-border)] transition-[width,border-color] duration-200 ease-out",
            sidebarCollapsed ? "w-0 border-r-0" : "w-[var(--redesign-sidebar-width)]",
            sidebarClassName,
          )}
        >
          <div
            className={cn(
              "flex h-full min-h-0 w-[var(--redesign-sidebar-width)] flex-none flex-col px-[var(--redesign-sidebar-edge-padding)] pt-[var(--redesign-sidebar-top-padding)] pb-[var(--redesign-sidebar-edge-padding)] [container-type:inline-size]",
              sidebarContentClassName,
            )}
          >
            {sidebar}
          </div>
        </aside>
        <section className={cn("min-w-0 flex-1", contentClassName)}>{children}</section>
      </div>
    </main>
  );
}
