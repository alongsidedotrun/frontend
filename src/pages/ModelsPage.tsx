import { useEffect } from "react";
import { PageContent } from "@/components/page-content";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ErrorText } from "@/lib/error-code";
import { PROVIDER_DISPLAY, ProviderIcon } from "@/lib/quick-chat-models";
import {
  USAGE_PROVIDERS,
  useAllProviderUsage,
  useUsageStats,
  usageRemainingTone,
  USAGE_TONE_BAR_CLASS,
  formatResetCountdown,
  type ProviderUsageLimit,
} from "@/lib/use-usage";

// provider_usage.rs's own needs_auth detail strings ("Sign in with `codex
// login` to see usage.") are written with backtick-quoted commands, same
// markdown convention every other real command mention in this codebase
// uses -- but this page rendered them as plain text, so the literal
// backtick characters showed up on screen instead of styling the command.
// Real bug, confirmed directly ("the `` still there in the description").
// A tiny local split/wrap instead of pulling in a real markdown renderer
// for one command-in-a-sentence case -- this only ever needs to handle
// backend's own plain "text `code` more text" shape, not general markdown.
function renderWithInlineCode(text: string) {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
        {part}
      </code>
    ) : (
      part
    )
  );
}

// The avatar dropdown's own "Provider usage" rows (nav-user.tsx) link
// here -- the full breakdown those bars are just a teaser for, matching
// Synara's own dedicated usage page instead of trying to cram this into a
// popup. Story: alongsidedotrun/private#217.
//
// Real numbers -- each provider's own rate-limit/quota windows, read from
// that provider's own CLI-login credential and usage endpoint directly
// (backend/src/provider_usage.rs), the same mechanism Synara's own
// provider-usage fetchers use. Account-only: a provider connected via a
// pasted API key has no usage endpoint at all (that connection path is
// disabled and hidden, settings-overlay.tsx's own comment has the full
// reasoning), so it shows the same "sign in" state as one never connected.

// Real provider data only -- per explicit request ("we don't know that
// this is the expected tracker, does the provider say what's expected? I
// don't want to grab this assumption from thin air"): this used to also
// show a marker tick and a reserve/deficit/ETA line derived from an
// even-usage-across-the-window assumption none of Claude/Codex/
// Antigravity's own APIs actually state -- removed entirely rather than
// keep presenting a guess as if the provider reported it. What's left is
// only what the provider's own response gives: percent used/left, and the
// real reset time.
function UsageLimitRow({ limit }: { limit: ProviderUsageLimit }) {
  const remainingPercent = Math.min(100, Math.max(0, limit.used_percent !== undefined ? 100 - limit.used_percent : 100));
  const remainingTone = usageRemainingTone(remainingPercent);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{limit.window}</span>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${USAGE_TONE_BAR_CLASS[remainingTone]}`}
          style={{ width: `${remainingPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{Math.round(remainingPercent)}% left</span>
        {limit.resets_at && <span>{formatResetCountdown(limit.resets_at)}</span>}
      </div>
    </div>
  );
}

