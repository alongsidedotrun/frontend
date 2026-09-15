import { useEffect } from "react";
import { PageContent } from "@/components/page-content";
import { ScrollArea } from "@/components/ui/scroll-area";

// Shared destination for every not-yet-built route reached from the top
// bar's Agent/Code/Design tabs, the avatar dropdown's model rows, and the
// top bar's Notifications/Activity/Invite buttons -- these are real clicks
// that need somewhere to land, not a dead button, but none of them has real
// content decided yet. Same full-height red block as every other
// scaffolded page (ProjectsPage, AppsPage, etc.) -- the blank-page-icon +
// "Placeholder" text version tried first belongs on the sidebar's own
// rows instead (sidebar-nav.tsx), not this page's content.
export function PlaceholderPage({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <PageContent>
          <div className="flex-1 bg-red-500" />
        </PageContent>
      </ScrollArea>
    </div>
  );
}
