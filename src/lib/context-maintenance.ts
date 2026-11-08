// #606: Alongside never compacts. Once a turn leaves the context at or past the chat's
// threshold, the chat hands off to a fresh session carrying the checkpoint, once per crossing.
export function shouldHandOff({
  used,
  threshold,
  automaticHandoff,
  handedOffAbove,
  replaying,
}: {
  used: number;
  threshold: number;
  automaticHandoff: boolean;
  handedOffAbove: boolean;
  replaying: boolean;
}): boolean {
  return used >= threshold && automaticHandoff && !handedOffAbove && !replaying;
}
