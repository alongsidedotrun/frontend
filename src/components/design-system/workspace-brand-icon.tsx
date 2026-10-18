import { useId, type ComponentType, type SVGProps } from "react";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { WORKSPACE_HUE_COUNT, WORKSPACE_PALETTE, paletteIndexForName } from "@/lib/identity-palette";
import { cn } from "@/lib/utils";

/**
 * Shared workspace-icon canvases. Every canvas uses a 75% centered artwork
 * area and therefore a 12.5% inset per side (for example 64 → 48px artwork
 * with 8px padding, and 256 → 192px artwork with 32px padding). The inset is
 * drawn inside the tile's own svg, so sizes with a fractional inset (18, 20)
 * stay centred too.
 */
export type WorkspaceBrandIconSize = 8 | 16 | 18 | 20 | 24 | 32 | 40 | 48 | 64 | 96 | 128 | 192 | 256;

const SIZE_CLASS: Record<WorkspaceBrandIconSize, string> = {
  8: "size-2",
  16: "size-4",
  18: "size-[18px]",
  20: "size-5",
  24: "size-6",
  32: "size-8",
  40: "size-10",
  48: "size-12",
  64: "size-16",
  96: "size-24",
  128: "size-32",
  192: "size-48",
  256: "size-64",
};

// Corner radius in px for a tile of `size`, on the app-wide radius scale
// (index.css --radius): 8px at a 32px reference, growing with the square root
// of the size so every tile reads as equally round -- 6px at the 18px sidebar
// tile, ~6.9px at 24, 8px at 32. Capped at 35% of the tile so the smallest
// sizes stay a rounded square rather than a circle.
function tileRadiusPx(size: WorkspaceBrandIconSize) {
  return Math.min(8 * Math.sqrt(size / 32), size * 0.35);
}

// The tile is drawn in a 64-unit viewBox: the artwork fills the centred 48×48
// box (75%), leaving an 8-unit (12.5%) safe area on every side.
// The Alongside workspace's stored logo is the app's favicon, a finished app
// icon with its own rounded corners, outline and highlight. Inside this tile,
// which rounds a logo itself, the mark is drawn inline instead (the flat
// public/alongside-mark.svg, as shapes): as an <image>, Safari rasterises a
// nested SVG at a low resolution and its edges come out soft.
const APP_LOGOS = new Set(["/favicon.svg", "/alongside-mark.svg"]);

const TILE = 64;
const INSET = 8;
const ARTWORK = 48;
// The default Alongside mark sits smaller, at 62.5% (40 units, 12-unit inset):
// its pinwheel runs edge to edge in its own box, so at 75% it reads larger
// than logos with built-in whitespace. Uploaded/custom marks keep 75%.
const DEFAULT_MARK_INSET = 12;
const DEFAULT_MARK_ARTWORK = 40;

type WorkspaceBrandIconProps = {
  /** The rendered square; restricted to the shared workspace-icon scale. */
  size: WorkspaceBrandIconSize;
  /** A React SVG mark that forwards SVG props. Defaults to Alongside's own mark. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Optional image logo for a workspace that does not ship an SVG component. */
  imageSrc?: string;
  /**
   * Default tile for a workspace without a logo: its first letter in `fg` on
   * a `bg` tile (see workspaceMonogram). Ignored when imageSrc is set.
   */
  monogram?: WorkspaceMonogram;
  className?: string;
  markClassName?: string;
};

/**
 * A centered workspace-brand tile shared by every workspace surface.
 *
 * Tile background and mark are one <svg>: the background is a <rect> and the
 * mark is nested at the 12.5% inset. When the background was CSS (on a
 * wrapper or on the svg's own padding box) the browser snapped it to device
 * pixels separately from the svg artwork, so wherever layout put the tile on
 * a fractional position (e.g. after centred text) or at a non-100% zoom, the
 * mark drifted up to a device pixel off-centre. Inside one svg both share a
 * single transform and stay centred at any position, size or zoom.
 *
 * Image marks use <image> in the same svg; preserveAspectRatio keeps any
 * source resolution contained and centred in the artwork box.
 */
export type WorkspaceMonogram = { letter: string; bg: string; fg: string; darkEdge?: boolean };

/** First letter of the workspace name on its palette colour (picked or from the name). */
export function workspaceMonogram(name: string, colorIndex?: number | null): WorkspaceMonogram | null {
  const letter = Array.from(name.trim())[0];
  if (!letter) return null;
  const { bg, fg, darkEdge } = WORKSPACE_PALETTE[colorIndex ?? paletteIndexForName(name.trim(), WORKSPACE_HUE_COUNT)] ?? WORKSPACE_PALETTE[0];
  return { letter: letter.toLocaleUpperCase(), bg, fg, darkEdge };
}

