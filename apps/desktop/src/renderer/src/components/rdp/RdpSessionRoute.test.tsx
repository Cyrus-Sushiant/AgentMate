import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRdpAgentStore } from '@/stores/rdpAgentStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import type { RdpPhase } from './useRdpSession';

const hook = vi.hoisted(() => ({ phase: { kind: 'connecting' } as RdpPhase }));

vi.mock('./useRdpSession', () => ({
  useRdpSession: () => ({
    phase: hook.phase,
    nickname: 'Office PC',
    options: null,
    certificate: null,
    remoteFiles: [],
    transfers: [],
    notice: null,
    scale: 'fit',
    reconnect: vi.fn(),
    dismissNotice: vi.fn(),
    clearFinishedTransfers: vi.fn(),
    respondCertificate: vi.fn(),
    setScale: vi.fn(),
    ctrlAltDel: vi.fn(),
    focusRemote: vi.fn(),
    agentTargets: { getSession: () => null, getBackend: () => null, getCanvas: () => null },
    getRemoteElement: () => null,
    pickAndSendFiles: vi.fn(),
    dropFiles: vi.fn(),
    saveRemoteFiles: vi.fn(),
  }),
}));

const { default: RdpSessionRoute } = await import('./RdpSessionRoute');

const bridge = {
  'rdpWindow.getState': { isMaximized: false, isFullScreen: false },
  'cli.detectAll': [{ id: 'claude-code', installed: true }],
};

function renderRoute() {
  return renderWithProviders(<RdpSessionRoute />, { route: '/?session=s1', bridge });
}

beforeEach(() => {
  hook.phase = { kind: 'connecting' };
});

describe('RdpSessionRoute Ask AI', () => {
  it('keeps Ask AI off until the session is connected', () => {
    renderRoute();
    expect(screen.getByRole('button', { name: /Ask AI/ })).toBeDisabled();
  });

  it('opens the Ask AI dialog once connected', async () => {
    hook.phase = { kind: 'connected' };
    const { user } = renderRoute();
    await user.click(screen.getByRole('button', { name: /Ask AI/ }));
    expect(
      await screen.findByRole('dialog', { name: /Ask AI to do something on this desktop/ }),
    ).toBeInTheDocument();
  });

  it('answers the AI task for this session', () => {
    const { bridge: fake } = renderRoute();
    expect(fake.$listenerCount('rdpAgent.onRequest')).toBe(1);
    expect(fake.$listenerCount('rdpAgent.onProgress')).toBe(1);
  });

  it('shows the status bar and the overlay while a task runs, and the history from it', async () => {
    hook.phase = { kind: 'connected' };
    useRdpAgentStore.setState({
      sessions: { s1: { mode: 'autonomous', phase: 'acting', step: 2, action: 'CLICK 1 2' } },
    });
    const { user, bridge: fake } = renderRoute();
    expect(screen.getByText('CLICK 1 2')).toBeInTheDocument();
    expect(screen.getByTestId('rdp-agent-overlay')).toBeInTheDocument();

    fake.$set('rdpAgent.history', []);
    await user.click(screen.getByRole('button', { name: /History/ }));
    expect(await screen.findByText('AI task history')).toBeInTheDocument();
    await waitFor(() => expect(fake.$fn('rdpAgent.history')).toHaveBeenCalledWith('s1'));
  });
});
