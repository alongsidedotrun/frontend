import { useTranslation } from "react-i18next"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DefaultAvatar,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DropdownLabel as BaseDropdownLabel, DropdownSeparator } from "@/components/ui/dropdown"
import { MenuItem as BaseMenuItem, CustomMenuItem, useDropdownMaybe } from "@/components/ui/menu-item"
import { DocsIcon, HelpCircleIcon, KeybindingsIcon, LogInIcon, LogOutIcon, SettingsIcon, UserIcon, XIcon } from "@/components/icons/untitled-ui"
import { ProviderIcon } from "@/lib/quick-chat-models"
import { ModelUsageBars, USAGE_PROVIDERS, useProviderUsagePercents } from "@/lib/use-usage"
import { signOut, useIsSignedIn } from "@/lib/auth"
import {
  dismissAllTurnNotifications,
  dismissTurnNotification,
  formatNotificationTime,
  pruneMissingChatNotifications,
  useTurnNotifications,
} from "@/lib/turn-notifications"

// This is sample data -- see app-sidebar.tsx's own former `data` comment.
// Shared here (not defined separately in top-bar.tsx/sidebar-nav.tsx) since
// both the top bar's own avatar trigger and the sidebar's own footer avatar
// row need the same account identity.
export const user = { name: "Shad Cn", email: "shadcn@example.com", avatar: "/avatars/shadcn.jpg" };

// The profile row (avatar + name) atop the account dropdown -- split out
// from NavUserMenuItems below so top-bar.tsx's mobile hamburger menu (small
// phones, below the xs breakpoint -- see index.css's own comment on that)
// can place it at the very top of its own menu (above Chat/Agent/Code/
// Design), not appended mid-list where NavUserMenuItems would otherwise
// put it. avatarSize defaults to this component's original 24px (NavUser's
// own desktop dropdown); the hamburger menu passes 16px to match the size
// every other row icon in that menu already uses. mt defaults to this
// component's original mt-4 (NavUser's own desktop dropdown, where it's
// the very first row so this is the gap from the content box's own top
// edge); the hamburger menu passes mt-2 -- tighter there per request.
export function NavUserProfileHeader({
  user,
  avatarSize = 24,
  mt = "mt-4",
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  avatarSize?: number
  mt?: string
}) {
  return (
    <DropdownMenuLabel className={cn(mt, "font-normal")}>
      <div className="flex items-center gap-2">
        <Avatar style={{ width: avatarSize, height: avatarSize }}>
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>
            <DefaultAvatar name={user.name} />
          </AvatarFallback>
        </Avatar>
        {/* No email -- just the (first + last) name now. */}
        <p className="min-w-0 truncate text-sm leading-none font-normal">{user.name}</p>
      </div>
    </DropdownMenuLabel>
  )
}