export function WorkspaceBrandIcon({
  size,
  icon: Icon = AlongsideLogo,
  imageSrc,
  monogram,
  className,
  markClassName,
}: WorkspaceBrandIconProps) {
  const radius = (tileRadiusPx(size) * TILE) / size;
  const clipId = useId();
  // Half a CSS pixel in viewBox units, for the 1px hairline edge below.
  const edgeInset = (0.5 * TILE) / size;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${TILE} ${TILE}`}
      // size-* (not h-/w-) so menu rows that resize "size-"-less svgs leave it alone.
      className={cn("block shrink-0", SIZE_CLASS[size], className)}
    >
      <rect
        // Behind a logo the white backing is inset a pixel: at the full size,
        // its anti-aliased edge showed through the logo's own (the same shape,
        // drawn twice) as a light, blurry rim around the tile.
        x={imageSrc ? edgeInset * 2 : 0}
        y={imageSrc ? edgeInset * 2 : 0}
        width={imageSrc ? TILE - edgeInset * 4 : TILE}
        height={imageSrc ? TILE - edgeInset * 4 : TILE}
        rx={imageSrc ? Math.max(0, radius - edgeInset * 2) : radius}
        // One look in both themes: white tile, black mark (no theme
        // inversion); a monogram tile takes its palette colour instead.
        className={monogram && !imageSrc ? undefined : "!fill-white"}
        style={monogram && !imageSrc ? { fill: monogram.bg } : undefined}
      />
      {!imageSrc && monogram ? (
        <text
          x={TILE / 2}
          y={TILE / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={30}
          fontWeight={600}
          style={{ fill: monogram.fg }}
        >
          {monogram.letter}
        </text>
      ) : imageSrc && APP_LOGOS.has(imageSrc) ? (
        <>
          <defs>
            <linearGradient id={`${clipId}-bg`} x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2B83FF" />
              <stop offset="1" stopColor="#056DFF" />
            </linearGradient>
          </defs>
          <rect width={TILE} height={TILE} rx={radius} fill={`url(#${clipId}-bg)`} />
          <circle cx="21.5" cy="32" r="10.5" fill="#CFCFCF" />
          <circle cx="32" cy="32" r="10.5" fill="#E8E8E8" />
          <circle cx="42.5" cy="32" r="10.5" fill="#FFFFFF" />
        </>
      ) : imageSrc ? (
        // An uploaded logo *is* the tile: full bleed, clipped to the tile's
        // rounded corners, so it matches the tile size and radius everywhere
        // (the rect underneath only shows through transparent logos).
        <>
          <clipPath id={clipId}>
            <rect width={TILE} height={TILE} rx={radius} />
          </clipPath>
          <image
            href={imageSrc}
            width={TILE}
            height={TILE}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
            className={markClassName}
          />
        </>
      ) : (
        <Icon
          x={Icon === AlongsideLogo ? DEFAULT_MARK_INSET : INSET}
          y={Icon === AlongsideLogo ? DEFAULT_MARK_INSET : INSET}
          width={Icon === AlongsideLogo ? DEFAULT_MARK_ARTWORK : ARTWORK}
          height={Icon === AlongsideLogo ? DEFAULT_MARK_ARTWORK : ARTWORK}
          className={cn(
            // !important: menu rows recolour every descendant on focus/hover
            // (DropdownMenuItem's focus:**:text-*), which reaches the mark's
            // own <g>/<path> too. The mark pins its colour and makes every
            // descendant inherit it, so a brand tile keeps its colours
            // wherever it's placed.
            "!text-black",
            "[&_*]:![color:inherit]",
            markClassName,
          )}
        />
      )}
      {/* Hairline edge, the Getting Started card's barely-visible border, so
          the default tile (letter or Alongside mark) reads as a tile on light
          surfaces (light mode only). Not on a logo (an uploaded image or .svg),
          which brings its own edge; inset half a pixel to stay inside. */}
      {!imageSrc && (
      <rect
        x={edgeInset}
        y={edgeInset}
        width={TILE - edgeInset * 2}
        height={TILE - edgeInset * 2}
        rx={Math.max(0, radius - edgeInset)}
        fill="none"
        strokeWidth={edgeInset * 2}
        // Light mode only: on dark surfaces the white tile already stands
        // out, and the dark border colour would read as a ring inside it.
        // A black letter tile keeps a faint light edge in both modes: the
        // light-mode grey read as a ring around it from a distance.
        className={cn(
          monogram?.darkEdge
            ? "stroke-white/15"
            : "stroke-[var(--redesign-sidebar-footer-onboarding-border)] dark:stroke-transparent",
        )}
      />
      )}
    </svg>
  );
}
