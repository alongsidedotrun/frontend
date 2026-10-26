import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterLines, SwitchVertical01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { ErrorText } from "@/lib/error-code";
import { cn } from "@/lib/utils";
import { forcedNoProvider } from "@/lib/dev-no-provider";
import { PROVIDER_DISPLAY, ProviderIcon } from "@/lib/quick-chat-models";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { ShapeProvider } from "@/lib/shape-context";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import {
  USAGE_PROVIDERS,
  useAllProviderUsage,
  useUsageStats,
  usageRemainingTone,
  USAGE_TONE_BAR_CLASS,
  formatResetCountdown,
  type ProviderUsageLimit,
  type ProviderUsageSnapshot,
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

// Each provider's usage, as rows in Settings > Providers' Usage section (settings-overlay.tsx's
// ProvidersSection), under the providers -- it was its own page (/settings/provider/usage, now
// redirected there). The avatar dropdown's usage bars (nav-user.tsx) link to it. Story:
// alongsidedotrun/private#217.
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
  const { t } = useTranslation();
  const remainingPercent = Math.min(100, Math.max(0, limit.used_percent !== undefined ? 100 - limit.used_percent : 100));
  const remainingTone = usageRemainingTone(remainingPercent);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Just the window: a quota group's own description of its models (limit.covers, e.g. Antigravity's
          "Gemini Flash, Gemini Pro") can name ones no longer offered; the tabs below show what was used. */}
      <span className="text-xs font-medium text-foreground">{limit.window}</span>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${USAGE_TONE_BAR_CLASS[remainingTone]}`}
          style={{ width: `${remainingPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{t("models.percentLeft", { percent: Math.round(remainingPercent) })}</span>
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
// barsOnly: just the limit bars, when the card's token rows are real.
// still: no pulse or dimming of its own, for SkeletonReveal, which pulses it while loading.
function UsageCardSkeleton({ active = true, barsOnly = false, still = false }: { active?: boolean; barsOnly?: boolean; still?: boolean }) {
  return (
    <div className={`flex flex-col gap-4 ${still ? "" : active ? "animate-pulse" : "opacity-40"}`}>
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
      {!barsOnly && (
        <>
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
        </>
      )}
    </div>
  );
}

/** One row per provider (inside a settings card, which draws the dividers). */
// A model id as people know it, the same way for every provider (their own lists label models in
// different styles: "Opus 5.5", "GPT-5.6-Luna"): "claude-opus-5-5" -> "Claude Opus 5.5",
// "gpt-5.6-luna" -> "GPT-5.6 Luna", release dates dropped.
function modelLabel(id: string) {
  const words: string[] = [];
  for (const part of id.split("-").filter((p) => p && !/^\d{8}$/.test(p))) {
    const previous = words[words.length - 1];
    if (/^\d+$/.test(part) && previous && /^\d+(\.\d+)*$/.test(previous)) words[words.length - 1] = `${previous}.${part}`;
    else words.push(/^\d/.test(part) ? part : part[0].toUpperCase() + part.slice(1));
  }
  const [first = id, ...rest] = words;
  return first.toLowerCase() === "gpt" ? `GPT-${rest.join(" ")}` : [first, ...rest].join(" ");
}

const MODEL_TAB_CLASS = "h-[22px] shrink-0 px-2.5 [&>span]:!text-[12px] [&>span]:!leading-none";

/** A card's 24h/7d/30d rows, under All and a tab for each model used this calendar month (since the
 *  1st, in the viewer's time zone). With one model there are no tabs: it would repeat All. */
function UsageRows({ snapshot }: { snapshot: ProviderUsageSnapshot }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("all");
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const tabs = (snapshot.models ?? [])
    .filter((entry) => entry.last_used_at === undefined || entry.last_used_at >= monthStart)
    .map((entry) => ({ id: entry.model, label: modelLabel(entry.model), lines: entry.usage_lines }));
  const picked = tabs.find((tab) => tab.id === selected);
  const lines = picked ? picked.lines : snapshot.usage_lines;
  return (
    <div className="flex flex-col gap-3">
      {tabs.length > 1 && (
        <ShapeProvider defaultShape="pill">
          <Tabs size="compact" value={picked ? selected : "all"} onValueChange={(value) => setSelected(String(value))}>
            <TabsList className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>div:first-child]:!bg-background [&>div:first-child]:!shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] dark:[&>div:first-child]:!bg-white/12">
              <TabItem value="all" label={t("usage.models.all")} className={MODEL_TAB_CLASS} />
              {tabs.map((tab) => (
                <TabItem key={tab.id} value={tab.id} label={tab.label} className={MODEL_TAB_CLASS} />
              ))}
            </TabsList>
          </Tabs>
        </ShapeProvider>
      )}
      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between text-[12px]">
            <div>
              <div className="font-medium text-foreground">{line.label}</div>
              {line.subtitle && <div className="text-[11px] font-normal text-muted-foreground">{line.subtitle}</div>}
            </div>
            <span className="font-medium text-foreground">{line.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type UsageSort = "name" | "mostUsed";
// Which providers are picked in Filter (none: all of them) and how they're sorted, remembered on this device.
const USAGE_PICKED_KEY = "alongside_usage_picked";
const USAGE_SORT_KEY = "alongside_usage_sort";

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: kept for this session
  }
}

