// Real bug, confirmed directly ("When i expand the worked to see what has
// been done that pushes content of the chat down which snaps back in
// place" -- then again for a nested toggle, "the run command is snapping
// the same way the parent was doing before"): ChatPage.tsx's own
// ResizeObserver follows a streaming reply's own growing height by calling
// scrollToBottomIfNear on any height change of the content column, with no
// way to tell *why* it grew. A user manually expanding ANY disclosure
// (the outer "Worked for Ns" one, or a nested "Run command"/"Read file"
// one inside it) grows that same column exactly the way new streamed
// content would, so it read as indistinguishable from the real case that
// observer exists for -- if the view happened to already be near the
// bottom (the common case, right after a reply just finished), expanding
// either kind of disclosure triggered an unwanted auto-scroll, snapping
// the page to the new bottom and back.
//
// A shared module, not a ChatPage.tsx-local variable, because the nested
// toggle lives in a completely separate component (thinking-reasoning.tsx)
// with no access to ChatPage's own module scope -- this is really one
// page-wide behavior ("something the user just manually expanded/collapsed
// is currently animating, don't auto-scroll because of it"), not owned by
// any one component's own toggle handler.
let suppressUntil = 0;

// Matches thinking-reasoning.module.css's own .trCollapsible transition
// duration (320ms) plus a small margin for the ResizeObserver's own last
// callback to land after the animation genuinely settles.
const SUPPRESS_MS = 400;

export function suppressAutoScroll(): void {
  suppressUntil = Date.now() + SUPPRESS_MS;
}

export function isAutoScrollSuppressed(): boolean {
  return Date.now() < suppressUntil;
}
