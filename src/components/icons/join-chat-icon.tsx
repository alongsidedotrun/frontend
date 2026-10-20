import type { IconComponentProps } from "@/lib/icon-context";

// Join chat: two of the logo's circles (same spacing, 1.12 radii apart), as an outline icon
// on Lucide's 24-unit grid. Both are drawn whole: with no fill, the back one shows through.
export function JoinChatIcon({ size = 24, strokeWidth = 2, className }: IconComponentProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      className={className}
    >
      <circle cx="8.30" cy="12" r="6.6" />
      <circle cx="15.70" cy="12" r="6.6" />
    </svg>
  );
}
