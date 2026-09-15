import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { QUICK_CHAT_MODELS } from "@/lib/quick-chat-models";

type QuickChatModel = (typeof QUICK_CHAT_MODELS)[number];

// Real usage data (Story #207) -- chat count, on-disk db size, and
// per-provider message counts, all read from backend/src/server.rs's own
// /usage endpoint (backend/src/db.rs's count_chats/
// count_messages_by_provider). Shared by settings-overlay.tsx's own Usage
// sub-section, nav-user.tsx's avatar dropdown ("Models Usage" rows), and
// ModelsPage.tsx (the /models page those rows link to) -- one fetch shape,
// not three separate copies of the same request/type.
export type UsageStats = {
  chat_count: number;
  storage_bytes: number;
  provider_message_counts: { provider: string; count: number }[];
};

// Settings > Chat's own "Chat usage" row -- per explicit request ("instead
// of total chats stored locally... show how much space is taking locally
// even though is inside the db"): storage_bytes is the real on-disk size
// of alongside.db (db.rs's own count -- includes every chat's messages,
// not just this one row's chat_count), formatted the same B/KB/MB/GB step
// convention as everywhere else in this app that shows a byte count.
export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

// Fetched once per mount, not polled -- this is a point-in-time snapshot,
// same freshness level the rest of Settings already uses. `error` is real,
// not folded into `usage` staying null -- confirmed directly as a real gap
// ("Chat usage/Storage usage is incorrect, should be showing the sizes...
// or if connection is not available for backend, we already have an error
// for it which we should use it here"): a backend-unreachable fetch used
// to leave `usage` null forever with no way to tell "still loading" apart
// from "never going to load", so the UI just showed "..." indefinitely
// instead of a real, coded error like the rest of this app already uses
// (ConnectionBadge's own ALS-002, e.g.).
export function useUsageStats(): { usage: UsageStats | null; error: boolean } {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/usage")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: UsageStats) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { usage, error };
}

// One entry per provider, not per model -- per explicit request ("we will
// move that to per-provider message count"): the real data this reads
// (below) is only ever aggregated by provider (count_messages_by_provider
// has no per-model breakdown), so a row per model would just repeat the
// same provider-level number under several different labels. Still
// sourced from the `configured: true` subset of QUICK_CHAT_MODELS -- one
// representative model per provider, kept only for its icon. Shared by
// nav-user.tsx's avatar dropdown and ModelsPage.tsx (the bigger page those
// rows link to), so both read the same provider list and the same real
// counts.
export const USAGE_PROVIDERS: QuickChatModel[] = Array.from(
  new Map(QUICK_CHAT_MODELS.filter((m) => m.configured).map((m) => [m.provider, m])).values()
);

// Real per-provider usage (Story #217, backend/src/provider_usage.rs) --
// reads that provider's own CLI-login credential and calls its own real
// usage/quota endpoint directly. Account-only: a provider connected via a
// pasted API key has no usage endpoint at all (that connection path is
// disabled and hidden, settings-overlay.tsx's own comment has the full
// reasoning), so a provider with no CLI login just comes back
// "needs_auth" here, same as one that's never been touched.
export type ProviderUsageLimit = {
  window: string;
  used_percent?: number;
  resets_at?: string;
};

export type ProviderUsageLine = {
  label: string;
  value: string;
  subtitle?: string;
};

export type ProviderUsageSnapshot = {
  provider: string;
  status: "ok" | "needs_auth" | "error";
  plan_name?: string;
  limits: ProviderUsageLimit[];
  usage_lines: ProviderUsageLine[];
  detail?: string;
};

// One request per provider, in parallel, not one hook call per row (rows
// are a runtime-length list -- Rules of Hooks doesn't allow calling a
// hook inside that map). Fetched once per mount, not polled, same
// freshness level useUsageStats above already uses.
export function useAllProviderUsage(): Record<string, ProviderUsageSnapshot | null> {
  const [snapshots, setSnapshots] = useState<Record<string, ProviderUsageSnapshot | null>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      USAGE_PROVIDERS.map((m) =>
        fetch(`/provider-usage/${encodeURIComponent(m.provider.toLowerCase())}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: ProviderUsageSnapshot | null) => [m.provider, data] as const)
          .catch(() => [m.provider, null] as const)
      )
    ).then((results) => {
      if (!cancelled) setSnapshots(Object.fromEntries(results));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return snapshots;
}

// A single at-a-glance percentage per provider, for the avatar dropdown's
// own bars -- the first real limit window (typically "5h", the shortest
// and most immediately actionable one) it reports, or 0 while loading,
// signed out, or errored.
export function useProviderUsagePercents(): Record<string, number> {
  const snapshots = useAllProviderUsage();
  return Object.fromEntries(
    USAGE_PROVIDERS.map((m) => {
      const snapshot = snapshots[m.provider];
      const percent = snapshot?.status === "ok" ? snapshot.limits[0]?.used_percent : undefined;
      return [m.provider, percent ?? 0];
    })
  );
}

// Each provider's own brand accent, per explicit request -- not derived
// from anywhere else in this app (ProviderIcon, quick-chat-models.tsx,
// renders the real brand mark, not a flat color, so there's no existing
// per-provider color to reuse here).
export const PROVIDER_ACCENTS: Record<string, string> = {
  Claude: "#D97757",
  Codex: "#8B5CF6",
  Mistral: "#C2410C",
  xAI: "#000000",
  GitHub: "#000000",
  Kimi: "#2563EB",
  Antigravity: "#60A5FA",
  Qwen: "#C4B5FD",
  DeepSeek: "#5B21B6",
};

// Real-data-only tone/formatting helpers for the usage bars -- per
// explicit request ("we don't know that this is the expected tracker...
// I don't want to grab this assumption from thin air"): this file used to
// also derive an even-usage-across-the-window "expected pace" (a marker
// tick plus reserve/deficit/ETA text) the way the local Synara clone's
// own usagePace.ts does, projected from used_percent/resets_at alone --
// removed entirely, since no provider's own API actually states what
// "expected" usage should be at any given point in its window, and
// presenting a self-computed guess as if it were real reset math read as
// exactly that: an assumption grabbed from thin air, not this app's data.
export type UsageTone = "healthy" | "warning" | "danger";

export function usageRemainingTone(remainingPercent: number): UsageTone {
  if (remainingPercent <= 10) return "danger";
  if (remainingPercent <= 25) return "warning";
  return "healthy";
}

export const USAGE_TONE_BAR_CLASS: Record<UsageTone, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function formatResetCountdown(resetsAt: string): string {
  const resetMs = Date.parse(resetsAt);
  if (Number.isNaN(resetMs)) return "";
  const diffMs = resetMs - Date.now();
  if (diffMs <= 0) return "Resets soon";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Resets in ${days}d ${hours}h`;
  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Resets in ${minutes}m`;
  return "Resets soon";
}

const USAGE_BAR_COUNT = 10;

export function ModelUsageBars({ provider, usagePercent }: { provider: string; usagePercent: number }) {
  const accent = PROVIDER_ACCENTS[provider] ?? "currentColor";
  const filledBars = Math.round(usagePercent / 10);
  return (
    <span className="flex h-[16px] shrink-0 items-center gap-0.5">
      {Array.from({ length: USAGE_BAR_COUNT }, (_, i) => {
        const on = i < filledBars;
        return (
          <span
            key={i}
            className={cn("h-full w-[4px] rounded-full", !on && "bg-[#F5F5F5] dark:bg-[#212121]")}
            style={on ? { backgroundColor: accent } : undefined}
          />
        );
      })}
    </span>
  );
}
