import { useState } from 'react';
import { Folder } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface ProjectIconProps {
  /** The project's stored icon as a data URL; null falls back to the folder glyph. */
  iconDataUrl: string | null;
  /** Tailwind sizing for the tile, e.g. "h-9 w-9". */
  className?: string;
  /** Sizing for the fallback glyph, which wants to be smaller than the tile. */
  glyphClassName?: string;
}

/**
 * One project's avatar: its own icon when it has one, the generic folder tile
 * when it doesn't. A stored icon that no longer decodes (a truncated download,
 * say) falls back too rather than leaving a broken image in the card.
 */
export function ProjectIcon({
  iconDataUrl,
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
    >
      {showImage ? (
        <img
          src={iconDataUrl}
          alt=""
          className="h-full w-full object-contain p-1"
          onError={() => setFailedIcon(iconDataUrl)}
        />
      ) : (
        <Folder className={cn('h-4 w-4', glyphClassName)} />
      )}
    </div>
  );
}
