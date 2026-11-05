import { describe, expect, it } from "vitest";
import { applyClaudeTaskResults, applyClaudeTaskTool, taskListAfterTurn } from "./task-list-state";

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

describe("Claude task events", () => {
  it("folds TaskCreate results and TaskUpdate calls into one replayable list", () => {
    let list = applyClaudeTaskTool(null, {
      id: "toolu_create",
      name: "TaskCreate",
      input: { subject: "Build Alpha.42", description: "Build it" },
    }, "Tasks");
    expect(list?.tasks).toEqual([{ id: "toolu_create", title: "Build Alpha.42", status: "pending" }]);

    list = applyClaudeTaskResults(list, [{
      type: "tool_result",
      tool_use_id: "toolu_create",
      content: "Task #7 created successfully: Build Alpha.42",
    }]);
    list = applyClaudeTaskTool(list, {
      id: "toolu_update",
      name: "TaskUpdate",
      input: { taskId: "7", status: "in_progress" },
    }, "Tasks");
    expect(list?.tasks).toEqual([{ id: "7", title: "Build Alpha.42", status: "inProgress" }]);

    list = applyClaudeTaskTool(list, {
      id: "toolu_done",
      name: "TaskUpdate",
      input: { taskId: "7", status: "completed" },
    }, "Tasks");
    expect(list?.tasks[0].status).toBe("completed");
  });

  it("ignores ordinary tools and unrelated results", () => {
    expect(applyClaudeTaskTool(null, { id: "bash", name: "Bash", input: {} }, "Tasks")).toBeNull();
    expect(applyClaudeTaskResults(null, [])).toBeNull();
  });
});
