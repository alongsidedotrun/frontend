import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SidebarSurfaceTransitionProps = {
  surfaceKey: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

type Layer = { key: string; node: ReactNode };

const FADE_MS = 400;
const REVEAL_GAP_MS = 40;

/**
 * Fades the page content while the parent background remains unchanged.
 * An overlay fade made the surface itself look darker while it composited
 * over routed pages, even when both layers shared the same token.
 *
 * The incoming page mounts invisibly as soon as the outgoing one starts
 * fading out, so its data, labels and settling effects (the compose box's
 * model, effort and permission) finish before it fades in, instead of
 * popping in during the fade. Each page keeps its own keyed layer, so the
 * incoming one isn't remounted when it takes over.
 */
export function SidebarSurfaceTransition({ surfaceKey, children, className, contentClassName }: SidebarSurfaceTransitionProps) {
  const [layers, setLayers] = useState<Layer[]>([{ key: surfaceKey, node: children }]);
  // The layer on screen (or fading out); an incoming layer is the other one.
  const [shownKey, setShownKey] = useState(surfaceKey);
  const [contentVisible, setContentVisible] = useState(true);
  const swapTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const previousKeyRef = useRef(surfaceKey);

  useLayoutEffect(() => {
    if (previousKeyRef.current === surfaceKey) {
      // Same page: its layer follows the live children.
      setLayers((current) => current.map((layer) => (layer.key === surfaceKey ? { ...layer, node: children } : layer)));
      return;
    }
    previousKeyRef.current = surfaceKey;
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);

    if (surfaceKey === shownKey) {
      // Back to the page still on screen before the swap: drop the incoming one.
      setLayers((current) => current.filter((layer) => layer.key === surfaceKey).map((layer) => ({ ...layer, node: children })));
      setContentVisible(true);
      return;
    }

    // Keep only what's on screen, add the incoming page hidden behind it.
    setLayers((current) => [...current.filter((layer) => layer.key === shownKey), { key: surfaceKey, node: children }]);
    setContentVisible(false);
    swapTimerRef.current = window.setTimeout(() => {
      swapTimerRef.current = null;
      setLayers((current) => current.filter((layer) => layer.key === surfaceKey));
      setShownKey(surfaceKey);
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        setContentVisible(true);
      }, REVEAL_GAP_MS);
    }, FADE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceKey, children]);

  useLayoutEffect(
    () => () => {
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    },
    [],
  );

  return (
    <div className={cn("relative bg-background", className)}>
      {layers.map((layer) => {
        const incoming = layer.key !== shownKey;
        return (
          <div
            key={layer.key}
            className={cn(
              "min-h-0 transition-opacity duration-400 ease-in-out",
              incoming ? "pointer-events-none absolute inset-0 opacity-0" : contentVisible ? "opacity-100" : "opacity-0",
              contentClassName,
            )}
          >
            {layer.node}
          </div>
        );
      })}
    </div>
  );
}
