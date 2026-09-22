import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Status = { syncing: boolean; relay_url: string | null };
type Invite = { id: string; role: "editor" | "reader"; expires_at: number; max_uses: number | null; uses: number; status: "active" | "expired" | "used_up" | "revoked" };
type Created = { link: string };

const EXPIRIES = [
  { seconds: 3600, key: "share.expiry.hour" },
  { seconds: 86400, key: "share.expiry.day" },
  { seconds: 604800, key: "share.expiry.week" },
] as const;

const SELECT_CLASS =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30";

const START_ERRORS: Record<string, string> = {
  sign_in_required: "share.errors.signIn",
  already_syncing: "share.errors.alreadySharing",
  relay_unavailable: "share.errors.relayUnavailable",
  no_such_session: "share.errors.generic",
};

// The host's sharing controls (Epic #413, story #412): the relay is the production path, so this starts
// or stops this chat's relay sync (never the host-embedded gateway, which stays available only through
// ALONGSIDE_TRANSPORT for development), creates an invite (role, expiry, optional single use) and copies
// its link, lists the chat's invites and revokes them. The link is shown once, at creation: only the
// token's hash is ever stored, at the relay.
export function ShareDialog({ sessionId, open, onOpenChange }: { sessionId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<Status | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"editor" | "reader">("editor");
  const [ttl, setTtl] = useState<number>(86400);
  const [singleUse, setSingleUse] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  // Story #409: the disclosure text a start attempt came back with, shown until the person agrees to it
  // or cancels; null the rest of the time, including once a chat's consent is already on record and
  // starting never needs to ask again.
  const [disclosure, setDisclosure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/sessions/${sessionId}/relay/status`);
      const current = (await response.json()) as Status;
      setStatus(current);
      if (current.syncing) {
        const invitesResponse = await fetch(`/sessions/${sessionId}/relay/invites`);
        setInvites(invitesResponse.ok ? ((await invitesResponse.json()) as Invite[]) : []);
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
    setDisclosure(null);
    void load();
  }, [open, load]);

  async function startSharing(acknowledgedDisclosure: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/sessions/${sessionId}/relay/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acknowledgedDisclosure ? { acknowledged_disclosure: true } : {}),
      });
      if (response.status === 428) {
        const body = (await response.json().catch(() => ({}))) as { disclosure?: string };
        setDisclosure(body.disclosure ?? null);
        return;
      }
      setDisclosure(null);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(t(START_ERRORS[body.error ?? ""] ?? "share.errors.generic"));
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
      await fetch(`/sessions/${sessionId}/relay/stop`, { method: "POST" });
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
      const response = await fetch(`/sessions/${sessionId}/relay/invites`, {
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
    await fetch(`/sessions/${sessionId}/relay/invites/${id}/revoke`, { method: "POST" });
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

        {disclosure && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">{t("share.disclosure.title")}</h3>
            <p className="text-sm text-muted-foreground">{disclosure}</p>
            <div className="flex items-center gap-2">
              <Button type="button" disabled={busy} onClick={() => void startSharing(true)}>
                {t("share.disclosure.agree")}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setDisclosure(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {!disclosure && status && !status.syncing && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("share.notSharing")}</p>
            <div>
              <Button type="button" disabled={busy} onClick={() => void startSharing(false)}>
                {t("share.start")}
              </Button>
            </div>
          </div>
        )}

        {!disclosure && status?.syncing && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t("share.on")}</p>
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
