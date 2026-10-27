import { useEffect, useState, type ComponentType, type ReactNode } from "react";
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
import { SlidingText } from "@/components/ui/sliding-text";

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
  /** A drawer: its heading shows an arrow that opens and closes its rows (closed at first; what's
   *  open is remembered on this device), and its action (+) only on hover. */
  collapsible?: boolean;
};

const OPEN_SECTIONS_KEY = "alongside_sidebar_open_sections";

function readOpenSections(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_SECTIONS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

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
  const [openSections, setOpenSections] = useState<Set<string>>(readOpenSections);
  const toggleSection = (id: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify([...next]));
      } catch {
        // storage blocked: as toggled, for this session
      }
      return next;
    });
  };
  return (
    <div className={cn("flex flex-col gap-[var(--redesign-sidebar-section-gap)]", className)}>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`sidebar-section-${section.id}`}>
          <div className="group/section-header flex h-[var(--redesign-quick-actions-row-height)] items-center px-[var(--redesign-quick-actions-padding)]">
            {section.collapsible ? (
              // The heading opens and closes the drawer (so does its arrow, at the end).
              <button
                type="button"
                aria-expanded={openSections.has(section.id)}
                onClick={() => toggleSection(section.id)}
                className="flex h-full min-w-0 flex-1 items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <h2 id={`sidebar-section-${section.id}`} className="truncate text-ui-xs font-medium text-muted-foreground">
                  {section.label}
                </h2>
              </button>
            ) : (
              <h2
                id={`sidebar-section-${section.id}`}
                className="text-ui-xs font-medium text-muted-foreground"
              >
                {section.label}
              </h2>
            )}
            {section.action ? (() => {
              const Icon = section.action.icon;
              return (
                <button
                  type="button"
                  aria-label={section.action.label}
                  onClick={section.action.onSelect}
                  className={cn(
                    "ml-auto flex size-[var(--redesign-quick-actions-icon-size)] items-center justify-center rounded-[var(--redesign-dropdown-row-radius)] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    // A drawer's + only while its heading is hovered (or reached with the keyboard).
                    section.collapsible && "opacity-0 transition-opacity duration-150 group-hover/section-header:opacity-100 focus-visible:opacity-100",
                    PRESS_EFFECT,
                    ICON_PRESS,
                  )}
                >
                  <Icon aria-hidden="true" strokeWidth={2} className="size-[calc(var(--redesign-font-size-compact)-1px)]" />
                </button>
              );
            })() : null}
            {section.collapsible && (
              // The same arrow as a project row's, turned down when open. The heading is its button for
              // keyboards and screen readers; this one is for the pointer.
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => toggleSection(section.id)}
                className={cn("flex size-[var(--redesign-quick-actions-icon-size)] shrink-0 items-center justify-center text-muted-foreground", !section.action && "ml-auto")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    "size-3.5 transform-gpu transition-[opacity,scale,rotate] duration-150 ease-out hover:opacity-70 active:scale-[0.9] motion-reduce:transition-none",
                    openSections.has(section.id) && "rotate-90",
                  )}
                >
                  <path d="M9 6L15 12L9 18" />
                </svg>
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
          {section.items && (!section.collapsible || openSections.has(section.id)) ? (
          <RowReveal key="rows" gap={false}>
            {/* No flex gap: each row carries its own gap inside RowReveal, so a
                row collapsing to zero takes its gap with it instead of jumping. */}
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
                                  <p className="flex h-[var(--redesign-quick-actions-row-height)] items-center pr-[var(--redesign-quick-actions-padding)] pl-[calc(var(--redesign-quick-actions-padding)+12px)] text-chat font-medium text-muted-foreground opacity-70">
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
                    <p className="flex h-[var(--redesign-quick-actions-row-height)] items-center px-[var(--redesign-quick-actions-padding)] text-chat font-medium text-muted-foreground opacity-70">
                      {section.emptyLabel}
                    </p>
                  </RowReveal>
                ) : null}
              </AnimatePresence>
            </div>
          </RowReveal>
          ) : null}
          </AnimatePresence>
        </section>
      ))}
    </div>
  );
}

/** One row: the item itself, its "..." menu on hover, and in-place rename. */
const REVEAL = { type: "spring" as const, duration: 0.26, bounce: 0 };
const REVEAL_EXIT = { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const };

const SMOOTH_FRAME_MS = 34;
const SETTLE_MAX_MS = 800;

