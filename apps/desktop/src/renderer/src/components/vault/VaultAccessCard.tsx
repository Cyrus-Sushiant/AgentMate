import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { type ReactNode, useEffect } from 'react';
import type { IconProps } from '@/components/icons';

/**
 * The frame for the setup and lock screens: one card in the middle of the page with the lock
 * emblem on top. The two rings echo a keyhole plate, and the card nudges sideways when a
 * password is refused.
 */
export function VaultAccessCard({
  icon: Icon,
  title,
  description,
  shakeKey = 0,
  children,
}: {
  icon: React.ForwardRefExoticComponent<IconProps>;
  title: string;
  description?: ReactNode;
  /** Bump to play the shake once, e.g. after a wrong password. */
  shakeKey?: number;
  children: ReactNode;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();

  useEffect(() => {
    if (!shakeKey || reduceMotion) return;
    void controls.start({ x: [0, -8, 7, -5, 3, 0], transition: { duration: 0.36 } });
  }, [shakeKey, reduceMotion, controls]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <motion.div
        animate={controls}
        className="glass w-full max-w-md rounded-2xl border border-border/70 p-8 shadow-xl shadow-black/10"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-primary/25" />
            <span className="absolute inset-2 rounded-full border border-primary/40 bg-primary/10" />
            <Icon className="relative h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </motion.div>
    </div>
  );
}
