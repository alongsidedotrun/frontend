import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttachmentView } from "@/pages/ChatPage";
import { mockFetch } from "@/test/fetch-mock";

const png = { file_id: "f1", name: "diagram.png", media_type: "image/png", size: 2048 };

describe("a file in a shared chat (#460)", () => {
  it("shows a received picture from this device's own copy", async () => {
    mockFetch(({ path }) => (path === "/sessions/chat-1/relay/files/f1" ? { body: "bytes" } : undefined));
    render(<AttachmentView sessionId="chat-1" file={png} sender="Alice" mine={false} />);
    expect(await screen.findByRole("img", { name: "diagram.png" })).toHaveAttribute("src", "/sessions/chat-1/relay/files/f1");
  });

  it("says it's on its way while it's still being fetched", async () => {
    mockFetch(() => ({ status: 404, body: { state: "pending" } }));
    render(<AttachmentView sessionId="chat-1" file={png} sender="Alice" mine={false} />);
    expect(await screen.findByText("Receiving")).toBeInTheDocument();
  });

  it("asks for it again when it expired before it arrived", async () => {
    mockFetch(() => ({ status: 404, body: { state: "expired" } }));
    render(<AttachmentView sessionId="chat-1" file={png} sender="Alice" mine={false} />);
    expect(await screen.findByText("This expired before it reached you. Ask Alice to send it again.")).toBeInTheDocument();
  });

  it("offers any other kind of file to save", async () => {
    mockFetch(() => ({ body: "bytes" }));
    render(<AttachmentView sessionId="chat-1" file={{ file_id: "f2", name: "notes.pdf", media_type: "application/pdf", size: 3 * 1024 * 1024 }} sender="Alice" mine={false} />);
    const link = await screen.findByRole("link", { name: /notes\.pdf/ });
    expect(link).toHaveAttribute("download", "notes.pdf");
    expect(link).toHaveTextContent("3.0 MB");
  });
});
