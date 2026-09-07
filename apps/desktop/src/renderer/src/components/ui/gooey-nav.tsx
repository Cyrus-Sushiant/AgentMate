import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

// Rare UI's Gooey Nav (rareui.com/components/gooeynav), adapted for this app: the Next.js router
// bits are gone (these are in-page views, not routes) and the hard-coded palette now reads the
// theme tokens, so the bar follows light/dark like everything else. The gooey part is the seam
// between two tiles: as the selection moves, the gap opens and an SVG "neck" pinches shut behind
// it, so the tiles look like they are made of liquid.

const SPRING = { type: 'spring', stiffness: 200, damping: 28, mass: 1 } as const;

/** The neck has thinned to nothing by the time the gap is this far open. */
const NECK_BREAK = 0.22;

/** Nominal viewBox height; the svg stretches to whatever the tile actually is. */
const NECK_H = 100;

const FADE_IN = 'transition-colors duration-[400ms]';
const FADE_OUT = 'transition-colors duration-0';

const SIZES = {
  xs: {
    label: 'gap-1 px-2 py-1.5 text-[11px] leading-4 [&_svg]:size-[11px]',
    radius: 8,
    separation: 14,
  },
  sm: {
    label: 'gap-1.5 px-3.5 py-2 text-xs leading-4 [&_svg]:size-3',
    radius: 10,
    separation: 16,
  },
  md: {
    label: 'gap-2 px-5 py-2.5 text-sm leading-5 [&_svg]:size-3.5',
    radius: 12,
    separation: 20,
  },
  lg: {
    label: 'gap-2.5 px-6 py-3 text-base leading-6 [&_svg]:size-4',
    radius: 14,
    separation: 24,
  },
} as const;

export type GooeyNavSize = keyof typeof SIZES;

interface NavItem {
  label: string;
  icon?: ReactNode;
  /** Sits after the label, for a count or a status dot. */
  badge?: ReactNode;
}

export type GooeyNavItem = string | NavItem;

const toItem = (item: GooeyNavItem): NavItem => (typeof item === 'string' ? { label: item } : item);

/**
 * A count chip for a nav tile's `badge`. It tints itself from the label color, so it stays
 * readable on the selected tile and on the bar alike.
 */
export function GooeyNavCount({ value }: { value: number }): React.JSX.Element | undefined {
  if (value <= 0) return undefined;
  return (
    <span
      className="min-w-4 rounded-full px-1.5 text-center text-[10px] font-medium tabular-nums"
      style={{ backgroundColor: 'color-mix(in srgb, currentColor 18%, transparent)' }}
    >
      {value}
    </span>
  );
}

export type GooeyNavProps = Omit<ComponentProps<'nav'>, 'onChange'> & {
  items: GooeyNavItem[];
  /** Controlled index. Leave unset to let the nav track its own selection. */
  value?: number;
  defaultValue?: number;
  onChange?: (index: number) => void;
  size?: GooeyNavSize;
  /** Any CSS color, including a `hsl(var(--token))` from the theme. */
  activeColor?: string;
  activeLabelColor?: string;
  /** The unselected tiles' fill, which is also what the seam is drawn in. */
  barColor?: string;
  separation?: number;
  radius?: number;
};

/** Two concave curves pinching toward the middle, drawn in the gap the tiles leave. */
function neckPath(gap: number, span: number): string {
  // A NaN or negative span would otherwise emit a path full of NaN coordinates.
  if (!Number.isFinite(gap) || !Number.isFinite(span) || gap <= 0 || span <= 0) return '';
  const waist = NECK_H * (1 - gap / (span * NECK_BREAK));
  if (waist <= 0) return '';
  const start = span - gap;
  const mid = start + gap / 2;
  return `M${start} 0 Q${mid} ${NECK_H - waist} ${span} 0 L${span} ${NECK_H} Q${mid} ${waist} ${start} ${NECK_H} Z`;
}

