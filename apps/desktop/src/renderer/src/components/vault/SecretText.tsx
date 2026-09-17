import { cn } from '@/lib/utils';
import { classifySecretChars, type SecretCharKind } from '@/lib/vault/secretChars';

const KIND_CLASS: Record<SecretCharKind, string> = {
  letter: 'text-foreground',
  digit: 'text-primary',
  symbol: 'text-warning',
  space: 'rounded-sm bg-muted',
};

/**
 * A revealed secret in monospace, with digits and symbols colored apart from letters so "0O",
 * "1lI" and friends can be told apart when someone has to type it on another device.
 */
export function SecretText({
  value,
  className,
  testId,
}: {
  value: string;
  className?: string;
  testId?: string;
}): React.JSX.Element {
  return (
    <span
      data-testid={testId}
      className={cn('whitespace-pre-wrap break-all font-mono tracking-wide', className)}
    >
      {classifySecretChars(value).map((run, index) => (
        // Runs never reorder, so the index is a stable key.
        <span key={index} className={KIND_CLASS[run.kind]}>
          {run.text}
        </span>
      ))}
    </span>
  );
}
