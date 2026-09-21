import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export type JoinRequest = { id: string; display_name: string };

// The host's side of joining (Epic #338, story #339): people who asked to join this chat and are
// waiting for a decision. Shown only in the host's own app; guests never see the buttons. An
// approved person joins as an editor, or as a reader when read-only is chosen; a person is never
// let in as host.
export function JoinRequests({ sessionId, requests, onDecided }: { sessionId: string; requests: JoinRequest[]; onDecided: (id: string) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (requests.length === 0) return null;

  async function decide(id: string, action: "approve" | "deny", role?: "reader") {
    setBusy(id);
    setFailed(false);
    try {
      const response = await fetch(`/sessions/${sessionId}/join-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role ? { role } : {}),
      });
      if (response.ok || response.status === 404) onDecided(id);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto mb-2 flex w-full max-w-3xl flex-col gap-2">
      {requests.map((request) => (
        <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <span className="text-sm text-foreground">{t("chat.joinRequest.message", { name: request.display_name })}</span>
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" disabled={busy === request.id} onClick={() => void decide(request.id, "approve")}>
              {t("chat.joinRequest.approve")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy === request.id} onClick={() => void decide(request.id, "approve", "reader")}>
              {t("chat.joinRequest.approveReader")}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy === request.id} onClick={() => void decide(request.id, "deny")}>
              {t("chat.joinRequest.deny")}
            </Button>
          </div>
        </div>
      ))}
      {failed && <p className="text-xs text-destructive">{t("chat.joinRequest.failed")}</p>}
    </div>
  );
}
