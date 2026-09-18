import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * The boundary exists for one reason: without it React unmounts the whole root on a render
 * error and the Electron window is left completely blank. These tests check the user still
 * gets something readable, and that the recovery paths clear the error.
 *
 * Rendered without the shared providers on purpose: the boundary uses none of them, and a
 * plain render keeps the root element stable so `rerender` exercises componentDidUpdate
 * rather than quietly remounting a fresh boundary.
 */

function Boom({ message }: { message: string }): React.JSX.Element {
  throw new Error(message);
}

function Fine({ label }: { label: string }): React.JSX.Element {
  return <p>{label}</p>;
}

// React logs every caught error to the console, which is only noise here since the throw is the point.
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('ErrorBoundary', () => {
  it('passes children straight through while nothing throws', () => {
    render(
      <ErrorBoundary>
        <Fine label="All good" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('shows the fallback with the error message instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Boom message="cannot read property of undefined" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something broke')).toBeTruthy();
    expect(screen.getByText('cannot read property of undefined')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload window' })).toBeTruthy();
  });

  it('names the page in the heading when it was given one', () => {
    render(
      <ErrorBoundary title="Token Usage">
        <Boom message="boom" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Token Usage could not be shown')).toBeTruthy();
  });

  it('copies the error details so the user can paste them into a report', async () => {
    render(
      <ErrorBoundary>
        <Boom message="stack me" />
      </ErrorBoundary>,
    );

    // fireEvent rather than userEvent: setting userEvent up swaps navigator.clipboard for its
    // own stub, and this asserts on the spy the renderer setup installed.
    fireEvent.click(screen.getByRole('button', { name: /Copy details/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());

    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0]?.[0] ?? '';
    expect(copied).toContain('stack me');
  });

  it('clears the error when the reset key changes, so navigating away brings the page back', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/usage">
        <Boom message="boom" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something broke')).toBeTruthy();

    rerender(
      <ErrorBoundary resetKey="/projects">
        <Fine label="Projects page" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Projects page')).toBeTruthy();
    expect(screen.queryByText('Something broke')).toBeNull();
  });
});
