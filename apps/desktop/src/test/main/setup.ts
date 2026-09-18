import { afterEach, vi } from 'vitest';
import { resetElectronMock } from './electronMock';
import { resetInvokedChannels } from './ipcHarness';

/** Runs before every main-process test file. Keeps state from leaking between them. */

afterEach(() => {
  resetElectronMock();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// The channel coverage record is per file, not per test.
resetInvokedChannels();
