import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareChatDialog } from "@/components/design-system/share-chat-dialog";
import { mockFetch } from "@/test/fetch-mock";

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/auth", () => ({ useIsSignedIn: () => auth.signedIn }));
const signIn = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/lib/use-sign-in", () => ({ openSignInDialog: signIn.open }));

const CHAT = "chat-1";
const DISCLOSURE = "Sharing sends this chat through Alongside's relay.";
const inFifteen = () => Math.floor(Date.now() / 1000) + 15 * 60;

// A backend for one chat: not shared until started (asking for the disclosure
// first), then a chat ID, a code and two members.
function backend(options: { sharedBefore?: boolean; startError?: string; staysDisconnected?: boolean; removeFails?: boolean; waiting?: boolean } = {}) {
  let syncing = false;
  let code: { code: string; status: string; expires_at: number } | null = null;
  let waiting = options.waiting ? [{ request_id: "req-1", actor: "acct-bob", name: "Bob", created_at: 0, expires_at: 0 }] : [];
  let members = [{ id: "acct-gio", name: "Gio", role: "owner", online: true }, { id: "acct-alice", name: "Alice", role: "editor", online: false }];
  return mockFetch(({ method, path, body }) => {
    if (path === `/sessions/${CHAT}/relay/status`) return { body: { syncing, chat_id: syncing || options.sharedBefore ? "7KQ2M-9XF4T" : null } };
    if (path === `/sessions/${CHAT}/relay/start`) {
      if (options.startError) return { status: 502, body: { error: options.startError } };
      if (!(body as { acknowledged_disclosure?: boolean }).acknowledged_disclosure) return { status: 428, body: { error: "disclosure_required", disclosure: DISCLOSURE } };
      syncing = !options.staysDisconnected;
      return { body: { relay_session_id: "7KQ2M-9XF4T" } };
    }
    if (path === `/sessions/${CHAT}/relay/code` && method === "POST") {
      code = { code: "K7QF-2M9X", status: "active", expires_at: inFifteen() };
      return { body: code };
    }
    if (path === `/sessions/${CHAT}/relay/code` && method === "GET") return { body: code };
    if (path === `/sessions/${CHAT}/relay/code` && method === "DELETE") {
      code = null;
      return { status: 204 };
    }
    if (path === `/sessions/${CHAT}/relay/members`) return { body: members };
    if (path === `/sessions/${CHAT}/relay/members/acct-alice` && method === "DELETE") {
      if (options.removeFails) return { status: 502, body: { error: "relay_request_failed" } };
      members = members.filter((m) => m.id !== "acct-alice");
      return { status: 204 };
    }
    if (path === `/sessions/${CHAT}/relay/join-requests`) return { body: waiting };
    if (path === `/sessions/${CHAT}/relay/join-requests/req-1/approve` && method === "POST") {
      waiting = [];
      members = [...members, { id: "acct-bob", name: "Bob", role: "editor", online: false }];
      return { status: 204 };
    }
    if (path === `/sessions/${CHAT}/relay/stop`) {
      syncing = false;
      return { status: 204 };
    }
    return undefined;
  });
}

const renderDialog = () => render(<ShareChatDialog sessionId={CHAT} open onOpenChange={() => {}} />);

beforeEach(() => {
  auth.signedIn = true;
  signIn.open.mockReset();
});

describe("Share chat dialog (#213, #459)", () => {
  it("asks a signed-out person to sign in first", async () => {
    auth.signedIn = false;
    backend();
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(signIn.open).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Start sharing" })).not.toBeInTheDocument();
  });

  it("shows the relay disclosure before the first share, then the chat ID and a fresh code", async () => {
    const calls = backend();
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    expect(await screen.findByText(DISCLOSURE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /agree/i }));

    expect(await screen.findByText("7KQ2M-9XF4T")).toBeInTheDocument();
    expect(await screen.findByText("K7QF-2M9X")).toBeInTheDocument();
    expect(screen.getByText("Works once, for 15 more minutes")).toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith("/relay/start")).map((c) => c.body)).toEqual([{}, { acknowledged_disclosure: true }]);
  });

  it("lists who has access, and revokes the code", async () => {
    const calls = backend();
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Editor · Offline")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path.endsWith("/relay/code"))).toBe(true));
    expect(await screen.findByText("None")).toBeInTheDocument();
    expect(screen.queryByText("K7QF-2M9X")).not.toBeInTheDocument();
  });

  it("makes a new code on request, replacing the shown one", async () => {
    const calls = backend();
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    await screen.findByText("K7QF-2M9X");
    await userEvent.click(screen.getByRole("button", { name: "New code" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST" && c.path.endsWith("/relay/code"))).toHaveLength(2));
  });

  it("keeps a chat's earlier chat ID when sharing again", async () => {
    const calls = backend({ sharedBefore: true });
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    await screen.findByText("7KQ2M-9XF4T");
    expect(calls.find((c) => c.path.endsWith("/relay/start"))?.body).toEqual({ relay_session_id: "7KQ2M-9XF4T" });
  });

  it("offers a new chat ID when the relay has dropped the old one", async () => {
    const calls = backend({ sharedBefore: true, staysDisconnected: true });
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Share with a new chat ID" }));
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/relay/start")).at(-1)?.body).toEqual({}));
  });

  it("shows ALS-018 when the relay can't be reached", async () => {
    backend({ startError: "relay_unavailable" });
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("(ALS-018)");
  });

  it("stops sharing", async () => {
    const calls = backend();
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Stop sharing" }));
    expect(await screen.findByRole("button", { name: "Start sharing" })).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith("/relay/stop"))).toBe(true);
  });

  it("removes someone after a second click, and never offers to remove the owner", async () => {
    const calls = backend();
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    await screen.findByText("Alice");
    expect(screen.queryByRole("button", { name: "Remove Gio" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove Alice" }));
    expect(calls.some((c) => c.method === "DELETE" && c.path.includes("/relay/members/"))).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Remove from chat" }));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "DELETE" && c.path.endsWith("/relay/members/acct-alice"))).toBe(true);
  });

  it("shows ALS-026 when removing someone fails, and keeps them listed", async () => {
    backend({ removeFails: true });
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Remove Alice" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove from chat" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't remove Alice. Try again. (ALS-026)");
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("lists who is waiting to join, and lets them in", async () => {
    const calls = backend({ waiting: true });
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Start sharing" }));
    await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
    expect(await screen.findByText("Waiting to join")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Let in" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/join-requests/req-1/approve"))).toBe(true));
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Waiting to join")).not.toBeInTheDocument());
  });
});
