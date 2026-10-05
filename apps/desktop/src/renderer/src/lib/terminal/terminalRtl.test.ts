import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachRtlRendering } from './terminalRtl';

type Joiner = (text: string) => [number, number][];

interface FakeMarker {
  line: number;
  isDisposed: boolean;
  dispose: () => void;
}

/** Just enough of an opened xterm: its DOM rows, the joiner registry, titles and markers. */
function fakeTerminal(cols = 100, rowWidth = 762) {
  const element = document.createElement('div');
  const rows = document.createElement('div');
  rows.className = 'xterm-rows';
  element.appendChild(rows);
  document.body.appendChild(element);
  const joiners = new Map<number, Joiner>();
  const titleListeners = new Set<(title: string) => void>();
  let nextId = 0;
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
    registerCharacterJoiner: vi.fn((handler: Joiner) => {
      joiners.set(nextId, handler);
      return nextId++;
    }),
    deregisterCharacterJoiner: vi.fn((id: number) => {
      joiners.delete(id);
    }),
  };

  /** What xterm does for one row: ask the joiners, then replace the row's spans. */
  function renderRow(index: number, pieces: string[]): HTMLSpanElement[] {
    for (const handler of joiners.values()) {
      for (const piece of pieces) handler(piece);
    }
    let row = rows.children[index] as HTMLDivElement | undefined;
    while (!row) {
      const created = document.createElement('div');
      created.style.width = `${rowWidth}px`;
      rows.appendChild(created);
      row = rows.children[index] as HTMLDivElement | undefined;
    }
    const spans = pieces.map((piece) => {
      const span = document.createElement('span');
      span.textContent = piece;
      span.style.letterSpacing = '3.2px';
      return span;
    });
    row.replaceChildren(...spans);
    return spans;
  }

  /** The running program sets the window title, as Claude Code does. */
  function setTitle(title: string): void {
    for (const listener of titleListeners) listener(title);
  }

  return { term, joiners, renderRow, element, buffer, setTitle };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('attachRtlRendering', () => {
  let fake: ReturnType<typeof fakeTerminal>;

  beforeEach(() => {
    fake = fakeTerminal();
  });

  afterEach(() => {
    fake.element.remove();
  });

  it('registers a joiner that groups each right-to-left run', () => {
    const dispose = attachRtlRendering(fake.term);
    expect(fake.term.registerCharacterJoiner).toHaveBeenCalledTimes(1);
    const [handler] = fake.joiners.values();
    expect(handler('> سلام hello دنیا')).toEqual([[2, 17]]);
    expect(handler('plain text')).toEqual([]);
    dispose();
  });

  it('lays a joined run out right to left across exactly the cells it covers', async () => {
    const dispose = attachRtlRendering(fake.term);
    const [prompt, run] = fake.renderRow(0, ['> ', 'سلام hello دنیا']);
    await flush();

    // 762px over 100 columns is 7.62px a cell, and the run covers 15 cells.
    expect(run.style.width).toBe('114.3px');
    expect(run.style.display).toBe('inline-block');
    expect(run.style.letterSpacing).toBe('0px');
    expect(run.style.direction).toBe('rtl');
    expect(run.style.getPropertyValue('unicode-bidi')).toBe('isolate');
    expect(run.style.textAlign).toBe('start');
    expect(run.style.overflow).toBe('hidden');
    expect(prompt.style.display).toBe('');
    expect(prompt.style.letterSpacing).toBe('3.2px');
    dispose();
  });

  it('keeps an English sentence holding a Persian word left to right', async () => {
    const dispose = attachRtlRendering(fake.term);
    const [run] = fake.renderRow(0, ['Hello سلام world']);
    await flush();
    expect(run.style.direction).toBe('ltr');
    expect(run.style.width).toBe('121.92px');
    dispose();
  });

  /** A row the way xterm draws it when it skipped the join: one span per piece. */
  function appendRow(pieces: string[], cursorAt = -1): HTMLSpanElement[] {
    const rows = fake.element.querySelector('.xterm-rows') as HTMLDivElement;
    const line = document.createElement('div');
    line.style.width = '762px';
    const spans = pieces.map((piece, index) => {
      const span = document.createElement('span');
      span.textContent = piece;
      span.style.letterSpacing = '2.5px';
      if (index === cursorAt) span.className = 'xterm-cursor';
      return span;
    });
    line.append(...spans);
    rows.appendChild(line);
    return spans;
  }

  it('still joins a run xterm drew letter by letter because the cursor was inside it', async () => {
    // xterm skips a join when the cursor or a partial selection sits inside the run, and draws
    // each letter in its own span. Those spans get wrapped into one right-to-left box.
    const dispose = attachRtlRendering(fake.term);
    const [handler] = fake.joiners.values();
    handler('> سلام دنیا');
    const spans = appendRow(['> ', 'س', 'ل', 'ا', 'م', ' ', 'د', 'ن', 'ی', 'ا'], 7);
    await flush();

    const box = spans[1].parentElement as HTMLElement;
    expect(box.tagName).toBe('SPAN');
    expect(box.textContent).toBe('سلام دنیا');
    expect(box.style.direction).toBe('rtl');
    expect(box.style.width).toBe('68.58px');
    // The cursor stays on its letter, which now sits where that letter is drawn.
    expect(box.querySelector('.xterm-cursor')?.textContent).toBe('ن');
    // xterm makes every span an inline block, which the browser can neither join letters
    // across nor reorder, and its letter spacing would pull the joined letters apart.
    for (const span of spans.slice(1)) {
      expect(span.style.display).toBe('inline');
      expect(span.style.letterSpacing).toBe('0px');
    }
    expect(spans[0].parentElement).toBe(box.parentElement);
    expect(spans[0].style.letterSpacing).toBe('2.5px');
    dispose();
  });

  it('splits a span that holds the end of a prompt and the start of a run', async () => {
    const dispose = attachRtlRendering(fake.term);
    const [handler] = fake.joiners.values();
    handler('> hello سلام');
    const spans = appendRow(['> hello ', 'س', 'ل', 'ا', 'م'], 2);
    await flush();

    const row = spans[1].parentElement?.parentElement as HTMLElement;
    const box = row.querySelector('[data-rtl-run]') as HTMLElement;
    expect(box.textContent).toBe('hello سلام');
    expect(box.style.direction).toBe('ltr');
    expect(row.textContent).toBe('> hello سلام');
    expect(row.firstElementChild?.textContent).toBe('> ');
    dispose();
  });

  it('leaves a row alone when the run text is not in it', async () => {
    const dispose = attachRtlRendering(fake.term);
    const [handler] = fake.joiners.values();
    handler('سلام');
    const spans = appendRow(['abc', ' ', 'def']);
    await flush();
    for (const span of spans) expect(span.parentElement?.hasAttribute('data-rtl-run')).toBe(false);
    dispose();
  });

  it('keeps working when xterm rebuilds its rows after a resize', async () => {
    const dispose = attachRtlRendering(fake.term);
    fake.renderRow(0, ['abc']);
    await flush();
    fake.element.querySelector('.xterm-rows')?.replaceChildren();
    const [run] = fake.renderRow(0, ['کتاب']);
    await flush();
    expect(run.style.width).toBe('30.48px');
    dispose();
  });

  it('squeezes a run whose glyphs come out wider than its cells instead of clipping it', async () => {
    const dispose = attachRtlRendering(fake.term);
    const [handler] = fake.joiners.values();
    handler('ششش');
    const rows = fake.element.querySelector('.xterm-rows') as HTMLDivElement;
    const line = document.createElement('div');
    line.style.width = '762px';
    const run = document.createElement('span');
    run.textContent = 'ششش';
    // 3 cells is 22.86px; pretend the font drew it 30px wide.
    Object.defineProperty(run, 'scrollWidth', { configurable: true, get: () => 30 });
    line.appendChild(run);
    rows.appendChild(line);
    await flush();

    // The box grows to the text so nothing is cut off, is scaled back down to 3 cells, and
    // gives the extra width back so the next cell still starts where it should.
    expect(run.style.width).toBe('30px');
    expect(run.style.transform).toBe('scaleX(0.762)');
    expect(run.style.transformOrigin).toBe('left');
    expect(run.style.marginRight).toBe('-7.14px');
    dispose();
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
    try {
      const dispose = attachRtlRendering(fake.term);
      const [handler] = fake.joiners.values();
      handler('کتاب');
      const rows = fake.element.querySelector('.xterm-rows') as HTMLDivElement;
      const line = document.createElement('div');
      line.style.width = '762px';
      const run = document.createElement('span');
      run.textContent = 'کتاب';
      let natural = 20;
      Object.defineProperty(run, 'scrollWidth', { configurable: true, get: () => natural });
      line.appendChild(run);
      rows.appendChild(line);
      await flush();
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
      const [run] = fake.renderRow(0, [CLAUDE_LINE]);
      await flush();

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
      const [shell] = fake.renderRow(0, ['سلام دنیا']);
      const [claude] = fake.renderRow(1, [CLAUDE_LINE]);
      await flush();

      expect(shell.textContent).toBe('سلام دنیا');
      expect(shell.style.direction).toBe('rtl');
      expect(claude.textContent).toBe(SHAPED);
      dispose();
    });

    it('keeps its lines in its order after it exits, but not what the shell prints next', async () => {
      const dispose = attachRtlRendering(fake.term);
      fake.setTitle('✳ Claude Code');
      fake.buffer.active.cursorY = 5;
      // On exit Claude Code clears the title and the shell puts its own back.
      fake.setTitle('');
      fake.setTitle('C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe');
      const [claude] = fake.renderRow(2, [CLAUDE_LINE]);
      const [shell] = fake.renderRow(6, ['سلام دنیا']);
      await flush();

      expect(claude.textContent).toBe(SHAPED);
      expect(shell.textContent).toBe('سلام دنیا');
      expect(shell.style.direction).toBe('rtl');
      dispose();
    });

    it('joins its letters around the cursor when xterm drew the run letter by letter', async () => {
      // Claude Code leaves the terminal's cursor inside its input line, so xterm skips the join.
      const dispose = attachRtlRendering(fake.term);
      fake.setTitle('✳ Claude Code');
      const [handler] = fake.joiners.values();
      handler(CLAUDE_LINE);
      const spans = appendRow(Array.from('❯ ' + CLAUDE_LINE), 14);
      await flush();

      const box = fake.element.querySelector('[data-rtl-run]') as HTMLElement;
      expect(box.style.direction).toBe('ltr');
      expect(box.style.width).toBe('114.3px');
      // The letters on each side of the cursor are joined in place; the cursor keeps its cell.
      const cursor = box.querySelector('.xterm-cursor') as HTMLElement;
      expect(cursor.textContent).toBe(`${RLI}ا${PDI}`);
      expect(box.textContent).toBe(
        `${RLI}دنیا${PDI} hello ${RLI}م${PDI}${RLI}ا${PDI}${RLI}سل${PDI}`,
      );
      expect(spans[0].parentElement).not.toBe(box);
      dispose();
    });

    it('treats a second session as its own stretch of lines', async () => {
      const dispose = attachRtlRendering(fake.term);
      fake.setTitle('✳ Claude Code');
      fake.buffer.active.cursorY = 2;
      fake.setTitle('powershell.exe');
      fake.buffer.active.cursorY = 4;
      fake.setTitle('✻ Claude Code');
      const [first] = fake.renderRow(1, [CLAUDE_LINE]);
      const [between] = fake.renderRow(3, ['سلام دنیا']);
      const [second] = fake.renderRow(5, [CLAUDE_LINE]);
      await flush();

      expect(first.textContent).toBe(SHAPED);
      expect(between.textContent).toBe('سلام دنیا');
      expect(second.textContent).toBe(SHAPED);
      dispose();
    });
  });

  it('stops touching rows and drops its joiner once disposed', async () => {
    const dispose = attachRtlRendering(fake.term);
    dispose();
    expect(fake.term.deregisterCharacterJoiner).toHaveBeenCalledWith(0);
    const [run] = fake.renderRow(0, ['سلام دنیا']);
    await flush();
    expect(run.style.display).toBe('');
  });
});
