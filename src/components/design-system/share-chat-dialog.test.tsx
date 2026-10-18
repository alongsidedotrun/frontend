import { render, screen, waitFor, within } from "@testing-library/react";
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
function backend(options: { sharedBefore?: boolean; startError?: string; staysDisconnected?: boolean; removeFails?: boolean; waiting?: boolean; alone?: boolean } = {}) {
  let syncing = false;
  let code: { code: string; status: string; expires_at: number } | null = null;
  let waiting = options.waiting ? [{ request_id: "req-1", actor: "acct-bob", name: "Bob", created_at: 0, expires_at: 0 }] : [];
  let members = [{ id: "acct-gio", name: "Gio", role: "owner", online: true }, ...(options.alone ? [] : [{ id: "acct-alice", name: "Alice", role: "editor", online: false }])];
  return mockFetch(({ method, path, body }) => {
    if (path === `/sessions/${CHAT}/relay/status`) return { body: { syncing, chat_id: "7KQ2M-9XF4T", shared_before: syncing || Boolean(options.sharedBefore) } };
    if (path === `/sessions/${CHAT}/relay/start`) {
      if (options.startError) return { status: 502, body: { error: options.startError } };
      if (!(body as { acknowledged_disclosure?: boolean }).acknowledged_disclosure) return { status: 428, body: { error: "disclosure_required", disclosure: DISCLOSURE } };
      syncing = !options.staysDisconnected;
      return { body: { relay_session_id: "7KQ2M-9XF4T" } };
    }
    if (path === `/sessions/${CHAT}/relay/code` && method === "POST") {
      code = { code: "K7QF-2M9X", status: "active", expires_at: inFifteen(), role: (body as { role: string }).role } as typeof code;
      return { body: code };
    }
    if (path === `/sessions/${CHAT}/relay/code` && method === "GET") return { body: code };
    if (path === `/sessions/${CHAT}/relay/code` && method === "DELETE") {
      code = null;
      return { status: 204 };
    }
    if (path === `/sessions/${CHAT}/relay/members`) return { body: members };
    if (path === `/sessions/${CHAT}/relay/members/acct-alice` && method === "PUT") {
      members = members.map((m) => (m.id === "acct-alice" ? { ...m, role: (body as { role: string }).role } : m));
      return { status: 204 };
    }
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
// The first Invite shares the chat, after the relay disclosure.
const openManage = async () => userEvent.click(await screen.findByRole("tab", { name: "Manage members" }));
async function inviteAndAgree() {
  await userEvent.click(await screen.findByRole("button", { name: "Invite" }));
  await userEvent.click(await screen.findByRole("button", { name: /agree/i }));
}

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
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
  });

  it("opens ready to invite; the first Invite shows the relay disclosure, then shares the chat and makes a code", async () => {
    const calls = backend();
    renderDialog();
    // The chat ID it will be shared under shows before sharing.
    expect(await screen.findByText("7KQ2M-9XF4T")).toBeInTheDocument();
    // The roles, Contributor by default (it and the two below checked, Admin not); nobody to list until it's shared.
    expect(screen.getByText("Roles")).toBeInTheDocument();
    for (const name of ["Contributor", "Commenter", "Read"]) expect(screen.getByRole("checkbox", { name: new RegExp(name) })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Admin/ })).not.toBeChecked();
    expect(screen.queryByRole("heading", { name: "People with access" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByText(DISCLOSURE)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/relay/code"))).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /agree/i }));

    expect(await screen.findByText("7KQ2M-9XF4T")).toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith("/relay/start")).map((c) => c.body)).toEqual([{}, { acknowledged_disclosure: true }]);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/relay/code"))).toBe(true));
  });

  it("builds the role from the bottom up: unchecking Contributor invites as a Commenter, and Read is always on", async () => {
    const calls = backend();
    renderDialog();
    const contributor = await screen.findByRole("checkbox", { name: /Contributor/ });
    await userEvent.click(contributor);
    expect(contributor).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Commenter/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Read/ })).toBeDisabled();
    await inviteAndAgree();
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/relay/code"))?.body).toEqual({ role: "participant" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Commenter/ }));
    expect(screen.getByRole("checkbox", { name: /Read/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Commenter/ })).not.toBeChecked();
  });

  it("is pending until someone is let in, then shared", async () => {
    backend({ alone: true, waiting: true });
    renderDialog();
    await inviteAndAgree();
    expect(await screen.findByText("Pending")).toBeInTheDocument();
    await openManage();
    await userEvent.click(await screen.findByRole("button", { name: "Let in" }));
    expect(await screen.findByText("Shared")).toBeInTheDocument();
  });

  it("invites: makes a code for the chosen role and copies the chat ID and code to send", async () => {
    const calls = backend();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderDialog();
    await inviteAndAgree();

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/relay/code"))?.body).toEqual({ role: "editor" });
    const invite = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(invite).toContain("Identifier: 7KQ2M-9XF4T");
    expect(invite).toContain("Join code: K7QF-2M9X");
    expect(await screen.findByText(/Invite copied/)).toBeInTheDocument();
  });

  it("lists who has access, and revokes the code", async () => {
    const calls = backend();
    renderDialog();
    await inviteAndAgree();
    expect(await screen.findByText("K7QF-2M9X", {}, { timeout: 6000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path.endsWith("/relay/code"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("K7QF-2M9X")).not.toBeInTheDocument());

    await openManage();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    const alice = within(screen.getByText("Alice").closest("li")!);
    expect(alice.getByText("Contributor")).toBeInTheDocument();
    expect(alice.getByText("Offline")).toBeInTheDocument();
  }, 10000);

  it("keeps a chat's earlier chat ID when sharing again", async () => {
    const calls = backend({ sharedBefore: true });
    renderDialog();
    await inviteAndAgree();
    await screen.findByText("7KQ2M-9XF4T");
    expect(calls.find((c) => c.path.endsWith("/relay/start"))?.body).toEqual({ relay_session_id: "7KQ2M-9XF4T" });
  });

  it("shares with a new chat ID when the relay has dropped the old one", async () => {
    const calls = backend({ sharedBefore: true, staysDisconnected: true });
    renderDialog();
    await inviteAndAgree();
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/relay/start")).map((c) => c.body)).toEqual([{ relay_session_id: "7KQ2M-9XF4T" }, { relay_session_id: "7KQ2M-9XF4T", acknowledged_disclosure: true }, { acknowledged_disclosure: true }]));
  });

  it("shows ALS-018 when the relay can't be reached", async () => {
    backend({ startError: "relay_unavailable" });
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("(ALS-018)");
  });

  it("stops sharing", async () => {
    const calls = backend();
    renderDialog();
    await inviteAndAgree();
    await screen.findByText("Shared");
    await openManage();
    await userEvent.click(await screen.findByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(screen.queryByText("Shared")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Stop sharing" })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith("/relay/stop"))).toBe(true);
  });

  it("removes someone on Save, can be undone before, and never offers to remove the owner", async () => {
    const calls = backend();
    renderDialog();
    await inviteAndAgree();
    await screen.findByText("Shared");
    await openManage();
    await screen.findByText("Alice");
    expect(screen.queryByRole("button", { name: "Remove Gio" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove Alice" }));
    expect(screen.getByText("Removed when you save")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Alice" }));
    expect(calls.some((c) => c.method === "DELETE" && c.path.includes("/relay/members/"))).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "DELETE" && c.path.endsWith("/relay/members/acct-alice"))).toBe(true);
  });

  it("changes someone's role on Save", async () => {
    const calls = backend();
    renderDialog();
    await inviteAndAgree();
    await screen.findByText("Shared");
    await openManage();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.click(await screen.findByRole("combobox", { name: "Role for Alice" }));
    await userEvent.click(await screen.findByRole("option", { name: "Commenter" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.path.endsWith("/relay/members/acct-alice"))?.body).toEqual({ role: "participant" }));
  });

  it("shows ALS-026 when removing someone fails, and keeps them listed", async () => {
    backend({ removeFails: true });
    renderDialog();
    await inviteAndAgree();
    await screen.findByText("Shared");
    await openManage();
    await userEvent.click(await screen.findByRole("button", { name: "Remove Alice" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't remove Alice. Try again. (ALS-026)");
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("lists who is waiting to join, and lets them in", async () => {
    const calls = backend({ waiting: true });
    renderDialog();
    await inviteAndAgree();
    await openManage();
    const waitingList = within((await screen.findByText("Waiting confirmation")).closest("section")!);
    expect(await waitingList.findByText("Bob")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Let in" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/join-requests/req-1/approve"))).toBe(true));
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    await waitFor(() => expect(waitingList.getByText("No members")).toBeInTheDocument());
  });
});
