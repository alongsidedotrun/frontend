import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Per explicit request ("Instead of showing .md, can we create badges?...
// so that should be example [MD] instead of example.md"): a real, human
// name only for the extensions this app actually knows what to call --
// anything else falls back to its own uppercased extension rather than a
// hardcoded guess.
const EXTENSION_NAMES: Record<string, string> = {
  md: "Markdown",
  markdown: "Markdown",
};

export function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  // dot <= 0, not < 0 -- a dotfile like ".gitignore" has no real extension
  // to badge, just a leading dot.
  if (dot <= 0) return null;
  return name.slice(dot + 1).toLowerCase();
}

export function stripExtension(name: string): string {
  const ext = extensionOf(name);
  return ext ? name.slice(0, name.length - ext.length - 1) : name;
}

// Same visual language as nav-user.tsx's own "Soon" badge (COMING_SOON_BADGE)
// -- per explicit request ("similar to the soon that we have") -- reused
// here as a real file-type indicator instead, with a tooltip spelling out
// the type on hover (e.g. "Markdown" for .md).
export function FileExtensionBadge({ name, className }: { name: string; className?: string }) {
  const ext = extensionOf(name);
  if (!ext) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`shrink-0 rounded-[4px] bg-hover-2 px-1 py-0.5 text-[10px] font-normal text-muted-foreground ${className ?? ""}`}>
          {ext.toUpperCase()}
        </span>
      </TooltipTrigger>
      <TooltipContent>{EXTENSION_NAMES[ext] ?? ext.toUpperCase()}</TooltipContent>
    </Tooltip>
  );
}
