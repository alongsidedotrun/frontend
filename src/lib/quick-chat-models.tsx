import { cn } from "@/lib/utils";

// Same three Claude models frontend/index.html's own model picker offers,
// plus a couple of sample Codex/Mistral entries purely to give the new
// Grouping-by-provider option (AppLayout.tsx's QuickChatMenu) something
// real to group -- selecting any of them navigates to Home (same as the
// sidebar's "New chat") since real per-model chat creation isn't wired up
// in this app yet -- there's no compose box/session-create flow ported
// here at all (see HomePage.tsx's own placeholder note). icon points at
// the same provider artwork the marketing site's Providers section uses
// (web/public/icons/providers/, copied into this app's own public/ since
// it's a separate Vite project).
// Shared by AppLayout.tsx (QuickChatMenu), HomePage.tsx, compose-box.tsx,
// and nav-user.tsx's Models section -- there's only one real set of
// available models in this app today, moved to its own module (not
// AppLayout.tsx) once nav-user.tsx needed it too, to avoid a circular
// import (AppLayout -> TopBar -> NavUser -> AppLayout).
// `configured` is real, not decorative: the backend now spawns two real providers --
// Claude (backend/src/lib.rs's build_options, the Claude Agent SDK CLI) and Codex
// (backend/src/codex.rs, the OpenAI Codex CLI, personal-account/`codex login` only for now
// -- see that module's own top comment) -- routed by whether a model's own `value` starts
// with "gpt-" (backend/src/server.rs's spawn_agent_session). Every other Tier 1 provider
// (see project/NOTES.md's Tier 1 backlog) is shown so the full roster is visible, but
// marked unconfigured since there's no real per-provider integration for them yet.
// `invertInDark` flags icons whose only ink is solid black -- grok.svg and
// github-copilot.svg are fill="currentColor" (which resolves to black when
// loaded via a plain <img>, not page CSS), chatgpt.svg has no fill
// attribute at all (SVG's own black default) -- those are all invisible
// against a dark sidebar/compose box without inverting to white.
// Every other icon already carries real brand color and is left alone.
// Kimi is the one exception: its mark is black-plus-blue, so a blanket
// invert would also flip the blue -- see ProviderIcon below, which swaps
// in a dedicated kimi-dark.svg (same file, black path recolored to white,
// blue path untouched) instead of using a CSS filter for it.
export const QUICK_CHAT_MODELS = [
  { value: "claude-opus-5", label: "Claude Opus 5", provider: "Claude", icon: "/icons/providers/claude.svg", configured: true },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "Claude", icon: "/icons/providers/claude.svg", configured: true },
  {
    value: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "Claude",
    icon: "/icons/providers/claude.svg",
    configured: true,
  },
  // Confirmed directly against the real `codex debug models` catalog on
  // this machine (not guessed) -- "GPT-5.6 Sol" used to sit here as a
  // third row, but "gpt-5.6-sol" isn't a real model slug at all (a real
  // account hitting it gets a genuine 400 from OpenAI: "The 'gpt-5.6-sol'
  // model is not supported..."), unlike these two, which are both real,
  // visible, and confirmed working live.
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra", provider: "Codex", icon: "/icons/providers/chatgpt.svg", configured: true, invertInDark: true, iconScale: 0.82 },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "Codex", icon: "/icons/providers/chatgpt.svg", configured: true, invertInDark: true, iconScale: 0.82 },
  { value: "devstral-2", label: "Devstral 2", provider: "Mistral", icon: "/icons/providers/mistral.svg", configured: false },
  { value: "devstral-small-2", label: "Devstral Small 2", provider: "Mistral", icon: "/icons/providers/mistral.svg", configured: false },
  { value: "mistral-medium-3-5", label: "Mistral Medium 3.5", provider: "Mistral", icon: "/icons/providers/mistral.svg", configured: false },
  { value: "codestral", label: "Codestral", provider: "Mistral", icon: "/icons/providers/mistral.svg", configured: false },
  { value: "qwen3-coder", label: "Qwen3-Coder", provider: "Qwen", icon: "/icons/providers/qwen.png", configured: false },
  { value: "qwen3-coder-next", label: "Qwen3-Coder-Next", provider: "Qwen", icon: "/icons/providers/qwen.png", configured: false },
  { value: "kimi-k3", label: "Kimi K3", provider: "Kimi", icon: "/icons/providers/kimi.svg", configured: false },
  {
    value: "copilot-claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "GitHub",
    icon: "/icons/providers/github-copilot.svg",
    configured: false,
    invertInDark: true,
  },
  {
    value: "copilot-claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "GitHub",
    icon: "/icons/providers/github-copilot.svg",
    configured: false,
    invertInDark: true,
  },
  {
    value: "copilot-claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "GitHub",
    icon: "/icons/providers/github-copilot.svg",
    configured: false,
    invertInDark: true,
  },
  {
    value: "copilot-gpt-5-3-codex",
    label: "GPT-5.3-Codex",
    provider: "GitHub",
    icon: "/icons/providers/github-copilot.svg",
    configured: false,
    invertInDark: true,
  },
  {
    value: "copilot-gemini-3-pro",
    label: "Gemini 3 Pro",
    provider: "GitHub",
    icon: "/icons/providers/github-copilot.svg",
    configured: false,
    invertInDark: true,
  },
  // Real, configured now -- via Antigravity (Google's own real terminal client,
  // `agy`), not a bare `gemini` CLI call (github.com/alongsidedotrun/alongside/
  // issues/10 has the full story: Google's own servers reject that free tier
  // outright). Model ids/labels confirmed live via `agy models` on a real,
  // signed-in account -- "-high" reasoning-effort variants picked to match
  // Claude/Codex's own three-models-per-provider convention, not the medium/low
  // tiers `agy models` also lists.
  { value: "gemini-3.1-pro-high", label: "Gemini 3.1 Pro", provider: "Antigravity", icon: "/icons/providers/gemini.svg", configured: true, iconScale: 0.89 },
  { value: "gemini-3.6-flash-high", label: "Gemini 3.6 Flash", provider: "Antigravity", icon: "/icons/providers/gemini.svg", configured: true, iconScale: 0.89 },
  { value: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash", provider: "Antigravity", icon: "/icons/providers/gemini.svg", configured: true, iconScale: 0.89 },
  { value: "deepseek-v4-pro", label: "DeepSeek V4-Pro", provider: "DeepSeek", icon: "/icons/providers/deepseek.svg", configured: false },
  { value: "deepseek-v4-flash", label: "DeepSeek V4-Flash", provider: "DeepSeek", icon: "/icons/providers/deepseek.svg", configured: false },
  { value: "deepseek-v3-1-terminus", label: "DeepSeek V3.1 Terminus", provider: "DeepSeek", icon: "/icons/providers/deepseek.svg", configured: false },
];

