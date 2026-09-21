import { Trans, useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { beginSignIn, waitForSignIn } from "@/lib/auth";

// Two-column layout matches shadcn's login-02 block (form + branded panel),
// but mirrors frontend/auth.html's actual current arrangement (branded
// quote panel on the LEFT, the real sign-in controls on the RIGHT) rather
// than login-02's default (form left, image right), since that's the
// design already shipped in the product today.
//
// One button: sign-in happens on the identity provider's own page in the
// system browser (Google, GitHub or email are chosen there), never in this
// WebView. This page opens it, then waits for the backend to report that the
// browser sign-in finished (lib/auth.ts).
export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = t("auth.title");
  }, [t]);

  const [phase, setPhase] = useState<"idle" | "waiting" | "failed" | "timeout">("idle");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function goToApp() {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? "/getting-started", { replace: true });
  }

  async function startSignIn() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    if (!(await beginSignIn())) {
      setPhase("failed");
      return;
    }
    setPhase("waiting");
    const result = await waitForSignIn(current.signal);
    if (result === "signed-in") goToApp();
    else if (result === "timeout") setPhase("timeout");
  }

  function cancel() {
    controller.current?.abort();
    setPhase("idle");
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
          {t("auth.tagline")}
        </p>
      </div>

      <div className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        {/* Escape hatch back to the app for anyone who lands here without
            wanting to sign in yet. goToApp() resolves to wherever this page
            was opened from (state.from), the same place a real sign-in lands. */}
        <button
          type="button"
          onClick={goToApp}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-xs font-normal text-muted-foreground opacity-50 transition-opacity hover:opacity-100"
        >
          {t("settings.returnToAlongside")}
        </button>
        <div className="w-full max-w-sm">
          <FieldGroup>
            <div className="flex items-center gap-2.5 mb-2 md:hidden justify-center">
              <AlongsideLogo className="size-8" />
              <span className="font-sans text-2xl">Alongside</span>
            </div>

            <h1 className="font-sans font-semibold text-2xl text-center">{t("auth.signInHeading")}</h1>

            {phase === "waiting" ? (
              <>
                <FieldDescription className="text-center">{t("auth.waiting")}</FieldDescription>
                <Field>
                  <Button type="button" variant="outline" onClick={() => void startSignIn()}>
                    {t("auth.reopen")}
                  </Button>
                </Field>
                <FieldDescription className="text-center">
                  <button
                    type="button"
                    className="text-muted-foreground underline transition-colors hover:text-foreground"
                    onClick={cancel}
                  >
                    {t("common.cancel")}
                  </button>
                </FieldDescription>
              </>
            ) : (
              <>
                {(phase === "failed" || phase === "timeout") && (
                  <p className="text-sm text-destructive text-center">
                    {phase === "timeout" ? t("auth.errors.timeout") : t("auth.errors.signIn")}
                  </p>
                )}
                <Field>
                  <Button
                    type="button"
                    onClick={() => void startSignIn()}
                    className="bg-[var(--send-button-bg)] text-white hover:bg-[var(--send-button-bg-hover)] active:bg-[var(--send-button-bg-active)]"
                  >
                    {t("auth.continue")}
                  </Button>
                </Field>
                <FieldDescription className="text-center text-xs">
                  <Trans
                    i18nKey="auth.terms"
                    components={[<a href="#" className="underline" key="0" />, <a href="#" className="underline" key="1" />]}
                  />
                </FieldDescription>
              </>
            )}
          </FieldGroup>
        </div>
      </div>
    </div>
  );
}
