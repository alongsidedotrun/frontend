import { describe, expect, it } from "vitest";
import { taskListAfterTurn } from "./task-list-state";

describe("taskListAfterTurn", () => {
  it("dismisses a completed task list", () => {
    expect(taskListAfterTurn({ title: "Tasks", tasks: [
      { id: "build", status: "completed" },
      { id: "publish", status: "completed" },
    ] })).toBeNull();
  });

  it("keeps unfinished work available", () => {
    const list = { title: "Tasks", tasks: [
      { id: "build", status: "completed" },
      { id: "publish", status: "inProgress" },
    ] };
    expect(taskListAfterTurn(list)).toBe(list);
  });

  it("does not turn an empty or absent list into a new state", () => {
    const empty = { title: "Tasks", tasks: [] as { id: string; status: string }[] };
    expect(taskListAfterTurn(empty)).toBe(empty);
    expect(taskListAfterTurn(null)).toBeNull();
  });
});
