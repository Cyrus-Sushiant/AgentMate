import { describe, expect, it } from 'vitest';
import { describeTerminalStartError } from './startError';

/**
 * The pane used to swallow the backend's reason and print the same line for every failure,
 * which is why "Could not start this terminal." reports could never be diagnosed.
 */
describe('describeTerminalStartError', () => {
  it('keeps the familiar line when there is no reason to show', () => {
    expect(describeTerminalStartError(new Error(''))).toBe('Could not start this terminal.');
    expect(describeTerminalStartError(undefined)).toBe('Could not start this terminal.');
    expect(describeTerminalStartError('plain string')).toBe('Could not start this terminal.');
  });

  it('shows the backend reason after the familiar line', () => {
    expect(describeTerminalStartError(new Error('zsh could not be started: ENOENT'))).toBe(
      'Could not start this terminal. zsh could not be started: ENOENT',
    );
  });
});
