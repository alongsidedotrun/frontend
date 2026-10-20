export const spring = {
  fast: {
    type: "spring" as const,
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  // Critically damped: same perceived speed as a bouncier tier, but lands
  // exactly with no overshoot — for short travel and panels/sheets that must
  // settle precisely (dropdowns, tabs, drawers, merged selection backgrounds).
  moderate: {
    type: "spring" as const,
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.12 },
  },
  slow: {
    type: "spring" as const,
    duration: 0.24,
    bounce: 0.12,
    exit: { duration: 0.16 },
  },
  // Large panels (the two-pane workspace dialogs): no bounce and a longer
  // settle, so a big surface eases in rather than snapping.
  gentle: {
    type: "spring" as const,
    duration: 0.36,
    bounce: 0,
    exit: { duration: 0.24 },
  },
} as const;

// Fallback delay (ms) for deferred-unmount timers that guard an exit tween:
// popups keep their portal mounted until onAnimationComplete fires, but a
// throttled/background tab can stall the animation, so a timer force-unmounts
// after the tier's exit duration plus a safety buffer. Deriving it here keeps
// the timers in step with the tokens above.
export const exitFallbackMs = (tier: { exit: { duration: number } }) =>
  Math.round(tier.exit.duration * 1000) + 100;

// A view swapped for another in place (tab content): fully out, then in, at the pace of the page
// content swaps (SidebarSurfaceTransition's 400ms ease-in-out), rather than a quick spring.
export const fade = { duration: 0.4, ease: "easeInOut" as const };
