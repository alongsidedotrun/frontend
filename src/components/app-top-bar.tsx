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
  actions,
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
  /** Controls at the right end, such as a chat's Share button. */
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-icon-stroke
      // The desktop window's title bar: pressing anywhere on the bar drags the window
      // (double-click zooms), including on the chat's name; buttons stay buttons. "deep", because
      // a bare attribute only counts presses on the bar itself, not on what's inside it.
      data-tauri-drag-region="deep"
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
        {title && <span className={cn("max-w-56 truncate text-[length:var(--redesign-chat-text)] font-medium text-foreground", titleClassName)}>{title}</span>}
        {/* Pinned to the right end: the shell positions the controls and the
            title absolutely, so nothing else here pushes this over. */}
        {actions && <div className="absolute right-3 flex items-center gap-2">{actions}</div>}
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
