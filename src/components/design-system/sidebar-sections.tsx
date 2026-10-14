import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { ICON_PRESS, PRESS_EFFECT } from "@/lib/press-effect";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownSubItem,
  DropdownSubMenuItem,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { MoreTrigger } from "@/components/ui/more-trigger";

/** A row's "..." menu: actions, a nested list (e.g. Add to project), dividers,
 *  and "rename", which edits the row's label in place (then onRename). */
export type SidebarItemMenuEntry =
  | { kind: "action"; id: string; label: string; icon?: IconComponent; onSelect: () => void; destructive?: boolean }
  | { kind: "rename"; id: string; label: string; icon?: IconComponent }
  | {
      kind: "submenu";
      id: string;
      label: string;
      icon?: IconComponent;
      entries: readonly { id: string; label: string; checked?: boolean; onSelect: () => void }[];
    }
  | { kind: "separator"; id: string };

export type SidebarSectionItem = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  menu?: readonly SidebarItemMenuEntry[];
  /** Called with the new name when an in-place rename is confirmed. */
  onRename?: (name: string) => void;
};

export type SidebarSectionAction = {
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  onSelect: () => void;
};

export type SidebarSection = {
  id: string;
  label: string;
  items?: readonly SidebarSectionItem[];
  emptyLabel?: string;
  action?: SidebarSectionAction;
};

type SidebarSectionsProps = {
  sections: readonly SidebarSection[];
  activeItemId?: string;
  onItemSelect?: (itemId: string) => void;
  className?: string;
};

/**
 * Data-driven sidebar groups. A surface may begin with headings only and add
 * rows later without changing the surrounding navigation layout.
 */
export function SidebarSections({ sections, activeItemId, onItemSelect, className }: SidebarSectionsProps) {
  return (
    <div className={cn("flex flex-col gap-[var(--redesign-sidebar-section-gap)]", className)}>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`sidebar-section-${section.id}`}>
          <div className="flex h-[var(--redesign-quick-actions-row-height)] items-center px-[var(--redesign-quick-actions-padding)]">
            <h2
              id={`sidebar-section-${section.id}`}
              className="text-[length:var(--redesign-font-size-compact)] font-medium text-muted-foreground"
            >
              {section.label}
            </h2>
            {section.action ? (() => {
              const Icon = section.action.icon;
              return (
                <button
                  type="button"
                  aria-label={section.action.label}
                  onClick={section.action.onSelect}
                  className={cn("ml-auto flex size-[var(--redesign-quick-actions-icon-size)] items-center justify-center rounded-[var(--redesign-dropdown-row-radius)] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", PRESS_EFFECT, ICON_PRESS)}
                >
                  <Icon aria-hidden="true" strokeWidth={2} className="size-[calc(var(--redesign-font-size-compact)-1px)]" />
                </button>
              );
            })() : null}
          </div>
          {section.items?.length ? (
            <div className="mt-[var(--redesign-sidebar-section-row-offset)] flex flex-col gap-[var(--redesign-quick-actions-row-gap)]">
              {section.items.map((item) => (
                <SidebarRow key={item.id} item={item} active={item.id === activeItemId} onSelect={() => onItemSelect?.(item.id)} />
              ))}
            </div>
          ) : section.emptyLabel ? (
            <p className="mt-[var(--redesign-sidebar-section-row-offset)] px-[var(--redesign-quick-actions-padding)] text-[length:var(--redesign-font-size-base)] font-medium text-muted-foreground opacity-70">
              {section.emptyLabel}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** One row: the item itself, its "..." menu on hover, and in-place rename. */
function SidebarRow({ item, active, onSelect }: { item: SidebarSectionItem; active: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const Icon = item.icon;
  const rowClass = cn(
    "flex h-[var(--redesign-quick-actions-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left text-[length:var(--redesign-sidebar-primary-font-size)] font-normal text-muted-foreground transition-colors",
    (active || menuOpen) && "bg-muted font-medium text-foreground",
  );

  if (renaming) {
    const finish = (save: boolean) => {
      setRenaming(false);
      const name = draft.trim();
      if (save && name && name !== item.label) item.onRename?.(name);
    };
    return (
      <div className={rowClass}>
        {Icon && <Icon aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />}
        <input
          autoFocus
          aria-label={t("common.rename")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={() => finish(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") finish(false);
          }}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
        />
      </div>
    );
  }

  let index = 0;
  return (
    <div className="group/sidebar-row relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={cn(
          rowClass,
          "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          item.menu && "pr-8",
        )}
      >
        {Icon && <Icon aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />}
        <span className="truncate">{item.label}</span>
      </button>
      {item.menu && (
        <DropdownMenu size="compact" open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownTrigger
            render={
              <MoreTrigger
                aria-label={t("shell.rowOptions", { name: item.label })}
                active={menuOpen}
                autoHide={false}
                className={cn(
                  "absolute top-1/2 right-1.5 -translate-y-1/2 transition-opacity",
                  menuOpen ? "opacity-100" : "opacity-0 group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100",
                )}
              />
            }
          />
          <DropdownContent side="bottom" align="start" sideOffset={4} className="w-48 min-w-0">
            {item.menu.map((entry) => {
              if (entry.kind === "separator") return <DropdownSeparator key={entry.id} />;
              if (entry.kind === "submenu") {
                return (
                  <DropdownSubMenuItem key={entry.id} index={index++} icon={entry.icon} label={entry.label} chevron className="text-[12px]">
                    {entry.entries.map((sub) => (
                      <DropdownSubItem key={sub.id} className="justify-between gap-2 py-1.5 pl-2.5 text-[12px]" onClick={sub.onSelect}>
                        <span className="truncate">{sub.label}</span>
                        {sub.checked && (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12L9 17L20 6" />
                          </svg>
                        )}
                      </DropdownSubItem>
                    ))}
                  </DropdownSubMenuItem>
                );
              }
              return (
                <MenuItem
                  key={entry.id}
                  index={index++}
                  icon={entry.icon}
                  label={entry.label}
                  destructive={entry.kind === "action" && entry.destructive}
                  className="text-[12px]"
                  onSelect={() => {
                    if (entry.kind === "rename") {
                      setDraft(item.label);
                      // After the menu has closed, so its focus return doesn't blur the input.
                      setTimeout(() => setRenaming(true), 0);
                    } else {
                      entry.onSelect();
                    }
                  }}
                />
              );
            })}
          </DropdownContent>
        </DropdownMenu>
      )}
    </div>
  );
}
