import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';

// Fixed hex steps (not the `--primary`/`--card` CSS vars) because these
// colors must hold a validated CVD-safe categorical order when several show
// up together on one chart — the live `--primary` dark value is a hue step
// brighter than the chart lightness band allows. Slots 1-2 (green/blue) match
// the app's brand hue; slots 3-8 are the dataviz skill's reference
// categorical order. Re-validated as a full 8-slot set via validate_palette.js.
const CATEGORICAL_LIGHT = [
  '#00994d', // green (brand)
  '#2a78d6', // blue
  '#e87ba4', // magenta
  '#eda100', // yellow
  '#1baf7a', // aqua
  '#eb6834', // orange
  '#4a3aa7', // violet
  '#e34948', // red
];

const CATEGORICAL_DARK = [
  '#00ad57', // green (brand)
  '#3987e5', // blue
  '#d55181', // magenta
  '#c98500', // yellow
  '#199e70', // aqua
  '#d95926', // orange
  '#9085e9', // violet
  '#e66767', // red
];

export function useIsDarkMode(): boolean {
  const theme = useThemeStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return theme === 'system' ? systemDark : theme === 'dark';
}

export function useChartColors(): { green: string; blue: string; categorical: string[] } {
  const isDark = useIsDarkMode();
  const categorical = isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  return { green: categorical[0], blue: categorical[1], categorical };
}
