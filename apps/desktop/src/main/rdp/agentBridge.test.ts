import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RdpAgentFrame, RdpAgentRequest, RdpInputOp } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { FakeBrowserWindow, fakeWebContents } from '../../test/main/electronMock';
import { invokeFrom } from '../../test/main/ipcHarness';
import {
  dropRdpAgentRequests,
  registerRdpAgentBridgeHandlers,
  requestRdpFrame,
  requestRdpInput,
} from './agentBridge';

const windows = vi.hoisted(() => new Map<string, unknown>());

vi.mock('./sessionWindows', () => ({
  getRdpWindow: (sessionId: string) => windows.get(sessionId) ?? null,
}));

const FRAME: RdpAgentFrame = {
  png: 'iVBORw0KGgo=',
  width: 1280,
  height: 720,
  desktopWidth: 2560,
  desktopHeight: 1440,
};

function openWindow(sessionId: string): FakeBrowserWindow {
  const window = new FakeBrowserWindow();
  windows.set(sessionId, window);
  return window;
}

function requestsTo(window: FakeBrowserWindow): RdpAgentRequest[] {
  return window.webContents
    .sentOn(IPC.rdpAgent.onRequest)
    .map(([request]) => request as RdpAgentRequest);
}

beforeEach(() => {
  registerRdpAgentBridgeHandlers();
});

afterEach(() => {
  for (const sessionId of windows.keys()) dropRdpAgentRequests(sessionId);
  windows.clear();
});

describe('asking a Remote Desktop window for a screenshot', () => {
  it('sends a frame request to the session window and resolves with its answer', async () => {
    const window = openWindow('rdp-1');
    const frame = requestRdpFrame('rdp-1');

    const [request] = requestsTo(window);
    expect(request).toMatchObject({ sessionId: 'rdp-1', kind: 'frame', maxWidth: 1280 });

    const settled = await invokeFrom(window.webContents, IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: true,
      frame: FRAME,
    });
    expect(settled).toBe(true);
    await expect(frame).resolves.toEqual(FRAME);
  });

  it('passes a smaller maximum width on', () => {
    const window = openWindow('rdp-1');
    void requestRdpFrame('rdp-1', 800).catch(() => undefined);
    expect(requestsTo(window)[0]).toMatchObject({ maxWidth: 800 });
  });

  it('rejects at once when the window is gone', async () => {
    await expect(requestRdpFrame('nowhere')).rejects.toThrow(
      'The Remote Desktop window is closed.',
    );
  });

  it('gives up after 10 seconds without an answer', async () => {
    vi.useFakeTimers();
    openWindow('rdp-1');
    const frame = requestRdpFrame('rdp-1').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(9_999);
    await vi.advanceTimersByTimeAsync(1);
    expect(await frame).toBeInstanceOf(Error);
  });

  it('rejects with the error the window reports', async () => {
    const window = openWindow('rdp-1');
    const frame = requestRdpFrame('rdp-1');
    const [request] = requestsTo(window);
    await invokeFrom(window.webContents, IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: false,
      error: 'The session is not connected.',
    });
    await expect(frame).rejects.toThrow('The session is not connected.');
  });

  it('ignores an answer from a window other than the session one', async () => {
    const window = openWindow('rdp-1');
    const other = openWindow('rdp-2');
    const frame = requestRdpFrame('rdp-1');
    const [request] = requestsTo(window);

    const fromOther = await invokeFrom(other.webContents, IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: true,
      frame: { ...FRAME, png: 'forged' },
    });
    expect(fromOther).toBe(false);
    const fromStranger = await invokeFrom(fakeWebContents(), IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: true,
      frame: { ...FRAME, png: 'forged' },
    });
    expect(fromStranger).toBe(false);

    await invokeFrom(window.webContents, IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: true,
      frame: FRAME,
    });
    await expect(frame).resolves.toEqual(FRAME);
  });

  it('rejects a successful answer that carries no screenshot', async () => {
    const window = openWindow('rdp-1');
    const frame = requestRdpFrame('rdp-1');
    const [request] = requestsTo(window);
    await invokeFrom(window.webContents, IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: true,
    });
    await expect(frame).rejects.toThrow(/no screenshot/);
  });

  it('answers false for a request it never sent', async () => {
    const window = openWindow('rdp-1');
    const settled = await invokeFrom(window.webContents, IPC.rdpAgent.respond, {
      requestId: 'made-up',
      ok: true,
    });
    expect(settled).toBe(false);
  });
});

describe('sending input to a Remote Desktop window', () => {
  const ops: RdpInputOp[] = [
    { kind: 'move', x: 10, y: 20 },
    { kind: 'button', button: 0, down: true },
    { kind: 'button', button: 0, down: false },
  ];

  it('sends the ops and resolves once the window has applied them', async () => {
    const window = openWindow('rdp-1');
    const applied = requestRdpInput('rdp-1', ops);
    const [request] = requestsTo(window);
    expect(request).toMatchObject({ sessionId: 'rdp-1', kind: 'input', ops });

    await invokeFrom(window.webContents, IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: true,
    });
    await expect(applied).resolves.toBeUndefined();
  });

  it('waits 5 seconds plus every pause in the ops', async () => {
    vi.useFakeTimers();
    openWindow('rdp-1');
    let failed = false;
    void requestRdpInput('rdp-1', [
      { kind: 'pause', ms: 1000 },
      { kind: 'move', x: 1, y: 1 },
      { kind: 'pause', ms: 500 },
    ]).catch(() => {
      failed = true;
    });
    await vi.advanceTimersByTimeAsync(6_499);
    expect(failed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(failed).toBe(true);
  });

  it('dropping a session fails its pending requests and leaves the others', async () => {
    const window = openWindow('rdp-1');
    const second = openWindow('rdp-2');
    const first = requestRdpInput('rdp-1', ops).catch((error: Error) => error);
    const other = requestRdpInput('rdp-2', ops);

    dropRdpAgentRequests('rdp-1');
    expect(((await first) as Error).message).toBe('The Remote Desktop window is closed.');
    expect(requestsTo(window)).toHaveLength(1);

    const [request] = requestsTo(second);
    await invokeFrom(second.webContents, IPC.rdpAgent.respond, {
      requestId: request?.requestId,
      ok: true,
    });
    await expect(other).resolves.toBeUndefined();
  });
});
