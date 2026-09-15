import * as React from "react"

// Bridges a Radix Root's open state into plain React state so a Content
// component can gate an AnimatePresence with a real boolean (Radix's own
// forceMount keeps the DOM node mounted regardless of open state, so
// something else has to own the boolean that drives mount/unmount).
// Works uncontrolled (Root manages its own state) or controlled (caller
// passes open/onOpenChange) exactly like the Radix prop it mirrors.
export function useControlledOpen(
  openProp: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
  defaultOpen = false
): [boolean, (open: boolean) => void] {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )
  return [open, setOpen]
}
