import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownRight, List, Paperclip } from "@untitledui/icons";
import { DeleteIcon, EditIcon } from "@/components/icons/untitled-ui";
import { DropdownMenu as BaseDropdownMenu, DropdownTrigger as BaseDropdownTrigger, DropdownContent as BaseDropdownContent } from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { MoreTrigger } from "@/components/ui/more-trigger";
import { ICON_PRESS } from "@/lib/press-effect";
import { spring } from "@/lib/springs";
import { cn } from "@/lib/utils";
import type { QueuedMessage } from "@/lib/message-queue";

const ROW_BUTTON = cn(
  "flex h-6 shrink-0 items-center justify-center gap-1 rounded-[calc(24px*8/27)] text-ink-2 transition-colors hover:bg-hover-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10",
  ICON_PRESS,
);

/**
 * Messages waiting for the running turn to end, on a strip the composer
 * overlaps from below (like Work from folder's strip under it). Each one can
 * be steered into the turn now (where the provider can steer), removed, or
 * pulled back into the composer to edit.
 */
export function QueuedMessages({
  items,
  onSteer,
  onRemove,
  onEdit,
  onTurnOffQueueing,
}: {
  items: QueuedMessage[];
  /** Absent where the provider can't steer: those messages only wait. */
  onSteer?: (item: QueuedMessage) => void;
  onRemove: (id: string) => void;
  onEdit: (item: QueuedMessage) => void;
  /** Absent where the provider can't steer, since then there's nothing to turn it into. */
  onTurnOffQueueing?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div
          key="queued-messages"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto", transition: spring.moderate }}
          exit={{ opacity: 0, height: 0, transition: spring.moderate.exit }}
          className="relative -mb-[var(--compose-shell-radius)] overflow-hidden rounded-t-[var(--compose-shell-radius)] border border-b-0 border-border bg-[var(--redesign-compose-extension-surface)]"
        >
          <ul aria-label={t("compose.queue.label")} className="flex max-h-[132px] flex-col overflow-y-auto px-3 pt-1.5 pb-[calc(var(--compose-shell-radius)+0.25rem)]">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="flex h-8 items-center gap-2 text-ui"
                >
                  <List aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-foreground/85">{item.text}</span>
                  {item.images.length > 0 && <Paperclip aria-label={t("compose.queue.withImages")} className="size-3.5 shrink-0 text-ink-3" />}
                  {/* Steering sends text only, so a message with images waits for its own turn. */}
                  {onSteer && item.images.length === 0 && (
                    <button type="button" onClick={() => onSteer(item)} className={cn(ROW_BUTTON, "px-1.5 text-ui-sm")}>
                      <CornerDownRight aria-hidden="true" className="size-3.5" />
                      {t("compose.queue.steer")}
                    </button>
                  )}
                  <button type="button" aria-label={t("compose.queue.remove")} onClick={() => onRemove(item.id)} className={cn(ROW_BUTTON, "w-6")}>
                    <DeleteIcon className="size-3.5" />
                  </button>
                  <BaseDropdownMenu size="compact">
                    <BaseDropdownTrigger render={<MoreTrigger size="sm" autoHide={false} aria-label={t("common.more")} />} />
                    <BaseDropdownContent align="end" className="w-44">
                      <BaseMenuItem index={0} icon={EditIcon} label={t("compose.queue.edit")} className="gap-[7px]" onSelect={() => onEdit(item)} />
                      {onTurnOffQueueing && (
                        <BaseMenuItem index={1} icon={List} label={t("compose.queue.turnOff")} className="gap-[7px]" onSelect={onTurnOffQueueing} />
                      )}
                    </BaseDropdownContent>
                  </BaseDropdownMenu>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
