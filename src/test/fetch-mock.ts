import { vi } from "vitest";

export type Call = { method: string; path: string; body: unknown };
type Handler = (call: Call) => { status?: number; body?: unknown } | undefined;

// A fetch that answers from `handler` and records every call, so a test can
// assert both what the UI showed and what it asked the backend for.
export function mockFetch(handler: Handler): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://app.test");
    const call = { method: init?.method ?? "GET", path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const answer = handler(call) ?? { status: 404, body: { error: "not_found" } };
    const status = answer.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(answer.body ?? null), { status, headers: { "content-type": "application/json" } });
  });
  return calls;
}
