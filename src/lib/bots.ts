import { useCallback, useEffect, useState } from "react";
import type { BotAvatar } from "@/components/bot-face";

// Your bots (#504): a specialist with a name people ask it by, its instructions and its look. Kept on
// this device until the bots library moves to the backend (each bot then gets an owner and its memory).
export type Bot = {
  id: string;
  name: string;
  instructions: string;
  avatar: BotAvatar;
  favourite: boolean;
  createdAt: string;
};

const BOTS_KEY = "alongside_bots";
const CHANGED = "alongside:bots-changed";

function load(): Bot[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(bots: Bot[]) {
  try {
    localStorage.setItem(BOTS_KEY, JSON.stringify(bots));
  } catch {
    // Full or blocked storage: the change still shows until reload.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function useBots() {
  const [bots, setBots] = useState<Bot[]>(load);
  useEffect(() => {
    const reload = () => setBots(load());
    window.addEventListener(CHANGED, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(CHANGED, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const update = useCallback((next: (current: Bot[]) => Bot[]) => save(next(load())), []);

  return {
    bots,
    /** Adds a bot; "name_taken" when you already have one by that name. */
    add: useCallback(async (name: string, instructions: string, avatar: BotAvatar): Promise<"name_taken" | null> => {
      if (load().some((bot) => bot.name.toLowerCase() === name.toLowerCase())) return "name_taken";
      update((current) => [...current, { id: crypto.randomUUID(), name, instructions, avatar, favourite: false, createdAt: new Date().toISOString() }]);
      return null;
    }, [update]),
    remove: useCallback((id: string) => update((current) => current.filter((bot) => bot.id !== id)), [update]),
    toggleFavourite: useCallback((id: string) => update((current) => current.map((bot) => bot.id === id ? { ...bot, favourite: !bot.favourite } : bot)), [update]),
  };
}
