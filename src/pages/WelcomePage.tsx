import { Trans, useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { SettingsSection } from "@/components/settings-overlay";
import { PAGE_CONTENT_WIDTH } from "@/components/page-content";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { PRIMARY_SIDEBAR_WIDTH } from "@/components/primary-sidebar";
import { GettingStartedRows } from "@/components/getting-started-rows";
import { useGettingStarted } from "@/hooks/use-getting-started";

export function WelcomePage() {
  const { t } = useTranslation();
  // openSettings comes from AppLayout.tsx's own outlet context (same
  // mechanism ChatPage.tsx already uses for chatName/
  // receiveChatNameFromServer) -- opens SettingsOverlay instead of a
  // route navigation, since Settings is a modal now.
  const { openSettings, primarySidebarCollapsed } = useOutletContext<{
    openSettings: (section: SettingsSection) => void;
    primarySidebarCollapsed: boolean;
  }>();
  const navigate = useNavigate();
  const { setShow: setShowGettingStarted } = useGettingStarted();

  useEffect(() => {
    document.title = t("welcome.title");
  }, [t]);

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
    // top: calc(50% - 63px), not a plain top-1/2 -- confirmed directly via
    // the debug-background screenshot: 50% here measures against this
    // component's own box, which already excludes AppLayout.tsx's always-
    // mounted ~40px chat-scoped header above it (a real, space-reserving
    // element, just invisible when no chat is open) -- so centering
    // "within" this box actually lands the content ~20px (half that
    // header's height) below the *window's* true vertical center, not on
    // it. Forty pixels compensate for the parent top bar and reserved child
    // header above this outlet. The additional 23px
    // aligns this shorter three-row block with /onboard/getting-started,
    // whose otherwise-identical content has one extra 42px acknowledgement
    // row plus a 4px group gap; half of that height difference is 23px.
    <div className="absolute inset-0 overflow-y-auto px-4">
      <div
        className="absolute w-full -translate-x-1/2 -translate-y-1/2"
        style={{
          maxWidth: PAGE_CONTENT_WIDTH,
          top: "calc(50% - 63px)",
          left: `calc(50% - ${primarySidebarCollapsed ? 0 : PRIMARY_SIDEBAR_WIDTH / 2}px)`,
        }}
      >
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
            max-w-[390px] -- intentionally matches
            DataAcknowledgementPage's onboarding heading block so both
            subheadings wrap at the same width during navigation. */}
        <div className="mx-auto mt-6 max-w-[390px] text-center">
          <h1 className="text-[18px] font-normal text-foreground">{t("welcome.heading")}</h1>
          <p className="mt-2 text-[13px] font-normal text-muted-foreground">
            {t("welcome.subheading")}
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
          <GettingStartedRows
            onSetupProvider={() => openSettings("provider")}
            onCreateChat={() => navigate("/new/chat")}
          />
        </div>
        {/* Matches AuthPage.tsx's own FieldDescription footer line (same
            text-xs/text-muted-foreground/text-center treatment), per
            explicit request. Real now -- both controls actually hide this
            page (use-getting-started.tsx's own toggle), no longer gated on
            Initial setup being done first (that gating only ever existed
            because there was nothing real to wire up yet). Navigates to
            /new/chat after hiding -- staying on a page that was just told to
            hide itself would be a dead end (this page can't render itself
            hidden, and the sidebar's own Getting started row -- also now
            gone -- was the only other way back to it). "Settings" opens
            the real SettingsOverlay modal directly at General (same
            openSettings mechanism the Initial setup row above uses for
            Providers), not the separate /settings route -- that route is
            SettingsPage.tsx, an unrelated placeholder (literally a red
            block) that predates this modal and has nothing to do with it. */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Trans
            i18nKey="welcome.hide"
            components={[
              <button
                key="0"
                type="button"
                onClick={() => {
                  setShowGettingStarted(false);
                  navigate("/new/chat");
                }}
                className="underline underline-offset-2"
              />,
              <button key="1" type="button" onClick={() => openSettings("general")} className="underline underline-offset-2" />,
            ]}
          />
        </p>
      </div>
      </div>
    </div>
  );
}
