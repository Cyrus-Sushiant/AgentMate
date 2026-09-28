import { act } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderHookWithProviders } from '../../../test/renderer/renderWithProviders';
import { useRememberRoute } from './useRememberRoute';

/** The app window tells main which page it is on, so the next launch can reopen it. */

function useRememberAndNavigate(): ReturnType<typeof useNavigate> {
  useRememberRoute();
  return useNavigate();
}

describe('useRememberRoute', () => {
  it('reports the page the window opened on', () => {
    const { bridge } = renderHookWithProviders(useRememberAndNavigate, {
      route: '/workspace/p1',
    });

    expect(bridge.$fn('app.setLastRoute')).toHaveBeenCalledWith('/workspace/p1');
  });

  it('reports each page it moves to, with its query', () => {
    const { bridge, result } = renderHookWithProviders(useRememberAndNavigate);

    act(() => result.current('/settings?tab=general'));

    expect(bridge.$fn('app.setLastRoute')).toHaveBeenLastCalledWith('/settings?tab=general');
  });

  it('does not report again when nothing about the route changed', () => {
    const { bridge, rerender } = renderHookWithProviders(useRememberAndNavigate, {
      route: '/usage',
    });

    rerender();
    rerender();

    expect(bridge.$fn('app.setLastRoute')).toHaveBeenCalledTimes(1);
  });
});
