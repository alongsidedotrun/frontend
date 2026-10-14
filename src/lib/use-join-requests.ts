import { useCallback, useEffect, useState } from "react";
import { RELAY_JOIN_REQUESTED_EVENT } from "@/lib/use-share";

// Someone waiting to be let into a shared chat (#460), as the backend lists them.
export type WaitingJoin = { chat_id?: string; chat_name?: string | null; request_id: string; actor: string; name: string; created_at: number; expires_at: number };

// How often the waiting list is re-read while nothing has said someone asked -- they may have asked
// while this app was closed, or in a chat this window doesn't have open.
const REFRESH_MS = 20_000;

// Who is waiting to join: every chat this person can let people into, or one chat (`chatId`). Refreshes
// on a timer, when the window regains focus, and at once when the backend says someone just asked.
export function useJoinRequests(chatId?: string | null, enabled = true) {
  const [requests, setRequests] = useState<WaitingJoin[]>([]);
  const url = chatId ? `/sessions/${chatId}/relay/join-requests` : "/relay/join-requests";

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch(url);
      if (response.ok) setRequests((await response.json()) as WaitingJoin[]);
    } catch {
      // the backend isn't reachable right now; the next refresh tries again
    }
  }, [url, enabled]);

  useEffect(() => {
    if (!enabled) {
      setRequests([]);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    const now = () => void refresh();
    window.addEventListener(RELAY_JOIN_REQUESTED_EVENT, now);
    window.addEventListener("focus", now);
    return () => {
      clearInterval(timer);
      window.removeEventListener(RELAY_JOIN_REQUESTED_EVENT, now);
      window.removeEventListener("focus", now);
    };
  }, [refresh, enabled]);

  // Lets someone in or turns them away. False when it didn't work (the list is re-read either way).
  const decide = useCallback(
    async (request: WaitingJoin, action: "approve" | "deny", inChat = chatId) => {
      const chat = inChat ?? request.chat_id;
      if (!chat) return false;
      const response = await fetch(`/sessions/${chat}/relay/join-requests/${request.request_id}/${action}`, { method: "POST" }).catch(() => null);
      setRequests((current) => current.filter((r) => r.request_id !== request.request_id));
      void refresh();
      return Boolean(response?.ok);
    },
    [chatId, refresh],
  );

  return { requests, refresh, decide };
}
