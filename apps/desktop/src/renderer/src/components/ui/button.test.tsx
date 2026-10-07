import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from './button';

/** The merged classes, the way the Button component applies them. */
function variants(props: Parameters<typeof buttonVariants>[0]): string {
  return cn(buttonVariants(props));
}

/** The classes a call produces, sorted, so two calls compare as sets. */
function classSet(className: string): string[] {
  return className.split(/\s+/).filter(Boolean).sort();
}

describe('Button', () => {
  it('draws a pill by default', () => {
    render(<Button>Save</Button>);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveClass('rounded-full', 'h-8', 'px-4', 'text-xs', 'bg-primary');
    expect(save).not.toHaveClass('rounded-lg', 'h-9');
  });

  it('keeps the square shape for a caller that opts out', () => {
    render(
      <>
        <Button shape="square">Square</Button>
        <Button shape="square" size="sm">
          Small square
        </Button>
      </>,
    );
    const square = screen.getByRole('button', { name: 'Square' });
    expect(square).toHaveClass('rounded-lg', 'h-9', 'text-sm');
    expect(square).not.toHaveClass('rounded-full');
    const small = screen.getByRole('button', { name: 'Small square' });
    expect(small).toHaveClass('rounded-md', 'h-8', 'px-3.5');
    expect(small).not.toHaveClass('rounded-full', 'rounded-lg');
  });

  it('sizes the pill the way the page kit did', () => {
    expect(classSet(variants({ size: 'sm' }))).toEqual(
      expect.arrayContaining(['h-7', 'px-3', 'rounded-full', 'text-xs']),
    );
    expect(classSet(variants({ size: 'sm' }))).not.toEqual(expect.arrayContaining(['rounded-md']));
    expect(classSet(variants({ size: 'lg' }))).toEqual(expect.arrayContaining(['h-9', 'px-5']));
    expect(classSet(variants({ size: 'icon' }))).toEqual(
      expect.arrayContaining(['h-8', 'w-8', 'rounded-full']),
    );
  });

  it('draws the soft, outline and secondary variants as the same soft pill', () => {
    const soft = classSet(variants({ variant: 'soft' }));
    expect(soft).toEqual(expect.arrayContaining(['search-pill', 'h-8', 'px-3.5', 'text-xs']));
    expect(classSet(variants({ variant: 'outline' }))).toEqual(soft);
    expect(classSet(variants({ variant: 'secondary' }))).toEqual(soft);
  });

  it('gives the small ghost icon button a soft round hover', () => {
    const tile = classSet(variants({ variant: 'ghost', size: 'icon-sm' }));
    expect(tile).toEqual(
      expect.arrayContaining(['h-7', 'w-7', 'hover:bg-foreground/[0.06]', '[&_svg]:size-3.5']),
    );
    expect(tile).not.toContain('hover:bg-accent');
    expect(tile).not.toContain('[&_svg]:size-4');
  });

  it('gives every round ghost icon size the same quiet look', () => {
    for (const size of ['icon', 'icon-xs'] as const) {
      expect(classSet(variants({ variant: 'ghost', size }))).toEqual(
        expect.arrayContaining([
          'rounded-full',
          'text-muted-foreground',
          'hover:bg-foreground/[0.06]',
          'hover:text-foreground',
        ]),
      );
    }
  });

  it('draws the tint variant as a soft primary wash', () => {
    const tint = classSet(variants({ variant: 'tint', size: 'xs' }));
    expect(tint).toEqual(
      expect.arrayContaining(['bg-primary/12', 'text-primary', 'h-6', 'rounded-full']),
    );
    expect(tint).not.toContain('search-pill');
  });

  it('has dense panel sizes', () => {
    const xs = classSet(variants({ variant: 'ghost', size: 'xs' }));
    expect(xs).toEqual(
      expect.arrayContaining(['h-6', 'px-2', 'text-[11px]', '[&_svg]:size-3', 'rounded-full']),
    );
    expect(xs).not.toContain('h-8');
    const iconXs = classSet(variants({ variant: 'ghost', size: 'icon-xs' }));
    expect(iconXs).toEqual(expect.arrayContaining(['h-6', 'w-6', '[&_svg]:size-3']));
    expect(iconXs).not.toContain('h-8');
  });

  it('leaves the link variant at its own size', () => {
    const link = classSet(variants({ variant: 'link' }));
    expect(link).toContain('h-9');
    expect(link).not.toContain('text-xs');
  });

  it('lets a caller class win over the variant', () => {
    render(<Button className="h-6 rounded-none">Tight</Button>);
    const tight = screen.getByRole('button', { name: 'Tight' });
    expect(tight).toHaveClass('h-6', 'rounded-none');
    expect(tight).not.toHaveClass('h-8', 'rounded-full');
  });

  it('renders its child instead of a button with asChild', () => {
    render(
      <Button asChild variant="soft">
        <a href="#docs">Docs</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveClass('search-pill', 'rounded-full');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/**
 * The class strings the page kit used to pass as `className`, kept here so the variants that
 * replaced them are held to the same look.
 */
const KIT = {
  PILL_PRIMARY: 'h-8 rounded-full px-4',
  PILL_SOFT:
    'search-pill h-8 rounded-full px-3.5 text-xs font-medium text-foreground/85 hover:text-foreground',
  PILL_SOFT_ICON: 'search-pill h-8 w-8 rounded-full text-foreground/85 hover:text-foreground',
  CARD_PILL: 'h-7 rounded-full px-3',
  CARD_PILL_SOFT:
    'search-pill h-7 rounded-full px-3 text-xs font-medium text-foreground/85 hover:text-foreground',
  PILL_DESTRUCTIVE:
    'h-8 rounded-full bg-destructive/10 px-3.5 text-xs font-medium text-destructive hover:bg-destructive/15 hover:text-destructive',
  TILE_ACTION:
    'h-7 w-7 rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground [&_svg]:size-3.5',
};

/** How the kit constants were used, on the old square Button. */
function kit(
  className: string,
  variant: 'default' | 'ghost',
  size: 'default' | 'sm' | 'icon',
): string[] {
  return classSet(cn(variants({ variant, size, shape: 'square' }), className));
}

describe('Button variants reproduce the page kit', () => {
  it('matches PILL_PRIMARY on a small Button', () => {
    expect(classSet(variants({}))).toEqual(kit(KIT.PILL_PRIMARY, 'default', 'sm'));
  });

  it('matches CARD_PILL', () => {
    expect(classSet(variants({ size: 'sm' }))).toEqual(kit(KIT.CARD_PILL, 'default', 'sm'));
  });

  // The soft pill no longer carries the ghost hover wash, which the unlayered search pill rule
  // already beat, so the comparison drops it.
  const withoutGhostHover = (list: string[]): string[] =>
    list.filter((c) => c !== 'hover:bg-accent' && c !== 'hover:text-accent-foreground');

  it('matches PILL_SOFT', () => {
    expect(classSet(variants({ variant: 'soft' }))).toEqual(
      withoutGhostHover(kit(KIT.PILL_SOFT, 'ghost', 'default')),
    );
  });

  it('matches CARD_PILL_SOFT', () => {
    expect(classSet(variants({ variant: 'soft', size: 'sm' }))).toEqual(
      withoutGhostHover(kit(KIT.CARD_PILL_SOFT, 'ghost', 'sm')),
    );
  });

  it('matches PILL_SOFT_ICON', () => {
    expect(classSet(variants({ variant: 'soft', size: 'icon' }))).toEqual(
      withoutGhostHover(kit(cn(KIT.PILL_SOFT_ICON, 'font-medium'), 'ghost', 'icon')),
    );
  });

  it('matches PILL_DESTRUCTIVE', () => {
    expect(classSet(variants({ variant: 'danger' }))).toEqual(
      withoutGhostHover(kit(KIT.PILL_DESTRUCTIVE, 'ghost', 'default')),
    );
  });

  it('matches TILE_ACTION', () => {
    expect(classSet(variants({ variant: 'ghost', size: 'icon-sm' }))).toEqual(
      kit(KIT.TILE_ACTION, 'ghost', 'icon'),
    );
  });
});
