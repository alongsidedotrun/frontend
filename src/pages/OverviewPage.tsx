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
      <div className="mx-auto flex w-full max-w-[52rem] flex-col px-6 pt-8 pb-14 sm:px-10 sm:pt-10 sm:pb-20">
        <h1 className="text-[20px] font-normal tracking-[-0.03em] text-foreground">
          {greetingForHour(now.getHours())}, {userName}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{dateLabel}</p>
      </div>
    </main>
  );
}
