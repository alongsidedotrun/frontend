import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsSignedIn } from "@/lib/auth";

// Joining a shared chat (Epic #413, story #412: the relay is the production path). The invite link
// arrives from the operating system (the app's own `alongside://join` link, which the desktop shell
// turns into a visit to /join?link=...) or is pasted here. Joining through the relay creates a brand new
// local chat and links it to the existing relay session (invite_token + relay_session_id) -- unlike the
// older host-embedded gateway's own link shape (still parsed below, for invites already sent before this
// story), which proxied a guest into the host's own remote chat instead. Either way this app's own
// backend does the joining with the person's account, so nothing about the account reaches this page: it
// only sees the outcome.
type Phase = "idle" | "joining" | "waiting" | "disclosure" | "failed";

type RelayInvite = { relayUrl: string; relaySessionId: string; token: string };

// What either the host-embedded gateway or the relay can refuse with, as text for the person joining.
// The relay's own invite refusals (invalid/expired/revoked/used-up token, story #408) are worded the same
// as the older gateway's session-token equivalents, so they share the same translated text.
const REFUSALS: Record<string, string> = {
  invalid_invite_link: "join.errors.invalidLink",
  invalid_session_token: "join.errors.invalidInvite",
  session_token_expired: "join.errors.expired",
  session_token_revoked: "join.errors.revoked",
  session_token_used_up: "join.errors.usedUp",
  join_denied: "join.errors.denied",
  not_hosting: "join.errors.notHosting",
  not_entitled: "join.errors.notEntitled",
  host_unreachable: "join.errors.unreachable",
  invalid_invite_token: "join.errors.invalidInvite",
  invite_expired: "join.errors.expired",
  invite_revoked: "join.errors.revoked",
  invite_used_up: "join.errors.usedUp",
  relay_unavailable: "join.errors.relayUnavailable",
};

function parseRelayLink(target: string): RelayInvite | null {
  try {
    const url = new URL(target);
    const relayUrl = url.searchParams.get("relay_url");
    const relaySessionId = url.searchParams.get("relay_session_id");
    const token = url.searchParams.get("token");
    if (!relayUrl || !relaySessionId || !token) return null;
    return { relayUrl, relaySessionId, token };
  } catch {
    return null;
  }
}

export function JoinPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isSignedIn = useIsSignedIn();
  const [link, setLink] = useState(params.get("link") ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  // Story #409: the disclosure a relay join's own first attempt came back with, shown until the person
  // agrees or cancels. Kept alongside which chat and invite it belongs to, so agreeing retries the exact
  // same attempt instead of creating a second local chat.
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const pendingRelayJoin = useRef<{ chatId: string; invite: RelayInvite } | null>(null);
  const polling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const startRelaySync = useCallback(
    async (chatId: string, invite: RelayInvite, acknowledgedDisclosure: boolean) => {
      const response = await fetch(`/sessions/${chatId}/relay/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relay_url: invite.relayUrl,
          relay_session_id: invite.relaySessionId,
          invite_token: invite.token,
          ...(acknowledgedDisclosure ? { acknowledged_disclosure: true } : {}),
        }),
      });
      if (cancelled.current) return;
      if (response.status === 428) {
        const body = (await response.json().catch(() => ({}))) as { disclosure?: string };
        pendingRelayJoin.current = { chatId, invite };
        setDisclosure(body.disclosure ?? null);
        setPhase("disclosure");
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(t(REFUSALS[body.error ?? ""] ?? "join.errors.generic"));
        setPhase("failed");
        return;
      }
      navigate(`/chat/${chatId}`, { replace: true });
    },
    [navigate, t]
  );

  const joinRelay = useCallback(
    async (invite: RelayInvite) => {
      const created = await fetch("/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (cancelled.current) return;
      if (created.status === 401) {
        setNeedsSignIn(true);
        setPhase("failed");
        return;
      }
      if (!created.ok) {
        setError(t("join.errors.generic"));
        setPhase("failed");
        return;
      }
      const { session_id: chatId } = (await created.json()) as { session_id: string };
      await startRelaySync(chatId, invite, false);
    },
    [startRelaySync, t]
  );

  const join = useCallback(
    async (target: string) => {
      setPhase("joining");
      setError(null);
      setNeedsSignIn(false);
      try {
        const relayInvite = parseRelayLink(target);
        if (relayInvite) {
          await joinRelay(relayInvite);
          return;
        }
        // The host-embedded gateway's own older link shape (gateway=&chat=&token=), kept working for
        // invites already sent before this story; the Share dialog no longer offers it (story #412).
        const response = await fetch("/remote/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ link: target }),
        });
        const body = (await response.json().catch(() => ({}))) as { status?: string; chat_id?: string; error?: string };
        if (cancelled.current) return;
        if (response.status === 200 && body.chat_id) {
          navigate(`/chat/${body.chat_id}`, { replace: true });
          return;
        }
        if (response.status === 202) {
          // The host has to let this person in; ask again until they do.
          setPhase("waiting");
          polling.current = setTimeout(() => void join(target), 2500);
          return;
        }
        if (response.status === 401) {
          setNeedsSignIn(true);
          setPhase("failed");
          return;
        }
        setError(t(REFUSALS[body.error ?? ""] ?? "join.errors.generic"));
        setPhase("failed");
      } catch {
        if (!cancelled.current) {
          setError(t("join.errors.generic"));
          setPhase("failed");
        }
      }
    },
    [joinRelay, navigate, t]
  );

  async function agreeToDisclosure() {
    const pending = pendingRelayJoin.current;
    if (!pending) return;
    setPhase("joining");
    setError(null);
    try {
      await startRelaySync(pending.chatId, pending.invite, true);
    } catch {
      if (!cancelled.current) {
        setError(t("join.errors.generic"));
        setPhase("failed");
      }
    }
  }

  // A link that arrived with the visit is followed straight away.
  useEffect(() => {
    cancelled.current = false;
    const incoming = params.get("link");
    if (incoming) void join(incoming);
    return () => {
      cancelled.current = true;
      if (polling.current) clearTimeout(polling.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase === "joining" || phase === "waiting";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold">{t("join.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("join.description")}</p>
      </div>

      {phase === "disclosure" ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">{t("share.disclosure.title")}</h3>
          {disclosure && <p className="text-sm text-muted-foreground">{disclosure}</p>}
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => void agreeToDisclosure()}>
              {t("share.disclosure.agree")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPhase("idle")}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (link.trim()) void join(link.trim());
          }}
        >
          <Input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="alongside://join?…"
            aria-label={t("join.linkLabel")}
            disabled={busy}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={busy || !link.trim()}>
              {t("join.button")}
            </Button>
            {phase === "waiting" && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  cancelled.current = true;
                  if (polling.current) clearTimeout(polling.current);
                  setPhase("idle");
                }}
              >
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </form>
      )}

      {phase === "waiting" && <p className="text-sm text-muted-foreground">{t("join.waiting")}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {needsSignIn && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{t("join.signInRequired")}</p>
          <div>
            <Button type="button" onClick={() => navigate("/auth", { state: { from: `${location.pathname}${location.search}` } })}>
              {isSignedIn ? t("join.tryAgain") : t("common.signIn")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
