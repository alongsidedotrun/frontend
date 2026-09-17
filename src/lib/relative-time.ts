// Real bug, confirmed directly ("The right sidebar at the chat is missing
// the 1 day ago as an example of when the file was created"): this used to
// live only in LibraryPage.tsx (that file's own comment said as much --
// "kept local rather than shared since neither page has a real shared
// utils module for it yet"), so right-panel.tsx's own ChatFileListPanel
// (a second, real consumer that needs the exact same SQLite-timestamp
// formatting) had no way to reuse it and just never got a timestamp at
// all. Extracted verbatim, not reimplemented.
export function parseSqliteTimestamp(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

export function formatRelativeTime(value: string): string {
  const date = parseSqliteTimestamp(value);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
