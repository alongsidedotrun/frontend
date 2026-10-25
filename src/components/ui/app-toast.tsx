import { Toaster, toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "@untitledui/icons";
import { XIcon } from "@/components/icons/untitled-ui";
import { useTheme } from "@/hooks/use-theme";
import { ErrorText } from "@/lib/error-code";

/**
 * The app's toasts: top middle of the window, on the menus' own surface (border, shadow,
 * 12px text), each with a close button. Mounted once (App.tsx); raise one with showErrorToast.
 */
export function AppToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-center" theme={theme} offset={16} gap={8} toastOptions={{ unstyled: true }} />;
}

function ToastCard({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex w-[min(360px,calc(100vw-32px))] items-start gap-2 rounded-xl border border-[var(--redesign-sidebar-elevated-border)] bg-[var(--redesign-sidebar-overlay-surface)] py-2.5 pr-2 pl-3 text-[12px] leading-[1.45] text-foreground shadow-[var(--redesign-sidebar-elevated-shadow)]"
    >
      <AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-destructive" />
      {/* Its (ALS-0xx) code links to the error's entry in the docs. */}
      <span className="min-w-0 flex-1"><ErrorText message={message} /></span>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="-my-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

/** An error toast. The same `id` replaces the one on screen instead of stacking another. */
export function showErrorToast(message: string, options: { id?: string; duration?: number } = {}) {
  return toast.custom((id) => <ToastCard message={message} onClose={() => toast.dismiss(id)} />, {
    id: options.id,
    duration: options.duration ?? 8000,
  });
}
