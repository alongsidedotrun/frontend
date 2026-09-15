import { useRef, useState, type ReactNode } from "react";

type GlideMenuProps = {
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  rowSelector?: string;
};

/** A single hover layer that glides between interactive menu rows. */
export default function GlideMenu({
  children,
  className = "",
  highlightClassName = "inset-x-0 rounded-[8px] bg-hover",
  rowSelector = "[data-menu-row]",
}: GlideMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; height: number; left: number; width: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const moveTo = (target: EventTarget | null) => {
    const container = ref.current;
    if (!(target instanceof Element) || !container) return;
    const row = target.closest(rowSelector);
    if (!(row instanceof HTMLElement) || !container.contains(row)) {
      // Hide rather than no-op -- lets a non-row element inside the group
      // (e.g. sidebar-nav.tsx's collapsed Welcome/toggle icon, which opts
      // out of data-row on purpose) hide a highlight left over from
      // whichever real row the mouse was on right before, instead of that
      // highlight sitting there stale until the mouse actually leaves the
      // whole group.
      setVisible(false);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    // left/width tracked from the row's own rect now too, not just top/
    // height -- every row used to span the exact width highlightClassName's
    // own fixed inset (inset-x-*) already assumed, so this changed nothing
    // visually for them, but a row that shares its own width with a
    // sibling control (sidebar-nav.tsx's Welcome row + toggle button) needs
    // its highlight to actually stop at its own edge instead of extending
    // into that fixed inset's full span and overlapping the sibling.
    setBox({
      top: rowRect.top - containerRect.top,
      height: rowRect.height,
      left: rowRect.left - containerRect.left,
      width: rowRect.width,
    });
    setVisible(true);
  };

  return (
    <div
      ref={ref}
      onMouseOver={(event) => moveTo(event.target)}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={(event) => moveTo(event.target)}
      onBlurCapture={(event) => {
        if (!ref.current?.contains(event.relatedTarget as Node | null)) setVisible(false);
      }}
      className={`group/glide-menu relative ${className}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute ${highlightClassName}`}
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          // left/width only override highlightClassName's own inset-x-*
          // once a row's actually been measured (box set) -- left undefined
          // beforehand keeps that class's own static inset in charge of
          // initial positioning before any row has ever been hovered/
          // focused, same as top/height already did via the ?? 0 fallback.
          left: box?.left,
          width: box?.width,
          opacity: box && visible ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), left 220ms cubic-bezier(0.23,1,0.32,1), width 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {children}
    </div>
  );
}
