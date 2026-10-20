import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_LIMIT_REMINDER, useLimitReminders } from "@/lib/limit-warning";

/**
 * The limit reminders, as rows: 85% (always on, no remove), each added level
 * (editable, removable), then Add reminder. Any of them can carry an optional
 * note, which the limit strip shows when that level is reached. Settings > Chat
 * shows them in its card; the limit strip shows them in its Reminders popover.
 */
export function LimitReminderRows({ variant }: { variant: "settings" | "popover" }) {
  const { t } = useTranslation();
  const reminders = useLimitReminders();
  // The level just added, so its field takes focus.
  const [added, setAdded] = useState<number | null>(null);
  const row = cn("flex min-h-9 items-center gap-2", variant === "settings" ? "px-3 py-1.5" : "px-2 py-1");

  return (
    <>
      {reminders.levels.map((level) => {
        const isDefault = level === DEFAULT_LIMIT_REMINDER;
        return (
          <div key={isDefault ? "default" : level} className={row}>
            {isDefault ? (
              // The fields' own box, without its border, so the numbers line up.
              <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-medium text-foreground">
                <span className="flex h-6 w-9 items-center justify-end rounded-md border border-transparent px-1.5 tabular-nums">{level}</span>
                <span>%</span>
              </span>
            ) : (
              <LevelField
                level={level}
                autoFocus={added === level}
                onCommit={(to) => {
                  setAdded(null);
                  return reminders.change(level, to);
                }}
              />
            )}
            <NoteField level={level} note={reminders.noteFor(level)} onCommit={(note) => reminders.setNote(level, note)} />
            {isDefault ? (
              <span className="shrink-0 text-[12px] text-muted-foreground">{t("limits.reminders.default")}</span>
            ) : (
              <button
                type="button"
                aria-label={t("limits.reminders.remove", { percent: level })}
                onClick={() => reminders.remove(level)}
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>
        );
      })}
      <div className={row}>
        <button
          type="button"
          onClick={() => setAdded(reminders.add())}
          className="-ml-1 flex h-6 items-center gap-1.5 rounded-md px-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {t("limits.reminders.add")}
        </button>
      </div>
    </>
  );
}

// A level's percent, typed in place: kept on Enter or leaving the field, put back on Escape or
// when it isn't a free level from 1 to 100.
function LevelField({ level, autoFocus, onCommit }: { level: number; autoFocus: boolean; onCommit: (to: number) => boolean }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(level));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(String(level)), [level]);
  useEffect(() => {
    if (autoFocus) ref.current?.select();
  }, [autoFocus]);
  const commit = () => {
    const to = Number(draft);
    if (to === level || !onCommit(to)) setDraft(String(level));
  };
  return (
    <label className="flex shrink-0 items-center gap-0.5 text-[12px] font-medium text-foreground">
      <input
        ref={ref}
        value={draft}
        inputMode="numeric"
        maxLength={3}
        autoFocus={autoFocus}
        aria-label={t("limits.reminders.level")}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            event.stopPropagation();
            setDraft(String(level));
            requestAnimationFrame(() => ref.current?.blur());
          }
        }}
        className="h-6 w-9 rounded-md border border-border bg-transparent px-1.5 text-right tabular-nums outline-none focus-visible:border-focus-accent"
      />
      <span>%</span>
    </label>
  );
}

// A level's optional note, the same way: kept on Enter or leaving the field, put back on Escape.
// Borderless until hovered or focused, so an empty one reads as a quiet placeholder.
function NoteField({ level, note, onCommit }: { level: number; note: string; onCommit: (note: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(note);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(note), [note]);
  return (
    <input
      ref={ref}
      value={draft}
      maxLength={80}
      placeholder={t("limits.reminders.notePlaceholder")}
      aria-label={t("limits.reminders.note", { percent: level })}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() !== note) onCommit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(note);
          requestAnimationFrame(() => ref.current?.blur());
        }
      }}
      className="h-6 min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60 hover:border-border focus-visible:border-focus-accent"
    />
  );
}
