// Importing chats (#539): GET and POST /import/chats, POST /import/chat-file (backend/src/chat_import.rs).
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

export type ImportableChat = { id: string; name: string; created_at: string; message_count: number };

// Chats came into this account while the sidebar's list was already loaded: it loads them again.
export const CHATS_IMPORTED = "alongside:chats-imported";

export function chatsImported() {
  window.dispatchEvent(new Event(CHATS_IMPORTED));
}
