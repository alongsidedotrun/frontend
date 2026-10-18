import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "@untitledui/icons";
import { XIcon } from "@/components/icons/untitled-ui";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import { PROVIDER_DISPLAY } from "@/lib/quick-chat-models";
import type { LimitReading } from "@/lib/limit-warning";

/**
 * The yellow strip on top of the composer when a provider's 5-hour window is
 * nearly used up (attached like the composer's Work from folder strip below it).
 */
export function LimitWarningStrip({ reading, onDismiss }: { reading: LimitReading | null; onDismiss: () => void }) {
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
          className="relative -mb-[var(--compose-shell-radius)] overflow-hidden rounded-t-[var(--compose-shell-radius)] border border-b-0 border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200"
        >
          <div className="flex min-h-7 items-center gap-2 px-4 pt-1.5 pb-[calc(var(--compose-shell-radius)+0.375rem)] text-[length:var(--redesign-chat-meta)]">
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