// The account dropdown's own item list (Settings/Docs/Help/Appearance/Log
// out, Models section) -- split out from NavUser below so top-bar.tsx's
// mobile hamburger menu can render these same rows appended after its own
// Chat/Agent/Code/Design + Notifications/Activity/Invite items, instead of
// NavUser's separate avatar trigger + dropdown existing as a second menu
// alongside the hamburger one on a screen with no room for two. Doesn't
// include NavUserProfileHeader above or its own DropdownMenuContent
// wrapper -- the hamburger menu places the header at the top of its own
// menu instead (see that component's own comment), and both call sites
// provide their own DropdownMenuContent.
export function NavUserMenuItems({ onOpenSettings }: { onOpenSettings?: () => void } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const usagePercents = useProviderUsagePercents()

  return (
    <>
      {/* text-[12px] font-normal text-muted-foreground: same resting/
          "inactive" row style the sidebar itself uses (RailButton,
          sidebar-nav.tsx) -- size/weight/color all matched, not just the
          font-normal picked up earlier from DropdownMenuContent's own
          className above. text-muted-foreground (var(--muted-foreground),
          index.css), not a one-off hex pair -- Synara's own bg/hover/
          active/inactive/font palette, per explicit request ("copy
          synara's dark and light mode colors"): every row in this menu
          and the sidebar rail now reads its resting text from this same
          token instead of a scattered set of hand-picked grays.
          size-[14px] on every icon (was size-[16px]) -- matches the
          sidebar's own icon size, which itself moved to the app's compact
          scale (lib/size-context.tsx: icon 14px) in an app-wide
          consistency pass; raw px, not the component's default size-4,
          since html's font-size: 90% would otherwise shrink a rem-based
          size below the target.
          No mt-4 on this first row -- section breaks in this menu read
          via spacing alone, no divider lines, but the gap above this
          section comes from whatever precedes NavUserMenuItems (NavUser's
          own desktop dropdown wraps this in a "mt-4" div; top-bar.tsx's
          mobile hamburger menu puts its own "More" section label directly
          above instead) rather than living on this item itself -- putting
          it here too doubled up with that label's own mt-4 there. */}
      <BaseMenuItem
        index={0}
        icon={SettingsIcon}
        label={t("nav.settings")}
        className="gap-[7px]"
        onSelect={() => (onOpenSettings ? onOpenSettings() : navigate("/settings"))}
      />
      <BaseMenuItem index={1} icon={DocsIcon} label={t("nav.docs")} className="gap-[7px]" onSelect={() => navigate("/docs")} />
      <BaseMenuItem index={2} icon={HelpCircleIcon} label={t("nav.helpItem")} className="gap-[7px]" onSelect={() => navigate("/help")} />
      {/* Appearance removed from here -- per explicit request ("remove the
          appearance from the avatar dropdown as we will control that via
          settings"): theme is now only set from Settings -> Appearance
          (settings-overlay.tsx's own AppearanceSection), not duplicated
          here too. */}
      <BaseMenuItem index={3} icon={LogOutIcon} label={t("common.logOut")} className="gap-[7px]" />
      {/* text-foreground opacity-50, not text-ink-3 -- per explicit
          request ("make sure those describers match the style of the
          describer at the sidebar"): this used to say text-ink-3 matched
          the sidebar's own Projects/Recents labels, but that was written
          before those moved to this exact active-color-at-50%-opacity
          treatment (sidebar-nav.tsx's own comment on that row has the
          full history) -- this comment (and Essentials' own below) never
          followed, so the two menus had drifted apart again. mt-4, not mt-2 -- this is a
          real section break (Provider usage vs. the Settings/.../Log out
          group above it), so it gets more breathing room than the
          within-section mt-2 spacing elsewhere. "Provider usage", not
          "Models Usage" -- per explicit request, now that each row is a
          provider (real per-provider message counts, see
          useProviderUsagePercents above), not a specific model any more. */}
      <BaseDropdownLabel className="mt-4 text-xs font-normal text-foreground opacity-50">{t("settings.providers.usage.title")}</BaseDropdownLabel>
      {USAGE_PROVIDERS.map((model, i) => (
        // CustomMenuItem, not MenuItem -- this row's real content (the
        // usage bars) doesn't fit MenuItem's fixed icon+label+check
        // layout, and per explicit request ("not allow to be bg hover
        // because that's missing how the actual graph shows") it also
        // can't use MenuItem's own shared hover background at all --
        // CustomMenuItem skips proximity-hover registration entirely, so
        // it never participates in that overlay. index continues after
        // the 4 rows above (0-3), so proximity/keyboard ordering stays
        // correct across the whole menu. onSelect still opens /models --
        // that page is the real, full breakdown these bars are just a
        // teaser for.
        <CustomMenuItem
          key={model.provider}
          index={4 + i}
          label={model.provider}
          onSelect={() => navigate("/settings/provider/usage")}
          className="relative z-10 flex h-7 shrink-0 items-center gap-1 rounded-[7px] px-1.5 text-[12px] font-normal text-muted-foreground cursor-pointer"
        >
          {/* size-3.5 (14px), not size-4 (16px) -- per an app-wide
              compact-scale audit, matching every other icon in this menu
              (above). */}
          <ProviderIcon model={model} className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">{model.provider}</span>
          <ModelUsageBars provider={model.provider} usagePercent={usagePercents[model.provider] ?? 0} />
        </CustomMenuItem>
      ))}
    </>
  )
}