/** True once two frames in a row have come quickly (the page isn't busy), or after SETTLE_MAX_MS. */
function useSmoothFrames() {
  const [smooth, setSmooth] = useState(false);
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let quick = 0;
    const started = last;
    const tick = (now: number) => {
      quick = now - last < SMOOTH_FRAME_MS ? quick + 1 : 0;
      last = now;
      if (quick >= 2 || now - started > SETTLE_MAX_MS) {
        setSmooth(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return smooth;
}

/** Grows a row (or a project's drawer) open from zero height while fading
 *  it in, and the reverse on the way out. Clipping is only on while moving,
 *  so focus rings aren't cut off at rest. */
function RowReveal({ children, gap = true }: { children: ReactNode; gap?: boolean }) {
  const reduceMotion = useReducedMotion();
  // A row usually arrives while the page is busy (a new chat or bot opening): frames 100-400ms apart, so
  // an animation started then jumps to its end. It waits, closed, until frames run smoothly again (at
  // most SETTLE_MAX_MS), then opens. A row already there when the list first shows doesn't animate.
  const settled = useSmoothFrames();
  return (
    <motion.div
      initial={{ height: 0, opacity: 0, overflow: "hidden" }}
      animate={
        settled || reduceMotion
          ? { height: "auto", opacity: 1, transition: reduceMotion ? { duration: 0 } : REVEAL, transitionEnd: { overflow: "visible" } }
          : { height: 0, opacity: 0, overflow: "hidden" }
      }
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
  // A child row without its own icon (a chat inside a project) gets a bullet in its place.
  const bullet = nested && !Icon && <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-current opacity-60" />;
  const rowClass = cn(
    "flex h-[var(--redesign-quick-actions-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left text-chat font-normal text-muted-foreground transition-colors",
    // Only the open chat looks selected; opening a row's "..." menu doesn't.
    active && "bg-muted font-medium text-foreground",
    // Children sit indented under their parent, behind a bullet.
    nested && "pl-[calc(var(--redesign-quick-actions-padding)+4px)]",
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
      // The cog's press feedback: fades on hover, dips when pressed (on it or
      // anywhere on the row, since the whole row toggles).
      className={cn(
        "ml-auto size-3.5 shrink-0 text-muted-foreground transform-gpu transition-[opacity,scale,rotate] duration-150 ease-out hover:opacity-70 active:scale-[0.9] group-active/row-button:scale-[0.9] motion-reduce:transition-none motion-reduce:active:scale-100",
        expanded && "rotate-90",
      )}
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
        {bullet}
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
  // A row with both keeps its chevron at the edge and shows the "..." just before it.
  const menuBeforeChevron = Boolean(item.menu) && expanded !== undefined;
  return (
    <div className="group/sidebar-row relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        aria-expanded={expanded}
        data-slide-trigger
        className={cn(
          "group/row-button",
          rowClass,
          "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          item.menu && !menuBeforeChevron && "pr-8",
        )}
      >
        {Icon && <Icon aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />}
        {bullet}
        {/* Too long to fit, it slides left on hover to show the rest (like Codex). */}
        <SlidingText text={item.label} className={cn(menuBeforeChevron && "mr-6")} />
        {chevron}
      </button>
      {item.menu && (
        <DropdownMenu size="compact" open={menuOpen} onOpenChange={setMenuOpen}>
          {/* Shown on row hover, while its menu is open, or for keyboard focus;
              not plain focus, which a clicked row keeps and left it stuck on.
              Visibility lives on this wrapper so the trigger's own hover fade
              (PRESS_EFFECT, like the cog) doesn't fight it. */}
          <div
            className={cn(
              "absolute top-1/2 flex -translate-y-1/2 transition-opacity duration-150",
              // Past the chevron (14px) and a small gap, or at the edge when there's none.
              menuBeforeChevron ? "right-[calc(var(--redesign-quick-actions-padding)+18px)]" : "right-1.5",
              menuOpen ? "opacity-100" : "opacity-0 group-hover/sidebar-row:opacity-100 group-has-[:focus-visible]/sidebar-row:opacity-100",
            )}
          >
            <DropdownTrigger
              render={
                <MoreTrigger
                  aria-label={t("shell.rowOptions", { name: item.label })}
                  active={menuOpen}
                  autoHide={false}
                  className={cn(PRESS_EFFECT, ICON_PRESS)}
                />
              }
            />
          </div>
          <DropdownContent side="bottom" align="start" sideOffset={4} className="w-48 min-w-0">
            {item.menu.map((entry) => {
              if (entry.kind === "separator") return <DropdownSeparator key={entry.id} />;
              if (entry.kind === "submenu") {
                return (
                  <DropdownSubMenuItem key={entry.id} index={index++} icon={entry.icon} label={entry.label} chevron className="text-ui-sm">
                    {entry.entries.map((sub) => (
                      <DropdownSubItem key={sub.id} className="justify-between gap-2 py-1.5 pl-2.5 text-ui-sm" onClick={sub.onSelect}>
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
                  className="text-ui-sm"
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
