import type { IBuffer, IMarker, Terminal } from '@xterm/xterm';
import { cellWidth, rtlRuns, shapeVisualRuns, startsRightToLeft } from '@/lib/terminal/rtlText';

type LineMarker = Pick<IMarker, 'line' | 'isDisposed' | 'dispose'>;

/** The parts of an opened xterm this needs. */
interface RtlTerminal extends Pick<Terminal, 'cols' | 'element' | 'onTitleChange'> {
  readonly buffer: { readonly active: Pick<IBuffer, 'viewportY'> };
  registerMarker(cursorYOffset?: number): LineMarker | undefined;
}

/**
 * Claude Code reorders right-to-left text itself before writing it (for terminals without bidi
 * support, with no way to turn that off), so the lines it writes already hold Persian in display
 * order. Laying them out right to left again would reverse them a second time. It names itself
 * in the window title while it runs, and clears the title when it exits.
 */
const PREORDERED_TITLE = /\bClaude Code\b/;

/** Buffer lines a program that reorders its own text wrote, from `start` up to `end`. */
interface PreorderedLines {
  start: LineMarker;
  /** Unset while the program still runs. */
  end?: LineMarker;
}

/** Marks a laid-out run and holds the width of its cells, so it can be measured again. */
const RUN_WIDTH_ATTRIBUTE = 'data-rtl-run';

/**
 * The box around a run, laid out right to left within the cells the run covers. A run that
 * is already in display order (`preordered`) is laid out left to right instead; see
 * shapePreordered for its text.
 */
function layOutRun(span: HTMLElement, cellPx: number, preordered = false): void {
  const text = span.textContent ?? '';
  const width = Number((cellWidth(text) * cellPx).toFixed(3));
  span.setAttribute(RUN_WIDTH_ATTRIBUTE, String(width));
  const style = span.style;
  // A fixed box the width of the run's cells, in which the browser shapes the text freely.
  style.letterSpacing = '0px';
  style.display = 'inline-block';
  style.overflow = 'hidden';
  style.verticalAlign = 'top';
  // Direction comes from the run's first letter: Persian reads right to left with English
  // words in place, and an English sentence holding a Persian word stays left to right. It is
  // set on the box itself (not left to unicode-bidi: plaintext) so that text too wide for its
  // cells overflows on the side scrollWidth measures, and gets squeezed in fitRuns.
  style.direction = !preordered && startsRightToLeft(text) ? 'rtl' : 'ltr';
  style.setProperty('unicode-bidi', 'isolate');
  style.textAlign = 'start';
}

/**
 * Sizes each run to its cells. A font that draws the run wider than that gets squeezed rather
 * than clipped: the box grows to the text, is scaled back down to the cells, and a negative
 * margin gives the extra layout width back so the cells after it do not move. Every width is
 * read after all the writes, so the page lays out once however many runs there are.
 */
function fitRuns(spans: Iterable<HTMLElement>): void {
  const runs: [HTMLElement, number][] = [];
  for (const span of spans) {
    const width = Number(span.getAttribute(RUN_WIDTH_ATTRIBUTE));
    span.style.width = `${width}px`;
    span.style.removeProperty('margin-right');
    span.style.removeProperty('transform');
    span.style.removeProperty('transform-origin');
    runs.push([span, width]);
  }
  const natural = runs.map(([span]) => span.scrollWidth);
  runs.forEach(([span, width], index) => {
    const full = natural[index];
    if (full <= width + 0.5) return;
    span.style.width = `${full}px`;
    span.style.marginRight = `${Number((width - full).toFixed(3))}px`;
    span.style.transformOrigin = 'left';
    span.style.transform = `scaleX(${Number((width / full).toFixed(3))})`;
  });
}

/**
 * True when two spans are drawn the same way. Their inline styles are compared property by
 * property: a span xterm gave letter spacing lists it before the display set here, one without
 * lists it after, so the style text alone differs for spans that look the same.
 */
function looksAlike(a: HTMLElement, b: HTMLElement): boolean {
  if (a.className !== b.className || a.style.length !== b.style.length) return false;
  for (const property of a.style) {
    if (a.style.getPropertyValue(property) !== b.style.getPropertyValue(property)) return false;
  }
  return true;
}

/**
 * Turns the right-to-left stretches of a run that is already in display order back into reading
 * order (see shapeVisualRuns), so the browser joins their letters without moving them. A box of
 * spans xterm drew letter by letter is first merged back into pieces that look alike, leaving
 * the cursor's span on its own. Each piece can be shaped by itself because shaping never moves
 * text out of the cells it was drawn in.
 */
function shapePreordered(run: HTMLElement): void {
  const pieces = [...run.children].filter((child) => child instanceof HTMLElement);
  if (pieces.length === 0) {
    run.textContent = shapeVisualRuns(run.textContent ?? '');
    return;
  }
  let current: HTMLElement | undefined;
  for (const piece of pieces) {
    if (current !== undefined && looksAlike(current, piece)) {
      current.textContent = (current.textContent ?? '') + (piece.textContent ?? '');
      piece.remove();
    } else {
      current = piece;
    }
  }
  for (const piece of run.children) piece.textContent = shapeVisualRuns(piece.textContent ?? '');
}

/** The row's direct child that holds `node`. */
function rowChild(row: HTMLElement, node: Node): Node {
  let child = node;
  while (child.parentNode && child.parentNode !== row) child = child.parentNode;
  return child;
}

