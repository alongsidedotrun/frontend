import { clearIdentity, getIdentity, refreshIdentity, useIdentity } from "@/lib/identity";
import { clearLocalUserName, getLocalUserName } from "@/lib/user";

// Sign-in is the system browser on the identity provider's page (never this WebView); the
// backend (backend/src/auth.rs) owns the credential and this file only starts the flow, waits
// for it, and reads the result. Signing in stays optional: it is needed only for multiplayer.
export function getIsSignedIn(): boolean {
  return getIdentity().signedIn;
}

export function useIsSignedIn(): boolean {
  return useIdentity().signedIn;
}

// Opens the system browser on the sign-in page.
export async function beginSignIn(): Promise<boolean> {
  try {
    const response = await fetch("/identity/sign-in", { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}

const POLL_MS = 1500;
const TIMEOUT_MS = 10 * 60 * 1000;

// Waits until the browser sign-in completes (the backend receives the callback and reports
// signed in), then links this device's earlier chats to the account.
export async function waitForSignIn(signal: AbortSignal): Promise<"signed-in" | "timeout" | "cancelled"> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!signal.aborted && Date.now() < deadline) {
    const identity = await refreshIdentity();
    if (identity.signedIn) {
      await claimLocalChats();
      return "signed-in";
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return signal.aborted ? "cancelled" : "timeout";
}

// Chats made on this device before signing in were created under a local name; the account
// claims them and they take the account's display name. Safe to repeat, and a refusal (another
// account already claimed this device) leaves everything as it was.
async function claimLocalChats() {
  try {
    const response = await fetch("/identity/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ local_name: getLocalUserName() }),
    });
    if (response.ok) clearLocalUserName();
  } catch {
    // retried on the next sign-in
  }
}

export async function signOut() {
  try {
    await fetch("/identity/sign-out", { method: "POST" });
  } finally {
    clearIdentity();
  }
}
