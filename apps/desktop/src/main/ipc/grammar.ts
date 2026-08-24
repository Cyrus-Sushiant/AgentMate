import { mkdir } from 'node:fs/promises';
import { ipcMain, shell } from 'electron';
import type {
  GrammarCheckInput,
  GrammarCheckResult,
  GrammarLocalStatus,
} from '../../shared/grammar';
import { IPC } from '../../shared/ipcChannels';
import { checkText } from '../grammar/languageToolClient';
import {
  getLocalStatus,
  startLocalServer,
  stopLocalServer,
  toolsDir,
} from '../grammar/localServer';
import { store } from '../store';

export function registerGrammarHandlers(): void {
  ipcMain.handle(
    IPC.grammar.check,
    async (_event, input: GrammarCheckInput): Promise<GrammarCheckResult> => {
      const { grammar } = await store.getSettings();
      return checkText(input.text ?? '', grammar, input.language);
    },
  );

  ipcMain.handle(IPC.grammar.localStatus, async (): Promise<GrammarLocalStatus> => {
    const { grammar } = await store.getSettings();
    return getLocalStatus(grammar);
  });

  ipcMain.handle(IPC.grammar.startLocal, async (): Promise<GrammarLocalStatus> => {
    const { grammar } = await store.getSettings();
    return startLocalServer(grammar);
  });

  ipcMain.handle(IPC.grammar.stopLocal, async (): Promise<GrammarLocalStatus> => {
    const { grammar } = await store.getSettings();
    return stopLocalServer(grammar);
  });

  ipcMain.handle(IPC.grammar.openToolsFolder, async (): Promise<string> => {
    const dir = toolsDir();
    // Opening a folder that doesn't exist yet just fails silently on some
    // platforms, and the whole point is to give the user somewhere to drop the zip.
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return dir;
  });
}