// Consumer-brand name (what most people already recognize) as the primary
// label -- per explicit decision ("Lets do C" against the naming-format
// mockup). Keyed by the internal `provider` string above, which stays
// unchanged everywhere else (cliBinary lookups, backend dispatch, this
// module's own `provider` field) all depend on that literal string
// matching the real CLI binary name -- this map only controls what's
// rendered, never what's looked up. Shared by settings-overlay.tsx's
// provider grid and compose-box.tsx's model picker (moved here from
// settings-overlay.tsx once compose-box.tsx needed the same "Codex" ->
// "ChatGPT" mapping for its own provider group label, confirmed as a real
// gap: "the model dropdown shows Claude and Codex but should show Claude
// and ChatGPT").
export const PROVIDER_DISPLAY: Record<string, { primary: string; caption: string }> = {
  Claude: { primary: "Claude", caption: "via Claude Code" },
  Codex: { primary: "ChatGPT", caption: "via Codex" },
  Antigravity: { primary: "Gemini", caption: "via Antigravity" },
};

// Warms the browser's own image cache for every provider icon at app start
// (AppLayout.tsx calls this once on mount) -- confirmed directly as a real
// bug ("our provider logo is loading after the name of the provider loads
// at the chat"): ProviderIcon's <img> is a real network/disk load with its
// own latency, while the label text next to it paints synchronously, so an
// icon used for the first time in a session visibly popped in after its own
// label. Once the browser has actually fetched/decoded each icon here,
// every later real use (a chat row rendering, kimi-dark.svg included) reads
// from cache and paints in the same frame as its label instead.
export function preloadProviderIcons() {
  const urls = new Set(QUICK_CHAT_MODELS.map((m) => m.icon));
  urls.add("/icons/providers/kimi-dark.svg");
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}

