import { describe, expect, it } from 'vitest';
import { parseHostMessage, parseMainMessage } from './hostProtocol';

/**
 * Messages cross a process boundary, so each side checks what it receives before acting on it.
 * A malformed message is dropped rather than trusted.
 */

const input = {
  collection: { info: { name: 'x', schema: 's' }, item: [] },
  options: {
    timeoutMs: 1000,
    strictSSL: true,
    followRedirects: true,
    maxInlineBodyBytes: 10,
    scriptsEnabled: false,
    proxy: null,
  },
};

describe('parseMainMessage', () => {
  it('accepts run and cancel', () => {
    expect(parseMainMessage({ type: 'run', runId: 'r1', input })).toEqual({
      type: 'run',
      runId: 'r1',
      input,
    });
    expect(parseMainMessage({ type: 'cancel', runId: 'r1' })).toEqual({
      type: 'cancel',
      runId: 'r1',
    });
  });

  it('rejects anything else', () => {
    expect(parseMainMessage(null)).toBeNull();
    expect(parseMainMessage('run')).toBeNull();
    expect(parseMainMessage({ type: 'run', runId: 'r1' })).toBeNull();
    expect(parseMainMessage({ type: 'run', runId: '', input })).toBeNull();
    expect(parseMainMessage({ type: 'run', runId: 'r', input: { collection: {} } })).toBeNull();
    expect(parseMainMessage({ type: 'exec', runId: 'r1' })).toBeNull();
  });
});

describe('parseHostMessage', () => {
  it('accepts ready, event, done and fatal', () => {
    expect(parseHostMessage({ type: 'ready', runtimeVersion: '7.56.1' })).toEqual({
      type: 'ready',
      runtimeVersion: '7.56.1',
    });
    const event = { type: 'console', itemId: null, level: 'log', messages: ['a'] };
    expect(parseHostMessage({ type: 'event', runId: 'r', event })).toEqual({
      type: 'event',
      runId: 'r',
      event,
    });
    const summary = {
      error: null,
      cancelled: false,
      environment: [],
      globals: [],
      collectionVariables: [],
    };
    expect(parseHostMessage({ type: 'done', runId: 'r', summary })).toEqual({
      type: 'done',
      runId: 'r',
      summary,
    });
    expect(parseHostMessage({ type: 'fatal', error: 'boom' })).toEqual({
      type: 'fatal',
      error: 'boom',
    });
  });

  it('rejects events and summaries of the wrong shape', () => {
    expect(parseHostMessage({ type: 'event', runId: 'r', event: { type: 'nope' } })).toBeNull();
    expect(parseHostMessage({ type: 'event', runId: 'r' })).toBeNull();
    expect(parseHostMessage({ type: 'done', runId: 'r', summary: { error: 1 } })).toBeNull();
    expect(parseHostMessage({ type: 'ready' })).toBeNull();
    expect(parseHostMessage(42)).toBeNull();
  });
});