// The least left in any of a provider's windows, for Most used; no reading sorts last.
function leastLeft(snapshot: ProviderUsageSnapshot | null | undefined) {
  if (!snapshot || snapshot.status !== "ok" || snapshot.limits.length === 0) return Infinity;
  return Math.min(...snapshot.limits.map((limit) => 100 - (limit.used_percent ?? 0)));
}

/** Settings > Providers' Usage: a card per provider, with Filter (which providers to show) and Sort
 *  (by name or most used) beside the heading, like Skills' toolbar. */
// Which providers are connected (their CLI there and signed in), by provider name; absent until known.
function useConnectedProviders(providers: readonly string[]): Record<string, boolean> {
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const key = providers.join(",");
  useEffect(() => {
    let cancelled = false;
    for (const provider of providers) {
      void fetch(`/cli/${encodeURIComponent(provider.toLowerCase())}/available`)
        .then((response) => (response.ok ? (response.json() as Promise<{ available?: boolean }>) : null))
        .then((data) => {
          if (!cancelled && data) setConnected((current) => ({ ...current, [provider]: Boolean(data.available) && !forcedNoProvider() }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return connected;
}

// The empty state's rows: the providers with usage, and Grok (to come), as the composer's
// "Connect to your Providers" row shows them.
// Alphabetical by provider: Antigravity, Claude, Codex, Grok.
const EMPTY_STATE_ICONS = [
  ...USAGE_PROVIDERS,
  { provider: "Grok", value: "grok", icon: "/icons/providers/grok.svg", invertInDark: true, iconScale: 0.82 },
].sort((a, b) => a.provider.localeCompare(b.provider));

/** No provider connected: what the section will hold, drawn faintly, and what to do. */
function UsageEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-foreground/[0.02] px-4 py-10 text-center">
      <div className="flex w-full max-w-[220px] flex-col gap-2" aria-hidden="true">
        {EMPTY_STATE_ICONS.map((model) => (
          <div key={model.value} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 opacity-60">
            <ProviderIcon model={model} className="size-3.5 shrink-0 grayscale" />
            <span className="h-1.5 flex-1 rounded-full bg-foreground/10" />
          </div>
        ))}
      </div>
      <div>
        <p className="text-[length:var(--redesign-chat-text)] font-medium text-foreground">{t("usage.empty.title")}</p>
        <p className="mt-1 text-[length:var(--redesign-chat-meta)] text-muted-foreground">{t("usage.empty.body")}</p>
      </div>
    </div>
  );
}

export function ProviderUsageSection() {
  const { t } = useTranslation();
  const snapshots = useAllProviderUsage();
  // Only connected providers have usage to show: the rest are left out, and with none, an empty state.
  const connected = useConnectedProviders(USAGE_PROVIDERS.map((model) => model.provider));
  const noneConnected = USAGE_PROVIDERS.every((model) => connected[model.provider] === false);
  const { error: usageError } = useUsageStats();
  const [picked, setPicked] = useState<string[]>(() => {
    try {
      return JSON.parse(readStored(USAGE_PICKED_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [sort, setSort] = useState<UsageSort>(() => (readStored(USAGE_SORT_KEY) === "mostUsed" ? "mostUsed" : "name"));
  const nameOf = (provider: string) => PROVIDER_DISPLAY[provider]?.primary ?? provider;
  const fullNameOf = (provider: string) => {
    const display = PROVIDER_DISPLAY[provider];
    return display ? `${display.primary} ${display.caption}` : provider;
  };
  // All providers, or just the ones picked. Picking every one, or unpicking the last, is All again.
  const pick = (next: string[]) => {
    const all = next.length === 0 || USAGE_PROVIDERS.every((model) => next.includes(model.provider));
    const value = all ? [] : next;
    setPicked(value);
    store(USAGE_PICKED_KEY, JSON.stringify(value));
  };
  const showsAll = picked.length === 0;
  const pickSort = (next: UsageSort) => {
    setSort(next);
    store(USAGE_SORT_KEY, next);
  };
  const byName = [...USAGE_PROVIDERS]
    .filter((model) => connected[model.provider] !== false)
    .sort((a, b) => nameOf(a.provider).localeCompare(nameOf(b.provider)));
  const shown = byName
    .filter((model) => showsAll || picked.includes(model.provider))
    .sort((a, b) => (sort === "mostUsed" ? leastLeft(snapshots[a.provider]) - leastLeft(snapshots[b.provider]) || 0 : 0));

  return (
    // SettingsSection's heading (settings-overlay.tsx), with the two menus at its right end.
    <section className="flex flex-col gap-1.5" style={{ marginTop: "0.875rem" }}>
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <h3 className="text-[12px] font-normal text-muted-foreground/60">{t("settings.providers.usage")}</h3>
        <div className={cn("flex items-center gap-1", noneConnected && "invisible")}>
          <DropdownMenu size="compact">
            <DropdownTrigger render={<Button size="compact" variant="tertiary" leadingIcon={FilterLines} active={!showsAll}>{t("usage.filter")}</Button>} />
            <DropdownContent align="end" className="w-52 min-w-0">
              <MenuItem index={0} label={t("usage.filter.all")} checked={showsAll} onSelect={() => pick([])} />
              {byName.map((model, index) => (
                <MenuItem
                  key={model.provider}
                  index={index + 1}
                  label={fullNameOf(model.provider)}
                  checked={picked.includes(model.provider)}
                  onSelect={() =>
                    pick(picked.includes(model.provider) ? picked.filter((p) => p !== model.provider) : [...picked, model.provider])
                  }
                />
              ))}
            </DropdownContent>
          </DropdownMenu>
          <DropdownMenu size="compact">
            <DropdownTrigger render={<Button size="compact" variant="tertiary" leadingIcon={SwitchVertical01}>{t("usage.sort")}</Button>} />
            <DropdownContent align="end" className="w-40 min-w-0">
              <MenuItem index={0} label={t("usage.sort.name")} checked={sort === "name"} onSelect={() => pickSort("name")} />
              <MenuItem index={1} label={t("usage.sort.mostUsed")} checked={sort === "mostUsed"} onSelect={() => pickSort("mostUsed")} />
            </DropdownContent>
          </DropdownMenu>
        </div>
      </div>
      {noneConnected ? <UsageEmptyState /> : (
      <div className="flex flex-col gap-2">
            {shown.map((model) => {
              const snapshot = snapshots[model.provider];
              // "Claude via Claude Code", not just "Claude" -- per explicit
              // request, same PROVIDER_DISPLAY (quick-chat-models.tsx) used
              // for the model picker's own provider labels, so the two
              // stay in sync rather than naming providers two different
              // ways in two places.
              const display = PROVIDER_DISPLAY[model.provider];
              return (
                <div key={model.provider} className="flex flex-col gap-3 rounded-xl border border-border bg-foreground/[0.02] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center">
                      <ProviderIcon model={model} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-foreground">
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
                        ? t("common.disconnected")
                        : t("common.connected")}
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
                        {t("settings.providers.noConnection")}
                      </p>
                      {/* Static, not pulsing -- per explicit request ("that
                          should show the loading as inactive and not the
                          loading effect"): the pulse communicates "still
                          loading, wait a beat," which is wrong here -- this
                          won't resolve on its own until the app itself is
                          reachable again. */}
                      <UsageCardSkeleton active={false} />
                    </div>
                  ) : (
                    // Skills' Discover reveal: the placeholder pulses while loading, then cross-fades
                    // (with a blur) into the card instead of being swapped for it.
                    <SkeletonReveal loading={!snapshot} skeleton={<UsageCardSkeleton still />}>
                      {snapshot && (snapshot.status === "needs_auth" ? (
                        // No reading yet: the message, over the bars' resting placeholder so the card keeps its shape.
                        <div className="flex flex-col gap-3">
                          <p className="text-[12px] font-normal text-muted-foreground">
                            {renderWithInlineCode(
                              snapshot.detail ?? t("models.needsSignIn", { provider: display?.primary ?? model.provider })
                            )}
                          </p>
                          {/* The token rows come from the CLI's own logs, so they're real even before the limits are. */}
                          <UsageCardSkeleton active={false} barsOnly={snapshot.usage_lines.length > 0} />
                          {snapshot.usage_lines.length > 0 && (
                            <>
                              <div className="border-t border-border" />
                              <UsageRows snapshot={snapshot} />
                            </>
                          )}
                        </div>
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
                                  ? t("models.noNetwork")
                                  : (snapshot.detail ?? t("models.loadFailed"))
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
                            <p className="text-[12px] font-normal text-muted-foreground">{t("models.noUsage")}</p>
                          )}
                          {snapshot.limits.length > 0 && (
                            <div className="flex flex-col gap-3">
                              {snapshot.limits.map((limit) => (
                                <UsageLimitRow key={limit.window} limit={limit} />
                              ))}
                              {/* Not checked live (the live check would need a login from the macOS Keychain):
                                  the reading saved from a reply, or the CLI's own cached check (Claude Code's). */}
                              {snapshot.as_of && (
                                <p className="text-[11px] font-normal text-muted-foreground">
                                  {t("models.usageAsOf", {
                                    time: new Date(snapshot.as_of).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }),
                                  })}
                                </p>
                              )}
                            </div>
                          )}
                          {snapshot.usage_lines.length > 0 && (
                            <>
                              {snapshot.limits.length > 0 && <div className="border-t border-border" />}
                              <UsageRows snapshot={snapshot} />
                            </>
                          )}
                        </div>
                      ))}
                    </SkeletonReveal>
                  )}
                </div>
              );
            })}
      </div>
      )}
    </section>
  );
}
