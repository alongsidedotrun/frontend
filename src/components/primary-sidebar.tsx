import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { useGettingStarted } from "@/hooks/use-getting-started";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
  DropdownLabel as BaseDropdownLabel,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { AccountMenuItems } from "@/components/nav-user";
import {
  AlertCircleIcon,
  CodeBrowserIcon,
  DocsIcon,
  MessageChatCircleIcon,
  InboxIcon,
  SettingsIcon,
} from "@/components/icons/untitled-ui";

type PrimarySidebarProps = {
  collapsed: boolean;
  onOpenSettings: () => void;
  onNavigate?: (path: string) => void;
};

export const PRIMARY_SIDEBAR_WIDTH = 56;

function RailItem({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-xl text-white transition-colors duration-150 ${
        active ? "bg-hover-2/70 text-white" : "text-white hover:bg-hover-2/50"
      }`}
    >
      {children}
    </button>
  );
}

export function PrimarySidebar({ collapsed, onOpenSettings, onNavigate }: PrimarySidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateTo = onNavigate ?? navigate;
  const { show: showGettingStarted } = useGettingStarted();

  return (
    <aside
      aria-hidden={collapsed}
      style={{
        width: collapsed ? 0 : PRIMARY_SIDEBAR_WIDTH,
        paddingLeft: collapsed ? 0 : 8,
        paddingRight: collapsed ? 0 : 8,
      }}
      className="relative z-[100] flex h-full shrink-0 flex-col items-center overflow-hidden bg-[#111111] py-2 text-white transition-[width,padding] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
    >
      <div className="flex w-full flex-col items-center">
        <div aria-hidden className="size-7" />
        <AnimatePresence initial={false}>
          {showGettingStarted && (
            <motion.div
              key="getting-started"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 32, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 overflow-hidden"
            >
              <div className="flex h-8 items-end justify-center">
                <button
                  type="button"
                  aria-label="Getting started"
                  title="Getting started"
                  onClick={() => navigateTo("/getting-started")}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-xl text-white transition-colors duration-150 hover:bg-hover-2/50 ${location.pathname === "/getting-started" ? "bg-hover-2/70" : ""}`}
                >
                  <AlongsideLogo className="size-[14px]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav aria-label="Primary navigation" className="mt-3 flex flex-col items-center gap-1">
        <RailItem label="Inbox" active={location.pathname === "/inbox"} onClick={() => navigateTo("/inbox")}>
          <InboxIcon className="size-[14px]" />
        </RailItem>
        <RailItem label="Chats" active={location.pathname === "/new/chat" || location.pathname.startsWith("/chat/")} onClick={() => navigateTo("/new/chat")}>
          <MessageChatCircleIcon className="size-[14px]" />
        </RailItem>
        <RailItem label="Code Browser" active={location.pathname === "/code"} onClick={() => navigateTo("/code")}>
          <CodeBrowserIcon className="size-[14px]" />
        </RailItem>
      </nav>

      <div className="mt-auto">
        <BaseDropdownMenu size="compact">
          <BaseDropdownTrigger
            render={
              <button
                type="button"
                aria-label="Settings and help"
                className={`flex size-7 items-center justify-center rounded-xl text-white transition-colors duration-150 hover:bg-hover-2/50 ${location.pathname.startsWith("/settings") ? "bg-hover-2/70" : ""}`}
              >
                <SettingsIcon className="size-[14px]" />
              </button>
            }
          />
          <BaseDropdownContent side="right" align="end" sideOffset={8}>
            <BaseDropdownLabel>Profile</BaseDropdownLabel>
            <AccountMenuItems showProfile={false} />
            <DropdownSeparator />
            <BaseDropdownLabel>Settings</BaseDropdownLabel>
            <BaseMenuItem index={1} icon={SettingsIcon} label="Settings" onSelect={onOpenSettings} />
            <DropdownSeparator />
            <BaseDropdownLabel>Help</BaseDropdownLabel>
            <BaseMenuItem
              index={2}
              icon={DocsIcon}
              label="Documentation"
              disabled
              badgeInline
              badge={
                <span className="ml-2 shrink-0 text-[10px] font-normal text-muted-foreground/60">
                  Coming Soon
                </span>
              }
            />
            <BaseMenuItem
              index={3}
              icon={AlertCircleIcon}
              label="Report issue"
              disabled
              badgeInline
              badge={
                <span className="ml-2 shrink-0 text-[10px] font-normal text-muted-foreground/60">
                  Coming Soon
                </span>
              }
            />
          </BaseDropdownContent>
        </BaseDropdownMenu>
      </div>
    </aside>
  );
}
