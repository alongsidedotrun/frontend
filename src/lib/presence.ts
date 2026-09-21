import { useSyncExternalStore } from "react";

// Who is in the open chat and who is online right now, as the backend's live `presence` events
// report it (backend/src/lib.rs broadcast_presence). Live state, never stored: the chat page sets it
// from the socket and clears it when the chat closes, and the header reads it.
export type Person = { name: string; role: "host" | "editor" | "reader"; online: boolean };

let current: Person[] = [];
const listeners = new Set<() => void>();

export function setPresence(people: Person[]) {
  current = people;
  listeners.forEach((listener) => listener());
}

export function clearPresence() {
  setPresence([]);
}

export function usePresence(): Person[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );
}
