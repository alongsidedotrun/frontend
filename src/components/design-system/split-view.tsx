import type { ReactNode } from "react";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type SplitViewProps = {
  sidebar: ReactNode;
  children: ReactNode;
  topBar?: ReactNode;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
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
  onSidebarCollapsedChange,
  className,
  sidebarClassName,
  sidebarContentClassName,
  contentClassName,
}: SplitViewProps) {
  return (
    <SidebarProvider
      open={!sidebarCollapsed}
      onOpenChange={(open) => onSidebarCollapsedChange?.(!open)}
      width="var(--redesign-sidebar-width)"
      widthMobile="min(18rem, calc(100vw - 1rem))"
      className={cn("h-dvh overflow-hidden bg-background", className)}
    >
      {topBar}
      <Sidebar
        collapsible="offcanvas"
        bordered={false}
        rail={false}
        className={cn("mt-10 h-[calc(100svh-2.5rem)] bg-[var(--redesign-sidebar-surface)]", sidebarClassName)}
      >
        <div
          className={cn(
            "flex h-full min-h-0 w-full flex-none flex-col border-r border-[var(--redesign-sidebar-border)] bg-[var(--redesign-sidebar-surface)] px-[var(--redesign-sidebar-edge-padding)] pt-[var(--redesign-sidebar-top-padding)] pb-[var(--redesign-sidebar-edge-padding)] [container-type:inline-size]",
            sidebarContentClassName,
          )}
        >
          {sidebar}
        </div>
      </Sidebar>
      <SidebarInset className="pt-10">
        <section className={cn("min-h-0 min-w-0 flex-1", contentClassName)}>{children}</section>
      </SidebarInset>
    </SidebarProvider>
  );
}
