import { Trans, useTranslation } from "react-i18next";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { Backdrop } from "@/components/design-system/backdrop";
import { WorkspaceBrandIcon } from "@/components/design-system/workspace-brand-icon";
import { GitHubMarkIcon, GoogleIcon } from "@/components/icons/brand-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CodeInput } from "@/components/ui/code-input";
import { Input } from "@/components/ui/input";
import { useEmailSignIn, useSignInFlow, type EmailError } from "@/lib/use-sign-in";

type SignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CODE_LENGTH = 6;

const EMAIL_ERROR_KEYS: Record<EmailError, string> = {
  invalid_email: "auth.errors.invalidEmail",
  rate_limited: "auth.errors.rateLimited",
  invalid_code: "auth.errors.invalidCode",
  expired: "auth.errors.expired",
  sign_up_incomplete: "auth.errors.signUpIncomplete",
  failed: "auth.errors.verify",
};

/**
 * Two-pane sign-in dialog, laid out like the create workspace dialog: the
 * sign-in on the left, the photo backdrop on the right (issue #26).
 * Email signs in without leaving the app: a one-time code is sent and typed
 * in here. Google and GitHub open the system browser on the provider's own
 * page (they refuse to sign in inside an app's web view), and the dialog
 * waits for it and closes once signed in.
 */
