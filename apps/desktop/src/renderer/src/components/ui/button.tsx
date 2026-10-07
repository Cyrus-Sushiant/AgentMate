import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

// A secondary action drawn as the search pill, so only the primary action has weight. The surface
// comes from the unlayered `.search-pill` rule, which also means a caller's `bg-*` can't override it.
const SOFT = 'search-pill font-medium text-foreground/85 hover:text-foreground';

// Every variant except `link`, which sits inline with text and keeps its own sizing.
const BOXED: (
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'soft'
  | 'danger'
  | 'tint'
)[] = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'soft', 'danger', 'tint'];

/**
 * The one way the app draws a button. It's a pill by default, matching the Settings page;
 * `shape="square"` is the opt-out for the rare spot where a round end would break a layout.
 */
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary font-semibold text-primary-foreground shadow-[0_0_18px_-6px_hsl(var(--primary)/0.7)] hover:brightness-110',
        // The old bordered looks picked up the global border colour and read off-theme, so both
        // now draw the soft pill. They stay as names so existing callers keep working.
        secondary: SOFT,
        outline: SOFT,
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline',
        soft: SOFT,
        // A destructive action that doesn't shout: a soft red tint instead of a solid fill.
        danger:
          'bg-destructive/10 font-medium text-destructive hover:bg-destructive/15 hover:text-destructive',
        // A primary action that shouldn't outweigh the page, like a dense card's "Fix with AI" or
        // a toggle that's on: a soft primary tint instead of the solid fill.
        tint: 'bg-primary/12 font-semibold text-primary hover:bg-primary/20 hover:text-primary',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 rounded-md px-3.5 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
        // A small round icon action in a card header or row.
        'icon-sm': 'h-7 w-7 text-muted-foreground hover:text-foreground [&_svg]:size-3.5',
        // The dense panel sizes, for side panels where rows are only 6 tall.
        xs: 'h-6 gap-1 px-2 text-[11px] [&_svg]:size-3',
        'icon-xs': 'h-6 w-6 text-muted-foreground hover:text-foreground [&_svg]:size-3',
      },
      shape: {
        pill: 'rounded-full',
        square: '',
      },
    },
    compoundVariants: [
      // Pill sizes follow the page kit: an 8 tall pill with small text, a 7 tall one in cards.
      { shape: 'pill', variant: BOXED, size: 'default', class: 'h-8 px-4 text-xs' },
      { shape: 'pill', variant: BOXED, size: 'sm', class: 'h-7 px-3' },
      { shape: 'pill', variant: BOXED, size: 'lg', class: 'h-9 px-5' },
      { shape: 'pill', variant: BOXED, size: 'icon', class: 'h-8 w-8' },
      // The soft and red pills are a touch narrower, so a row of them doesn't sprawl.
      {
        shape: 'pill',
        variant: ['soft', 'outline', 'secondary', 'danger'],
        size: 'default',
        class: 'px-3.5',
      },
      // A round ghost icon reads as quiet chrome: muted until hovered, with a faint round wash.
      {
        shape: 'pill',
        variant: 'ghost',
        size: ['icon', 'icon-sm', 'icon-xs'],
        class: 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'pill',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, shape, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
