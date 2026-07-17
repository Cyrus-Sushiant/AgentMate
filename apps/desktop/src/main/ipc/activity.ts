import { ipcMain } from 'electron';
import type { ActivityEvent } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import { store } from '../store';

export function registerActivityHandlers(): void {
  ipcMain.handle(IPC.activity.list, (): Promise<ActivityEvent[]> => store.getActivity());
}