// Shaped like the real content it stands in for (UsageLimitRow's own
// label/dot/track/two-meta-line layout, twice, then a divider and three
// usage-line rows) rather than a generic spinner or "Loading..." text --
// per explicit request ("can we do a loading state component similar to
// this? but reflecting the actual bars").
// `active: false` -- per explicit request ("if we are getting ALS-002
// that should show the loading as inactive and not the loading effect"):
// a genuine backend-connectivity failure isn't "still loading, wait a
// beat" (what the pulse communicates), it's "nothing to show right now,
// and won't resolve on its own" -- so it reuses the same bar shapes for
// visual continuity but static/dimmed instead of animate-pulse.
function UsageCardSkeleton({ active = true }: { active?: boolean }) {
  return (
    <div className={`flex flex-col gap-4 ${active ? "animate-pulse" : "opacity-40"}`}>
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-8 rounded bg-muted" />
              <div className="size-1.5 rounded-full bg-muted" />
            </div>
            <div className="h-2 w-full rounded-full bg-muted" />
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-14 rounded bg-muted" />
              <div className="h-2.5 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="h-2.5 w-8 rounded bg-muted" />
              <div className="h-2 w-20 rounded bg-muted" />
            </div>
            <div className="h-2.5 w-14 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModelsPage() {
  useEffect(() => {
    document.title = "Provider usage";
  }, []);

  const snapshots = useAllProviderUsage();
  const { error: usageError } = useUsageStats();
  // Alphabetical by the name actually shown on the card ("ChatGPT" before
  // "Claude" before "Gemini"), not USAGE_PROVIDERS' own QUICK_CHAT_MODELS
  // order -- per explicit request. Sorted here only, not on the shared
  // USAGE_PROVIDERS export itself, since nav-user.tsx's own dropdown bars
  // read that same list and weren't asked to reorder.
  const orderedProviders = [...USAGE_PROVIDERS].sort((a, b) =>
    (PROVIDER_DISPLAY[a.provider]?.primary ?? a.provider).localeCompare(PROVIDER_DISPLAY[b.provider]?.primary ?? b.provider)
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* px-6 py-5 on the viewport, not py-8 on PageContent -- matched to
          settings-overlay.tsx's own Connections -> Provider page (one
          level up), which this page's own heading is meant to line up
          with -- per explicit request ("there's an extra gap at the top
          ... that does not match the provider heading location"). */}
      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-6 py-5">
        <PageContent className="gap-6">
          <div>
            <h1 className="text-[16px] font-semibold text-foreground">Provider usage</h1>
            <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">
              Real usage from each provider's own account, straight from your CLI sign-in.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {orderedProviders.map((model) => {
              const snapshot = snapshots[model.provider];
              // "Claude via Claude Code", not just "Claude" -- per explicit
              // request, same PROVIDER_DISPLAY (quick-chat-models.tsx) used
              // for the model picker's own provider labels, so the two
              // stay in sync rather than naming providers two different
              // ways in two places.
              const display = PROVIDER_DISPLAY[model.provider];
              return (
                <div key={model.provider} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center">
                      <ProviderIcon model={model} className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground">
                        {display ? (
                          <>
                            {display.primary} <span className="text-muted-foreground">{display.caption}</span>
                          </>
                        ) : (
                          model.provider
                        )}
                      </div>
                    </div>
                    {/* Alongside's own connection state, not a per-provider
                        message count -- per explicit request ("we are
                        saying 2 via Alongside which does not make sense,
                        lets say connected... disconnected instead"): a raw
                        local message tally read like unexplained noise
                        next to real usage numbers, where what's actually
                        useful to know at a glance is whether this data is
                        live right now.
                        Real bug, confirmed directly ("Codex and Antigravity
                        shows as connected" while their own description below
                        says "Sign in with `codex login`/`agy login` to see
                        usage"): this used to only check the global
                        `usageError` (whether *this app's own backend* is
                        reachable at all), so a provider that's reachable but
                        genuinely not signed in (snapshot.status ===
                        "needs_auth") -- or one whose own fetch actually
                        failed (snapshot.status === "error") -- still showed
                        "Connected" as long as the backend itself answered.
                        Per-provider now, matching the real state the card's
                        own body below already renders from that same
                        snapshot. */}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {usageError || snapshot?.status === "needs_auth" || snapshot?.status === "error"
                        ? "Disconnected"
                        : "Connected"}
                    </span>
                  </div>

                  {!snapshot && usageError ? (
                    // Confirmed directly as a real bug ("stuck at loading
                    // and showing no errors"): useAllProviderUsage's own
                    // catch resolves a failed fetch to the same `null` a
                    // not-yet-loaded provider starts at, so a genuine
                    // connectivity failure (the same one useUsageStats
                    // already surfaces for /usage) was indistinguishable
                    // from "still loading" here and never resolved.
                    <div className="flex flex-col gap-3">
                      <p className="text-[12px] font-normal text-muted-foreground">
                        No connection to the application, make sure the application is running, then try again. (ALS-002)
                      </p>
                      {/* Static, not pulsing -- per explicit request ("that
                          should show the loading as inactive and not the
                          loading effect"): the pulse communicates "still
                          loading, wait a beat," which is wrong here -- this
                          won't resolve on its own until the app itself is
                          reachable again. */}
                      <UsageCardSkeleton active={false} />
                    </div>
                  ) : !snapshot ? (
                    <UsageCardSkeleton />
                  ) : snapshot.status === "needs_auth" ? (
                    <p className="text-[12px] font-normal text-muted-foreground">
                      {renderWithInlineCode(
                        snapshot.detail ?? `Sign in with your ${display?.primary ?? model.provider} account to see usage.`
                      )}
                    </p>
                  ) : snapshot.status === "error" ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-[12px] font-normal text-muted-foreground">
                        {/* Same reasoning as ChatPage.tsx's own ws.onerror
                            handler (that file's own comment has the full
                            history): a fetch failure reads identically
                            whether the real cause was this app's backend
                            being unreachable, the provider's own servers
                            being down, or -- confirmed directly ("as my
                            wifi dropped") -- the device itself having no
                            network route at all. navigator.onLine catches
                            that last, genuinely-not-Alongside's-fault case
                            and shows the calmer, distinct ALS-001 instead of
                            the provider's own (unrelated) failure detail. */}
                        <ErrorText
                          message={
                            !navigator.onLine
                              ? "No network connection available. (ALS-001)"
                              : (snapshot.detail ?? "Couldn't load usage right now. (ALS-017)")
                          }
                        />
                      </p>
                      {/* Same inactive (non-pulsing) placeholder as the
                          ALS-002 branch above -- per explicit request
                          ("even with Could not reach Claude's usage
                          endpoint (ALS-017) we should show the inactive
                          placeholder like i agreed earlier"): this failure
                          also isn't "still loading," so the bars should
                          read as stalled, not animated. */}
                      <UsageCardSkeleton active={false} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {snapshot.limits.length === 0 && snapshot.usage_lines.length === 0 && (
                        <p className="text-[12px] font-normal text-muted-foreground">No usage reported yet.</p>
                      )}
                      {snapshot.limits.length > 0 && (
                        <div className="flex flex-col gap-3">
                          {snapshot.limits.map((limit) => (
                            <UsageLimitRow key={limit.window} limit={limit} />
                          ))}
                        </div>
                      )}
                      {snapshot.usage_lines.length > 0 && (
                        <>
                          {snapshot.limits.length > 0 && <div className="border-t border-border" />}
                          <div className="flex flex-col gap-2">
                            {snapshot.usage_lines.map((line) => (
                              <div key={line.label} className="flex items-center justify-between text-[12px]">
                                <div>
                                  <div className="font-medium text-foreground">{line.label}</div>
                                  {line.subtitle && <div className="text-[11px] font-normal text-muted-foreground">{line.subtitle}</div>}
                                </div>
                                <span className="font-medium text-foreground">{line.value}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PageContent>
      </ScrollArea>
    </div>
  );
}
