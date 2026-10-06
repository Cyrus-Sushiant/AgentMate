import logo2x from '@/assets/smartclouds-logo@2x.webp';
import logo1x from '@/assets/smartclouds-logo.webp';
import { cn } from '@/lib/utils';

/*
 * The logo files come from the SmartClouds website: 60x32 at 1x and 120x64 at 2x. "lg" is the
 * 1x size itself, so it is pixel-exact on standard and HiDPI screens alike. "sm" is what fits
 * the sidebar, where the width is the limit: the mark has to leave room for the name and the
 * version chip in the card, and fit inside the 34px square on the icon rail.
 */
const SIZES = {
  sm: { width: 28, height: 15 },
  lg: { width: 60, height: 32 },
} as const;

/**
 * The SmartClouds cloud logo. It is white and grey, so callers put it on a `.brand-tile` (see
 * index.css), the dark rounded square from the company's own favicon, to keep it visible on
 * the light theme.
 */
export function SmartCloudsLogo({
  size,
  alt = '',
  className,
}: {
  size: keyof typeof SIZES;
  /** Empty when the logo sits next to text that already names the company. */
  alt?: string;
  className?: string;
}): React.JSX.Element {
  const { width, height } = SIZES[size];
  return (
    <img
      src={logo1x}
      srcSet={`${logo1x} 1x, ${logo2x} 2x`}
      width={width}
      height={height}
      alt={alt}
      decoding="async"
      draggable={false}
      className={cn('select-none', className)}
    />
  );
}
