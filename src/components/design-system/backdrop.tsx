import morningSunlight from "@/assets/backdrops/morning-sunlight.webp";
import moonlitSand from "@/assets/backdrops/moonlit-sand.webp";
import { cn } from "@/lib/utils";

/**
 * Decorative photo backdrop that fills its (positioned) parent: morning
 * sunlight in light mode, moonlit sand in dark mode. WebP copies of
 * the PNG originals in the same folder (only these are bundled).
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <img src={morningSunlight} alt="" decoding="async" className="size-full object-cover dark:hidden" />
      <img src={moonlitSand} alt="" decoding="async" className="hidden size-full object-cover dark:block" />
    </span>
  );
}
