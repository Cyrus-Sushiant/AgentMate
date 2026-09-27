import { render } from '@testing-library/react';
import * as monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';
import { MonacoEditor } from './MonacoEditor';

// The real setup loads Monaco's web workers, which only the app's bundler can resolve.
vi.mock('./monacoSetup', () => ({ resolveMonacoThemeKey: () => 'dark' }));

type Recorded = { calls: { method: string; args: unknown[] }[] };

function lastEditor(): Recorded {
  const created = (monaco as unknown as { createdEditors: Recorded[] }).createdEditors;
  const editor = created.at(-1);
  if (!editor) throw new Error('no editor was created');
  return editor;
}

describe('MonacoEditor', () => {
  it('selects and scrolls to a place it is asked to reveal, then says so', () => {
    const onRevealed = vi.fn();
    render(
      <MonacoEditor
        value={'one\ntwo\nthree'}
        reveal={{ line: 3, column: 2, length: 3, nonce: 1 }}
        onRevealed={onRevealed}
      />,
    );
    const calls = lastEditor().calls;
    const selection = calls.find((call) => call.method === 'setSelection');
    expect(selection?.args[0]).toMatchObject({
      startLineNumber: 3,
      startColumn: 2,
      endLineNumber: 3,
      endColumn: 5,
    });
    expect(calls.some((call) => call.method === 'revealRangeInCenterIfOutsideViewport')).toBe(true);
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });

  it('reveals again only for a new request', () => {
    const onRevealed = vi.fn();
    const view = render(
      <MonacoEditor value="a" reveal={{ line: 1, column: 1, nonce: 1 }} onRevealed={onRevealed} />,
    );
    view.rerender(
      <MonacoEditor value="a" reveal={{ line: 1, column: 1, nonce: 1 }} onRevealed={onRevealed} />,
    );
    expect(onRevealed).toHaveBeenCalledTimes(1);
    view.rerender(
      <MonacoEditor value="a" reveal={{ line: 1, column: 1, nonce: 2 }} onRevealed={onRevealed} />,
    );
    expect(onRevealed).toHaveBeenCalledTimes(2);
  });
});
