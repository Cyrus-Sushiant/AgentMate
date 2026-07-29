/**
 * Pure text transforms behind the markdown editor's toolbar and key handling.
 *
 * Each takes the textarea's current value plus selection and returns the next
 * one, so the React layer only has to apply the result and restore the caret.
 */

export interface EditState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Start offset of the line containing `offset`. */
function lineStartAt(value: string, offset: number): number {
  return value.lastIndexOf('\n', offset - 1) + 1;
}

/** End offset (exclusive of the newline) of the line containing `offset`. */
function lineEndAt(value: string, offset: number): number {
  const idx = value.indexOf('\n', offset);
  return idx === -1 ? value.length : idx;
}

/** The full lines a selection touches, as a single block. */
function selectedLineRange(state: EditState): { from: number; to: number } {
  const from = lineStartAt(state.value, state.selectionStart);
  // A selection ending exactly at a line start hasn't really reached that line,
  // so pull back one character before looking for the end.
  const endProbe =
    state.selectionEnd > state.selectionStart && lineStartAt(state.value, state.selectionEnd) === state.selectionEnd
      ? state.selectionEnd - 1
      : state.selectionEnd;
  return { from, to: lineEndAt(state.value, endProbe) };
}

function replaceRange(
  state: EditState,
  from: number,
  to: number,
  replacement: string,
  selectionStart: number,
  selectionEnd: number,
): EditState {
  return {
    value: state.value.slice(0, from) + replacement + state.value.slice(to),
    selectionStart,
    selectionEnd,
  };
}

/**
 * Toggle an inline marker (`**`, `*`, `~~`, `` ` ``) around the selection.
 * Unwraps when the marker is already there, either inside the selection or
 * hugging it, so clicking Bold twice leaves the text as it started.
 */
export function toggleInlineWrap(state: EditState, marker: string): EditState {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const len = marker.length;

  if (selected.length >= len * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(len, -len);
    return replaceRange(state, selectionStart, selectionEnd, inner, selectionStart, selectionStart + inner.length);
  }

  const before = value.slice(Math.max(0, selectionStart - len), selectionStart);
  const after = value.slice(selectionEnd, selectionEnd + len);
  if (before === marker && after === marker) {
    return replaceRange(
      state,
      selectionStart - len,
      selectionEnd + len,
      selected,
      selectionStart - len,
      selectionEnd - len,
    );
  }

  const wrapped = `${marker}${selected}${marker}`;
  return replaceRange(
    state,
    selectionStart,
    selectionEnd,
    wrapped,
    selectionStart + len,
    selectionStart + len + selected.length,
  );
}

/** Matches any list/quote marker this editor knows how to toggle or continue. */
const MARKER_PATTERNS = {
  bullet: /^(\s*)[-*+] (?!\[[ xX]\] )/,
  ordered: /^(\s*)\d+[.)] /,
  task: /^(\s*)[-*+] \[[ xX]\] /,
  quote: /^(\s*)> /,
} satisfies Record<string, RegExp>;

export type BlockKind = keyof typeof MARKER_PATTERNS;

function markerFor(kind: BlockKind, indent: string, ordinal: number): string {
  switch (kind) {
    case 'bullet':
      return `${indent}- `;
    case 'ordered':
      return `${indent}${ordinal}. `;
    case 'task':
      return `${indent}- [ ] `;
    case 'quote':
      return `${indent}> `;
  }
}

/**
 * Toggle a block marker across every line the selection touches. Adds the
 * marker unless all non-empty lines already carry it, in which case it strips,
 * matching how editors people already know behave.
 */
export function toggleBlockPrefix(state: EditState, kind: BlockKind): EditState {
  const { from, to } = selectedLineRange(state);
  const block = state.value.slice(from, to);
  const lines = block.split('\n');
  const pattern = MARKER_PATTERNS[kind];

  const meaningful = lines.filter((line) => line.trim().length > 0);
  const allMarked = meaningful.length > 0 && meaningful.every((line) => pattern.test(line));

  let ordinal = 1;
  const next = lines
    .map((line) => {
      if (allMarked) return line.replace(pattern, '$1');
      if (line.trim().length === 0) return line;
      // Swap out any marker already present so toggling bullet → ordered
      // replaces rather than stacks.
      const indent = /^\s*/.exec(line)?.[0] ?? '';
      const bare = Object.values(MARKER_PATTERNS).reduce(
        (acc, other) => acc.replace(other, ''),
        line.slice(indent.length),
      );
      return `${markerFor(kind, indent, ordinal++)}${bare}`;
    })
    .join('\n');

  return replaceRange(state, from, to, next, from, from + next.length);
}

