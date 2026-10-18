import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueuedMessages } from "@/components/queued-messages";
import type { QueuedMessage } from "@/lib/message-queue";

const message = (id: string, text: string, images: QueuedMessage["images"] = []): QueuedMessage => ({ id, text, images, effort: "medium", mode: "ask" });

describe("Queued messages", () => {
  it("lists what's waiting, and steers or removes one", async () => {
    const onSteer = vi.fn();
    const onRemove = vi.fn();
    render(<QueuedMessages items={[message("a", "check the tests"), message("b", "then deploy")]} onSteer={onSteer} onRemove={onRemove} onEdit={() => {}} />);

    expect(screen.getByText("check the tests")).toBeInTheDocument();
    expect(screen.getByText("then deploy")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Steer" })[0]);
    expect(onSteer).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));

    await userEvent.click(screen.getAllByRole("button", { name: "Remove from queue" })[1]);
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  it("only waits where the provider can't steer, or the message has images", () => {
    const { rerender } = render(<QueuedMessages items={[message("a", "hello")]} onRemove={() => {}} onEdit={() => {}} />);
    expect(screen.queryByRole("button", { name: "Steer" })).not.toBeInTheDocument();

    rerender(<QueuedMessages items={[message("a", "hello", [{ id: "i", name: "shot.png", dataUrl: "data:," }])]} onSteer={() => {}} onRemove={() => {}} onEdit={() => {}} />);
    expect(screen.queryByRole("button", { name: "Steer" })).not.toBeInTheDocument();
  });
});
