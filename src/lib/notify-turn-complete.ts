import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { isChatNotificationsEnabled } from "@/lib/chat-notifications";
import { isTauri } from "@/hooks/use-tauri";

// Settings > General > Notifications ("Notify when a chat turn
// completes", Story: Settings "Application" section,
// alongsidedotrun/private#207). Persisted separately from the actual OS
// permission grant -- a user can turn this off without Alongside forgetting
// they once said yes to the OS prompt, and turning it back on later
// should not re-prompt if permission is already granted.
const NOTIFY_TURN_COMPLETE_KEY = "alongside_notify_turn_complete";

// Defaults to true when never explicitly set -- per explicit request ("if
// those are working Notify when a chat turn completes should be set to
// true by default"). Only an explicit "false" (the user, or a prior denied
// OS permission request, saveNotifyTurnComplete below) turns it off; a
// fresh install with no stored value at all reads as on.
export function loadNotifyTurnComplete(): boolean {
  const stored = localStorage.getItem(NOTIFY_TURN_COMPLETE_KEY);
  return stored === null ? true : stored === "true";
}

export function saveNotifyTurnComplete(enabled: boolean) {
  localStorage.setItem(NOTIFY_TURN_COMPLETE_KEY, String(enabled));
}

// Requests the OS notification permission the first time this setting is
// turned on. Returns whether it's actually usable afterward, so the
// caller can reflect a denied permission back into the toggle instead of
// silently leaving it on with no way to ever notify.
export async function requestNotificationPermission(): Promise<boolean> {
  // Real bug, confirmed via the browser console (an unhandled "TypeError: undefined is
  // not an object (evaluating 'window.__TAURI_INTERNALS__.invoke')"): this whole file
  // called straight into @tauri-apps/plugin-notification with no isTauri() guard at all,
  // unlike every other real Tauri call in the app (use-tauri.ts's own useIsFullscreen,
  // main.tsx's own app_ready invoke) -- the plugin's own functions call into the Tauri
  // bridge unconditionally and throw immediately outside the desktop app, matching a
  // plain browser tab (this dev setup) or a self-hosted web deployment exactly.
  if (!isTauri()) return false;
  if (await isPermissionGranted()) return true;
  const permission = await requestPermission();
  return permission === "granted";
}

// Called from ChatPage.tsx at the exact moment an agent turn finishes.
// Only fires while the window is unfocused -- a notification for
// something the user is already looking at is just noise, the same
// reasoning most chat apps already apply to their own message
// notifications. document.hasFocus(), not the Page Visibility API
// (document.hidden) -- hasFocus is false when the app is focused but a
// different window/app is in front on the same visible desktop, whereas
// visibility only changes on tab/window minimize, missing the common
// "Alongside is open behind another app" case this setting exists for.
// chatId: real per-chat override now (chat-notifications.ts's own
// comment has the full reasoning) -- a chat that's turned notifications on
// for itself still notifies even while the global setting is off.
export function notifyTurnComplete(chatName: string, chatId: string) {
  if (!isTauri()) return;
  if (!loadNotifyTurnComplete() && !isChatNotificationsEnabled(chatId)) return;
  if (document.hasFocus()) return;
  isPermissionGranted().then((granted) => {
    if (!granted) return;
    sendNotification({ title: chatName, body: "Turn complete" });
  });
}
