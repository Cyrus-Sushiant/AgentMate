import type { GrammarIssue } from '@shared/grammar';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alignIssues,
  checkScopeAt,
  isEditableTextField,
  issueAtOffset,
  issueKey,
  issueStyle,
  issueTitle,
  nextIssueFrom,
  replaceFieldRange,
  shiftIssues,
} from './grammar';

function issue(patch: Partial<GrammarIssue> = {}): GrammarIssue {
  return {
    offset: 0,
    length: 4,
    text: 'teh ',
    message: 'Possible spelling mistake',
    shortMessage: 'Spelling',
    kind: 'spelling',
    ruleId: 'MORFOLOGIK_RULE_EN_US',
    categoryName: 'Possible Typo',
    replacements: ['the '],
    ...patch,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('isEditableTextField', () => {
  it('takes a plain text box or textarea', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.append(input, textarea);
    expect(isEditableTextField(input)).toBe(true);
    expect(isEditableTextField(textarea)).toBe(true);
  });

  it('refuses one the user cannot type into', () => {
    const readOnly = document.createElement('textarea');
    readOnly.readOnly = true;
    const disabled = document.createElement('input');
    disabled.disabled = true;
    document.body.append(readOnly, disabled);
    expect(isEditableTextField(readOnly)).toBe(false);
    expect(isEditableTextField(disabled)).toBe(false);
  });

  it('refuses the hidden textarea xterm keeps over its cursor', () => {
    // The terminal owns its own right-click menu, and there is no document to check there.
    const terminal = document.createElement('div');
    terminal.className = 'xterm';
    const helper = document.createElement('textarea');
    terminal.appendChild(helper);
    document.body.appendChild(terminal);
    expect(isEditableTextField(helper)).toBe(false);
  });

  it('refuses anything that is not a text field', () => {
    expect(isEditableTextField(null)).toBe(false);
    expect(isEditableTextField(document.createElement('div'))).toBe(false);
    expect(isEditableTextField(document.createElement('button'))).toBe(false);
  });
});

describe('replaceFieldRange', () => {
  function field(value: string): HTMLTextAreaElement {
    const element = document.createElement('textarea');
    element.value = value;
    document.body.appendChild(element);
    return element;
  }

  it('uses the browser is own insert, which keeps undo and fires input', () => {
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    const element = field('teh cat');
    replaceFieldRange(element, 0, 3, 'the');
    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'the');
    // The selection is handed to execCommand as the range to replace.
    expect(element).toHaveFocus();
  });

  it('writes the value itself and fires input when insertText is refused', () => {
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => false),
      configurable: true,
    });
    const element = field('teh cat');
    const inputs = vi.fn();
    element.addEventListener('input', inputs);
    replaceFieldRange(element, 0, 3, 'the');
    expect(element.value).toBe('the cat');
    // A controlled React text box only learns about the change from this event.
    expect(inputs).toHaveBeenCalledTimes(1);
    expect(element.selectionStart).toBe(3);
    expect(element.selectionEnd).toBe(3);
  });

  it('can insert without replacing anything', () => {
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => false),
      configurable: true,
    });
    const element = field('the cat');
    replaceFieldRange(element, 4, 4, 'big ');
    expect(element.value).toBe('the big cat');
    expect(element.selectionStart).toBe(8);
  });

  it('can delete a range by replacing it with nothing', () => {
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => false),
      configurable: true,
    });
    const element = field('the big cat');
    replaceFieldRange(element, 4, 8, '');
    expect(element.value).toBe('the cat');
    expect(element.selectionStart).toBe(4);
  });
});

describe('issueKey', () => {
  it('is the same for the same finding in unchanged text', () => {
    expect(issueKey(issue())).toBe(issueKey(issue()));
  });

  it('differs once the rule, the place or the words differ', () => {
    expect(issueKey(issue({ offset: 5 }))).not.toBe(issueKey(issue()));
    expect(issueKey(issue({ ruleId: 'OTHER' }))).not.toBe(issueKey(issue()));
    expect(issueKey(issue({ text: 'teh' }))).not.toBe(issueKey(issue()));
  });
});

describe('alignIssues', () => {
  it('keeps the issues whose offsets still point at their own words', () => {
    const issues = [issue({ offset: 0, length: 3, text: 'teh' })];
    expect(alignIssues(issues, 'teh cat')).toEqual(issues);
  });

  it('drops an issue whose text has shifted under it', () => {
    // A keystroke landed while the check was in flight; a fresh check brings it back.
    const issues = [issue({ offset: 0, length: 3, text: 'teh' })];
    expect(alignIssues(issues, 'a teh cat')).toEqual([]);
  });

  it('drops an issue pointing past the end of the text', () => {
    expect(alignIssues([issue({ offset: 20, length: 3, text: 'teh' })], 'teh')).toEqual([]);
  });

  it('has nothing to align in an empty list', () => {
    expect(alignIssues([], 'anything')).toEqual([]);
  });
});

