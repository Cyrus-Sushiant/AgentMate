import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResizeSync } from './resizeSync';

const SETTLE_MS = 80;
const REPAINT_GAP_MS = 150;

/**
 * A terminal that holds the callbacks of the empty writes the module uses as a marker, so a
 * test can decide when the output queued before a resize is considered drawn.
 */
function fakeTerm() {
  const queued: (() => void)[] = [];
  const term = {
    cols: 80,
    rows: 24,
    write: vi.fn((_data: string, callback?: () => void) => {
      if (callback) queued.push(callback);
    }),
    resize: vi.fn((cols: number, rows: number) => {
      term.cols = cols;
      term.rows = rows;
    }),
  };
  /** Lets xterm finish parsing, which is what runs the queued step. */
  const drain = (): void => {
    const pending = queued.splice(0, queued.length);
    for (const callback of pending) callback();
  };
  return { term, queued, drain };
}

function setup(options: { canFit?: () => boolean; fit?: () => void } = {}) {
  const { term, queued, drain } = fakeTerm();
  const fitFn = vi.fn(options.fit ?? (() => undefined));
  const fit = { fit: fitFn } as unknown as FitAddon;
  const resizePty = vi.fn();
  const sync = createResizeSync({
    term: term as unknown as Terminal,
    fit,
    canFit: options.canFit ?? (() => true),
    resizePty,
  });
  return { sync, term, fitFn, resizePty, queued, drain };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('schedule', () => {
  it('waits for the layout to hold still before resizing', () => {
    const { sync, resizePty, drain } = setup();
    sync.schedule();
    vi.advanceTimersByTime(SETTLE_MS - 1);
    drain();
    expect(resizePty).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    drain();
    expect(resizePty).toHaveBeenCalledWith(80, 24);
  });

  it('resizes once for a whole split drag, not once per frame', () => {
    // Every observer tick used to resize the pty, so the repaint for one width kept arriving
    // after xterm had already moved on to the next.
    const { sync, fitFn, resizePty, drain } = setup();
    for (let i = 0; i < 20; i++) {
      sync.schedule();
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(SETTLE_MS);
    drain();
    expect(fitFn).toHaveBeenCalledTimes(1);
    expect(resizePty).toHaveBeenCalledTimes(1);
  });
});

describe('flush', () => {
  it('resizes right away, behind the output already queued', () => {
    const { sync, term, fitFn, resizePty, drain } = setup();
    sync.flush();
    // The empty write is the marker that lands behind everything already written.
    expect(term.write).toHaveBeenCalledWith('', expect.any(Function));
    expect(fitFn).not.toHaveBeenCalled();
    drain();
    expect(fitFn).toHaveBeenCalledTimes(1);
    expect(resizePty).toHaveBeenCalledWith(80, 24);
  });

  it('cancels a resize that was still settling', () => {
    const { sync, fitFn, drain } = setup();
    sync.schedule();
    sync.flush();
    drain();
    vi.advanceTimersByTime(SETTLE_MS * 2);
    drain();
    expect(fitFn).toHaveBeenCalledTimes(1);
  });

  it('lets a newer request overtake one still waiting behind old output', () => {
    // The step queued behind the old output was meant for a size that no longer applies.
    const { sync, fitFn, drain } = setup();
    sync.flush();
    sync.flush();
    drain();
    expect(fitFn).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the terminal cannot be measured', () => {
    // Off screen or not opened yet, measuring gives a size the grid must not be built from.
    const { sync, fitFn, resizePty, drain } = setup({ canFit: () => false });
    sync.flush();
    drain();
    expect(fitFn).not.toHaveBeenCalled();
    expect(resizePty).not.toHaveBeenCalled();
  });

  it('survives a measurement xterm rejects mid-layout', () => {
    const { sync, resizePty, drain } = setup({
      fit: () => {
        throw new Error('no dimensions');
      },
    });
    sync.flush();
    expect(() => drain()).not.toThrow();
    expect(resizePty).not.toHaveBeenCalled();
  });

  it('tells the pty the size xterm ended up with, not the one it was asked for', () => {
    const { sync, term, resizePty, drain } = setup({
      fit: () => {
        term.cols = 120;
        term.rows = 30;
      },
    });
    sync.flush();
    drain();
    expect(resizePty).toHaveBeenCalledWith(120, 30);
  });
});

describe('repaint', () => {
  it('grows the terminal a row and shrinks it back, so ConPTY redraws everything', () => {
    // ConPTY only sends what changed against its own copy of the screen, which knows nothing
    // about a snapshot painted into xterm.
    const { sync, term, resizePty, drain } = setup();
    sync.repaint();
    drain();
    expect(term.resize).toHaveBeenCalledWith(80, 25);
    expect(resizePty).toHaveBeenCalledWith(80, 25);

    vi.advanceTimersByTime(REPAINT_GAP_MS);
    drain();
    expect(resizePty).toHaveBeenLastCalledWith(80, 25);
    expect(resizePty).toHaveBeenCalledTimes(2);
  });

  it('never shrinks first, which would push the top line out of ConPTY is view', () => {
    const { sync, term, drain } = setup();
    sync.repaint();
    drain();
    const heights = term.resize.mock.calls.map((call) => call[1]);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
  });

  it('gives the pty time to answer the first half before the second', () => {
    const { sync, resizePty, drain } = setup();
    sync.repaint();
    drain();
    vi.advanceTimersByTime(REPAINT_GAP_MS - 1);
    drain();
    expect(resizePty).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    drain();
    expect(resizePty).toHaveBeenCalledTimes(2);
  });
});

describe('dispose', () => {
  it('drops a resize that had not gone out yet', () => {
    const { sync, fitFn, resizePty, drain } = setup();
    sync.schedule();
    sync.dispose();
    vi.advanceTimersByTime(SETTLE_MS * 2);
    drain();
    expect(fitFn).not.toHaveBeenCalled();
    expect(resizePty).not.toHaveBeenCalled();
  });

  it('drops a step already queued behind output', () => {
    const { sync, fitFn, drain } = setup();
    sync.flush();
    sync.dispose();
    drain();
    expect(fitFn).not.toHaveBeenCalled();
  });
});
