import { useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  /** Nested rows (a project's chats): the row gets a chevron and expands. */
  children?: readonly SidebarSectionItem[];
  /** Shown inside an expanded row that has no children. */
  childrenEmptyLabel?: string;
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
  /** Rows with children that are open. */
  expandedIds?: ReadonlySet<string>;
  onToggleExpanded?: (itemId: string) => void;
  className?: string;
};

/**
 * Data-driven sidebar groups. A surface may begin with headings only and add
 * rows later without changing the surrounding navigation layout.
 */
export function SidebarSections({ sections, activeItemId, onItemSelect, expandedIds, onToggleExpanded, className }: SidebarSectionsProps) {
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
          {section.items ? (
            // No flex gap: each row carries its own gap inside RowReveal, so a
            // row collapsing to zero takes its gap with it instead of jumping.
            <div className="mt-[calc(var(--redesign-sidebar-section-row-offset)-var(--redesign-quick-actions-row-gap))] flex flex-col">
              <AnimatePresence initial={false}>
                {section.items.map((item) => {
                  if (!item.children) {
                    return (
                      <RowReveal key={item.id}>
                        <SidebarRow item={item} active={item.id === activeItemId} onSelect={() => onItemSelect?.(item.id)} />
                      </RowReveal>
                    );
                  }
                  const expanded = expandedIds?.has(item.id) ?? false;
                  return (
                    <RowReveal key={item.id}>
                      <SidebarRow item={item} active={false} expanded={expanded} onSelect={() => onToggleExpanded?.(item.id)} />
                      {/* The drawer: a project's chats slide open under it. */}
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <RowReveal key="children" gap={false}>
                            <AnimatePresence initial={false}>
                              {item.children.length ? (
                                item.children.map((child) => (
                                  <RowReveal key={child.id}>
                                    <SidebarRow item={child} active={child.id === activeItemId} nested onSelect={() => onItemSelect?.(child.id)} />
                                  </RowReveal>
                                ))
                              ) : item.childrenEmptyLabel ? (
                                <RowReveal key="empty">
                                  <p className="flex h-[var(--redesign-quick-actions-row-height)] items-center pr-[var(--redesign-quick-actions-padding)] pl-[calc(var(--redesign-quick-actions-padding)+12px)] text-[length:var(--redesign-font-size-base)] font-medium text-muted-foreground opacity-70">
                                    {item.childrenEmptyLabel}
                                  </p>
                                </RowReveal>
                              ) : null}
                            </AnimatePresence>
                          </RowReveal>
                        )}
                      </AnimatePresence>
                    </RowReveal>
                  );
                })}
                {/* In the same list, so the last row leaving cross-fades into it. */}
                {!section.items.length && section.emptyLabel ? (
                  <RowReveal key="__empty">
                    <p className="flex h-[var(--redesign-quick-actions-row-height)] items-center px-[var(--redesign-quick-actions-padding)] text-[length:var(--redesign-font-size-base)] font-medium text-muted-foreground opacity-70">
                      {section.emptyLabel}
                    </p>
                  </RowReveal>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** One row: the item itself, its "..." menu on hover, and in-place rename. */
const REVEAL = { type: "spring" as const, duration: 0.26, bounce: 0 };
const REVEAL_EXIT = { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const };

/** Grows a row (or a project's drawer) open from zero height while fading
 *  it in, and the reverse on the way out. Clipping is only on while moving,
 *  so focus rings aren't cut off at rest. */
function RowReveal({ children, gap = true }: { children: ReactNode; gap?: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ height: 0, opacity: 0, overflow: "hidden" }}
      animate={{ height: "auto", opacity: 1, transition: reduceMotion ? { duration: 0 } : REVEAL, transitionEnd: { overflow: "visible" } }}
      exit={{ height: 0, opacity: 0, overflow: "hidden", transition: reduceMotion ? { duration: 0 } : REVEAL_EXIT }}
      className={cn("flex flex-col", gap && "pt-[var(--redesign-quick-actions-row-gap)]")}
    >
      {children}
    </motion.div>
  );
}

function SidebarRow({
  item,
  active,
  onSelect,
  expanded,
  nested = false,
}: {
  item: SidebarSectionItem;
  active: boolean;
  onSelect: () => void;
  // Set for a row with children: draws its chevron, turned down when open.
  expanded?: boolean;
  // A child row, indented under its parent.
  nested?: boolean;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const Icon = item.icon;
  const rowClass = cn(
    "flex h-[var(--redesign-quick-actions-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left text-[length:var(--redesign-sidebar-primary-font-size)] font-normal text-muted-foreground transition-colors",
    (active || menuOpen) && "bg-muted font-medium text-foreground",
    // Children sit indented under their parent.
    nested && "pl-[calc(var(--redesign-quick-actions-padding)+12px)]",
  );
  const chevron = expanded !== undefined && (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none", expanded && "rotate-90")}
    >
      <path d="M9 6L15 12L9 18" />
    </svg>
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
        aria-expanded={expanded}
        className={cn(
          rowClass,
          "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          item.menu && "pr-8",
        )}
      >
        {Icon && <Icon aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />}
        <span className="truncate">{item.label}</span>
        {chevron}
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
