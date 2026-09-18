import { type ComponentType, createElement, forwardRef, type ReactNode } from 'react';

/**
 * Framer Motion without the animations. Exit animations keep an element in the tree for a while
 * after it unmounts, which makes "is it gone yet" assertions time-dependent, and the animation
 * loop leaves timers running past the end of a test.
 */

const MOTION_PROPS = new Set([
  'initial',
  'animate',
  'exit',
  'transition',
  'variants',
  'whileHover',
  'whileTap',
  'whileFocus',
  'whileDrag',
  'whileInView',
  'viewport',
  'layout',
  'layoutId',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'onDragEnd',
  'onDragStart',
  'onAnimationComplete',
  'onAnimationStart',
  'style',
]);

function clean(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'style') {
      // Motion values in style would render as objects, so keep only plain entries.
      const style = value as Record<string, unknown> | undefined;
      if (style) {
        result.style = Object.fromEntries(
          Object.entries(style).filter(
            ([, one]) => typeof one === 'string' || typeof one === 'number',
          ),
        );
      }
      continue;
    }
    if (!MOTION_PROPS.has(key)) result[key] = value;
  }
  return result;
}

type MotionComponent = ComponentType<Record<string, unknown>>;

/** `motion.div`, `motion.button` and so on, each rendering the plain tag. */
export const motion: Record<string, MotionComponent> = new Proxy(
  {} as Record<string, MotionComponent>,
  {
    get(cache: Record<string, MotionComponent>, tag: string) {
      if (!cache[tag]) {
        cache[tag] = forwardRef<unknown, Record<string, unknown>>((props, ref) =>
          createElement(tag, { ...clean(props), ref }),
        ) as unknown as MotionComponent;
      }
      return cache[tag];
    },
  },
);

export function AnimatePresence({ children }: { children?: ReactNode }): ReactNode {
  return children ?? null;
}

export function LayoutGroup({ children }: { children?: ReactNode }): ReactNode {
  return children ?? null;
}

export function MotionConfig({ children }: { children?: ReactNode }): ReactNode {
  return children ?? null;
}

export const useReducedMotion = (): boolean => true;
export const useAnimation = () => ({ start: async () => undefined, stop: () => undefined });
export const useAnimationControls = useAnimation;
export const useInView = (): boolean => true;
export const useScroll = () => ({ scrollY: { get: () => 0, on: () => () => undefined } });
export function useMotionValue<Value>(initial: Value) {
  let current = initial;
  return {
    get: () => current,
    set: (next: Value) => {
      current = next;
    },
    on: () => () => undefined,
  };
}
export const useTransform = () => useMotionValue(0);
export const useSpring = () => useMotionValue(0);
export const animate = () => ({ stop: () => undefined, then: async () => undefined });
export const AnimateSharedLayout = LayoutGroup;
export const domAnimation = {};
export const LazyMotion = MotionConfig;
export const m = motion;
