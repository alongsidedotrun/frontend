import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Backdrop } from "@/components/design-system/backdrop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIsSignedIn } from "@/lib/auth";
import { ErrorText } from "@/lib/error-code";
import { SHARE_ERRORS, formatTypedId } from "@/lib/use-share";
import { openSignInDialog } from "@/lib/use-sign-in";

const CHAT_ID_GROUPS = [5, 5] as const;
const CODE_GROUPS = [4, 4] as const;
// The same box the Share dialog shows the chat ID and code in, so what's typed
// looks like what was given. 44px tall: radius 44 × 8/27 (STYLE_GUIDE.md).
const FIELD_CLASS = "h-11 rounded-[calc(44px*8/27)] border-[var(--redesign-sidebar-border)] bg-background px-3.5 font-mono text-[15px] tracking-[0.12em] text-foreground md:text-[15px] dark:bg-background";

/**
 * Join someone else's chat (#213, #459) with the chat ID and join code they
 * were given -- both are needed, plus being signed in. Joining makes a new
 * local chat linked to theirs through the relay; each person's turns still run
 * on their own provider. Two panes, like the sign-in dialog.
 */
export function JoinChatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signedIn = useIsSignedIn();
  const [chatId, setChatId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Story #409: the relay disclosure, the first time this device joins.
  const [disclosure, setDisclosure] = useState<string | null>(null);
  // The local chat made for this join, kept while the disclosure is shown so
  // agreeing retries the same one instead of making a second.
  const pendingChat = useRef<string | null>(null);
  const chatIdRef = useRef<HTMLInputElement>(null);
  const chatIdFieldId = useId();
  const codeFieldId = useId();

  useEffect(() => {
    if (open) return;
    setChatId("");
    setCode("");
    setError(null);
    setDisclosure(null);
    setBusy(false);
    void discardPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const complete = chatId.replace(/-/g, "").length === 10 && code.replace(/-/g, "").length === 8;

  // A join that didn't go through leaves no empty chat behind.
  async function discardPending() {
    const id = pendingChat.current;
    pendingChat.current = null;
    if (id) await fetch(`/sessions/${id}`, { method: "DELETE" }).catch(() => null);
  }

  async function join(acknowledged: boolean) {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      let localChat = pendingChat.current;
      if (!localChat) {
        const created = await fetch("/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        if (created.status === 401) {
          openSignInDialog();
          return;
        }
        if (!created.ok) {
          setError(t("joinChat.errors.generic"));
          return;
        }
        localChat = ((await created.json()) as { session_id: string }).session_id;
        pendingChat.current = localChat;
      }
      const response = await fetch(`/sessions/${localChat}/relay/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relay_session_id: chatId, join_code: code, ...(acknowledged ? { acknowledged_disclosure: true } : {}) }),
      });
      if (response.status === 428) {
        const body = (await response.json().catch(() => ({}))) as { disclosure?: string };
        setDisclosure(body.disclosure ?? null);
        return;
      }
      if (response.status === 401) {
        await discardPending();
        openSignInDialog();
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        await discardPending();
        setDisclosure(null);
        setError(t(SHARE_ERRORS[body.error ?? ""] ?? "joinChat.errors.generic"));
        return;
      }
      pendingChat.current = null;
      onOpenChange(false);
      navigate(`/chat/${localChat}`);
    } catch {
      await discardPending();
      setError(t("joinChat.errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
      <DialogContent size="xl" motion="gentle" initialFocus={chatIdRef} className="!z-[120] max-w-[min(760px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="grid min-h-[420px] grid-cols-1 sm:grid-cols-2">
          <form
            className="flex flex-col gap-6 bg-[var(--redesign-primary-surface)] p-8"
            onSubmit={(event) => {
              event.preventDefault();
              void join(Boolean(disclosure));
            }}
          >
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-[18px] font-medium text-foreground">{t("joinChat.title")}</DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">{t("joinChat.description")}</DialogDescription>
            </div>

            {!signedIn ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-muted-foreground">{t("joinChat.signIn")}</p>
                <Button type="button" variant="primary" onClick={openSignInDialog}>
                  {t("shareChat.signInButton")}
                </Button>
              </div>
            ) : disclosure ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-medium text-foreground">{t("share.disclosure.title")}</h3>
                <p className="text-[13px] text-muted-foreground">{disclosure}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <label htmlFor={chatIdFieldId} className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                  {t("shareChat.chatId")}
                  <Input
                    ref={chatIdRef}
                    id={chatIdFieldId}
                    value={chatId}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="XXXXX-XXXXX"
                    className={FIELD_CLASS}
                    aria-invalid={Boolean(error) || undefined}
                    onChange={(event) => {
                      setChatId(formatTypedId(event.target.value, CHAT_ID_GROUPS));
                      setError(null);
                    }}
                  />
                </label>
                <label htmlFor={codeFieldId} className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                  {t("shareChat.joinCode")}
                  <Input
                    id={codeFieldId}
                    value={code}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="XXXX-XXXX"
                    className={FIELD_CLASS}
                    aria-invalid={Boolean(error) || undefined}
                    onChange={(event) => {
                      setCode(formatTypedId(event.target.value, CODE_GROUPS));
                      setError(null);
                    }}
                  />
                </label>
              </div>
            )}

            {error && (
              <p role="alert" className="text-[12px] text-destructive">
                <ErrorText message={error} />
              </p>
            )}

            {signedIn && (
              <div className="mt-auto flex items-center gap-2">
                <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={!complete || busy}>
                  {disclosure ? t("share.disclosure.agree") : t("joinChat.join")}
                </Button>
              </div>
            )}
          </form>

          <div aria-hidden="true" className="relative hidden overflow-hidden sm:block">
            <Backdrop />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
