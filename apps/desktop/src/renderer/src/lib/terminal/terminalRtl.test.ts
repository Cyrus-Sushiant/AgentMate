import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachRtlRendering } from './terminalRtl';

interface FakeMarker {
  line: number;
  isDisposed: boolean;
  dispose: () => void;
}

/** Just enough of an opened xterm: its DOM rows, titles and markers. */
function fakeTerminal(cols = 100, rowWidth = 762) {
  const element = document.createElement('div');
  const rows = document.createElement('div');
  rows.className = 'xterm-rows';
  element.appendChild(rows);
  document.body.appendChild(element);
  const titleListeners = new Set<(title: string) => void>();
  const buffer = { active: { viewportY: 0, baseY: 0, cursorY: 0 } };
  const term = {
    cols,
    element,
    buffer,
    onTitleChange: vi.fn((listener: (title: string) => void) => {
      titleListeners.add(listener);
      return { dispose: () => titleListeners.delete(listener) };
    }),
    registerMarker: vi.fn((offset = 0): FakeMarker => {
      const marker: FakeMarker = {
        line: buffer.active.baseY + buffer.active.cursorY + offset,
        isDisposed: false,
        dispose: () => {
          marker.isDisposed = true;
          marker.line = -1;
        },
      };
      return marker;
    }),
  };

  /**
   * What xterm does for one row: replace its spans, one per piece. xterm starts a new span
   * wherever the color changes, and for every cell whose letter is narrower or wider than the
   * cell (most Persian letters), each with its own letter spacing.
   */
  function renderRow(index: number, pieces: string[], cursorAt = -1): HTMLSpanElement[] {
    let row = rows.children[index] as HTMLDivElement | undefined;
    while (!row) {
      const created = document.createElement('div');
      created.style.width = `${rowWidth}px`;
      rows.appendChild(created);
      row = rows.children[index] as HTMLDivElement | undefined;
    }
    const spans = pieces.map((piece, pieceIndex) => {
      const span = document.createElement('span');
      span.textContent = piece;
      // A space fits its cell, so xterm gives it no letter spacing of its own.
      if (piece.trim()) span.style.letterSpacing = '3.2px';
      if (pieceIndex === cursorAt) span.className = 'xterm-cursor';
      return span;
    });
    row.replaceChildren(...spans);
    return spans;
  }

  /** The running program sets the window title, as Claude Code does. */
  function setTitle(title: string): void {
    for (const listener of titleListeners) listener(title);
  }

  /** The right-to-left boxes laid out in a row. */
  function runsIn(index: number): HTMLElement[] {
    return [...(rows.children[index]?.querySelectorAll<HTMLElement>('[data-rtl-run]') ?? [])];
  }

  return { term, renderRow, runsIn, element, buffer, setTitle };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Makes laid-out runs report `width()` as the width their text is drawn at. */
function fakeNaturalWidth(width: () => number): () => void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-rtl-run') ? width() : 0;
    },
  });
  return () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', original);
  };
}

