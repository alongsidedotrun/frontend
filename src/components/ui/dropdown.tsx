"use client";

import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  type ComponentProps,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "@base-ui/react/menu";
import type { MenuTriggerProps } from "@base-ui/react/menu";
import {
  DropdownContext,
  useDropdown,
  useDropdownMaybe,
  type DropdownContextValue,
  type MenuItemRenderOptions,
} from "@/components/ui/menu-item";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { spring, exitFallbackMs } from "@/lib/springs";
// useFluidHover, aliased -- per explicit request ("apply this now to our
// hovers... everywhere our own proximity-hover lives now"): the
// fluidfunctionalism.com registry's own canonical version of the same
// mechanic this file's hand-rolled use-proximity-hover.ts was already
// modeled after (this file's own comments cite that site throughout).
// Aliased to the old name rather than renaming every call site below --
// same return shape (activeIndex/itemRects/isMeasured/sessionRef/handlers/
// registerItem/remeasure/measureItems), so nothing else in this file needs
// to change. use-proximity-hover.ts itself is gone now (no other
// importers -- ui/card.tsx switched to this same import).
import { useFluidHover as useProximityHover } from "@/hooks/use-fluid-hover";
import { shapeMap } from "@/lib/shape-context";
import { SizeProvider, useSize, type SizeVariant } from "@/lib/size-context";
import { Elevated } from "@/lib/elevated";
import { useSurface, SurfaceProvider } from "@/lib/surface-context";
import { SURFACE_BG, SURFACE_DATA_HIGHLIGHTED_BG, SURFACE_HOVER_BG } from "@/lib/surface-classes";
import { MoreTrigger } from "@/components/ui/more-trigger";

// Dropdown opts out of the global pill/rounded shape context — popover surfaces
// look cleaner with the smaller "rounded" radii regardless of how the rest of
// the UI is shaped (the heavy pill bubbling distorts perceived padding at this
// scale and produces the corner-shadow asymmetry).
const shape = shapeMap.rounded;
// Popup panels (DropdownContent, its submenus, and the inline Dropdown
// variant) use their own fixed radius here, not shape.container -- per
// explicit request ("all these dropdowns have different rounded borders,
// make sure that the style that we have at help and avatar dropdown is
// applied to the other dropdowns"). shape.container (rounded-xl) stays as
// the default for non-dropdown callers (ui/card.tsx), which this constant
// intentionally doesn't touch.
const DROPDOWN_PANEL_RADIUS = "rounded-3xl";

// ---------------------------------------------------------------------------
// Panel context — shared by the inline Dropdown and the popup DropdownContent.
//
// The context object itself lives in menu-item.tsx so MenuItem resolves
// whichever dropdown provider actually wraps it, even when dropdowns built
// on different primitives render side by side. Re-exported here so the
// public dropdown API is unchanged.
// ---------------------------------------------------------------------------

export { useDropdown, useDropdownMaybe };
export type { DropdownContextValue, MenuItemRenderOptions };

// ---------------------------------------------------------------------------
// Dropdown (inline panel)
//
// An always-rendered panel — no trigger, positioning, or dismissal. Because it
// sits statically in the page it does NOT claim popup menu semantics: the
// container is a plain role="group" (pass `aria-label` to name it). The real
// role="menu" lives on the popup DropdownContent below, which Base UI wires to
// a trigger. Consumers who hand-roll a trigger around the inline panel get
// grouping semantics rather than a falsely-announced popup menu.
// ---------------------------------------------------------------------------

interface DropdownProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  checkedIndex?: number;
  /** Pins the panel's rows to one step of the size ladder (default 36px,
   *  compact 28px — see /docs/sizes). Omitted, they follow the surrounding
   *  SizeProvider. */
  size?: SizeVariant;
}

