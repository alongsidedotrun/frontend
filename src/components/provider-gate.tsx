import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ShapeProvider } from "@/lib/shape-context";
import { ProvidersIcon } from "@/components/icons/untitled-ui";

// Alongside runs on the person's own provider (Claude, Codex, Antigravity; Grok to come, as the composer's
// "Connect to your Providers" row shows). Until one is connected,
// whatever needs a model -- a new chat, a new bot, sending in a chat -- shows these instead, pointing to
// Settings > Providers; the rest of the app (Settings, the sidebar, Join chat) stays open.

// Alphabetical by the name the providers list shows: ChatGPT, Claude, Gemini, Grok.
const PROVIDER_ICONS = [
  { src: "/icons/providers/chatgpt.svg", alt: "ChatGPT", invertInDark: true },
  { src: "/icons/providers/claude.svg", alt: "Claude" },
  { src: "/icons/providers/gemini.svg", alt: "Gemini" },
  { src: "/icons/providers/grok.svg", alt: "Grok", invertInDark: true },
];

/** The New page with no provider: what to do first, instead of the composer or the bot form. */
export function ProviderGate({ onConnect }: { onConnect: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
      <div className="flex items-center gap-2" aria-hidden="true">
        {PROVIDER_ICONS.map((icon) => (
          <span key={icon.src} className="grid size-9 place-items-center rounded-full border border-border bg-white shadow-[0_1px_2px_rgb(0_0_0_/_0.06)] dark:bg-[var(--surface-4)]">
            <img src={icon.src} alt="" className={icon.invertInDark ? "size-4.5 dark:invert" : "size-4.5"} />
          </span>
        ))}
      </div>
      <div>
        <h1 className="text-[length:clamp(15px,calc(12.55px+0.545cqw),18px)] font-normal text-foreground">{t("providerGate.title")}</h1>
        <p className="mt-1.5 text-[length:var(--redesign-chat-text)] text-muted-foreground">{t("providerGate.body")}</p>
      </div>
      <ShapeProvider defaultShape="pill">
        <Button type="button" variant="primary" className="h-9 px-5" leadingIcon={ProvidersIcon} onClick={onConnect}>
          {t("providerGate.connect")}
        </Button>
      </ShapeProvider>
    </div>
  );
}

/** A chat with no provider: a strip on top of its composer, sending held until one is connected. */
export function ProviderNotice({ onConnect }: { onConnect: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      // The limit warning's place and shape (tucked under the composer's top edge), in neutral colours.
      className="relative -mb-[var(--compose-shell-radius)] overflow-hidden rounded-t-[var(--compose-shell-radius)] border border-b-0 border-border bg-muted text-foreground"
    >
      <div className="flex min-h-7 items-center gap-2 px-4 pt-1.5 pb-[calc(var(--compose-shell-radius)+0.375rem)] text-[length:var(--redesign-chat-meta)]">
        <ProvidersIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{t("providerGate.notice")}</span>
        <button
          type="button"
          onClick={onConnect}
          className="shrink-0 rounded-md px-1 underline-offset-2 transition-opacity hover:underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("providerGate.connect")}
        </button>
      </div>
    </div>
  );
}
