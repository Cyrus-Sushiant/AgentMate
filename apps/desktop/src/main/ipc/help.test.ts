import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HelpAskResult, HelpIndexStatus } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * The Help page's guide over IPC: questions answered from the real bundled articles, with the
 * index kept in the profile's data folder and requests the renderer can cancel.
 */

const userData = useTempUserData();

const runAiPrompt = vi.fn();
vi.mock('./ai', () => ({ runAiPrompt: (...args: unknown[]) => runAiPrompt(...args) }));
vi.mock('../store', () => ({
  store: {
    getSettings: async () => ({ openaiApiKey: 'sk', geminiApiKey: null, ollamaBaseUrl: '' }),
  },
}));
// No network: the provider's embeddings are left out, so retrieval runs on keywords alone.
vi.mock('../help/embedders', () => ({ createEmbedder: () => null }));

expectChannelsCovered(IPC.help, [IPC.help.onIndexProgress]);

let help: typeof import('./help');

beforeEach(async () => {
  runAiPrompt.mockReset();
  runAiPrompt.mockResolvedValue('Open the page from the sidebar [1].');
  help = await loadIpc(
    () => import('./help'),
    (m) => m.registerHelpHandlers(),
  );
});

afterEach(() => {
  help.closeHelpIndex();
});

describe('help:ask', () => {
  it('answers from the bundled articles with the guide instructions', async () => {
    const result = await invoke<HelpAskResult>(IPC.help.ask, {
      provider: 'openai',
      model: 'gpt-test',
      question: 'How do I add a server?',
    });
    expect(result).toMatchObject({ ok: true, retrieval: 'keyword' });
    expect(result.sources.length).toBeGreaterThan(0);
    const [provider, model, prompt, , , , system] = runAiPrompt.mock.calls[0]!;
    expect([provider, model]).toEqual(['openai', 'gpt-test']);
    expect(prompt).toMatch(/^Help passages:/);
    expect(prompt).toContain('[1] ');
    expect(system).toMatch(/AgentMate guide/);
    expect(existsSync(join(userData.dir, 'data', 'help-index.db'))).toBe(true);
  });

  it('can be cancelled with its request id', async () => {
    runAiPrompt.mockImplementation(
      (_p, _m, _q, _h, signal: AbortSignal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    const pending = invoke<HelpAskResult>(IPC.help.ask, {
      provider: 'openai',
      model: 'gpt-test',
      question: 'vault',
      requestId: 'r1',
    });
    await vi.waitFor(() => expect(runAiPrompt).toHaveBeenCalled());
    await expect(invoke<boolean>(IPC.help.cancel, 'r1')).resolves.toBe(true);
    await expect(pending).resolves.toMatchObject({ ok: false, cancelled: true });
    await expect(invoke<boolean>(IPC.help.cancel, 'r1')).resolves.toBe(false);
  });
});

describe('help:status', () => {
  it('reports the indexed passages', async () => {
    const status = await invoke<HelpIndexStatus>(IPC.help.status, 'openai');
    expect(status.chunks).toBeGreaterThan(0);
    expect(status).toMatchObject({ embedded: 0, embedder: null });
    expect(['sqlite-vec', 'js']).toContain(status.backend);
  });
});
