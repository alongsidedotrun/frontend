import { useEffect, useRef, useState } from "react";

// Adapted from Transitions.dev's own "Text states swap" recipe (pasted
// directly, per explicit request -- "The switch between working and
// waiting should be [this]"): that reference drives the three-phase
// sequence (exit -> swap text -> enter) with raw DOM class toggles and a
// setTimeout; this is the same sequence as a React hook instead, since
// every label that needs it here (ThinkingState's bare shimmer,
// ThinkingReasoning's own live label) is already a React-rendered string,
// not text this app owns as a DOM node to mutate directly.
const SWAP_DUR_MS = 150;

export type TextSwapPhase = "idle" | "exit" | "enter-start";

export function useTextSwap(text: string): { displayText: string; phase: TextSwapPhase } {
  const [displayText, setDisplayText] = useState(text);
  const [phase, setPhase] = useState<TextSwapPhase>("idle");
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplayText(text);
      return;
    }
    setPhase("exit");
    const exitTimer = setTimeout(() => {
      setDisplayText(text);
      setPhase("enter-start");
      // Force a reflow between "enter-start" (jumped to the below position,
      // no transition) and dropping back to "idle" (the reference's own
      // "force reflow" step) -- otherwise the browser can coalesce both
      // class changes into one paint and the enter transition never plays.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("idle"));
      });
    }, SWAP_DUR_MS);
    return () => clearTimeout(exitTimer);
  }, [text]);

  return { displayText, phase };
}
