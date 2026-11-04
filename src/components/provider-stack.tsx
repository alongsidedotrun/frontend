import { cn } from "@/lib/utils";
import { ProviderIcon } from "@/lib/quick-chat-models";

export type ProviderMark = { value: string; icon: string; invertInDark?: boolean; iconScale?: number };

/**
 * The providers a chat has run on, in the order they joined it: the first on the left, each newer one
 * overlapping the one before it toward the right (and drawn above it). Each mark sits on a round disc
 * like the icon frames in Settings > Providers, without their border. `surface` is the colour the
 * stack sits on, so the disc is opaque and a mark never shows through the one in front of it;
 * the fill over it is twice the 4% row highlight, so the disc still reads on a hovered or selected row.
 */
export function ProviderStack({
  marks,
  size = "sm",
  surface = "bg-background",
  className,
}: {
  marks: ProviderMark[];
  size?: "sm" | "md";
  surface?: string;
  className?: string;
}) {
  const disc = size === "md" ? "size-5" : "size-4.5";
  const icon = size === "md" ? "size-3.5" : "size-3";
  return (
    <span className={cn("flex shrink-0 items-center", className)} data-provider-stack="">
      {marks.map((mark, index) => (
        <span
          key={`${mark.value}-${mark.icon}`}
          className={cn("relative grid shrink-0 place-items-center rounded-full", disc, surface, index > 0 && "-ml-1.5")}
          style={{ zIndex: index + 1 }}
        >
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-black/[0.08] dark:bg-white/[0.08]" />
          <ProviderIcon model={mark} className={cn("relative", icon)} />
        </span>
      ))}
    </span>
  );
}
