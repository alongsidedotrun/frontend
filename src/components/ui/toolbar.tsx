'use client';

import * as React from 'react';

import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type VariantProps, cva } from 'class-variance-authority';
import { ChevronDown, MoreHorizontalIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Toolbar({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      className={cn('relative flex select-none items-center', className)}
      {...props}
    />
  );
}

export function ToolbarToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.ToolbarToggleGroup>) {
  return (
    <ToolbarPrimitive.ToolbarToggleGroup
      className={cn('flex items-center', className)}
      {...props}
    />
  );
}

export function ToolbarLink({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Link>) {
  return (
    <ToolbarPrimitive.Link
      className={cn('font-medium underline underline-offset-4', className)}
      {...props}
    />
  );
}

export function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      className={cn('mx-2 my-1 w-px shrink-0 bg-border', className)}
      {...props}
    />
  );
}

// From toggleVariants
// text-sm -> text-xs, size-4 -> size-3.5 icons, and the "sm"/"default"
// heights each stepped down 4px -- real bug, confirmed directly ("The
// toolbar of plate needs to reduce the size of the icons and dropdowns
// and text to match smaller screens, does that do by default?"): Plate's
// own defaults are sized for a full document page, same class of problem
// BlockNote's defaults had in this same narrow side panel before the
// Plate migration -- it doesn't auto-scale down, so this app's own
// compact scale (menu-item.tsx's own BaseMenuItem: text-xs labels,
// size-3.5 icons) needs to be applied here explicitly, same as it was
// for BlockNote. This file is Plate-only (no other part of the app
// imports it), so these defaults apply everywhere they're used without
// touching any other toolbar/menu in the app.
const toolbarButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-xs outline-none transition-[color,box-shadow] hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-checked:bg-accent aria-checked:text-accent-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-8 min-w-8 px-1.5',
        lg: 'h-9 min-w-9 px-2',
        sm: 'h-7 min-w-7 px-1',
      },
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
      },
    },
  }
);

const dropdownArrowVariants = cva(
  cn(
    'inline-flex items-center justify-center rounded-r-md font-medium text-foreground text-xs transition-colors disabled:pointer-events-none disabled:opacity-50'
  ),
  {
    defaultVariants: {
      size: 'sm',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-8 w-6',
        lg: 'h-9 w-8',
        sm: 'h-7 w-4',
      },
      variant: {
        default:
          'bg-transparent hover:bg-muted hover:text-muted-foreground aria-checked:bg-accent aria-checked:text-accent-foreground',
        outline:
          'border border-input border-l-0 bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
    },
  }
);

type ToolbarButtonProps = {
  isDropdown?: boolean;
  pressed?: boolean;
} & Omit<
  React.ComponentPropsWithoutRef<typeof ToolbarToggleItem>,
  'asChild' | 'value'
> &
  VariantProps<typeof toolbarButtonVariants>;

export const ToolbarButton = withTooltip(function ToolbarButtonContent({
  children,
  className,
  isDropdown,
  pressed,
  size = 'sm',
  variant,
  ...props
}: ToolbarButtonProps) {
  return typeof pressed === 'boolean' ? (
    <ToolbarToggleGroup disabled={props.disabled} value="single" type="single">
      <ToolbarToggleItem
        className={cn(
          toolbarButtonVariants({
            size,
            variant,
          }),
          isDropdown && 'justify-between gap-1 pr-1',
          className
        )}
        value={pressed ? 'single' : ''}
        {...props}
      >
        {isDropdown ? (
          <>
            <div className="flex flex-1 items-center gap-2 whitespace-nowrap">
              {children}
            </div>
            <div>
              <ChevronDown
                className="size-3.5 text-muted-foreground"
                data-icon
              />
            </div>
          </>
        ) : (
          children
        )}
      </ToolbarToggleItem>
    </ToolbarToggleGroup>
  ) : (
    <ToolbarPrimitive.Button
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        isDropdown && 'pr-1',
        className
      )}
      {...props}
    >
      {children}
    </ToolbarPrimitive.Button>
  );
});

export function ToolbarSplitButton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToolbarButton>) {
  return (
    <ToolbarButton
      className={cn('group flex gap-0 px-0 hover:bg-transparent', className)}
      {...props}
    />
  );
}

type ToolbarSplitButtonPrimaryProps = Omit<
  React.ComponentPropsWithoutRef<typeof ToolbarToggleItem>,
  'value'
> &
  VariantProps<typeof toolbarButtonVariants>;

