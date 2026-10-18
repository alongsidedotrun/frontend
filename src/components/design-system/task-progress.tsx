import { Check, CircleDashed, CornerDownRight, Pause } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type TaskProgressStatus = "pending" | "inProgress" | "completed";

export type TaskProgressSubtask = {
  id: string;
  title: string;
  status: "pending" | "pickedUp" | "interrupted" | "completed";
};

export type TaskProgressItem = {
  id: string;
  title: string;
  status: TaskProgressStatus;
  durationLabel?: string;
  subtasks?: readonly TaskProgressSubtask[];
};

export function ProgressRing({
  completedSteps,
  totalSteps,
  spinning = false,
  className,
}: {
  completedSteps: number;
  totalSteps: number;
  spinning?: boolean;
  className?: string;
}) {
  const progress = spinning ? 0.28 : totalSteps ? Math.min(Math.max(completedSteps / totalSteps, 0), 1) : 0;
  const radius = 6.5;
  const circumference = 2 * Math.PI * radius;
  const stroke = (color: string) => ({ stroke: color, strokeWidth: 3, vectorEffect: "none" as const });

  return (
    <svg
      key={`${completedSteps}-${totalSteps}-${spinning}`}
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={cn(
        "size-[var(--redesign-sidebar-footer-progress-size)] shrink-0 -rotate-90",
        spinning ? "animate-spin" : "animate-[redesign-progress-ring_400ms_ease-out]",
        className,
      )}
    >
      <circle cx="8" cy="8" r={radius} fill="none" style={stroke("var(--redesign-progress-track)")} />
      {progress > 0 && (
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${progress * circumference} ${circumference}`}
          style={stroke("var(--focus-accent)")}
        />
      )}
    </svg>
  );
}

function TaskStatusMark({ status, running }: { status: TaskProgressStatus; running: boolean }) {
  if (status === "completed") {
    return (
      <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-background">
        <Check aria-hidden="true" className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "inProgress") return <ProgressRing completedSteps={0} totalSteps={1} spinning={running} className="size-4" />;
  return <CircleDashed aria-hidden="true" className="size-4 text-muted-foreground/60" />;
}

export function TaskProgressPanel({
  title,
  tasks,
  running,
  onPause,
}: {
  title: string;
  tasks: readonly TaskProgressItem[];
  running: boolean;
  onPause?: () => void;
}) {
  const { t } = useTranslation();
  const completed = tasks.filter((task) => task.status === "completed").length;

  if (tasks.length === 0) return null;

  return (
    <section className="mb-2.5 overflow-hidden rounded-[var(--redesign-chat-bubble-radius)] border border-border bg-sidebar" aria-label={title}>
      <header className="flex h-10 items-center gap-2 border-b border-border px-3">
        <ProgressRing completedSteps={completed} totalSteps={tasks.length} spinning={running && completed < tasks.length} />
        <span className="min-w-0 flex-1 truncate text-[length:var(--redesign-font-size-base)] font-medium text-foreground">{title}</span>
        <span className="shrink-0 text-[length:var(--redesign-font-size-compact)] text-muted-foreground">
          {t("chat.tasks.count", { done: completed, total: tasks.length })}
        </span>
        {running && onPause ? (
          <button
            type="button"
            onClick={onPause}
            aria-label={t("chat.tasks.pause")}
            title={t("chat.tasks.pause")}
            className="flex size-6 shrink-0 items-center justify-center rounded-[calc(24px*8/27)] text-muted-foreground transition-colors hover:bg-hover-2/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pause aria-hidden="true" className="size-3.5" fill="currentColor" />
          </button>
        ) : null}
      </header>

      <ol className="px-3 py-2.5">
        {tasks.map((task, index) => {
          const muted = task.status !== "inProgress";
          return (
            <li key={task.id} className="relative flex gap-2.5 pb-2.5 last:pb-0">
              {index < tasks.length - 1 ? <span aria-hidden="true" className="absolute top-4 bottom-0 left-[7px] w-px bg-border" /> : null}
              <span className="relative z-[1] mt-0.5 bg-sidebar"><TaskStatusMark status={task.status} running={running} /></span>
              <div className="min-w-0 flex-1">
                <div className={cn("flex min-h-5 items-center gap-2 text-[length:var(--redesign-chat-text)]", muted ? "text-muted-foreground" : "text-foreground")}>
                  <span className="min-w-0 flex-1">{task.title}</span>
                  {task.durationLabel ? <span className="shrink-0 text-[length:var(--redesign-chat-meta)] tabular-nums text-muted-foreground/70">{task.durationLabel}</span> : null}
                </div>
                {task.subtasks?.length ? (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {task.subtasks.map((subtask) => (
                      <li key={subtask.id} className="flex min-h-8 items-center gap-2 rounded-[var(--redesign-control-radius)] bg-muted/70 px-2.5 text-[length:var(--redesign-font-size-base)]">
                        <CornerDownRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-foreground/90">{subtask.title}</span>
                        {subtask.status !== "pending" ? (
                          <span className="shrink-0 text-[length:var(--redesign-font-size-compact)] text-[var(--focus-accent)]">
                            ✓ {t(`chat.tasks.subtask.${subtask.status}`)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
