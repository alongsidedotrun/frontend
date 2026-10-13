import { cn } from "@/lib/utils";

/**
 * Decorative backdrop that fills its (positioned) parent. Light mode: a
 * lavender-white gradient (#F8F8FF to #E6E6FA), dark mode a grey one
 * (#2F3437 to #484F56), each waving side to side every 2s. Both move with
 * transform only, so the GPU slides an already-painted layer and nothing
 * repaints per frame. Motion stops when reduced motion is on.
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* Light ("Baby Powder"): a layer 4x the box each way, centred
          vertically and sliding three box-widths and back every 2s, the same
          as background-size 400% with background-position 0% to 100%. */}
      <span className="absolute top-1/2 left-0 size-[400%] bg-[linear-gradient(135deg,#F8F8FF,#E6E6FA)] will-change-transform [transform:translate(0,-50%)] animate-[backdrop-wave_2s_ease-in-out_infinite] motion-reduce:animate-none dark:hidden" />
      {/* Dark ("Notion Gray"): the same 2s wave. */}
      <span className="absolute top-1/2 left-0 hidden size-[400%] bg-[linear-gradient(45deg,#2F3437,#484F56)] will-change-transform [transform:translate(0,-50%)] animate-[backdrop-wave_2s_ease-in-out_infinite] motion-reduce:animate-none dark:block" />
    </span>
  );
}
