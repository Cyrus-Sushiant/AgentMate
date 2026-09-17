import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => Object.assign(vi.fn(), { dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { settleClipboardToast, showCopiedToast, VAULT_CLIPBOARD_TOAST_ID } = await import(
  './clipboardToast'
);

describe('vault clipboard toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    toast.mockClear();
    toast.dismiss.mockClear();
  });
  afterEach(() => {
    settleClipboardToast(false);
    vi.useRealTimers();
  });

  it('counts down to the moment the clipboard clears, reusing one toast', () => {
    showCopiedToast('Password', 1_000_000 + 30_000);
    expect(toast).toHaveBeenLastCalledWith(
      'Password copied',
      expect.objectContaining({
        id: VAULT_CLIPBOARD_TOAST_ID,
        description: 'Clears from the clipboard in 30s',
      }),
    );
    vi.advanceTimersByTime(1000);
    expect(toast).toHaveBeenLastCalledWith(
      'Password copied',
      expect.objectContaining({ description: 'Clears from the clipboard in 29s' }),
    );
    expect(new Set(toast.mock.calls.map((call) => call[1].id))).toEqual(
      new Set([VAULT_CLIPBOARD_TOAST_ID]),
    );
  });

  it('says the clipboard was cleared, or quietly goes away when the user copied something else', () => {
    showCopiedToast('Password', 1_030_000);
    settleClipboardToast(true);
    expect(toast).toHaveBeenLastCalledWith(
      'Clipboard cleared',
      expect.objectContaining({ id: VAULT_CLIPBOARD_TOAST_ID }),
    );
    const calls = toast.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(toast.mock.calls.length).toBe(calls);

    showCopiedToast('Username', 1_030_000);
    settleClipboardToast(false);
    expect(toast.dismiss).toHaveBeenCalledWith(VAULT_CLIPBOARD_TOAST_ID);
  });

  it('shows a plain confirmation when clearing is turned off', () => {
    showCopiedToast('API key', null);
    expect(toast).toHaveBeenLastCalledWith(
      'API key copied',
      expect.objectContaining({ description: undefined }),
    );
    vi.advanceTimersByTime(5000);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('never puts the copied value in the toast', () => {
    showCopiedToast('Password', 1_030_000);
    expect(JSON.stringify(toast.mock.calls)).not.toMatch(/S3NT1NEL/);
  });
});
