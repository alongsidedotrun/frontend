import { useId, type ComponentType, type SVGProps } from "react";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
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
export function WorkspaceBrandIcon({
  size,
  icon: Icon = AlongsideLogo,
  imageSrc,
  className,
  markClassName,
}: WorkspaceBrandIconProps) {
  const radius = (tileRadiusPx(size) * TILE) / size;
  const clipId = useId();
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${TILE} ${TILE}`}
      // size-* (not h-/w-) so menu rows that resize "size-"-less svgs leave it alone.
      className={cn("block shrink-0", SIZE_CLASS[size], className)}
    >
      <rect
        width={TILE}
        height={TILE}
        rx={radius}
        // One look in both themes: white tile, black mark (no theme inversion).
        className="!fill-white"
      />
      {imageSrc ? (
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
    </svg>
  );
}
