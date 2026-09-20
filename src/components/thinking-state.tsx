import { useTranslation } from "react-i18next";
import { useTextSwap } from "@/lib/use-text-swap";
import styles from "./thinking-state.module.css";

// Installed via `npx shadcn@latest add https://www.aicss.dev/r/thinking-state.json`
// (per explicit request), then adapted: no "use client" (Next.js-only,
// meaningless in this Vite app), a `text` prop instead of the hardcoded
// "Thinking" string (ChatPage.tsx's own waiting indicator needs to show
// "Waiting"/"Thinking"/"Reasoning"/"Searching" depending on phase), and
// the gradient stops point at this app's own --muted-foreground/
// --foreground theme tokens instead of hardcoded grays, so it follows
// light/dark mode the same way the rest of the app does (same reasoning
// index.css's own .t-shimmer -- a different shimmer treatment, still used
// for the chat-title placeholder in AppLayout.tsx -- already documented).
// useTextSwap (a second reference pasted directly, per explicit request --
// "the switch between working and waiting should be [this]") animates a
// changing `text` (Waiting -> Working, a running seconds count updating)
// instead of jumping instantly -- module CSS's own comment has the full
// transition reasoning.
export function ThinkingState({ text }: { text?: string }) {
  const { t } = useTranslation();
  const { displayText, phase } = useTextSwap(text ?? t("chat.phase.thinking"));
  const phaseClass = phase === "exit" ? styles.isExit : phase === "enter-start" ? styles.isEnterStart : "";
  return <span className={`${styles.shimmer} ${phaseClass}`}>{displayText}</span>;
}