function Segment({
  gap,
  span,
  hasSeam,
  leftFill,
  rightFill,
  reduced,
  radii,
  className,
  style,
  children,
}: {
  gap: number;
  span: number;
  hasSeam: boolean;
  leftFill: string;
  rightFill: string;
  reduced: boolean;
  radii: Record<string, number>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}): React.JSX.Element {
  const marginLeft = useSpring(gap, SPRING);
  const gradientId = `gooey-neck-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (reduced) marginLeft.jump(gap);
    else marginLeft.set(gap);
  }, [gap, marginLeft, reduced]);

  const d = useTransform(marginLeft, (g) => neckPath(g, span));

  return (
    <motion.li
      data-slot="gooey-nav-segment"
      className={cn('relative', className)}
      style={{ ...style, marginLeft }}
      initial={false}
      animate={radii}
      transition={reduced ? { duration: 0 } : SPRING}
    >
      {hasSeam && (
        <svg
          aria-hidden="true"
          width={span}
          viewBox={`0 0 ${span} ${NECK_H}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute top-0 right-full h-full"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1">
              {/* Inline styles, not stop-color attributes: only a style resolves a CSS var. */}
              <stop offset="0" style={{ stopColor: leftFill }} />
              <stop offset="1" style={{ stopColor: rightFill }} />
            </linearGradient>
          </defs>
          <motion.path d={d} fill={`url(#${gradientId})`} />
        </svg>
      )}
      {children}
    </motion.li>
  );
}

/**
 * A segmented nav whose tiles melt into each other as the selection moves. Drop-in replacement
 * for a row of tabs: pass the labels, read the index back from `onChange`.
 */
export function GooeyNav({
  items,
  value,
  defaultValue = 0,
  onChange,
  size = 'md',
  activeColor = 'hsl(var(--primary))',
  activeLabelColor = 'hsl(var(--primary-foreground))',
  barColor = 'hsl(var(--muted))',
  separation,
  radius,
  className,
  ...props
}: GooeyNavProps): React.JSX.Element {
  const reduced = useReducedMotion() ?? false;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);

  const active = value ?? uncontrolled;
  const span = separation ?? SIZES[size].separation;
  const corner = radius ?? SIZES[size].radius;

  // A seam is open when it sits at either end of the bar or against the selected tile.
  const open = (seam: number): boolean =>
    seam === 0 || seam === items.length || seam - 1 === active || seam === active;

  const fill = (i: number): string => (i === active ? activeColor : barColor);

  return (
    <nav data-slot="gooey-nav" className={cn('inline-block', className)} {...props}>
      <ul className="flex items-center">
        {items.map((item, i) => {
          const navItem = toItem(item);
          const isActive = i === active;

          return (
            <Segment
              key={`${i}-${navItem.label}`}
              // Closed seams pull in a pixel so no hairline shows through.
              gap={i === 0 ? 0 : open(i) ? span : -1}
              span={span}
              hasSeam={i > 0}
              leftFill={fill(i - 1)}
              rightFill={fill(i)}
              reduced={reduced}
              radii={{
                borderTopLeftRadius: open(i) ? corner : 0,
                borderBottomLeftRadius: open(i) ? corner : 0,
                borderTopRightRadius: open(i + 1) ? corner : 0,
                borderBottomRightRadius: open(i + 1) ? corner : 0,
              }}
              className={isActive ? FADE_IN : FADE_OUT}
              style={{ backgroundColor: isActive ? activeColor : barColor }}
            >
              <button
                type="button"
                data-slot="gooey-nav-item"
                data-active={isActive}
                aria-current={isActive ? true : undefined}
                className={cn(
                  'flex cursor-pointer items-center whitespace-nowrap font-medium [&_svg]:shrink-0',
                  isActive ? FADE_IN : FADE_OUT,
                  SIZES[size].label,
                  !isActive && 'text-muted-foreground hover:text-foreground',
                )}
                style={isActive ? { color: activeLabelColor } : undefined}
                onClick={() => {
                  if (value === undefined) setUncontrolled(i);
                  onChange?.(i);
                }}
              >
                {navItem.icon}
                {navItem.label}
                {navItem.badge}
              </button>
            </Segment>
          );
        })}
      </ul>
    </nav>
  );
}
