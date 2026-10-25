import { useCallback, useEffect, useState } from "react";
import type { BotAvatar } from "@/components/bot-face";

// Your bots (#504): a specialist with a name, its instructions and its look. You talk to each one in its
// own ongoing chat (chat_id, once it's been opened); the sidebar lists them under Bots.
export type Bot = {
  id: string;
  name: string;
  instructions: string;
  avatar: BotAvatar | null;
  favourite: boolean;
  created_at: string;
  chat_id: string | null;
};

export type BotError = "invalid_name" | "invalid_instructions" | "name_taken" | "failed";

// Every useBots() reloads when one of them changes the list.
const CHANGED = "alongside:bots-changed";
const changed = () => window.dispatchEvent(new Event(CHANGED));

async function errorOf(response: Response | null): Promise<BotError> {
  const body = (await response?.json().catch(() => null)) as { error?: BotError } | null;
  return body?.error ?? "failed";
}

async function send(path: string, method: string, body?: unknown): Promise<Response | null> {
  return fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
}

export async function createBot(name: string, instructions: string, avatar: BotAvatar): Promise<Bot | BotError> {
  const response = await send("/bots", "POST", { name, instructions, avatar });
  if (!response?.ok) return errorOf(response);
  changed();
  return (await response.json()) as Bot;
}

export async function updateBot(id: string, changes: Partial<Pick<Bot, "name" | "instructions" | "avatar" | "favourite">>): Promise<BotError | null> {
  const response = await send(`/bots/${encodeURIComponent(id)}`, "PATCH", changes);
  if (!response?.ok) return errorOf(response);
  changed();
  return null;
}

export async function deleteBot(id: string): Promise<boolean> {
  const response = await send(`/bots/${encodeURIComponent(id)}`, "DELETE");
  if (response?.ok) changed();
  return Boolean(response?.ok);
}

/** The bot's one ongoing chat, started the first time it's opened. */
export async function openBotChat(id: string, workspaceId?: string): Promise<string | null> {
  const response = await send(`/bots/${encodeURIComponent(id)}/chat`, "POST", { workspace_id: workspaceId });
  if (!response?.ok) return null;
  const { session_id } = (await response.json()) as { session_id: string };
  changed();
  return session_id;
}

/** Your bots, favourites first. `scope` reloads them when the account changes. */
export function useBots(scope?: string) {
  const [bots, setBots] = useState<Bot[]>([]);
  const reload = useCallback(() => {
    void fetch("/bots")
      .then((response) => (response.ok ? (response.json() as Promise<Bot[]>) : []))
      .then(setBots)
      .catch(() => setBots([]));
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener(CHANGED, reload);
    return () => window.removeEventListener(CHANGED, reload);
  }, [reload, scope]);
  return bots;
}
