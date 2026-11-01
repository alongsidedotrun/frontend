import { useCallback, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PANE_DIALOG_CONTENT, PANE_DIALOG_MAX_HEIGHT } from "@/components/design-system/dialog-size";
import { WorkspaceBrandIcon } from "@/components/design-system/workspace-brand-icon";
import { cn } from "@/lib/utils";
import { ShapeProvider } from "@/lib/shape-context";

// The 8px-looking corner for the 32px controls here (32 × 8/27, STYLE_GUIDE.md: corner radius),
// shared by fields, cards and buttons.
export const SHELL_RADIUS = "rounded-[calc(32px*8/27)]";
// A white card or field on the dialog's #FAFAFA.
export const SHELL_SURFACE = "border border-[var(--redesign-sidebar-border)] bg-white dark:bg-background";

/**
 * The shell's dialog (Invite members, Sign in): one size (dialog-size.ts), a
 * #FAFAFA surface, an optional control on top (tabs), the Alongside tile, a
 * centered title and description, the body, and actions at the bottom.
 */
export function ShellDialog({
  open,
  onOpenChange,
  top,
  title,
  badge,
  description,
  children,
  actions,
  initialFocus,
  icon,
  centered = false,
  transitionKey,
  footnote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Above the tile, e.g. tabs. */
  top?: ReactNode;
  title: ReactNode;
  /** Beside the title, e.g. a status. */
  badge?: ReactNode;
  description: ReactNode;
  children: ReactNode;
  /** Usually <ShellDialogActions>. */
  actions?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  /** In place of the Alongside tile, e.g. a workspace's own tile (32px). */
  icon?: ReactNode;
  /** Header, content and actions together in the middle (Sign in), not actions at the bottom. */
  centered?: boolean;
  /** A step's key (Sign in: email, details, code): changing it fades the page out and the next one in. */
  transitionKey?: string;
  /** Under the actions, e.g. Sign in's terms. */
  footnote?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  // The content's own height, which the dialog animates to.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const contentRef = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element || typeof ResizeObserver === "undefined") return;
    const next = new ResizeObserver(() => setContentHeight(element.offsetHeight));
    next.observe(element);
    observer.current = next;
  }, []);
  const header = (
    <div className="relative -top-6 flex flex-col items-center gap-0.5 pt-1 text-center">
      {/* The Alongside mark on a workspace-style tile, unless the dialog brings its own. */}
      <div className="mb-2">{icon ?? <WorkspaceBrandIcon size={32} />}</div>
      <div className="flex items-center gap-2">
        <DialogTitle className="text-ui-xl font-medium text-foreground">{title}</DialogTitle>
        {badge}
      </div>
      <DialogDescription className="text-ui-sm text-muted-foreground">{description}</DialogDescription>
    </div>
  );
  return (
    // !z-[120]: above the app top bar (z-[110]), like the other shell dialogs.
    <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
      <DialogContent size="xl" motion="gentle" initialFocus={initialFocus} className={PANE_DIALOG_CONTENT}>
        {/* As tall as the content (up to the max, then it scrolls), growing and shrinking smoothly
            when the content changes, e.g. between Sign in's steps. */}
        <motion.div
          initial={false}
          animate={{ height: contentHeight ?? "auto" }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(PANE_DIALOG_MAX_HEIGHT, "overflow-y-auto bg-[#FAFAFA] dark:bg-[var(--redesign-primary-surface)]")}
        >
        <div ref={contentRef} className="flex flex-col gap-3 px-[max(2.5rem,15%)] py-20">
          {/* The header below is pulled up 24px (-top-6); this keeps it clear of the tabs. */}
          {top && <div className="mb-6 flex flex-col">{top}</div>}
          {centered ? (
            // One step out, then the next in: a fade, while the dialog eases to the new height.
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={transitionKey}
                className="my-auto flex flex-col gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.12, ease: [0.4, 0, 1, 1] } }}
              >
                {header}
                {children}
                {actions}
                {footnote}
              </motion.div>
            </AnimatePresence>
          ) : (
            <>
              {header}
              {children}
              {actions}
              {footnote}
            </>
          )}
        </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A shell dialog's content as a page in the main area (New and Manage workspace): the same tile, title,
 * description, body and actions, centred in the page instead of over it. Takes ShellDialog's props;
 * `open`, `onOpenChange`, `initialFocus` and `centered` don't apply to a page.
 */
export function ShellPage({
  top,
  title,
  badge,
  description,
  children,
  actions,
  icon,
  transitionKey,
  footnote,
}: Parameters<typeof ShellDialog>[0]) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative flex min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="m-auto flex w-full max-w-[400px] flex-col gap-3 px-4 py-16">
        {top && <div className="mb-6 flex flex-col">{top}</div>}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={transitionKey}
            className="flex flex-col gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.12, ease: [0.4, 0, 1, 1] } }}
          >
            <div className="flex flex-col items-center gap-0.5 pb-3 text-center">
              <div className="mb-2">{icon ?? <WorkspaceBrandIcon size={32} />}</div>
              <div className="flex items-center gap-2">
                <h1 className="text-ui-xl font-medium text-foreground">{title}</h1>
                {badge}
              </div>
              <p className="text-ui-sm text-muted-foreground">{description}</p>
            </div>
            {children}
            {actions}
            {footnote}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * The bottom of a shell dialog: Cancel (white) over the main action (black;
 * white in dark mode), both full width.
 */
export function ShellDialogActions({
  cancelLabel,
  onCancel,
  primary,
  pills = false,
}: {
  cancelLabel: string;
  onCancel: () => void;
  /** destructive: red, for deleting. */
  primary?: { label: string; onClick?: () => void; disabled?: boolean; loading?: boolean; type?: "button" | "submit"; form?: string; destructive?: boolean };
  /** A page's buttons (ShellPage): round pills side by side, the secondary then the primary, as the New
   *  bot form's Reset and Create. */
  pills?: boolean;
}) {
  if (pills) {
    return (
      <ShapeProvider defaultShape="pill">
        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          <Button type="button" size="compact" variant="tertiary" className="h-9 w-full px-5" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {primary && (
            <Button
              type={primary.type ?? "button"}
              form={primary.form}
              size="compact"
              // Deleting is red (the same colours as the dialogs' destructive button).
              variant={primary.destructive ? "accent" : "primary"}
              className={cn(
                "h-9 w-full px-5",
                primary.destructive &&
                  "[--send-button-bg-active:color-mix(in_oklab,var(--destructive),black_25%)] [--send-button-bg-hover:color-mix(in_oklab,var(--destructive),black_12%)] [--send-button-bg:var(--destructive)]",
              )}
              disabled={primary.disabled}
              loading={primary.loading}
              onClick={primary.onClick}
            >
              {primary.label}
            </Button>
          )}
        </div>
      </ShapeProvider>
    );
  }
  return (
    <div className="mt-auto flex flex-col gap-2 pt-1">
      <Button type="button" variant="tertiary" className={cn("h-8 w-full bg-white dark:bg-transparent", SHELL_RADIUS)} onClick={onCancel}>
        {cancelLabel}
      </Button>
      {primary && (
        <Button
          type={primary.type ?? "button"}
          form={primary.form}
          variant="accent"
          // Full black (white in dark mode), with darker/lighter hover and press.
          className={cn(
            "h-8 w-full",
            primary.destructive
              ? "[--send-button-bg-active:color-mix(in_oklab,var(--destructive),black_25%)] [--send-button-bg-hover:color-mix(in_oklab,var(--destructive),black_12%)] [--send-button-bg:var(--destructive)]"
              : "[--send-button-bg-active:#404040] [--send-button-bg-hover:#262626] [--send-button-bg:#000] dark:text-black dark:[--send-button-bg-active:#D4D4D4] dark:[--send-button-bg-hover:#E5E5E5] dark:[--send-button-bg:#FFF]",
            SHELL_RADIUS,
          )}
          disabled={primary.disabled}
          loading={primary.loading}
          onClick={primary.onClick}
        >
          {primary.label}
        </Button>
      )}
    </div>
  );
}

/**
 * A labelled row in a shell dialog: the label on the left (one width, so rows
 * line up) and the value or input after it, 32px tall on a white field.
 */
export function ShellField({ label, htmlFor, children, trailing, className }: { label: string; htmlFor?: string; children: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-8 items-center gap-2 pr-0.5 pl-3 text-ui", SHELL_RADIUS, SHELL_SURFACE, className)}>
      <label htmlFor={htmlFor} className="w-[72px] shrink-0 truncate text-ui-sm text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
      {trailing}
    </div>
  );
}

// An input inside a ShellField: transparent, with no border, radius or padding of its own (the
// field around it has them), and room for descenders (an explicit height and line height, not h-full).
export const SHELL_FIELD_INPUT = "h-7 w-full min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent p-0 text-ui leading-[1.5] text-foreground shadow-none outline-none placeholder:text-muted-foreground/70";
