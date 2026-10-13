// Soft tint background with a deeper shade of the same hue for the glyph.
// Shared by default user avatars (ui/avatar.tsx) and default workspace tiles
// (a workspace's first letter, design-system/workspace-brand-icon.tsx), so
// people and workspaces draw from one set of colours.
export const IDENTITY_PALETTE: { name: string; bg: string; fg: string }[] = [
  { name: "Amber", bg: "#FCEACB", fg: "#C17F2B" },
  { name: "Sage", bg: "#DCEEE1", fg: "#3E8B67" },
  { name: "Lavender", bg: "#E7DEF5", fg: "#7C5CB8" },
  { name: "Sky", bg: "#DAE8FB", fg: "#3D6FB4" },
  { name: "Coral", bg: "#FBE0E6", fg: "#BF5170" },
  { name: "Teal", bg: "#D8F1EE", fg: "#2C948B" },
];

// Deterministic per `name`, so the same person or workspace always lands on
// the same colour, everywhere it's shown and on every device.
export function paletteIndexForName(name: string, count = IDENTITY_PALETTE.length) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % count;
}
