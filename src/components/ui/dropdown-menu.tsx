"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { CheckIcon, ChevronRightIcon } from "@/components/icons/untitled-ui"
import { useSurface, SurfaceProvider } from "@/lib/surface-context"
import { surfaceClasses } from "@/lib/surface-classes"
import { spring } from "@/lib/springs"
import { useControlledOpen } from "@/lib/use-controlled-open"

// Content/SubContent need a real boolean (not just Radix's own data-state)
// to gate an AnimatePresence for exit animations under forceMount -- see
// lib/use-controlled-open.ts's own comment.
const DropdownMenuOpenContext = React.createContext(false)
const DropdownMenuSubOpenContext = React.createContext(false)

function DropdownMenu({
  open: openProp,
  onOpenChange,
  defaultOpen,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange, defaultOpen)
  return (
    <DropdownMenuOpenContext.Provider value={open}>
      <DropdownMenuPrimitive.Root
        data-slot="dropdown-menu"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </DropdownMenuOpenContext.Provider>
  )
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  viewportClassName,
  align = "start",
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  /** Classes for the inner scroll viewport (overflow/max-height) -- pass
   *  this, not `className`, to override scrolling behavior (e.g. a taller
   *  max-height for a long list). See this component's own comment on why
   *  scroll/overflow lives on a separate inner element now. */
  viewportClassName?: string
}) {
  // Elevated (lib/elevated.tsx) one step above whatever it opens on top of
  // -- the "dropdown / popover / select menu" offset that component's own
  // doc comment recommends -- re-provided via SurfaceProvider so a further
  // nested menu (a submenu, or a menu opened from inside a dialog) reads
  // the correct substrate instead of assuming the page's own base level.
  // Not the <Elevated> wrapper itself -- this element already needs to be
  // DropdownMenuPrimitive.Content directly (portal/positioning/ref
  // requirements) -- same surfaceClasses()/SurfaceProvider logic applied
  // inline instead.
  const substrate = useSurface()
  const level = Math.min(substrate + 2, 8)
  const open = React.useContext(DropdownMenuOpenContext)
  return (
    <AnimatePresence>
      {open && (
        <DropdownMenuPrimitive.Portal forceMount>
          <DropdownMenuPrimitive.Content
            forceMount
            asChild
            data-slot="dropdown-menu-content"
            sideOffset={sideOffset}
            align={align}
            {...props}
          >
            {/* spring.moderate -- dropdowns are this tier's named use case
                (lib/springs.ts). asChild hands Radix's own positioning
                props (style/data-side/data-align) straight to this
                motion.div instead of a plain div, so JS-driven spring
                physics replace the old Tailwind animate-in/out (which
                could only ever play a fixed-duration CSS keyframe). */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: spring.moderate }}
              exit={{ opacity: 0, scale: 0.96, transition: spring.moderate.exit }}
              // overflow-x-hidden/overflow-y-auto/max-h moved off this
              // element, onto an inner wrapper below -- real bug, confirmed
              // directly ("the avatar dropdown bg now matches the same
              // color as the border"): surfaceClasses() draws elevation via
              // a box-shadow (the shadow-surface-N ring baked into it, not
              // a real `border` any more), and an element with its own
              // overflow constrained (or a clipping ancestor) can end up
              // with that shadow clipped away entirely, reading as "no
              // border" rather than "wrong color". This element now
              // carries only shape/position/animation; nothing here clips
              // its own box-shadow.
              className={cn("z-50 w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) rounded-lg text-popover-foreground", surfaceClasses(level), className )}
            >
              {/* p-1 baked in here (was left to each consumer,
                  inconsistently -- several forgot it entirely) -- matches
                  the installed reference Dropdown's own p-1
                  (ui/dropdown.tsx), per explicit request ("the padding of
                  our dropdown should match the padding at [that
                  reference]"). */}
              <div className={cn("max-h-(--radix-dropdown-menu-content-available-height) overflow-x-hidden overflow-y-auto rounded-lg p-1", viewportClassName)}>
                <SurfaceProvider value={level}>{children}</SurfaceProvider>
              </div>
            </motion.div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      // gap-[7px]/size-3.5 (14px) icon fallback -- matches the sidebar's
      // own effective icon-to-label spacing (RailButton's icon sits in a
      // size-5/20px box around a 14px glyph -- a 3px inset each side --
      // plus the label's own ml-1/4px margin, so its real visual gap is
      // 7px, not the bare 4px gap-1 this used to read: confirmed directly
      // as a real mismatch ("the space between text and icon on our
      // dropdown should match the same space at our sidebar items...on
      // all dropdowns"). Was gap-1.5/size-4 (6px/16px) before that, per an
      // earlier app-wide compact-scale audit.
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-[7px] px-1.5 py-1 text-sm text-muted-foreground outline-hidden select-none focus:bg-hover-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-[7px] py-1 pr-8 pl-1.5 text-sm text-muted-foreground outline-hidden select-none focus:bg-hover-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon
          />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-[7px] py-1 pr-8 pl-1.5 text-sm text-muted-foreground outline-hidden select-none focus:bg-hover-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon
          />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      // px-2 py-1.5, not px-1.5 py-1 -- matches the installed reference
      // Dropdown's own DropdownLabel padding exactly (ui/dropdown.tsx),
      // per explicit request ("the padding of our dropdown should match
      // the padding at [that reference]"). Labels get more room than a
      // plain row (itemPx/px-1.5) since they're not sized to a control
      // height the way item rows are.
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      // No margin at all, not my-0.5/my-1: items already carry their own
      // py-1 padding, so *any* extra margin here stacks on top of that on
      // both sides -- against the very dark popover background, even 2px
      // (my-0.5) still read as a visible second, wider "border" sitting
      // around the thin 1px line instead of a tight divider.
      className={cn("h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  open: openProp,
  onOpenChange,
  defaultOpen,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange, defaultOpen)
  return (
    <DropdownMenuSubOpenContext.Provider value={open}>
      <DropdownMenuPrimitive.Sub
        data-slot="dropdown-menu-sub"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </DropdownMenuSubOpenContext.Provider>
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-[7px] px-1.5 py-1 text-sm text-muted-foreground outline-hidden select-none focus:bg-hover-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-open:bg-hover-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  // Elevated one more step above its own parent content -- the substrate
  // here already reads whatever level DropdownMenuContent's own
  // SurfaceProvider set above, so this compounds correctly (a submenu
  // inside a menu inside a dialog lands three steps up, not two).
  const substrate = useSurface()
  const level = Math.min(substrate + 2, 8)
  const open = React.useContext(DropdownMenuSubOpenContext)
  return (
    <AnimatePresence>
      {open && (
        // sideOffset=4, not the unset default (0): a submenu flush against
        // its trigger's own edge left Radix's collision detection with less
        // margin to work with in a narrow popover (the header's filter menu,
        // several levels of nested Group by/Order by submenus), which was
        // flipping these open *below* their trigger instead of to the right
        // -- the small gap this offset creates was enough for collision
        // detection to keep placing it to the right as intended instead.
        <DropdownMenuPrimitive.SubContent
          forceMount
          asChild
          data-slot="dropdown-menu-sub-content"
          sideOffset={4}
          {...props}
        >
          {/* spring.moderate -- same tier as the parent menu it's nested
              in (dropdowns/panels). */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: spring.moderate }}
            exit={{ opacity: 0, scale: 0.96, transition: spring.moderate.exit }}
            // overflow-hidden moved to an inner wrapper -- same reason
            // DropdownMenuContent's own comment gives: an element with its
            // own overflow constrained can end up with its surfaceClasses()
            // own box-shadow (the ring that's standing in for a real border
            // now) clipped away.
            className={cn("z-50 min-w-[96px] origin-(--radix-dropdown-menu-content-transform-origin) rounded-lg text-popover-foreground", surfaceClasses(level), className )}
          >
            {/* p-1 baked in here too, matching DropdownMenuContent's own. */}
            <div className="overflow-hidden rounded-lg p-1">
              <SurfaceProvider value={level}>{children}</SurfaceProvider>
            </div>
          </motion.div>
        </DropdownMenuPrimitive.SubContent>
      )}
    </AnimatePresence>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
