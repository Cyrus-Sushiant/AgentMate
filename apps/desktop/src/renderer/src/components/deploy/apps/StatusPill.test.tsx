import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill';

/** The status pill is the page kit's chip: a word and a dot, the dot pulsing while busy. */

describe('StatusPill', () => {
  it.each([
    ['success', 'text-success'],
    ['warning', 'text-warning'],
    ['danger', 'text-destructive'],
    ['muted', 'text-muted-foreground'],
    ['busy', 'text-primary'],
  ] as const)('tints a %s status from the theme', (tone, colour) => {
    render(<StatusPill tone={tone}>Status</StatusPill>);
    expect(screen.getByText('Status')).toHaveClass(colour, 'rounded-full');
  });

  it('pulses the dot only while something is under way', () => {
    const { container, rerender } = render(<StatusPill tone="busy">Deploying</StatusPill>);
    expect(container.querySelector('.motion-safe\\:animate-ping')).not.toBeNull();
    rerender(<StatusPill tone="success">Running</StatusPill>);
    expect(container.querySelector('.motion-safe\\:animate-ping')).toBeNull();
  });
});
