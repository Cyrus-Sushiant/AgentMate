import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';

/**
 * Keeps a terminal and the program behind it at the same size.
 *
 * A CLI redraws by moving the cursor around a screen it believes has a certain size, and on
 * Windows ConPTY does the same on its behalf, repainting its whole view right after a resize and
 * from then on sending only the cells it thinks changed. Output meant for one size but drawn at
 * another lands in the wrong cells, and because later redraws never touch cells that did not
 * change, the damage stays: letters from old lines in the middle of the screen, half of an older
 * layout left next to the current one.
 *
 * Three things used to cause that. Every ResizeObserver tick of a panel animation or split drag
 * resized the pty, so the repaint for one width kept arriving after xterm had moved on to the
 * next. xterm resized on the spot while output it had received but not parsed yet was still
 * queued, so that output got laid out at the new size. And the pty only heard about a size xterm
 * was already using. Here a resize waits for the layout to hold still, then applies behind the
 * output already queued, to xterm and the pty in the same step.
 */

/** How long the layout has to hold still before a resize goes out. */
const SETTLE_MS = 80;
/** Time for the pty to answer the first half of a forced repaint before the second half. */
const REPAINT_GAP_MS = 150;

export interface ResizeSync {
  /** The layout moved. Resizes once it has held still for a moment. */
  schedule(): void;
  /** Resizes now, still behind the output already queued. */
  flush(): void;
  /**
   * Makes ConPTY repaint the whole screen by growing the terminal a row and shrinking it back.
   * For a terminal painted from a snapshot: ConPTY only sends what changed relative to its own
   * copy of the screen, which knows nothing about the snapshot, so any difference between the
   * two would otherwise stay on screen until the program exits.
   */
  repaint(): void;
  dispose(): void;
}

export interface ResizeSyncOptions {
  term: Terminal;
  fit: FitAddon;
  /** The terminal is open and on screen, so measuring it gives a real size. */
  canFit: () => boolean;
  /** Tells the pty the new size. Does nothing when there is no session to tell yet. */
  resizePty: (cols: number, rows: number) => void;
}

export function createResizeSync({ term, fit, canFit, resizePty }: ResizeSyncOptions): ResizeSync {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  /** Bumped by every request, so a step queued behind older output knows it was overtaken. */
  let generation = 0;

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  /** Runs `step` once xterm has parsed everything written to it so far. */
  const afterQueuedOutput = (step: () => void): void => {
    const mine = ++generation;
    // An empty write lands behind everything already queued, so its callback runs only after
    // the output that was meant for the old size has been drawn at the old size.
    term.write('', () => {
      if (disposed || mine !== generation || !canFit()) return;
      try {
        step();
      } catch {
        // xterm can reject a transient measurement mid-layout; the next observation fixes it
      }
    });
  };

  const apply = (): void => {
    afterQueuedOutput(() => {
      fit.fit();
      resizePty(term.cols, term.rows);
    });
  };

  return {
    schedule(): void {
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        apply();
      }, SETTLE_MS);
    },

    flush(): void {
      clearTimer();
      apply();
    },

    repaint(): void {
      clearTimer();
      afterQueuedOutput(() => {
        fit.fit();
        const { cols, rows } = term;
        // Taller first, never shorter: both sides add a blank row at the bottom and later drop
        // it again, so nothing scrolls. Shrinking first would push the top line out of ConPTY's
        // view while xterm kept it. The extra row sits below the visible area for a moment.
        term.resize(cols, rows + 1);
        resizePty(cols, rows + 1);
        timer = setTimeout(() => {
          timer = null;
          apply();
        }, REPAINT_GAP_MS);
      });
    },

    dispose(): void {
      disposed = true;
      clearTimer();
    },
  };
}
