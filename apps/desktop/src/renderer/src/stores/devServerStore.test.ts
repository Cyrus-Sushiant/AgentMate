import { beforeEach, describe, expect, it } from 'vitest';
import { detectedServersFor, useDevServerStore } from './devServerStore';

function store() {
  return useDevServerStore.getState();
}

beforeEach(() => {
  useDevServerStore.getState().reset();
});

describe('noteOutput', () => {
  it('remembers the dev servers a terminal printed', () => {
    store().noteOutput('t1', '  ➜  Local:   http://localhost:5173/\r\n');
    expect(store().servers.t1).toEqual(['http://localhost:5173/']);
  });

  it('finds an address split across two chunks of output', () => {
    store().noteOutput('t1', 'Local: http://local');
    store().noteOutput('t1', 'host:3000\n');
    expect(store().servers.t1).toEqual(['http://localhost:3000/']);
  });

  it('puts the latest address first and lists each once', () => {
    store().noteOutput('t1', 'http://localhost:5173/\n');
    store().noteOutput('t1', 'http://localhost:6006/\n');
    store().noteOutput('t1', 'http://localhost:5173/\n');
    expect(store().servers.t1).toEqual(['http://localhost:5173/', 'http://localhost:6006/']);
  });

  it('leaves the state alone for output without addresses', () => {
    const before = store().servers;
    store().noteOutput('t1', 'compiling...\n');
    expect(store().servers).toBe(before);
  });

  it('forgets a terminal once its session ends', () => {
    store().noteOutput('t1', 'http://localhost:5173/\n');
    store().forget('t1');
    expect(store().servers.t1).toBeUndefined();
  });
});

describe('detectedServersFor', () => {
  it('lists the servers of the given terminals, with the terminal that printed each', () => {
    store().noteOutput('t1', 'http://localhost:5173/\n');
    store().noteOutput('t2', 'http://localhost:6006/ http://localhost:5173/\n');
    store().noteOutput('other', 'http://localhost:9999/\n');
    expect(
      detectedServersFor(store().servers, [
        { id: 't1', title: 'pnpm dev' },
        { id: 't2', title: 'storybook' },
      ]),
    ).toEqual([
      { url: 'http://localhost:5173/', terminalId: 't1', terminalTitle: 'pnpm dev' },
      { url: 'http://localhost:6006/', terminalId: 't2', terminalTitle: 'storybook' },
    ]);
  });
});
