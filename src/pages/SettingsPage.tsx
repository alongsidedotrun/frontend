import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { SettingsSectionContent, type SettingsSection } from "@/components/settings-overlay";

const VALID_SECTIONS: SettingsSection[] = ["profile", "general", "appearance", "chat", "provider", "apps"];

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
  const resolved: SettingsSection = VALID_SECTIONS.includes(section as SettingsSection)
    ? (section as SettingsSection)
    : "general";

  useEffect(() => {
    document.title = "Settings";
  }, []);

  return <SettingsSectionContent section={resolved} />;
}