// Sidebar footer's own trimmed-down avatar dropdown (Log out + Provider
// usage only) -- Settings/Docs/Help moved out to their own separate
// sidebar rows (Settings its own standalone row, Docs/Keybindings in the
// new HelpMenuItems dropdown below). Now holds only the real-time
// notification feed, per explicit request ("drop the avatar dropdown
// showing logout and models usage to show only notifications"): both
// Log out (Settings -> General's own "Log out" row) and Provider usage
// (Settings -> Provider's own "Provider usage" card) already have a real
// home elsewhere, so this dropdown no longer duplicates them. The top
// bar's own NavUser/mobile hamburger menu keep the full NavUserMenuItems
// above unchanged -- this split is sidebar-specific.
export function AccountMenuItems() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const notifications = useTurnNotifications()
  const isSignedIn = useIsSignedIn()
  // Clears (and stops recomputing) the shared proximity hover while the
  // pointer is over the notification list below -- real bug, confirmed
  // directly ("when i scroll through the notifications, the hover is
  // stuck at sign in even though i am literally on top of a
  // notification"): CustomMenuItem rows deliberately skip proximity
  // registration (that row's own comment below has the reasoning), so the
  // dropdown's own mousemove handler kept picking the *nearest registered*
  // row -- Sign in/Log out, the closest real MenuItem below this list --
  // regardless of which unregistered notification the cursor was actually
  // over.
  const { setActiveIndex } = useDropdownMaybe() ?? {}

  // Prunes stray notifications whose chat no longer exists -- real bug,
  // confirmed directly ("why I just got an untitled chat at
  // notifications? ... its not at my inbox of chats"), see that function's
  // own comment (turn-notifications.ts) for the full reasoning. Runs once
  // per time this dropdown actually opens (this component only mounts
  // then), not on a timer -- nothing else changes chat existence while
  // it's open.
  useEffect(() => {
    void pruneMissingChatNotifications()
  }, [])

  // Forces a re-render every 30s purely so formatNotificationTime's own
  // relative-time strings ("Just now" -> "5 min ago") actually advance
  // while the dropdown is left open -- real bug, confirmed directly ("that
  // now show just now but should be 5 min ago as an example"):
  // formatNotificationTime only ever ran once, at the render that first
  // showed a given notification, and nothing forced a re-render after
  // that.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {/* mb-1 on this row -- per explicit request ("give a gap between the
          describer and dismiss all"), a real gap below the header row
          before the list starts, on top of the justify-between that was
          already spacing the label and button apart from each other. */}
      <div className="mt-2 mb-1 flex items-center justify-between gap-2 px-2">
        <span className="text-xs font-normal text-foreground opacity-50">{t("settings.general.notifications")}</span>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={() => dismissAllTurnNotifications()}
            className="text-[11px] font-normal text-muted-foreground hover:text-foreground"
          >
            {t("nav.notifications.dismissAll")}
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        // Short "No notifications" placeholder, matching the sidebar's own
        // "No projects"/"No chats" (sidebar-nav.tsx) -- per explicit
        // follow-up request ("we should say No projects, No chats, No
        // notifications like chatgpt does instead of being empty"),
        // reversing an earlier "remove the placeholder text entirely"
        // request.
        // Same onMouseEnter/onMouseMove pair as the real notification list
        // below -- confirmed directly as the identical bug recurring here
        // ("hovering to No notifications that keeps the hover stuck at
        // sign in"): this placeholder isn't a registered MenuItem either,
        // so without this the shared dropdown's own mousemove handler
        // still picked the nearest *registered* row (Sign in/Log out)
        // while hovering empty space above it.
        <div
          className="flex h-9 items-center px-2 text-[12px] font-normal text-muted-foreground opacity-50"
          onMouseEnter={() => setActiveIndex?.(null)}
          onMouseMove={(event) => event.stopPropagation()}
        >
          {t("nav.notifications.empty")}
        </div>
      ) : (
        // max-h-[208px] (4 * 52px rows) + overflow-y-auto -- per explicit
        // request ("cap the size at 4 notifications, if there are more
        // than this we should add a scroll mechanism"). min-h-[52px] on
        // each row below keeps that math exact regardless of content.
        // onMouseEnter clears the shared hover once; onMouseMove then stops
        // the event from ever reaching the dropdown's own mousemove handler
        // while inside this region, so it can't immediately recompute and
        // re-pick "Sign in" again on the very next pixel of movement (this
        // component's own top comment has the full bug report).
        <div
          className="max-h-[208px] overflow-y-auto"
          onMouseEnter={() => setActiveIndex?.(null)}
          onMouseMove={(event) => event.stopPropagation()}
        >
          {notifications.map((notification, i) => (
            <CustomMenuItem
              key={notification.id}
              index={i}
              label={notification.chatName}
              onSelect={() => navigate(`/chat/${notification.chatId}`)}
              className="relative z-10 flex min-h-[52px] shrink-0 items-start gap-2 px-2 py-1.5 text-2xs font-normal text-muted-foreground cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{notification.chatName}</p>
                <p className="truncate">{t("nav.notifications.replied", { model: notification.modelLabel })}</p>
                <p className="opacity-50">{formatNotificationTime(notification.timestamp)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  dismissTurnNotification(notification.id)
                }}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={t("nav.notifications.dismiss")}
              >
                <XIcon className="size-3.5" />
              </button>
            </CustomMenuItem>
          ))}
        </div>
      )}
      {/* Sign in/Log out, after Notifications with a divider -- per
          explicit request ("the avatar dropdown should have the signin
          after notifications... with a line separator, when the dropdown
          should flip to logout when signed in"). Same account-state flip
          Settings' own Caution row (settings-overlay.tsx) already uses.
          Plain BaseMenuItem now -- the shared proximity-hover system
          itself was made edge-to-edge/no-radius app-wide (ui/dropdown.tsx's
          own panels dropped their p-1/gap-0.5, shape-context.tsx's
          "rounded" variant dropped its item/bg radius), per explicit
          follow-up request ("apply the same hover fix... every item in
          every dropdown"), so the earlier per-item CustomMenuItem/negative-
          margin patch here is no longer needed -- every row gets this for
          free now, including this one. */}
      <DropdownSeparator />
      {/* Profile, above Sign in/Log out -- per explicit request ("the
          avatar dropdown should have a Profile menu above Sign in/Sign
          out that brings to the settings profile"). Plain navigate, same
          as settings-overlay.tsx's own "Provider usage" row does for a
          specific section, rather than threading a new onOpenSettings
          argument through SidebarNav/AppLayout just for this one row. */}
      <BaseMenuItem
        index={notifications.length}
        icon={UserIcon}
        label={t("settings.nav.profile")}
        className="gap-[7px] pl-2.5"
        onSelect={() => navigate("/settings/profile")}
      />
      <BaseMenuItem
        index={notifications.length + 1}
        icon={isSignedIn ? LogOutIcon : LogInIcon}
        label={isSignedIn ? "Log out" : "Sign in"}
        // pl-2.5, matching the model picker's own "Add provider" row
        // (compose-box.tsx, a DropdownSubItem there) -- per explicit
        // request ("the + Add provider inside model looks good with the
        // spacing, apply the same to sign in and sign out at the avatar
        // dropdown"): that row's own pl-2.5/pr-2.5 sits slightly further
        // from the panel edge than MenuItem's own baked-in px-2 default.
        className="gap-[7px] pl-2.5"
        onSelect={() => (isSignedIn ? signOut() : navigate("/auth"))}
      />
    </>
  )
}