const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  ({ children, checkedIndex, size, className, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Real level-aware hover/selected fill, not a flat static token -- per
    // explicit request ("we should be doing something like this where we
    // have 4 levels of colors... the hover should be level 2? and right
    // now its 0? so all black bg instead of a lighter bg than the
    // dropdown"). This panel's own Elevated renders at offset={0} (its
    // real level *is* zIndexSubstrate -- the app's first surface tier), so
    // its own hover/selected fill sits one tier above that.
    const zIndexSubstrate = useSurface();
    const hoverBgClass = SURFACE_BG[Math.min(zIndexSubstrate + 1, 8)];
    const {
      activeIndex,
      setActiveIndex,
      itemRects,
      sessionRef,
      handlers,
      registerItem,
      measureItems,
    } = useProximityHover(containerRef);

    useEffect(() => {
      measureItems();
    }, [measureItems, children]);

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const checkedRect =
      checkedIndex != null ? itemRects[checkedIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    const panel = (
      <DropdownContext.Provider value={{ registerItem, activeIndex, checkedIndex }}>
        <Elevated
          offset={0}
          shadowLevel={3}
          ref={(node) => {
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          onFocus={(e) => {
            const indexAttr = (e.target as HTMLElement)
              .closest("[data-proximity-index]")
              ?.getAttribute("data-proximity-index");
            if (indexAttr != null) {
              const idx = Number(indexAttr);
              setActiveIndex(idx);
              setFocusedIndex(
                (e.target as HTMLElement).matches(":focus-visible") ? idx : null
              );
            }
          }}
          onBlur={(e) => {
            if (containerRef.current?.contains(e.relatedTarget as Node)) return;
            setFocusedIndex(null);
            setActiveIndex(null);
          }}
          onKeyDown={(e) => {
            const items = Array.from(
              containerRef.current?.querySelectorAll(
                '[role="menuitem"], [role="menuitemradio"]'
              ) ?? []
            ) as HTMLElement[];
            const currentIdx = items.indexOf(e.target as HTMLElement);
            if (currentIdx === -1) return;

            if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
              e.preventDefault();
              const next = ["ArrowDown", "ArrowRight"].includes(e.key)
                ? (currentIdx + 1) % items.length
                : (currentIdx - 1 + items.length) % items.length;
              items[next].focus();
            } else if (e.key === "Home") {
              e.preventDefault();
              items[0]?.focus();
            } else if (e.key === "End") {
              e.preventDefault();
              items[items.length - 1]?.focus();
            }
          }}
          role="group"
          className={cn(
            `relative flex flex-col w-72 max-w-full overflow-hidden ${DROPDOWN_PANEL_RADIUS} select-none`,
            className
          )}
          {...props}
        >
          {/* Selected background */}
          <AnimatePresence>
            {checkedRect && (
              <motion.div
                className={`absolute ${shape.bg} ${hoverBgClass} pointer-events-none`}
                initial={false}
                animate={{
                  top: checkedRect.top,
                  left: checkedRect.left,
                  width: checkedRect.width,
                  height: checkedRect.height,
                  opacity: 1,
                }}
                exit={{ opacity: 0, transition: spring.moderate.exit }}
                transition={{
                  ...spring.moderate,
                  opacity: { duration: 0.08 },
                }}
              />
            )}
          </AnimatePresence>

          {/* Hover background */}
          <AnimatePresence>
            {activeRect && (
              <motion.div
                key={sessionRef.current}
                className={`absolute ${shape.bg} ${hoverBgClass} pointer-events-none`}
                initial={{
                  opacity: 0,
                  top: checkedRect?.top ?? activeRect.top,
                  left: checkedRect?.left ?? activeRect.left,
                  width: checkedRect?.width ?? activeRect.width,
                  height: checkedRect?.height ?? activeRect.height,
                }}
                animate={{
                  opacity: 1,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                exit={{ opacity: 0, transition: spring.fast.exit }}
                transition={{
                  ...spring.fast,
                  opacity: { duration: 0.08 },
                }}
              />
            )}
          </AnimatePresence>

          {/* Focus ring */}
          <AnimatePresence>
            {focusRect && (
              <motion.div
                className={`absolute ${shape.focusRing} pointer-events-none z-20 border border-[color:var(--focus-ring,#6B97FF)]`}
                initial={false}
                animate={{
                  left: focusRect.left - 2,
                  top: focusRect.top - 2,
                  width: focusRect.width + 4,
                  height: focusRect.height + 4,
                }}
                exit={{ opacity: 0, transition: spring.fast.exit }}
                transition={{
                  ...spring.fast,
                  opacity: { duration: 0.08 },
                }}
              />
            )}
          </AnimatePresence>

          {children}
        </Elevated>
      </DropdownContext.Provider>
    );

    // A size prop pins every row in the panel to one ladder step.
    return size ? <SizeProvider size={size}>{panel}</SizeProvider> : panel;
  }
);

Dropdown.displayName = "Dropdown";

// ---------------------------------------------------------------------------
// DropdownMenu (popup root)
//
// Built on Base UI's Menu primitive, which owns the trigger wiring,
// positioning (collision flipping, anchor tracking), dismissal (outside
// press, focus-out, Escape), roving highlight, typeahead, and close-on-select.
// This layer keeps the proximity-hover overlays and the
// spring open/close animation (via actionsRef deferred unmount) — the same
// verified pattern as select.tsx.
// ---------------------------------------------------------------------------

interface DropdownMenuActions {
  unmount: () => void;
  close: () => void;
}

interface DropdownMenuContextValue {
  open: boolean;
  actionsRef: React.RefObject<DropdownMenuActions | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const ctx = useContext(DropdownMenuContext);
  if (!ctx)
    throw new Error(
      "DropdownMenu compound components must be inside <DropdownMenu>"
    );
  return ctx;
}

interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Pins trigger-side content and the portalled popup rows to one step of
   *  the size ladder (default 36px, compact 28px — see /docs/sizes).
   *  Omitted, they follow the surrounding SizeProvider. */
  size?: SizeVariant;
}

function DropdownMenu({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  size,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : internalOpen;
  const actionsRef = useRef<DropdownMenuActions | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );

  const ctx = useMemo(() => ({ open, actionsRef }), [open]);

  // A size prop pins the whole compound (trigger content + portalled popup —
  // React context crosses portals) to one ladder step.
  const root = (
    <DropdownMenuContext.Provider value={ctx}>
      <Menu.Root
        open={open}
        onOpenChange={handleOpenChange}
        actionsRef={actionsRef}
        disabled={disabled}
        // Non-modal: the page keeps scrolling and the Positioner tracks the
        // anchor, so the popup follows its trigger instead of detaching.
        modal={false}
      >
        {children}
      </Menu.Root>
    </DropdownMenuContext.Provider>
  );

  return size ? <SizeProvider size={size}>{root}</SizeProvider> : root;
}

DropdownMenu.displayName = "DropdownMenu";

// ---------------------------------------------------------------------------
// DropdownTrigger
//
// Base UI's Menu.Trigger, re-exported under the library name. Composes via
// the `render` prop, so any element can be the trigger:
//
//   <DropdownTrigger render={<Button variant="secondary">Open</Button>} />
// ---------------------------------------------------------------------------

type DropdownTriggerProps = MenuTriggerProps;

const DropdownTrigger = Menu.Trigger;

// ---------------------------------------------------------------------------
// DropdownContent (popup panel)
//
// Portal > Positioner > Popup carrying the exact inline-panel visuals:
// Elevated surface, proximity-hover overlays, animated selected background,
// and animated focus ring. Children are wrapped in a Menu.RadioGroup so
// radio-style MenuItems (boolean `checked`) get correct aria-checked from
// `checkedIndex`.
// ---------------------------------------------------------------------------

type MenuPositionerProps = ComponentProps<typeof Menu.Positioner>;

interface DropdownContentProps {
  children: ReactNode;
  className?: string;
  /** Index of the checked item. Drives the animated selected background and
   *  the radio-group value announced to assistive tech. */
  checkedIndex?: number;
  side?: MenuPositionerProps["side"];
  align?: MenuPositionerProps["align"];
  sideOffset?: number;
  /** Forwarded to Menu.Positioner. Default 'flip'/'shift' can produce a
   *  visible one-frame correction jump on a trigger that never actually
   *  needs it (plenty of room on the preferred side) -- pass
   *  `{ side: "none", align: "none" }` for a trigger like that to rule
   *  the flip/shift middleware out entirely. */
  collisionAvoidance?: MenuPositionerProps["collisionAvoidance"];
}

const DropdownContent = forwardRef<HTMLDivElement, DropdownContentProps>(
  (
    {
      className,
      children,
      checkedIndex,
      side = "bottom",
      align = "start",
      sideOffset = 6,
      collisionAvoidance,
    },
    ref
  ) => {
    const { open, actionsRef } = useDropdownMenuContext();
    const containerRef = useRef<HTMLDivElement>(null);
    // Same substrate+offset math Elevated (rendered below) computes
    // independently for its own surface level -- read here too so this
    // popup's own z-index can climb in lockstep with nesting depth,
    // confirmed directly as a real bug otherwise ("the hover at the third
    // menu like the models is broken and keeps moving the hover at
    // provider"): every level of nesting (the model dropdown, a
    // provider's own submenu, a model row's own "Set as default" menu)
    // used the same flat z-50, so which one actually received mouse
    // events at a given screen point came down to DOM/portal mount
    // order, not visual stacking -- fragile, and wrong here specifically
    // once three levels overlapped. A z-index that strictly increases
    // with real nesting depth removes that ambiguity entirely.
    const zIndexSubstrate = useSurface();
    const zIndex = 40 + Math.min(zIndexSubstrate + 2, 8) * 10;
    // Real level-aware hover/selected fill -- same fix as the inline
    // Dropdown's own identical hoverBgClass above (that one's own comment
    // has the full bug report). This panel's own Elevated below also
    // renders at offset={0}, so its real level is zIndexSubstrate itself.
    const hoverBgClass = SURFACE_BG[Math.min(zIndexSubstrate + 1, 8)];

    const {
      activeIndex,
      setActiveIndex,
      itemRects,
      sessionRef,
      handlers,
      registerItem,
      measureItems,
    } = useProximityHover(containerRef);

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    // See DropdownContextValue's own comment (menu-item.tsx) -- lets a row's
    // own open submenu keep this popup's proximity highlight pinned on it
    // instead of the highlight nulling out the instant the cursor crosses
    // into that separate floating panel.
    const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);

    // Release Base UI's deferred unmount once the exit tween has played.
    // onAnimationComplete on the motion.div is the primary signal; this
    // timeout is a fallback for throttled/background tabs where rAF-driven
    // animation callbacks can stall. The popup exits with spring.fast, so the
    // fallback tracks that tier's exit duration plus a safety buffer.
    useEffect(() => {
      if (open) return;
      const id = setTimeout(
        () => actionsRef.current?.unmount(),
        exitFallbackMs(spring.fast)
      );
      return () => clearTimeout(id);
    }, [open, actionsRef]);

    // Measure items once the popup has mounted.
    useEffect(() => {
      if (!open) return;
      // Double rAF: first waits for React commit, second for layout
      let inner: number;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          measureItems();
        });
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }, [open, measureItems]);

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const checkedRect = checkedIndex != null ? itemRects[checkedIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    // Inside the popup, Base UI's Menu.Item / Menu.RadioItem own the role,
    // aria-checked, tabIndex, roving highlight, typeahead, and Enter/Space/
    // click activation (activation synthesizes a click, so the row div's
    // onClick also fires for keyboard). The render div carries the Fluid
    // Functionalism visuals and the proximity-hover registration.
    const renderMenuItem = useCallback(
      ({
        radio,
        value,
        disabled,
        label,
        closeOnClick,
        element,
        children,
      }: MenuItemRenderOptions) =>
        radio ? (
          <Menu.RadioItem
            value={value}
            disabled={disabled}
            label={label}
            closeOnClick={closeOnClick}
            render={element}
          >
            {children}
          </Menu.RadioItem>
        ) : (
          <Menu.Item
            disabled={disabled}
            label={label}
            closeOnClick={closeOnClick}
            render={element}
          >
            {children}
          </Menu.Item>
        ),
      []
    );

    const contentCtx = useMemo(
      () => ({
        registerItem,
        activeIndex,
        setActiveIndex,
        checkedIndex,
        inMenu: true,
        renderMenuItem,
        openSubmenuIndex,
        setOpenSubmenuIndex,
      }),
      [registerItem, activeIndex, setActiveIndex, checkedIndex, renderMenuItem, openSubmenuIndex]
    );

    return (
      <Menu.Portal>
        <Menu.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionAvoidance={collisionAvoidance}
          className="outline-none"
          style={{ zIndex }}
        >
          <motion.div
            // A popup opening upward grows from its bottom edge — the edge
            // anchored to the trigger — so the offset and origin flip with
            // `side`.
            initial={{ opacity: 0, y: side === "top" ? 4 : -4, scaleY: 0.96 }}
            animate={
              open
                ? { opacity: 1, y: 0, scaleY: 1 }
                : { opacity: 0, y: side === "top" ? 4 : -4, scaleY: 0.96 }
            }
            transition={open ? spring.fast : spring.fast.exit}
            style={{
              transformOrigin: side === "top" ? "bottom center" : "top center",
            }}
            // Base UI defers unmount while actionsRef is set; release it once
            // the exit spring has finished so the close animation fully plays.
            onAnimationComplete={() => {
              if (!open) actionsRef.current?.unmount();
            }}
          >
            <DropdownContext.Provider value={contentCtx}>
              <Menu.Popup
                render={
                  <Elevated
                    offset={0}
                    shadowLevel={3}
                    ref={(node: HTMLDivElement | null) => {
                      (
                        containerRef as React.MutableRefObject<HTMLDivElement | null>
                      ).current = node;
                      if (typeof ref === "function") ref(node);
                      else if (ref)
                        (
                          ref as React.MutableRefObject<HTMLDivElement | null>
                        ).current = node;
                    }}
                  />
                }
                onMouseEnter={() => {
                  // Same submenu-open guard as onMouseMove/onMouseLeave
                  // below -- handlers.onMouseEnter bumps sessionRef, whose
                  // value is the hover-background's own React `key`
                  // (further down this file), so calling it while the
                  // cursor merely re-enters this container's own DOM
                  // bounds (a natural side effect of any excursion toward
                  // or inside the submenu, even once activeIndex itself is
                  // frozen) remounts that overlay and makes it visibly
                  // refade/reset from the checked row's position instead of
                  // sliding continuously -- reading as "the hover moving"
                  // even though activeIndex itself never changed.
                  if (openSubmenuIndex !== null) return;
                  handlers.onMouseEnter();
                  setFocusedIndex(null);
                }}
                onMouseMove={(e) => {
                  // Skip while a row's own submenu is open -- a diagonal
                  // path from the trigger row toward a LOWER item inside
                  // the submenu (positioned to the side, not covering this
                  // container's own full height) still passes back through
                  // this container's own x/y space along the way. Recomputing
                  // "closest row" from that raw cursor position jumps the
                  // highlight to whichever row now sits under it, even
                  // though the intent is clearly to reach the submenu --
                  // the classic menu "safe triangle" problem. Freezing the
                  // highlight on the open submenu's own row for as long as
                  // it stays open (only re-enabled once it closes) removes
                  // the false read entirely.
                  if (openSubmenuIndex !== null) return;
                  handlers.onMouseMove(e);
                }}
                onMouseLeave={() => {
                  // Skip while a row's own submenu is open -- see the
                  // openSubmenuIndex field's own comment (menu-item.tsx):
                  // that submenu is a separate floating popup, so the
                  // cursor crossing into it always looks like "left this
                  // container" even though the row is still meaningfully
                  // hovered. activeIndex already sits on that row from the
                  // mousemove that preceded the leave, so simply not
                  // clearing it here is enough to keep it pinned.
                  if (openSubmenuIndex !== null) return;
                  handlers.onMouseLeave();
                }}
                onFocus={(e) => {
                  const indexAttr = (e.target as HTMLElement)
                    .closest("[data-proximity-index]")
                    ?.getAttribute("data-proximity-index");
                  if (indexAttr != null) {
                    const idx = Number(indexAttr);
                    setActiveIndex(idx);
                    setFocusedIndex(
                      (e.target as HTMLElement).matches(":focus-visible")
                        ? idx
                        : null
                    );
                  }
                }}
                onBlur={(e) => {
                  if (containerRef.current?.contains(e.relatedTarget as Node))
                    return;
                  setFocusedIndex(null);
                  setActiveIndex(null);
                }}
                className={cn(
                  // min-w tracks the trigger via the Positioner's
                  // --anchor-width var.
                  `relative flex flex-col w-72 max-w-full min-w-[var(--anchor-width)] max-h-[min(480px,var(--available-height))] overflow-y-auto ${DROPDOWN_PANEL_RADIUS} select-none outline-none`,
                  className
                )}
              >
                {/* Selected background */}
                <AnimatePresence>
                  {checkedRect && (
                    <motion.div
                      className={`absolute ${shape.bg} ${hoverBgClass} pointer-events-none`}
                      initial={false}
                      animate={{
                        top: checkedRect.top,
                        left: checkedRect.left,
                        width: checkedRect.width,
                        height: checkedRect.height,
                        opacity: 1,
                      }}
                      exit={{ opacity: 0, transition: spring.moderate.exit }}
                      transition={{
                        ...spring.moderate,
                        opacity: { duration: 0.08 },
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Hover background */}
                <AnimatePresence>
                  {activeRect && (
                    <motion.div
                      key={sessionRef.current}
                      className={`absolute ${shape.bg} ${hoverBgClass} pointer-events-none`}
                      initial={{
                        opacity: 0,
                        top: checkedRect?.top ?? activeRect.top,
                        left: checkedRect?.left ?? activeRect.left,
                        width: checkedRect?.width ?? activeRect.width,
                        height: checkedRect?.height ?? activeRect.height,
                      }}
                      animate={{
                        opacity: 1,
                        top: activeRect.top,
                        left: activeRect.left,
                        width: activeRect.width,
                        height: activeRect.height,
                      }}
                      exit={{ opacity: 0, transition: spring.fast.exit }}
                      transition={{
                        ...spring.fast,
                        opacity: { duration: 0.08 },
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Focus ring */}
                <AnimatePresence>
                  {focusRect && (
                    <motion.div
                      className={`absolute ${shape.focusRing} pointer-events-none z-20 border border-[color:var(--focus-ring,#6B97FF)]`}
                      initial={false}
                      animate={{
                        left: focusRect.left - 2,
                        top: focusRect.top - 2,
                        width: focusRect.width + 4,
                        height: focusRect.height + 4,
                      }}
                      exit={{ opacity: 0, transition: spring.fast.exit }}
                      transition={{
                        ...spring.fast,
                        opacity: { duration: 0.08 },
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* display: contents keeps items direct flex children of the
                    popup so proximity measurement and gap layout still work,
                    while the group provides the radio value context.
                    SurfaceProvider re-wrap -- same reason
                    DropdownSubMenuItem's own popup needs it (that
                    component's own comment has the full explanation):
                    Elevated's internal SurfaceProvider only wraps whatever
                    it renders as ITS OWN children (none, used via `render`
                    here), so without this, nothing nested inside a row
                    here (a provider's own submenu, a model's own "Set as
                    default" menu) would ever see an incremented substrate
                    at all -- every level of nesting would keep computing
                    z-index/elevation from the *page's* own base level
                    instead of climbing with real nesting depth. Plain
                    zIndexSubstrate, not +2 -- real bug, confirmed directly
                    ("the dropdowns should be 1 then if there's another
                    dropdown inside 2"): this panel's own Elevated now uses
                    offset={0} (so its real level *is* zIndexSubstrate,
                    unlifted -- the panel itself is the app's own first
                    surface tier), so nested content's ambient must match
                    that same real level, not skip two tiers ahead of it. */}
                <SurfaceProvider value={Math.min(zIndexSubstrate, 8)}>
                  <Menu.RadioGroup
                    value={checkedIndex ?? null}
                    className="contents"
                  >
                    {children}
                  </Menu.RadioGroup>
                </SurfaceProvider>
              </Menu.Popup>
            </DropdownContext.Provider>
          </motion.div>
        </Menu.Positioner>
      </Menu.Portal>
    );
  }
);

DropdownContent.displayName = "DropdownContent";

// ---------------------------------------------------------------------------
// DropdownLabel
// ---------------------------------------------------------------------------

const DropdownLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    // Group labels are the caption role of the type scale — see /docs/sizes.
    const compact = useSize().variant === "compact";
    return (
    <div
      ref={ref}
      className={cn(
        "px-2 py-1.5 shrink-0 text-muted-foreground",
        compact ? "text-[11px]" : "text-[12px]",
        className
      )}
      {...props}
    />
    );
  }
);

DropdownLabel.displayName = "DropdownLabel";

// ---------------------------------------------------------------------------
// DropdownSeparator
// ---------------------------------------------------------------------------

const DropdownSeparator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn("my-1 h-px shrink-0 bg-border/60", className)}
    {...props}
  />
));

DropdownSeparator.displayName = "DropdownSeparator";

// ---------------------------------------------------------------------------
// DropdownSubMenuItem (submenu row: trigger + nested popup, combined)
//
// The installed reference component ships no submenu wrapper at all --
// Menu.SubmenuRoot/SubmenuTrigger are bare Base UI primitives, unstyled.
// This hand-builds one row+popup pair matching Dropdown/DropdownContent's
// own visual language (Elevated surface, rounded shape, spring open/close)
// without reimplementing the full proximity-hover glide system for the
// nested popup's own items -- those use Base UI's own data-highlighted
// state with plain Tailwind instead of a second proximity overlay.
// ---------------------------------------------------------------------------

interface DropdownSubMenuItemProps {
  /** This row's own index in the PARENT dropdown's item list (proximity
   *  hover / keyboard order) -- same meaning as MenuItem's own `index`. */
  index: number;
  icon?: IconComponent;
  label: string;
  /** Checkmark on the trigger row itself (e.g. "one of this provider's
   *  models is the current selection"), independent of the submenu's own
   *  open state. */
  checked?: boolean;
  className?: string;
  /** The submenu's own content -- typically a Menu.RadioGroup of
   *  Menu.RadioItem rows (see DropdownSubItem below for pre-styled ones). */
  children: ReactNode;
}

function DropdownSubMenuItem({
  index,
  icon: Icon,
  label,
  checked,
  className,
  children,
}: DropdownSubMenuItemProps) {
  const { registerItem, activeIndex, setOpenSubmenuIndex } = useDropdown();
  const internalRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const actionsRef = useRef<DropdownMenuActions | null>(null);
  const sizeClasses = useSize();

  // Reports this row's own open state up to the parent popup -- see
  // openSubmenuIndex's own comment (menu-item.tsx).
  useEffect(() => {
    setOpenSubmenuIndex?.(open ? index : null);
  }, [open, index, setOpenSubmenuIndex]);
  // Same lockstep-with-nesting-depth z-index as DropdownContent's own --
  // see that component's own comment for the full reasoning (a flat z-50
  // on every level was the real cause of a nested "Set as default" menu's
  // hover fighting with the provider list two levels up).
  const zIndexSubstrate = useSurface();
  const zIndex = 40 + Math.min(zIndexSubstrate + 2, 8) * 10;

  useEffect(() => {
    registerItem(index, internalRef.current);
    return () => registerItem(index, null);
  }, [index, registerItem]);

  // Same deferred-unmount pattern as DropdownContent's own -- Base UI keeps
  // the submenu's DOM mounted while actionsRef is set, so this releases it
  // once the exit spring has actually finished playing.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => actionsRef.current?.unmount(), exitFallbackMs(spring.fast));
    return () => clearTimeout(id);
  }, [open]);

  const isActive = activeIndex === index;
  const highlighted = isActive || open || checked;

  return (
    <Menu.SubmenuRoot open={open} onOpenChange={setOpen} actionsRef={actionsRef}>
      <Menu.SubmenuTrigger
        render={
          <div
            ref={internalRef}
            data-proximity-index={index}
            aria-label={label}
            className={cn(
              `relative z-10 flex ${sizeClasses.control} shrink-0 items-center ${sizeClasses.gap} ${shape.item} ${sizeClasses.itemPx} cursor-pointer outline-none`,
              // Same divider-adjacent margin-cancel rule as MenuItem's own
              // itemClassName (menu-item.tsx's own comment has the full
              // reasoning) -- a submenu trigger row (e.g. "Add to project")
              // sits right next to a DropdownSeparator just as often as a
              // plain MenuItem does. has-[~...] (any later sibling), not
              // has-[+...] (immediate next sibling only) -- real bug,
              // confirmed via screenshot ("the add project looks right but
              // when i hover over that creates the space again"): opening
              // this row's own submenu (openOnHover, Base UI's default)
              // inserts a floating-ui positioning node as a real sibling
              // right after this row while open, which made the separator
              // no longer this row's *immediate* next sibling and broke the
              // `+` match specifically while hovered/open. `~` still
              // matches with that extra node in between. Safe here (unlike
              // MenuItem's own `+`) because a menu only ever has one
              // submenu trigger immediately before a given divider, so
              // there's no earlier row this could wrongly also match.
              "[[role=separator]+&]:-mt-1 has-[~[role=separator]]:-mb-1",
              // px-2 -- same border-clearance fix as MenuItem's own
              // itemClassName (menu-item.tsx's own comment has the full
              // reasoning).
              "px-2",
              className
            )}
          />
        }
      >
        {Icon && (
          <Icon
            size={sizeClasses.icon}
            strokeWidth={highlighted ? 2 : 1.5}
            // text-foreground at rest, not text-muted-foreground -- same
            // fix as MenuItem's own icon/label (menu-item.tsx's own
            // comment has the full reasoning/screenshot): a submenu
            // trigger row (e.g. "Add to project") is exactly as
            // permanently-visible as a plain MenuItem row, so it dims the
            // same way for no reason until actually hovered/open.
            className="shrink-0 text-foreground transition-[color,stroke-width] duration-80"
          />
        )}
        <span className={cn("flex-1 truncate text-foreground transition-colors duration-80", sizeClasses.text)}>
          {label}
        </span>
        {checked && (
          <svg width={sizeClasses.icon} height={sizeClasses.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foreground">
            <path d="M4 12L9 17L20 6" />
          </svg>
        )}
      </Menu.SubmenuTrigger>
      <AnimatePresence>
        {open && (
          <Menu.Portal>
            <Menu.Positioner side="right" align="start" sideOffset={4} className="outline-none" style={{ zIndex }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1, transition: spring.fast }}
                exit={{ opacity: 0, scale: 0.96, transition: spring.fast.exit }}
                onAnimationComplete={() => {
                  if (!open) actionsRef.current?.unmount();
                }}
              >
                <Menu.Popup
                  render={<Elevated offset={1} shadowLevel={3} />}
                  className={`flex flex-col min-w-40 max-w-full max-h-[min(480px,var(--available-height))] overflow-y-auto ${DROPDOWN_PANEL_RADIUS} outline-none`}
                >
                  {/* Elevated's own internal SurfaceProvider only wraps
                      whatever it renders as ITS OWN children -- none, used
                      via `render` here -- so it never reaches Menu.Popup's
                      real children below without this explicit re-wrap
                      (DropdownContent's own top-level popup does the same
                      thing, separately from its own Elevated). Without it,
                      anything nested inside a submenu row (a model row's
                      own "Set as default" menu) would read the *same*
                      substrate as this submenu itself instead of one step
                      deeper, landing both at the same z-index -- half of
                      the real bug behind "the hover at the third menu...
                      keeps moving the hover at provider" (this component's
                      own zIndex comment above covers the other half).
                      zIndexSubstrate + 1, not + 2 -- matches this popup's
                      own Elevated offset={1} above (its real level *is*
                      zIndexSubstrate + 1), per the same fix DropdownContent's
                      own re-wrap just got (that one's own comment has the
                      full bug report). */}
                  <SurfaceProvider value={Math.min(zIndexSubstrate + 1, 8)}>{children}</SurfaceProvider>
                </Menu.Popup>
              </motion.div>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </AnimatePresence>
    </Menu.SubmenuRoot>
  );
}

// ---------------------------------------------------------------------------
// DropdownSubItem -- a plain row inside a DropdownSubMenuItem's own submenu
// (or any raw Menu.Popup). Not proximity-hover tracked (a second nested
// proximity overlay isn't worth building) -- uses Base UI's own
// data-highlighted/data-checked state directly instead.
// ---------------------------------------------------------------------------

interface DropdownSubItemProps extends HTMLAttributes<HTMLDivElement> {
  radio?: boolean;
  value?: string | number;
  disabled?: boolean;
  closeOnClick?: boolean;
}

const DropdownSubItem = forwardRef<HTMLDivElement, DropdownSubItemProps>(
  ({ radio, value, disabled, closeOnClick, className, children, ...props }, ref) => {
    // Real level-aware highlight, not a flat static token -- per explicit
    // request ("the hover should be level 2... the dropdowns should be 1
    // then if there's another dropdown inside 2"). This row's own ambient
    // level (set by whichever popup's SurfaceProvider actually renders it
    // -- DropdownSubMenuItem's own submenu, or DropdownContent's top-level
    // popup for a plain non-nested caller) already *is* that popup's real
    // level, so the highlight sits one tier above it.
    const level = useSurface();
    const highlightClass = SURFACE_DATA_HIGHLIGHTED_BG[Math.min(level + 1, 8)];
    const rowClassName = cn(
      `relative flex ${useSize().control} shrink-0 items-center ${useSize().itemPx} cursor-pointer outline-none ${highlightClass} data-disabled:pointer-events-none data-disabled:opacity-50 ${shape.item}`,
      // Same divider-adjacent margin-cancel rule as MenuItem's own
      // itemClassName (menu-item.tsx's own comment has the full reasoning)
      // -- a DropdownSubItem sits right next to a DropdownSeparator just
      // as often as a plain MenuItem does (e.g. the flattened model list's
      // own "Add provider" row after its separator). `+` (immediate
      // sibling), not `~`, is safe here: unlike DropdownSubMenuItem, this
      // row never opens its own submenu, so no floating-ui node is ever
      // inserted between it and a following separator.
      "[[role=separator]+&]:-mt-1 has-[+[role=separator]]:-mb-1",
      // px-2 -- same border-clearance fix as MenuItem's own itemClassName
      // (menu-item.tsx's own comment has the full reasoning).
      "px-2",
      className
    );
    return radio ? (
      <Menu.RadioItem
        ref={ref}
        value={value}
        disabled={disabled}
        closeOnClick={closeOnClick ?? true}
        className={rowClassName}
        {...props}
      >
        {children}
      </Menu.RadioItem>
    ) : (
      <Menu.Item
        ref={ref}
        disabled={disabled}
        closeOnClick={closeOnClick ?? true}
        className={rowClassName}
        {...props}
      >
        {children}
      </Menu.Item>
    );
  }
);

DropdownSubItem.displayName = "DropdownSubItem";

// ---------------------------------------------------------------------------
// DropdownRowActionItem -- a plain clickable row for use inside
// DropdownRowActionMenu (below). Same visual shape as DropdownSubItem, but a
// bare div with a manual hover className instead of Menu.Item/data-highlighted
// -- DropdownRowActionMenu's own popup isn't a Base UI Menu at all (that's
// the whole point of it, see its own comment), so Menu.Item would throw
// looking for a Menu.Root/SubmenuRoot context that isn't there.
// ---------------------------------------------------------------------------

interface DropdownRowActionItemProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
}

const DropdownRowActionItem = forwardRef<HTMLDivElement, DropdownRowActionItemProps>(
  ({ disabled, className, children, onClick, ...props }, ref) => {
    // Real level-aware hover, not a flat static token -- same fix as
    // DropdownSubItem's own highlightClass above (that one's own comment
    // has the full bug report). Real :hover here (not Base UI's
    // data-highlighted), so this reuses SURFACE_HOVER_BG directly.
    const level = useSurface();
    const hoverClass = SURFACE_HOVER_BG[Math.min(level + 1, 8)];
    return (
    <div
      ref={ref}
      role="menuitem"
      aria-disabled={disabled}
      tabIndex={disabled ? undefined : 0}
      onClick={disabled ? undefined : onClick}
      className={cn(
        `relative flex ${useSize().control} shrink-0 items-center ${useSize().itemPx} cursor-pointer outline-none ${hoverClass} ${disabled ? "pointer-events-none opacity-50" : ""} ${shape.item}`,
        className
      )}
      {...props}
    >
      {children}
    </div>
    );
  }
);

DropdownRowActionItem.displayName = "DropdownRowActionItem";

// ---------------------------------------------------------------------------
// DropdownRowActionMenu -- a small "..." trigger nested INSIDE a row (e.g. a
// model row's own "Set as default"), opening a tiny action popover.
//
// NOT built on Base UI's Menu primitives. Two things were tried first, both
// real Menu.SubmenuRoot/SubmenuTrigger nested inside the row's own Menu.Item:
//   1. An independent BaseDropdownMenu (Menu.Root) -- the ANCESTOR submenu's
//      own outside-interaction bookkeeping didn't recognize it as part of
//      its tree, so clicking inside it closed the whole chain.
//   2. A genuine Menu.SubmenuRoot/SubmenuTrigger, to fix (1) -- but a
//      SubmenuTrigger is meant to sit directly in a menu's own item list,
//      not nested a second time inside an ALREADY-a-composite-list-item
//      Menu.Item. In that configuration the row's own hover/roving-focus
//      handling and this trigger's own hover-intent kept fighting even
//      after disabling openOnHover, closing the popover the instant the
//      cursor moved off the tiny "..." button toward its own content
//      ("stays open but once i move to click on it that closes it").
// A plain, self-contained popover -- click to open, pointerdown-outside
// (capture phase, so it runs before any ANCESTOR menu's own outside-press
// handling could treat this click as "outside" and close the whole chain
// first) and Escape to close -- has none of that entanglement: it doesn't
// register into any menu's composite list or hover-intent system at all.
// ---------------------------------------------------------------------------

interface DropdownRowActionMenuProps {
  triggerLabel: string;
  /** Passed straight through to the shared MoreTrigger (ui/more-trigger.tsx)
   *  -- same "..." everywhere else in the app now renders through, per
   *  explicit request ("the three dots at Models should have the same
   *  behaviour... make sure that the reusable three dots contains the
   *  dropdown as well"). */
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md";
  bg?: boolean;
  autoHide?: boolean;
  triggerClassName?: string;
  /** Describer at the top of the popup, matching every other dropdown's own
   *  BaseDropdownLabel. Overridable per call site, "More" by default. */
  label?: string;
  children: ReactNode;
}

function DropdownRowActionMenu({
  triggerLabel,
  orientation,
  size,
  bg,
  autoHide,
  triggerClassName,
  label = "More",
  children,
}: DropdownRowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const zIndexSubstrate = useSurface();
  const zIndex = 40 + Math.min(zIndexSubstrate + 2, 8) * 10;
  // Screen position, computed from the trigger button's own real rect --
  // see below for why this can't just be `position: absolute` within the
  // row.
  const [position, setPosition] = useState<{ top: number; left: number; origin: "left" | "right" } | null>(null);

  // Positions itself via a portal (below) at the trigger's own real screen
  // rect, side="right" align="start" like the other nested dropdowns --
  // NOT `position: absolute` within the row. This row already lives inside
  // a submenu popup with its own `overflow-y-auto`/finite width (a real
  // clipping ancestor), so an absolutely-positioned child of the row was
  // clipped to that ancestor's own bounds instead of floating freely
  // ("the set as default now is inside the child and not going over like
  // the other dropdowns"). useLayoutEffect, not useEffect, so the position
  // is measured and applied before the browser paints the open frame.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const update = () => {
      const rect = trigger.getBoundingClientRect();
      // Flip to the trigger's own left side once measured content would
      // overflow the window's right edge -- popupRef isn't mounted yet on
      // the very first pass (origin unknown), so that pass assumes "right"
      // and a second pass (once popupRef has a real width) corrects it if
      // needed.
      const popupWidth = popupRef.current?.getBoundingClientRect().width ?? 0;
      const overflowsRight = rect.right + 4 + popupWidth > window.innerWidth;
      setPosition({
        top: rect.top,
        left: overflowsRight ? rect.left - 4 - popupWidth : rect.right + 4,
        origin: overflowsRight ? "right" : "left",
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  return (
    <>
      <MoreTrigger
        ref={triggerRef}
        aria-label={triggerLabel}
        aria-expanded={open}
        orientation={orientation}
        size={size}
        bg={bg}
        autoHide={autoHide}
        // Same pointerdown+click stopPropagation as before -- pointerdown
        // and click are separate DOM events, so stopping only one still lets
        // the row's own onClick (selecting this item) fire on whichever one
        // wasn't stopped.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={triggerClassName}
      />
      {createPortal(
        <AnimatePresence>
          {open && position && (
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: spring.fast }}
              exit={{ opacity: 0, scale: 0.96, transition: spring.fast.exit }}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                zIndex,
                transformOrigin: `top ${position.origin}`,
              }}
              // The row's own onClick (selecting this item) would otherwise
              // fire for any click landing inside this popup too, same
              // reason as the trigger button's own stopPropagation above.
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <Elevated
                offset={1}
                shadowLevel={3}
                // shape.container, not DROPDOWN_PANEL_RADIUS -- this popup
                // is a single tiny row, not a full menu panel: at that box
                // size, the other panels' own rounded-3xl reads as a pill
                // rather than a rounded rectangle, badly mismatched against
                // the small "..." trigger's own tighter corner right next
                // to it. shape.container already scales with the app's own
                // shape mode (rounded-xl in "rounded" mode) instead of a
                // single fixed radius applied regardless of box size.
                className={`flex flex-col min-w-32 max-w-full overflow-hidden ${shape.container} outline-none`}
              >
                <DropdownLabel>{label}</DropdownLabel>
                {children}
              </Elevated>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export {
  Dropdown,
  DropdownLabel,
  DropdownSeparator,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownSubMenuItem,
  DropdownSubItem,
  DropdownRowActionMenu,
  DropdownRowActionItem,
};
// DropdownContextValue and MenuItemRenderOptions are already re-exported
// above next to their import — repeating them here is a duplicate-export
// build error.
export type {
  DropdownProps,
  DropdownMenuProps,
  DropdownTriggerProps,
  DropdownContentProps,
};
export default Dropdown;
