import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useIsSignedIn } from "@/lib/auth";
import { ErrorText } from "@/lib/error-code";
import { SHARE_ERRORS } from "@/lib/use-share";
import { openSignInDialog } from "@/lib/use-sign-in";
import { cn } from "@/lib/utils";

type Status = { syncing: boolean; chat_id: string | null };
type JoinCode = { code?: string; status: "active" | "expired" | "used"; expires_at: number } | null;
type Member = { id: string; name: string; role: "owner" | "editor" | "reader"; online: boolean };
type Phase = "loading" | "idle" | "disclosure" | "sharing" | "resumeFailed";

// While open and sharing, the code's status and who has joined are re-read
// this often, so a code being used shows up without reopening.
const REFRESH_MS = 5000;

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function errorKeyOf(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return SHARE_ERRORS[body.error ?? ""] ?? fallback;
}

/**
 * Share a chat (#213, #459): two panes, like the workspace dialogs. Left:
 * sign in, agree to the relay disclosure once (#409), start sharing, then the
 * chat ID and a join code (single use, 15 minutes) to give the other person.
 * Right: who has access -- the people in the chat and the live code, with
 * Revoke. Joining needs both the chat ID and the code (Join chat dialog).
 */
export function ShareChatDialog({ sessionId, open, onOpenChange }: { sessionId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const signedIn = useIsSignedIn();
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<JoinCode>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"id" | "code" | null>(null);
  const [now, setNow] = useState(nowSeconds);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshAccess = useCallback(async () => {
    if (!sessionId) return;
    const [codeResponse, membersResponse] = await Promise.all([
      fetch(`/sessions/${sessionId}/relay/code`).catch(() => null),
      fetch(`/sessions/${sessionId}/relay/members`).catch(() => null),
    ]);
    if (codeResponse?.ok) setCode((await codeResponse.json()) as JoinCode);
    if (membersResponse?.ok) setMembers((await membersResponse.json()) as Member[]);
  }, [sessionId]);

  const load = useCallback(async () => {
    if (!sessionId) return null;
    try {
      const current = (await (await fetch(`/sessions/${sessionId}/relay/status`)).json()) as Status;
      setStatus(current);
      if (current.syncing) {
        setPhase("sharing");
        await refreshAccess();
      } else {
        setPhase((previous) => (previous === "disclosure" || previous === "resumeFailed" ? previous : "idle"));
      }
      return current;
    } catch {
      setError(t("shareChat.errors.start"));
      setPhase("idle");
      return null;
    }
  }, [sessionId, refreshAccess, t]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDisclosure(null);
    setCode(null);
    setMembers([]);
    setPhase("loading");
    void load();
  }, [open, load, signedIn]);

  // Keep "Who has access" and the code's status current while sharing.
  useEffect(() => {
    if (!open || phase !== "sharing") return;
    const timer = setInterval(() => void refreshAccess(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, phase, refreshAccess]);

  // The code's countdown.
  const codeActive = code?.status === "active" && code.expires_at > now;
  useEffect(() => {
    if (!open || code?.status !== "active") return;
    setNow(nowSeconds());
    const timer = setInterval(() => setNow(nowSeconds()), 1000);
    return () => clearInterval(timer);
  }, [open, code]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  // Starts sharing. A chat shared before keeps its chat ID (`resume`), so
  // people who joined earlier stay linked; a brand new one gets a new ID.
  async function start(acknowledged: boolean, resume = Boolean(status?.chat_id)) {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/sessions/${sessionId}/relay/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(resume && status?.chat_id ? { relay_session_id: status.chat_id } : {}),
          ...(acknowledged ? { acknowledged_disclosure: true } : {}),
        }),
      });
      if (response.status === 428) {
        const body = (await response.json().catch(() => ({}))) as { disclosure?: string };
        setDisclosure(body.disclosure ?? null);
        setPhase("disclosure");
        return;
      }
      if (response.status === 401) {
        openSignInDialog();
        return;
      }
      if (!response.ok) {
        setError(t(await errorKeyOf(response, "shareChat.errors.start")));
        return;
      }
      setDisclosure(null);
      setPhase("loading");
      // Resuming reconnects in the background; if the relay has since dropped
      // the chat (nobody connected for a while), it doesn't stay connected.
      const current = await load();
      if (resume && current && !current.syncing) setPhase("resumeFailed");
      else if (current?.syncing && !code) await makeCode();
    } catch {
      setError(t("shareChat.errors.start"));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await fetch(`/sessions/${sessionId}/relay/stop`, { method: "POST" });
      setCode(null);
      setMembers([]);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function makeCode() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/sessions/${sessionId}/relay/code`, { method: "POST" });
      if (!response.ok) {
        setError(t(await errorKeyOf(response, "shareChat.errors.code")));
        return;
      }
      const made = (await response.json()) as { code: string; expires_at: number };
      setCode({ code: made.code, status: "active", expires_at: made.expires_at });
    } catch {
      setError(t("shareChat.errors.code"));
    } finally {
      setBusy(false);
    }
  }

  // Removes someone: the relay disconnects them at once and they can't come
  // back without a new code. What they already have stays on their device.
  async function removeMember(member: Member) {
    if (!sessionId) return;
    setError(null);
    const response = await fetch(`/sessions/${sessionId}/relay/members/${encodeURIComponent(member.id)}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setError(t("shareChat.errors.remove", { name: member.name }));
      return;
    }
    setMembers((current) => current.filter((m) => m.id !== member.id));
    await refreshAccess();
  }

  async function revokeCode() {
    if (!sessionId) return;
    await fetch(`/sessions/${sessionId}/relay/code`, { method: "DELETE" }).catch(() => null);
    setCode(null);
    await refreshAccess();
  }

  function copy(kind: "id" | "code", value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(kind);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(null), 1500);
    });
  }

  const minutesLeft = code ? Math.max(1, Math.ceil((code.expires_at - now) / 60)) : 0;

  return (
    // !z-[120]: above the app top bar (z-[110]), like the other shell dialogs.
    <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
      <DialogContent size="xl" motion="gentle" className="!z-[120] max-w-[min(760px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="grid min-h-[420px] grid-cols-1 sm:grid-cols-2">
          <div className="flex flex-col gap-6 bg-[var(--redesign-primary-surface)] p-8">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-[18px] font-medium text-foreground">{t("shareChat.title")}</DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">{t("shareChat.description")}</DialogDescription>
            </div>

            {!signedIn ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-muted-foreground">{t("shareChat.signIn")}</p>
                <Button type="button" variant="primary" onClick={openSignInDialog}>
                  {t("shareChat.signInButton")}
                </Button>
              </div>
            ) : phase === "disclosure" ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-medium text-foreground">{t("share.disclosure.title")}</h3>
                <p className="text-[13px] text-muted-foreground">{disclosure}</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="tertiary" disabled={busy} onClick={() => { setDisclosure(null); setPhase("idle"); }}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="button" variant="primary" className="flex-1" disabled={busy} onClick={() => void start(true)}>
                    {t("share.disclosure.agree")}
                  </Button>
                </div>
              </div>
            ) : phase === "resumeFailed" ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-muted-foreground">{t("shareChat.resumeFailed")}</p>
                <Button type="button" variant="primary" disabled={busy} onClick={() => void start(false, false)}>
                  {t("shareChat.newChatId")}
                </Button>
              </div>
            ) : phase === "sharing" && status?.chat_id ? (
              <div className="flex flex-col gap-4">
                <CopyField label={t("shareChat.chatId")} value={status.chat_id} copied={copied === "id"} onCopy={() => copy("id", status.chat_id!)} />
                {codeActive && code?.code ? (
                  <div className="flex flex-col gap-1.5">
                    <CopyField label={t("shareChat.joinCode")} value={code.code} copied={copied === "code"} onCopy={() => copy("code", code.code!)} />
                    <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                      <span>{t("shareChat.codeExpires", { count: minutesLeft })}</span>
                      <button type="button" disabled={busy} onClick={() => void makeCode()} className="underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50">
                        {t("shareChat.newCode")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] text-muted-foreground">{t("shareChat.joinCode")}</span>
                    {codeActive && <p className="text-[12px] text-muted-foreground">{t("shareChat.codeHidden")}</p>}
                    <Button type="button" variant="tertiary" disabled={busy} onClick={() => void makeCode()}>
                      {t(codeActive ? "shareChat.newCode" : "shareChat.makeCode")}
                    </Button>
                  </div>
                )}
                <p className="text-[12px] text-muted-foreground">{t("shareChat.howToJoin")}</p>
              </div>
            ) : phase === "idle" ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-muted-foreground">{t("shareChat.notSharing")}</p>
                <Button type="button" variant="primary" disabled={busy} onClick={() => void start(false)}>
                  {t("shareChat.start")}
                </Button>
              </div>
            ) : null}

            {error && (
              <p role="alert" className="text-[12px] text-destructive">
                <ErrorText message={error} />
              </p>
            )}

            <div className="mt-auto flex items-center gap-2">
              <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
              {signedIn && phase === "sharing" && (
                <Button type="button" variant="tertiary" className="ml-auto text-destructive" disabled={busy} onClick={() => void stop()}>
                  {t("shareChat.stop")}
                </Button>
              )}
            </div>
          </div>

          <WhoHasAccess members={members} code={code} now={now} sharing={phase === "sharing"} onRevoke={() => void revokeCode()} onRemove={(member) => void removeMember(member)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A read-only value people read out or paste, with a copy button. */
function CopyField({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      {/* 44px tall, so its radius is 44 × 8/27 (STYLE_GUIDE.md: corner radius). */}
      <div className="flex h-11 items-center gap-2 rounded-[calc(44px*8/27)] border border-[var(--redesign-sidebar-border)] bg-background pr-1.5 pl-3.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[15px] tracking-[0.12em] text-foreground select-all">{value}</span>
        <Button type="button" variant="ghost" size="icon-compact" aria-label={copied ? t("shareChat.copied") : t("shareChat.copy", { what: label })} onClick={onCopy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

/** The right pane: the people in the chat, and the live join code with Revoke. */
function WhoHasAccess({ members, code, now, sharing, onRevoke, onRemove }: { members: Member[]; code: JoinCode; now: number; sharing: boolean; onRevoke: () => void; onRemove: (member: Member) => void }) {
  const { t } = useTranslation();
  // The member whose removal is waiting for a second click.
  const [confirming, setConfirming] = useState<string | null>(null);
  const codeState = !code ? "none" : code.status === "active" && code.expires_at <= now ? "expired" : code.status;
  return (
    <div className="flex flex-col gap-4 border-t border-[var(--redesign-sidebar-border)] bg-[var(--redesign-sidebar-surface)] p-8 sm:border-t-0 sm:border-l">
      <h3 className="text-[13px] font-medium text-foreground">{t("shareChat.access.title")}</h3>
      {!sharing ? (
        <p className="text-[13px] text-muted-foreground">{t("shareChat.access.notSharing")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {members.map((member) => (
              <li key={member.id} className="group/member flex h-8 items-center gap-2.5">
                <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
                  {member.name.slice(0, 1).toUpperCase()}
                  <span
                    aria-hidden="true"
                    className={cn("absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-[var(--redesign-sidebar-surface)]", member.online ? "bg-emerald-500" : "bg-muted-foreground/40")}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{member.name}</span>
                {confirming === member.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="compact" onClick={() => setConfirming(null)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="compact"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setConfirming(null);
                        onRemove(member);
                      }}
                    >
                      {t("shareChat.access.confirmRemove")}
                    </Button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
                    {t(member.role === "owner" ? "share.role.host" : `share.role.${member.role}`)} · {member.online ? t("presence.online") : t("presence.offline")}
                    {member.role !== "owner" && (
                      <Button type="button" variant="ghost" size="compact" aria-label={t("shareChat.access.removeName", { name: member.name })} onClick={() => setConfirming(member.id)}>
                        {t("shareChat.access.remove")}
                      </Button>
                    )}
                  </span>
                )}
              </li>
            ))}
            {members.length <= 1 && <li className="text-[12px] text-muted-foreground">{t("shareChat.access.onlyYou")}</li>}
          </ul>
          <div className="flex h-8 items-center justify-between gap-2 border-t border-[var(--redesign-sidebar-border)] pt-3">
            <span className="text-[13px] text-foreground">{t("shareChat.joinCode")}</span>
            <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
              {t(`shareChat.access.code.${codeState}`)}
              {codeState === "active" && (
                <Button type="button" variant="ghost" size="compact" onClick={onRevoke}>
                  {t("shareChat.access.revoke")}
                </Button>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
