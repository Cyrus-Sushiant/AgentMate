import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  description?: string;
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
