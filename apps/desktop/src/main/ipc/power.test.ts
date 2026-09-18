import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeepAwakeStatus } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { electronState, FakeBrowserWindow } from '../../test/main/electronMock';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * Keeping the machine awake while an agent is working. The mode is persisted, so what matters
 * here is that a choice survives into settings.json and that the power blocker follows it:
 * a blocker left running would stop the machine sleeping for good.
 */

const userData = useTempUserData();
expectChannelsCovered(IPC.power, [
  // Pushed to the renderer when the blocker changes, and covered by its own test below.
  IPC.power.onKeepAwake,
]);

async function register(): Promise<void> {
  await loadIpc(
    () => import('./power'),
    (module) => module.registerPowerHandlers(),
  );
}

/** Blockers that have been started and not stopped again. */
function activeBlockers(): number {
  return electronState.powerBlockers.filter((one) => !one.stopped).length;
}

beforeEach(async () => {
  // Registration reads the stored mode from disk and applies it in a promise of its own. The
  // file is seeded with a known value and waited for, or that read lands mid-test and undoes
  // whatever the test just set.
  userData.writeData('settings.json', { keepAwake: 'off' });
  await register();
  await vi.waitFor(async () => {
    const status = await invoke<KeepAwakeStatus>(IPC.power.keepAwakeStatus);
    expect(status.mode).toBe('off');
  });
});

describe('keep awake', () => {
  it('reports a status the title bar can draw', async () => {
    const status = await invoke<KeepAwakeStatus>(IPC.power.keepAwakeStatus);

    expect(status).toMatchObject({ mode: expect.any(String) });
  });

  it('holds the machine awake while the mode is on, and lets go again', async () => {
    await invoke(IPC.power.setKeepAwake, 'on');
    expect(activeBlockers()).toBe(1);

    await invoke(IPC.power.setKeepAwake, 'off');
    expect(activeBlockers()).toBe(0);
  });

  it('saves the choice so the next start reads it back', async () => {
    await invoke(IPC.power.setKeepAwake, 'on');

    const settings = JSON.parse(
      await import('node:fs/promises').then((fs) =>
        fs.readFile(userData.dataFile('settings.json'), 'utf-8'),
      ),
    ) as { keepAwake?: string };
    expect(settings.keepAwake).toBe('on');
  });

  it('ignores a mode it does not know and keeps the current one', async () => {
    // The value crosses IPC from the renderer, so it cannot be trusted.
    await invoke(IPC.power.setKeepAwake, 'on');
    const before = await invoke<KeepAwakeStatus>(IPC.power.keepAwakeStatus);

    await invoke(IPC.power.setKeepAwake, 'sometimes');

    expect(await invoke<KeepAwakeStatus>(IPC.power.keepAwakeStatus)).toEqual(before);
    expect(activeBlockers()).toBe(1);
  });

  it('starts only one blocker however often the same mode is set', async () => {
    // Each start returns a new id, so a missed stop would leak one per call.
    await invoke(IPC.power.setKeepAwake, 'on');
    await invoke(IPC.power.setKeepAwake, 'on');
    await invoke(IPC.power.setKeepAwake, 'on');

    expect(activeBlockers()).toBe(1);
  });

  it('tells every open window when the blocker changes', async () => {
    const win = new FakeBrowserWindow();

    await invoke(IPC.power.setKeepAwake, 'on');

    const sent = win.webContents.sentOn(IPC.power.onKeepAwake);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.at(-1)?.[0]).toMatchObject({ mode: 'on' });
  });
});
