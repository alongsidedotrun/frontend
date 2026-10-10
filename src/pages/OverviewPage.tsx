import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, Circle, Plus } from "lucide-react";
import { useUserDisplayName } from "@/lib/user";

type TaskBucket = "today" | "week" | "later";

type OverviewTask = {
  id: string;
  title: string;
  bucket: TaskBucket;
  completed: boolean;
};

type RecentSession = { id: string; name: string };

type Mention = {
  id: number;
  chat_id: string;
  chat_name: string;
  sender: string;
  content: string;
};

const OVERVIEW_TASKS_KEY = "alongside_overview_tasks";

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

function loadTasks(): OverviewTask[] {
  try {
    const stored = localStorage.getItem(OVERVIEW_TASKS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((task): task is OverviewTask =>
        typeof task?.id === "string"
        && typeof task?.title === "string"
        && ["today", "week", "later"].includes(task?.bucket)
        && typeof task?.completed === "boolean",
      )
      : [];
  } catch {
    return [];
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function TaskCount({ count }: { count: number }) {
  return <span className="rounded-md border border-border px-1.5 py-px text-xs text-muted-foreground">{count}</span>;
}

/** The redesign's workspace landing page. */
export function OverviewPage() {
  const navigate = useNavigate();
  const userName = useUserDisplayName();
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState<OverviewTask[]>(loadTasks);
  const [taskTitle, setTaskTitle] = useState("");
  const [todayOpen, setTodayOpen] = useState(true);
  const [weekOpen, setWeekOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), nextHourDelay(now));
    return () => window.clearTimeout(timer);
  }, [now]);

  useEffect(() => {
    localStorage.setItem(OVERVIEW_TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    void Promise.all([
      fetch("/sessions").then((response) => response.ok ? response.json() as Promise<RecentSession[]> : []),
      fetch("/inbox-mentions").then((response) => response.ok ? response.json() as Promise<Mention[]> : []),
    ])
      .then(([sessions, loadedMentions]) => {
        setRecentSessions(sessions.slice(0, 6));
        setMentions(loadedMentions.slice(0, 6));
      })
      .catch(() => {
        setRecentSessions([]);
        setMentions([]);
      });
  }, []);

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now),
    [now],
  );
  const byBucket = (bucket: TaskBucket) => tasks.filter((task) => task.bucket === bucket);
  const todayTasks = byBucket("today");
  const weekTasks = byBucket("week");
  const laterTasks = byBucket("later");
  const tasksDueToday = todayTasks.filter((task) => !task.completed).length;

  function addTodayTask() {
    const title = taskTitle.trim();
    if (!title) return;
    setTasks((current) => [...current, {
      id: crypto.randomUUID(),
      title,
      bucket: "today",
      completed: false,
    }]);
    setTaskTitle("");
  }

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
  }

  function taskRows(items: OverviewTask[]) {
    return items.map((task) => (
      <button
        key={task.id}
        type="button"
        onClick={() => toggleTask(task.id)}
        className="flex h-10 w-full items-center gap-2.5 border-t border-border px-3 text-left text-[15px] transition-colors hover:bg-muted/40"
      >
        {task.completed
          ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Check className="size-3" strokeWidth={2.5} /></span>
          : <Circle className="size-5 shrink-0 text-muted-foreground/55" strokeWidth={1.8} />}
        <span className={task.completed ? "text-muted-foreground line-through" : "text-foreground"}>{task.title}</span>
      </button>
    ));
  }

  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[52rem] flex-col px-6 pt-6 pb-14 sm:px-10 sm:pt-8">
        <h1 className="text-[20px] tracking-normal text-foreground">
          {greetingForHour(now.getHours())}, {userName}
        </h1>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-[14px] text-muted-foreground">{dateLabel}</p>
          <span aria-hidden="true" className="text-[14px] text-muted-foreground/70">·</span>
          <p className="text-[14px] text-muted-foreground/70">
            {tasksDueToday === 0
              ? "No tasks due today"
              : `${tasksDueToday} ${tasksDueToday === 1 ? "task" : "tasks"} due today`}
          </p>
        </div>

        <section className="mt-8" aria-labelledby="overview-tasks-heading">
          <h2 id="overview-tasks-heading" className="text-[18px] tracking-normal text-foreground">My tasks</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            <button type="button" onClick={() => setTodayOpen((open) => !open)} className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-[16px] hover:bg-muted/30">
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${todayOpen ? "" : "-rotate-90"}`} />
              <span className="flex-1">Today</span>
              <TaskCount count={todayTasks.filter((task) => !task.completed).length} />
            </button>
            {todayOpen && <>
              <div className="flex h-10 items-center gap-2.5 border-t border-border px-3">
                <Plus className="size-4 shrink-0 text-muted-foreground/60" />
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") addTodayTask(); }}
                  placeholder="Add a task for today and press Enter"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              {taskRows(todayTasks)}
            </>}
            <button type="button" onClick={() => setWeekOpen((open) => !open)} className="flex h-10 w-full items-center gap-2.5 border-t border-border px-3 text-left text-[16px] hover:bg-muted/30">
              <ChevronRight className={`size-4 text-muted-foreground transition-transform ${weekOpen ? "rotate-90" : ""}`} />
              <span className="flex-1">This week</span>
              <TaskCount count={weekTasks.filter((task) => !task.completed).length} />
            </button>
            {weekOpen && taskRows(weekTasks)}
            <button type="button" onClick={() => setLaterOpen((open) => !open)} className="flex h-10 w-full items-center gap-2.5 border-t border-border px-3 text-left text-[16px] hover:bg-muted/30">
              <ChevronRight className={`size-4 text-muted-foreground transition-transform ${laterOpen ? "rotate-90" : ""}`} />
              <span className="flex-1">Later</span>
              <TaskCount count={laterTasks.filter((task) => !task.completed).length} />
            </button>
            {laterOpen && taskRows(laterTasks)}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="overview-recent-heading">
          <h2 id="overview-recent-heading" className="text-[18px] tracking-normal text-foreground">Recently visited</h2>
          {recentSessions.length > 0 ? (
            <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
              {recentSessions.map((session) => (
                <button key={session.id} type="button" onClick={() => navigate(`/chat/${session.id}`)} className="w-[15rem] shrink-0 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-muted/30">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-focus-accent/15 text-sm font-medium text-focus-accent">{session.name.slice(0, 1).toUpperCase()}</span>
                  <p className="mt-5 truncate text-[16px] text-foreground">{session.name}</p>
                  <p className="mt-1 text-[14px] text-muted-foreground/70">Chat</p>
                </button>
              ))}
            </div>
          ) : <p className="mt-4 text-[14px] text-muted-foreground/70">Chats you open will appear here.</p>}
        </section>

        <section className="mt-8" aria-labelledby="overview-mentions-heading">
          <h2 id="overview-mentions-heading" className="text-[18px] tracking-normal text-foreground">Recent mentions</h2>
          {mentions.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              {mentions.map((mention, index) => (
                <button key={mention.id} type="button" onClick={() => navigate(`/chat/${mention.chat_id}`)} className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30 ${index ? "border-t border-border" : ""}`}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-focus-accent/15 text-[13px] text-focus-accent">{initials(mention.sender)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] text-foreground">{mention.sender} in {mention.chat_name}</span>
                    <span className="mt-1 block truncate text-[14px] text-muted-foreground/70">{mention.content}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : <p className="mt-4 text-[14px] text-muted-foreground/70">New mentions will appear here.</p>}
        </section>
      </div>
    </main>
  );
}
