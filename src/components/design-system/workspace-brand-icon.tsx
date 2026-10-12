import type { ComponentType } from "react";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { cn } from "@/lib/utils";

/** Shared, raster-safe workspace icon sizes. Use these rather than sizing a
 * workspace mark ad hoc so every surface shares the same centering geometry. */
export type WorkspaceBrandIconSize = 8 | 16 | 32 | 64 | 128 | 254;

const SIZE_CLASS: Record<WorkspaceBrandIconSize, string> = {
  8: "size-2",
  16: "size-4",
  32: "size-8",
  64: "size-16",
  128: "size-32",
  254: "size-[254px]",
};

// The tile and its artwork are separate dimensions. A workspace may upload a
// 256×256 source logo, but its rendered mark needs a generous, consistent safe
// area so it does not read larger than adjacent interface icons.
const BRAND_ARTWORK_CLASS = "h-[56%] w-[56%]";

// The mark needs optical calibration at rendered sizes. These values are
// intentionally size-aware rather than percentage based: percentage movement
// grows too quickly for the 128px and 254px marks.
const ALONGSIDE_OPTICAL_OFFSET_CLASS: Record<WorkspaceBrandIconSize, string> = {
  8: "",
  16: "[transform:translate(-0.5px,0.5px)]",
  32: "[transform:translate(-1px,1px)]",
  64: "[transform:translate(-1.5px,1.5px)]",
  128: "[transform:translate(-2px,2px)]",
  // The 254px rendering is the workspace-brand reference size. Its pinwheel
  // needs a larger optical adjustment than its geometric SVG bounds imply.
  254: "[transform:translate(10px,-11px)]",
};

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
 * mark occupies 56% of its tile, preserving a clear safe area from a 8px
 * navigation icon through a 254px workspace identity. Source images can be
 * 256×256 (or any square resolution); object-contain keeps their artwork
 * within this shared rendered mark area.
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
  // Keep the mark's calibrated position here so every usage stays aligned.
  const alongsideOpticalOffset = !imageSrc && Icon === AlongsideLogo;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-[6px]",
        SIZE_CLASS[size],
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
            alongsideOpticalOffset && ALONGSIDE_OPTICAL_OFFSET_CLASS[size],
            useInvertedMonochrome ? "text-white dark:text-black" : "text-black dark:text-white",
            markClassName,
          )}
        />
      )}
    </span>
  );
}
