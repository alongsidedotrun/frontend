import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/springs";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { setSignedIn, setAccountSignedIn } from "@/lib/auth";
import { regenerateUserAvatarSeed } from "@/lib/user";
import { ErrorText } from "@/lib/error-code";

// Two-column layout matches shadcn's login-02 block (form + branded panel),
// but mirrors frontend/auth.html's actual current arrangement (branded
// quote panel on the LEFT, the real sign-in controls on the RIGHT) rather
// than login-02's default (form left, image right), since that's the
// design already shipped in the product today.
export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = "Sign in";
  }, []);

  // "Continue with email" (Story #239) is a real, staged flow now, not a
  // placeholder: email first, then branch on whether backend/src/db.rs's
  // users table already has that address -- an existing email goes
  // straight to a password field (sign in), a new one goes to a real
  // create-account form (full name, then email, then password) per
  // explicit request ("before email ask for Full name as that will be the
  // display name in the account").
  const [step, setStep] = useState<"start" | "login" | "signup">("start");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function goToApp() {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? "/getting-started", { replace: true });
  }

  // Placeholder sign-in for Google/Apple -- no real OAuth exists yet (Story
  // #239 scopes real Apple/Google Sign-In as still-to-build), so this just
  // marks the browser as signed in, matching frontend/auth.html's original
  // enterApp() behavior. The name prompt is a testing aid so two browser
  // profiles can carry different identities to verify multiplayer
  // attribution -- kept for continuity during the migration, not new scope.
  function continueWithPlaceholder() {
    const name = window.prompt("What's your name?");
    setSignedIn(name ?? undefined);
    goToApp();
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const response = await fetch("/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      // Distinct from the catch block below: a response that arrived but
      // wasn't ok (a real HTTP error status) means the backend itself is up
      // and answered -- something went wrong server-side, not a
      // connectivity problem, so this gets its own message instead of the
      // generic "could not reach the server" one.
      if (!response.ok) {
        setError("Something went wrong checking your email. Try again. (ALS-014)");
        return;
      }
      const { exists } = (await response.json()) as { exists: boolean };
      setStep(exists ? "login" : "signup");
    } catch {
      // Same condition, same code, as ConnectionBadge's own ALS-002
      // (settings-overlay.tsx) -- the app could not reach itself, not a
      // provider or account problem. Reusing the exact message/code instead
      // of minting an auth-specific one, per project/ERRORS.md's own
      // precedent of one code covering every site that hits this condition.
      setError("No connection to the application, make sure the application is running, then try again. (ALS-002)");
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        setError("Incorrect email or password. (ALS-015)");
        return;
      }
      const account = (await response.json()) as { id: string; name: string; email: string };
      setAccountSignedIn(account);
      goToApp();
    } catch {
      // Same condition, same code, as ConnectionBadge's own ALS-002
      // (settings-overlay.tsx) -- the app could not reach itself, not a
      // provider or account problem. Reusing the exact message/code instead
      // of minting an auth-specific one, per project/ERRORS.md's own
      // precedent of one code covering every site that hits this condition.
      setError("No connection to the application, make sure the application is running, then try again. (ALS-002)");
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), password }),
      });
      if (!response.ok) {
        setError("Could not create your account. Try again. (ALS-016)");
        return;
      }
      const account = (await response.json()) as { id: string; name: string; email: string };
      // A brand new account, its own random color -- not whichever seed
      // this device's localStorage happened to already have (lib/user.ts's
      // own comment has the full "red for every local account" bug this
      // fixes). Login (submitLogin, above) doesn't do this: an existing
      // account keeps whatever color it already has on this device.
      regenerateUserAvatarSeed();
      setAccountSignedIn(account);
      // Always Getting started for a brand new account, not goToApp()'s own
      // "return to wherever you came from" -- confirmed directly as a real
      // bug ("that instantly brought me to .../settings/profile but it
      // should bring me to getting-started"): a new signup has nothing to
      // "return" to, unlike login/Google's placeholder (goToApp(), below),
      // which do make sense continuing from wherever "Sign in" was clicked.
      navigate("/getting-started", { replace: true });
    } catch {
      // Same condition, same code, as ConnectionBadge's own ALS-002
      // (settings-overlay.tsx) -- the app could not reach itself, not a
      // provider or account problem. Reusing the exact message/code instead
      // of minting an auth-specific one, per project/ERRORS.md's own
      // precedent of one code covering every site that hits this condition.
      setError("No connection to the application, make sure the application is running, then try again. (ALS-002)");
    } finally {
      setLoading(false);
    }
  }

  function backToStart() {
    setStep("start");
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="grid min-h-svh md:grid-cols-[55%_45%]">
      {/* dark, on this div specifically (not the page/app-wide theme) --
          .dark (index.css) is a plain class selector, not scoped to
          html/:root, so putting it here redefines --card-foreground/
          --muted-foreground/etc. to their dark-mode values for this
          subtree alone, regardless of whichever theme the rest of the app
          is actually in -- otherwise text-card-foreground would resolve to
          light mode's own dark-gray value against a forced-black
          background, unreadable. bg-black (fixed #000000), not bg-card --
          per explicit request, this panel should always read as the
          darkest surface in the app, not just whatever --card currently
          resolves to (dark mode's own --card is #1a1a1a, not literally
          black). */}
      <div className="dark hidden md:flex flex-col justify-between bg-black p-6 lg:p-10 text-card-foreground">
        {/* size-5/text-base (was size-8/text-2xl), and mt-4 on top of this
            panel's own p-6/lg:p-10 -- per explicit request ("The icon and
            Alongside needs to be smaller maybe text-medium size for both
            but also it needs to be lowered as that's behind the traffic
            lights on tauri"): the Tauri window itself draws its native
            traffic lights at a fixed overlay position (src-tauri/src/
            lib.rs's own trafficLightPosition, (13, 17)) regardless of this
            page's own layout, so this mark needs real clearance below
            that fixed point, not just its container's own default
            padding. */}
        <div className="mt-4 flex items-center gap-2">
          <AlongsideLogo className="size-5" />
          <span className="font-sans text-base">Alongside</span>
        </div>
        {/* A real product tagline, not a quote -- per explicit request,
            replacing the placeholder Lorem ipsum text. No footer/attribution
            line any more either: that made sense for a fake quote, not for
            a plain description of what the app is. */}
        {/* font-sans -- the app's own active font, same as "Alongside" above,
            not a different display face for this tagline. opacity-50, not a
            lighter text color token -- per explicit request ("dim that out
            at least 50%"), a literal opacity reduction on the same
            text-card-foreground this panel already inherits. */}
        {/* whitespace-nowrap -- per explicit request ("I want this to stay
            one line"), instead of wrapping across two lines at this panel's
            own width. */}
        <p className="font-sans text-sm leading-relaxed whitespace-nowrap opacity-50">
          Multiplayer AI, for everyone.
        </p>
      </div>

      <div className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        {/* Escape hatch back to the app for anyone who lands here without
            wanting to sign in yet -- per explicit request ("add a return to
            previous page once we open auth in case someone doesn't want to
            auth yet"). goToApp() (below) already resolves to wherever this
            page was opened from (state.from), same destination a real
            sign-in lands on -- opacity-50/hover:opacity-100, inactive-
            reading until hovered, per that same request ("inactive 50%"). */}
        <button
          type="button"
          onClick={goToApp}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-xs font-normal text-muted-foreground opacity-50 transition-opacity hover:opacity-100"
        >
          Return to Alongside
        </button>
        <div className="w-full max-w-sm">
          <FieldGroup>
            <div className="flex items-center gap-2.5 mb-2 md:hidden justify-center">
              <AlongsideLogo className="size-8" />
              <span className="font-sans text-2xl">Alongside</span>
            </div>

            {/* mode="wait" -- fades the previous step fully out before the
                next one fades in (per explicit request, "make sure we have
                a fade out and fade in transition to the forms"), rather than
                cross-fading two differently-shaped forms on top of each
                other. Keyed by step, not the whole AuthPage -- App.tsx's own
                isAuthPage-keyed AnimatePresence already covers the
                auth-page <-> real-app boundary (Google's own instant
                sign-in included); this one is scoped to switching between
                this page's own start/email/login/signup forms. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: spring.moderate }}
                exit={{ opacity: 0, transition: spring.moderate.exit }}
              >
            {step === "start" && (
              <form onSubmit={submitEmail}>
                <FieldGroup>
                  <h1 className="font-sans font-semibold text-2xl text-center">Sign In</h1>

                  <Field>
                    {/* border-border/bg-background + dark:border-[#282828]/
                        dark:bg-[#212121] -- the exact border/bg pairing
                        compose-box.tsx's own main container uses, per explicit
                        request, replacing an earlier attempt (dark:border-border/
                        dark:bg-background alone) that fixed the dark-mode
                        border's near-invisibility (--input sits almost the same
                        as --background) but didn't match the compose box's own
                        specific surface color. twMerge (this app's own cn()
                        helper, lib/utils.ts) correctly drops the outline
                        variant's own conflicting classes for these properties in
                        favor of this override. dark:hover:bg-[#262626], not the
                        outline variant's own dark:hover:bg-input/50 -- confirmed
                        directly as a real mismatch ("follow our conventions for
                        dark and light mode, including... hover"): --input (a
                        translucent overlay meant to sit on the default
                        dark:bg-input/30 base) reads muddy over this button's own
                        custom #212121 base, so the hover shade is derived from
                        that same literal instead, matching how compose-box.tsx's
                        own send button derives its hover from its own base
                        color rather than a generic token. */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={continueWithPlaceholder}
                      className="border-border bg-background hover:bg-muted dark:border-[#282828] dark:bg-[#212121] dark:hover:bg-[#262626]"
                    >
                      {/* icons/providers/ -- the same central static-asset
                          folder every other provider mark already lives in
                          (lib/quick-chat-models.tsx's own ProviderIcon), per
                          explicit request, instead of this page's own
                          one-off inline <svg>. */}
                      <img src="/icons/providers/google.svg" alt="" width={16} height={16} />
                      Continue with Google
                    </Button>
                  </Field>

                  <Field>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={continueWithPlaceholder}
                      className="border-border bg-background hover:bg-muted dark:border-[#282828] dark:bg-[#212121] dark:hover:bg-[#262626]"
                    >
                      {/* apple.svg's own mark is solid white (fill="#fff") --
                          invisible against this button's light background,
                          so it's inverted to black in light mode and left
                          untouched in dark mode, the opposite direction of
                          quick-chat-models.tsx's own invertInDark flag (which
                          exists for solid-black marks needing the reverse). */}
                      {/* 13px, not 16 -- apple.svg's own mark runs edge to
                          edge in its viewBox (confirmed directly, "that
                          still too big"), the same over-fill
                          quick-chat-models.tsx's own iconScale documents for
                          chatgpt.svg/grok.svg next to claude.svg's ~81%-filled
                          mark. Scaled down here instead, since this page has
                          no shared iconScale mechanism of its own to reuse. */}
                      <img src="/icons/providers/apple.svg" alt="" width={13} height={13} className="invert dark:invert-0" />
                      Continue with Apple
                    </Button>
                  </Field>

                  <FieldSeparator>Or continue with</FieldSeparator>

                  {/* Email typed right here on the same screen, not behind
                      its own separate "Continue with email" click-through --
                      per explicit request (a reference screenshot showing
                      the email field and its submit button on one screen),
                      replacing an earlier version that only got here after
                      a first click on a plain "Continue with email" button
                      with no field of its own. */}
                  <Field>
                    <FieldLabel htmlFor="auth-email">Email</FieldLabel>
                    {/* focus-visible:border-focus-accent -- the same blue
                        focus border compose-box.tsx's own textarea and the
                        sidebar/inbox search inputs use (sidebar-nav.tsx),
                        per explicit request ("when clicking at email input
                        that should go blue border like the compose and
                        search bar goes"). The shared Input component
                        (ui/input.tsx) doesn't apply this by default -- each
                        real input opts in individually, same as those two
                        call sites do. */}
                    <Input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="focus-visible:border-focus-accent"
                    />
                  </Field>
                  {error && <p className="text-sm text-destructive"><ErrorText message={error} /></p>}
                  <Field>
                    {/* --send-button-bg/-hover/-active -- the same blue
                        compose-box.tsx's own send button uses, per explicit
                        request ("make it blue like our send button"). Real
                        grey while disabled (disabled:bg-muted), not the
                        Button component's own default disabled:opacity-50
                        (a faded blue) -- per explicit request ("once we
                        click that should go grey"), so a pressed, in-flight
                        click reads as genuinely inactive rather than just
                        dimmed. */}
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-[var(--send-button-bg)] text-white hover:bg-[var(--send-button-bg-hover)] active:bg-[var(--send-button-bg-active)] disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                    >
                      {loading ? "Checking" : "Continue with email"}
                    </Button>
                  </Field>

                  <FieldDescription className="text-center text-xs">
                    By clicking continue, you agree to our <a href="#" className="underline">Terms of Service</a> and{" "}
                    <a href="#" className="underline">Privacy Policy</a>.
                  </FieldDescription>
                </FieldGroup>
              </form>
            )}

            {step === "login" && (
              <form onSubmit={submitLogin}>
                <FieldGroup>
                  <h1 className="font-sans font-semibold text-2xl text-center">Welcome back</h1>
                  <Field>
                    <FieldLabel htmlFor="auth-login-email">Email</FieldLabel>
                    <Input id="auth-login-email" type="email" value={email} disabled />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="auth-login-password">Password</FieldLabel>
                    <Input
                      id="auth-login-password"
                      type="password"
                      autoFocus
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="focus-visible:border-focus-accent"
                    />
                  </Field>
                  {error && <p className="text-sm text-destructive"><ErrorText message={error} /></p>}
                  <Field>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Signing in..." : "Sign in"}
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    {/* text-muted-foreground/hover:text-foreground -- the
                        same interactive-text hover pairing settings-overlay.tsx's
                        own icon buttons use, per explicit request ("follow our
                        conventions for dark and light mode, including...
                        hover"); this link had no hover feedback at all before. */}
                    <button
                      type="button"
                      className="text-muted-foreground underline transition-colors hover:text-foreground"
                      onClick={backToStart}
                    >
                      Back
                    </button>
                  </FieldDescription>
                </FieldGroup>
              </form>
            )}

            {step === "signup" && (
              <form onSubmit={submitSignup}>
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="font-sans font-semibold text-2xl">Create your account</h1>
                    <p className="text-sm text-balance text-muted-foreground">
                      This email is new to Alongside. Set up your account to continue.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="auth-full-name">Full name</FieldLabel>
                    <Input
                      id="auth-full-name"
                      autoFocus
                      required
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="focus-visible:border-focus-accent"
                    />
                    <FieldDescription>This is how you will show up to other people in a chat.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="auth-signup-email">Email</FieldLabel>
                    <Input
                      id="auth-signup-email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="focus-visible:border-focus-accent"
                    />
                  </Field>
                  <Field>
                    <Field className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="auth-signup-password">Password</FieldLabel>
                        <Input
                          id="auth-signup-password"
                          type="password"
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          className="focus-visible:border-focus-accent"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="auth-confirm-password">Confirm password</FieldLabel>
                        <Input
                          id="auth-confirm-password"
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          className="focus-visible:border-focus-accent"
                        />
                      </Field>
                    </Field>
                    <FieldDescription>Must be at least 8 characters long.</FieldDescription>
                  </Field>
                  {error && <p className="text-sm text-destructive"><ErrorText message={error} /></p>}
                  <Field>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Creating account" : "Create account"}
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    {/* text-muted-foreground/hover:text-foreground -- the
                        same interactive-text hover pairing settings-overlay.tsx's
                        own icon buttons use, per explicit request ("follow our
                        conventions for dark and light mode, including...
                        hover"); this link had no hover feedback at all before. */}
                    <button
                      type="button"
                      className="text-muted-foreground underline transition-colors hover:text-foreground"
                      onClick={backToStart}
                    >
                      Back
                    </button>
                  </FieldDescription>
                </FieldGroup>
              </form>
            )}
              </motion.div>
            </AnimatePresence>
          </FieldGroup>
        </div>
      </div>
    </div>
  );
}
