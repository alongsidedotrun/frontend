/**
 * Mid-chat model authority: only include a model on send when the compose
 * picker differs from the server session's current model.
 *
 * Sending the picker value on every turn made any stale client ref (another
 * chat's sessionStorage seed, a replayed model_changed, an edit/cancel remount)
 * look like an intentional switch and flip the live session.
 */
export function modelPayloadForSend(
  selectedModel: string | undefined | null,
  serverModel: string | undefined | null,
): string | undefined {
  if (!selectedModel) return undefined;
  if (!serverModel) return undefined;
  if (selectedModel === serverModel) return undefined;
  return selectedModel;
}
