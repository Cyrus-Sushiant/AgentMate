import { describe, expect, it } from 'vitest';
import { IDLE, type PickerState, pickerReducer } from './pickerMachine';
import type { PickPayload } from './types';

const payload = { page: { url: 'http://localhost:5173/' } } as PickPayload;
const picking = (intent: 'copy' | 'comment'): PickerState => ({ mode: 'picking', intent });
const composing: PickerState = { mode: 'composing', payload };

describe('pickerReducer', () => {
  it('starts picking from idle', () => {
    expect(pickerReducer(IDLE, { type: 'START', intent: 'comment' })).toEqual(picking('comment'));
  });

  it('stops when the same tool is pressed again', () => {
    expect(pickerReducer(picking('copy'), { type: 'START', intent: 'copy' })).toBe(IDLE);
  });

  it('switches tools while picking', () => {
    expect(pickerReducer(picking('copy'), { type: 'START', intent: 'comment' })).toEqual(
      picking('comment'),
    );
  });

  it('opens the comment card on a picked element', () => {
    expect(pickerReducer(picking('comment'), { type: 'PICKED', payload, copy: false })).toEqual(
      composing,
    );
  });

  it('keeps picking after a copy, so the next element is one click away', () => {
    expect(pickerReducer(picking('copy'), { type: 'PICKED', payload, copy: false })).toEqual(
      picking('copy'),
    );
    expect(pickerReducer(picking('comment'), { type: 'PICKED', payload, copy: true })).toEqual(
      picking('comment'),
    );
  });

  it('goes back to picking once a comment is added or dropped', () => {
    expect(pickerReducer(composing, { type: 'ADDED' })).toEqual(picking('comment'));
    expect(pickerReducer(composing, { type: 'CANCEL' })).toEqual(picking('comment'));
  });

  it('finishes when the comments are sent', () => {
    expect(pickerReducer(composing, { type: 'SENT' })).toBe(IDLE);
    expect(pickerReducer(picking('comment'), { type: 'SENT' })).toBe(IDLE);
  });

  it('backs out one step on Esc', () => {
    expect(pickerReducer(composing, { type: 'ESC' })).toEqual(picking('comment'));
    expect(pickerReducer(picking('comment'), { type: 'ESC' })).toBe(IDLE);
    expect(pickerReducer(IDLE, { type: 'ESC' })).toBe(IDLE);
  });

  it('drops an unsaved card when the page navigates, but keeps picking', () => {
    expect(pickerReducer(composing, { type: 'NAVIGATED' })).toEqual(picking('comment'));
    expect(pickerReducer(picking('copy'), { type: 'NAVIGATED' })).toEqual(picking('copy'));
  });

  it('stops picking when told to', () => {
    expect(pickerReducer(composing, { type: 'STOP' })).toBe(IDLE);
  });

  it('ignores a pick that arrives after picking stopped', () => {
    expect(pickerReducer(IDLE, { type: 'PICKED', payload, copy: false })).toBe(IDLE);
  });
});