// Matches WelcomePage.tsx's own "Coming soon" badge exactly (same classes),
// so a disabled row reads consistently wherever it shows up in the app.
function ComingSoonBadge() {
  const { t } = useTranslation()
  return (
    <span className="ml-1.5 shrink-0 rounded-[4px] bg-hover-2 px-1 py-0.5 text-[10px] font-normal text-muted-foreground">
      {t("compose.soon")}
    </span>
  )
}

// Sidebar footer's own new Help dropdown (Docs + Keybindings) -- split out
// of the avatar dropdown alongside AccountMenuItems above, per the same
// request. Both disabled with a "Coming soon" badge now -- per explicit
// request, ahead of the docs/keybindings features actually existing.
export function HelpMenuItems() {
  const { t } = useTranslation()
  return (
    <>
      <BaseDropdownLabel>{t("nav.helpItem")}</BaseDropdownLabel>
      <BaseMenuItem index={0} icon={DocsIcon} label={t("nav.docs")} className="gap-[7px]" disabled badge={<ComingSoonBadge />} />
      <BaseMenuItem index={1} icon={KeybindingsIcon} label={t("nav.keybindings")} className="gap-[7px]" disabled badge={<ComingSoonBadge />} />
    </>
  )
}

// Lives in the top bar now (top-bar.tsx), not the sidebar footer -- just a
// plain avatar trigger, no sidebar-specific row sizing/collapse behavior
// needed here anymore. Hidden below the xs breakpoint -- top-bar.tsx's
// mobile hamburger menu renders NavUserMenuItems itself there instead, so
// this trigger+dropdown doesn't exist as a second, redundant menu.
export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    // onOpenChange blurring the trigger on close -- same fix as
    // nav-projects.tsx's per-row "..." menu and team-switcher.tsx: Radix
    // returns real DOM focus to a trigger a beat after its menu closes, and
    // that specific programmatic refocus registers as genuine :focus-visible
    // in-browser, leaving the focus ring stuck visible indefinitely
    // otherwise.
    <DropdownMenu
      onOpenChange={(nowOpen) => {
        if (!nowOpen) {
          const button = triggerRef.current
          if (!button) return
          const reblur = () => button.blur()
          button.addEventListener("focus", reblur, { once: true })
          setTimeout(() => button.removeEventListener("focus", reblur), 1000)
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        {/* h-8 w-8 (was h-10 w-10) -- the top bar itself shrank to h-10, and
            the old 40px hit target sat completely flush against its border
            with no breathing room at that height. A real hit target around
            the avatar still, just matched to the smaller bar now. The
            Avatar itself is sized down to size-[19px] (raw px, not Avatar's
            own size="sm" -- html's font-size: 90%, index.css, would
            otherwise shrink a rem-based size below 19px) so the visible
            circle is smaller than its own hit target. */}
        {/* hidden below xs: top-bar.tsx's mobile hamburger menu renders
            NavUserMenuItems itself there instead -- see this component's
            own comment. */}
        <Button ref={triggerRef} className="relative hidden h-8 w-8 rounded-full xs:flex" variant="ghost">
          <Avatar className="size-[19px]">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>
              <DefaultAvatar name={user.name} />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
        {/* rounded-3xl, not rounded-2xl -- this box is roughly the same
            size compose-box.tsx/HomePage.tsx's own cards grow to once
            they have room (their own @container queries step
            rounded-2xl -> rounded-3xl at a similar width), so matching
            that bigger radius reads more consistent with them than
            staying at their smaller, base-size radius. No more hardcoded
            border/shadow (light+dark variants) -- per explicit request
            ("switch from hardcoded code to the drop its own background"):
            the base DropdownMenuContent (ui/dropdown-menu.tsx) now
            supplies a real nesting-aware surface background/shadow
            itself (lib/surface-context.tsx), which already handles light
            vs dark on its own -- this per-callsite override was fighting
            it for no reason. */}
      <DropdownMenuContent
        align="end"
        className="w-64 rounded-3xl px-[12px] pt-[4px] pb-[12px] font-normal"
        side="bottom"
        sideOffset={2}
      >
        {/* mt-2, not this component's own mt-4 default -- tighter gap
            from the dropdown's own top edge, matching MobileMenu's own
            override (top-bar.tsx) now that Essentials below it (this
            file's own comment) got the same tightening. */}
        <NavUserProfileHeader user={user} mt="mt-2" />
        {/* "App", not "Essentials" -- per explicit request ("i don't like
            how we call essentials... what should we call? App?"): this
            section is Settings/Docs/Help/Log out, all app-level actions
            rather than anything about the current chat, so "App" names
            what it actually is instead of a vague catch-all. Same
            section-label convention as this menu's own "Models Usage"
            label further down, and both now match the sidebar's own
            active-color-at-50%-opacity describer treatment (that label's
            own comment has the full history) -- was text-ink-3/font-light,
            a color this file's own comment used to (wrongly) claim already
            matched the sidebar. NavUser's own desktop dropdown previously
            relied on a bare mt-4 wrapper div for the gap from the profile
            header above, with no label at all; a real label reads more
            consistently next to "Models Usage" below it. mt-2, not mt-4 --
            right under the profile header wants a tighter gap than an
            actual section break (like Models Usage vs. the group above it)
            does. top-bar.tsx's mobile hamburger menu keeps its own
            separate "More" label ahead of NavUserMenuItems instead (see
            that component's own comment) -- this one is specific to the
            desktop dropdown, not part of the shared NavUserMenuItems
            component. */}
        <DropdownMenuLabel className="mt-2 text-xs font-normal text-foreground opacity-50">{t("nav.app")}</DropdownMenuLabel>
        <NavUserMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
