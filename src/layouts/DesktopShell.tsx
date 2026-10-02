import { useState } from "react";
import { AppTopBar } from "@/components/app-top-bar";
import { PrimarySidebar } from "@/components/primary-sidebar";
import { WorkspaceSurface } from "@/components/workspace-surface";

/** The parent navigation shell while the child workspace is being redesigned. */
export function DesktopShell() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative h-dvh min-h-0 w-full bg-[#1a1a1a]">
      <AppTopBar
        collapsed={collapsed}
        onCollapseAll={() => setCollapsed(true)}
        onExpand={() => setCollapsed(false)}
      />
      <div className="absolute inset-0 flex min-h-0">
        <PrimarySidebar
          collapsed={collapsed}
          onOpenSettings={() => undefined}
        />
        <div className="mt-10 flex min-h-0 min-w-0 flex-1">
          <WorkspaceSurface collapsed={collapsed}>{null}</WorkspaceSurface>
        </div>
      </div>
    </div>
  );
}
