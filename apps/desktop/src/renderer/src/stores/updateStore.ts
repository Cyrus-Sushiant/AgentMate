import { create } from 'zustand';
import type { UpdateStatus } from '@shared/apiTypes';

interface UpdateState {
  status: UpdateStatus;
}

export const useUpdateStore = create<UpdateState>(() => ({ status: { state: 'idle' } }));

/** Subscribes to main-process update-status pushes; call once near the app root. */
export function initUpdateStatusListener(): () => void {
  return window.agentmat.app.onUpdateStatus((status) => {
    useUpdateStore.setState({ status });
  });
}
