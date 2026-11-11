"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

// Listed first while nothing is typed: starting something, then Settings.
const SUGGESTIONS = ["new-chat", "new-bot", "join-chat", "settings"];

type CommandMenuDemoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CommandMenuItemData[];
  /** No provider yet: ⌘K opens nothing (the sidebar's Quick actions is disabled too). */
  disabled?: boolean;
};

/**
 * The app-wide Quick Actions palette. The Fluid Functionalism component owns
 * filtering, keyboard navigation, focus trapping, and the full-screen dialog
 * backdrop; the shell supplies only real, currently available actions.
 */
export function CommandMenuDemo({ open, onOpenChange, items, disabled = false }: CommandMenuDemoProps) {
  const { t } = useTranslation();
  // Tab and type values are the items' group names, which the shell sets from
  // the same keys (RedesignPage), so filtering matches in every language.
  const groups = [t("shell.commands.group.actions"), t("bots.title"), t("nav.chats"), t("nav.settings")];
  const tabs = [{ value: "all", label: t("commandMenu.tabs.all") }, ...groups.map((group) => ({ value: group, label: group }))];
  const types = [{ value: "all", label: t("commandMenu.filters.allTypes") }, ...groups.map((group) => ({ value: group, label: group }))];
  const sorts = [
    { value: "default", label: t("commandMenu.filters.defaultOrder") },
    { value: "az", label: t("commandMenu.filters.aToZ") },
  ];
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
      open={open && !disabled}
      onOpenChange={onOpenChange}
      shortcut={disabled ? null : "mod+k"}
      title={t("shell.quickActions")}
      description={t("commandMenu.description")}
      className="!border !border-white/[0.08] !bg-background/80 backdrop-blur-xl"
      backdropClassName="!bg-background/45 !backdrop-blur-sm"
    >
      <CommandMenu items={visibleItems} suggestions={SUGGESTIONS} suggestionsLabel={t("commandMenu.suggestions")}>
        <CommandMenuInput placeholder={t("commandMenu.placeholder")} />
        <CommandMenuTabs tabs={tabs} value={tab} onValueChange={setTab} tabsLabel={t("commandMenu.filterResults")}>
          <CommandMenuFilters>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger variant="borderless" aria-label={t("commandMenu.filters.type")} />
              <SelectContent>
                {types.map((option, index) => (
                  <SelectItem key={option.value} value={option.value} index={index}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger variant="borderless" aria-label={t("commandMenu.filters.order")} />
              <SelectContent>
                {sorts.map((option, index) => (
                  <SelectItem key={option.value} value={option.value} index={index}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CommandMenuFilters>
        </CommandMenuTabs>
        <CommandMenuList>
          <CommandMenuEmpty>{t("commandMenu.empty")}</CommandMenuEmpty>
        </CommandMenuList>
        <CommandMenuFooter labels={{ select: t("commandMenu.footer.select"), tabs: t("commandMenu.footer.tabs"), close: t("common.close") }} />
      </CommandMenu>
    </CommandMenuDialog>
  );
}
