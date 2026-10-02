import { ArrowLeftIcon, ArrowRightIcon, BellIcon, SidebarLeftIcon } from "@/components/icons/untitled-ui";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
} from "@/components/ui/dropdown";
import { NotificationsMenuItems } from "@/components/nav-user";

export function AppTopBar({
  collapsed = false,
  canGoBack = false,
  canGoForward = false,
  onBack,
  onForward,
  onCollapseAll,
  onExpand,
}: {
  collapsed?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  onCollapseAll?: () => void;
  onExpand?: () => void;
}) {
  return (
    <div
      data-tauri-drag-region
      onMouseDown={(event) => {
        if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
        if (!("__TAURI_INTERNALS__" in window)) return;
        void import("@tauri-apps/api/core").then(({ invoke }) => invoke("start_window_drag")).catch(() => undefined);
      }}
      className="pointer-events-auto absolute inset-x-0 top-0 z-[110] flex h-[40px] w-full shrink-0 select-none items-center justify-between bg-[#1a1a1a] pr-3 pl-[74px]"
    >
      <div className="pointer-events-auto flex items-center gap-2 text-muted-foreground">
        <button type="button" aria-label="Go back" disabled={!canGoBack} onClick={onBack} className="flex size-7 items-center justify-center rounded-md hover:bg-hover-2/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
          <ArrowLeftIcon className="size-[14px]" />
        </button>
        <button type="button" aria-label="Go forward" disabled={!canGoForward} onClick={onForward} className="flex size-7 items-center justify-center rounded-md hover:bg-hover-2/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
          <ArrowRightIcon className="size-[14px]" />
        </button>
        <button
          type="button"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={collapsed ? onExpand : onCollapseAll}
          className="flex size-7 items-center justify-center rounded-md hover:bg-hover-2/50 hover:text-foreground"
        >
          <SidebarLeftIcon className="size-[14px]" />
        </button>
      </div>
      <BaseDropdownMenu size="compact">
        <BaseDropdownTrigger
          render={
            <button
              type="button"
              aria-label="Notifications"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-hover-2/50 hover:text-foreground"
            >
              <BellIcon className="size-[14px]" />
            </button>
          }
        />
        <BaseDropdownContent side="bottom" align="end" sideOffset={6} className="w-72 min-w-0 rounded-3xl font-normal">
          <NotificationsMenuItems />
        </BaseDropdownContent>
      </BaseDropdownMenu>
    </div>
  );
}
