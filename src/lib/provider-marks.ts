import type { ProviderMark } from "@/components/provider-stack";
import { QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";

// A provider's mark, by the provider id a chat's models carry (the model's own icon when it's listed).
const PROVIDER_MARKS: Record<string, { icon: string; invertInDark?: boolean }> = {
  claude: { icon: "/icons/providers/claude.svg" },
  codex: { icon: "/icons/providers/chatgpt.svg", invertInDark: true },
  antigravity: { icon: "/icons/providers/gemini.svg" },
  grok: { icon: "/icons/providers/grok.svg", invertInDark: true },
};

/** The marks of the providers a chat has run on, in the order they joined it (the first on the left).
 *  At most three: past that, the three that joined last. */
export function chatProviderMarks(chat: { models?: { provider: string; model: string }[] | null }): ProviderMark[] {
  const seen = new Set<string>();
  const marks: ProviderMark[] = [];
  for (const { provider, model } of chat.models ?? []) {
    const id = provider.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const listed = QUICK_CHAT_MODELS.find((candidate) => candidate.value === model);
    const mark = listed ?? (PROVIDER_MARKS[id] ? { value: model, ...PROVIDER_MARKS[id] } : null);
    if (mark) marks.push({ value: mark.value, icon: mark.icon, invertInDark: mark.invertInDark });
  }
  return marks.slice(-3);
}
