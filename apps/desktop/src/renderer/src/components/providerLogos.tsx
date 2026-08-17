import { getUsageProvider } from '@agentmat/core';
import { siClaude, siCursor, siGooglegemini, siOllama } from 'simple-icons';
import { openaiMark, xaiMark } from '@/components/brandMarks';
import { cn } from '@/lib/utils';

interface BrandLogo {
  path: string;
  color: string;
  invertOnDark?: boolean;
  /** Only when the mark isn't drawn on the simple-icons 24x24 grid. */
  viewBox?: string;
}

// Only providers with a confirmed mark get a brand glyph; the rest
// fall back to a colored monogram driven by the registry's accentColor, so all
// 63 render consistently without risking a missing-icon import.
const BRAND_LOGOS: Record<string, BrandLogo> = {
  'claude-code': { path: siClaude.path, color: `#${siClaude.hex}` },
  cursor: { path: siCursor.path, color: `#${siCursor.hex}`, invertOnDark: true },
  gemini: { path: siGooglegemini.path, color: `#${siGooglegemini.hex}` },
  ollama: { path: siOllama.path, color: `#${siOllama.hex}`, invertOnDark: true },
  codex: { ...openaiMark, invertOnDark: true },
  openai: { ...openaiMark, invertOnDark: true },
  grok: { ...xaiMark, invertOnDark: true },
};

export interface ProviderLogoProps {
  providerId: string;
  className?: string;
}

export function ProviderLogo({ providerId, className }: ProviderLogoProps): React.JSX.Element {
  const brand = BRAND_LOGOS[providerId];
  if (brand) {
    return (
      <svg
        role="img"
        viewBox={brand.viewBox ?? '0 0 24 24'}
        fill={brand.color}
        className={cn('shrink-0', brand.invertOnDark && 'dark:invert', className)}
      >
        <path d={brand.path} />
      </svg>
    );
  }

  const def = getUsageProvider(providerId);
  const color = def?.accentColor ?? '#888888';
  const letter =
    (def?.name ?? '?')
      .replace(/[^A-Za-z0-9]/g, '')
      .charAt(0)
      .toUpperCase() || '?';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold leading-none text-white',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {letter}
    </span>
  );
}
