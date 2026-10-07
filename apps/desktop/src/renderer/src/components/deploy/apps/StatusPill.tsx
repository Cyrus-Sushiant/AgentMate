import { Chip, type ChipTone } from '@/components/pageKit';
import type { Tone } from '@/lib/deploy/apps/format';

/** A small status word with a dot, coloured by what it means, so it is never colour alone. */

const CHIP_TONE: Record<Tone, ChipTone> = {
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  muted: 'neutral',
  busy: 'primary',
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <Chip tone={CHIP_TONE[tone]} dot pulse={tone === 'busy'} className={className}>
      {children}
    </Chip>
  );
}
