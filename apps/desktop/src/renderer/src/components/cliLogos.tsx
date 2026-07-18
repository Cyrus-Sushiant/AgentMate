import { siClaudecode, siCursor, siGooglegemini, siOpencode, siQwen } from 'simple-icons';
import { cn } from '@/lib/utils';

interface BrandLogo {
  path: string;
  color: string;
  /** Flip pure black/white marks so they stay visible in dark mode. */
  invertOnDark?: boolean;
}

const BRAND_LOGOS: Record<string, BrandLogo> = {
  'claude-code': { path: siClaudecode.path, color: `#${siClaudecode.hex}` },
  'gemini-cli': { path: siGooglegemini.path, color: `#${siGooglegemini.hex}` },
  'qwen-cli': { path: siQwen.path, color: `#${siQwen.hex}` },
  opencode: { path: siOpencode.path, color: `#${siOpencode.hex}`, invertOnDark: true },
  'cursor-cli': { path: siCursor.path, color: `#${siCursor.hex}`, invertOnDark: true },
};

interface MonogramLogo {
  letter: string;
  color: string;
}

// CLIs without a suitable mark in simple-icons fall back to a colored monogram.
const MONOGRAM_LOGOS: Record<string, MonogramLogo> = {
  'codex-cli': { letter: 'C', color: '#412991' },
  aider: { letter: 'A', color: '#4A9C8E' },
  goose: { letter: 'G', color: '#D97B29' },
  'continue-cli': { letter: 'C', color: '#4477FF' },
  'grok-cli': { letter: 'G', color: '#000000' },
  'freebuff-cli': { letter: 'F', color: '#16A34A' },
};

export interface CliLogoProps {
  cliId: string;
  className?: string;
}

export function CliLogo({ cliId, className }: CliLogoProps): React.JSX.Element {
  const brand = BRAND_LOGOS[cliId];
  if (brand) {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        fill={brand.color}
        className={cn('shrink-0', brand.invertOnDark && 'dark:invert', className)}
      >
        <path d={brand.path} />
      </svg>
    );
  }

  const monogram = MONOGRAM_LOGOS[cliId] ?? { letter: '?', color: '#888888' };
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold leading-none text-white',
        className,
      )}
      style={{ backgroundColor: monogram.color }}
    >
      {monogram.letter}
    </span>
  );
}
