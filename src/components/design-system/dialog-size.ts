// One width for the shell's dialogs (Join chat, New workspace, Manage workspace, Invite members,
// Sign in): 540px. Each is as tall as its content, up to 800px; on a smaller window they keep a 2rem
// margin on every side and the content scrolls.
export const PANE_DIALOG_CONTENT = "!z-[120] max-w-[min(540px,calc(100vw-4rem))] overflow-hidden p-0";
export const PANE_DIALOG_MAX_HEIGHT = "max-h-[min(800px,calc(100dvh-4rem))]";
