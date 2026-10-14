import { useEffect } from "react";

// Lets anything (the chat page's /share, the top bar, Quick actions) open the
// Share and Join chat dialogs, which the app shell (RedesignPage) renders --
// the same pattern as openSignInDialog in use-sign-in.ts.
let openShareHandler: ((sessionId: string) => void) | null = null;
let openJoinHandler: (() => void) | null = null;

export function openShareDialog(sessionId: string) {
  openShareHandler?.(sessionId);
}

export function openJoinChatDialog() {
  openJoinHandler?.();
}

export function useShareDialogHost(openShare: (sessionId: string) => void, openJoin: () => void) {
  useEffect(() => {
    openShareHandler = openShare;
    openJoinHandler = openJoin;
    return () => {
      if (openShareHandler === openShare) openShareHandler = null;
      if (openJoinHandler === openJoin) openJoinHandler = null;
    };
  }, [openShare, openJoin]);
}

// Fired when the backend says someone just asked to join a chat this person can let people into (#460),
// so the waiting list refreshes at once instead of at its next poll.
export const RELAY_JOIN_REQUESTED_EVENT = "alongside:relay-join-requested";

// The relay's refusal codes (story #459, #408/#409) as the translated error
// each dialog shows; anything else falls back to the dialog's own generic one.
export const SHARE_ERRORS: Record<string, string> = {
  relay_unavailable: "shareChat.errors.relay",
  relay_request_failed: "shareChat.errors.relay",
  invalid_join_code: "joinChat.errors.invalid",
  join_code_expired: "joinChat.errors.expired",
  join_code_used: "joinChat.errors.used",
  too_many_attempts: "joinChat.errors.tooMany",
  already_member: "joinChat.errors.alreadyMember",
};

// What a person typed, in the XXXX-XXXX / XXXXX-XXXXX shape they're shown:
// upper case, the dash put back, anything that can't be part of one dropped.
export function formatTypedId(value: string, groups: readonly number[]): string {
  const cleaned = value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, groups.reduce((a, b) => a + b, 0));
  const parts: string[] = [];
  let at = 0;
  for (const size of groups) {
    if (at >= cleaned.length) break;
    parts.push(cleaned.slice(at, at + size));
    at += size;
  }
  return parts.join("-");
}
