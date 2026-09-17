// The compose box's own real "last actually used" values (model, effort,
// permission mode, context usage) -- per explicit correction ("I don't
// want provisional guess. I want us to capture this data whenever we
// change it so we have that freshly available, on hosted and enterprise
// this is part of the redis cache but in local i guess is memory?"): a
// first pass stored this in the browser's own localStorage, which reads as
// a guess because it's detached from this app's real backend state. This
// now lives in backend/src/db.rs's own settings key/value table
// (server.rs's own GET/POST /settings/last-used) -- the same durable store
// default_model already uses -- with a plain in-memory cache in front of
// it here, filling the exact role the user's own question named: SQLite
// standing in for Redis, a fast real cache backed by a durable store, not
// a guess. Every setter below updates this in-memory cache synchronously
// (so a value changed a moment ago is "freshly available" to the very next
// read, same tab or a newly mounted one) and fires the real POST in the
// background to persist it.
import type { EffortLevel } from "@/lib/effort";

// "plan" -- Antigravity-only (compose-box.tsx's own ANTIGRAVITY_MODES has
// the real reasoning: agy's own CLI has no ask/manual equivalent, only
// --mode plan and --dangerously-skip-permissions).
export type PermissionMode = "manual" | "ask" | "auto" | "plan";

interface LastUsedCache {
  model: string | null;
  effort: EffortLevel | null;
  permissionMode: PermissionMode | null;
  contextUsage: { used: number } | null;
}

const cache: LastUsedCache = {
  model: null,
  effort: null,
  permissionMode: null,
  contextUsage: null,
};

// Resolves once the initial GET actually lands -- callers that need to
// wait for real backend state before deciding a fallback (there are none
// today; every current caller is fine reading the cache's still-null
// state until this resolves) can await this instead of racing it.
let loaded = false;
export const lastUsedReady: Promise<void> = (async () => {
  try {
    const response = await fetch("/settings/last-used");
    if (!response.ok) return;
    const data = (await response.json()) as {
      model: string | null;
      effort: string | null;
      permission_mode: string | null;
      context_usage: string | null;
    };
    cache.model = data.model;
    cache.effort = isEffortLevel(data.effort) ? data.effort : null;
    cache.permissionMode = isPermissionMode(data.permission_mode) ? data.permission_mode : null;
    cache.contextUsage = parseContextUsage(data.context_usage);
  } catch {
    // Best-effort -- the cache just stays empty, same as a fresh install.
  } finally {
    loaded = true;
  }
})();

function isEffortLevel(value: string | null): value is EffortLevel {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh" || value === "max";
}

function isPermissionMode(value: string | null): value is PermissionMode {
  return value === "manual" || value === "ask" || value === "auto" || value === "plan";
}

// No `max` any more -- real bug, confirmed directly ("remove the silent
// denominator"): a stored value from before this fix may still carry an old
// fabricated max on disk, so a plain `used` check (not requiring/reading max
// at all) is what keeps an old cached row from silently poisoning a fresh
// read with a number that was never real to begin with.
function parseContextUsage(raw: string | null): { used: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.used === "number") return { used: parsed.used };
  } catch {
    // Malformed/stale value -- treat as absent rather than throwing.
  }
  return null;
}

function persist(body: Record<string, string>) {
  void fetch("/settings/last-used", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function isLastUsedLoaded(): boolean {
  return loaded;
}

export function loadLastModel(): string | null {
  return cache.model;
}

export function saveLastModel(value: string) {
  cache.model = value;
  persist({ model: value });
}

export function loadLastEffort(): EffortLevel | null {
  return cache.effort;
}

export function saveLastEffort(level: EffortLevel) {
  cache.effort = level;
  persist({ effort: level });
}

export function loadLastPermissionMode(): PermissionMode | null {
  return cache.permissionMode;
}

export function saveLastPermissionMode(mode: PermissionMode) {
  cache.permissionMode = mode;
  persist({ permission_mode: mode });
}

export function loadLastContext(): { used: number } | null {
  return cache.contextUsage;
}

export function saveLastContext(usage: { used: number }) {
  cache.contextUsage = usage;
  persist({ context_usage: JSON.stringify(usage) });
}
