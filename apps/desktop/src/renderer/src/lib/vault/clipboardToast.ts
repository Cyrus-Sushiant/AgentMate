import { toast } from 'sonner';

export const VAULT_CLIPBOARD_TOAST_ID = 'vault-clipboard';

let countdown: ReturnType<typeof setInterval> | null = null;

function stopCountdown(): void {
  if (countdown) clearInterval(countdown);
  countdown = null;
}

/**
 * One toast for every copy, counting down to when main clears the clipboard. It uses plain
 * `toast()` rather than `toast.success()` so the per-second updates stay out of the message
 * history, and it only ever names the field, never the value.
 */
export function showCopiedToast(label: string, clearsAt: number | null): void {
  stopCountdown();
  const title = `${label} copied`;
  if (clearsAt === null) {
    toast(title, { id: VAULT_CLIPBOARD_TOAST_ID, description: undefined, duration: 3000 });
    return;
  }
  const render = () => {
    const seconds = Math.max(0, Math.ceil((clearsAt - Date.now()) / 1000));
    toast(title, {
      id: VAULT_CLIPBOARD_TOAST_ID,
      description: `Clears from the clipboard in ${seconds}s`,
      duration: Number.POSITIVE_INFINITY,
    });
    if (seconds === 0) stopCountdown();
  };
  render();
  countdown = setInterval(render, 1000);
}

/** Main reports whether it cleared the clipboard or left something the user copied since. */
export function settleClipboardToast(cleared: boolean): void {
  stopCountdown();
  if (cleared) {
    toast('Clipboard cleared', {
      id: VAULT_CLIPBOARD_TOAST_ID,
      description: undefined,
      duration: 2500,
    });
  } else {
    toast.dismiss(VAULT_CLIPBOARD_TOAST_ID);
  }
}
