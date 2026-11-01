import { createContext, useCallback, useContext, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PANE_DIALOG_CONTENT, PANE_DIALOG_MAX_HEIGHT } from "@/components/design-system/dialog-size";
import { WorkspaceBrandIcon } from "@/components/design-system/workspace-brand-icon";
import { cn } from "@/lib/utils";

// The 8px-looking corner for the 32px controls here (32 × 8/27, STYLE_GUIDE.md: corner radius),
// shared by fields, cards and buttons.
export const SHELL_RADIUS = "rounded-[calc(32px*8/27)]";
// A white card or field on the dialog's #FAFAFA.
export const SHELL_SURFACE = "border border-[var(--redesign-sidebar-border)] bg-white dark:bg-background";

/**
 * How a shell dialog looks. "panel" is the default #FAFAFA panel; "card" is the style of Alongside's
 * pages on waitlist.alongside.run (Listmonk's confirm and unsubscribe pages): the Alongside logo above
 * a rounded card with a faint border, a left-aligned heading, and pill fields and buttons. ShellField and ShellDialogActions follow it; useShellCard() lets a dialog's
 * own pieces follow it too.
 */
export type ShellLook = "panel" | "card";
const ShellLookContext = createContext<ShellLook>("panel");
export const useShellCard = () => useContext(ShellLookContext) === "card";
// In the card look: a field's or a box's corner (pills for single-line fields).
export const SHELL_CARD_BOX = "rounded-[16px] border border-[var(--redesign-sidebar-border)] bg-black/[0.02] dark:bg-white/[0.03]";

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
  asPage = false,
  look = "panel",
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
  /** Drawn in the main area as a page (Sign in, like New bot), not over the app with a backdrop. */
  asPage?: boolean;
  /** "card": the waitlist pages' style (see ShellLook). */
  look?: ShellLook;
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
        {asPage ? (
          <h1 className="text-[15px] font-medium text-foreground">{title}</h1>
        ) : (
          <DialogTitle className="text-[15px] font-medium text-foreground">{title}</DialogTitle>
        )}
        {badge}
      </div>
      {asPage ? (
        <p className="text-[12px] text-muted-foreground">{description}</p>
      ) : (
        <DialogDescription className="text-[12px] text-muted-foreground">{description}</DialogDescription>
      )}
    </div>
  );
  const card = look === "card";
  // With nothing chosen to focus first, the card itself takes it, so no control opens ringed.
  const cardRef = useRef<HTMLDivElement>(null);
  const cardHeader = (
    <div className="flex flex-col gap-1.5 text-left">
      <div className="flex items-center gap-2">
        <DialogTitle className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-foreground">{title}</DialogTitle>
        {badge}
      </div>
      <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">{description}</DialogDescription>
    </div>
  );
  if (card) {
    return (
      <ShellLookContext.Provider value="card">
        <Dialog open={open} onOpenChange={onOpenChange} backdropClassName="!z-[120]">
          <DialogContent
            size="lg"
            motion="gentle"
            initialFocus={initialFocus ?? cardRef}
            showCloseButton={false}
            className="!z-[120] max-w-[min(480px,calc(100vw-2rem))] overflow-visible !rounded-none !border-0 !bg-transparent p-0 !shadow-none"
          >
            <div className="mb-5 flex items-center justify-center gap-2.5">
              {/* The website's mark: the app icon's black tile with three circles. */}
              <WorkspaceBrandIcon size={32} imageSrc="/alongside-mark.svg" />
              <span className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">Alongside</span>
            </div>
            <div ref={cardRef} tabIndex={-1} className={cn("relative flex flex-col gap-4 overflow-y-auto rounded-[20px] outline-none border border-[var(--redesign-sidebar-border)] bg-white p-[clamp(24px,5vw,36px)] dark:bg-[#171717]", PANE_DIALOG_MAX_HEIGHT)}>
              {top && <div className="flex flex-col">{top}</div>}
              {cardHeader}
              {children}
              {actions}
              {footnote}
              {/* Last in the card, so opening it doesn't put the focus ring on the close button. */}
              <DialogClose
                aria-label="Close"
                className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors duration-160 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </ShellLookContext.Provider>
    );
  }
  const body = centered ? (
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
  );
  if (asPage) {
    // The same content, in the page: centred in the main area at the dialog's width, scrolling when
    // the window is short. Escape and Cancel leave the page (onOpenChange(false)).
    if (!open) return null;
    return (
      <div
        className="flex min-h-full w-full flex-1 overflow-y-auto"
        onKeyDown={(event) => {
          if (event.key === "Escape") onOpenChange(false);
        }}
      >
        <div className="m-auto flex w-full max-w-[460px] flex-col gap-3 px-6 py-16">
          {top && <div className="mb-6 flex flex-col">{top}</div>}
          {body}
        </div>
      </div>
    );
  }
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
          {body}
        </div>
        </motion.div>
      </DialogContent>
    </Dialog>
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
}: {
  cancelLabel: string;
  onCancel: () => void;
  /** destructive: red, for deleting. */
  primary?: { label: string; onClick?: () => void; disabled?: boolean; loading?: boolean; type?: "button" | "submit"; form?: string; destructive?: boolean };
}) {
  const card = useShellCard();
  // Card look: Cancel and the main action side by side, as pills.
  const radius = card ? "rounded-full" : SHELL_RADIUS;
  return (
    <div className={cn("mt-auto flex gap-2 pt-1", card ? "flex-row-reverse" : "flex-col")}>
      <Button type="button" variant="tertiary" className={cn(card ? "h-10 flex-1 bg-transparent" : "h-8 w-full bg-white dark:bg-transparent", radius)} onClick={onCancel}>
        {cancelLabel}
      </Button>
      {primary && (
        <Button
          type={primary.type ?? "button"}
          form={primary.form}
          variant="accent"
          // Full black (white in dark mode), with darker/lighter hover and press.
          className={cn(
            card ? "h-10 flex-1" : "h-8 w-full",
            primary.destructive
              ? "[--send-button-bg-active:color-mix(in_oklab,var(--destructive),black_25%)] [--send-button-bg-hover:color-mix(in_oklab,var(--destructive),black_12%)] [--send-button-bg:var(--destructive)]"
              : "[--send-button-bg-active:#404040] [--send-button-bg-hover:#262626] [--send-button-bg:#000] dark:text-black dark:[--send-button-bg-active:#D4D4D4] dark:[--send-button-bg-hover:#E5E5E5] dark:[--send-button-bg:#FFF]",
            radius,
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
  const card = useShellCard();
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[13px]",
        card ? "h-10 rounded-full border border-[var(--redesign-sidebar-border)] bg-black/[0.02] pr-1.5 pl-4 dark:bg-white/[0.03]" : cn("h-8 pr-0.5 pl-3", SHELL_RADIUS, SHELL_SURFACE),
        className,
      )}
    >
      <label htmlFor={htmlFor} className="w-[72px] shrink-0 truncate text-[12px] text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
      {trailing}
    </div>
  );
}

// An input inside a ShellField: transparent, with no border, radius or padding of its own (the
// field around it has them), and room for descenders (an explicit height and line height, not h-full).
export const SHELL_FIELD_INPUT = "h-7 w-full min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent p-0 text-[13px] leading-[1.5] text-foreground shadow-none outline-none placeholder:text-muted-foreground/70";
