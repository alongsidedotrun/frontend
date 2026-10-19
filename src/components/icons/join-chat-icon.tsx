import type { IconComponentProps } from "@/lib/icon-context";

// Join chat: two of the logo's circles (same spacing, 1.12 radii apart), as an outline icon
// on Lucide's 24-unit grid. The back circle stops short of the front one, the logo's cut-out
// as a gap; drawn as an arc, so there's no mask id to keep unique per instance.
export function JoinChatIcon({ size = 24, strokeWidth = 2, className }: IconComponentProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10.78 5.88A6.6 6.6 0 1 0 10.78 18.12" />
      <circle cx="15.70" cy="12" r="6.6" />
    </svg>
  );
}
