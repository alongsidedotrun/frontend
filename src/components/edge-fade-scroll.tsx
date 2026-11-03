import { useEffect, useRef, useState, type ReactNode } from "react";

// A scrolling column whose top or bottom edge fades out while there is more to scroll that way,
// so a long list reads as continuing instead of being cut off by the edge (or by the card below
// it). Same 20px fade as the opened Working block (thinking-reasoning.tsx, edgeFade).
export function EdgeFadeScroll({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = el.scrollTop > 1;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setFade((f) => (f.top === top && f.bottom === bottom ? f : { top, bottom }));
    };
    // The lists inside grow and shrink (a section opens, a chat arrives), and so does the window.
    const ro = new ResizeObserver(measure);
    const observeChildren = () => {
      ro.disconnect();
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
      measure();
    };
    const mo = new MutationObserver(observeChildren);
    mo.observe(el, { childList: true });
    observeChildren();
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  const mask =
    fade.top || fade.bottom
      ? `linear-gradient(to bottom, ${fade.top ? "transparent 0, #000 20px" : "#000 0"}, ${fade.bottom ? "#000 calc(100% - 20px), transparent 100%" : "#000 100%"})`
      : undefined;
  return (
    <div ref={ref} className={className} style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}>
      {children}
    </div>
  );
}
