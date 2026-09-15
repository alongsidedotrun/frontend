// Shared helper for index.css's own "Transitions.dev — Tooltip
// open/close" utility (.t-tt-wrap/.t-tt-trigger/.t-tt). Both the CSS
// hover/focus-visible rules there require the wrap's own
// data-tt-truncated attribute to be present before revealing the
// tooltip -- this measures whether the trigger's own label is actually
// cut off right now (scrollWidth > clientWidth, not a guess based on
// character count, which would be wrong the moment font metrics or the
// row's own width changed) and toggles that attribute accordingly, so a
// label already showing its full name in full never reveals a redundant
// tooltip on hover/focus. Call from the wrap's own onMouseEnter/onFocus
// (sidebar-nav.tsx's positionFixedTooltip and top-bar.tsx's search
// dropdown rows both do).
export function markTooltipTruncated(wrap: HTMLElement): boolean {
  const label = wrap.querySelector<HTMLElement>(".truncate");
  const truncated = !!label && label.scrollWidth > label.clientWidth;
  wrap.toggleAttribute("data-tt-truncated", truncated);
  return truncated;
}
