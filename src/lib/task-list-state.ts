export type TaskListState<T extends { status: string }> = {
  title: string;
  tasks: T[];
};

// A completed list remains visible while its turn is live, then gets out of the
// compose area's way at the terminal event. Partial work stays for the next turn.
export function taskListAfterTurn<T extends { status: string }>(list: TaskListState<T> | null): TaskListState<T> | null {
  return list?.tasks.length && list.tasks.every((task) => task.status === "completed") ? null : list;
}
