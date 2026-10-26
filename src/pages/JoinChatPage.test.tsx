import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JoinChatPage } from "@/pages/JoinChatPage";
import { mockFetch } from "@/test/fetch-mock";

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/auth", () => ({ useIsSignedIn: () => auth.signedIn }));
const signIn = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/lib/use-sign-in", () => ({ openSignInDialog: signIn.open }));

const LOCAL = "local-1";

// The backend: making the local chat, then starting the relay with the typed
// chat ID and code, answered by `refuse` (an error code) or the disclosure.
function backend(start: { refuse?: string; status?: number; disclosure?: boolean } = {}) {
  let disclosureShown = false;
  return mockFetch(({ method, path, body }) => {
    if (path === "/sessions" && method === "POST") return { body: { session_id: LOCAL } };
    if (path === `/sessions/${LOCAL}` && method === "DELETE") return { status: 204 };
    if (path === `/sessions/${LOCAL}/relay/start`) {
      const ack = (body as { acknowledged_disclosure?: boolean }).acknowledged_disclosure;
      if (start.disclosure && !ack && !disclosureShown) {
        disclosureShown = true;
        return { status: 428, body: { error: "disclosure_required", disclosure: "Joining sends your messages through the relay." } };
      }
      if (start.refuse) return { status: start.status ?? 403, body: { error: start.refuse } };
      // #460: asking to join waits for the owner or an editor to let this person in.
      return { status: 202, body: { status: "waiting", request_id: "req-1", relay_session_id: "7KQ2M-9XF4T", expires_at: 0 } };
    }
    return undefined;
  });
}

function renderDialog() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<JoinChatPage />} />
        <Route path="/chat/:id" element={<p>chat page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function typeBoth(chatId = "7kq2m 9xf4t", code = "k7qf2m9x") {
  await userEvent.type(await screen.findByLabelText("Identifier"), chatId);
  await userEvent.type(screen.getByLabelText("Join code"), code);
}

beforeEach(() => {
  auth.signedIn = true;
  signIn.open.mockReset();
});

describe("Join chat page (#213, #459)", () => {
  it("asks a signed-out person to sign in first", async () => {
    auth.signedIn = false;
    backend();
    renderDialog();
    expect(await screen.findByText("You will be able to join a chat once you have created your account.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Identifier")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Join code")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signIn.open).toHaveBeenCalled();
  });

  it("needs both a full chat ID and a full code, shown in their usual shape", async () => {
    backend();
    renderDialog();
    const join = await screen.findByRole("button", { name: "Join" });
    await userEvent.type(screen.getByLabelText("Identifier"), "7kq2m9xf4t");
    expect(screen.getByLabelText("Identifier")).toHaveValue("7KQ2M-9XF4T");
    expect(join).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Join code"), "k7qf2m9");
    expect(join).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Join code"), "x");
    expect(screen.getByLabelText("Join code")).toHaveValue("K7QF-2M9X");
    expect(join).toBeEnabled();
  });

  it("asks to join with the chat ID and code, then opens the new chat, where it waits to be let in", async () => {
    const calls = backend();
    renderDialog();
    await typeBoth();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("chat page")).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith("/relay/start"))?.body).toEqual({ relay_session_id: "7KQ2M-9XF4T", join_code: "K7QF-2M9X" });
  });

  it("shows the disclosure the first time, and agreeing retries the same local chat", async () => {
    const calls = backend({ disclosure: true });
    renderDialog();
    await typeBoth();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("Joining sends your messages through the relay.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /agree/i }));
    expect(await screen.findByText("chat page")).toBeInTheDocument();
    expect(calls.filter((c) => c.path === "/sessions" && c.method === "POST")).toHaveLength(1);
  });

  for (const [refuse, status, tag] of [
    ["invalid_join_code", 403, "ALS-021"],
    ["join_code_expired", 403, "ALS-022"],
    ["join_code_used", 403, "ALS-023"],
    ["too_many_attempts", 429, "ALS-024"],
    ["already_member", 409, "ALS-029"],
    ["relay_unavailable", 502, "ALS-018"],
    ["something_else", 500, "ALS-025"],
  ] as const) {
    it(`shows ${tag} for ${refuse} and leaves no empty chat behind`, async () => {
      const calls = backend({ refuse, status });
      renderDialog();
      await typeBoth();
      await userEvent.click(screen.getByRole("button", { name: "Join" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(`(${tag})`);
      await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === `/sessions/${LOCAL}`)).toBe(true));
    });
  }

  it("clears the error once the person edits a field", async () => {
    backend({ refuse: "invalid_join_code" });
    renderDialog();
    await typeBoth();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByRole("alert");
    await userEvent.type(screen.getByLabelText("Join code"), "{backspace}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
