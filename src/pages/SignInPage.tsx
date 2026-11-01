import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { SignInDialog } from "@/components/design-system/sign-in-dialog";
import { useIsSignedIn } from "@/lib/auth";

/**
 * Sign in as a page in the main area, like New bot, instead of an overlay. Every "Sign in" in the
 * app (openSignInDialog) comes here with the page it was on; signing in or cancelling goes back to it.
 */
export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signedIn = useIsSignedIn();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  // Already signed in (an old link, or a second tab): nothing to do here.
  if (signedIn) return <Navigate to={from} replace />;
  return <SignInDialog asPage open onOpenChange={(open) => !open && navigate(from, { replace: true })} />;
}
