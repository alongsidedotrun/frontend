import { useEffect } from "react";
import { PageContent } from "@/components/page-content";
import { ScrollArea } from "@/components/ui/scroll-area";

// Placeholder route -- real project data/list is Sprint 4.5 scope (see
// issue #143). For now this is scaffolding only: a full-height red block at
// the shared PageContent width, so this page's width can be visually
// compared against the compose box's own column (and every other new page
// below) before any of them get real content.
export function ProjectsPage() {
  useEffect(() => {
    document.title = "Projects";
  }, []);

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
