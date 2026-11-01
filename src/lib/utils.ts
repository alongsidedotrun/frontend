import { createCn } from "cn/config"

// The app's own text sizes (index.css's @theme), registered as font sizes: unknown, `text-ui-sm`
// reads as a colour and `cn("text-ui-sm text-muted-foreground")` would drop the size.
export const TEXT_SIZES = ["ui-2xs", "ui-xs", "ui-sm", "ui", "ui-lg", "ui-xl", "ui-2xl", "ui-display", "chat", "chat-meta"] as const

export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: [...TEXT_SIZES] }] } },
})
