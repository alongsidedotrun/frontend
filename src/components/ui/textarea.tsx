import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // focus-visible:border-ring dropped -- see input.tsx's own
        // identical comment for why.
        // text-sm at every width, not text-base below md -- the size no
        // longer bumps up on mobile, per explicit request, even though
        // that bump (a shadcn default) was there specifically to keep
        // this below 16px on a touch device from auto-zooming the page
        // on focus (same fix top-bar.tsx's own search input needed the
        // opposite way, sizing *up* to 16px there instead of down). This
        // compose box's own textarea will zoom the page in on focus on
        // an actual phone as a result -- a known, accepted trade-off, not
        // an oversight.
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
