import { toast, type ExternalToast } from 'sonner';
import { useToastHistoryStore, type ToastHistoryKind } from '@/stores/toastHistoryStore';

let installed = false;
let suppressRecord = 0;

function asText(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'function') return '';
  if (typeof value === 'object' && value !== null && 'props' in value) {
    const children = (value as { props?: { children?: unknown } }).props?.children;
    if (children == null) return '';
    if (Array.isArray(children)) return children.map(asText).filter(Boolean).join(' ');
    return asText(children);
  }
  return '';
}

function record(kind: ToastHistoryKind, message: unknown, data?: ExternalToast): void {
  if (suppressRecord > 0) return;
  const title = asText(message).trim();
  const description = asText(data?.description).trim();
  if (!title && !description) return;
  useToastHistoryStore.getState().add({
    kind,
    title: title || description,
    description: title ? description : '',
  });
}

function patch(
  name: 'success' | 'info' | 'warning' | 'error' | 'message',
  kind: ToastHistoryKind,
): void {
  const original = toast[name].bind(toast);
  toast[name] = ((message, data) => {
    const id = original(message, data);
    record(kind, message, data);
    return id;
  }) as typeof toast.success;
}

/** Replay a past toast in the corner without writing a second history row. */
export function replayToast(kind: ToastHistoryKind, title: string, description: string): void {
  suppressRecord += 1;
  try {
    const fn = kind === 'message' ? toast.message : toast[kind];
    fn(title, description ? { description } : undefined);
  } finally {
    suppressRecord -= 1;
  }
}

/** Hook sonner's typed toast helpers so every flash is kept in history. */
export function installToastHistoryCapture(): void {
  if (installed) return;
  installed = true;
  patch('success', 'success');
  patch('info', 'info');
  patch('warning', 'warning');
  patch('error', 'error');
  patch('message', 'message');
}
