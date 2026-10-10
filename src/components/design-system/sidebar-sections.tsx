import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type SidebarSectionItem = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
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
                  className="ml-auto flex size-[var(--redesign-quick-actions-icon-size)] items-center justify-center rounded-[var(--redesign-dropdown-row-radius)] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon aria-hidden="true" strokeWidth={2} className="size-full" />
                </button>
              );
            })() : null}
          </div>
          {section.items?.length ? (
            <div className="mt-[var(--redesign-sidebar-section-row-offset)] flex flex-col gap-[var(--redesign-quick-actions-row-gap)]">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === activeItemId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemSelect?.(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-[var(--redesign-quick-actions-row-height)] w-full items-center gap-[var(--redesign-quick-actions-icon-gap)] rounded-[var(--redesign-control-radius)] px-[var(--redesign-quick-actions-padding)] text-left text-[length:var(--redesign-font-size-base)] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive && "bg-muted text-foreground",
                    )}
                  >
                    {Icon && <Icon aria-hidden="true" strokeWidth={2} className="size-[var(--redesign-quick-actions-icon-size)] shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : section.emptyLabel ? (
            <p className="mt-[var(--redesign-sidebar-section-row-offset)] px-[var(--redesign-quick-actions-padding)] text-[length:var(--redesign-font-size-compact)] text-muted-foreground opacity-50">
              {section.emptyLabel}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