export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const { phase, provider, start, cancel } = useSignInFlow(close);
  // A backend without the email endpoints yet: the hosted page in the browser
  // still offers email sign-in.
  const email = useEmailSignIn(close, () => void start());
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const emailId = useId();
  // Opening focuses the email field, so the address can be typed straight
  // away (rather than the first provider button lighting up as focused).
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeId = useId();

  // Closing the dialog stops waiting for a browser sign-in in progress and
  // starts the next one from the beginning.
  useEffect(() => {
    if (open) return;
    cancel();
    email.reset();
    setCode("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const verify = (value: string) => {
    if (value.length === CODE_LENGTH) void email.verify(value);
  };

  const errorText = (error: EmailError) =>
    error === "failed" && email.step === "email" ? t("auth.errors.sendCode") : t(EMAIL_ERROR_KEYS[error]);

  const stepKey = phase === "waiting" ? "waiting" : email.step;
  // Forward (+1) into the code or the browser wait, back (-1) to the email form.
  const direction = stepKey === "email" ? -1 : 1;
  const reduceMotion = useReducedMotion();
  const shift = reduceMotion ? 0 : 16;
  const stepMotion: Variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * shift }),
    center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
    exit: (dir: number) => ({ opacity: 0, x: -dir * shift, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }),
  };

  const providerLabel = provider === "github" ? t("auth.continueWithGitHub") : t("auth.continueWithGoogle");

  return (
    // !z-[120]: above the app top bar (z-[110]), like the other shell dialogs.
    <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
      <DialogContent size="xl" initialFocus={emailInputRef} className="!z-[120] max-w-[min(760px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="grid min-h-[480px] grid-cols-1 sm:grid-cols-2">
          <div className="flex flex-col items-center bg-[var(--redesign-primary-surface)] p-8 text-center">
            <WorkspaceBrandIcon size={32} />

            <div className="my-auto w-full max-w-[18rem] py-8">
              {/* Each step slides in from the side it comes from: forward to
                  the code (or the browser wait), back to the email form. */}
              <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={stepKey}
                custom={direction}
                variants={stepMotion}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-col gap-6"
              >
              {phase === "waiting" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <DialogTitle className="text-[22px] font-medium text-foreground">{t("auth.signInHeading")}</DialogTitle>
                    <DialogDescription className="text-[13px] text-muted-foreground">{t("auth.waiting")}</DialogDescription>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      variant="tertiary"
                      leadingIcon={provider === "github" ? GitHubMarkIcon : provider === "google" ? GoogleIcon : undefined}
                      onClick={() => void start()}
                    >
                      {provider ? providerLabel : t("auth.reopen")}
                    </Button>
                    <button
                      type="button"
                      onClick={cancel}
                      className="self-center text-[12px] text-muted-foreground underline transition-colors hover:text-foreground"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              ) : email.step === "code" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <DialogTitle className="text-[22px] font-medium text-foreground">{t("auth.codeHeading")}</DialogTitle>
                    <DialogDescription className="text-[13px] text-muted-foreground">
                      <Trans
                        i18nKey="auth.codeSent"
                        values={{ email: email.email }}
                        components={[<span className="break-words font-medium text-foreground" key="0" />]}
                      />
                    </DialogDescription>
                  </div>
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      verify(code);
                    }}
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <CodeInput
                        id={codeId}
                        autoFocus
                        length={CODE_LENGTH}
                        value={code}
                        onChange={(digits) => {
                          setCode(digits);
                          email.clearError();
                          // A full code (typed or pasted) checks itself.
                          verify(digits);
                        }}
                        invalid={email.error === "invalid_code" || email.error === "expired"}
                        aria-describedby={`${codeId}-label`}
                      />
                      <label id={`${codeId}-label`} htmlFor={codeId} className="text-[13px] text-foreground">
                        {t("auth.codeLabel")}
                      </label>
                    </div>
                    {email.error && <p className="text-[12px] text-destructive">{errorText(email.error)}</p>}
                    <Button type="submit" variant="primary" disabled={code.length !== CODE_LENGTH} loading={email.busy}>
                      {t("auth.verify")}
                    </Button>
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <button
                        type="button"
                        onClick={() => {
                          email.reset();
                          setCode("");
                        }}
                        className="text-muted-foreground underline transition-colors hover:text-foreground"
                      >
                        {t("auth.useDifferentEmail")}
                      </button>
                      <button
                        type="button"
                        disabled={email.cooldown > 0 || email.busy}
                        onClick={() => {
                          setCode("");
                          void email.send();
                        }}
                        className="text-muted-foreground underline transition-colors hover:text-foreground disabled:no-underline disabled:opacity-60 disabled:hover:text-muted-foreground"
                      >
                        {email.cooldown > 0 ? t("auth.resendIn", { seconds: email.cooldown }) : t("auth.resend")}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <DialogTitle className="text-[22px] font-medium text-foreground">{t("auth.signInHeading")}</DialogTitle>
                    <DialogDescription className="text-[13px] text-muted-foreground">{t("auth.tagline")}</DialogDescription>
                  </div>
                  <div className="flex flex-col gap-3">
                    {(phase === "failed" || phase === "timeout") && (
                      <p className="text-[12px] text-destructive">
                        {phase === "timeout" ? t("auth.errors.timeout") : t("auth.errors.signIn")}
                      </p>
                    )}
                    <Button type="button" variant="tertiary" leadingIcon={GoogleIcon} onClick={() => void start("google")}>
                      {t("auth.continueWithGoogle")}
                    </Button>
                    <Button type="button" variant="tertiary" leadingIcon={GitHubMarkIcon} onClick={() => void start("github")}>
                      {t("auth.continueWithGitHub")}
                    </Button>

                    <div className="flex items-center gap-3 py-1 text-[12px] text-muted-foreground">
                      <span className="h-px flex-1 bg-[var(--redesign-sidebar-border)]" />
                      {t("auth.or")}
                      <span className="h-px flex-1 bg-[var(--redesign-sidebar-border)]" />
                    </div>

                    <form
                      className="flex flex-col gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void email.send(address);
                      }}
                    >
                      <label htmlFor={emailId} className="sr-only">{t("auth.emailLabel")}</label>
                      <Input
                        ref={emailInputRef}
                        id={emailId}
                        type="email"
                        value={address}
                        onChange={(event) => {
                          setAddress(event.target.value);
                          email.clearError();
                        }}
                        autoComplete="email"
                        placeholder={t("auth.emailPlaceholder")}
                        aria-invalid={email.error === "invalid_email" || undefined}
                        className="h-9 border-[var(--redesign-sidebar-border)] bg-background text-[13px] md:text-[13px]"
                      />
                      {email.error && <p className="text-left text-[12px] text-destructive">{errorText(email.error)}</p>}
                      <Button type="submit" variant="primary" disabled={!address.trim()} loading={email.busy}>
                        {t("auth.continueWithEmail")}
                      </Button>
                    </form>
                  </div>
                </>
              )}
              </motion.div>
              </AnimatePresence>
            </div>

            {/* One line at full dialog width (windows 792px+): bleeds 24px into the
                pane's 32px side padding at 10.5px, so the sentence (~348px)
                fits the 380px pane; wraps on narrower windows instead of
                spilling out. */}
            <p className="-mx-6 text-[10.5px] leading-relaxed text-muted-foreground min-[792px]:whitespace-nowrap">
              <Trans
                i18nKey="auth.terms"
                components={[<a href="#" className="underline" key="0" />, <a href="#" className="underline" key="1" />]}
              />
            </p>
          </div>

          <div aria-hidden="true" className="relative hidden overflow-hidden sm:block">
            <Backdrop />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
