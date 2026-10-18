import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

// How fast a long name slides to show its end (px per second).
const SLIDE_SPEED = 40;

/**
 * Text cut off with an ellipsis that slides left to show the rest while the
 * nearest [data-slide-trigger] ancestor (e.g. a sidebar row's button) is
 * hovered or focused. The .t-slide recipe in src/index.css does the motion;
 * this measures how far it has to go. Replaces a plain `truncate` span.
 */
export function SlidingText({ text, className }: { text: string; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    // The line clips its own text at rest, so its scrollWidth is the whole name.
    const measure = () => setOverflow(Math.max(0, Math.ceil(content.scrollWidth - content.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, [text]);

  const style = overflow
    ? ({ "--slide": `-${overflow}px`, "--slide-dur": `${Math.max(0.5, overflow / SLIDE_SPEED)}s` } as CSSProperties)
    : undefined;
  return (
    <span ref={outer} className={cn("t-slide", className)} data-overflow={overflow ? "" : undefined} style={style}>
      <span ref={inner}>{text}</span>
    </span>
  );
}
