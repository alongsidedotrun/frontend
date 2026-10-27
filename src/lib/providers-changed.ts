// A provider was connected or disconnected (Settings > Providers saw its answer change): what shows
// connection state elsewhere -- Usage, the New page's provider gate -- checks again instead of waiting
// for a reload or the window's next focus.
export const PROVIDERS_CHANGED = "alongside:providers-changed";

export function providersChanged() {
  window.dispatchEvent(new Event(PROVIDERS_CHANGED));
}
