import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypedText } from "./streaming-text";

const tick = (n: number) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(55));
};
const TEXT = "one two three four five six seven eight nine ten eleven twelve";

describe("typing progress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("types word by word, and a later view of the same text carries on from there", () => {
    const step = render(<TypedText text={TEXT} animate />);
    expect(step.container.textContent).toBe("");
    tick(4);
    const typed = step.container.textContent!;
    expect(typed.split(" ").length).toBeGreaterThan(1);
    expect(typed.length).toBeLessThan(TEXT.length);
    // The turn ends: the live step goes, the reply takes over the same text.
    step.unmount();
    const reply = render(<TypedText text={TEXT} animate />);
    expect(reply.container.textContent).toBe(typed);
    tick(20);
    expect(reply.container.textContent).toBe(TEXT);
  });

  it("a different text that only shares its start doesn't show the other's words", () => {
    const start = "this step starts with the very same eighty characters as another step does here ok";
    const first = render(<TypedText text={`${start} and then goes on about one thing`} animate />);
    tick(200);
    first.unmount();
    const second = render(<TypedText text={`${start} but says another`} animate />);
    // It may carry on through the shared start, never past it.
    expect(`${start} but says another`.startsWith(second.container.textContent!)).toBe(true);
    expect(second.container.textContent).not.toContain("goes");
    tick(200);
    expect(second.container.textContent).toBe(`${start} but says another`);
  });

  it("history shows in full at once", () => {
    const { container } = render(<TypedText text="already settled text here" animate={false} />);
    expect(container.textContent).toBe("already settled text here");
  });
});
