import { useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useCliAvailability, type SettingsSection } from "@/components/settings-overlay";
import { PAGE_CONTENT_WIDTH } from "@/components/page-content";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { useGettingStarted } from "@/hooks/use-getting-started";
import { Card, CardGroup, CardMedia, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SizeProvider } from "@/lib/size-context";
import type { IconComponent } from "@/lib/icon-context";
import { ComputerProgrammingIcon, DocIcon, PlusIcon } from "@/components/icons/untitled-ui";

type MenuRow = {
  key: string;
  title: string;
  description: string;
  icon: IconComponent;
  disabled?: boolean;
  // Shows a small "Coming soon" badge next to the title -- per explicit
  // request, disabling this row ahead of the docs actually existing.
  comingSoon?: boolean;
  // Opens Settings' own Providers section (settings-overlay.tsx) instead
  // of navigating, per explicit request ("providers should bring us to
  // the settings page at the providers menu").
  settingsSection?: SettingsSection;
  // Real destinations now, matching exactly what the sidebar's own old
  // New-chat/New-project/New-agent dropdown rows used to navigate to
  // (AppLayout.tsx's own onNewChat -> navigate("/new-chat"); the others were
  // plain navigate("/projects")/navigate("/agent") calls) before that
  // dropdown was removed -- and /docs (App.tsx's own real route) for
  // Learn the features. Was `disabled` + no real action at all, even once
  // "enabled" -- confirmed directly as the actual root cause of a
  // separate, stubborn bug ("the other cards are text seletable... why
  // the first card works and the other don't"): only a Card with a real
  // onClick/href gets Card's own stretched overlay button (ui/card.tsx),
  // which is what was ACTUALLY preventing selection on Initial setup by
  // sitting on top of its text in paint order -- CSS user-select/
  // preventDefault on ancestors, tried repeatedly first, never touches
  // that; only giving every row here a genuine destination does.
  to?: string;
};

// Matches a reference screenshot's layout: logo, then a vertical list of
// icon + title + description rows -- replaces the earlier heading/install-
// snippet layout entirely, not just restyled in place.
function menuRows(initialSetupDone: boolean): MenuRow[] {
  return [
    {
      key: "initial-setup",
      // Flips to "Add new providers" once a provider is connected, per
      // explicit request -- still the same row (same icon, same
      // destination, Settings' own Providers section), just no longer
      // reads as "you haven't done this yet" once it's genuinely done.
      title: initialSetupDone ? "Add new providers" : "Initial setup",
      description: initialSetupDone
        ? "Connect another AI provider."
        : "Connect your first AI provider to get started.",
      icon: ComputerProgrammingIcon,
      settingsSection: "provider",
    },
    {
      key: "new-chat",
      title: "New chat",
      description: "Start a new conversation.",
      icon: PlusIcon,
      disabled: !initialSetupDone,
      to: "/new-chat",
    },
    {
      key: "learn-features",
      title: "Discover more",
      description: "Read our documentation to learn more about the features available.",
      icon: DocIcon,
      disabled: true,
      comingSoon: true,
    },
  ];
}

