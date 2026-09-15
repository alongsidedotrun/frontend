"use client";

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  forwardRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import type { IconComponent } from "@/lib/icon-context";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fontWeights } from "@/lib/font-weight";
import { shapeMap } from "@/lib/shape-context";
import { useSize } from "@/lib/size-context";

// MenuItem is only used inside Dropdown, which opts out of the global pill
// shape — see dropdown.tsx for the rationale.
const shape = shapeMap.rounded;

// ---------------------------------------------------------------------------
// Dropdown context — the single shared context for every Dropdown build.
//
// It lives here rather than in the dropdown module so that (a) MenuItem stays
// primitive-free and self-contained, and (b) dropdowns built on different
// primitives (Radix, Base UI) can render side by side — each provides this
// same context object, so MenuItem resolves whichever provider actually
// wraps it. The dropdown module re-exports useDropdown from here, keeping
// its public API unchanged.
// ---------------------------------------------------------------------------

/** What MenuItem hands to the popup's primitive wrapper. `element` is the
 *  styled row div (visuals + proximity registration, no children); `children`
 *  is the row content (icon, label, check). The dropdown wraps them in its
 *  own Item / RadioItem primitive, so MenuItem itself stays primitive-free. */
export interface MenuItemRenderOptions {
  /** Radio-style option (boolean `checked` on MenuItem) vs plain action item. */
  radio: boolean;
  /** The item's index — doubles as the radio value. */
  value: number;
  disabled?: boolean;
  label: string;
  closeOnClick: boolean;
  element: ReactElement;
  children: ReactNode;
}

export interface DropdownContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
  /** Lets a consumer that deliberately skips proximity registration (e.g.
   *  CustomMenuItem-based rows -- nav-user.tsx's own notification list)
   *  clear the shared hover highlight when the pointer enters that
   *  unregistered region, instead of it staying pinned on whatever the
   *  nearest *registered* row happened to be (real bug, confirmed
   *  directly: "when i scroll through the notifications, the hover is
   *  stuck at sign in even though i am literally on top of a
   *  notification"). Optional -- the inline Dropdown variant doesn't
   *  expose it. */
  setActiveIndex?: (index: number | null) => void;
  checkedIndex?: number;
  /** True when items render inside a Menu popup (DropdownContent), where the
   *  primitive's Item / RadioItem own roles, roving highlight, typeahead,
   *  and activation. MenuItem switches its rendering accordingly. */
  inMenu?: boolean;
  /** Popup-only: wraps a MenuItem's styled div in the dropdown's menu-item
   *  primitive. Absent in the inline Dropdown panel, where MenuItem renders
   *  its own ARIA menuitem div. */
  renderMenuItem?: (opts: MenuItemRenderOptions) => ReactElement;
  /** Index of the row whose own DropdownSubMenuItem submenu is currently
   *  open, if any -- set by that row itself. DropdownContent's own
   *  onMouseLeave reads this to skip clearing activeIndex while it's set:
   *  the submenu is a separate floating popup (Menu.Portal), not a DOM
   *  descendant of this container, so moving the cursor from the trigger
   *  row into its own submenu crosses outside these bounds and would
   *  otherwise null the highlight out from under the still-open row
   *  ("hover at the models still affecting the hover at the providers"). */
  openSubmenuIndex?: number | null;
  setOpenSubmenuIndex?: (index: number | null) => void;
}

export const DropdownContext = createContext<DropdownContextValue | null>(null);

export function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("useDropdown must be used within a Dropdown");
  return ctx;
}

/** Null-safe context read for callers that render outside a provider. */
export function useDropdownMaybe() {
  return useContext(DropdownContext);
}

interface MenuItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional leading icon. When omitted, the row renders text-only with no
   *  reserved icon column. */
  icon?: IconComponent;
  label: string;
  index: number;
  /** When a boolean, the item is a radio-style option (role="menuitemradio"
   *  with aria-checked). When undefined, it is a plain action item
   *  (role="menuitem", no checked state announced). */
  checked?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  /** Popup-only (inside DropdownContent): whether activating the item closes
   *  the menu. Ignored in the inline Dropdown panel. @default true */
  closeOnClick?: boolean;
  /** Recolors the icon/label to text-destructive instead of the
   *  active/inactive foreground pair -- same "irreversible action" row
   *  (e.g. Delete) the app's own Radix DropdownMenuItem marks via its own
   *  variant="destructive". */
  destructive?: boolean;
  /** Trailing pill after the label, e.g. "Coming soon" on a disabled row --
   *  purely visual, not part of the accessible name. */
  badge?: ReactNode;
  /** Forces the icon/label into their active (text-foreground) color at
   *  rest, without the checked-only checkmark or radio semantics --
   *  e.g. "+ Add provider", a plain action row that should read as full
   *  strength even when not hovered. */
  forceActive?: boolean;
}

