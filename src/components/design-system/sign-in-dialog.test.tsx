import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SignInDialog } from "@/components/design-system/sign-in-dialog";
import { mockFetch } from "@/test/fetch-mock";

// The backend's email sign-in: an address with an account gets a code; one without is answered
// `new_account` and needs a name first (/identity/email/sign-up).
function backend(existing: string[] = []) {
  return mockFetch(({ path, body }) => {
    if (path === "/identity/email/start") {
      const { email } = body as { email: string };
      return { body: { status: existing.includes(email) ? "code_sent" : "new_account" } };
    }
    if (path === "/identity/email/sign-up") return { body: { status: "code_sent" } };
    return undefined;
  });
}

const renderDialog = () => render(<SignInDialog open onOpenChange={() => {}} />);

describe("Sign in (email)", () => {
  it("sends a code straight away to an email that has an account", async () => {
    backend(["gio@example.com"]);
    renderDialog();
    await userEvent.type(await screen.findByLabelText("Email"), "gio@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
  });

  it("asks a new email for a name, with the email prefilled and changeable, then creates the account", async () => {
    const calls = backend();
    renderDialog();
    await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));

    expect(await screen.findByText("Create your account")).toBeInTheDocument();
    // The name step slides in once the email step has left.
    const firstName = await screen.findByLabelText("Name");
    const address = screen.getByLabelText("Email");
    expect(address).toHaveValue("new@example.com");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

    await userEvent.type(firstName, "Gio");
    await userEvent.type(screen.getByLabelText("Surname"), "Andrade");
    await userEvent.clear(address);
    await userEvent.type(address, "gio@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(calls.find((c) => c.path === "/identity/email/sign-up")?.body).toMatchObject({ email: "gio@example.com", first_name: "Gio", last_name: "Andrade" }));
    // Language and timezone go with it, detected from the system.
    const sent = calls.find((c) => c.path === "/identity/email/sign-up")?.body as { language: string; timezone: string };
    expect(sent.language).toBeTruthy();
    expect(sent.timezone).toBeTruthy();
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
  });

  it("goes back to the start on Cancel instead of creating the account", async () => {
    const calls = backend();
    renderDialog();
    await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    await screen.findByText("Create your account");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Continue with email" })).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/identity/email/sign-up")).toBe(false);
  });
});
