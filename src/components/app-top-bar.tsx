import { ArrowLeftIcon, ArrowRightIcon, BellIcon, SidebarLeftIcon } from "@/components/icons/untitled-ui";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
} from "@/components/ui/dropdown";
import { NotificationsMenuItems } from "@/components/nav-user";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ICON_PRESS, PRESS_EFFECT } from "@/lib/press-effect";

export function AppTopBar({
  collapsed = false,
  canGoBack = false,
  canGoForward = false,
  onBack,
  onForward,
  onCollapseAll,
  onExpand,
  className,
  controlsClassName,
  showNotifications = true,
  collapseButtonHover = true,
  title,
  titleClassName,
}: {
  collapsed?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  onCollapseAll?: () => void;
  onExpand?: () => void;
  className?: string;
  controlsClassName?: string;
  showNotifications?: boolean;
  collapseButtonHover?: boolean;
  /** Contextual name for the active content, such as its project and chat. */
  title?: ReactNode;
  titleClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-icon-stroke
      data-tauri-drag-region
      onMouseDown={(event) => {
        if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
        if (!("__TAURI_INTERNALS__" in window)) return;
        void import("@tauri-apps/api/core").then(({ invoke }) => invoke("start_window_drag")).catch(() => undefined);
      }}
      className={cn(
        "pointer-events-auto absolute inset-x-0 top-0 z-[110] flex h-[40px] w-full shrink-0 select-none items-center justify-between pr-3 pl-[74px]",
        className ?? "bg-[#111111]",
      )}
    >
      <div className={cn("pointer-events-auto flex items-center gap-2 text-muted-foreground", controlsClassName)}>
        <button type="button" aria-label={t("nav.goBack.ariaLabel")} disabled={!canGoBack} onClick={onBack} className={cn("flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30", PRESS_EFFECT, ICON_PRESS)}>
          <ArrowLeftIcon className="size-[14px]" />
        </button>
        <button type="button" aria-label={t("topBar.goForward")} disabled={!canGoForward} onClick={onForward} className={cn("flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30", PRESS_EFFECT, ICON_PRESS)}>
          <ArrowRightIcon className="size-[14px]" />
        </button>
        <button
          type="button"
          aria-label={collapsed ? t("topBar.expandNavigation") : t("topBar.collapseNavigation")}
          onClick={collapsed ? onExpand : onCollapseAll}
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            PRESS_EFFECT,
            ICON_PRESS,
            collapseButtonHover && "hover:bg-hover-2/50",
          )}
        >
          <SidebarLeftIcon className="size-[14px]" />
        </button>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        {title && <span className={cn("max-w-56 truncate text-[13px] font-medium text-foreground", titleClassName)}>{title}</span>}
        {showNotifications && <BaseDropdownMenu size="compact">
          <BaseDropdownTrigger
            render={
              <button
                type="button"
                aria-label={t("settings.general.notifications")}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-hover-2/50 hover:text-foreground"
              >
                <BellIcon className="size-[14px]" />
              </button>
            }
          />
          <BaseDropdownContent side="bottom" align="end" sideOffset={6} className="w-72 min-w-0 rounded-3xl font-normal">
            <NotificationsMenuItems />
          </BaseDropdownContent>
        </BaseDropdownMenu>}
      </div>
    </div>
  );
}
