import { useSyncExternalStore } from "react";

// Who is signed in, as the backend's own /identity/status reports it (backend/src/auth.rs).
// The backend owns the credential and the profile comes from the identity provider (Clerk); this
// module only holds a copy of the display fields so the UI can read them synchronously. The copy
// is cached in localStorage purely so the first paint after a reload is not "signed out" for a
// moment -- it holds no token, and the next /identity/status replaces it.
export type Identity = {
  signedIn: boolean;
  displayName: string | null;
  email: string | null;
  picture: string | null;
  // The plan the identity service reports ("free", "hosted", "enterprise"); null while signed out.
  plan: string | null;
};

const CACHE_KEY = "alongside_identity_cache";
const SIGNED_OUT: Identity = { signedIn: false, displayName: null, email: null, picture: null, plan: null };
const listeners = new Set<() => void>();

function readCache(): Identity {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...SIGNED_OUT, ...JSON.parse(raw) } : SIGNED_OUT;
  } catch {
    return SIGNED_OUT;
  }
}

let current: Identity = readCache();

function set(next: Identity) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // a full or blocked localStorage only loses the first-paint cache
  }
  listeners.forEach((listener) => listener());
}

export function getIdentity(): Identity {
  return current;
}

export function subscribeIdentity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useIdentity(): Identity {
  return useSyncExternalStore(subscribeIdentity, getIdentity);
}

export async function refreshIdentity(): Promise<Identity> {
  try {
    const response = await fetch("/identity/status");
    if (!response.ok) return current;
    const status = (await response.json()) as {
      signed_in: boolean;
      profile: { display_name: string; email: string | null; picture: string | null } | null;
      plan: string | null;
    };
    set({
      signedIn: status.signed_in,
      displayName: status.profile?.display_name ?? null,
      email: status.profile?.email ?? null,
      picture: status.profile?.picture ?? null,
      plan: status.plan ?? null,
    });
  } catch {
    // backend unreachable: keep what is known
  }
  return current;
}

export function clearIdentity() {
  set(SIGNED_OUT);
}

if (typeof window !== "undefined") {
  void refreshIdentity();
}
