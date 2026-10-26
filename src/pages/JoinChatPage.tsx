import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { JoinChatIcon } from "@/components/icons/join-chat-icon";
import { useIsSignedIn } from "@/lib/auth";
import { ErrorText } from "@/lib/error-code";
import { ShapeProvider } from "@/lib/shape-context";
import { SHARE_ERRORS, formatTypedId } from "@/lib/use-share";
import { openSignInDialog } from "@/lib/use-sign-in";
import { cn } from "@/lib/utils";

const CHAT_ID_GROUPS = [5, 5] as const;
const CODE_GROUPS = [4, 4] as const;

/**
 * Join someone else's chat (#213, #459) with the chat ID and join code they were given -- both are
 * needed, plus being signed in. Joining makes a new local chat linked to theirs through the relay; each
 * person's turns still run on their own provider. A page (the sidebar's Join chat), laid out like the New
 * page's "Connect a provider to start": a mark, a title and what to do, then the fields and one button.
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
      navigate(`/chat/${localChat}`);
    } catch {
      await discardPending();
      setError(t("joinChat.errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-background @container">
      <div className="absolute inset-0 flex items-center justify-center overflow-y-auto px-3 sm:px-5">
        <form
          className="flex w-full max-w-[420px] flex-col items-center gap-4 text-center"
          onSubmit={(event) => {
            event.preventDefault();
            if (!signedIn) return openSignInDialog();
            void join(Boolean(disclosure));
          }}
        >
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-border bg-white text-foreground shadow-[0_1px_2px_rgb(0_0_0_/_0.06)] dark:bg-[var(--surface-4)]">
            <JoinChatIcon size={18} />
          </span>
          <div>
            <h1 className="text-[length:clamp(15px,calc(12.55px+0.545cqw),18px)] font-normal text-foreground">{t("joinChat.title")}</h1>
            <p className="mt-1.5 text-[length:var(--redesign-chat-text)] text-muted-foreground">{t(signedIn ? "joinChat.signedInDescription" : "joinChat.signIn")}</p>
          </div>
          {disclosure ? (
            <div className={cn("flex w-full max-w-[360px] flex-col gap-3 p-4 text-left", SHELL_RADIUS, SHELL_SURFACE)}>
              <h3 className="text-[13px] font-medium text-foreground">{t("share.disclosure.title")}</h3>
              <p className="text-[12px] text-muted-foreground">{disclosure}</p>
            </div>
          ) : (
            // The identifier and join code they were given, laid out like Invite members shows them.
            <div className="flex w-full max-w-[360px] flex-col gap-2 text-left">
              <ShellField label={t("shareChat.chatId")} htmlFor={chatIdFieldId}>
                <input
                  ref={chatIdRef}
                  id={chatIdFieldId}
                  autoFocus={signedIn}
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
          <ShapeProvider defaultShape="pill">
            <Button
              type="submit"
              variant="primary"
              className="h-9 px-5"
              leadingIcon={signedIn ? JoinChatIcon : undefined}
              disabled={signedIn && (!complete || busy)}
            >
              {!signedIn ? t("shareChat.signInButton") : disclosure ? t("share.disclosure.agree") : t("joinChat.join")}
            </Button>
          </ShapeProvider>
        </form>
      </div>
    </div>
  );
}
