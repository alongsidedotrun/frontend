import { describe, expect, it } from "vitest";
import { addTurnText } from "./turn-reply";

type Row =
  | { kind: "agent"; id: string; text: string; time: string; turnRowId?: string; continued?: boolean; textAt?: number; notes?: { text: string; at: number }[] }
  | { kind: "tool"; id: string }
  | { kind: "permission"; id: string }
  | { kind: "human"; id: string };

const agent = (id: string, text: string): Extract<Row, { kind: "agent" }> => ({ kind: "agent", id, text, time: id });

describe("addTurnText", () => {
  it("folds a turn's earlier text into its Working steps and keeps the newest as the reply", () => {
    const rows: Row[] = [{ kind: "human", id: "h" }, { ...agent("a1", "I'll check."), textAt: 0 }];
    const out = addTurnText<Row, Extract<Row, { kind: "agent" }>>(rows, "a1", { ...agent("a2", "Found it."), textAt: 2 });
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: "a1", text: "Found it.", time: "a2", textAt: 2, notes: [{ text: "I'll check.", at: 0 }] });
    const out2 = addTurnText<Row, Extract<Row, { kind: "agent" }>>(out, "a1", { ...agent("a3", "Done."), textAt: 3 });
    expect(out2[1]).toMatchObject({ text: "Done.", notes: [{ text: "I'll check.", at: 0 }, { text: "Found it.", at: 2 }] });
  });

  it("joins across a permission row, which the log doesn't draw", () => {
    const rows: Row[] = [agent("a1", "One."), { kind: "permission", id: "p" }];
    const out = addTurnText<Row, Extract<Row, { kind: "agent" }>>(rows, "a1", agent("a2", "Two."));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "a1", text: "Two.", notes: [{ text: "One.", at: 0 }] });
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
