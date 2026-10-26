// Development only: ?noProvider=1 shows the app as if no provider were connected (the first-run gate,
// Settings > Providers' empty usage), remembered until ?noProvider=0. Ignored outside development.
const FORCE_NO_PROVIDER_KEY = "alongside_dev_no_provider";

export function forcedNoProvider(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const asked = new URLSearchParams(window.location.search).get("noProvider");
    if (asked === "1") localStorage.setItem(FORCE_NO_PROVIDER_KEY, "1");
    if (asked === "0") localStorage.removeItem(FORCE_NO_PROVIDER_KEY);
    return localStorage.getItem(FORCE_NO_PROVIDER_KEY) === "1";
  } catch {
    return false;
  }
}
