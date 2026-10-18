import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "@untitledui/icons";
import { XIcon } from "@/components/icons/untitled-ui";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { PROVIDER_DISPLAY } from "@/lib/quick-chat-models";
import { dismissWarning, isWarningDismissed, readingFromEvent, readingFromUsage, warningLevel, type LimitReading } from "@/lib/limit-warning";

/**
 * The yellow strip on top of the composer when a provider's 5-hour window is
 * nearly used up (attached like the composer's Work from folder strip below it).
 */
export function LimitWarningStrip({ reading, onDismiss, placement = "top" }: { reading: LimitReading | null; onDismiss: () => void; placement?: "top" | "bottom" }) {
  const { t } = useTranslation();
  const provider = reading ? PROVIDER_DISPLAY[reading.provider === "codex" ? "Codex" : "Claude"]?.primary ?? reading.provider : "";
  const resets = reading?.resetsAt ? new Date(reading.resetsAt * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <AnimatePresence initial={false}>
      {reading && (
        <motion.div
          key="limit-warning"
          role="status"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto", transition: spring.moderate }}
          exit={{ opacity: 0, height: 0, transition: spring.moderate.exit }}
          className={cn(
            "relative overflow-hidden border border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200",
            // Tucked under the composer's edge: above it in a chat, below it (and its Work from
            // folder strip) on a new chat, where the composer sits mid-page.
            placement === "top"
              ? "-mb-[var(--compose-shell-radius)] rounded-t-[var(--compose-shell-radius)] border-b-0"
              : "-mt-[var(--compose-shell-radius)] rounded-b-[var(--compose-shell-radius)] border-t-0",
          )}
        >
          <div
            className={cn(
              "flex min-h-7 items-center gap-2 px-4 text-[length:var(--redesign-chat-meta)]",
              placement === "top" ? "pt-1.5 pb-[calc(var(--compose-shell-radius)+0.375rem)]" : "pt-[calc(var(--compose-shell-radius)+0.375rem)] pb-1.5",
            )}
          >
            <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {t("limits.warning", { provider, percent: Math.round(reading.usedPercent) })}
              {resets && <span className="opacity-75"> · {t("limits.resetsAt", { time: resets })}</span>}
            </span>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={onDismiss}
              className={cn("-mr-1.5 grid size-6 shrink-0 place-items-center rounded-[calc(24px*8/27)] transition-colors hover:bg-amber-900/10 dark:hover:bg-amber-200/10")}
            >
              <XIcon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The 5-hour limit warning for a composer: the provider's usage, checked when
 * the provider changes (the same check Settings > Provider usage makes) and
 * updated by each turn's live `limit_usage` event (pass it to `onEvent`).
 * Returns the strip to put on top of the composer (ComposeBox's `notice`).
 * `provider` is the selected model's provider ("Claude", "Codex"; others
 * report no limits).
 */
export function useLimitWarning(provider: string | null | undefined, placement: "top" | "bottom" = "top") {
  const id = provider === "Claude" ? "claude" : provider === "Codex" ? "codex" : null;
  const [reading, setReading] = useState<LimitReading | null>(null);
  const [, setDismissals] = useState(0);

  useEffect(() => {
    setReading(null);
    if (!id) return;
    let cancelled = false;
    void fetch(`/provider-usage/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((snapshot) => {
        const found = snapshot ? readingFromUsage(id, snapshot) : null;
        if (!cancelled && found) setReading((current) => current ?? found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const level = reading ? warningLevel(reading.usedPercent) : null;
  const shown = reading && reading.provider === id && level !== null && !isWarningDismissed(reading, level) ? reading : null;
  const notice = (
    <LimitWarningStrip
      reading={shown}
      placement={placement}
      onDismiss={() => {
        if (reading && level !== null) dismissWarning(reading, level);
        setDismissals((count) => count + 1);
      }}
    />
  );
  /** A chat event; true when it was a limit reading (live only, nothing else to do with it). */
  const onEvent = (event: Record<string, unknown>) => {
    if (event.type !== "limit_usage") return false;
    const found = readingFromEvent(event);
    if (found) setReading(found);
    return true;
  };
  /** Whether the strip is showing (not below the levels, closed, or for another provider). */
  const active = shown !== null;
  return { notice, onEvent, active };
}
