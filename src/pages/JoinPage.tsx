import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsSignedIn } from "@/lib/auth";

// Joining a chat someone else is hosting (Epic #335). The invite link arrives from the operating
// system (the app's own `alongside://join` link, which the desktop shell turns into a visit to
// /join?link=...) or is pasted here. This app's own backend does the joining with the person's
// account, so nothing about the account reaches this page: it only sees the outcome.
type Phase = "idle" | "joining" | "waiting" | "failed";

// What the host's gateway can refuse with, as text for the person joining.
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
};

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
  const polling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const join = useCallback(
    async (target: string) => {
      setPhase("joining");
      setError(null);
      setNeedsSignIn(false);
      try {
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
    [navigate, t]
  );

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
