import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SWAP_WIDTH_MS = 180;
// How long after a label mounts its changes count as the page settling (e.g. a chat's own model
// and effort arriving) rather than someone's pick: those land at once, with no swap.
const SETTLE_MS = 1200;

/** A trigger label swapped with transitions.dev's "Text states swap"
 *  (.t-text-swap, index.css): the old label exits up with blur, the box then
 *  glides to the new label's width (nothing clipped mid-way, so the chevron
 *  never slides over text), and the new label enters from below. The width
 *  only animates during a swap: any other size change (an icon loading, the
 *  first render) just fits, so the toolbar never drifts on its own. */
export function SwapLabel({
  swapKey,
  children,
  className,
  glide = true,
}: {
  swapKey: string;
  children: ReactNode;
  className?: string;
  // false: the label swaps without the width glide, for a trigger whose width is fixed.
  glide?: boolean;
}) {
  const [shown, setShown] = useState({ key: swapKey, children });
  const [phase, setPhase] = useState<"rest" | "exit" | "enter-start">("rest");
  // null: fits its content (no animation). A number: pinned for a swap.
  const [width, setWidth] = useState<number | null>(null);
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const latest = useRef({ key: swapKey, children });
  latest.current = { key: swapKey, children };
  // The key on screen, read by the effect without re-running it when a swap
  // completes (that re-run would cancel the swap's own glide and release).
  const shownKeyRef = useRef(swapKey);
  const mountedAtRef = useRef(performance.now());

  useEffect(() => {
    if (swapKey === shownKeyRef.current) {
      // Switched back before the swap finished: settle on what's shown.
      setPhase("rest");
      setWidth(null);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A change right after mount is the page settling (the chat's own model
    // and effort arriving), not a pick: it lands instantly, no swap or glide.
    const settling = performance.now() - mountedAtRef.current < SETTLE_MS;
    if (reduce || settling) {
      shownKeyRef.current = latest.current.key;
      setShown(latest.current);
      return;
    }
    const dur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--text-swap-dur")) || 150;
    if (glide) setWidth(outerRef.current?.getBoundingClientRect().width ?? null);
    setPhase("exit");
    let frame = 0;
    let release = 0;
    const timer = window.setTimeout(() => {
      shownKeyRef.current = latest.current.key;
      setShown(latest.current);
      setPhase("enter-start");
      // Two frames: the enter-start pose (and the new width) paint first,
      // then the label transitions back to rest.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setPhase("rest"));
      });
      // Back to fitting the content once the glide is over.
      if (glide) release = window.setTimeout(() => setWidth(null), SWAP_WIDTH_MS + 40);
    }, dur);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(release);
      cancelAnimationFrame(frame);
    };
  }, [swapKey]);

  // The new label is in: glide from the pinned width to its natural width.
  useLayoutEffect(() => {
    if (glide && phase === "enter-start" && innerRef.current) setWidth(innerRef.current.getBoundingClientRect().width);
  }, [glide, phase, shown.key]);

  // Same key: show its latest content (e.g. a language change) directly.
  const content = swapKey === shown.key ? children : shown.children;
  return (
    <span
      ref={outerRef}
      className={cn("inline-flex min-w-0 overflow-hidden", className, width !== null && "transition-[width] ease-out motion-reduce:transition-none")}
      style={width === null ? undefined : { width, transitionDuration: `${SWAP_WIDTH_MS}ms` }}
    >
      <span ref={innerRef} className={cn("t-text-swap inline-flex w-max shrink-0 items-center", phase !== "rest" && `is-${phase}`)}>
        {content}
      </span>
    </span>
  );
}
