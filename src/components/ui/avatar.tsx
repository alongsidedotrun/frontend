import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { AlongsideLogo } from "@/components/icons/alongside-logo"
import { getUserAvatarSeed, getUserDisplayName, useUserAvatarImage } from "@/lib/user"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

// One color pair per user, not everyone stuck on the same flat black/white
// mark -- per explicit request ("what about we do our Logo but with random
// colors? like something like this screenshot to motivate staff to update
// their profile picture"), replacing both this component's own previous
// boring-avatars abstract-shape fallback AND sidebar-nav.tsx's/
// settings-overlay.tsx's own separately hand-rolled black/white logo badge
// (that mismatch, one generative shape here vs. a flat mono circle there,
// was the real bug reported directly: "the avatar profile is using a
// different one at chat and at sidebar"). Soft tint background with the
// mark itself in a deeper shade of the same hue, matching the reference
// screenshot's own pastel-circle-plus-glyph look.
const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#FCEACB", fg: "#C17F2B" }, // amber
  { bg: "#DCEEE1", fg: "#3E8B67" }, // sage green
  { bg: "#E7DEF5", fg: "#7C5CB8" }, // lavender
  { bg: "#DAE8FB", fg: "#3D6FB4" }, // sky blue
  { bg: "#FBE0E6", fg: "#BF5170" }, // coral pink
  { bg: "#D8F1EE", fg: "#2C948B" }, // teal
]

// Deterministic per `name` (same idea as the boring-avatars fallback this
// replaces) so the same person always lands on the same color, across
// every place their name is passed in.
function paletteIndexForName(name: string, count: number) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return hash % count
}

// Goes inside AvatarFallback wherever there's no uploaded/real avatar
// image, in place of a plain initial-letter circle -- also used directly
// (outside the Avatar/AvatarFallback wrapper) by sidebar-nav.tsx's and
// settings-overlay.tsx's own account-row badge, so every surface in the
// app renders this exact same component instead of three independent
// look-alikes that can drift out of sync.
//
// The local user's own avatar (name === getUserDisplayName()) reads a
// persisted seed (lib/user.ts's own getUserAvatarSeed) instead of hashing
// the name -- per explicit request, "only one default avatar until the
// user changes it," stable across sidebar/messages/settings even if the
// display name itself changes later. Any other name (a different
// multiplayer participant in a chat -- ChatPage.tsx's own human row is the
// one caller that can pass someone other than the local user) still hashes
// the name itself, since there's no persisted seed for a name that isn't
// this device's own user, and distinct colors per participant is exactly
// the point there.
function DefaultAvatar({ name }: { name: string }) {
  const isCurrentUser = name === getUserDisplayName()
  // Called unconditionally (Rules of Hooks) even though its result is only
  // ever used for this device's own name -- an uploaded photo is local to
  // this device (Settings' own new Profile section), so a different
  // multiplayer participant's name always falls through to the generated
  // mark below regardless of what this device itself has uploaded.
  const avatarImage = useUserAvatarImage()
  if (isCurrentUser && avatarImage) {
    return <img src={avatarImage} alt="" className="size-full overflow-hidden rounded-full object-cover" />
  }
  const index = isCurrentUser
    ? getUserAvatarSeed() % AVATAR_PALETTE.length
    : paletteIndexForName(name, AVATAR_PALETTE.length)
  const { bg, fg } = AVATAR_PALETTE[index]
  return (
    // rounded-full + overflow-hidden on this div itself, not left to
    // whatever wraps it -- also used bare (no AvatarFallback parent) by
    // sidebar-nav.tsx's/settings-overlay.tsx's own account-row badge, so
    // it needs to clip to a circle on its own rather than depending on a
    // parent that may or may not already do it.
    <div
      className="flex size-full items-center justify-center overflow-hidden rounded-full"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="relative block size-[58%]" aria-hidden="true">
        <AlongsideLogo className="absolute left-1/2 top-1/2 block size-full -translate-x-1/2 -translate-y-1/2" />
      </span>
    </div>
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  DefaultAvatar,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
