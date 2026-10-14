import { useEffect, useRef, useState } from "react";
import { beginSignIn, startEmailSignIn, verifyEmailCode, waitForSignIn, type SignInProvider } from "@/lib/auth";

export type SignInPhase = "idle" | "waiting" | "failed" | "timeout";

/**
 * The browser sign-in flow behind the sign-in dialog's Google and GitHub
 * buttons: open the provider's page (or the hosted sign-in page) in the system
 * browser, then wait for the backend to report the account signed in
 * (lib/auth.ts).
 */
export function useSignInFlow(onSignedIn: () => void) {
  const [phase, setPhase] = useState<SignInPhase>("idle");
  const controller = useRef<AbortController | null>(null);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  useEffect(() => () => controller.current?.abort(), []);

  // The provider last started, so "open again" reopens the same one.
  const [provider, setProvider] = useState<SignInProvider | undefined>(undefined);

  async function start(nextProvider: SignInProvider | undefined = provider) {
    setProvider(nextProvider);
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    if (!(await beginSignIn(nextProvider))) {
      setPhase("failed");
      return;
    }
    setPhase("waiting");
    const result = await waitForSignIn(current.signal);
    if (result === "signed-in") {
      setPhase("idle");
      onSignedInRef.current();
    } else if (result === "timeout") {
      setPhase("timeout");
    }
  }

  function cancel() {
    controller.current?.abort();
    setPhase("idle");
  }

  return { phase, provider, start, cancel };
}

export type EmailStep = "email" | "code";
export type EmailError = "invalid_email" | "rate_limited" | "invalid_code" | "expired" | "sign_up_incomplete" | "failed";

// Seconds before another code can be sent to the same address.
export const RESEND_COOLDOWN_S = 30;

/**
 * Email sign-in inside the dialog: send a one-time code to the address, then
 * check the code typed in. `onUnsupported` runs when the backend has no email
 * endpoints yet, so the caller can fall back to the browser sign-in.
 */
export function useEmailSignIn(onSignedIn: () => void, onUnsupported: () => void) {
  const [step, setStep] = useState<EmailStep>("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EmailError | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;
  const onUnsupportedRef = useRef(onUnsupported);
  onUnsupportedRef.current = onUnsupported;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send(address: string = email) {
    const trimmed = address.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const result = await startEmailSignIn(trimmed);
    setBusy(false);
    if (result === "unsupported") {
      onUnsupportedRef.current();
      return;
    }
    if (result !== "sent") {
      setError(result);
      return;
    }
    setEmail(trimmed);
    setStep("code");
    setCooldown(RESEND_COOLDOWN_S);
  }

  async function verify(code: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await verifyEmailCode(code);
    setBusy(false);
    if (result === "signed-in") {
      reset();
      onSignedInRef.current();
      return;
    }
    setError(result);
  }

  function reset() {
    setStep("email");
    setError(null);
    setBusy(false);
  }

  return { step, email, busy, error, cooldown, send, verify, reset, clearError: () => setError(null) };
}

// Lets anything (Settings, the account menu, the Join page) open the sign-in
// dialog, which the app shell (RedesignPage) renders.
let openSignInHandler: (() => void) | null = null;

export function openSignInDialog() {
  openSignInHandler?.();
}

export function useSignInDialogHost(open: () => void) {
  useEffect(() => {
    openSignInHandler = open;
    return () => {
      if (openSignInHandler === open) openSignInHandler = null;
    };
  }, [open]);
}
