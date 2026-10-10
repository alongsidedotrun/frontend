import { useEffect, useMemo, useState } from "react";
import { useUserDisplayName } from "@/lib/user";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function nextHourDelay(now: Date) {
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

/** The redesign's workspace landing page. */
export function OverviewPage() {
  const userName = useUserDisplayName();
  const [now, setNow] = useState(() => new Date());
  // Task persistence has not landed yet. Keep the view ready for it without
  // presenting made-up tasks in the new workspace overview.
  const tasksDueToday = 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), nextHourDelay(now));
    return () => window.clearTimeout(timer);
  }, [now]);

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now),
    [now],
  );

  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[52rem] flex-col px-6 pt-4 pb-14 sm:px-10 sm:pt-5 sm:pb-20">
        <h1 className="text-[20px] tracking-normal text-foreground">
          {greetingForHour(now.getHours())}, {userName}
        </h1>
        <div className="mt-1 flex items-baseline gap-1.5">
          <h2 className="text-[14px] tracking-normal text-muted-foreground">{dateLabel}</h2>
          <span aria-hidden="true" className="text-[14px] text-muted-foreground/30">·</span>
          <p className="text-[14px] text-muted-foreground/30">
            {tasksDueToday === 0
              ? "No tasks due today"
              : `${tasksDueToday} ${tasksDueToday === 1 ? "task" : "tasks"} due today`}
          </p>
        </div>
      </div>
    </main>
  );
}
