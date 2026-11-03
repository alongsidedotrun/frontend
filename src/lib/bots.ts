import { useCallback, useEffect, useState } from "react";
import type { BotAvatar } from "@/components/bot-face";
import { failureOf, type AddAgentError } from "@/lib/chat-agents";
import type { Skill } from "@/lib/skills";

// Your bots (#504): a specialist with a name, its instructions and its look. You talk to each one in its
// own ongoing chat (chat_id, once it's been opened); the sidebar lists them under Bots.
export type Bot = {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  avatar: BotAvatar | null;
  favourite: boolean;
  created_at: string;
  chat_id: string | null;
};

/** A bot that couldn't be made or saved: the reason and status (see AddAgentError). */
export type BotError = AddAgentError;

// Every useBots() reloads when one of them changes the list.
const CHANGED = "alongside:bots-changed";
const changed = () => window.dispatchEvent(new Event(CHANGED));

async function send(path: string, method: string, body?: unknown): Promise<Response | null> {
  return fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
}

export async function createBot(name: string, instructions: string, avatar: BotAvatar, description = ""): Promise<Bot | BotError> {
  const response = await send("/bots", "POST", { name, description, instructions, avatar });
  if (!response?.ok) return failureOf(response);
  changed();
  return (await response.json()) as Bot;
}

export async function updateBot(id: string, changes: Partial<Pick<Bot, "name" | "instructions" | "avatar" | "favourite"> & { description: string }>): Promise<BotError | null> {
  const response = await send(`/bots/${encodeURIComponent(id)}`, "PATCH", changes);
  if (!response?.ok) return failureOf(response);
  changed();
  return null;
}

export async function deleteBot(id: string): Promise<boolean> {
  const response = await send(`/bots/${encodeURIComponent(id)}`, "DELETE");
  if (response?.ok) changed();
  return Boolean(response?.ok);
}

/** The bot's one ongoing chat (its id), started the first time it's opened; or why it couldn't be. */
export async function openBotChat(id: string, workspaceId?: string): Promise<string | BotError> {
  const response = await send(`/bots/${encodeURIComponent(id)}/chat`, "POST", { workspace_id: workspaceId });
  if (!response?.ok) return failureOf(response);
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

// #540: Settings > Bots.

/** The skills a bot uses (ids are the skills' own, as in useSkills). */
export async function getBotSkills(id: string): Promise<Pick<Skill, "id" | "name">[]> {
  const response = await send(`/bots/${encodeURIComponent(id)}/skills`, "GET");
  return response?.ok ? ((await response.json()) as Pick<Skill, "id" | "name">[]) : [];
}

export async function setBotSkills(id: string, skillIds: string[]): Promise<boolean> {
  const response = await send(`/bots/${encodeURIComponent(id)}/skills`, "PUT", { skill_ids: skillIds });
  return Boolean(response?.ok);
}

export type BotImportError = "not_markdown" | "unusable" | "instructions_too_long" | "failed";
export type BotImported = { bot: Bot; missing_skills: string[] };

/** A bot from a .md file; a taken name gets "-2". Names the skills it asks for that aren't added. */
export async function importBotFile(file: File): Promise<BotImported | BotImportError> {
  if (!/\.md$/i.test(file.name)) return "not_markdown";
  const text = await file.text().catch(() => null);
  if (text === null) return "failed";
  const response = await send("/bots/import", "POST", { text, file_name: file.name });
  if (!response) return "failed";
  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    if (error === "not_markdown") return "not_markdown";
    if (error === "empty" || error === "too_large") return "unusable";
    if (error === "invalid_instructions") return "instructions_too_long";
    return "failed";
  }
  changed();
  return (await response.json()) as BotImported;
}

/** Saves the bot as a .md file (the format importBotFile reads). */
export async function exportBot(bot: Bot): Promise<boolean> {
  const response = await send(`/bots/${encodeURIComponent(bot.id)}/export`, "GET");
  if (!response?.ok) return false;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${bot.name}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Bots made on this device before signing in (none while signed out). */
export async function botsElsewhere(): Promise<Bot[]> {
  const response = await send("/bots/elsewhere", "GET");
  return response?.ok ? ((await response.json()) as Bot[]) : [];
}

/** Moves them into the account, with their chats and skills. Gives the bots moved. */
export async function moveBotsHere(ids: string[]): Promise<Bot[] | null> {
  const response = await send("/bots/elsewhere", "POST", { ids });
  if (!response?.ok) return null;
  changed();
  return (await response.json()) as Bot[];
}
