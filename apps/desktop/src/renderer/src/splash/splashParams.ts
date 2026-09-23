export interface SplashView {
  theme: 'dark' | 'light';
  glass: 'native' | 'css';
  /** Bottom-right line: the company, the year and the build. */
  credit: string;
}

/**
 * Reads what src/main/splashWindow.ts put on the splash URL. Anything missing
 * or unexpected falls back to the dark, CSS-drawn variant, which reads fine on
 * any desktop.
 */
export function readSplashParams(search: string, year: number): SplashView {
  const params = new URLSearchParams(search);
  const version = params.get('version');
  const build = !version ? '' : version === 'dev' ? 'Dev build' : `v${version}`;
  return {
    theme: params.get('theme') === 'light' ? 'light' : 'dark',
    glass: params.get('glass') === 'native' ? 'native' : 'css',
    credit: [`© ${year} SmartClouds`, build].filter(Boolean).join(' · '),
  };
}
