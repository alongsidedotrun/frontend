import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ShellDialogActions, ShellField, ShellPage, SHELL_CARD_BOX, SHELL_FIELD_INPUT } from "@/components/design-system/shell-dialog";
import { useIsSignedIn } from "@/lib/auth";
import { ErrorText } from "@/lib/error-code";
import { SHARE_ERRORS, formatTypedId } from "@/lib/use-share";
import { openSignInDialog } from "@/lib/use-sign-in";
import { cn } from "@/lib/utils";
import { CHATS_API } from "@/lib/chats-api";

const CHAT_ID_GROUPS = [5, 5] as const;
const CODE_GROUPS = [4, 4] as const;

/**
 * Join someone else's chat (#213, #459) with the chat ID and join code they were given -- both are
 * needed, plus being signed in. Joining makes a new local chat linked to theirs through the relay; each
 * person's turns still run on their own provider. A page (the sidebar's Join chat), in the same card as
 * Invite members.
 */
export function JoinChatPage() {
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
  const formId = useId();

  // Leaving the page drops a join that didn't go through.
  useEffect(
    () => () => {
      void discardPending();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const complete = chatId.replace(/-/g, "").length === 10 && code.replace(/-/g, "").length === 8;

  // A join that didn't go through leaves no empty chat behind.
  async function discardPending() {
    const id = pendingChat.current;
    pendingChat.current = null;
    if (id) await fetch(`${CHATS_API}/${id}`, { method: "DELETE" }).catch(() => null);
  }

  async function join(acknowledged: boolean) {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      let localChat = pendingChat.current;
      if (!localChat) {
        const created = await fetch(CHATS_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
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
      const response = await fetch(`${CHATS_API}/${localChat}/relay/start`, {
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
      navigate(`/chat/${localChat}`);
    } catch {
      await discardPending();
      setError(t("joinChat.errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  // Invite members' counterpart, so the same card: the identifier and join code they were given, then
  // Cancel and Join (Sign in when signed out).
  return (
    <ShellPage
      open
      onOpenChange={() => navigate("/")}
      title={t("joinChat.title")}
      description={t(signedIn ? "joinChat.signedInDescription" : "joinChat.signIn")}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={() => navigate("/")}
          primary={{
            label: !signedIn ? t("joinChat.signInButton") : disclosure ? t("share.disclosure.agree") : t("joinChat.join"),
            type: "submit",
            form: formId,
            disabled: signedIn && (!complete || busy),
            loading: busy,
          }}
        />
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!signedIn) return openSignInDialog();
          void join(Boolean(disclosure));
        }}
      >
        {disclosure ? (
          <div className={cn("flex flex-col gap-2 p-4", SHELL_CARD_BOX)}>
            <h3 className="text-ui font-medium text-foreground">{t("share.disclosure.title")}</h3>
            <p className="text-ui-sm text-muted-foreground">{disclosure}</p>
          </div>
        ) : (
          <>
            <ShellField label={t("shareChat.chatId")} htmlFor={chatIdFieldId}>
              <input
                ref={chatIdRef}
                id={chatIdFieldId}
                autoFocus={signedIn}
                value={chatId}
                autoComplete="off"
                spellCheck={false}
                disabled={!signedIn}
                placeholder={signedIn ? undefined : t("shareChat.signedOutPlaceholder")}
                className={cn(SHELL_FIELD_INPUT, signedIn && "font-mono tracking-[0.1em]", "disabled:cursor-not-allowed")}
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
                className={cn(SHELL_FIELD_INPUT, "font-mono tracking-[0.1em] disabled:cursor-not-allowed")}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => {
                  setCode(formatTypedId(event.target.value, CODE_GROUPS));
                  setError(null);
                }}
              />
            </ShellField>
          </>
        )}
        {error && (
          <p role="alert" className="px-1 text-ui-sm text-destructive">
            <ErrorText message={error} />
          </p>
        )}
      </form>
    </ShellPage>
  );
}
