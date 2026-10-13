import { cn } from "@/lib/utils";

// Glints: a few points that catch the light now and then. 1px, at fixed
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
 * Decorative backdrop that fills its (positioned) parent. Light mode: a soft
 * white-to-grey gradient drifting side to side. Dark mode: GitHub-dark tones
 * (#0D1117 to #161B22) turning a full circle every 4s. Both move with
 * transform only, so the GPU slides or turns an already-painted layer and
 * nothing repaints per frame. A few faint 1px glints sit on top. Motion
 * stops (and the glints are hidden) when reduced motion is on.
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* Light: a layer twice the width, sliding half its width and back. */}
      <span className="absolute inset-y-0 left-0 w-[200%] bg-[linear-gradient(120deg,#fdfbfb_0%,#ebedee_100%)] will-change-transform animate-[backdrop-drift_8s_ease-in-out_alternate_infinite] motion-reduce:animate-none dark:hidden" />
      {/* Dark: a square large enough to cover the box at any angle, centred
          and turning; the stops sit near its middle, where the box sees it. */}
      <span className="absolute top-1/2 left-1/2 hidden aspect-square w-[260%] bg-[linear-gradient(90deg,#0D1117_35%,#161B22_65%)] will-change-transform animate-[backdrop-rotate_4s_linear_infinite] motion-reduce:animate-none motion-reduce:[transform:translate(-50%,-50%)] dark:block" />
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
