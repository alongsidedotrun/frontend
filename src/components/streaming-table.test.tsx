import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StreamingText } from "./streaming-text";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("a table typing in only gains rows, and the cursor never becomes one", () => {
  const rows = Array.from({ length: 12 }, (_, i) => `| item ${i} | value ${i} | note ${i} |`).join("\n");
  const text = `Here is the table:\n\n| Name | Value | Note |\n|---|---|---|\n${rows}\n\nAnd after it.`;
  const { container } = render(<StreamingText text={text} animate />);
  let last = 0;
  for (let i = 0; i < 400; i++) {
    act(() => vi.advanceTimersByTime(55));
    const trs = [...container.querySelectorAll("tr")];
    expect(trs.length).toBeGreaterThanOrEqual(last);
    last = trs.length;
    for (const tr of trs) expect(tr.textContent).not.toContain("▍");
    expect(container.textContent).not.toContain("| Name");
  }
  expect(last).toBe(13);
});
