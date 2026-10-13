import { cn } from "@/lib/utils";

// Sand grain: high-frequency noise thresholded into sparse, sharp ~1px
// specks (dark on the light gradient, light on the dark one). Generated
// rather than a texture file: a few hundred bytes, crisp at any size, and it
// tiles without seams.
const grain = (rgb: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='1' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${rgb} 0 0 0 0 ${rgb} 0 0 0 0 ${rgb} 0 0 0 14 -8.4'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  )}")`;
const GRAIN_DARK_SPECKS = grain("0");
const GRAIN_LIGHT_SPECKS = grain("1");

// Glints: a few grains that catch the light now and then. 1px, at fixed
// scattered positions (a small LCG, so the same on every render and device),
// each on its own slow cycle and delay, and only ever faint.
const GLINTS = (() => {
  let seed = 7;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 24 }, () => ({
    left: `${(next() * 100).toFixed(2)}%`,
    top: `${(next() * 100).toFixed(2)}%`,
    delay: `${(next() * 9).toFixed(2)}s`,
    duration: `${(5 + next() * 4).toFixed(2)}s`,
  }));
})();

/**
 * Decorative backdrop that fills its (positioned) parent: a slowly shifting
 * gradient (soft white to grey in light mode, charcoal to black in dark mode)
 * under a sandy grain, with an occasional faint 1px glint. Motion stops (and
 * the glints are hidden) when reduced motion is on.
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <span
        className={cn(
          "absolute inset-0 bg-[length:200%_200%] animate-[gradient-shift_8s_ease_alternate_infinite] motion-reduce:animate-none",
          "bg-[linear-gradient(120deg,#fdfbfb_0%,#ebedee_100%)] dark:bg-[linear-gradient(to_right,#434343_0%,#000000_100%)]",
        )}
      />
      <span className="absolute inset-0 opacity-[0.16] dark:hidden" style={{ backgroundImage: GRAIN_DARK_SPECKS }} />
      <span className="absolute inset-0 hidden opacity-[0.16] dark:block" style={{ backgroundImage: GRAIN_LIGHT_SPECKS }} />
      {GLINTS.map((glint, index) => (
        <span
          key={index}
          className="absolute size-px bg-white opacity-0 animate-[sparkle-twinkle_var(--glint-duration)_ease-in-out_infinite] motion-reduce:hidden [--glint-peak:0.9] dark:[--glint-peak:0.45]"
          style={{ left: glint.left, top: glint.top, animationDelay: glint.delay, ["--glint-duration" as string]: glint.duration }}
        />
      ))}
    </span>
  );
}
