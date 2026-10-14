import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/lib/error-code";
import { useJoinRequests, type WaitingJoin } from "@/lib/use-join-requests";

/**
 * People waiting to be let into a shared chat (#460), in the sidebar wherever
 * the owner or an editor is: "Alice wants to join Relay test", with Let in and
 * Deny. Joining needs one of them to agree, even with the right code; the
 * request waits up to 7 days, so it's here whenever the app is next open.
 */
export function JoinRequestsCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const { requests, decide } = useJoinRequests(null, enabled);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (requests.length === 0 && !failed) return null;

  async function act(request: WaitingJoin, action: "approve" | "deny") {
    setBusy(request.request_id);
    setFailed(null);
    if (!(await decide(request, action))) setFailed(t("joinRequests.errors.decide", { name: request.name }));
    setBusy(null);
  }

  return (
    <section
      aria-label={t("joinRequests.title")}
      className="mb-[var(--redesign-sidebar-section-gap)] flex flex-col gap-2 rounded-[var(--redesign-sidebar-footer-onboarding-radius)] border border-[var(--redesign-sidebar-footer-onboarding-border)] px-[var(--redesign-quick-actions-padding)] pt-2 pb-2.5 shadow-[var(--redesign-sidebar-footer-onboarding-shadow)]"
      style={{ backgroundColor: "var(--redesign-getting-started-surface)" }}
    >
      <h2 className="text-[length:var(--redesign-font-size-base)] font-medium text-foreground">{t("joinRequests.title")}</h2>
      <ul className="flex flex-col gap-2">
        {requests.map((request) => (
          <li key={request.request_id} className="flex flex-col gap-1.5">
            <p className="text-[12px] leading-snug text-muted-foreground">
              {t("joinRequests.wantsToJoin", { name: request.name, chat: request.chat_name || t("shell.untitledChat") })}
            </p>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="primary" size="compact" className="flex-1" disabled={busy === request.request_id} onClick={() => void act(request, "approve")}>
                {t("joinRequests.letIn")}
              </Button>
              <Button type="button" variant="tertiary" size="compact" disabled={busy === request.request_id} onClick={() => void act(request, "deny")}>
                {t("joinRequests.deny")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {failed && (
        <p role="alert" className="text-[12px] text-destructive">
          <ErrorText message={failed} />
        </p>
      )}
    </section>
  );
}
