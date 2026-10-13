import { cn } from "@/lib/utils";

/**
 * Decorative backdrop that fills its (positioned) parent. Light mode: a
 * lavender-white gradient (#F8F8FF to #E6E6FA) waving side to side. Dark mode: GitHub-dark tones
 * (#0D1117 to #161B22) turning a full circle every 4s. Both move with
 * transform only, so the GPU slides or turns an already-painted layer and
 * nothing repaints per frame. Motion stops when reduced motion is on.
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* Light ("Baby Powder"): a layer 4x the box each way, centred
          vertically and sliding three box-widths and back every 2s, the same
          as background-size 400% with background-position 0% to 100%. */}
      <span className="absolute top-1/2 left-0 size-[400%] bg-[linear-gradient(135deg,#F8F8FF,#E6E6FA)] will-change-transform [transform:translate(0,-50%)] animate-[backdrop-wave_2s_ease-in-out_infinite] motion-reduce:animate-none dark:hidden" />
      {/* Dark: a square large enough to cover the box at any angle, centred
          and turning; the stops sit near its middle, where the box sees it. */}
      <span className="absolute top-1/2 left-1/2 hidden aspect-square w-[260%] bg-[linear-gradient(90deg,#0D1117_35%,#161B22_65%)] will-change-transform animate-[backdrop-rotate_4s_linear_infinite] motion-reduce:animate-none motion-reduce:[transform:translate(-50%,-50%)] dark:block" />
    </span>
  );
}
