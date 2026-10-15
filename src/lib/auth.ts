import { clearIdentity, getIdentity, refreshIdentity, useIdentity } from "@/lib/identity";
import { clearLocalUserName, getLocalUserName } from "@/lib/user";

// The backend (backend/src/auth.rs) owns the credential; this file only starts a sign-in, waits
// for it, and reads the result. Two ways in (issue #26): an email code entered in the app's own
// dialog, or Google/GitHub in the system browser (never this WebView, which those providers
// block). Signing in stays optional: it is needed only for multiplayer.
export function getIsSignedIn(): boolean {
  return getIdentity().signedIn;
}

export function useIsSignedIn(): boolean {
  return useIdentity().signedIn;
}

export type SignInProvider = "google" | "github";

// Opens the system browser to sign in, straight on the provider's page when one is given. A
// backend that predates provider sign-in ignores the body and opens the hosted sign-in page,
// where the same provider can still be picked.
export async function beginSignIn(provider?: SignInProvider): Promise<boolean> {
  try {
    const response = await fetch("/identity/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(provider ? { provider } : {}),
    });
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

// Email sign-in, entirely in the app: the backend sends a one-time code to the address, and the
// code typed into the dialog finishes the sign-in (or creates the account, for a new address).
// Endpoints answer 200 on success, or an error status with `{ "error": "<code>" }`.
//   POST /identity/email/start   { email }  -> { status: "code_sent" | "new_account" };
//                                              errors: invalid_email, rate_limited
//   POST /identity/email/sign-up { email, first_name, last_name } -> code sent; errors as start,
//                                              plus invalid_name
//   POST /identity/email/verify  { code }   -> errors: invalid_code, expired, rate_limited,
//                                              no_pending_sign_in, sign_up_incomplete
// "unsupported" is a backend without these endpoints yet (404/405): callers fall back to the
// browser sign-in.
export type EmailStartResult = "sent" | "new_account" | "unsupported" | "invalid_email" | "rate_limited" | "failed";
export type EmailVerifyResult = "signed-in" | "invalid_code" | "expired" | "rate_limited" | "sign_up_incomplete" | "failed";

async function postIdentity(path: string, body: unknown): Promise<{ ok: boolean; status: number; error?: string; data?: { status?: string } }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true, status: response.status, data: (await response.json().catch(() => undefined)) as { status?: string } | undefined };
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return { ok: false, status: response.status, error: typeof data?.error === "string" ? data.error : undefined };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function startEmailSignIn(email: string): Promise<EmailStartResult> {
  const result = await postIdentity("/identity/email/start", { email });
  // No account for this email yet: the dialog asks for a name, then startEmailSignUp.
  if (result.ok) return result.data?.status === "new_account" ? "new_account" : "sent";
  if (result.status === 404 || result.status === 405) return "unsupported";
  if (result.error === "invalid_email" || result.error === "rate_limited") return result.error;
  return "failed";
}

// What a new account starts with besides its name: language (e.g. "pt-BR") and timezone (IANA),
// kept with the account.
export type SignUpPrefs = { language: string; timezone: string };

// Creates the account for a new email, with the person's name, and sends its code.
export async function startEmailSignUp(email: string, firstName: string, lastName: string, prefs?: SignUpPrefs): Promise<EmailStartResult | "invalid_name"> {
  const result = await postIdentity("/identity/email/sign-up", { email, first_name: firstName, last_name: lastName, ...prefs });
  if (result.ok) return "sent";
  if (result.error === "invalid_email" || result.error === "rate_limited" || result.error === "invalid_name") return result.error;
  return "failed";
}

export async function verifyEmailCode(code: string): Promise<EmailVerifyResult> {
  const result = await postIdentity("/identity/email/verify", { code });
  if (!result.ok) {
    if (result.error === "invalid_code" || result.error === "expired" || result.error === "rate_limited" || result.error === "sign_up_incomplete") return result.error;
    // The code step timed out on the backend: same as an expired code, a new one is needed.
    if (result.error === "no_pending_sign_in") return "expired";
    return "failed";
  }
  const identity = await refreshIdentity();
  if (!identity.signedIn) return "failed";
  await claimLocalChats();
  return "signed-in";
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
