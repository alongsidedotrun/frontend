import { describe, expect, it } from "vitest";
import { addTurnText } from "./turn-reply";

type Row =
  | { kind: "agent"; id: string; text: string; time: string; turnRowId?: string; continued?: boolean }
  | { kind: "tool"; id: string }
  | { kind: "permission"; id: string }
  | { kind: "human"; id: string };

const agent = (id: string, text: string): Extract<Row, { kind: "agent" }> => ({ kind: "agent", id, text, time: id });

describe("addTurnText", () => {
  it("adds later text of a turn to its one reply", () => {
    const rows: Row[] = [{ kind: "human", id: "h" }, agent("a1", "I'll check.")];
    const out = addTurnText<Row, Extract<Row, { kind: "agent" }>>(rows, "a1", agent("a2", "Done."));
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: "a1", text: "I'll check.\n\nDone.", time: "a2" });
  });

  it("joins across a permission row, which the log doesn't draw", () => {
    const rows: Row[] = [agent("a1", "One."), { kind: "permission", id: "p" }];
    const out = addTurnText<Row, Extract<Row, { kind: "agent" }>>(rows, "a1", agent("a2", "Two."));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "a1", text: "One.\n\nTwo." });
  });

  it("continues the same reply after a file edit card", () => {
    const rows: Row[] = [agent("a1", "Editing."), { kind: "tool", id: "t" }];
    const out = addTurnText<Row, Extract<Row, { kind: "agent" }>>(rows, "a1", agent("a2", "Edited."));
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ id: "a1", continued: true });
    expect(out[2]).toMatchObject({ id: "a2", turnRowId: "a1", text: "Edited." });
    // A third part joins the continuation, not the first part.
    const out2 = addTurnText<Row, Extract<Row, { kind: "agent" }>>(out, "a1", agent("a3", "All set."));
    expect(out2).toHaveLength(3);
    expect(out2[2]).toMatchObject({ id: "a2", text: "Edited.\n\nAll set." });
  });

  it("starts the reply when the turn's row is gone", () => {
    const out = addTurnText<Row, Extract<Row, { kind: "agent" }>>([], "a1", agent("a2", "Hi."));
    expect(out).toEqual([agent("a2", "Hi.")]);
  });
});
