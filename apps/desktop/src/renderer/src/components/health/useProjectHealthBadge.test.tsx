import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderHookWithProviders } from '../../../../test/renderer/renderWithProviders';
import { incident, target } from './testing/fixtures';
import { useProjectHealthBadge } from './useProjectHealthBadge';

describe('useProjectHealthBadge', () => {
  it('counts open incidents in the project and asks for attention', async () => {
    const { result, bridge } = renderHookWithProviders(() => useProjectHealthBadge('p1'), {
      bridge: {
        'health.list': [
          target({ id: 'a', openIncident: incident() }),
          target({ id: 'b', openIncident: incident({ id: 'i2' }) }),
          target({ id: 'c' }),
        ],
      },
    });
    await waitFor(() => expect(result.current).toEqual({ count: 2, attention: true }));
    expect(bridge.$fn('health.list')).toHaveBeenCalledWith({ projectId: 'p1' });
  });

  it('has no badge while nothing is down', async () => {
    const { result, bridge } = renderHookWithProviders(() => useProjectHealthBadge('p1'), {
      bridge: { 'health.list': [target()] },
    });
    await waitFor(() => expect(bridge.$fn('health.list')).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
