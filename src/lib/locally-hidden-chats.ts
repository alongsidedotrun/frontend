// Persists which hosted chats a non-owner participant has "deleted" from
// their own device -- delete_session (backend/src/server.rs) deliberately
// leaves the shared chat/session untouched for anyone but its owner (real
// bug fix, confirmed directly: "delete in multiplayer should be something
// like: The chat will be deleted at your local storage, other users will
// not be affected"), so hiding it durably has to live here instead -- the
// shared GET /sessions list keeps returning it forever otherwise, since
// nothing about it actually changed server-side. A Free tier chat (solo,
// or this device's own chat even when hosting is on) never reaches this
// path at all -- delete_session does a real delete for those -- so this
// only ever grows for a hosted chat's non-owner participant.
const KEY = "alongside_locally_hidden_chats";

export function loadLocallyHiddenChatIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function hideChatLocally(id: string) {
  const ids = loadLocallyHiddenChatIds();
  ids.add(id);
  localStorage.setItem(KEY, JSON.stringify([...ids]));
}
