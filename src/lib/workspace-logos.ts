// Workspace logos and descriptions, stored on this device until the
// backend's workspace record has fields for them (it only carries
// id/name/is_personal today).
// Data URLs keyed by workspace id; uploads are capped (MAX_LOGO_BYTES) so a
// handful of logos stay well inside localStorage's quota.

const KEY_PREFIX = "alongside_workspace_logo:";

export const MAX_LOGO_BYTES = 1024 * 1024;
export const LOGO_MIME_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];

export function loadWorkspaceLogo(workspaceId: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + workspaceId);
  } catch {
    return null;
  }
}

export function saveWorkspaceLogo(workspaceId: string, dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(KEY_PREFIX + workspaceId, dataUrl);
    else localStorage.removeItem(KEY_PREFIX + workspaceId);
  } catch {
    // Quota or storage disabled: the workspace still works, just without a logo.
  }
}

const DESCRIPTION_KEY_PREFIX = "alongside_workspace_description:";
export const MAX_DESCRIPTION_LENGTH = 280;

export function loadWorkspaceDescription(workspaceId: string): string | null {
  try {
    return localStorage.getItem(DESCRIPTION_KEY_PREFIX + workspaceId);
  } catch {
    return null;
  }
}

export function saveWorkspaceDescription(workspaceId: string, description: string | null) {
  try {
    if (description) localStorage.setItem(DESCRIPTION_KEY_PREFIX + workspaceId, description);
    else localStorage.removeItem(DESCRIPTION_KEY_PREFIX + workspaceId);
  } catch {
    // Quota or storage disabled: the workspace still works without it.
  }
}

/** Reads an uploaded logo as a data URL, or explains why it was rejected. */
export function readLogoFile(file: File): Promise<{ dataUrl: string } | { error: string }> {
  if (!LOGO_MIME_TYPES.includes(file.type)) {
    return Promise.resolve({ error: "Use an SVG, PNG, JPEG or WebP image." });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return Promise.resolve({ error: "Logos can be up to 1 MB." });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: String(reader.result) });
    reader.onerror = () => resolve({ error: "Couldn't read that file." });
    reader.readAsDataURL(file);
  });
}
