import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { JoinRequestsCard } from "@/components/design-system/join-requests-card";
import { RELAY_JOIN_REQUESTED_EVENT } from "@/lib/use-share";
import { mockFetch } from "@/test/fetch-mock";

const alice = { chat_id: "chat-1", chat_name: "Relay test", request_id: "req-1", actor: "acct-alice", name: "Alice", created_at: 0, expires_at: 0 };

function backend(options: { decideFails?: boolean } = {}) {
  let waiting = [alice];
  const calls = mockFetch(({ method, path }) => {
    if (path === "/relay/join-requests") return { body: waiting };
    if (method === "POST" && path.startsWith("/sessions/chat-1/relay/join-requests/req-1/")) {
      if (options.decideFails) return { status: 502, body: { error: "relay_unavailable" } };
      waiting = [];
      return { status: 204 };
    }
    return undefined;
  });
  return { calls, add: () => (waiting = [alice]) };
}

describe("Waiting to join, in the sidebar (#460)", () => {
  it("shows who wants to join which chat, and lets them in", async () => {
    const { calls } = backend();
    render(<JoinRequestsCard enabled />);
    expect(await screen.findByText("Alice wants to join “Relay test”")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Let in" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/req-1/approve"))).toBe(true));
    await waitFor(() => expect(screen.queryByText(/wants to join/)).not.toBeInTheDocument());
  });

  it("turns someone away", async () => {
    const { calls } = backend();
    render(<JoinRequestsCard enabled />);
    await userEvent.click(await screen.findByRole("button", { name: "Deny" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/req-1/deny"))).toBe(true));
  });

  it("shows ALS-029 when answering doesn't work", async () => {
    backend({ decideFails: true });
    render(<JoinRequestsCard enabled />);
    await userEvent.click(await screen.findByRole("button", { name: "Let in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't answer Alice's request. Try again. (ALS-029)");
  });

  it("refreshes at once when the backend says someone asked", async () => {
    const { calls } = backend();
    render(<JoinRequestsCard enabled />);
    await screen.findByText(/wants to join/);
    const before = calls.filter((c) => c.path === "/relay/join-requests").length;
    window.dispatchEvent(new Event(RELAY_JOIN_REQUESTED_EVENT));
    await waitFor(() => expect(calls.filter((c) => c.path === "/relay/join-requests").length).toBeGreaterThan(before));
  });

  it("asks nothing while signed out", () => {
    const { calls } = backend();
    render(<JoinRequestsCard enabled={false} />);
    expect(calls).toHaveLength(0);
  });
});
