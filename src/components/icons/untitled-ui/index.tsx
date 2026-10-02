import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  DotsHorizontal,
  DotsVertical,
  Edit02,
  Edit05,
  Bell01,
  Archive,
  Trash01,
  Download01,
  Check,
  Microphone01,
  Plus,
  Paperclip,
  MessagePlusCircle,
  Square,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Upload01,
  File01,
  File02,
  File03,
  FilePlus02,
  FileSearch01,
  User01,
  Settings02,
  AlertCircle,
  Code01,
  CodeBrowser,
  HelpCircle,
  InfoCircle,
  BookClosed,
  LogOut01,
  LogIn01,
  Sun,
  Moon01,
  Monitor01,
  PuzzlePiece01,
  PuzzlePiece02,
  FolderPlus,
  Folder,
  HardDrive,
  Figma,
  Table,
  PlusCircle,
  XClose,
  SearchMd,
  Clock,
  FilterLines,
  Share01,
  Inbox01,
  Copy01,
  ClipboardCheck,
  ThumbsDown,
  ThumbsUp,
  VolumeMax,
  Stars02,
  LayoutLeft,
  LayoutRight,
  RefreshCcw05,
  Globe02,
  Keyboard01,
  HomeLine,
  MessageCircle02,
  MessageChatCircle,
  Palette,
  BarChartSquare02,
  ChevronSelectorHorizontal,
  Eraser,
  SwitchHorizontal01,
  AlignLeft02,
  Eye,
  TerminalSquare,
} from "@untitledui/icons";

