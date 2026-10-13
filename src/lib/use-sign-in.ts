import { useEffect, useRef, useState } from "react";
import { beginSignIn, waitForSignIn } from "@/lib/auth";

export type SignInPhase = "idle" | "waiting" | "failed" | "timeout";

/**
 * The browser sign-in flow shared by the /auth page and the sign-in dialog:
 * open the identity provider's page in the system browser, then wait for the
 * backend to report the account signed in (lib/auth.ts).
 */
export function useSignInFlow(onSignedIn: () => void) {
  const [phase, setPhase] = useState<SignInPhase>("idle");
  const controller = useRef<AbortController | null>(null);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  useEffect(() => () => controller.current?.abort(), []);

  async function start() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    if (!(await beginSignIn())) {
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

  return { phase, start, cancel };
}

// Lets anything (e.g. Settings) open the sign-in dialog when the shell that
// renders it is mounted; returns false otherwise so callers can fall back to
// the /auth page.
let openSignInHandler: (() => void) | null = null;

export function openSignInDialog(): boolean {
  if (!openSignInHandler) return false;
  openSignInHandler();
  return true;
}

export function useSignInDialogHost(open: () => void) {
  useEffect(() => {
    openSignInHandler = open;
    return () => {
      if (openSignInHandler === open) openSignInHandler = null;
    };
  }, [open]);
}
