import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Sharing = { shared: boolean; gateway: string | null };
type Invite = { id: string; role: "editor" | "reader"; expires_at: number; max_uses: number | null; uses: number; status: "active" | "expired" | "used_up" | "revoked" };
type Created = { link: string };

const EXPIRIES = [
  { seconds: 3600, key: "share.expiry.hour" },
  { seconds: 86400, key: "share.expiry.day" },
  { seconds: 604800, key: "share.expiry.week" },
] as const;

const SELECT_CLASS =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30";

// The host's sharing controls (Epic #378, story #380): start or stop sharing this chat, create an
// invite (role, expiry, optional single use) and copy its link, list the chat's invites and
// revoke them. The link is shown once, at creation: only the token's hash is stored.
export function ShareDialog({ sessionId, open, onOpenChange }: { sessionId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"editor" | "reader">("editor");
  const [ttl, setTtl] = useState<number>(86400);
  const [singleUse, setSingleUse] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const status = (await (await fetch(`/sessions/${sessionId}/sharing`)).json()) as Sharing;
      setSharing(status);
      if (status.shared) {
        const response = await fetch(`/sessions/${sessionId}/invites`);
        setInvites(response.ok ? ((await response.json()) as Invite[]) : []);
      } else {
        setInvites([]);
      }
    } catch {
      setError(t("share.errors.generic"));
    }
  }, [sessionId, t]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreated(null);
    setCopied(false);
    void load();
  }, [open, load]);

  const startErrors: Record<string, string> = {
    sign_in_required: "share.errors.signIn",
    not_entitled: "share.errors.notEntitled",
    identity_unavailable: "share.errors.identity",
    gateway_unavailable: "share.errors.gateway",
    not_the_owner: "share.errors.notOwner",
  };

  async function startSharing() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/host/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(t(startErrors[body.error ?? ""] ?? "share.errors.generic"));
      }
      await load();
    } catch {
      setError(t("share.errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    setBusy(true);
    setCreated(null);
    try {
      await fetch("/host/stop", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch(`/sessions/${sessionId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, ttl_seconds: ttl, max_uses: singleUse ? 1 : null }),
      });
      if (!response.ok) {
        setError(t("share.errors.invite"));
        return;
      }
      setCreated((await response.json()) as Created);
      await load();
    } catch {
      setError(t("share.errors.invite"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/sessions/${sessionId}/invites/${id}/revoke`, { method: "POST" });
    await load();
  }

  function copy() {
    if (!created) return;
    void navigator.clipboard?.writeText(created.link).then(() => setCopied(true));
  }

  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {sharing && !sharing.shared && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("share.notSharing")}</p>
            <div>
              <Button type="button" disabled={busy} onClick={() => void startSharing()}>
                {t("share.start")}
              </Button>
            </div>
          </div>
        )}

        {sharing?.shared && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t("share.on", { address: sharing.gateway ?? "" })}</p>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void stopSharing()}>
                {t("share.stop")}
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-foreground">{t("share.invite.title")}</h3>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="share-role">
                  {t("share.invite.role")}
                  <select id="share-role" className={SELECT_CLASS} value={role} onChange={(event) => setRole(event.target.value as "editor" | "reader")}>
                    <option value="editor">{t("share.role.editor")}</option>
                    <option value="reader">{t("share.role.reader")}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="share-expiry">
                  {t("share.invite.expires")}
                  <select id="share-expiry" className={SELECT_CLASS} value={ttl} onChange={(event) => setTtl(Number(event.target.value))}>
                    {EXPIRIES.map((option) => (
                      <option key={option.seconds} value={option.seconds}>
                        {t(option.key)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 pb-1.5 text-xs text-muted-foreground" htmlFor="share-single">
                  <input id="share-single" type="checkbox" checked={singleUse} onChange={(event) => setSingleUse(event.target.checked)} />
                  {t("share.invite.singleUse")}
                </label>
                <Button type="button" size="sm" disabled={busy} onClick={() => void createInvite()}>
                  {t("share.invite.create")}
                </Button>
              </div>
              {created && (
                <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5">
                  <p className="text-xs text-muted-foreground">{t("share.invite.created")}</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={created.link} onFocus={(event) => event.currentTarget.select()} aria-label={t("share.invite.copy")} className={`${SELECT_CLASS} min-w-0 flex-1 font-mono text-xs`} />
                    <Button type="button" size="sm" variant="outline" onClick={copy}>
                      {copied ? t("share.invite.copied") : t("share.invite.copy")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-foreground">{t("share.invites.title")}</h3>
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("share.invites.none")}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {invites.map((invite) => (
                    <li key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-foreground">
                          {t(`share.role.${invite.role}`)} · {t(`share.status.${invite.status}`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("share.invites.expires", { time: formatter.format(new Date(invite.expires_at * 1000)) })} ·{" "}
                          {invite.max_uses === null ? t("share.invites.usedCount", { used: invite.uses }) : t("share.invites.usedOf", { used: invite.uses, max: invite.max_uses })}
                        </span>
                      </span>
                      {invite.status === "active" && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => void revoke(invite.id)}>
                          {t("share.invites.revoke")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
