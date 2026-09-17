// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVaultApiMock,
  installVaultApi,
  renderWithVaultProviders,
  summary,
  type VaultApiMock,
} from '@/components/vault/testing/mockVaultApi';
import { queryKeys } from '@/lib/queryKeys';
import { useVaultStore } from '@/stores/vaultStore';

const clipboardToast = vi.hoisted(() => ({ settleClipboardToast: vi.fn() }));
vi.mock('@/lib/vault/clipboardToast', () => clipboardToast);

const { useVaultEvents } = await import('./useVaultEvents');

function Probe(): null {
  useVaultEvents();
  return null;
}

let mock: VaultApiMock;
let client: QueryClient;

beforeEach(() => {
  mock = createVaultApiMock();
  installVaultApi(mock);
  client = new QueryClient();
  useVaultStore.getState().resetView();
  clipboardToast.settleClipboardToast.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('useVaultEvents', () => {
  it('forgets every decrypted summary and the selection the moment the vault locks', () => {
    renderWithVaultProviders(<Probe />, client);
    client.setQueryData(queryKeys.vaultEntries, [
      summary({ title: 'S3NT1NEL title', username: 'S3NT1NEL user' }),
    ]);
    client.setQueryData(queryKeys.vaultStatus, { ...mock.status, state: 'unlocked' });
    useVaultStore.setState({ selectedId: 'entry-1', query: 'S3NT1NEL' });

    act(() => mock.emitState({ state: 'locked', reason: 'idle' }));

    expect(client.getQueryData(queryKeys.vaultEntries)).toBeUndefined();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('S3NT1NEL');
    expect(client.getQueryData(queryKeys.vaultStatus)).toMatchObject({ state: 'locked' });
    expect(useVaultStore.getState()).toMatchObject({ selectedId: null, query: '' });
    expect(useVaultStore.getState().lastLockReason).toBe('idle');
  });

  it('refreshes the list when entries change and the status when the vault unlocks', async () => {
    renderWithVaultProviders(<Probe />, client);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    act(() => mock.emitEntriesChanged());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.vaultEntries });

    client.setQueryData(queryKeys.vaultStatus, { ...mock.status, state: 'locked' });
    act(() => mock.emitState({ state: 'unlocked' }));
    expect(client.getQueryData(queryKeys.vaultStatus)).toMatchObject({ state: 'unlocked' });
    expect(useVaultStore.getState().lastLockReason).toBeNull();
  });

  it('passes clipboard results on to the toast', () => {
    renderWithVaultProviders(<Probe />, client);
    act(() => mock.emitClipboard(true));
    expect(clipboardToast.settleClipboardToast).toHaveBeenCalledWith(true);
  });

  it('stops listening when unmounted', () => {
    const { unmount } = renderWithVaultProviders(<Probe />, client);
    unmount();
    act(() => mock.emitClipboard(true));
    expect(clipboardToast.settleClipboardToast).not.toHaveBeenCalled();
  });
});