// This app's one and only icon source now -- replaces Hugeicons (that
// migration's own comment explained the earlier @fluentui/lucide split),
// per explicit request to standardize on Untitled UI icons. Unlike
// Hugeicons (which ships icon *data* through one shared <HugeiconsIcon>
// primitive), Untitled UI ships one real component per icon already, so
// this file is a plain re-export under the app's own call-site names
// (e.g. `<SearchIcon className="size-4" />`) rather than a wrapper
// function -- every icon here already accepts size/color/className/
// strokeWidth (SVGProps<SVGSVGElement>) with no adapter needed.
export {
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  // sidebar-nav.tsx's own Tauri-only back/forward navigation arrows.
  ChevronLeft as ChevronLeftIcon,
  DotsHorizontal as MoreHorizontalIcon,
  // AppLayout.tsx's own chat-header "..." menu (Share chat/Enable notification).
  DotsVertical as DotsVerticalIcon,
  Bell01 as BellIcon,
  // sidebar-nav.tsx's own per-chat "..." menu (Archive/Delete).
  Archive as ArchiveIcon,
  Trash01 as DeleteIcon,
  // settings-overlay.tsx's own "Manage photo" dialog -- Download button.
  Download01 as DownloadIcon,
  Check as CheckIcon,
  Edit02 as EditIcon,
  Edit05 as Edit05Icon,
  Microphone01 as MicIcon,
  Plus as PlusIcon,
  // Compose box's own attach-file button.
  Paperclip as AttachmentIcon,
  // Sidebar's New Chat row.
  MessagePlusCircle as BubbleChatAddIcon,
  // Settings sidebar's own Chat row (settings-overlay.tsx) -- its only call site.
  MessageCircle02 as BubbleChatIcon,
  MessageChatCircle as MessageChatCircleIcon,
  Square as SquareIcon,
  ArrowUp as ArrowUpIcon,
  // settings-overlay.tsx's own provider connection view back button.
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  // AppLayout.tsx's own chat-header Share icon button.
  Upload01 as ArrowUp03Icon,
  // AppLayout.tsx's own chat-header Memory icon button.
  File02 as File02Icon,
  // FileDiff.tsx's own multi-file group header ("Created N new files").
  FilePlus02 as FilePlusIcon,
  User01 as UserIcon,
  Settings02 as SettingsIcon,
  // SettingsOverlay's own "Danger zone" section row.
  AlertCircle as AlertCircleIcon,
  // WelcomePage's own "Initial setup" row.
  Code01 as ComputerProgrammingIcon,
  CodeBrowser as CodeBrowserIcon,
  HelpCircle as HelpCircleIcon,
  InfoCircle as InfoCircleIcon,
  // Docs rows (nav-user.tsx) -- was Edit02, per explicit request ("docs
  // icon should be books-closed icon").
  BookClosed as DocsIcon,
  // Sidebar's own new Help dropdown -- Keybindings row.
  Keyboard01 as KeybindingsIcon,
  LogOut01 as LogOutIcon,
  LogIn01 as LogInIcon,
  Sun as SunIcon,
  Moon01 as MoonIcon,
  // Desktop/system theme option.
  Monitor01 as SystemIcon,
  // Sidebar "Apps" nav item.
  PuzzlePiece02 as IntegrationsIcon,
  // Settings sidebar's own Providers row (settings-overlay.tsx).
  PuzzlePiece01 as ProvidersIcon,
  // Settings sidebar's own Appearance row (settings-overlay.tsx).
  Palette as PaletteIcon,
  // Providers page's own "Provider usage" card, Coming soon grid (settings-overlay.tsx).
  BarChartSquare02 as ProviderUsageIcon,
  // Appearance's own Chat width dropdown -- "Expanded" option ("Standard"
  // reuses SquareIcon, below).
  ChevronSelectorHorizontal as ExpandedWidthIcon,
  // Sidebar "Project" nav item.
  FolderPlus as FolderPlusIcon,
  // Each individual project row (Projects list).
  Folder as FolderIcon,
  // Connect-apps brand marks -- Untitled UI is a generic UI icon set with
  // no logo marks (unlike Hugeicons, which shipped real Dropbox/GitHub/
  // Google Drive glyphs), so these fall back to the closest generic
  // equivalent. None of the five are imported anywhere in the app today
  // (confirmed via grep) -- kept only for API parity with the wrapper's
  // previous export surface, not any real call site.
  HardDrive as DropboxIcon,
  Code01 as GitHubIcon,
  Figma as FigmaIcon,
  Table as SheetsIcon,
  HardDrive as DriveIcon,
  PlusCircle as CirclePlusIcon,
  XClose as XIcon,
  SearchMd as SearchIcon,
  Clock as ClockIcon,
  FilterLines as ListFilterIcon,
  Share01 as ShareIcon,
  Copy01 as CopyIcon,
  RefreshCcw05 as RotateCcwIcon,
  ThumbsUp as ThumbsUpIcon,
  ThumbsDown as ThumbsDownIcon,
  VolumeMax as Volume2Icon,
  Globe02 as ResearchIcon,
  // Compose box's own "+" menu -- Add skill row (compose-box.tsx).
  Stars02 as SkillIcon,
  ClipboardCheck as TaskIcon,
  File03 as DocIcon,
  FileSearch01 as FileSearchIcon,
  // Sidebar's own collapse-toggle row (sidebar-nav.tsx), right-aligned.
  LayoutLeft as SidebarLeftIcon,
  // Sidebar's own Home button, same row (sidebar-nav.tsx).
  HomeLine as HomeIcon,
  // AppLayout.tsx's own chat-header icon for the (not yet built) right-hand sidebar.
  LayoutRight as SidebarRightIcon,
  // PlaceholderPage's own "blank page" mark (page-content.tsx's sibling).
  File01 as BlankPageIcon,
  // Sidebar's own Inbox nav row, above New Chat.
  Inbox01 as InboxIcon,
  // Compose box's / menu rows -- per explicit request ("the commands /
  // are missing icons").
  Eraser as ClearIcon,
  SwitchHorizontal01 as CompareIcon,
  AlignLeft02 as SummarizeIcon,
  // right-panel.tsx's own Markdown preview toggle.
  Eye as PreviewIcon,
  // right-panel.tsx's own Library/Terminal pill tabs.
  TerminalSquare as TerminalIcon,
};

// Hand-authored, not a re-export -- per explicit request ("can we not use
// the same icon as expanded but inverted or mirror so the arrows face
// inside"): Untitled UI's own ChevronSelectorHorizontal (used for
// Appearance's "Expanded" chat-width option, settings-overlay.tsx) draws
// its two chevrons pointing outward ("< >"), and that shape is symmetric
// under both a horizontal mirror and a 180° rotation -- either transform
// produces the exact same image back, so there's no CSS-only way to flip
// it into an inward-pointing ("> <") twin for "Standard". This is that
// same path with each chevron's direction swapped instead, same
// viewBox/stroke/cap/join settings as every generated Untitled UI icon so
// it renders identically to its siblings.
export function ChevronsInwardHorizontalIcon({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  className,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 7l5 5-5 5m16-10-5 5 5 5" />
    </svg>
  );
}
