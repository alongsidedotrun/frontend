import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const TRANSITION_MS = 220;

export type SetupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  contentClassName?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
};

/**
 * Shared shell for guided setup flows such as data acknowledgement,
 * provider configuration, and app connections. It owns the responsive
 * surface, theme treatment, accessibility, and coordinated enter/exit
 * transitions so each flow only needs to provide its content.
 */
export function SetupDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  icon,
  className,
  contentClassName,
  closeLabel = "Close",
  closeOnBackdrop = false,
}: SetupDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMounted(true);
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setVisible(true);
          panelRef.current?.focus({ preventScroll: true });
        });
      });

      return () => {
        window.cancelAnimationFrame(firstFrame);
        if (secondFrame) window.cancelAnimationFrame(secondFrame);
      };
    }

    setVisible(false);
    closeTimer.current = window.setTimeout(() => {
      setMounted(false);
      previousFocus.current?.focus({ preventScroll: true });
      closeTimer.current = null;
    }, TRANSITION_MS);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mounted, onOpenChange]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-sm transition-[background-color,opacity] duration-200 ease-out",
        visible ? "bg-black/45 opacity-100 dark:bg-black/65" : "bg-black/0 opacity-0",
      )}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[480px] overflow-y-auto rounded-[22px] border border-border bg-popover p-4 text-popover-foreground shadow-2xl shadow-black/30 outline-none transition-[opacity,transform] duration-200 ease-out sm:p-5",
          visible ? "scale-100 opacity-100" : "scale-[0.97] opacity-0",
          className,
        )}
      >
        <button
          type="button"
          aria-label={closeLabel}
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-muted-foreground transition hover:bg-hover-2/50 hover:text-foreground sm:top-5 sm:right-5"
        >
          <X className="size-4" />
        </button>

        {icon && <div className="mb-3 shrink-0 pr-10">{icon}</div>}

        <h2 id={titleId} className="pr-10 text-lg font-medium tracking-[-0.02em]">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-1 max-w-2xl text-xs leading-4 text-muted-foreground">
            {description}
          </p>
        )}

        <div className={cn("mt-5", contentClassName)}>{children}</div>
      </section>
    </div>
  );
}
