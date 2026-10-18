import { useSyncExternalStore } from "react";
import type { EffortLevel } from "@/lib/effort";
import type { PermissionMode } from "@/lib/last-used";
import type { ImageAttachment } from "@/components/compose-box";

// A message written while the agent is still working: it waits above the
// composer and goes out when the turn ends (ChatPage drains the queue), unless
// it is steered into the running turn first (Codex) -- the same model Codex's
// own app uses, so it's always clear whether a message queued or steered.
export interface QueuedMessage {
  id: string;
  text: string;
  images: ImageAttachment[];
  effort: EffortLevel;
  mode: PermissionMode;
}

// On by default. Off: Enter mid-turn steers straight away where the provider
// can steer (Codex); providers that can't steer always queue.
const QUEUEING_KEY = "alongside_queue_messages";
const listeners = new Set<() => void>();
// The choice for this session even when storage is unavailable.
let current: boolean | null = null;

export function loadQueueing(): boolean {
  if (current !== null) return current;
  try {
    current = localStorage.getItem(QUEUEING_KEY) !== "false";
  } catch {
    current = true;
  }
  return current;
}

export function saveQueueing(enabled: boolean) {
  current = enabled;
  try {
    localStorage.setItem(QUEUEING_KEY, String(enabled));
  } catch {
    // Storage unavailable: the choice just doesn't outlive this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The Queue messages setting, kept in step between Settings and the composer's own menu. */
export function useQueueing(): [boolean, (enabled: boolean) => void] {
  return [useSyncExternalStore(subscribe, loadQueueing), saveQueueing];
}
