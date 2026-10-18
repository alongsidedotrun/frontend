import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { useIsSignedIn } from "@/lib/auth";
import { ErrorText } from "@/lib/error-code";
import { SHARE_ERRORS, formatTypedId } from "@/lib/use-share";
import { openSignInDialog } from "@/lib/use-sign-in";
import { cn } from "@/lib/utils";

const CHAT_ID_GROUPS = [5, 5] as const;
const CODE_GROUPS = [4, 4] as const;

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

  const formId = "join-chat-form";
  return (
    <ShellDialog
      centered
      open={open}
      onOpenChange={onOpenChange}
      initialFocus={chatIdRef}
      title={t("joinChat.title")}
      description={t(signedIn ? "joinChat.signedInDescription" : "joinChat.signIn")}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={() => onOpenChange(false)}
          primary={signedIn
            ? { label: disclosure ? t("share.disclosure.agree") : t("joinChat.join"), type: "submit", form: formId, disabled: !complete || busy }
            : { label: t("shareChat.signInButton"), onClick: openSignInDialog }}
        />
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void join(Boolean(disclosure));
        }}
      >
        {disclosure ? (
          <div className={cn("flex flex-col gap-3 p-4", SHELL_RADIUS, SHELL_SURFACE)}>
            <h3 className="text-[13px] font-medium text-foreground">{t("share.disclosure.title")}</h3>
            <p className="text-[12px] text-muted-foreground">{disclosure}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* The identifier and join code they were given, laid out like Invite members shows them. */}
            <ShellField label={t("shareChat.chatId")} htmlFor={chatIdFieldId}>
              <input
                ref={chatIdRef}
                id={chatIdFieldId}
                value={chatId}
                autoComplete="off"
                spellCheck={false}
                disabled={!signedIn}
                className={cn(SHELL_FIELD_INPUT, "font-mono tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-50")}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => {
                  setChatId(formatTypedId(event.target.value, CHAT_ID_GROUPS));
                  setError(null);
                }}
              />
            </ShellField>
            <ShellField label={t("shareChat.joinCode")} htmlFor={codeFieldId}>
              <input
                id={codeFieldId}
                value={code}
                autoComplete="off"
                spellCheck={false}
                disabled={!signedIn}
                className={cn(SHELL_FIELD_INPUT, "font-mono tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-50")}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => {
                  setCode(formatTypedId(event.target.value, CODE_GROUPS));
                  setError(null);
                }}
              />
            </ShellField>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[12px] text-destructive">
            <ErrorText message={error} />
          </p>
        )}
      </form>
    </ShellDialog>
  );
}
