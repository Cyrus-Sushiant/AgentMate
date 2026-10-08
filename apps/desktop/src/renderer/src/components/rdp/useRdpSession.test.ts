import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type FakeBridge, installAgentmatBridge } from '../../../../test/renderer/agentmatBridge';
import { Backend, FakeSession } from '../../../../test/renderer/mocks/ironRdp';

const mount = vi.hoisted(() => ({
  /** Settles the session's `run()`, ending it. */
  endRun: null as null | ((reason: string) => void),
  session: null as unknown,
  canvas: null as HTMLCanvasElement | null,
  /** Makes the next `connect` fail the way the engine reports a failure. */
  connectError: null as unknown,
  /** Runs inside `connect`, before it settles: where the proxy's own report arrives. */
  beforeConnect: null as null | (() => void),
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
          mount.beforeConnect?.();
          if (mount.connectError) throw mount.connectError;
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

let bridge: FakeBridge;

beforeEach(() => {
  bridge = installAgentmatBridge({ 'rdp.getTicket': ticket });
  mount.connectError = null;
  mount.beforeConnect = null;
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

/** What the engine throws when the RDCleanPath handshake with the proxy fails. */
const rdCleanPathError = {
  kind: () => 4,
  backtrace: () => '',
  rdcleanpathDetails: () => undefined,
};

const keyUsageReport = {
  sessionId: 's1',
  code: 'tls-key-usage',
  message: "The certificate office:3389 presented can't be used to set up an encrypted connection.",
  detail: 'KEY_USAGE_BIT_INCORRECT (SSL routines)',
};

const prompt = {
  sessionId: 's1',
  host: 'office',
  expectedFingerprint: 'OLD',
  actualFingerprint: 'NEW',
  subject: 'CN=office',
  issuer: 'CN=office',
  validTo: 'Jan 1 2027',
};

describe('useRdpSession when the connection fails', () => {
  it('explains a failed secure connection with what the proxy reported', async () => {
    mount.connectError = rdCleanPathError;
    mount.beforeConnect = () => bridge.$emit('rdp.onProxyError', keyUsageReport);

    const { result } = renderSession();
    await waitFor(() => expect(result.current.phase.kind).toBe('failed'));

    expect(result.current.phase).toMatchObject({
      kind: 'failed',
      code: 'tls-key-usage',
      title: "The server's certificate can't be used",
      message: keyUsageReport.message,
      detail: 'KEY_USAGE_BIT_INCORRECT (SSL routines)',
    });
  });

  it('ignores what the proxy reports for another session', async () => {
    mount.connectError = rdCleanPathError;
    mount.beforeConnect = () =>
      bridge.$emit('rdp.onProxyError', { ...keyUsageReport, sessionId: 'someone-else' });

    const { result } = renderSession();
    await waitFor(() => expect(result.current.phase.kind).toBe('failed'));

    expect(result.current.phase).toMatchObject({
      code: 'other',
      message: 'Could not reach the server.',
    });
  });

  it('forgets the last failure when it tries again', async () => {
    mount.connectError = rdCleanPathError;
    mount.beforeConnect = () => bridge.$emit('rdp.onProxyError', keyUsageReport);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.phase.kind).toBe('failed'));

    mount.connectError = null;
    mount.beforeConnect = null;
    act(() => result.current.reconnect());

    await waitFor(() => expect(result.current.phase.kind).toBe('connected'));
  });

  it('lets the certificate prompt be reopened after saying no to it', async () => {
    mount.connectError = rdCleanPathError;
    mount.beforeConnect = () => {
      bridge.$emit('rdp.onCertificatePrompt', prompt);
      bridge.$emit('rdp.onProxyError', {
        sessionId: 's1',
        code: 'certificate-changed',
        message: 'office is presenting a different certificate than the one AgentMate saved.',
      });
    };
    const { result } = renderSession();
    await waitFor(() => expect(result.current.certificate).toEqual(prompt));
    await waitFor(() => expect(result.current.phase.kind).toBe('failed'));
    expect(result.current.phase).toMatchObject({ code: 'certificate-changed' });

    await act(() => result.current.respondCertificate(false));
    expect(result.current.certificate).toBeNull();
    expect(bridge.$fn('rdp.respondCertificate')).toHaveBeenCalledWith('s1', false);

    act(() => result.current.reviewCertificate());
    expect(result.current.certificate).toEqual(prompt);
  });

  it('has nothing to reopen when no certificate was asked about', async () => {
    const { result } = renderSession();
    await waitFor(() => expect(result.current.phase.kind).toBe('connected'));

    act(() => result.current.reviewCertificate());

    expect(result.current.certificate).toBeNull();
  });

  it('connects again with a fresh ticket once the new certificate is trusted', async () => {
    mount.connectError = rdCleanPathError;
    mount.beforeConnect = () => bridge.$emit('rdp.onCertificatePrompt', prompt);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.certificate).toEqual(prompt));

    mount.connectError = null;
    mount.beforeConnect = null;
    await act(() => result.current.respondCertificate(true));

    await waitFor(() => expect(result.current.phase.kind).toBe('connected'));
    expect(bridge.$fn('rdp.respondCertificate')).toHaveBeenCalledWith('s1', true);
    expect(bridge.$fn('rdp.getTicket')).toHaveBeenCalledTimes(2);
  });
});
