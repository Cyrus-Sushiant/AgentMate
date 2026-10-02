import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installAgentmatBridge } from '../../../../test/renderer/agentmatBridge';
import { Backend, FakeSession } from '../../../../test/renderer/mocks/ironRdp';

const mount = vi.hoisted(() => ({
  /** Settles the session's `run()`, ending it. */
  endRun: null as null | ((reason: string) => void),
  session: null as unknown,
  canvas: null as HTMLCanvasElement | null,
}));

vi.mock('@/lib/rdp/ironRdp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rdp/ironRdp')>();
  return {
    ...actual,
    enableCredssp: () => ({}),
    displayControl: () => ({}),
    mountRemoteDesktop: async (
      host: HTMLElement,
      options: { onSession?: (session: unknown) => void } = {},
    ) => {
      const element = document.createElement('div');
      host.appendChild(element);
      const builder = new Proxy(
        {},
        {
          get: (_target, key) => (key === 'build' ? () => ({}) : () => builder),
        },
      );
      const ui = {
        onWarningCallback: () => undefined,
        setEnableClipboard: () => undefined,
        configBuilder: () => builder,
        setVisibility: () => undefined,
        shutdown: () => undefined,
        connect: async () => {
          // The element connects through the wrapped backend, which reports the session.
          options.onSession?.(mount.session);
          return {
            run: () =>
              new Promise((resolve) => {
                mount.endRun = (reason) => resolve({ reason: () => reason });
              }),
          };
        },
      };
      return { element, ui, backend: Backend, canvas: () => mount.canvas };
    },
  };
});

const { useRdpSession } = await import('./useRdpSession');

const ticket = {
  nickname: 'Office PC',
  username: 'me',
  password: 'pw',
  domain: null,
  destination: 'office:3389',
  proxyUrl: 'ws://127.0.0.1/x',
  options: {
    clipboard: false,
    fileTransfer: false,
    nla: true,
    resolution: { width: 1280, height: 720 },
  },
};

beforeEach(() => {
  installAgentmatBridge({ 'rdp.getTicket': ticket });
  mount.session = new FakeSession();
  mount.canvas = document.createElement('canvas');
  mount.endRun = null;
});

function renderSession() {
  const host = document.createElement('div');
  return renderHook(() => useRdpSession('s1', { current: host }));
}

describe('useRdpSession agent targets', () => {
  it('hands out the session, backend and canvas once connected', async () => {
    const { result } = renderSession();
    expect(result.current.agentTargets.getSession()).toBeNull();

    await waitFor(() => expect(result.current.phase.kind).toBe('connected'));
    expect(result.current.agentTargets.getSession()).toBe(mount.session);
    expect(result.current.agentTargets.getBackend()).toBe(Backend);
    expect(result.current.agentTargets.getCanvas()).toBe(mount.canvas);
    expect(result.current.getRemoteElement()).toBeInstanceOf(HTMLElement);
  });

  it('drops the session when the connection ends', async () => {
    const { result } = renderSession();
    await waitFor(() => expect(result.current.phase.kind).toBe('connected'));

    await act(async () => mount.endRun?.('Logged off'));
    await waitFor(() => expect(result.current.phase.kind).toBe('ended'));
    expect(result.current.agentTargets.getSession()).toBeNull();
  });

  it('keeps the same targets object across renders', async () => {
    const { result } = renderSession();
    const first = result.current.agentTargets;
    await waitFor(() => expect(result.current.phase.kind).toBe('connected'));
    expect(result.current.agentTargets).toBe(first);
  });
});