describe('attachRtlRendering', () => {
  let fake: ReturnType<typeof fakeTerminal>;

  beforeEach(() => {
    fake = fakeTerminal();
  });

  afterEach(() => {
    fake.element.remove();
  });

  it('lays a run out right to left across exactly the cells it covers', async () => {
    const dispose = attachRtlRendering(fake.term);
    const [prompt, text] = fake.renderRow(0, ['> ', 'سلام hello دنیا']);
    await flush();

    const [run] = fake.runsIn(0);
    expect(fake.runsIn(0)).toHaveLength(1);
    expect(run.textContent).toBe('سلام hello دنیا');
    // 762px over 100 columns is 7.62px a cell, and the run covers 15 cells.
    expect(run.style.width).toBe('114.3px');
    expect(run.style.display).toBe('inline-block');
    expect(run.style.letterSpacing).toBe('0px');
    expect(run.style.direction).toBe('rtl');
    expect(run.style.getPropertyValue('unicode-bidi')).toBe('isolate');
    expect(run.style.textAlign).toBe('start');
    expect(run.style.overflow).toBe('hidden');
    // xterm makes every span an inline block, which the browser can neither join letters
    // across nor reorder, and its letter spacing would pull the joined letters apart.
    expect(text.parentElement).toBe(run);
    expect(text.style.display).toBe('inline');
    expect(text.style.letterSpacing).toBe('0px');
    expect(prompt.parentElement?.hasAttribute('data-rtl-run')).toBe(false);
    expect(prompt.style.letterSpacing).toBe('3.2px');
    dispose();
  });

  it('keeps a Persian sentence together when the program colors its words and numbers apart', async () => {
    // PowerShell colors a number differently from the words around it, and xterm draws each
    // color as its own piece. Laid out piece by piece, the sentence read in the wrong order.
    const dispose = attachRtlRendering(fake.term);
    const pieces = fake.renderRow(0, [
      'PS C:\\> ',
      'echo ',
      'سلام',
      ' ',
      '123 ',
      'دنیا hello جهان',
    ]);
    await flush();

    const [run] = fake.runsIn(0);
    expect(fake.runsIn(0)).toHaveLength(1);
    expect(run.textContent).toBe('سلام 123 دنیا hello جهان');
    expect(run.style.direction).toBe('rtl');
    expect(run.style.width).toBe('182.88px');
    for (const piece of pieces.slice(2)) expect(piece.parentElement).toBe(run);
    for (const piece of pieces.slice(0, 2)) expect(piece.parentElement).not.toBe(run);
    dispose();
  });

  it('starts the run at the Persian text when an English label comes first', async () => {
    const dispose = attachRtlRendering(fake.term);
    fake.renderRow(0, ['Note: سلام hello دنیا']);
    await flush();

    const [run] = fake.runsIn(0);
    expect(run.textContent).toBe('سلام hello دنیا');
    expect(run.style.direction).toBe('rtl');
    // The label keeps its own copy of the span, left of the run.
    const row = run.parentElement as HTMLElement;
    expect(row.firstElementChild?.textContent).toBe('Note: ');
    expect(row.textContent).toBe('Note: سلام hello دنیا');
    dispose();
  });

  it('keeps an English sentence holding a Persian word left to right', async () => {
    const dispose = attachRtlRendering(fake.term);
    fake.renderRow(0, ['Hello سلام world']);
    await flush();
    const [run] = fake.runsIn(0);
    expect(run.textContent).toBe('Hello سلام world');
    expect(run.style.direction).toBe('ltr');
    expect(run.style.width).toBe('121.92px');
    dispose();
  });

  it('joins a run drawn letter by letter and leaves the cursor on its letter', async () => {
    const dispose = attachRtlRendering(fake.term);
    const spans = fake.renderRow(0, ['> ', 'س', 'ل', 'ا', 'م', ' ', 'د', 'ن', 'ی', 'ا'], 7);
    await flush();

    const [run] = fake.runsIn(0);
    expect(run.textContent).toBe('سلام دنیا');
    expect(run.style.direction).toBe('rtl');
    expect(run.style.width).toBe('68.58px');
    expect(run.querySelector('.xterm-cursor')?.textContent).toBe('ن');
    for (const span of spans.slice(1)) {
      expect(span.style.display).toBe('inline');
      expect(span.style.letterSpacing).toBe('0px');
    }
    expect(spans[0].parentElement).toBe(run.parentElement);
    dispose();
  });

  it('leaves a row without right-to-left letters alone', async () => {
    const dispose = attachRtlRendering(fake.term);
    const spans = fake.renderRow(0, ['abc', ' ', 'def 123']);
    await flush();
    expect(fake.runsIn(0)).toHaveLength(0);
    for (const span of spans) expect(span.style.display).toBe('');
    expect(spans[0].style.letterSpacing).toBe('3.2px');
    dispose();
  });

  it('lays out each column of a TUI on its own', async () => {
    const dispose = attachRtlRendering(fake.term);
    fake.renderRow(0, ['│ ', 'نام', '    ', 'توضیح', ' │']);
    await flush();
    expect(fake.runsIn(0).map((run) => run.textContent)).toEqual(['نام', 'توضیح']);
    dispose();
  });

  it('keeps working when xterm rebuilds its rows after a resize', async () => {
    const dispose = attachRtlRendering(fake.term);
    fake.renderRow(0, ['abc']);
    await flush();
    fake.element.querySelector('.xterm-rows')?.replaceChildren();
    fake.renderRow(0, ['کتاب']);
    await flush();
    expect(fake.runsIn(0)[0]?.style.width).toBe('30.48px');
    dispose();
  });

  it('squeezes a run whose glyphs come out wider than its cells instead of clipping it', async () => {
    // 3 cells is 22.86px; pretend the font drew it 30px wide.
    const restore = fakeNaturalWidth(() => 30);
    try {
      const dispose = attachRtlRendering(fake.term);
      fake.renderRow(0, ['ششش']);
      await flush();

      // The box grows to the text so nothing is cut off, is scaled back down to 3 cells, and
      // gives the extra width back so the next cell still starts where it should.
      const [run] = fake.runsIn(0);
      expect(run.style.width).toBe('30px');
      expect(run.style.transform).toBe('scaleX(0.762)');
      expect(run.style.transformOrigin).toBe('left');
      expect(run.style.marginRight).toBe('-7.14px');
      dispose();
    } finally {
      restore();
    }
  });

  it('measures runs again when a font finishes loading after they were drawn', async () => {
    const listeners = new Map<string, () => void>();
    const fonts = {
      addEventListener: vi.fn((type: string, listener: () => void) =>
        listeners.set(type, listener),
      ),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    };
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    let natural = 20;
    const restore = fakeNaturalWidth(() => natural);
    try {
      const dispose = attachRtlRendering(fake.term);
      fake.renderRow(0, ['کتاب']);
      await flush();
      const [run] = fake.runsIn(0);
      // Drawn in a fallback face, the run fits its 4 cells (30.48px).
      expect(run.style.transform).toBe('');

      // Vazirmatn lands and draws it wider. xterm does not redraw for that, so this has to.
      natural = 40;
      listeners.get('loadingdone')?.();
      expect(run.style.width).toBe('40px');
      expect(run.style.transform).toBe('scaleX(0.762)');
      expect(run.style.marginRight).toBe('-9.52px');

      // And back, if the face that lands draws it narrower.
      natural = 25;
      listeners.get('loadingdone')?.();
      expect(run.style.width).toBe('30.48px');
      expect(run.style.transform).toBe('');
      expect(run.style.marginRight).toBe('');

      dispose();
      expect(fonts.removeEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
    } finally {
      restore();
      Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    }
  });

  describe('in Claude Code', () => {
    // Claude Code reorders right-to-left text itself before writing it, so its lines already
    // hold Persian in display order. Captured from v2.1.289 for the typed text سلام hello دنیا.
    const CLAUDE_LINE = 'ایند hello مالس';
    const RLI = String.fromCodePoint(0x2067);
    const PDI = String.fromCodePoint(0x2069);
    const SHAPED = `${RLI}دنیا${PDI} hello ${RLI}سلام${PDI}`;

    it('joins the letters of its lines without reordering them a second time', async () => {
      const dispose = attachRtlRendering(fake.term);
      fake.setTitle('✳ Claude Code');
      fake.renderRow(0, [CLAUDE_LINE]);
      await flush();

      const [run] = fake.runsIn(0);
      expect(run.textContent).toBe(SHAPED);
      expect(run.style.direction).toBe('ltr');
      // Sized from the cells the text covers, not the isolates added for the browser.
      expect(run.style.width).toBe('114.3px');
      dispose();
    });

    it('leaves the shell lines above where it started in reading order', async () => {
      const dispose = attachRtlRendering(fake.term);
      fake.buffer.active.viewportY = 2;
      fake.buffer.active.cursorY = 3;
      fake.setTitle('✳ Claude Code');
      // Row 0 is buffer line 2, above where Claude Code started; row 1 is line 3.
      fake.renderRow(0, ['سلام دنیا']);
      fake.renderRow(1, [CLAUDE_LINE]);
      await flush();

      expect(fake.runsIn(0)[0].textContent).toBe('سلام دنیا');
      expect(fake.runsIn(0)[0].style.direction).toBe('rtl');
      expect(fake.runsIn(1)[0].textContent).toBe(SHAPED);
      dispose();
    });

    it('keeps its lines in its order after it exits, but not what the shell prints next', async () => {
      const dispose = attachRtlRendering(fake.term);
      fake.setTitle('✳ Claude Code');
      fake.buffer.active.cursorY = 5;
      // On exit Claude Code clears the title and the shell puts its own back.
      fake.setTitle('');
      fake.setTitle('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
      fake.renderRow(2, [CLAUDE_LINE]);
      fake.renderRow(6, ['سلام دنیا']);
      await flush();

      expect(fake.runsIn(2)[0].textContent).toBe(SHAPED);
      expect(fake.runsIn(6)[0].textContent).toBe('سلام دنیا');
      expect(fake.runsIn(6)[0].style.direction).toBe('rtl');
      dispose();
    });

    it('joins its letters on each side of the cursor', async () => {
      const dispose = attachRtlRendering(fake.term);
      fake.setTitle('✳ Claude Code');
      const spans = fake.renderRow(0, Array.from(`❯ ${CLAUDE_LINE}`), 14);
      await flush();

      const [run] = fake.runsIn(0);
      expect(run.style.direction).toBe('ltr');
      expect(run.style.width).toBe('114.3px');
      // The letters on each side of the cursor are joined in place; the cursor keeps its cell.
      const cursor = run.querySelector('.xterm-cursor') as HTMLElement;
      expect(cursor.textContent).toBe(`${RLI}ا${PDI}`);
      expect(run.textContent).toBe(
        `${RLI}دنیا${PDI} hello ${RLI}م${PDI}${RLI}ا${PDI}${RLI}سل${PDI}`,
      );
      expect(spans[0].parentElement).not.toBe(run);
      dispose();
    });

    it('treats a second session as its own stretch of lines', async () => {
      const dispose = attachRtlRendering(fake.term);
      fake.setTitle('✳ Claude Code');
      fake.buffer.active.cursorY = 2;
      fake.setTitle('powershell.exe');
      fake.buffer.active.cursorY = 4;
      fake.setTitle('✻ Claude Code');
      fake.renderRow(1, [CLAUDE_LINE]);
      fake.renderRow(3, ['سلام دنیا']);
      fake.renderRow(5, [CLAUDE_LINE]);
      await flush();

      expect(fake.runsIn(1)[0].textContent).toBe(SHAPED);
      expect(fake.runsIn(3)[0].textContent).toBe('سلام دنیا');
      expect(fake.runsIn(5)[0].textContent).toBe(SHAPED);
      dispose();
    });
  });

  it('stops touching rows once disposed', async () => {
    const dispose = attachRtlRendering(fake.term);
    dispose();
    fake.renderRow(0, ['سلام دنیا']);
    await flush();
    expect(fake.runsIn(0)).toHaveLength(0);
  });
});
