// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusLetter, statusTextClass, statusTone } from './StatusLetter';

/** A change status drawn as a tinted letter chip, named for screen readers. */

afterEach(cleanup);

describe('statusTone', () => {
  it('tints each status the way the Project detail Git tab does', () => {
    expect(statusTone('A')).toBe('success');
    expect(statusTone('?')).toBe('success');
    expect(statusTone('M')).toBe('warning');
    expect(statusTone('T')).toBe('warning');
    expect(statusTone('D')).toBe('destructive');
    expect(statusTone('U')).toBe('destructive');
    expect(statusTone('R')).toBe('primary');
    expect(statusTone('C')).toBe('primary');
  });

  it('only ever uses theme colours for the file name', () => {
    for (const status of ['A', '?', 'M', 'T', 'D', 'U', 'R', 'C'] as const) {
      expect(statusTextClass(status)).toMatch(/^text-(success|warning|destructive|primary)$/);
    }
  });
});

describe('StatusLetter', () => {
  it('shows the letter and names the status', () => {
    render(<StatusLetter status="M" />);
    const letter = screen.getByRole('img', { name: 'Modified' });
    expect(letter).toHaveTextContent('M');
    expect(letter.className).toContain('text-warning');
  });

  it('marks a conflict with an exclamation mark in red', () => {
    render(<StatusLetter status="U" />);
    const letter = screen.getByRole('img', { name: 'Conflict' });
    expect(letter).toHaveTextContent('!');
    expect(letter.className).toContain('text-destructive');
  });
});
