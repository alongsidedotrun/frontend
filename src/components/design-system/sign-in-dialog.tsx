import { Trans, useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Backdrop } from "@/components/design-system/backdrop";
import { WorkspaceBrandIcon } from "@/components/design-system/workspace-brand-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSignInFlow } from "@/lib/use-sign-in";

type SignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Two-pane sign-in dialog, laid out like the create workspace dialog: the
 * sign-in on the left, the photo backdrop on the right. Sign-in itself runs in
 * the system browser on the identity provider's page (Google, GitHub or email
 * are chosen there); this waits for it and closes once signed in.
 */
export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const { t } = useTranslation();
  const { phase, start, cancel } = useSignInFlow(() => onOpenChange(false));

  // Closing the dialog stops waiting for a browser sign-in in progress.
  useEffect(() => {
    if (!open) cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    // !z-[120]: above the app top bar (z-[110]), like the other shell dialogs.
    <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
      <DialogContent size="xl" className="!z-[120] max-w-[min(760px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="grid min-h-[440px] grid-cols-1 sm:grid-cols-2">
          <div className="flex flex-col items-center bg-[var(--redesign-primary-surface)] p-8 text-center">
            <WorkspaceBrandIcon size={32} />

            <div className="my-auto flex w-full max-w-[18rem] flex-col gap-6 py-8">
              <div className="flex flex-col gap-1.5">
                <DialogTitle className="text-[22px] font-medium text-foreground">{t("auth.signInHeading")}</DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">{t("auth.tagline")}</DialogDescription>
              </div>

              {phase === "waiting" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] text-muted-foreground">{t("auth.waiting")}</p>
                  <Button type="button" variant="tertiary" onClick={() => void start()}>
                    {t("auth.reopen")}
                  </Button>
                  <button
                    type="button"
                    onClick={cancel}
                    className="self-center text-[12px] text-muted-foreground underline transition-colors hover:text-foreground"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {(phase === "failed" || phase === "timeout") && (
                    <p className="text-[12px] text-destructive">
                      {phase === "timeout" ? t("auth.errors.timeout") : t("auth.errors.signIn")}
                    </p>
                  )}
                  <Button type="button" variant="primary" onClick={() => void start()}>
                    {t("auth.continue")}
                  </Button>
                </div>
              )}
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
