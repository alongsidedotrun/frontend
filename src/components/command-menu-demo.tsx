"use client";

import {
  CommandMenu,
  CommandMenuDialog,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuList,
  type CommandMenuItemData,
} from "@/components/ui/command-menu";

type CommandMenuDemoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CommandMenuItemData[];
};

/**
 * The app-wide Quick Actions palette. The Fluid Functionalism component owns
 * filtering, keyboard navigation, focus trapping, and the full-screen dialog
 * backdrop; the shell supplies only real, currently available actions.
 */
export function CommandMenuDemo({ open, onOpenChange, items }: CommandMenuDemoProps) {
  return (
    <CommandMenuDialog
      open={open}
      onOpenChange={onOpenChange}
      shortcut="mod+k"
      title="Quick actions"
      description="Search actions and chats."
    >
      <CommandMenu items={items} suggestions={["new-chat"]}>
        <CommandMenuInput placeholder="Search actions and chats…" />
        <CommandMenuList>
          <CommandMenuEmpty>No matching actions.</CommandMenuEmpty>
        </CommandMenuList>
        <CommandMenuFooter />
      </CommandMenu>
    </CommandMenuDialog>
  );
}
