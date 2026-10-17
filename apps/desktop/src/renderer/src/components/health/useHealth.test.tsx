import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithProviders } from '../../../../test/renderer/renderWithProviders';
import { detail, reveal, target } from './testing/fixtures';

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast }));

const { useHealthActions, useHealthTarget, useHealthTargets } = await import('./useHealth');

describe('useHealthTargets', () => {
  it('lists every target, or one project when asked', async () => {
    const list = vi.fn(async () => [target()]);
    const { result, bridge } = renderHookWithProviders(() => useHealthTargets('p1'), {
      bridge: { 'health.list': list },
    });
    await waitFor(() => expect(result.current.targets).toHaveLength(1));
    expect(bridge.$fn('health.list')).toHaveBeenCalledWith({ projectId: 'p1' });
  });

  it('reads the list and the open target again when the main process says they changed', async () => {
    const list = vi.fn(async () => [target()]);
    const get = vi.fn(async () => detail());
    const { result, bridge } = renderHookWithProviders(
      () => ({ list: useHealthTargets(), one: useHealthTarget('t1') }),
      { bridge: { 'health.list': list, 'health.get': get } },
    );
    await waitFor(() => expect(result.current.one.data).toBeTruthy());
    expect(list).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);

    act(() => bridge.$emit('health.onChanged', { targetIds: ['t1'] }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('stops listening once unmounted', async () => {
    const { unmount, bridge } = renderHookWithProviders(() => useHealthTargets(), {
      bridge: { 'health.list': [] },
    });
    await waitFor(() => expect(bridge.$listenerCount('health.onChanged')).toBe(1));
    unmount();
    expect(bridge.$listenerCount('health.onChanged')).toBe(0);
  });
});

describe('useHealthActions', () => {
  it('keeps a new secret out of every cache', async () => {
    const secret = reveal();
    const { result, queryClient } = renderHookWithProviders(() => useHealthActions(), {
      bridge: {
        'health.list': [],
        'health.create': async () => ({ target: target(), secret }),
        'health.rotateSecret': async () => secret,
      },
    });
    const created = await result.current.create({ ...target() });
    expect(created.secret.secret).toBe(secret.secret);
    const rotated = await result.current.rotateSecret('t1');
    expect(rotated.secret).toBe(secret.secret);

    const cached = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    ]);
    expect(cached).not.toContain(secret.secret);
    expect(cached).not.toContain(secret.sha256);
  });

  it('refreshes the list after a create', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useHealthActions(), {
      bridge: { 'health.create': async () => ({ target: target(), secret: reveal() }) },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.create({ ...target() });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.health }),
    );
  });

  it('pauses, resumes and removes with a toast that says what happened', async () => {
    const { result, bridge } = renderHookWithProviders(() => useHealthActions(), {
      bridge: { 'health.setPaused': async () => target({ paused: true }) },
    });
    await act(() => result.current.setPaused.mutateAsync({ targetId: 't1', paused: true }));
    expect(bridge.$fn('health.setPaused')).toHaveBeenCalledWith('t1', true);
    expect(toast.success).toHaveBeenCalledWith('Checks paused');

    await act(() => result.current.remove.mutateAsync('t1'));
    expect(bridge.$fn('health.remove')).toHaveBeenCalledWith('t1');
    expect(toast.success).toHaveBeenCalledWith('Target removed');
  });

  it('says why a change failed, without the IPC wrapper text', async () => {
    const { result } = renderHookWithProviders(() => useHealthActions(), {
      bridge: {
        'health.update': async () => {
          throw new Error("Error invoking remote method 'health:update': Error: No such target");
        },
      },
    });
    await act(async () => {
      await result.current.update
        .mutateAsync({ targetId: 't1', patch: { name: 'x' } })
        .catch(() => undefined);
    });
    expect(toast.error).toHaveBeenCalledWith('Could not save the target', {
      description: 'No such target',
    });
  });

  it('runs a check now and hands back what it found', async () => {
    const { result } = renderHookWithProviders(() => useHealthActions(), {
      bridge: { 'health.checkNow': async () => detail() },
    });
    let found: unknown;
    await act(async () => {
      found = await result.current.checkNow.mutateAsync('t1');
    });
    expect(found).toMatchObject({ target: { id: 't1' } });
  });
});
