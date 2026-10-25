import type { IconComponentProps } from "@/lib/icon-context";

// Bots: the Alongside bot's default face (public/bot-faces/alongside-bot-default.svg) as an outline icon
// on Lucide's 24-unit grid -- the face as a ring, its two eyes at the same places, drawn as strokes.
export function BotIcon({ size = 24, strokeWidth = 2, className }: IconComponentProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M8.7 9.2v2.3M15.3 9.2v2.3" />
    </svg>
  );
}