export function WelcomePage() {
  // openSettings comes from AppLayout.tsx's own outlet context (same
  // mechanism ChatPage.tsx already uses for chatName/
  // receiveChatNameFromServer) -- opens SettingsOverlay instead of a
  // route navigation, since Settings is a modal now.
  const { openSettings } = useOutletContext<{ openSettings: (section: SettingsSection) => void }>();
  const navigate = useNavigate();
  // Real now -- was a hardcoded INITIAL_SETUP_DONE = false constant. Same
  // live check settings-overlay.tsx's own provider cards use (is the
  // claude CLI on PATH); "claude" specifically, not every provider in
  // PROVIDERS, since claude is the only one this app's backend actually
  // launches today (quick-chat-models.tsx's own comment on this).
  const { available } = useCliAvailability("claude");
  const initialSetupDone = available === true;
  const { setShow: setShowGettingStarted } = useGettingStarted();
  const MENU_ROWS = menuRows(initialSetupDone);

  useEffect(() => {
    document.title = "Get Started";
  }, []);

  return (
    // Vertically centered now, not a fixed pt-24 top offset -- per explicit
    // request ("the getting started page needs to go up at the tauri to
    // match the center of the screen vertically"). Two flex-based
    // attempts (justify-center on the container, then margin:auto on the
    // child) both still measured off in real screenshots on *both* web
    // and the desktop app, not just the WKWebView-specific flex/overflow
    // quirk the first miss looked like -- rather than guess a third flex
    // variant, this now copies the exact absolute/top-50%/translate
    // technique HomePage.tsx and InboxPage.tsx already use for their own
    // vertical centering (their own comments have the full "why not
    // padding/flex" reasoning): a real, already-proven-in-this-app
    // pattern instead of a new one. Unlike those two pages, this one
    // centers its *whole* content block by its own midpoint rather than
    // just the logo -- Home/Inbox specifically need their logo pinned to
    // the same Y as each other regardless of what's below it (that's why
    // they only center the logo, then offset everything else by a fixed
    // amount from it), but this page has no sibling page it needs to
    // line up with, so centering the whole block is simplest here.
    // top: calc(50% - 20px), not a plain top-1/2 -- confirmed directly via
    // the debug-background screenshot: 50% here measures against this
    // component's own box, which already excludes AppLayout.tsx's always-
    // mounted ~40px chat-scoped header above it (a real, space-reserving
    // element, just invisible when no chat is open) -- so centering
    // "within" this box actually lands the content ~20px (half that
    // header's height) below the *window's* true vertical center, not on
    // it. Shifting up by that same 20px compensates for the header eating
    // space only off the top, with nothing reserved at the bottom to
    // balance it.
    <div className="absolute inset-0 overflow-y-auto px-4">
      <div className="absolute left-1/2 w-full -translate-x-1/2 -translate-y-1/2" style={{ maxWidth: PAGE_CONTENT_WIDTH, top: "calc(50% - 20px)" }}>
      <div className="mx-auto w-1/2">
        {/* AlongsideLogo (components/icons/alongside-logo.tsx) -- inline
            SVG, not <img src="/logo.svg">, so its own color actually
            swaps with this app's light/dark theme. text-black dark:text-
            white -- AlongsideLogo now inherits color (fill-current)
            rather than carrying its own dark/light opinion (that
            component's own comment has the full reasoning -- the change
            was for the sidebar's own Getting started row); this page sets
            that same "dark mark in light mode, light mark in dark mode"
            look itself, same as HomePage's own logo. size-[32px] (was
            48px, matching HomePage.tsx's own logo -- shrunk here per
            explicit request, so the two no longer match). mx-auto centers
            it horizontally within the (now narrower) content column -- a
            flex item with an explicit size still defaults to sitting at
            the column's start edge otherwise. */}
        <AlongsideLogo className="mx-auto size-[32px] text-black dark:text-white" />
        {/* Heading + subheading -- per explicit request ("Getting started
            should have a heading and subheading so for Heading do A few
            things before getting started"), same text-[18px]/text-[13px]
            heading/subheading treatment HomePage.tsx's own "Ask anything"
            uses, so this page reads consistently with the rest of the app
            instead of jumping straight from the logo to the row list.
            w-[200%] -ml-[50%] -- this div's own parent is the narrower
            w-1/2 column the rows below share, but the subheading sentence
            needs the *full* 800px column's width to stay on one line --
            confirmed directly as wrapping to two lines specifically in
            the desktop app's own (narrower) default window width. Percent
            width/margin, not a fixed px override, so this stays correct
            at any window size: CSS resolves both against the parent's
            own width, so this always widens back out to exactly the
            *outer* w-full column's width and re-centers within the
            narrower parent, regardless of what that parent's actual
            computed width happens to be. */}
        <div className="mt-6 -ml-[50%] w-[200%] text-center">
          <h1 className="text-[18px] font-normal text-foreground">A few things before getting started</h1>
          <p className="mt-2 text-[13px] font-normal text-muted-foreground">
            Connect a provider and explore what you can do at Alongside.
          </p>
        </div>
        {/* mt-6 (was mt-10) -- per explicit request ("bring the cards up a
            bit as there's a space between the subheadings"), tightening
            the gap below the subheading. fluidfunctionalism.com's own
            Card/CardGroup
            (ui/card.tsx). No border="outlined" any more -- per explicit
            request (a reference screenshot of the plain "Selected" preset,
            no surrounding frame): rows just sit directly in the column,
            the selected one's own fill/rounded corners providing all the
            visual structure on its own. orientation="inline" -- leading
            media, trailing content, like a table row, matching the same
            icon-tile treatment this session already adopted elsewhere via
            the reference component set. Card's own onClick/disabled/label
            replace the old plain <button> -- disabled still fully blocks
            New chat until Initial setup finishes (no provider connected
            yet), same reasoning as before, just handled by Card itself now
            instead
            of a manual disabled button. */}
        {/* SizeProvider size="compact" -- per explicit request ("make the
            items in getting started much smaller and use our
            conventions"), the same compact scale every other dropdown/row
            in this app already opts into (compose-box.tsx's own
            size="compact" dropdowns) instead of Card's own larger default
            step. No persistent `selected` state any more -- per explicit
            request ("remove the selected status at the card"), reverting
            the earlier "Selected" preset experiment. highlightClassName --
            per explicit request ("make sure the hover effects match our
            hover at the sidebar"): matches sidebar-nav.tsx's own GlideGroup
            highlight exactly (bg-hover-2/50, rounded-[7px]) instead of
            Card's own default bg-hover + shape-context rounding.
            divided={false} -- per explicit request ("Remove this lines at
            it"), the hairline dividers a borderless, non-separated
            CardGroup draws between adjacent rows by default. */}
        <div className="mt-6">
          <SizeProvider size="compact">
          {/* gap-1 (4px) -- matches the sidebar's own GlideGroup row gap
              exactly (sidebar-nav.tsx), per explicit request ("increase
              the gaps in these items to match the gaps between menu at
              sidebar"): without dividers (divided={false}, above) the
              rows were flush against each other (CardGroup's own default
              gap-0 for a non-separated group), reading as cramped. */}
          <CardGroup orientation="inline" highlightClassName="bg-hover-2/50 rounded-[7px]" divided={false} className="gap-1">
            {MENU_ROWS.map((row) => (
              <Card
                key={row.key}
                disabled={row.disabled}
                label={row.title}
                // Every row gets a real onClick now -- the settingsSection
                // one still opens Settings, the rest navigate to their own
                // real `to` destination (MenuRow's own comment has the
                // full reasoning: this is also what actually fixes the
                // text-selection bug, not any of the CSS-level patches
                // tried first). Card's own select-none (ui/card.tsx) only
                // ever applied `clickable && "select-none"` -- every row
                // is genuinely clickable now, so that already covers it
                // without needing an override here.
                onClick={
                  row.settingsSection
                    ? () => openSettings(row.settingsSection!)
                    : row.to
                      ? () => navigate(row.to!)
                      : undefined
                }
              >
                <CardMedia icon={row.icon} />
                <CardHeader>
                  <CardTitle>
                    {row.title}
                    {row.comingSoon && (
                      <span className="ml-1.5 rounded-[4px] bg-hover-2 px-1 py-0.5 text-[10px] font-normal text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{row.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </CardGroup>
          </SizeProvider>
        </div>
        {/* Matches AuthPage.tsx's own FieldDescription footer line (same
            text-xs/text-muted-foreground/text-center treatment), per
            explicit request. Real now -- both controls actually hide this
            page (use-getting-started.tsx's own toggle), no longer gated on
            Initial setup being done first (that gating only ever existed
            because there was nothing real to wire up yet). Navigates to
            /new-chat after hiding -- staying on a page that was just told to
            hide itself would be a dead end (this page can't render itself
            hidden, and the sidebar's own Getting started row -- also now
            gone -- was the only other way back to it). "Settings" opens
            the real SettingsOverlay modal directly at General (same
            openSettings mechanism the Initial setup row above uses for
            Providers), not the separate /settings route -- that route is
            SettingsPage.tsx, an unrelated placeholder (literally a red
            block) that predates this modal and has nothing to do with it. */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          You can hide this page by{" "}
          <button
            type="button"
            onClick={() => {
              setShowGettingStarted(false);
              navigate("/new-chat");
            }}
            className="underline underline-offset-2"
          >
            clicking here
          </button>
          , or from{" "}
          <button type="button" onClick={() => openSettings("general")} className="underline underline-offset-2">
            Settings
          </button>
          .
        </p>
      </div>
      </div>
    </div>
  );
}
