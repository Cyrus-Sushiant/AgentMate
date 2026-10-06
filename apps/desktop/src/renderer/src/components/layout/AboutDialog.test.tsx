import { act, createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAboutStore } from '@/stores/aboutStore';
import { useUpdateStore } from '@/stores/updateStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

/**
 * About AgentMate is where the version, the update check and the SmartClouds link live now that
 * the about card and the version chip open it. What matters: it says who made the app and which
 * version is running, the update check behaves the same as it did from the card, and the site
 * opens in the browser rather than inside the app window.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const { AboutDialog, SMARTCLOUDS_URL } = await import('./AboutDialog');

const AVAILABLE = {
  state: 'available',
  info: { version: '3.0.0', releaseDate: null, releaseNotes: null, sizeBytes: null },
  partialBytes: 0,
} as const;

function renderAbout(bridge: Record<string, unknown> = {}) {
  useAboutStore.setState({ open: true });
  return renderWithProviders(<AboutDialog />, {
    bridge: { 'app.getVersion': async () => '2.4.1', ...bridge },
  });
}

const dialog = (): Promise<HTMLElement> => screen.findByRole('dialog', { name: 'About AgentMate' });

describe('AboutDialog contents', () => {
  it('shows the logo, the version, who makes the app and a link to their site', async () => {
    renderAbout();
    const about = await dialog();

    const logo = within(about).getByRole('img', { name: 'SmartClouds' });
    expect(logo.getAttribute('srcset')).toMatch(/ 1x, .+ 2x$/);
    expect(await within(about).findByText('v2.4.1')).toBeInTheDocument();
    expect(within(about).getByText('by SmartClouds')).toBeInTheDocument();
    expect(about).toHaveAccessibleDescription(/We're SmartClouds, a full-stack digital partner/);
    expect(about).toHaveAccessibleDescription(/AgentMate is our control center/);
    expect(within(about).getByRole('link', { name: /smartclouds\.co/ })).toHaveAttribute(
      'href',
      'https://smartclouds.co',
    );
    expect(
      within(about).getByText(`© ${new Date().getFullYear()} SmartClouds`),
    ).toBeInTheDocument();
  });

  it('says "dev" in a development build', async () => {
    renderAbout({ 'app.getVersion': async () => 'dev' });

    expect(await within(await dialog()).findByText('dev')).toBeInTheDocument();
  });

  it('renders nothing until it is opened', () => {
    renderWithProviders(<AboutDialog />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('AboutDialog update check', () => {
  it('runs the check and shows it working until the answer comes back', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const { user, bridge } = renderAbout({
      'app.checkForUpdates': () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    });

    await user.click(within(await dialog()).getByRole('button', { name: 'Check for updates' }));

    const busy = screen.getByRole('button', { name: 'Checking…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    // A second press while the first is still out does not start another check.
    await user.click(busy);
    expect(bridge.$fn('app.checkForUpdates')).toHaveBeenCalledTimes(1);

    await act(async () => answer({ state: 'not-available' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("You're on the latest version."),
    );
    expect(screen.getByRole('button', { name: 'Check for updates' })).not.toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('shows a check started somewhere else as in progress too', async () => {
    renderAbout();
    const about = await dialog();

    act(() => useUpdateStore.setState({ status: { state: 'checking' } }));

    expect(within(about).getByRole('button', { name: 'Checking…' })).toBeInTheDocument();
  });

  it('reports a failed check instead of looking like nothing happened', async () => {
    const { user } = renderAbout({
      'app.checkForUpdates': async () => ({ state: 'error', message: 'Update server down.' }),
    });

    await user.click(within(await dialog()).getByRole('button', { name: 'Check for updates' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Update server down.'));
  });

  it('hands a found update to the update dialog and steps aside for it', async () => {
    const { user } = renderAbout({ 'app.checkForUpdates': async () => AVAILABLE });

    await user.click(within(await dialog()).getByRole('button', { name: 'Check for updates' }));

    await waitFor(() => expect(useUpdateStore.getState().dialogOpen).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useAboutStore.getState().open).toBe(false);
  });

  it('offers the waiting update instead of another check', async () => {
    useUpdateStore.setState({
      status: {
        state: 'downloaded',
        info: { version: '3.0.0', releaseDate: null, releaseNotes: null, sizeBytes: null },
      },
    });
    const { user, bridge } = renderAbout();
    const about = await dialog();

    expect(within(about).queryByRole('button', { name: 'Check for updates' })).toBeNull();
    await user.click(within(about).getByRole('button', { name: 'View update' }));

    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    expect(() => bridge.$fn('app.checkForUpdates')).toThrow(/not been touched/);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('AboutDialog site link', () => {
  it('opens smartclouds.co in the browser, not in the app window', async () => {
    const { bridge } = renderAbout();
    const link = within(await dialog()).getByRole('link', { name: /smartclouds\.co/ });

    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(true);
    expect(bridge.$fn('shell.openExternal')).toHaveBeenCalledWith(SMARTCLOUDS_URL);
    expect(SMARTCLOUDS_URL).toBe('https://smartclouds.co');
  });

  it('says the link leaves the app', async () => {
    renderAbout();

    expect(within(await dialog()).getByRole('link')).toHaveAccessibleName(
      'smartclouds.co, opens in your browser',
    );
  });
});

describe('AboutDialog dismissal and focus', () => {
  it('closes on Escape', async () => {
    const { user } = renderAbout();
    await dialog();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useAboutStore.getState().open).toBe(false);
  });

  it('closes from its close button', async () => {
    const { user } = renderAbout();

    await user.click(within(await dialog()).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps keyboard focus inside while open', async () => {
    const { user } = renderAbout();
    const about = await dialog();

    expect(about).toContainElement(document.activeElement as HTMLElement);
    // The check, the site link and Close, then round again.
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(about).toContainElement(document.activeElement as HTMLElement);
    }
  });
});