export function ToolbarSplitButtonPrimary({
  children,
  className,
  size = 'sm',
  variant,
  ...props
}: ToolbarSplitButtonPrimaryProps) {
  return (
    <span
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        'rounded-r-none',
        'group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function ToolbarSplitButtonSecondary({
  className,
  size,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<'span'> &
  VariantProps<typeof dropdownArrowVariants>) {
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
    },
    []
  );

  return (
    <span
      className={cn(
        dropdownArrowVariants({
          size,
          variant,
        }),
        'group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground',
        className
      )}
      onClick={handleClick}
      role="button"
      {...props}
    >
      <ChevronDown className="size-3.5 text-muted-foreground" data-icon />
    </span>
  );
}

export function ToolbarToggleItem({
  className,
  size = 'sm',
  variant,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.ToggleItem> &
  VariantProps<typeof toolbarButtonVariants>) {
  return (
    <ToolbarPrimitive.ToggleItem
      className={cn(toolbarButtonVariants({ size, variant }), className)}
      {...props}
    />
  );
}

export function ToolbarGroup({
  children,
  className,
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group/toolbar-group',
        'relative hidden has-[button]:flex',
        className
      )}
    >
      <div className="flex items-center">{children}</div>

      <div className="group-last/toolbar-group:hidden! mx-1.5 py-0.5">
        <Separator orientation="vertical" />
      </div>
    </div>
  );
}

