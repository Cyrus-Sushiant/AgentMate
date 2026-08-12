import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion';

/**
 * React Bits Count Up, kept to a number that already lives on the card: the
 * headline tokens/cost figure ticks into place instead of popping on.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}): React.JSX.Element {
  const reduce = useReducedMotion();
  const motionVal = useMotionValue(0);
  const formatRef = useRef(format);
  formatRef.current = format;
  const [text, setText] = useState(() => format(reduce ? value : 0));

  useMotionValueEvent(motionVal, 'change', (latest) => {
    setText(formatRef.current(latest));
  });

  useEffect(() => {
    if (reduce) {
      motionVal.set(value);
      setText(formatRef.current(value));
      return;
    }
    const controls = animate(motionVal, value, { duration: 0.55, ease: 'easeOut' });
    return () => controls.stop();
  }, [motionVal, reduce, value]);

  return <span className={className}>{text}</span>;
}
