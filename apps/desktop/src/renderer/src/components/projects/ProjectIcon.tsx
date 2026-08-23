import { useState } from 'react';
import { Folder } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface ProjectIconProps {
  /** The project's stored icon as a data URL; null falls back to the folder glyph. */
  iconDataUrl: string | null;
  /** `#rrggbb` tile colour the project picked; null keeps the theme's tint. */
  bgColor?: string | null;
  /** `#rrggbb` glyph colour the project picked; only reaches the fallback glyph. */
  iconColor?: string | null;
  /** Tailwind sizing for the tile, e.g. "h-9 w-9". */
  className?: string;
  /** Sizing for the fallback glyph, which wants to be smaller than the tile. */
  glyphClassName?: string;
}

/**
 * One project's avatar: its own icon when it has one, the generic folder tile
 * when it doesn't. A stored icon that no longer decodes (a truncated download,
 * say) falls back too rather than leaving a broken image in the card.
 *
 * The colours ride as inline styles so they win over whatever background or text
 * colour a caller's className sets, which is the point of picking one. The glyph
 * inherits the tile's colour, so `iconColor` only shows on the fallback.
 */
export function ProjectIcon({
  iconDataUrl,
  bgColor,
  iconColor,
  className,
  glyphClassName,
}: ProjectIconProps): React.JSX.Element {
  // Keyed on the icon itself rather than a bare boolean, so swapping in a new
  // icon retries instead of inheriting the old one's failure.
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const showImage = iconDataUrl !== null && iconDataUrl !== failedIcon;

  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary',
        className,
      )}
      style={{ backgroundColor: bgColor ?? undefined, color: iconColor ?? undefined }}
    >
      {showImage ? (
        // Inset rather than edge to edge: a photo filling the whole tile reads
        // much heavier next to the title than the folder glyph it replaces.
        <img
          src={iconDataUrl}
          alt=""
          className="h-3/5 w-3/5 object-contain"
          onError={() => setFailedIcon(iconDataUrl)}
        />
      ) : (
        <Folder className={cn('h-4 w-4', glyphClassName)} />
      )}
    </div>
  );
}
