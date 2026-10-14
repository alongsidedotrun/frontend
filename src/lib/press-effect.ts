// Hover and press feedback for controls that show no hover background (the
// compose row's +, Model, Effort, Permissions and mic; the sidebar's search,
// section + and settings cog). Hovering fades the control toward the surface
// (lighter in light mode, darker in dark mode) and pressing scales it down:
// held scale via :active, and a one-shot press-tap (index.css) for menu
// triggers, which never get :active and keep data-pressed set for as long as
// their menu is open.
// !transition: .t-input (Model's trigger) is unlayered CSS that would
// otherwise win over this utility; border-color kept for its error shake.
export const PRESS_EFFECT =
  "transform-gpu !transition-[color,opacity,scale,border-color] duration-150 ease-out hover:opacity-70 active:scale-[0.96] data-[pressed]:animate-[press-tap_220ms_ease-out] motion-reduce:active:scale-100 motion-reduce:animate-none";

// Icon-only controls dip deeper, since 96% of a small glyph is barely visible.
// Goes after PRESS_EFFECT so cn() keeps these.
export const ICON_PRESS = "[--press-scale:0.9] active:scale-[0.9]";