describe('issueAtOffset', () => {
  const short = issue({ offset: 4, length: 3, text: 'teh' });
  const long = issue({ offset: 0, length: 10, text: 'the teh ca', ruleId: 'STYLE' });

  it('has nothing under a caret that is clear of every issue', () => {
    expect(issueAtOffset([short], 0)).toBeNull();
    expect(issueAtOffset([], 4)).toBeNull();
  });

  it('counts both edges of an issue as being inside it', () => {
    // The caret sits between characters, so the end offset has to count as a hit.
    expect(issueAtOffset([short], 4)).toBe(short);
    expect(issueAtOffset([short], 7)).toBe(short);
    expect(issueAtOffset([short], 8)).toBeNull();
  });

  it('prefers the shortest issue when several cover the caret', () => {
    expect(issueAtOffset([long, short], 5)).toBe(short);
    expect(issueAtOffset([short, long], 5)).toBe(short);
  });
});

describe('nextIssueFrom', () => {
  const first = issue({ offset: 2, text: 'aa' });
  const second = issue({ offset: 20, text: 'bb' });

  it('has nothing to go to in a clean field', () => {
    expect(nextIssueFrom([], 0)).toBeNull();
  });

  it('goes to the next issue after the caret, in text order', () => {
    expect(nextIssueFrom([second, first], 0)).toBe(first);
    expect(nextIssueFrom([second, first], 2)).toBe(second);
  });

  it('wraps back to the first issue past the last one', () => {
    expect(nextIssueFrom([first, second], 100)).toBe(first);
  });
});

describe('checkScopeAt', () => {
  it('checks the whole of a short field', () => {
    expect(checkScopeAt('hello there', 3, null)).toEqual({ text: 'hello there', offset: 0 });
  });

  it('checks exactly what the user selected', () => {
    expect(checkScopeAt('hello there', 0, { start: 6, end: 11 })).toEqual({
      text: 'there',
      offset: 6,
    });
  });

  it('ignores an empty selection and takes the field instead', () => {
    expect(checkScopeAt('hello', 2, { start: 3, end: 3 })).toEqual({ text: 'hello', offset: 0 });
  });

  it('narrows a long field to the paragraph around the caret', () => {
    const first = 'a'.repeat(3000);
    const second = 'b'.repeat(3000);
    const value = `${first}\n\n${second}`;
    const caret = first.length + 2 + 10;
    expect(checkScopeAt(value, caret, null)).toEqual({ text: second, offset: first.length + 2 });
  });

  it('narrows to the first paragraph when the caret is in it', () => {
    const first = 'a'.repeat(3000);
    const value = `${first}\n\n${'b'.repeat(3000)}`;
    expect(checkScopeAt(value, 5, null)).toEqual({ text: first, offset: 0 });
  });

  it('takes a long field whole when it has no paragraph breaks', () => {
    const value = 'a'.repeat(5000);
    expect(checkScopeAt(value, 4000, null)).toEqual({ text: value, offset: 0 });
  });

  it('keeps the caret is own paragraph when it sits on the break', () => {
    const first = 'a'.repeat(3000);
    const value = `${first}\n\n${'b'.repeat(3000)}`;
    // Right at the start of the second paragraph: the second one is what gets checked.
    expect(checkScopeAt(value, first.length + 2, null).offset).toBe(first.length + 2);
  });
});

describe('shiftIssues', () => {
  it('leaves issues alone when the slice started at the top', () => {
    const issues = [issue()];
    expect(shiftIssues(issues, 0)).toBe(issues);
  });

  it('moves the offsets onto the whole field is coordinates', () => {
    expect(shiftIssues([issue({ offset: 3 })], 100)[0].offset).toBe(103);
  });

  it('does not touch the issues it was given', () => {
    const original = issue({ offset: 3 });
    shiftIssues([original], 100);
    expect(original.offset).toBe(3);
  });
});

describe('issueStyle and issueTitle', () => {
  it('has a colour and label for every kind', () => {
    for (const kind of [
      'spelling',
      'grammar',
      'punctuation',
      'typography',
      'style',
      'other',
    ] as const) {
      const style = issueStyle(kind);
      expect(style.label).toBeTruthy();
      expect(style.decoration).toMatch(/^decoration-/);
      expect(style.dot).toMatch(/^bg-/);
      expect(style.text).toMatch(/^text-/);
    }
  });

  it('falls back to "other" for a kind it does not know', () => {
    expect(issueStyle('made-up' as 'other')).toEqual(issueStyle('other'));
  });

  it('prefers LanguageTool is short label, then the category, then the kind', () => {
    expect(issueTitle(issue({ shortMessage: 'Spelling' }))).toBe('Spelling');
    expect(issueTitle(issue({ shortMessage: '', categoryName: 'Possible Typo' }))).toBe(
      'Possible Typo',
    );
    expect(issueTitle(issue({ shortMessage: '', categoryName: '', kind: 'grammar' }))).toBe(
      issueStyle('grammar').label,
    );
  });
});
