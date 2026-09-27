import { StringDecoder } from 'node:string_decoder';
import type { TextSearchLine } from '../../shared/apiTypes';

/** How much of a matching line the list gets. Enough to read, small enough for a minified file. */
export const PREVIEW_CHARS = 240;
/** How much of the line before the first match to keep when a long line is cut. */
const LEAD_CHARS = 40;
/** Marks past this on one line add nothing a reader can use. */
const MAX_SPANS = 50;

/** Splits a process's output into lines, however the chunks happen to fall. */
export function createLineSplitter(onLine: (line: string) => void): {
  push: (chunk: Buffer) => void;
  end: () => void;
} {
  // The decoder holds back the first half of a character split between two chunks.
  const decoder = new StringDecoder('utf8');
  let pending = '';
  function drain(text: string): void {
    pending += text;
    let newline = pending.indexOf('\n');
    while (newline !== -1) {
      const line = pending.slice(0, newline);
      onLine(line.endsWith('\r') ? line.slice(0, -1) : line);
      pending = pending.slice(newline + 1);
      newline = pending.indexOf('\n');
    }
  }
  return {
    push: (chunk) => drain(decoder.write(chunk)),
    end: () => {
      drain(decoder.end());
      if (pending) onLine(pending);
      pending = '';
    },
  };
}

export interface RgMatch {
  /** Relative, with forward slashes. */
  path: string;
  line: number;
  text: string;
  /** [start, end) in UTF-8 bytes, as ripgrep counts. */
  spans: [number, number][];
}

interface RgText {
  text?: string;
}

/** A `match` event from `rg --json`, or null for anything else. */
export function parseRgMatch(line: string): RgMatch | null {
  let event: {
    type?: string;
    data?: {
      path?: RgText;
      lines?: RgText;
      line_number?: number;
      submatches?: { start: number; end: number }[];
    };
  };
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (event.type !== 'match' || !event.data) return null;
  const { path, lines, line_number: lineNumber, submatches } = event.data;
  // A path or line that is not valid UTF-8 comes as base64 bytes, which is not worth showing.
  if (typeof path?.text !== 'string' || typeof lines?.text !== 'string') return null;
  if (typeof lineNumber !== 'number') return null;
  return {
    path: path.text.replace(/^\.[\\/]/, '').replaceAll('\\', '/'),
    line: lineNumber,
    text: lines.text,
    spans: (submatches ?? []).slice(0, MAX_SPANS).map((span) => [span.start, span.end]),
  };
}

/** UTF-8 byte offsets as UTF-16 positions, in one walk. `offsets` must be ascending. */
function bytesToChars(text: string, offsets: readonly number[]): number[] {
  const result: number[] = [];
  let bytes = 0;
  let at = 0;
  for (const target of offsets) {
    while (bytes < target && at < text.length) {
      const code = text.codePointAt(at) ?? 0;
      bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
      at += code > 0xffff ? 2 : 1;
    }
    result.push(at);
  }
  return result;
}

export function byteToChar(text: string, byte: number): number {
  return bytesToChars(text, [byte])[0];
}

/**
 * A matching line as the list shows it: without its line break or indent, cut to a window
 * around the first match when it is long, with the marks moved to fit.
 */
export function toSearchLine(raw: string, line: number, spans: [number, number][]): TextSearchLine {
  const full = raw.replace(/\r?\n$/, '');
  const bytes = spans.flat().sort((a, b) => a - b);
  const offsets = bytesToChars(full, bytes);
  const toChar = new Map<number, number>();
  for (const [position, byte] of bytes.entries()) toChar.set(byte, offsets[position]);
  const ranges = spans.map(([start, end]): [number, number] => [
    toChar.get(start) ?? 0,
    toChar.get(end) ?? 0,
  ]);
  const first = ranges[0]?.[0] ?? 0;

  let start = full.length > PREVIEW_CHARS ? Math.max(0, first - LEAD_CHARS) : 0;
  while (start < first && /\s/.test(full[start])) start += 1;
  // Never start on the second half of a surrogate pair.
  if (start > 0 && /[\uDC00-\uDFFF]/.test(full[start])) start -= 1;
  const text = full.slice(start, start + PREVIEW_CHARS);

  return {
    line,
    column: first + 1,
    text,
    textOffset: start,
    // Leaving out the indent is not cutting the line; leaving out code is.
    clipped: full.slice(0, start).trim() !== '',
    ranges: ranges
      .map(([from, to]): [number, number] => [from - start, Math.min(to - start, text.length)])
      .filter(([from, to]) => from >= 0 && to > from),
  };
}
