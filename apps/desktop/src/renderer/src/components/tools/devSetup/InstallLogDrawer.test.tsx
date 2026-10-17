import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { InstallLogDrawer } from './InstallLogDrawer';

/**
 * The log is where a failed install explains itself, so it has to be readable by keyboard and
 * screen reader, switchable between items, and easy to copy into a bug report.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const NAMES: Record<string, string> = { gh: 'GitHub CLI', git: 'Git', node: 'Node.js' };
const nameOf = (id: string) => NAMES[id] ?? id;

function renderDrawer(
  props: Partial<React.ComponentProps<typeof InstallLogDrawer>> = {},
) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const view = renderWithProviders(
    <InstallLogDrawer
      logs={{ gh: ['Found GitHub CLI', 'Downloading', 'Installing'] }}
      nameOf={nameOf}
      selected="gh"
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...view, onSelect, onClose };
}

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
});

describe('InstallLogDrawer', () => {
  it('is a region of its own, with a log inside it named for the item', () => {
    renderDrawer();

    const region = screen.getByRole('region', { name: 'Install log' });
    expect(within(region).getByRole('log', { name: 'Log for GitHub CLI' })).toBeTruthy();
  });

  it('shows the lines in order, one to a line', () => {
    renderDrawer();

    expect(screen.getByRole('log').textContent).toBe('Found GitHub CLI\nDownloading\nInstalling');
  });

  it('can be scrolled with the keyboard', () => {
    renderDrawer();

    expect(screen.getByRole('log')).toHaveAttribute('tabindex', '0');
  });

  it('does not read every line aloud as it arrives', () => {
    renderDrawer();

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'off');
  });

  it('says so when nothing has been logged yet', () => {
    renderDrawer({ logs: {} });

    expect(screen.getByText('Nothing has been logged yet.')).toBeTruthy();
    expect(screen.queryByRole('log')).toBeNull();
  });

  it('offers a switch between items when more than one has a log', async () => {
    const { user, onSelect } = renderDrawer({
      logs: { gh: ['a'], git: ['b'], node: [] },
    });

    expect(screen.getByRole('button', { name: 'GitHub CLI' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Git' })).toHaveAttribute('aria-pressed', 'false');
    // Node.js has no lines, so there is nothing to switch to.
    expect(screen.queryByRole('button', { name: 'Node.js' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Git' }));
    expect(onSelect).toHaveBeenCalledWith('git');
  });

  it('has no switch when there is only one log', () => {
    renderDrawer();

    expect(screen.queryByRole('button', { name: 'GitHub CLI' })).toBeNull();
  });

  it('still offers the item being shown when it has no lines but another does', () => {
    renderDrawer({ logs: { git: ['b'] }, selected: 'gh' });

    expect(screen.getByRole('button', { name: 'GitHub CLI' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Git' })).toBeTruthy();
  });

  it('copies the whole log', async () => {
    const { user } = renderDrawer();

    await user.click(screen.getByRole('button', { name: 'Copy log' }));

    expect(await navigator.clipboard.readText()).toBe('Found GitHub CLI\nDownloading\nInstalling');
    expect(toast.success).toHaveBeenCalledWith('Copied the log for GitHub CLI.');
  });

  it('does not offer to copy nothing', () => {
    renderDrawer({ logs: {} });

    expect(screen.getByRole('button', { name: 'Copy log' })).toBeDisabled();
  });

  it('closes', async () => {
    const { user, onClose } = renderDrawer();

    await user.click(screen.getByRole('button', { name: 'Close log' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows what hovering the icon buttons does, without a native tooltip', () => {
    const { container } = renderDrawer();

    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