const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  (
    {
      icon: Icon,
      label,
      index,
      checked,
      onSelect,
      disabled,
      closeOnClick,
      destructive,
      badge,
      forceActive,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const hasMounted = useRef(false);
    const { registerItem, activeIndex, checkedIndex, renderMenuItem } =
      useDropdown();

    useEffect(() => {
      registerItem(index, internalRef.current);
      return () => registerItem(index, null);
    }, [index, registerItem]);

    useEffect(() => {
      hasMounted.current = true;
    }, []);

    const isActive = activeIndex === index || forceActive;
    const skipAnimation = !hasMounted.current;
    const sizeClasses = useSize();

    const mergeRef = (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    const handleActivate = disabled
      ? undefined
      : (e: React.MouseEvent<HTMLDivElement>) => {
          onClick?.(e);
          onSelect?.();
        };

    const itemClassName = cn(
      // Fixed height (was py-2 around a 19.5px line box ≈ 35.5px) so the
      // text-box trim on the label doesn't shrink the row. shrink-0 because
      // menu popups are max-height flex columns — without it a long list
      // compresses rows to fit instead of scrolling.
      `relative z-10 flex ${sizeClasses.control} shrink-0 items-center ${sizeClasses.gap} ${shape.item} ${sizeClasses.itemPx} cursor-pointer outline-none`,
      // Pure-CSS sibling rules, not a per-call-site className -- per
      // explicit request ("can we make sure to have one reusable component
      // for dropdowns so we don't need to keep editing multiple dropdowns")
      // after the same "gap between hover and divider line" bug kept
      // recurring across sidebar-nav.tsx/AppLayout.tsx/nav-user.tsx one
      // dropdown at a time. DropdownSeparator (ui/dropdown.tsx) still
      // reserves its own my-1 breathing room around the line itself, but
      // now every row automatically cancels the half of that margin it
      // touches -- a row right after a separator pulls itself up
      // ([role=separator]+&), a row right before one pulls its own bottom
      // up (has-[+[role=separator]]) -- so the hover fill always reaches
      // the line with no gap, for any dropdown, without editing this class
      // per row ever again.
      "[[role=separator]+&]:-mt-1 has-[+[role=separator]]:-mb-1",
      // px-3, overriding sizeClasses.itemPx's own px-2/px-1.5 -- per
      // explicit request ("increase the width of items inside the
      // dropdown as they are too close to the border"): the panel's own
      // p-1 inset is gone now (this file's own recent flush-hover pass
      // removed it so the *hover fill* reaches the panel's true edge), so
      // itemPx alone was no longer enough horizontal breathing room for a
      // row's own icon/label content against that same edge.
      "px-2",
      disabled && "opacity-50 pointer-events-none",
      className
    );

    const content = (
      <>
        {Icon && (
          <span className="inline-grid">
            <span className="col-start-1 row-start-1 invisible">
              <Icon size={sizeClasses.icon} strokeWidth={2} />
            </span>
            <Icon
              size={sizeClasses.icon}
              strokeWidth={isActive || checked ? 2 : 1.5}
              className={cn(
                "col-start-1 row-start-1 transition-[color,stroke-width] duration-80",
                // text-foreground at rest, not text-muted-foreground -- per
                // explicit request/screenshot ("More inside projects is
                // light grey" vs. the same menu's own "Projects" submenu,
                // a DropdownSubItem, which never dims at rest at all):
                // every other row across the app (sidebar rows, the model/
                // provider list, DropdownSubItem) already reads at full
                // foreground strength when not hovered, only the
                // background changes on hover/select. destructive still
                // wins outright (a real color, not merely brightness).
                destructive ? "text-destructive" : "text-foreground"
              )}
            />
          </span>
        )}
        {/* Both stacked spans carry the text-box trim so the invisible bold
            sizer and the visible label keep identical boxes. */}
        <span className={cn("inline-grid flex-1", sizeClasses.text)}>
          <span
            className="col-start-1 row-start-1 invisible [text-box:trim-both_cap_alphabetic]"
            style={{ fontVariationSettings: fontWeights.semibold }}
            aria-hidden="true"
          >
            {label}
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1 transition-[color,font-variation-settings] duration-80 [text-box:trim-both_cap_alphabetic]",
              // text-foreground at rest -- see the icon span's own comment
              // just above for the full reasoning.
              destructive ? "text-destructive" : "text-foreground"
            )}
            style={{
              fontVariationSettings: checked
                ? fontWeights.semibold
                : fontWeights.normal,
            }}
          >
            {label}
          </span>
        </span>
        {badge}
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check"
              width={sizeClasses.icon}
              height={sizeClasses.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground shrink-0"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
            >
              <motion.path
                d="M4 12L9 17L20 6"
                initial={{ pathLength: skipAnimation ? 1 : 0 }}
                animate={{
                  pathLength: 1,
                  transition: { duration: 0.08, ease: "easeOut" },
                }}
                exit={{
                  pathLength: 0,
                  transition: { duration: 0.04, ease: "easeIn" },
                }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </>
    );

    if (renderMenuItem) {
      // Inside DropdownContent, the menu-item primitive (supplied by the
      // surrounding DropdownContent through context) owns the role,
      // aria-checked, tabIndex, roving highlight, typeahead, and Enter/Space/
      // click activation (activation synthesizes a click, so handleActivate
      // also fires for keyboard). The styled div carries the Fluid
      // Functionalism visuals and the proximity-hover registration; MenuItem
      // itself imports no primitive.
      return renderMenuItem({
        radio: typeof checked === "boolean",
        value: index,
        disabled,
        label,
        closeOnClick: closeOnClick ?? true,
        element: (
          <div
            ref={mergeRef}
            data-proximity-index={index}
            aria-label={label}
            onClick={handleActivate}
            className={itemClassName}
            {...props}
          />
        ),
        children: content,
      });
    }

    return (
      <div
        ref={mergeRef}
        data-proximity-index={index}
        // Disabled items are never the roving tab stop.
        tabIndex={!disabled && index === (checkedIndex ?? 0) ? 0 : -1}
        role={typeof checked === "boolean" ? "menuitemradio" : "menuitem"}
        aria-checked={typeof checked === "boolean" ? checked : undefined}
        aria-disabled={disabled || undefined}
        aria-label={label}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onSelect?.();
          }
        }}
        className={itemClassName}
        {...props}
      >
        {content}
      </div>
    );
  }
);