/** Apply an ATX heading level to the touched lines; re-applying the same level clears it. */
export function toggleHeading(state: EditState, level: number): EditState {
  const { from, to } = selectedLineRange(state);
  const lines = state.value.slice(from, to).split('\n');
  const hashes = '#'.repeat(level);
  const allAtLevel = lines.every((line) => new RegExp(`^${hashes} `).test(line));

  const next = lines
    .map((line) => {
      const bare = line.replace(/^#{1,6} +/, '');
      return allAtLevel ? bare : `${hashes} ${bare}`;
    })
    .join('\n');

  return replaceRange(state, from, to, next, from, from + next.length);
}

/**
 * Insert a link. Selected text becomes the label with the URL placeholder
 * selected; with no selection, the label placeholder is selected instead, so
 * either way the next keystroke types into the right slot.
 */
export function insertLink(state: EditState): EditState {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const label = selected || 'text';
  const snippet = `[${label}](url)`;
  const urlStart = selectionStart + label.length + 3;

  return selected
    ? replaceRange(state, selectionStart, selectionEnd, snippet, urlStart, urlStart + 3)
    : replaceRange(state, selectionStart, selectionEnd, snippet, selectionStart + 1, selectionStart + 1 + label.length);
}

/** Fence the selection as a code block, on its own lines. */
export function insertCodeBlock(state: EditState): EditState {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const leadingBreak = selectionStart > 0 && value[selectionStart - 1] !== '\n' ? '\n' : '';
  const snippet = `${leadingBreak}\`\`\`\n${selected}\n\`\`\`\n`;
  const bodyStart = selectionStart + leadingBreak.length + 4;

  return replaceRange(
    state,
    selectionStart,
    selectionEnd,
    snippet,
    bodyStart,
    bodyStart + selected.length,
  );
}

/** Drop a block of literal text at the caret, on a fresh line. */
export function insertBlock(state: EditState, block: string): EditState {
  const { value, selectionStart, selectionEnd } = state;
  const leadingBreak = selectionStart > 0 && value[selectionStart - 1] !== '\n' ? '\n' : '';
  const snippet = `${leadingBreak}${block}`;
  const caret = selectionStart + snippet.length;
  return replaceRange(state, selectionStart, selectionEnd, snippet, caret, caret);
}

export const TABLE_SNIPPET = '| Column | Column |\n| --- | --- |\n|  |  |\n';
export const RULE_SNIPPET = '\n---\n\n';

/**
 * Enter inside a list continues it: same indent, next marker, ordered numbers
 * incremented. Pressing Enter on an empty item ends the list instead. Returns
 * null when the caret isn't in a list, leaving Enter to the browser.
 */
export function continueList(state: EditState): EditState | null {
  const { value, selectionStart, selectionEnd } = state;
  if (selectionStart !== selectionEnd) return null;

  const from = lineStartAt(value, selectionStart);
  const line = value.slice(from, selectionStart);
  const match = /^(\s*)(?:([-*+]) (\[[ xX]\] )?|(\d+)([.)]) )/.exec(line);
  if (!match) return null;

  const [marker, indent, bullet, task, numberText, delimiter] = match;

  // Empty item, clear the marker rather than adding another one.
  if (line.length === marker.length) {
    return replaceRange(state, from, selectionStart, indent, from + indent.length, from + indent.length);
  }

  const nextMarker = bullet
    ? `${indent}${bullet} ${task ? '[ ] ' : ''}`
    : `${indent}${Number(numberText) + 1}${delimiter} `;
  const snippet = `\n${nextMarker}`;
  const caret = selectionStart + snippet.length;
  return replaceRange(state, selectionStart, selectionEnd, snippet, caret, caret);
}

const INDENT = '  ';

/** Tab / Shift+Tab across the touched lines. */
export function indentSelection(state: EditState, outdent: boolean): EditState {
  const { from, to } = selectedLineRange(state);
  const lines = state.value.slice(from, to).split('\n');

  let firstDelta = 0;
  let totalDelta = 0;
  const next = lines
    .map((line, index) => {
      if (outdent) {
        const removed = /^(\s{1,2}|\t)/.exec(line)?.[0].length ?? 0;
        if (index === 0) firstDelta = -removed;
        totalDelta -= removed;
        return line.slice(removed);
      }
      if (index === 0) firstDelta = INDENT.length;
      totalDelta += INDENT.length;
      return INDENT + line;
    })
    .join('\n');

  return {
    value: state.value.slice(0, from) + next + state.value.slice(to),
    selectionStart: Math.max(from, state.selectionStart + firstDelta),
    selectionEnd: Math.max(from, state.selectionEnd + totalDelta),
  };
}
