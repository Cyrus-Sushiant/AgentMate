import { describe, expect, it } from 'vitest';
import { useEditorRevealStore } from './editorRevealStore';

function store() {
  return useEditorRevealStore.getState();
}

describe('editorRevealStore', () => {
  it('holds a place to show until the editor takes it', () => {
    store().requestReveal('/a.ts', { line: 12, column: 5, length: 3 });
    expect(store().pending['/a.ts']).toMatchObject({ line: 12, column: 5, length: 3 });
    expect(store().takeReveal('/a.ts')).toMatchObject({ line: 12, column: 5 });
    expect(store().pending['/a.ts']).toBeUndefined();
    expect(store().takeReveal('/a.ts')).toBeNull();
  });

  it('tells two requests for the same place apart', () => {
    store().requestReveal('/a.ts', { line: 1, column: 1 });
    const first = store().pending['/a.ts']?.nonce;
    store().requestReveal('/a.ts', { line: 1, column: 1 });
    expect(store().pending['/a.ts']?.nonce).not.toBe(first);
  });
});
