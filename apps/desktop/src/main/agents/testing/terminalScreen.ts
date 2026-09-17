import { Terminal } from '@xterm/headless';

/** What a terminal pane would show for the data written to it, for tests that check the screen. */
export interface TerminalScreen {
  write: (data: string) => void;
  /** Every row with text on it, scrollback included, once all writes so far are drawn. */
  text: () => Promise<string>;
  dispose: () => void;
}

export function createTerminalScreen(cols = 80, rows = 30): TerminalScreen {
  const term = new Terminal({ cols, rows, scrollback: 1000, allowProposedApi: true });
  return {
    write: (data) => term.write(data),
    text: async () => {
      await new Promise<void>((resolve) => term.write('', resolve));
      const buffer = term.buffer.active;
      const lines: string[] = [];
      for (let y = 0; y < buffer.length; y += 1) {
        const line = buffer.getLine(y);
        if (!line) continue;
        // A wrapped row continues the one above it, as the user reads it.
        if (line.isWrapped && lines.length > 0) {
          lines[lines.length - 1] += line.translateToString(true);
        } else {
          lines.push(line.translateToString(true));
        }
      }
      // The row the cursor sits on keeps the blank cell under it.
      for (let i = 0; i < lines.length; i += 1) lines[i] = lines[i].trimEnd();
      while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      return lines.join('\n');
    },
    dispose: () => term.dispose(),
  };
}
