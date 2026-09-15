// Shared "..." row-action trigger -- one source of truth for every "more
// options" button in the app (sidebar ProjectRow/ChatRow, the model
// picker's per-model row, the chat header's top-right menu, notifications),
// per explicit request ("can we make this on shared component as well so
// we don't need to be touching multiple three dots component"). orientation
// picks the icon (horizontal dots everywhere except the chat header's own
// vertical dots); everything else (color-only vs filled hover, box size,
// auto-hide-until-row-hover vs always-visible) is a prop, not a fork.
"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { MoreHorizontalIcon, DotsVerticalIcon } from "@/components/icons/untitled-ui";

export interface MoreTriggerClassNameOptions {
  /** Persistent "open" color, for callers that track their own menu-open
   *  state (aria-expanded alone already covers Base UI's own triggers). */
  active?: boolean;
  /** Fades in only on row hover/focus (ProjectRow/ChatRow/model-row
   *  convention) vs. always visible (a standalone header button, e.g. the
   *  chat header's own "..."). @default true */
  autoHide?: boolean;
  /** size-5/rounded-[6px] (inline row triggers) or size-7/rounded-[10px]
   *  (standalone header triggers). @default "sm" */
  size?: "sm" | "md";
  /** Filled hover background (the chat header's own pre-existing look) vs.
   *  color-only, text-muted-foreground -> text-ink (every row trigger's own
   *  look, per explicit request "should not have a bg, it should... change
   *  color when active or hovering"). @default false */
  bg?: boolean;
}

export function moreTriggerClassName({
  active = false,
  autoHide = true,
  size = "sm",
  bg = false,
}: MoreTriggerClassNameOptions = {}) {
  return cn(
    // aria-expanded (DropdownRowActionMenu's own popover, which sets it by
    // hand) and data-popup-open (a real Base UI Menu.SubmenuTrigger, which
    // sets that attribute itself) are the two different "this trigger's own
    // popup is open" signals across this app's two different "..." popup
    // mechanisms -- both handled here so neither caller needs its own copy.
    "flex shrink-0 items-center justify-center transition-[color,opacity] duration-150 outline-none aria-expanded:opacity-100 data-[popup-open]:opacity-100",
    size === "md" ? "size-7 rounded-[10px]" : "size-5 rounded-[6px]",
    // Resting color depends on autoHide, not on `bg`: a row trigger that's
    // invisible until hover (autoHide) rests at text-muted-foreground same
    // as before (irrelevant while opacity-0 anyway) and lights up to
    // text-ink on hover/open; a standalone always-visible trigger (e.g. the
    // chat header's own "...", autoHide={false}) follows the app-wide
    // always-visible-icon convention instead (text-foreground at rest, same
    // as every sidebar icon) -- per explicit request ("the other three
    // dots like on a chat has a light grey font color and not the same as
    // the model three dots which is the same color as the sidebar").
    autoHide === false ? "text-foreground" : "text-muted-foreground",
    bg
      ? "hover:bg-hover-2/50 hover:text-foreground aria-expanded:bg-hover-2/50 data-[popup-open]:bg-hover-2/50 data-[popup-open]:text-foreground"
      : "hover:text-ink aria-expanded:text-ink data-[popup-open]:text-ink",
    autoHide && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
    active && "opacity-100 text-ink"
  );
}

interface MoreTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement>, MoreTriggerClassNameOptions {
  orientation?: "horizontal" | "vertical";
}

const MoreTrigger = forwardRef<HTMLButtonElement, MoreTriggerProps>(
  ({ orientation = "horizontal", active, autoHide, size, bg, className, ...props }, ref) => {
    const Icon = orientation === "vertical" ? DotsVerticalIcon : MoreHorizontalIcon;
    return (
      <button
        ref={ref}
        type="button"
        className={cn(moreTriggerClassName({ active, autoHide, size, bg }), className)}
        {...props}
      >
        <Icon className="size-[14px]" />
      </button>
    );
  }
);

MoreTrigger.displayName = "MoreTrigger";

export { MoreTrigger };
