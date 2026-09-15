// Per-chat override for the global "Notify when a chat turn completes"
// setting (lib/notify-turn-complete.ts) -- per explicit request ("If
// disabled, notifications can be specific[ally] enabled at chats"), wired
// up for real via the chat header's own new "..." menu (AppLayout.tsx:
// Share chat / Enable notification). Lets a chat opt back in to
// notifications even while the global toggle is off, without needing a
// second global setting -- there is deliberately no way to opt a chat OUT
// while the global toggle is on, since that's already just turning the
// global toggle off.
const KEY = "alongside_chat_notifications_enabled";

function loadEnabledChatIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveEnabledChatIds(ids: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify([...ids]));
}

export function isChatNotificationsEnabled(chatId: string): boolean {
  return loadEnabledChatIds().has(chatId);
}

export function setChatNotificationsEnabled(chatId: string, enabled: boolean) {
  const ids = loadEnabledChatIds();
  if (enabled) ids.add(chatId);
  else ids.delete(chatId);
  saveEnabledChatIds(ids);
}
