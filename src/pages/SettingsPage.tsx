import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SettingsSectionContent, type SettingsSection } from "@/components/settings-overlay";
import { useIsSignedIn } from "@/lib/auth";

const VALID_SECTIONS: SettingsSection[] = ["profile", "general", "appearance", "chat", "provider", "apps", "archived"];

// Full page now, not a modal -- per explicit request ("we need to update
// our settings to be exactly like it... i want a full page setting page"),
// matching Synara's own structure exactly: a real route
// (/settings/:section, App.tsx), rendered through AppLayout's own normal
// Outlet like every other page. AppLayout.tsx's own conditional render
// swaps the main sidebar for SettingsSidebarNav while this is active; this
// component is only the main content pane (SettingsSectionContent,
// settings-overlay.tsx).
export function SettingsPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const isSignedIn = useIsSignedIn();
  const resolved: SettingsSection = VALID_SECTIONS.includes(section as SettingsSection)
    ? section === "profile" && !isSignedIn
      ? "general"
      : (section as SettingsSection)
    : "general";

  useEffect(() => {
    document.title = "Settings";
  }, []);

  useEffect(() => {
    if (section === "profile" && !isSignedIn) navigate("/settings/general", { replace: true });
  }, [isSignedIn, navigate, section]);

  return <SettingsSectionContent section={resolved} />;
}
