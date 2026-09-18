import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops the falsy branches of a conditional class list', () => {
    // Typed as boolean so the lint rules do not read this as a constant expression: the point is
    // the falsy branch a conditional class list produces at runtime.
    const off = false as boolean;
    expect(cn('base', off && 'off', undefined, null, ['extra'])).toBe('base extra');
    expect(cn({ on: true, off: false })).toBe('on');
  });

  it('lets a later Tailwind class win over an earlier one in the same group', () => {
    // This is the whole point of going through tailwind-merge: a component's own padding has
    // to be overridable by the className a caller passes in.
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm text-muted-foreground', 'text-destructive')).toBe(
      'text-sm text-destructive',
    );
  });

  it('keeps classes from different groups side by side', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });

  it('is an empty string when there is nothing to join', () => {
    expect(cn()).toBe('');
    expect(cn(false, undefined)).toBe('');
  });
});
