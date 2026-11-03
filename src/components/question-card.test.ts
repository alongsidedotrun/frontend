import { describe, expect, it } from "vitest";
import { questionAnswers, questionsOf } from "./question-card";

describe("question card", () => {
  const input = {
    questions: [
      { question: "Which database?", header: "Database", options: [{ label: "Postgres", description: "Relational" }, { label: "SQLite" }] },
      { question: "Which tests?", multiSelect: true, options: [{ label: "Unit" }, { label: "E2E" }] },
      { question: "  ", options: [] },
    ],
  };

  it("reads only AskUserQuestion requests with real questions", () => {
    expect(questionsOf("Bash", input)).toBeNull();
    expect(questionsOf("AskUserQuestion", { questions: [] })).toBeNull();
    const questions = questionsOf("AskUserQuestion", input)!;
    expect(questions.map((q) => q.question)).toEqual(["Which database?", "Which tests?"]);
    expect(questions[1].multiSelect).toBe(true);
  });

  it("answers by question text, picks and typed text together", () => {
    const questions = questionsOf("AskUserQuestion", input)!;
    expect(questionAnswers(questions, { 0: ["SQLite"], 1: ["Unit", "E2E"] }, { 1: " smoke " })).toEqual({
      "Which database?": ["SQLite"],
      "Which tests?": ["Unit", "E2E", "smoke"],
    });
    expect(questionAnswers(questions, {}, { 0: "  " })).toEqual({});
  });
});
