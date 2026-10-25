import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// A bot's look (#504): Alongside's bot face in a colour, or an uploaded image.
export type BotAvatar = { kind: "bot"; color: string } | { kind: "image"; src: string };

// The faces in public/bot-faces/alongside-bots-sprite.svg. The default is the bot at rest; the others are its
// states (thinking while it works, happy when it's done...).
export type BotExpression = "default" | "happy" | "thinking" | "sleeping" | "excited";

// The face colours a bot can have, in the picker's order; the last (grey) is the default.
export const BOT_COLORS = [
  "#FFFFFF",
  "#8B5E3C",
  "#D93B3B",
  "#F07A2C",
  "#F5A13A",
  "#3F9A5A",
  "#45A396",
  "#2F77DE",
  "#7E57DE",
  "#D6448B",
  "#7A7A7A",
] as const;

export const DEFAULT_BOT_AVATAR: BotAvatar = { kind: "bot", color: "#7A7A7A" };

/** A bot's face: the bot in its colour (a hairline ring keeps a white one visible), or its uploaded image. */
export function BotFace({ avatar = DEFAULT_BOT_AVATAR, expression = "default", className }: { avatar?: BotAvatar; expression?: BotExpression; className?: string }) {
  if (avatar.kind === "image") {
    return <img src={avatar.src} alt="" aria-hidden="true" className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <svg
      viewBox="0 0 128 128"
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible", className)}
      style={{ "--bot-face-color": avatar.color, "--bot-eye-color": "#111111" } as CSSProperties}
    >
      <use href={`/bot-faces/alongside-bots-sprite.svg#alongside-bot-${expression}`} />
      <circle cx="64" cy="64" r="60" fill="none" className="stroke-foreground/10" strokeWidth="2" />
    </svg>
  );
}
