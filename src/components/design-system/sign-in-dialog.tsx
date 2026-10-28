import { Trans, useTranslation } from "react-i18next";
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { loadLanguage, saveLanguage, uiLocaleFor, type LanguageValue } from "@/lib/language";
import { loadTimezone, saveTimezone } from "@/lib/timezones";
import { LanguageDropdown, TimezoneDropdown } from "@/components/locale-dropdowns";
import { SurfaceProvider } from "@/lib/surface-context";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { GitHubMarkIcon, GoogleIcon } from "@/components/icons/brand-icons";
import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/components/ui/app-toast";
import { CodeInput } from "@/components/ui/code-input";
import { cn } from "@/lib/utils";
import { useEmailSignIn, useSignInFlow, type EmailError } from "@/lib/use-sign-in";

type SignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CODE_LENGTH = 6;

// A dropdown's trigger in the look of a ShellField: the label, the current value and a chevron.
const DropdownField = forwardRef<HTMLButtonElement, { label: string; value: string } & ButtonHTMLAttributes<HTMLButtonElement>>(function DropdownField({ label, value, className, ...props }, ref) {
  return (
    <button ref={ref} type="button" className={cn("flex h-8 w-full items-center gap-2 pr-2 pl-3 text-left text-ui outline-none focus-visible:ring-2 focus-visible:ring-ring", SHELL_RADIUS, SHELL_SURFACE, className)} {...props}>
      <span className="w-[72px] shrink-0 truncate text-ui-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-foreground">{value}</span>
      <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
});

const EMAIL_ERROR_KEYS: Record<EmailError, string> = {
  invalid_email: "auth.errors.invalidEmail",
  invalid_name: "auth.errors.invalidName",
  rate_limited: "auth.errors.rateLimited",
  invalid_code: "auth.errors.invalidCode",
  expired: "auth.errors.expired",
  sign_up_incomplete: "auth.errors.signUpIncomplete",
  failed: "auth.errors.verify",
};

/**
 * Sign in, in the shell dialog's layout (ShellDialog, like Invite members).
 * Email signs in without leaving the app: a one-time code is sent and typed
 * in here; an email with no account yet first asks for the person's name
 * (with the email, which can still be changed) to create one. Google and
 * GitHub open the system browser on the provider's own page (they refuse to
 * sign in inside an app's web view), and the dialog waits for it and closes
 * once signed in.
 */
export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const { t, i18n } = useTranslation();
  const close = () => onOpenChange(false);
  const { phase, provider, start, cancel } = useSignInFlow(close);
  // A sign-in that couldn't start or timed out says so in a toast at the top of the window,
  // which stays until it's closed or times out (the same id replaces it on another try).
  useEffect(() => {
    if (phase === "failed" || phase === "timeout") showErrorToast(t(phase === "timeout" ? "auth.errors.timeout" : "auth.errors.signIn"), { id: "sign-in" });
  }, [phase, t]);
  // A backend without the email endpoints yet: the hosted page in the browser
  // still offers email sign-in.
  const email = useEmailSignIn(close, () => void start());
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  // Creating an account: the name, and the email (prefilled, can be changed).
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signUpAddress, setSignUpAddress] = useState("");
  // Language and timezone for the new account: detected from the system first (as in Settings).
  const [language, setLanguage] = useState<LanguageValue>(loadLanguage);
  const [timezone, setTimezone] = useState<string>(loadTimezone);
  const emailId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const signUpEmailId = useId();
  const formId = useId();
  // Opening focuses the email field, so the address can be typed straight away.
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeId = useId();

  // Closing the dialog stops waiting for a browser sign-in in progress and
  // starts the next one from the beginning.
  useEffect(() => {
    if (open) return;
    cancel();
    email.reset();
    setCode("");
    setFirstName("");
    setLastName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Asked for a name: the email it was given, ready to change.
  useEffect(() => {
    if (email.step === "details") setSignUpAddress(email.email);
  }, [email.step, email.email]);

  const verify = (value: string) => {
    if (value.length === CODE_LENGTH) void email.verify(value);
  };

  const errorText = (error: EmailError) =>
    error === "failed" && email.step !== "code" ? t("auth.errors.sendCode") : t(EMAIL_ERROR_KEYS[error]);

  const back = () => {
    email.reset();
    setCode("");
  };

  const stepKey = phase === "waiting" ? "waiting" : email.step;

  const providerLabel = provider === "github" ? t("auth.continueWithGitHub") : t("auth.continueWithGoogle");
  // A white, full-width button on the dialog's surface (Google, GitHub, open again).
  const providerButton = cn("h-8 w-full bg-white dark:bg-transparent", SHELL_RADIUS);

  const heading =
    stepKey === "waiting"
      ? { title: t("auth.signInHeading"), description: t("auth.waiting") }
      : stepKey === "details"
        ? { title: t("auth.createAccountHeading"), description: t("auth.createAccountDescription") }
        : stepKey === "code"
          ? {
              title: t("auth.codeHeading"),
              description: (
                <Trans i18nKey="auth.codeSent" values={{ email: email.email }} components={[<span className="break-words font-medium text-foreground" key="0" />]} />
              ),
            }
          : { title: t("auth.signInHeading"), description: t("auth.tagline") };

  const actions =
    stepKey === "waiting" ? (
      <ShellDialogActions cancelLabel={t("common.cancel")} onCancel={cancel} primary={{ label: provider ? providerLabel : t("auth.reopen"), onClick: () => void start() }} />
    ) : stepKey === "details" ? (
      <ShellDialogActions
        cancelLabel={t("common.cancel")}
        onCancel={back}
        primary={{ label: t("auth.createAccount"), type: "submit", form: formId, disabled: !firstName.trim() || !signUpAddress.trim(), loading: email.busy }}
      />
    ) : stepKey === "code" ? (
      <ShellDialogActions cancelLabel={t("common.cancel")} onCancel={back} primary={{ label: t("auth.verify"), type: "submit", form: formId, disabled: code.length !== CODE_LENGTH, loading: email.busy }} />
    ) : (
      <ShellDialogActions
        cancelLabel={t("common.cancel")}
        onCancel={close}
        primary={{ label: t("auth.continueWithEmail"), type: "submit", form: formId, disabled: !address.trim(), loading: email.busy }}
      />
    );

  return (
    <ShellDialog
      centered
      transitionKey={stepKey}
      footnote={
        stepKey === "email" && (
          // Balanced wrapping keeps two lines even; each link stays in one piece.
          <p className="text-center text-ui-xs leading-relaxed text-balance text-muted-foreground">
            <Trans
              i18nKey="auth.terms"
              components={[<a href="#" className="whitespace-nowrap underline" key="0" />, <a href="#" className="whitespace-nowrap underline" key="1" />]}
            />
          </p>
        )
      }
      open={open} onOpenChange={onOpenChange} initialFocus={emailInputRef} title={heading.title} description={heading.description} actions={actions}>
      {/* Each step fades in as a whole page (ShellDialog's transitionKey). */}
      <div className="flex flex-col gap-3">
          {stepKey === "waiting" ? null : stepKey === "details" ? (
            <form
              id={formId}
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                // Kept on this device too: the app switches to the language, Settings shows the timezone.
                saveLanguage(language);
                void i18n.changeLanguage(uiLocaleFor(language));
                saveTimezone(timezone);
                void email.signUp(signUpAddress, firstName, lastName, { language, timezone });
              }}
            >
              <ShellField label={t("auth.firstName")} htmlFor={firstNameId}>
                <input id={firstNameId} autoFocus value={firstName} onChange={(event) => { setFirstName(event.target.value); email.clearError(); }} autoComplete="given-name" maxLength={100} className={SHELL_FIELD_INPUT} />
              </ShellField>
              <ShellField label={t("auth.lastName")} htmlFor={lastNameId}>
                <input id={lastNameId} value={lastName} onChange={(event) => { setLastName(event.target.value); email.clearError(); }} autoComplete="family-name" maxLength={100} className={SHELL_FIELD_INPUT} />
              </ShellField>
              <ShellField label={t("auth.emailLabel")} htmlFor={signUpEmailId}>
                <input
                  id={signUpEmailId}
                  type="email"
                  value={signUpAddress}
                  onChange={(event) => { setSignUpAddress(event.target.value); email.clearError(); }}
                  autoComplete="email"
                  aria-invalid={email.error === "invalid_email" || undefined}
                  className={SHELL_FIELD_INPUT}
                />
              </ShellField>
              {/* Settings' own Language and Timezone dropdowns (locale-dropdowns.tsx), opened from a field. */}
              <SurfaceProvider value={8}>
                <LanguageDropdown align="start" value={language} onChange={setLanguage} trigger={(label) => <DropdownField label={t("auth.language")} value={label} />} />
                <TimezoneDropdown align="start" value={timezone} onChange={setTimezone} trigger={(label) => <DropdownField label={t("auth.timezone")} value={label} />} />
              </SurfaceProvider>
              {email.error && <p className="text-ui-sm text-destructive">{errorText(email.error)}</p>}
            </form>
          ) : stepKey === "code" ? (
            <form
              id={formId}
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                verify(code);
              }}
            >
              <div className="flex flex-col items-center gap-2.5 pt-2">
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
                <label id={`${codeId}-label`} htmlFor={codeId} className="text-ui text-foreground">
                  {t("auth.codeLabel")}
                </label>
              </div>
              {email.error && <p className="text-center text-ui-sm text-destructive">{errorText(email.error)}</p>}
              <div className="flex items-center justify-between gap-3 text-ui-sm">
                <button type="button" onClick={back} className="text-muted-foreground underline transition-colors hover:text-foreground">
                  {t("auth.useDifferentEmail")}
                </button>
                <button
                  type="button"
                  disabled={email.cooldown > 0 || email.busy}
                  onClick={() => {
                    setCode("");
                    email.resend();
                  }}
                  className="text-muted-foreground underline transition-colors hover:text-foreground disabled:no-underline disabled:opacity-60 disabled:hover:text-muted-foreground"
                >
                  {email.cooldown > 0 ? t("auth.resendIn", { seconds: email.cooldown }) : t("auth.resend")}
                </button>
              </div>
            </form>
          ) : (
            <>
              <Button type="button" variant="tertiary" leadingIcon={GoogleIcon} className={providerButton} onClick={() => void start("google")}>
                {t("auth.continueWithGoogle")}
              </Button>
              <Button type="button" variant="tertiary" leadingIcon={GitHubMarkIcon} className={providerButton} onClick={() => void start("github")}>
                {t("auth.continueWithGitHub")}
              </Button>
              <div className="flex items-center gap-3 py-1 text-ui-sm text-muted-foreground">
                <span className="h-px flex-1 bg-[var(--redesign-sidebar-border)]" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-[var(--redesign-sidebar-border)]" />
              </div>
              <form
                id={formId}
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void email.send(address);
                }}
              >
                <ShellField label={t("auth.emailLabel")} htmlFor={emailId}>
                  <input
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
                    className={SHELL_FIELD_INPUT}
                  />
                </ShellField>
                {email.error && <p className="text-ui-sm text-destructive">{errorText(email.error)}</p>}
              </form>
            </>
          )}
      </div>
    </ShellDialog>
  );
}
