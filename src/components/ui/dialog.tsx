import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "@/components/icons/untitled-ui"
import { useSurface, SurfaceProvider } from "@/lib/surface-context"
import { surfaceClasses } from "@/lib/surface-classes"
import { spring } from "@/lib/springs"
import { useControlledOpen } from "@/lib/use-controlled-open"

// See ui/dropdown-menu.tsx's own comment on why Content needs this: Radix's
// forceMount keeps the DOM node mounted regardless of open state, so a real
// boolean has to gate AnimatePresence for exit animations to play at all.
const DialogOpenContext = React.createContext(false)

function Dialog({
  open: openProp,
  onOpenChange,
  defaultOpen,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange, defaultOpen)
  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root
        data-slot="dialog"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </DialogOpenContext.Provider>
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  const open = React.useContext(DialogOpenContext)
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Overlay forceMount asChild data-slot="dialog-overlay" {...props}>
          {/* spring.fast -- a backdrop fade is exactly this tier's own
              "fades" use case, distinct from the panel's own slower
              entrance below. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: spring.fast }}
            exit={{ opacity: 0, transition: spring.fast.exit }}
            className={cn(
              "fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
              className
            )}
          />
        </DialogPrimitive.Overlay>
      )}
    </AnimatePresence>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  // Elevated (lib/elevated.tsx) two steps above whatever it opens on top of
  // -- the "dialog/modal" offset that component's own doc comment
  // recommends -- re-provided via SurfaceProvider so anything opened FROM
  // inside this dialog (a dropdown, a nested confirm) reads the correct
  // substrate instead of assuming the page's own base level. Not the
  // <Elevated> wrapper component itself -- that renders its own extra div,
  // and this element already needs to be DialogPrimitive.Content directly
  // (portal/animation/ref requirements) -- same surfaceClasses()/
  // SurfaceProvider logic applied inline instead.
  const substrate = useSurface()
  const level = Math.min(substrate + 4, 8)
  const open = React.useContext(DialogOpenContext)
  return (
    <AnimatePresence>
      {open && (
        <DialogPortal forceMount>
          <DialogOverlay />
          <DialogPrimitive.Content
            forceMount
            asChild
            data-slot="dialog-content"
            {...props}
          >
            {/* spring.slow -- dialogs/modals are this tier's named use
                case (lib/springs.ts), with the small bounce (0.12) that
                tier carries baked in via the transition object below. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, transition: spring.slow }}
              exit={{ opacity: 0, scale: 0.95, transition: spring.slow.exit }}
              className={cn(
                "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm text-popover-foreground outline-none sm:max-w-sm",
                surfaceClasses(level),
                className
              )}
            >
              <SurfaceProvider value={level}>
              {children}
              </SurfaceProvider>
              {showCloseButton && (
                <DialogPrimitive.Close data-slot="dialog-close" asChild>
                  <Button
                    variant="ghost"
                    className="absolute top-2 right-2"
                    size="icon-sm"
                  >
                    <XIcon
                    />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogPrimitive.Close>
              )}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </AnimatePresence>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
