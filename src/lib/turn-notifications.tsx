import { useSyncExternalStore } from "react";

// In-app companion to the OS-level "Notify when a chat turn completes"
// setting (lib/notify-turn-complete.ts) -- per explicit request ("the
// avatar dropdown inside the sidebar should be where we can see real
// time notifications so we can see [the] Notify when a chat turn
// completes feature"): a live list of the same events, visible inside
// the app itself (nav-user.tsx's AccountMenuItems), not just an OS toast
// that disappears the moment it's dismissed or missed. In-memory only,
// not persisted -- a real-time feed for the current session, not a
// second inbox; it resets on reload the same way the OS toast itself
// leaves nothing behind once dismissed.
export type TurnNotification = {
  id: string;
  chatId: string;
  chatName: string;
  modelLabel: string;
  timestamp: number;
};

let notifications: TurnNotification[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Newest first -- ChatPage.tsx's own call site (the "result" event
// handler) already gates this on the same loadNotifyTurnComplete()
// preference the OS toast checks, so a disabled setting means neither
// fires, not just the OS one.
export function pushTurnNotification(entry: Omit<TurnNotification, "id">) {
  notifications = [{ ...entry, id: `${entry.chatId}-${entry.timestamp}` }, ...notifications];
  notify();
}

export function dismissTurnNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  notify();
}

export function dismissAllTurnNotifications() {
  notifications = [];
  notify();
}

// Drops any notification whose chat no longer exists -- real bug, confirmed
// directly ("why I just got an untitled chat at notifications? I didn't
// trigger this? and its not at my inbox of chats"): this feed is in-memory
// and never checked the chat it points at was ever actually persisted
// (a dev-server restart mid-creation, or a chat deleted after its own turn
// completed, both leave a stray entry with nothing real behind it).
// AccountMenuItems (nav-user.tsx) calls this once on mount, so opening the
// dropdown is what actually triggers the check -- no polling loop needed
// for a feed that only has a handful of entries and is only ever looked at
// while open.
export async function pruneMissingChatNotifications(): Promise<void> {
  if (notifications.length === 0) return;
  try {
    const response = await fetch("/sessions");
    if (!response.ok) return;
    const sessions = (await response.json()) as Array<{ id: string }>;
    const liveIds = new Set(sessions.map((s) => s.id));
    const pruned = notifications.filter((n) => liveIds.has(n.chatId));
    if (pruned.length !== notifications.length) {
      notifications = pruned;
      notify();
    }
  } catch {
    // Best-effort -- a failed check just leaves the current list as-is,
    // same as not checking at all.
  }
}

export function useTurnNotifications(): TurnNotification[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notifications
  );
}

// No date-fns/dayjs in this app yet (InboxPage.tsx's own
// formatRelativeTime has the same note) -- that one parses a SQLite
// datetime string; this takes a plain epoch-ms number instead, since
// these notifications are created client-side with Date.now(), not read
// back from a stored timestamp column.
export function formatNotificationTime(timestampMs: number): string {
  const seconds = Math.max(0, (Date.now() - timestampMs) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
