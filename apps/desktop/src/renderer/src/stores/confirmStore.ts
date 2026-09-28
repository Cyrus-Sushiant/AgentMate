import type { ComponentType } from 'react';
import { create } from 'zustand';

/** One thing the question is about, listed in the modal so the user sees exactly what it hits. */
export interface ConfirmItem {
  name: string;
  /** Where it lives, shown dimmed after the name. */
  detail?: string;
  isDirectory?: boolean;
}

interface ConfirmOptions {
  title: string;
  description?: string;
  items?: ConfirmItem[];
  /** How many more items there are beyond `items`, shown as a last line of the list. */
  moreCount?: number;
  /** A consequence worth calling out on its own, like unsaved work that will be lost. */
  warning?: string;
  icon?: ComponentType<{ className?: string }>;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

const initialState: ConfirmState = {
  open: false,
  title: '',
  description: undefined,
  items: undefined,
  moreCount: undefined,
  warning: undefined,
  icon: undefined,
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
  resolve: null,
};

export const useConfirmStore = create<ConfirmState>(() => initialState);

/** Opens the shared confirmation modal and resolves once the user picks an option. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().resolve?.(false);
    useConfirmStore.setState({ ...initialState, ...options, open: true, resolve });
  });
}

export function resolveConfirm(value: boolean): void {
  useConfirmStore.getState().resolve?.(value);
  useConfirmStore.setState({ open: false, resolve: null });
}
