import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSearchStore } from '@/stores/searchStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { TitleBar } from './TitleBar';

/**
 * The title bar is the window's only chrome: the frame is hidden, so if these buttons stop
 * reaching the bridge the window cannot be minimized, maximized or closed at all. Which set of
 * controls is drawn depends on the platform, hence the two groups below.
 *
 * Neither set carries an accessible name (the label lives in a hover tooltip and the glyph is
 * aria-hidden), so the controls are found by the glyph or icon they draw. Worth fixing in the
 * component one day; the tests are written against what ships today.
 */

/** A Windows/Linux caption button, found by the Segoe Fluent glyph it draws. */
function captionButton(glyph: string): HTMLElement {
  const button = screen.getByText(glyph).closest('button');
  if (!button) throw new Error(`No caption button for glyph ${JSON.stringify(glyph)}`);
  return button;
}

const GLYPH = { minimize: '', maximize: '', restore: '', close: '' };

/** A macOS traffic light, found by the icon inside it. */
function trafficLight(container: HTMLElement, icon: string): HTMLElement {
  const button = container.querySelector(`svg[data-icon="${icon}"]`)?.closest('button');
  if (!button) throw new Error(`No traffic light with the "${icon}" icon`);
  return button;
}

describe('TitleBar on Windows and Linux', () => {
  it('shows the app name and the search box', async () => {
    renderWithProviders(<TitleBar />);

    expect(screen.getByText('AgentMate')).toBeTruthy();
    expect(await screen.findByText('Search projects, history, skills…')).toBeTruthy();
  });

  it('minimizes the window through the bridge', async () => {
    const { bridge, user } = renderWithProviders(<TitleBar />);

    await user.click(captionButton(GLYPH.minimize));

    expect(bridge.$fn('window.minimize')).toHaveBeenCalled();
  });

  it('maximizes the window through the bridge', async () => {
    const { bridge, user } = renderWithProviders(<TitleBar />);

    await user.click(captionButton(GLYPH.maximize));

    expect(bridge.$fn('window.maximizeToggle')).toHaveBeenCalled();
  });

  it('closes the window through the bridge', async () => {
    const { bridge, user } = renderWithProviders(<TitleBar />);

    await user.click(captionButton(GLYPH.close));

    expect(bridge.$fn('window.close')).toHaveBeenCalled();
  });

  it('swaps maximize for restore once the window is maximized', async () => {
    const { bridge } = renderWithProviders(<TitleBar />, {
      // A plain `true` would be read as a value on the bridge, so this answer is a call.
      bridge: { 'window.isMaximized': async () => true },
    });

    expect(await screen.findByText(GLYPH.restore)).toBeTruthy();
    expect(screen.queryByText(GLYPH.maximize)).toBeNull();

    // Restoring from elsewhere (an OS snap, a double-click on the drag area) pushes in too.
    act(() => bridge.$emit('window.onMaximizedChange', false));
    expect(await screen.findByText(GLYPH.maximize)).toBeTruthy();
  });

  it('opens the command palette from the search box', async () => {
    const { user } = renderWithProviders(<TitleBar />);

    await user.click(await screen.findByText('Search projects, history, skills…'));

    expect(useSearchStore.getState().open).toBe(true);
  });

  it('stops listening for window state once it unmounts', async () => {
    const { bridge, unmount } = renderWithProviders(<TitleBar />);
    await waitFor(() => expect(bridge.$listenerCount('window.onMaximizedChange')).toBe(1));

    unmount();

    expect(bridge.$listenerCount('window.onMaximizedChange')).toBe(0);
  });
});

describe('TitleBar on macOS', () => {
  it('draws the traffic lights instead of the caption buttons, wired to the same calls', async () => {
    const { bridge, user, container } = renderWithProviders(<TitleBar />, {
      bridge: { platform: 'darwin' },
    });

    expect(screen.queryByText(GLYPH.close)).toBeNull();

    await user.click(trafficLight(container, 'window-minimize'));
    await user.click(trafficLight(container, 'window-maximize'));
    await user.click(trafficLight(container, 'xmark'));

    expect(bridge.$fn('window.minimize')).toHaveBeenCalled();
    expect(bridge.$fn('window.maximizeToggle')).toHaveBeenCalled();
    expect(bridge.$fn('window.close')).toHaveBeenCalled();
  });
});
