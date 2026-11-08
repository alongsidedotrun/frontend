import type { TaskProgressItem } from "@/components/design-system/task-progress";

export type TaskListState<T extends { status: string }> = {
  title: string;
  tasks: T[];
};

export type ActiveTaskList = TaskListState<TaskProgressItem>;

// A completed list remains visible while its turn is live, then gets out of the
// compose area's way at the terminal event. Partial work stays for the next turn.
export function taskListAfterTurn<T extends { status: string }>(list: TaskListState<T> | null): TaskListState<T> | null {
  return list?.tasks.length && list.tasks.every((task) => task.status === "completed") ? null : list;
}

type ClaudeTaskTool = { id?: string; name?: string; input?: Record<string, unknown> };

export function applyClaudeTaskTool(list: ActiveTaskList | null, block: ClaudeTaskTool, title: string): ActiveTaskList | null {
  const input = block.input ?? {};
  if (block.name === "TaskCreate" && block.id) {
    const subject = typeof input.subject === "string" ? input.subject.trim() : "";
    if (!subject) return list;
    const task: TaskProgressItem = { id: block.id, title: subject, status: "pending" };
    return { title: list?.title ?? title, tasks: [...(list?.tasks ?? []), task] };
  }
  if (block.name !== "TaskUpdate") return list;
  const taskId = typeof input.taskId === "string" ? input.taskId : "";
  if (!taskId) return list;
  const status = input.status === "completed"
    ? "completed"
    : input.status === "in_progress"
      ? "inProgress"
      : input.status === "pending"
        ? "pending"
        : undefined;
  const subject = typeof input.subject === "string" && input.subject.trim() ? input.subject.trim() : undefined;
  return list && list.tasks.some((task) => task.id === taskId)
    ? { ...list, tasks: list.tasks.map((task) => task.id === taskId ? { ...task, ...(status && { status }), ...(subject && { title: subject }) } : task) }
    : list;
}

type ClaudeToolResult = { type?: string; tool_use_id?: string; content?: unknown };

export function applyClaudeTaskResults(list: ActiveTaskList | null, content: unknown): ActiveTaskList | null {
  if (!list || !Array.isArray(content)) return list;
  return content.reduce<ActiveTaskList>((current, entry) => {
    const result = entry as ClaudeToolResult;
    if (result.type !== "tool_result" || typeof result.tool_use_id !== "string" || typeof result.content !== "string") return current;
    const match = /^Task #(\d+) created successfully(?::|$)/.exec(result.content);
    if (!match) return current;
    return {
      ...current,
      tasks: current.tasks.map((task) => task.id === result.tool_use_id ? { ...task, id: match[1] } : task),
    };
  }, list);
}
