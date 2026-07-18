import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';

// Fixed hex steps (not the `--primary`/`--card` CSS vars) because these two
// colors must hold a validated CVD-safe pair when shown together on the
// network chart — the live `--primary` dark value is a hue step brighter
// than the chart lightness band allows.
const CHART_GREEN = { light: '#00994d', dark: '#00ad57' };
const CHART_BLUE = { light: '#2a78d6', dark: '#3987e5' };

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

export function useChartColors(): { green: string; blue: string } {
  const isDark = useIsDarkMode();
  return {
    green: isDark ? CHART_GREEN.dark : CHART_GREEN.light,
    blue: isDark ? CHART_BLUE.dark : CHART_BLUE.light,
  };
}
