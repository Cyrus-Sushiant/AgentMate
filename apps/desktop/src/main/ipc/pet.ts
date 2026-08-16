import { ipcMain } from 'electron';
import type { CustomDesktopPet } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { PetSnoozeState, PetWorkArea } from '../../shared/pet';
import { focusMainWindow } from '../mainWindow';
import { customPetDataUrls, importCustomPet, removeCustomPet } from '../pet/customPets';
import { petManager } from '../pet/petWindow';

export function registerPetHandlers(): void {
  ipcMain.on(IPC.pet.setClickThrough, (_event, ignore: boolean) => {
    petManager.setClickThrough(Boolean(ignore));
  });

  ipcMain.on(IPC.pet.showMainWindow, () => {
    focusMainWindow();
  });

  ipcMain.handle(IPC.pet.getWorkArea, (): PetWorkArea => petManager.workArea());
  ipcMain.handle(IPC.pet.importCustom, (): Promise<CustomDesktopPet | null> => importCustomPet());
  ipcMain.handle(IPC.pet.removeCustom, async (_event, id: string): Promise<void> => {
    await removeCustomPet(String(id));
  });
  ipcMain.handle(
    IPC.pet.customDataUrls,
    (): Promise<Record<string, string>> => customPetDataUrls(),
  );

  ipcMain.handle(
    IPC.pet.snooze,
    (_event, minutes: number): PetSnoozeState => petManager.snooze(Number(minutes)),
  );
  ipcMain.handle(IPC.pet.cancelSnooze, (): PetSnoozeState => petManager.cancelSnooze());
  ipcMain.handle(IPC.pet.getSnooze, (): PetSnoozeState => petManager.snoozeState());
}
