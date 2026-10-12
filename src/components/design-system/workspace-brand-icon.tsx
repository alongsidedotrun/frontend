import type { ComponentType } from "react";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { cn } from "@/lib/utils";

/**
 * Shared workspace-icon canvases. Every canvas uses a 75% centered artwork
 * area and therefore a 12.5% inset per side (for example 64 → 48px artwork
 * with 8px padding, and 256 → 192px artwork with 32px padding).
 */
export type WorkspaceBrandIconSize = 8 | 16 | 20 | 24 | 32 | 48 | 64 | 96 | 128 | 192 | 256;

const SIZE_CLASS: Record<WorkspaceBrandIconSize, string> = {
  8: "size-2",
  16: "size-4",
  20: "size-5",
  24: "size-6",
  32: "size-8",
  48: "size-12",
  64: "size-16",
  96: "size-24",
  128: "size-32",
  192: "size-48",
  256: "size-64",
};

// Radius tracks the tile scale so a small workspace tile stays a rounded
// square instead of reading as circular (the 20px sidebar tile uses 4px).
const RADIUS_CLASS: Record<WorkspaceBrandIconSize, string> = {
  8: "rounded-[2px]",
  16: "rounded-[3px]",
  20: "rounded-[4px]",
  24: "rounded-[4px]",
  32: "rounded-[6px]",
  48: "rounded-[8px]",
  64: "rounded-[10px]",
  96: "rounded-[14px]",
  128: "rounded-[18px]",
  192: "rounded-[24px]",
  256: "rounded-[32px]",
};

// Artwork always occupies 75% of the square tile, leaving a 12.5% safe area
// on every side. For example, a 64px tile renders a 48px mark with 8px inset.
const BRAND_ARTWORK_CLASS = "h-3/4 w-3/4";

type WorkspaceBrandIconProps = {
  /** The rendered square; restricted to the shared workspace-icon scale. */
  size: WorkspaceBrandIconSize;
  /** A React SVG mark. Defaults to Alongside's own vector mark. */
  icon?: ComponentType<{ className?: string }>;
  /** Optional image logo for a workspace that does not ship an SVG component. */
  imageSrc?: string;
  /** Apply the monochrome inverse treatment in light mode only. */
  invertOnLight?: boolean;
  /** Marks the supplied logo as monochrome and therefore safe to invert. */
  monochrome?: boolean;
  className?: string;
  markClassName?: string;
};

/**
 * A centered workspace-brand tile shared by every workspace surface.
 *
 * The tile is a grid, not a flex row or an absolutely-positioned child, so
 * both vector and image marks remain centered at every supported size. The
 * mark occupies 75% of its tile, preserving a 12.5% safe area on every side
 * from an 8px navigation icon through a 256px workspace identity. Source
 * images can be 256×256 (or any square resolution); object-contain keeps
 * their artwork within this shared rendered mark area.
 */
export function WorkspaceBrandIcon({
  size,
  icon: Icon = AlongsideLogo,
  imageSrc,
  invertOnLight = false,
  monochrome = false,
  className,
  markClassName,
}: WorkspaceBrandIconProps) {
  const useInvertedMonochrome = monochrome && invertOnLight;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden",
        SIZE_CLASS[size],
        RADIUS_CLASS[size],
        useInvertedMonochrome ? "bg-black dark:bg-white" : "bg-white dark:bg-black",
        className,
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className={cn(
            "block object-contain",
            BRAND_ARTWORK_CLASS,
            useInvertedMonochrome && "invert dark:invert-0",
            markClassName,
          )}
        />
      ) : (
        <Icon
          className={cn(
            "block",
            BRAND_ARTWORK_CLASS,
            useInvertedMonochrome ? "text-white dark:text-black" : "text-black dark:text-white",
            markClassName,
          )}
        />
      )}
    </span>
  );
}
