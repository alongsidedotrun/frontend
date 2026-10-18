import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Transitions.dev's "Skeleton loader and reveal" (the .t-skel* recipe in
// src/index.css): the skeleton pulses while `loading`, then cross-fades with a
// blur into the content once it's ready. Content that's ready on mount (e.g.
// cached) shows at once, without a skeleton.
const REVEAL_MS = 400; // --reveal-dur

export function SkeletonReveal({ loading, skeleton, children, className }: { loading: boolean; skeleton: ReactNode; children: ReactNode; className?: string }) {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const [revealed, setRevealed] = useState(!loading);

  useEffect(() => {
    if (loading) {
      setRevealed(false);
      setShowSkeleton(true);
      return;
    }
    // Content mounts at its hidden state first; the next frame reveals it, so it transitions.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setRevealed(true));
    });
    // Once the cross-fade is done the skeleton leaves, so it no longer holds the cell's height.
    const timer = window.setTimeout(() => setShowSkeleton(false), REVEAL_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [loading]);

  return (
    <div className={cn("t-skel", revealed && "is-revealed", className)} data-state={loading ? "loading" : "ready"}>
      {showSkeleton && (
        <div className={cn("t-skel-skeleton is-pulsing", loading && "is-looping")} aria-hidden="true">
          {skeleton}
        </div>
      )}
      {!loading && <div className="t-skel-content">{children}</div>}
    </div>
  );
}
