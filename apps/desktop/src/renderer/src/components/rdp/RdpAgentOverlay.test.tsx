import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type RdpAgentSessionState, useRdpAgentStore } from '@/stores/rdpAgentStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { RdpAgentOverlay } from './RdpAgentOverlay';

function setRun(state: Partial<RdpAgentSessionState> | null): void {
  useRdpAgentStore.setState({
    sessions: state ? { s1: { mode: 'autonomous', phase: 'acting', step: 1, ...state } } : {},
  });
}

function renderOverlay(remote: HTMLElement | null = null) {
  const parentPointer = vi.fn();
  const parentKey = vi.fn();
  const view = renderWithProviders(
    <div onPointerDown={parentPointer} onKeyDown={parentKey}>
      <RdpAgentOverlay sessionId="s1" getRemoteElement={() => remote} />
    </div>,
  );
  return { ...view, parentPointer, parentKey };
}

describe('RdpAgentOverlay', () => {
  it('is not there without a running task', () => {
    setRun(null);
    renderOverlay();
    expect(screen.queryByTestId('rdp-agent-overlay')).not.toBeInTheDocument();
  });

  it.each(['finished', 'stopped'] as const)('goes away once the run is %s', (phase) => {
    setRun({ phase });
    renderOverlay();
    expect(screen.queryByTestId('rdp-agent-overlay')).not.toBeInTheDocument();
  });

  it('goes away after an error that ended the run', () => {
    setRun({ phase: 'error' });
    renderOverlay();
    expect(screen.queryByTestId('rdp-agent-overlay')).not.toBeInTheDocument();
  });

  it('keeps the user from reaching the remote desktop during a run', () => {
    setRun({ phase: 'thinking' });
    const { parentPointer, parentKey } = renderOverlay();
    const overlay = screen.getByTestId('rdp-agent-overlay');

    fireEvent.pointerDown(overlay);
    fireEvent.keyDown(overlay, { key: 'a' });
    expect(parentPointer).not.toHaveBeenCalled();
    expect(parentKey).not.toHaveBeenCalled();

    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    overlay.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
  });

  it('takes keyboard focus away from the remote desktop, and keeps it away', () => {
    const remote = document.createElement('div');
    remote.tabIndex = 0;
    document.body.appendChild(remote);
    remote.focus();
    expect(document.activeElement).toBe(remote);

    setRun({ phase: 'acting' });
    renderOverlay(remote);
    expect(document.activeElement).not.toBe(remote);

    // A toolbar button handing focus back to the screen mid-run doesn't get through.
    act(() => remote.focus());
    expect(document.activeElement).not.toBe(remote);
    remote.remove();
  });

  it('stops the run on Take over', async () => {
    setRun({ phase: 'acting' });
    const { user, bridge } = renderOverlay();
    await user.click(screen.getByRole('button', { name: /Take over/ }));
    expect(bridge.$fn('rdpAgent.stop')).toHaveBeenCalledWith('s1');
  });

  it('marks where a proposed click would land', () => {
    setRun({ phase: 'proposed', action: 'CLICK 320 540', target: { x: 0.25, y: 0.5 } });
    renderOverlay();
    const marker = screen.getByTestId('rdp-agent-target');
    expect(marker.style.left).toBe('25%');
    expect(marker.style.top).toBe('50%');
  });

  it('shows no marker for an action without a target', () => {
    setRun({ phase: 'proposed', action: 'KEY ctrl+s' });
    renderOverlay();
    expect(screen.getByTestId('rdp-agent-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('rdp-agent-target')).not.toBeInTheDocument();
  });
});