// Most labels embed their own provider name as the first word ("Claude
// Opus 5" -> provider "Claude") -- showing it again next to a provider
// icon/heading that already says "Claude" is redundant, so this strips it
// back out. Labels that DON'T start with their provider (e.g. "Claude
// Opus 4.6" under provider "GitHub") keep their full label, since the
// provider name there isn't part of the model's own name. Shared by
// compose-box.tsx's own model trigger and nav-user.tsx's Models section.
export function modelDisplayName(model: { label: string; provider: string }) {
  const prefix = `${model.provider} `;
  return model.label.startsWith(prefix) ? model.label.slice(prefix.length) : model.label;
}

// Shared by every place a provider icon is rendered (compose box's model
// trigger/checklist/@-mention list, AppLayout.tsx's QuickChatMenu,
// HomePage's ChatCard, nav-user.tsx's Models section) so the dark-mode
// handling above lives in exactly one place.
//
// `iconScale` corrects for a real bug, confirmed directly ("noticed that
// the chatgpt icon at the chat is bigger than the claude one"): every
// provider mark here is rendered at the same fixed box size via a plain
// <img>, but each source SVG fills a different fraction of its own
// viewBox (measured by rendering each to a bitmap and finding its ink's
// own bounding box against the transparent/white canvas around it) --
// claude.svg's mark only fills about 81% of its box, while chatgpt.svg
// and grok.svg run edge to edge (~99-100%) and gemini.svg sits at ~92%,
// so identical container sizing still reads as visibly different mark
// sizes. Rather than editing the source files, each oversized icon here
// carries its own scale-down factor (chatgpt/grok ~0.82, gemini ~0.89)
// applied as a CSS transform, which shrinks the drawn mark without
// changing the <img>'s own layout box -- every caller's existing
// alignment stays untouched. Grok/Gemini aren't wired to a real provider
// yet (`configured: false` above), but get the same correction now so
// enabling them later doesn't reintroduce this same mismatch.
export function ProviderIcon({
  model,
  className,
  onLoad,
}: {
  model: { icon: string; value: string; invertInDark?: boolean; iconScale?: number };
  className?: string;
  // Optional -- lets a caller (ChatPage's own agent row) know the moment
  // this icon has actually painted, so it can hold the rest of that row
  // (label, reply text) hidden until then instead of the icon popping in
  // after them. Not needed by callers that don't care (compose box's model
  // picker, etc.), so this stays a no-op by default.
  onLoad?: () => void;
}) {
  const style = model.iconScale ? { transform: `scale(${model.iconScale})` } : undefined;
  if (model.value === "kimi-k3") {
    return (
      <>
        <img src={model.icon} alt="" className={cn(className, "dark:hidden")} style={style} onLoad={onLoad} />
        <img src="/icons/providers/kimi-dark.svg" alt="" className={cn(className, "hidden dark:block")} style={style} onLoad={onLoad} />
      </>
    );
  }
  return <img src={model.icon} alt="" className={cn(className, model.invertInDark && "dark:invert")} style={style} onLoad={onLoad} />;
}