/** A range over characters [start, end) of the row's text, or null when the row is shorter. */
function rangeOverText(row: HTMLElement, start: number, end: number): Range | null {
  const range = document.createRange();
  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startSet = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!startSet && start < offset + length) {
      // Starting at a span's first letter takes the whole span, rather than leaving an empty
      // copy of it (which could be the cursor) behind.
      if (start === offset) range.setStartBefore(rowChild(row, node));
      else range.setStart(node, start - offset);
      startSet = true;
    }
    if (startSet && end <= offset + length) {
      if (end === offset + length) range.setEndAfter(rowChild(row, node));
      else range.setEnd(node, end - offset);
      return range;
    }
    offset += length;
  }
  return null;
}

/**
 * Wraps each right-to-left run of the row (see rtlRuns) in one box and lays it out. xterm draws
 * a row as many spans: one wherever the color changes, and often one per Persian letter, each an
 * inline block with its own letter spacing, which the browser can neither join letters across
 * nor reorder. Inside the box those spans become plain text again, so a sentence whose words and
 * numbers a program colored apart still reads as one sentence, and the cursor's span lands on
 * its letter.
 */
function wrapRuns(row: HTMLElement, cellPx: number, preordered: boolean): HTMLElement[] {
  const boxes: HTMLElement[] = [];
  // Last run first: shaping a preordered run adds characters, which would shift the offsets of
  // any run after it.
  for (const [start, end] of rtlRuns(row.textContent ?? '').reverse()) {
    const range = rangeOverText(row, start, end);
    if (!range) continue;
    const box = document.createElement('span');
    box.appendChild(range.extractContents());
    range.insertNode(box);
    for (const span of box.querySelectorAll('span')) {
      span.style.display = 'inline';
      span.style.letterSpacing = '0px';
    }
    layOutRun(box, cellPx, preordered);
    if (preordered) shapePreordered(box);
    boxes.push(box);
  }
  return boxes;
}

/** The width of one cell in the row, from the row's own width, or NaN before it has one. */
function cellPxOf(row: HTMLElement | null, cols: number): number {
  const rowPx = row ? Number.parseFloat(row.style.width) : Number.NaN;
  return rowPx > 0 && cols > 0 ? rowPx / cols : Number.NaN;
}

/**
 * Draws Persian, Arabic and Hebrew in the terminal the way they are read: letters joined,
 * words right to left, English words and numbers in their places, and every column after the
 * text still lined up. xterm has no bidi support of its own, so each right-to-left run in a row
 * is gathered into one box that the browser lays out.
 * The buffer is untouched, so copying, searching and what the program sees stay as typed.
 *
 * Call once the terminal is open. Returns a cleanup.
 */
export function attachRtlRendering(term: RtlTerminal): () => void {
  const rows = term.element?.querySelector<HTMLElement>('.xterm-rows');

  const preordered: PreorderedLines[] = [];
  const titleListener = term.onTitleChange((title) => {
    const open = preordered.at(-1);
    const running = open !== undefined && open.end === undefined;
    if (PREORDERED_TITLE.test(title) === running) return;
    const marker = term.registerMarker(0);
    if (!marker) return;
    if (running) open.end = marker;
    else preordered.push({ start: marker });
  });
  const isPreordered = (line: number): boolean => {
    for (let index = preordered.length - 1; index >= 0; index--) {
      const { start, end } = preordered[index];
      // Lines that scrolled out of the buffer take their markers with them.
      if (end?.isDisposed) {
        start.dispose();
        preordered.splice(index, 1);
        continue;
      }
      const from = start.isDisposed ? 0 : start.line;
      if (line >= from && (end === undefined || line < end.line)) return true;
    }
    return false;
  };

  // xterm renders a row by replacing its spans, and on a resize by rebuilding the rows, both
  // through the DOM. Watching the DOM, rather than the render event, also catches the rows it
  // redraws for a hovered link. Mutation callbacks run before the frame is painted.
  const observer = new MutationObserver((records) => {
    if (!rows) return;
    const touched = new Set<HTMLElement>();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const row: HTMLElement | null = node.parentElement === rows ? node : node.parentElement;
        if (row?.parentElement === rows) touched.add(row);
      }
    }
    const laidOut: HTMLElement[] = [];
    for (const row of touched) {
      // xterm replaces a row's spans whenever it draws it, so a row that already has a box is
      // one this has handled since.
      if (row.querySelector(`[${RUN_WIDTH_ATTRIBUTE}]`)) continue;
      const cellPx = cellPxOf(row, term.cols);
      if (Number.isNaN(cellPx)) continue;
      const line = term.buffer.active.viewportY + Array.prototype.indexOf.call(rows.children, row);
      laidOut.push(...wrapRuns(row, cellPx, isPreordered(line)));
    }
    fitRuns(laidOut);
    // The wrapping above is a DOM change of its own; nothing in it needs handling again.
    observer.takeRecords();
  });
  if (rows) observer.observe(rows, { childList: true, subtree: true });

  // Vazirmatn loads the first time Persian is drawn, after the run was measured in a fallback
  // face, and xterm does not redraw when it lands.
  const fonts = document.fonts;
  const refit = (): void => {
    if (rows) fitRuns(rows.querySelectorAll<HTMLElement>(`[${RUN_WIDTH_ATTRIBUTE}]`));
  };
  fonts?.addEventListener('loadingdone', refit);

  return () => {
    observer.disconnect();
    titleListener.dispose();
    for (const { start, end } of preordered) {
      start.dispose();
      end?.dispose();
    }
    fonts?.removeEventListener('loadingdone', refit);
  };
}
