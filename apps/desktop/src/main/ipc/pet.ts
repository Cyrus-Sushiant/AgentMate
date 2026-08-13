import { ipcMain } from 'electron';
import type { CustomDesktopPet } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { PetWorkArea } from '../../shared/pet';
import { customPetDataUrls, importCustomPet, removeCustomPet } from '../pet/customPets';
import { petManager } from '../pet/petWindow';

export function registerPetHandlers(): void {
  ipcMain.on(IPC.pet.setClickThrough, (_event, ignore: boolean) => {
    petManager.setClickThrough(Boolean(ignore));
  });

  ipcMain.handle(IPC.pet.getWorkArea, (): PetWorkArea => petManager.workArea());
  ipcMain.handle(IPC.pet.importCustom, (): Promise<CustomDesktopPet | null> => importCustomPet());
  ipcMain.handle(IPC.pet.removeCustom, async (_event, id: string): Promise<void> => {
    await removeCustomPet(String(id));
  });
  ipcMain.handle(IPC.pet.customDataUrls, (): Promise<Record<string, string>> => customPetDataUrls());
}
