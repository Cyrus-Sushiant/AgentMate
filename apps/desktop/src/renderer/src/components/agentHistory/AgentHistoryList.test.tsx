// @vitest-environment jsdom
import type { AgentHistorySession } from '@agentmat/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { installAgentmatBridge } from '../../../../test/renderer/agentmatBridge';
import {
  BackgroundToggle,
  HistoryDayGroups,
  HistoryRow,
  HistorySkeleton,
  HistoryToolbar,
} from './AgentHistoryList';

function session(overrides: Partial<AgentHistorySession> = {}): AgentHistorySession {
  return {
    provider: 'claude-code',
    id: 'aaaaaaaa-0001',
    title: null,
    firstPrompt: null,
    lastPrompt: null,
    cwd: '/home/ubuntu/app',
    gitBranch: null,
    model: null,
    effort: null,
    startedAt: null,
    updatedAt: Date.now() - 60_000,
    sizeBytes: 100,
    background: false,
    ...overrides,
  };
}

function renderUi(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

beforeEach(() => {
  installAgentmatBridge({ platform: 'linux' });
});

afterEach(cleanup);

describe('HistoryRow', () => {
  it('heads the row with the title, then the first prompt, then a fallback', () => {
    const { rerender } = renderUi(
      <HistoryRow session={session({ title: 'Named', firstPrompt: 'asked' })} onResume={vi.fn()} />,
    );
    expect(screen.getByText('Named')).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <HistoryRow session={session({ firstPrompt: 'asked first' })} onResume={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.getByText('asked first')).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <HistoryRow session={session()} onResume={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.getByText('Untitled conversation')).toBeInTheDocument();
  });

  it('shows the branch and the model the run used', () => {
    renderUi(
      <HistoryRow
        session={session({ gitBranch: 'feature/x', model: 'gpt-5-codex', effort: 'high' })}
        onResume={vi.fn()}
      />,
    );
    expect(screen.getByText('feature/x')).toBeInTheDocument();
    expect(screen.getByText(/GPT-5-codex · high effort/)).toBeInTheDocument();
  });

  it('marks a conversation already open in a tab and drops the resume button', () => {
    renderUi(<HistoryRow session={session()} openTabId="tab-1" onResume={vi.fn()} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume in a new tab' })).not.toBeInTheDocument();
  });

  it('resumes from a click on the row or on the play button', () => {
    const onResume = vi.fn();
    const s = session({ title: 'Resume me' });
    renderUi(<HistoryRow session={s} onResume={onResume} />);

    fireEvent.click(screen.getByText('Resume me'));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenLastCalledWith(s);

    fireEvent.click(screen.getByRole('button', { name: 'Resume in a new tab' }));
    expect(onResume).toHaveBeenCalledTimes(2);
  });

  it('with a reason to hold off, disables play and ignores clicks on the row', () => {
    const onResume = vi.fn();
    renderUi(
      <HistoryRow
        session={session({ title: 'Remote one' })}
        onResume={onResume}
        resumeDisabledReason="Connect to the server first"
      />,
    );
    const play = screen.getByRole('button', { name: 'Resume in a new tab' });
    expect(play).toBeDisabled();
    fireEvent.click(play);
    fireEvent.click(screen.getByText('Remote one'));
    expect(onResume).not.toHaveBeenCalled();
    expect(screen.getByText('Remote one').closest('button')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('copies the conversation id', () => {
    renderUi(<HistoryRow session={session({ id: 'copy-me-123' })} onResume={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy conversation id' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy-me-123');
  });
});

describe('HistoryToolbar', () => {
  function renderToolbar(providers: AgentHistorySession['provider'][]) {
    const handlers = { onQueryChange: vi.fn(), onProviderChange: vi.fn() };
    renderUi(
      <HistoryToolbar
        query=""
        provider="all"
        providers={new Set(providers)}
        onQueryChange={handlers.onQueryChange}
        onProviderChange={handlers.onProviderChange}
      />,
    );
    return handlers;
  }

  it('offers the agent filter only when there is more than one agent', () => {
    renderToolbar(['claude-code']);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    cleanup();

    const handlers = renderToolbar(['claude-code', 'codex']);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'All',
      'Claude',
      'Codex',
    ]);
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }));
    expect(handlers.onProviderChange).toHaveBeenCalledWith('codex');
  });

  it('reports typing in the search box', () => {
    const handlers = renderToolbar(['claude-code']);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search conversations' }), {
      target: { value: 'login' },
    });
    expect(handlers.onQueryChange).toHaveBeenCalledWith('login');
  });
});

describe('HistoryDayGroups', () => {
  it('groups rows under day headers and passes open tabs and reasons through', () => {
    const today = session({ id: 'today-0001', title: 'From today', updatedAt: Date.now() });
    const old = session({
      id: 'older-0001',
      title: 'From long ago',
      updatedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    });
    const onResume = vi.fn();
    renderUi(
      <HistoryDayGroups
        sessions={[today, old]}
        openIds={new Map([['today-0001', 'tab-9']])}
        onResume={onResume}
        resumeDisabledReason={(s) => (s.id === 'older-0001' ? 'Offline' : null)}
      />,
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Older')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume in a new tab' })).toBeDisabled();

    fireEvent.click(screen.getByText('From today'));
    expect(onResume).toHaveBeenCalledWith(today);
    fireEvent.click(screen.getByText('From long ago'));
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});

describe('BackgroundToggle', () => {
  it('names how many tool runs are hidden, and hides itself when there are none', () => {
    const onToggle = vi.fn();
    const { rerender, container } = renderUi(
      <BackgroundToggle count={3} shown={false} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 runs started by tools' }));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(
      <TooltipProvider>
        <BackgroundToggle count={1} shown={false} onToggle={onToggle} />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Show 1 run started by tools' })).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <BackgroundToggle count={1} shown onToggle={onToggle} />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Hide runs started by tools' })).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <BackgroundToggle count={0} shown={false} onToggle={onToggle} />
      </TooltipProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('HistorySkeleton', () => {
  it('draws the requested number of placeholder rows', () => {
    const { container } = renderUi(<HistorySkeleton rows={3} />);
    expect(container.querySelectorAll('.shimmer')).toHaveLength(9);
  });
});
