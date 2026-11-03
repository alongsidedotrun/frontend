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

  it("history shows in full at once", () => {
    const { container } = render(<TypedText text="already settled text here" animate={false} />);
    expect(container.textContent).toBe("already settled text here");
  });
});
