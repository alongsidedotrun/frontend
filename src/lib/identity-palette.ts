// Soft tint backgrounds with a deeper shade of the same hue for the glyph:
// IDENTITY_PALETTE for default user avatars (ui/avatar.tsx), WORKSPACE_PALETTE
// for default workspace tiles (design-system/workspace-brand-icon.tsx).
export const IDENTITY_PALETTE: { name: string; bg: string; fg: string }[] = [
  { name: "Amber", bg: "#FCEACB", fg: "#C17F2B" },
  { name: "Sage", bg: "#DCEEE1", fg: "#3E8B67" },
  { name: "Lavender", bg: "#E7DEF5", fg: "#7C5CB8" },
  { name: "Sky", bg: "#DAE8FB", fg: "#3D6FB4" },
  { name: "Coral", bg: "#FBE0E6", fg: "#BF5170" },
  { name: "Teal", bg: "#D8F1EE", fg: "#2C948B" },
];

// Workspace letter tiles: eight clearly different hues (one green, plus grey
// and orange), so the picker never shows two near-identical swatches. Kept
// separate from IDENTITY_PALETTE: changing that list would remap every
// existing user's avatar colour.
export const WORKSPACE_PALETTE: { name: string; bg: string; fg: string }[] = [
  { name: "Grey", bg: "#E9E9EB", fg: "#5F6168" },
  { name: "Red", bg: "#FADDDB", fg: "#C2413B" },
  { name: "Orange", bg: "#FDE3CF", fg: "#C8601A" },
  { name: "Yellow", bg: "#FCEACB", fg: "#AD7A16" },
  { name: "Green", bg: "#DCEEE1", fg: "#3E8B67" },
  { name: "Blue", bg: "#DAE8FB", fg: "#3D6FB4" },
  { name: "Purple", bg: "#E7DEF5", fg: "#7C5CB8" },
  { name: "Pink", bg: "#FBE0E6", fg: "#BF5170" },
];

// Deterministic per `name`, so the same person or workspace always lands on
// the same colour, everywhere it's shown and on every device.
export function paletteIndexForName(name: string, count = IDENTITY_PALETTE.length) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % count;
}