MenuItem.displayName = "MenuItem";

interface CustomMenuItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name -- MenuItem's own `label` prop also doubles as its
   *  visible text, but this row supplies its own visible content via
   *  `children` instead, so this is aria-label only. */
  label: string;
  index: number;
  onSelect?: () => void;
  disabled?: boolean;
  closeOnClick?: boolean;
}

/**
 * Escape hatch for a menu row whose content doesn't fit MenuItem's fixed
 * icon+label+check layout (a bar graph, a multi-line description, anything
 * beyond a single icon and label) while still behaving like a real row in
 * the same Base UI menu -- correct role, keyboard activation, close-on-
 * select. Unlike MenuItem, this does NOT call registerItem, so it never
 * participates in the shared proximity-hover/selected background overlay
 * (no hover highlight at all) -- for a row that's meant to read as
 * informational content with a click action, not a selectable option in a
 * list (e.g. the account dropdown's own Models Usage rows, which draw
 * their own real content -- the usage bars -- and would otherwise get a
 * hover wash painted across them).
 */
const CustomMenuItem = forwardRef<HTMLDivElement, CustomMenuItemProps>(
  ({ label, index, onSelect, disabled, closeOnClick, className, onClick, children, ...props }, ref) => {
    const { renderMenuItem } = useDropdown();
    const handleActivate = disabled
      ? undefined
      : (e: React.MouseEvent<HTMLDivElement>) => {
          onClick?.(e);
          onSelect?.();
        };

    if (renderMenuItem) {
      return renderMenuItem({
        radio: false,
        value: index,
        disabled,
        label,
        closeOnClick: closeOnClick ?? true,
        element: (
          <div
            ref={ref}
            aria-label={label}
            onClick={handleActivate}
            className={className}
            {...props}
          />
        ),
        children,
      });
    }

    return (
      <div
        ref={ref}
        role="menuitem"
        aria-disabled={disabled || undefined}
        aria-label={label}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onSelect?.();
          }
        }}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CustomMenuItem.displayName = "CustomMenuItem";

export { MenuItem, CustomMenuItem };
export default MenuItem;
