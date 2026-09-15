import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // focus-visible:border-ring dropped (this used to have it): --ring
        // is set to transparent globally (index.css) to remove the focus
        // glow/ring effect app-wide, but this class controlled the
        // *border color* on focus, not the glow -- with --ring
        // transparent, focusing any input made its border try to become
        // that same transparent value, hiding a visible border
        // specifically while focused instead of leaving it at its
        // resting border-input color. Confirmed directly on the top bar's
        // search input (border-border override, still hit the same base
        // class here).
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
