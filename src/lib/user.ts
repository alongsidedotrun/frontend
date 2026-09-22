import { useSyncExternalStore } from "react";
import { getIdentity, subscribeIdentity } from "@/lib/identity";

// Moved out of AppLayout.tsx -- was defined and exported there ("so ChatPage
// reuses the exact same fallback/lookup instead of a second copy that could
// drift"), which worked for ChatPage.tsx (a route AppLayout renders via its
// own outlet, not a module it imports directly). sidebar-nav.tsx is
// different -- AppLayout.tsx imports it directly, so sidebar-nav.tsx
// importing back from AppLayout.tsx would be a real circular import. A
// shared, dependency-free home avoids that for every caller instead of
// working around it per call site.
const USER_NAME_KEY = "alongside_user_name";
const nameListeners = new Set<() => void>();

// The signed-in person's name is always the identity provider's (lib/identity.ts); it is never
// typed in. Signed out, a device shows "Guest" -- not the app's own name, which read as if the
// device already had a real account called "Alongside". A name saved by an earlier version stays
// readable (getLocalUserName) only so signing in can link the chats made under it.
export function getUserDisplayName() {
  return getIdentity().displayName || localStorage.getItem(USER_NAME_KEY) || "Guest";
}

// The name this device's chats were created under before an account existed.
export function getLocalUserName() {
  return localStorage.getItem(USER_NAME_KEY) || "Guest";
}

// Once the account has claimed those chats, the old local name is no longer needed.
export function clearLocalUserName() {
  localStorage.removeItem(USER_NAME_KEY);
  nameListeners.forEach((listener) => listener());
}

export function useUserDisplayName(): string {
  return useSyncExternalStore((listener) => {
    nameListeners.add(listener);
    const unsubscribe = subscribeIdentity(listener);
    return () => {
      nameListeners.delete(listener);
      unsubscribe();
    };
  }, getUserDisplayName);
}

// One color, picked once and kept forever (until a real "change your
// avatar" feature in Settings overwrites it), not re-derived from the
// display name on every render -- per explicit request ("we should have
// only one default avatar until the user changes it so that its the same
// around sidebar, messages and the future profile at settings"). Hashing
// the name string (DefaultAvatar's own approach for every *other*
// multiplayer participant, ui/avatar.tsx) would silently change this
// user's own color the moment they rename themselves, or if any two
// surfaces ever passed a slightly different name string -- a persisted
// seed, independent of the name entirely, can't drift that way.
const AVATAR_SEED_KEY = "alongside_avatar_seed";

export function getUserAvatarSeed(): number {
  const stored = localStorage.getItem(AVATAR_SEED_KEY);
  const parsed = stored === null ? NaN : Number(stored);
  if (Number.isFinite(parsed)) return parsed;
  const seed = Math.floor(Math.random() * 100000);
  localStorage.setItem(AVATAR_SEED_KEY, String(seed));
  return seed;
}

// The real "change your avatar" feature the seed's own comment above
// foreshadowed -- per explicit request ("add a new menu at settings for
// Profile where we can allow users to upload their avatar picture").
// Stored as a data URL directly in localStorage (same simplicity level as
// alongside_user_name/alongside_avatar_seed above -- no backend upload endpoint or
// file-system path to manage for a Free tier single local user), read by
// ui/avatar.tsx's DefaultAvatar in place of the generated logo-on-color
// mark whenever the name being rendered is this device's own
// (getUserDisplayName()). useSyncExternalStore, not a plain getter alone
// (matching the settingsHistory/turn-notifications pattern already
// established this session) -- every surface rendering this device's own
// avatar (sidebar, chat, this same Settings page) needs to update the
// moment a new photo is uploaded, not just on their own next unrelated
// re-render.
const AVATAR_IMAGE_KEY = "alongside_avatar_image";
const avatarImageListeners = new Set<() => void>();

// An uploaded photo wins; otherwise the photo a social provider (Google, GitHub, Apple) supplied
// with the account; otherwise null, which renders the app's own random default avatar.
export function getUserAvatarImage(): string | null {
  return localStorage.getItem(AVATAR_IMAGE_KEY) || getIdentity().picture;
}

export function setUserAvatarImage(dataUrl: string) {
  localStorage.setItem(AVATAR_IMAGE_KEY, dataUrl);
  avatarImageListeners.forEach((listener) => listener());
}

export function clearUserAvatarImage() {
  localStorage.removeItem(AVATAR_IMAGE_KEY);
  avatarImageListeners.forEach((listener) => listener());
}

export function useUserAvatarImage(): string | null {
  return useSyncExternalStore(
    (listener) => {
      avatarImageListeners.add(listener);
      const unsubscribe = subscribeIdentity(listener);
      return () => {
        avatarImageListeners.delete(listener);
        unsubscribe();
      };
    },
    getUserAvatarImage
  );
}
