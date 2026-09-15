import type { ReactNode } from "react";

// Single source of truth for the shared content-column width every page's
// primary content should sit inside -- matches HomePage's own compose box
// column (HomePage.tsx's "mx-auto mb-32 w-full max-w-[800px]" wrapper), so
// a new page lands in the same visual column the compose box already
// established instead of picking its own width. A plain exported constant
// (not just baked into the className below) so anything that needs the raw
// value -- not just this wrapper -- has one place to read it from.
export const PAGE_CONTENT_WIDTH = "800px";

export function PageContent({
  children,
  className = "",
  maxWidth = PAGE_CONTENT_WIDTH,
}: {
  children: ReactNode;
  className?: string;
  /** Override the shared 800px cap -- settings-overlay.tsx's own Settings
   *  page passes `var(--chat-max-width)` here so choosing "Expanded" in
   *  Appearance's own Chat width row visibly widens the Settings page
   *  itself too, confirmed directly as wanted ("that should expand the
   *  settings content as well so we can see the difference being applied
   *  before going to homepage") rather than only affecting Home/Chat,
   *  which left the setting's actual effect invisible until navigating
   *  away from Settings to check it. */
  maxWidth?: string;
}) {
  // t-chat-width (index.css's own "Transitions.dev — Chat width change")
  // only when a caller actually overrides the width -- per explicit
  // request ("we should do a transition of the items expanding width"),
  // scoped to Settings' own live-preview usage rather than every page,
  // since a page always passing the same static 800px default never
  // changes maxWidth at runtime and has nothing to transition anyway.
  const widthTransitionClass = maxWidth === PAGE_CONTENT_WIDTH ? "" : "t-chat-width";
  return (
    <div className={`mx-auto flex w-full flex-1 flex-col ${widthTransitionClass} ${className}`} style={{ maxWidth }}>
      {children}
    </div>
  );
}
