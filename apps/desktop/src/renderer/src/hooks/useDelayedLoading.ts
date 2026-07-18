import { useEffect, useRef, useState } from 'react';

/**
 * Debounces a loading flag so brief fetches never flash the UI: `true` is
 * only surfaced after it holds for `showDelay` ms, and once shown it stays
 * up for at least `minVisible` ms so it doesn't blink off immediately.
 */
export function useDelayedLoading(isLoading: boolean, showDelay = 400, minVisible = 400): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      const showTimer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, showDelay);
      return () => clearTimeout(showTimer);
    }

    if (!visible) return undefined;

    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : minVisible;
    const remaining = Math.max(0, minVisible - elapsed);
    const hideTimer = setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(hideTimer);
  }, [isLoading, showDelay, minVisible, visible]);

  return visible;
}
