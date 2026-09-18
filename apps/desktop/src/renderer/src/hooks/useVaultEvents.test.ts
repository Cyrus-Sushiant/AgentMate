// @vitest-environment jsdom
import type { VaultStatus } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { useVaultStore } from '@/stores/vaultStore';
import { renderHookWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * The bridge between the vault in main and the renderer's caches. It is mounted once by the app
 * shell, so a lock that happens while another page is open still has to drop the decrypted list:
 * these tests assert on the caches and the store, never on anything drawn.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
);
vi.mock('sonner', () => ({ toast }));

const { useVaultEvents } = await import('./useVaultEvents');

function status(state: VaultStatus['state']): VaultStatus {
  return { state, retryAfterMs: 0, autoLockMinutes: 15, clipboardClearSeconds: 30 };
}

describe('useVaultEvents subscriptions', () => {
  it('listens to all three vault channels while it is mounted', () => {
    const { bridge } = renderHookWithProviders(() => useVaultEvents());

    expect(bridge.$listenerCount('vault.onStateChanged')).toBe(1);
    expect(bridge.$listenerCount('vault.onEntriesChanged')).toBe(1);
    expect(bridge.$listenerCount('vault.onClipboardSettled')).toBe(1);
  });

  it('lets go of every channel on unmount, so a remount does not double-handle events', () => {
    const { bridge, unmount } = renderHookWithProviders(() => useVaultEvents());

    unmount();

    expect(bridge.$listenerCount('vault.onStateChanged')).toBe(0);
    expect(bridge.$listenerCount('vault.onEntriesChanged')).toBe(0);
    expect(bridge.$listenerCount('vault.onClipboardSettled')).toBe(0);
  });
});

describe('useVaultEvents state changes', () => {
  it('throws away the decrypted data and remembers why when the vault locks', async () => {
    const { bridge, queryClient } = renderHookWithProviders(() => useVaultEvents());
    queryClient.setQueryData(queryKeys.vaultStatus, status('unlocked'));
    queryClient.setQueryData(queryKeys.vaultEntries, [{ id: 'e1', title: 'Router' }]);
    useVaultStore.getState().setQuery('rout');
    useVaultStore.getState().select('e1');

    bridge.$emit('vault.onStateChanged', { state: 'locked', reason: 'idle' });

    // The list held plaintext, so it has to be gone rather than merely stale.
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.vaultEntries)).toBeUndefined());
    expect(queryClient.getQueryData<VaultStatus>(queryKeys.vaultStatus)?.state).toBe('locked');
    // And the view has nothing left that describes what was in the vault.
    expect(useVaultStore.getState().query).toBe('');
    expect(useVaultStore.getState().selectedId).toBeNull();
    expect(useVaultStore.getState().lastLockReason).toBe('idle');
  });

  it('records no reason when main locked the vault without giving one', async () => {
    const { bridge } = renderHookWithProviders(() => useVaultEvents());
    useVaultStore.getState().setLastLockReason('manual');

    bridge.$emit('vault.onStateChanged', { state: 'locked' });

    await waitFor(() => expect(useVaultStore.getState().lastLockReason).toBeNull());
  });

  it('clears the stale lock reason when the vault unlocks and keeps the cache alone', async () => {
    const { bridge, queryClient } = renderHookWithProviders(() => useVaultEvents());
    queryClient.setQueryData(queryKeys.vaultStatus, status('locked'));
    queryClient.setQueryData(queryKeys.vaultEntries, [{ id: 'e1', title: 'Router' }]);
    useVaultStore.getState().setLastLockReason('system');

    bridge.$emit('vault.onStateChanged', { state: 'unlocked' });

    await waitFor(() => expect(useVaultStore.getState().lastLockReason).toBeNull());
    expect(queryClient.getQueryData<VaultStatus>(queryKeys.vaultStatus)?.state).toBe('unlocked');
    expect(queryClient.getQueryData(queryKeys.vaultEntries)).toBeDefined();
  });

  it('leaves the status cache empty rather than inventing one before it has been read', () => {
    const { bridge, queryClient } = renderHookWithProviders(() => useVaultEvents());

    bridge.$emit('vault.onStateChanged', { state: 'unlocked' });

    expect(queryClient.getQueryData(queryKeys.vaultStatus)).toBeUndefined();
  });
});

describe('useVaultEvents entry and clipboard events', () => {
  it('refetches the entries when main says they changed', async () => {
    const entries = vi.fn(async () => [{ id: 'e1' }]);
    // The Vault page's own query, mounted alongside the hook: only an observed query refetches
    // on invalidation, and that page is exactly who is watching when an entry is added.
    const { bridge } = renderHookWithProviders(() => {
      useVaultEvents();
      return useQuery({ queryKey: queryKeys.vaultEntries, queryFn: entries });
    });
    await waitFor(() => expect(entries).toHaveBeenCalledTimes(1));

    bridge.$emit('vault.onEntriesChanged');

    await waitFor(() => expect(entries).toHaveBeenCalledTimes(2));
  });

  it('tells the user the clipboard really was wiped', () => {
    const { bridge } = renderHookWithProviders(() => useVaultEvents());

    bridge.$emit('vault.onClipboardSettled', { cleared: true });

    expect(toast).toHaveBeenCalledWith(
      'Clipboard cleared',
      expect.objectContaining({ id: 'vault-clipboard' }),
    );
  });

  it('just drops the countdown when the user copied something else in the meantime', () => {
    const { bridge } = renderHookWithProviders(() => useVaultEvents());

    bridge.$emit('vault.onClipboardSettled', { cleared: false });

    // Claiming a clear that did not happen would be worse than saying nothing.
    expect(toast.dismiss).toHaveBeenCalledWith('vault-clipboard');
    expect(toast).not.toHaveBeenCalled();
  });
});
