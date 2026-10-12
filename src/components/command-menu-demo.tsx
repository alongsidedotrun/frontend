"use client";

import { useMemo, useState } from "react";
import {
  CommandMenu,
  CommandMenuDialog,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuList,
  CommandMenuTabs,
  CommandMenuFilters,
  type CommandMenuItemData,
} from "@/components/ui/command-menu";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

type CommandMenuDemoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CommandMenuItemData[];
};

const TABS = [
  { value: "all", label: "All" },
  { value: "Actions", label: "Actions" },
  { value: "Chats", label: "Chats" },
  { value: "Settings", label: "Settings" },
] as const;

const TYPES = [
  { value: "all", label: "All types" },
  { value: "Actions", label: "Actions" },
  { value: "Chats", label: "Chats" },
  { value: "Settings", label: "Settings" },
] as const;

const SORTS = [
  { value: "default", label: "Default order" },
  { value: "az", label: "A to Z" },
] as const;

/**
 * The app-wide Quick Actions palette. The Fluid Functionalism component owns
 * filtering, keyboard navigation, focus trapping, and the full-screen dialog
 * backdrop; the shell supplies only real, currently available actions.
 */
export function CommandMenuDemo({ open, onOpenChange, items }: CommandMenuDemoProps) {
  const [tab, setTab] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("default");
  const visibleItems = useMemo(() => {
    let visible = items;
    if (tab !== "all") visible = visible.filter((item) => item.group === tab);
    if (type !== "all") visible = visible.filter((item) => item.group === type);
    return sort === "az" ? [...visible].sort((a, b) => a.label.localeCompare(b.label)) : visible;
  }, [items, sort, tab, type]);

  return (
    <CommandMenuDialog
      open={open}
      onOpenChange={onOpenChange}
      shortcut="mod+k"
      title="Quick actions"
      description="Search actions and chats."
      className="!border !border-white/[0.08] !bg-background/80 backdrop-blur-xl"
      backdropClassName="!bg-background/45 !backdrop-blur-sm"
    >
      <CommandMenu items={visibleItems} suggestions={["new-chat", "new-project", "settings"]}>
        <CommandMenuInput placeholder="Search actions and chats…" />
        <CommandMenuTabs tabs={TABS} value={tab} onValueChange={setTab}>
          <CommandMenuFilters>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger variant="borderless" aria-label="Type" />
              <SelectContent>
                {TYPES.map((option, index) => (
                  <SelectItem key={option.value} value={option.value} index={index}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger variant="borderless" aria-label="Order" />
              <SelectContent>
                {SORTS.map((option, index) => (
                  <SelectItem key={option.value} value={option.value} index={index}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CommandMenuFilters>
        </CommandMenuTabs>
        <CommandMenuList>
          <CommandMenuEmpty>No matching actions.</CommandMenuEmpty>
        </CommandMenuList>
        <CommandMenuFooter />
      </CommandMenu>
    </CommandMenuDialog>
  );
}
