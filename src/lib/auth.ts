import { useSyncExternalStore } from "react";
import { setUserDisplayName } from "@/lib/user";

// Real gate, but a deliberately loose one -- per explicit request ("I'd
// like for us to open Alongside and be able to navigate without being
// signed in... users should be able to use our application without being
// signed in but for multiplayer purposes, they should sign in"). There is
// no real backend account system behind this yet (Free tier, a single
// local process) -- "signed in" is this one flag, exactly like
// require-auth.tsx's own former blanket gate was, just no longer wrapping
// every route. It exists purely to gate the one thing that genuinely
// needs an identity: sharing a chat with other real people
// (AppLayout.tsx's own chat-header "..." menu).
const SIGNED_IN_KEY = "alongside_signed_in";
const listeners = new Set<() => void>();

export function getIsSignedIn(): boolean {
  return localStorage.getItem(SIGNED_IN_KEY) === "1";
}

// name: optional -- AuthPage.tsx's own name prompt is a testing aid (its
// own comment has the full reasoning), not a required part of signing in.
export function setSignedIn(name?: string) {
  if (name && name.trim()) setUserDisplayName(name);
  localStorage.setItem(SIGNED_IN_KEY, "1");
  listeners.forEach((listener) => listener());
}

// Real "Continue with email" accounts (Story #239) -- distinct from
// setSignedIn above, which is still the placeholder Google/Apple buttons'
// own fake local sign-in until those get a real implementation. id/email
// come back from backend/src/server.rs's own /auth/signup and /auth/login,
// id being the same stable UUID #239 calls for assigning at real sign-in
// time (used to identify this person in multiplayer chats later).
export function setAccountSignedIn(account: { id: string; name: string; email: string }) {
  setUserDisplayName(account.name);
  localStorage.setItem("alongside_user_id", account.id);
  localStorage.setItem("alongside_user_email", account.email);
  localStorage.setItem(SIGNED_IN_KEY, "1");
  listeners.forEach((listener) => listener());
}

export function signOut() {
  localStorage.removeItem(SIGNED_IN_KEY);
  localStorage.removeItem("alongside_user_id");
  localStorage.removeItem("alongside_user_email");
  // Real bug, confirmed directly ("when I log out still show Giovanni
  // Andrade"): this device's own display name (lib/user.ts) outlived
  // signOut() -- setAccountSignedIn's own name never got undone, so the
  // sidebar/settings footer kept showing the just-logged-out account's
  // name instead of falling back to Guest.
  setUserDisplayName("");
  listeners.forEach((listener) => listener());
}

export function useIsSignedIn(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getIsSignedIn
  );
}
