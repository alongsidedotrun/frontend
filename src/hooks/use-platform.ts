import { useEffect, useState } from "react";

// navigator.userAgentData is the modern replacement for the long-deprecated
// navigator.platform, but isn't available in every browser yet (notably
// Safari), so this falls back to platform/userAgent sniffing rather than
// assuming Mac when the modern API is just missing.
export function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    ?.platform;
  const platform = uaDataPlatform ?? navigator.platform ?? navigator.userAgent;
  return /mac/i.test(platform);
}

export function useIsMac() {
  // Starts false (assume non-Mac) to match the server-rendered/first-paint
  // value, then corrects after mount -- there's no reliable synchronous
  // signal before that in a client-only app.
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(detectMac());
  }, []);

  return isMac;
}

// Same detection pattern as detectMac/useIsMac above -- real cross-platform
// transparency support (issue #276, settings-overlay.tsx's own
// transparencySupported) needs to tell Windows apart from Linux, not just
// "not a Mac".
export function detectWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    ?.platform;
  const platform = uaDataPlatform ?? navigator.platform ?? navigator.userAgent;
  return /win/i.test(platform);
}

export function useIsWindows() {
  const [isWindows, setIsWindows] = useState(false);

  useEffect(() => {
    setIsWindows(detectWindows());
  }, []);

  return isWindows;
}
