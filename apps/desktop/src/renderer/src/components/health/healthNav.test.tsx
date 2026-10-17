import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  renderHookWithProviders,
  renderWithProviders,
} from '../../../../test/renderer/renderWithProviders';
import { incident, target } from './testing/fixtures';

/** The Health entry in the main menu, and the badge that counts open incidents on it. */

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

const { NAV_ITEMS, useNavBadges } = await import('@/components/layout/mainNav');
const { Sidebar } = await import('@/components/layout/Sidebar');

/** What the rest of the menu reads, so only the health answers vary. */
const quiet = { 'appNotifications.unreadCount': 0, 'app.getVersion': '1.0.0' };

const down = target({ id: 'a', state: 'fail', openIncident: incident({ targetId: 'a' }) });
const fine = target({ id: 'b' });

describe('Monitoring in the main menu', () => {
  it('sits under Ship', () => {
    expect(NAV_ITEMS.find((item) => item.to === '/monitoring')).toMatchObject({
      label: 'Monitoring',
      group: 'Ship',
    });
  });

  it('counts the targets with an open incident, and follows changes', async () => {
    let list = [down, fine];
    const { result, bridge } = renderHookWithProviders(() => useNavBadges(), {
      bridge: { ...quiet, 'health.list': async () => list },
    });
    await waitFor(() => expect(result.current.healthIncidents).toBe(1));
    list = [fine];
    act(() => bridge.$emit('health.onChanged', { targetIds: ['a'] }));
    await waitFor(() => expect(result.current.healthIncidents).toBe(0));
  });

  it('shows the count on the sidebar entry, said in words as well', async () => {
    renderWithProviders(<Sidebar />, { bridge: { ...quiet, 'health.list': [down, fine] } });
    const link = await screen.findByRole('link', { name: /Monitoring/ });
    await waitFor(() => expect(within(link).getByText('1')).toBeInTheDocument());
    expect(link).toHaveTextContent('1 open incident');
  });

  it('carries no badge when nothing is down', async () => {
    renderWithProviders(<Sidebar />, { bridge: { ...quiet, 'health.list': [fine] } });
    const link = await screen.findByRole('link', { name: /Monitoring/ });
    await waitFor(() => expect(link.textContent).toBe('Monitoring'));
  });
});
