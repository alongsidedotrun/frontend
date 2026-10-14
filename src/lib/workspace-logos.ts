// Workspace logos (image data URLs), descriptions and tile colours are kept
// on the backend's workspace record. Earlier builds kept them in this
// browser's localStorage, keyed by workspace id; moveLocalWorkspaceDetailsToBackend
// moves any of those to the backend once and clears them here. Uploads are
// capped at MAX_LOGO_BYTES, the same limit the backend enforces.

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

const COLOR_KEY_PREFIX = "alongside_workspace_color:";

/** Palette index picked for a workspace's letter tile, if one was picked. */
export function loadWorkspaceColor(workspaceId: string): number | null {
  try {
    const raw = localStorage.getItem(COLOR_KEY_PREFIX + workspaceId);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

export function saveWorkspaceColor(workspaceId: string, index: number | null) {
  try {
    if (index === null) localStorage.removeItem(COLOR_KEY_PREFIX + workspaceId);
    else localStorage.setItem(COLOR_KEY_PREFIX + workspaceId, String(index));
  } catch {
    // Quota or storage disabled: the tile falls back to the name's colour.
  }
}

/** Reads an uploaded logo as a data URL, or explains why it was rejected
 *  (as a translation key). */
export function readLogoFile(file: File): Promise<{ dataUrl: string } | { error: string }> {
  if (!LOGO_MIME_TYPES.includes(file.type)) {
    return Promise.resolve({ error: "workspace.logo.errors.type" });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return Promise.resolve({ error: "workspace.logo.errors.size" });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: String(reader.result) });
    reader.onerror = () => resolve({ error: "workspace.logo.errors.read" });
    reader.readAsDataURL(file);
  });
}

type WorkspaceWithDetails = {
  id: string;
  is_personal: boolean;
  logo?: string | null;
  description?: string | null;
  color?: number | null;
};

// Moves a logo, description or colour saved in this browser by an earlier
// build to the backend, for workspaces the backend has none for yet, then
// clears the local copy. Returns the workspaces with what was moved filled in;
// a workspace whose move fails keeps its local copy for the next load.
export async function moveLocalWorkspaceDetailsToBackend<T extends WorkspaceWithDetails>(workspaces: T[]): Promise<T[]> {
  return Promise.all(
    workspaces.map(async (workspace) => {
      if (workspace.is_personal || workspace.logo || workspace.description || workspace.color != null) return workspace;
      const logo = loadWorkspaceLogo(workspace.id);
      const description = loadWorkspaceDescription(workspace.id);
      const color = loadWorkspaceColor(workspace.id);
      if (!logo && !description && color === null) return workspace;
      try {
        const response = await fetch(`/workspaces/${encodeURIComponent(workspace.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logo, description, color }),
        });
        if (!response.ok) return workspace;
      } catch {
        return workspace;
      }
      saveWorkspaceLogo(workspace.id, null);
      saveWorkspaceDescription(workspace.id, null);
      saveWorkspaceColor(workspace.id, null);
      return { ...workspace, logo, description, color };
    }),
  );
}