// Collapses trailing toolbar groups into a "..." menu once they no
// longer fit -- real feature request ("when an item is missing out of
// view, we should make the last visible item to become a three dots so
// when users click at it they can see the options that could not fit
// into the toolbar"), on top of (not replacing) FixedToolbar's own
// horizontal-scroll fallback for whatever's still too narrow to show
// even the first group.
//
// A real priority-nav pattern, not a fixed breakpoint list: every group
// is measured exactly once, on mount, while all of them are still
// actually rendered in the row (the only moment their real widths are
// knowable without permanently double-mounting every toolbar button --
// each one carries its own hooks/effects/editor state, so a second,
// always-present "invisible measuring copy" of the whole toolbar would
// mean every button's logic runs twice, all the time, just to measure
// something that's fixed once known). Those cached widths, not a fresh
// measurement, drive every later recalculation, including widening the
// panel back out -- a group hidden into the overflow menu is genuinely
// unmounted from the visible row (not just visually hidden), so it has
// no width to remeasure directly once it's inside the "..." dropdown
// instead.
export function ToolbarOverflow({ children }: { children: React.ReactNode }) {
  const items = React.useMemo(() => React.Children.toArray(children), [children]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const widthsRef = React.useRef<number[]>([]);
  const moreRef = React.useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = React.useState(false);
  const [visibleIndices, setVisibleIndices] = React.useState<Set<number>>(
    () => new Set(items.map((_, index) => index))
  );

  // First-fit, not a strict prefix cutoff -- real bug, confirmed directly
  // via screenshot ("There's a big gap between More and Highlight"): a
  // plain "stop at the first group that doesn't fit" cutoff throws away
  // every group after that one too, even when a later, narrower group
  // (e.g. a single-icon group after a wide dropdown-heavy one) would
  // still fit in the space that first wide group left unused. Checking
  // every remaining group against the budget, not just the next one in
  // line, fills that space instead of leaving it empty. Order in the
  // visible row is still the original left-to-right order -- this only
  // decides which groups show, never reorders them.
  const recalculate = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || widthsRef.current.length < items.length) return;
    const containerWidth = container.clientWidth;
    const moreWidth = moreRef.current?.offsetWidth ?? 36;
    const widths = widthsRef.current;
    const visible = new Set<number>();
    let total = 0;
    let anyHidden = false;
    for (let i = 0; i < items.length; i++) {
      const width = widths[i] ?? 0;
      if (total + width <= containerWidth) {
        total += width;
        visible.add(i);
      } else {
        anyHidden = true;
      }
    }
    if (anyHidden) {
      // Make room for the "..." button itself, dropping the most
      // recently added groups (in original order, from the end) until
      // it fits.
      for (let i = items.length - 1; i >= 0 && total + moreWidth > containerWidth; i--) {
        if (visible.has(i)) {
          total -= widths[i] ?? 0;
          visible.delete(i);
        }
      }
    }
    setVisibleIndices(visible);
  }, [items.length]);

  // Runs before the browser paints this first render (unlike a plain
  // effect), so the "measure every item" pass below and the corrected
  // visible/hidden split it produces both happen within the same commit
  // -- the full, unfiltered list this renders with initially is never
  // actually visible to the user.
  React.useLayoutEffect(() => {
    widthsRef.current = itemRefs.current.map((el) => el?.offsetWidth ?? 0);
    setMeasured(true);
    recalculate();
    // Deliberately just [items.length], not recalculate/items themselves
    // -- this pass exists to capture each item's real width exactly
    // once; re-running it because recalculate's own identity changed
    // (e.g. from a resize) would remeasure a row that, past the first
    // render, may no longer contain every item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(recalculate);
    observer.observe(container);
    return () => observer.disconnect();
  }, [recalculate]);

  const indexedItems = items.map((item, index) => [item, index] as const);
  const visibleEntries = measured
    ? indexedItems.filter(([, index]) => visibleIndices.has(index))
    : indexedItems;
  const hiddenEntries = measured
    ? indexedItems.filter(([, index]) => !visibleIndices.has(index))
    : [];

  return (
    // flex-1, not just min-w-0 -- real bug, confirmed directly via
    // screenshot ("We still have space before the ... starts") and a
    // follow-up ("if i zoom out or go to a bg screen the tools don't
    // start adding to the tool bar to exit the three dots"): an earlier
    // version left this at its own default flex-shrink-only sizing
    // specifically to avoid competing with fixed-toolbar-buttons.tsx's
    // own trailing "grow" spacer (pushes the pinned highlight/comment/
    // mode groups to the row's far end) -- but without flex-grow, this
    // container only ever reports whatever width its *currently visible*
    // content happens to add up to, not the row's real leftover space.
    // Hiding an item shrinks it; nothing ever makes it grow back to
    // remeasure against the true available width, even when the window
    // gets wider -- it just settles smaller than it needs to be and
    // stays there, both understating how much *should* be able to fit
    // and never re-expanding once something's already hidden. Restored
    // to flex-1 (this component's own actual layout home now claims the
    // row's leftover space directly) -- the trailing spacer in
    // fixed-toolbar-buttons.tsx is conditionally removed there instead,
    // so the two no longer compete for the same growth.
    <div ref={containerRef} className="flex min-w-0 flex-1 items-center overflow-hidden">
      {visibleEntries.map(([item, index]) => (
        <div
          key={index}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          className="flex shrink-0 items-center"
        >
          {item}
        </div>
      ))}
      {hiddenEntries.length > 0 && (
        <div ref={moreRef} className="shrink-0">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <ToolbarButton tooltip="More">
                <MoreHorizontalIcon />
              </ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="flex w-auto min-w-0 flex-wrap gap-0.5 p-1">
              {hiddenEntries.map(([item, index]) => (
                <React.Fragment key={index}>{item}</React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

type TooltipProps<T extends React.ElementType> = {
  tooltip?: React.ReactNode;
  tooltipContentProps?: Omit<
    React.ComponentPropsWithoutRef<typeof TooltipContent>,
    'children'
  >;
  tooltipProps?: Omit<
    React.ComponentPropsWithoutRef<typeof Tooltip>,
    'children'
  >;
  tooltipTriggerProps?: React.ComponentPropsWithoutRef<typeof TooltipTrigger>;
} & React.ComponentProps<T>;

function withTooltip<T extends React.ElementType>(Component: T) {
  return function ExtendComponent({
    tooltip,
    tooltipContentProps,
    tooltipProps,
    tooltipTriggerProps,
    ...props
  }: TooltipProps<T>) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    const component = <Component {...(props as React.ComponentProps<T>)} />;

    if (tooltip && mounted) {
      return (
        <Tooltip {...tooltipProps}>
          <TooltipTrigger asChild {...tooltipTriggerProps}>
            {component}
          </TooltipTrigger>

          <TooltipContent {...tooltipContentProps}>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return component;
  };
}

function TooltipContent({
  children,
  className,
  // CHANGE
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          'z-50 w-fit origin-(--radix-tooltip-content-transform-origin) text-balance rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs',
          className
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      >
        {children}
        {/* CHANGE */}
        {/* <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" /> */}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export function ToolbarMenuGroup({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<typeof DropdownMenuRadioGroup> & { label?: string }) {
  return (
    <>
      <DropdownMenuSeparator
        className={cn(
          'hidden',
          'mb-0 shrink-0 peer-has-[[role=menuitem]]/menu-group:block peer-has-[[role=menuitemradio]]/menu-group:block peer-has-[[role=option]]/menu-group:block'
        )}
      />

      <DropdownMenuRadioGroup
        {...props}
        className={cn(
          'hidden',
          'peer/menu-group group/menu-group my-1.5 has-[[role=menuitem]]:block has-[[role=menuitemradio]]:block has-[[role=option]]:block',
          className
        )}
      >
        {!!label && (
          <DropdownMenuLabel className="select-none font-semibold text-muted-foreground text-xs">
            {label}
          </DropdownMenuLabel>
        )}
        {children}
      </DropdownMenuRadioGroup>
    </>
  );
}
