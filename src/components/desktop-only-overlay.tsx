import { useEffect, useState } from "react";
import { SystemIcon, XIcon } from "@/components/icons/untitled-ui";

// Below this viewport width -- big-phone-landscape through small-tablet-
// portrait -- the sidebar + top bar (see top-bar.tsx's own icon-only
// compression) have no more room left to compress into; this app isn't
// designed for phone/small-tablet use, so instead of forcing a cramped
// layout to fit, this blocks the view with an explicit "use desktop"
// notice. 768 is Tailwind's own md breakpoint -- "small tablet and below",
// not just "a bit narrower than a laptop".
const BREAKPOINT = 768;

export function DesktopOnlyOverlay() {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < BREAKPOINT);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onResize() {
      const narrow = window.innerWidth < BREAKPOINT;
      setIsNarrow(narrow);
      // Resets the dismissal once the window is desktop-sized again, so a
      // later resize back down shows the notice again instead of it
      // staying silently dismissed forever from one earlier close.
      if (!narrow) setDismissed(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isNarrow || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/10 p-6 backdrop-blur-[2px]">
      <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-border bg-background shadow-lg">
        <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-indigo-400 via-purple-400 to-sky-300">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 text-white/80 transition-colors hover:text-white"
          >
            <XIcon className="size-4" />
          </button>
          <SystemIcon className="size-12 text-white" strokeWidth={1.5} />
        </div>
        <div className="px-6 py-6">
          <h2 className="text-lg font-semibold text-foreground">We care for optimization</h2>
          <p className="mt-2 text-sm font-normal text-muted-foreground">
            The platform is currently only supported in desktop view, as we care about optimization and performance.
            We advise using a desktop view, as the mobile view is not available.
          </p>
        </div>
      </div>
    </div>
  );
}
