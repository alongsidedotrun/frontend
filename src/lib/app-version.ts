// Which Alongside this is, baked in at build time (vite.config.ts's buildInfo). Tests and any
// build without the define get a placeholder rather than a crash.
declare const __ALONGSIDE_BUILD__: { version: string; release: boolean; commit: string; built: string } | undefined;

export type BuildInfo = { version: string; release: boolean; commit: string; built: string };

export const BUILD_INFO: BuildInfo =
  typeof __ALONGSIDE_BUILD__ !== "undefined" && __ALONGSIDE_BUILD__ ? __ALONGSIDE_BUILD__ : { version: "0.0.0-dev", release: false, commit: "", built: "" };

/** One line to paste into a bug report: "Alongside 0.1.0-alpha.34 (e7bbfc7, built 2026-11-04) on macOS". */
export function buildSummary(info: BuildInfo = BUILD_INFO, platform = typeof navigator !== "undefined" ? navigator.userAgent : ""): string {
  const os = /Mac OS X|Macintosh/.test(platform) ? "macOS" : /Windows/.test(platform) ? "Windows" : /Linux/.test(platform) ? "Linux" : "";
  const parts = [info.commit, info.built ? `built ${info.built.slice(0, 10)}` : ""].filter(Boolean).join(", ");
  return `Alongside ${info.version}${parts ? ` (${parts})` : ""}${os ? ` on ${os}` : ""}`;
}
