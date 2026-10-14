import { useSyncExternalStore } from "react";
import { QUICK_CHAT_MODELS, type QuickChatModel } from "@/lib/quick-chat-models";

// The models each provider's CLI says it supports (backend GET /models,
// backend/src/models.rs), replacing the built-in lists in QUICK_CHAT_MODELS
// for Claude, Codex and Antigravity so the picker never needs a code change
// when a provider adds or retires a model.
//
// The last list is kept in localStorage and applied at load, so the picker is
// complete on the first frame (and offline); a fresh one is fetched at
// startup and whenever the model picker opens (the backend caches it).

type CatalogEntry = {
  provider: string;
  value: string;
  label: string;
  description: string | null;
  efforts: string[];
  default_effort: string | null;
  is_default: boolean;
};

const CACHE_KEY = "alongside_model_catalog";

// How each provider's models are drawn: its mark, and the dark-mode and size
// corrections ProviderIcon applies (quick-chat-models.tsx).
const PROVIDER_LOOK: Record<string, Pick<QuickChatModel, "icon" | "invertInDark" | "iconScale">> = {
  Claude: { icon: "/icons/providers/claude.svg" },
  Codex: { icon: "/icons/providers/chatgpt.svg", invertInDark: true, iconScale: 0.82 },
  Antigravity: { icon: "/icons/providers/gemini.svg", iconScale: 0.89 },
};

let version = 0;
const listeners = new Set<() => void>();

function applyCatalog(entries: CatalogEntry[]) {
  const providers = new Set(entries.map((entry) => entry.provider).filter((provider) => provider in PROVIDER_LOOK));
  const live = new Set(entries.map((entry) => entry.value));
  // Built-in models of a provider with a live list stay for lookups (an older
  // chat's model name and icon) but leave the picker.
  for (const model of QUICK_CHAT_MODELS) {
    if (providers.has(model.provider) && !live.has(model.value)) model.configured = false;
  }
  for (const entry of entries) {
    const look = PROVIDER_LOOK[entry.provider];
    if (!look) continue;
    const next: QuickChatModel = {
      value: entry.value,
      label: entry.label,
      provider: entry.provider,
      ...look,
      configured: true,
      description: entry.description ?? undefined,
      efforts: entry.efforts,
      defaultEffort: entry.default_effort ?? undefined,
      isDefault: entry.is_default,
    };
    // Re-added at the end, in the CLI's own order, so each provider's models
    // list the way its CLI lists them.
    const index = QUICK_CHAT_MODELS.findIndex((model) => model.value === entry.value);
    if (index !== -1) QUICK_CHAT_MODELS.splice(index, 1);
    QUICK_CHAT_MODELS.push(next);
  }
  version += 1;
  listeners.forEach((listener) => listener());
}

function readCache(): CatalogEntry[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as CatalogEntry[]) : null;
  } catch {
    return null;
  }
}

let inFlight: Promise<void> | null = null;

/** Fetches the live lists; `refresh` asks the backend to re-run the CLIs. */
export function loadModelCatalog(refresh = false): Promise<void> {
  if (inFlight && !refresh) return inFlight;
  inFlight = fetch(`/models${refresh ? "?refresh=true" : ""}`)
    .then((response) => (response.ok ? (response.json() as Promise<CatalogEntry[]>) : null))
    .then((entries) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      applyCatalog(entries);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
      } catch {
        // storage full or blocked: the list still applies for this session
      }
    })
    .catch(() => {
      // backend unreachable: keep the cached or built-in list
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Changes whenever the catalog is applied, so lists built from QUICK_CHAT_MODELS re-render. */
export function useModelCatalogVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
}

// The last known lists, before the first fetch answers.
const cached = readCache();
if (cached) applyCatalog(cached);
