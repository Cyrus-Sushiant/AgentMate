/**
 * Colors mirror the desktop app's dark theme (see apps/desktop/src/renderer/src/index.css
 * `.dark` block) converted from HSL to hex — same near-black canvas and spring-green accent.
 */
export const colors = {
  background: '#0a0a0a',
  foreground: '#f2f2f2',
  card: '#1c1c1c',
  cardForeground: '#f2f2f2',
  popover: '#1a1a1a',
  primary: '#00e673',
  primaryForeground: '#0a0a0a',
  secondary: '#262626',
  secondaryForeground: '#f2f2f2',
  muted: '#262626',
  mutedForeground: '#9e9e9e',
  accent: '#2e2e2e',
  destructive: '#e15147',
  destructiveForeground: '#ffffff',
  success: '#00d66b',
  successForeground: '#0a0a0a',
  warning: '#f59f0a',
  warningForeground: '#1a1409',
  border: '#2b2b2b',
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
} as const;

export const spacing = (n: number): number => n * 4;
