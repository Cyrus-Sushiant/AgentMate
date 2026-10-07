import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StateChip } from './StateChip';

/** A container's state is always said in words, with a mark of its own beside the colour. */

describe('StateChip', () => {
  it.each([
    [{ state: 'running', health: 'healthy' }, 'Running', 'circle-check'],
    [{ state: 'running', health: 'none' }, 'Running', 'circle-check'],
    [{ state: 'running', health: 'unhealthy' }, 'Running, unhealthy', 'triangle-exclamation'],
    [{ state: 'running', health: 'starting' }, 'Running, starting', 'circle-check'],
    [{ state: 'restarting', health: 'none' }, 'Restarting', 'spinner'],
    [{ state: 'paused', health: 'none' }, 'Paused', 'pause'],
    [{ state: 'dead', health: 'none' }, 'Dead', 'circle-xmark'],
    [{ state: 'exited', health: 'unhealthy' }, 'Exited', 'stop'],
  ] as const)('says %o as %s', (container, label, icon) => {
    const { container: root } = render(<StateChip container={container} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(root.querySelector('svg')?.getAttribute('data-icon')).toBe(icon);
  });

  it('is a tinted chip that keeps the state on the element', () => {
    const { container: root } = render(
      <StateChip container={{ state: 'running', health: 'unhealthy' }} />,
    );
    const chip = root.querySelector('[data-state="running"]');
    expect(chip).toHaveClass('rounded-full', 'text-destructive');
  });
});
