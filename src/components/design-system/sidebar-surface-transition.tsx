import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SidebarSurfaceTransitionProps = {
  surfaceKey: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Fades the page content while the parent background remains unchanged.
 * An overlay fade made the surface itself look darker while it composited
 * over routed pages, even when both layers shared the same token.
 */
export function SidebarSurfaceTransition({ surfaceKey, children, className, contentClassName }: SidebarSurfaceTransitionProps) {
  const previousKeyRef = useRef(surfaceKey);
  const childrenRef = useRef(children);
  const transitioningRef = useRef(false);
  const swapTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const [visibleChildren, setVisibleChildren] = useState<ReactNode>(children);
  const [contentVisible, setContentVisible] = useState(true);
  childrenRef.current = children;

  useLayoutEffect(() => {
    if (previousKeyRef.current === surfaceKey) return;

    previousKeyRef.current = surfaceKey;
    transitioningRef.current = true;
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);

    setContentVisible(false);
    swapTimerRef.current = window.setTimeout(() => {
      setVisibleChildren(childrenRef.current);
      swapTimerRef.current = null;
      revealTimerRef.current = window.setTimeout(() => {
        setContentVisible(true);
        transitioningRef.current = false;
        revealTimerRef.current = null;
      }, 40);
    }, 400);

    return () => {
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    };
  }, [surfaceKey]);

  useLayoutEffect(() => {
    if (!transitioningRef.current) setVisibleChildren(children);
  }, [children]);

  return (
    <div className={cn("relative bg-background", className)}>
      <div
        className={cn(
          "min-h-0 transition-opacity duration-400 ease-in-out",
          contentVisible ? "opacity-100" : "opacity-0",
          contentClassName,
        )}
      >
        {visibleChildren}
      </div>
    </div>
  );
}
