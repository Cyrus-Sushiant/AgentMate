import type { PickPayload } from './types';

/**
 * The element picker's flow in a browser tab. `copy` picks put the element's details on the
 * clipboard and stay armed for the next one. `comment` picks open the comment card; adding the
 * comment arms the picker again, so several comments can be left in a row.
 */

export type PickIntent = 'copy' | 'comment';

export type PickerState =
  | { mode: 'idle' }
  | { mode: 'picking'; intent: PickIntent }
  | { mode: 'composing'; payload: PickPayload };

export type PickerEvent =
  | { type: 'START'; intent: PickIntent }
  | { type: 'PICKED'; payload: PickPayload; copy: boolean }
  | { type: 'ADDED' }
  | { type: 'CANCEL' }
  | { type: 'SENT' }
  | { type: 'ESC' }
  | { type: 'NAVIGATED' }
  | { type: 'STOP' };

export const IDLE: PickerState = { mode: 'idle' };

const COMMENTING: PickerState = { mode: 'picking', intent: 'comment' };

export function pickerReducer(state: PickerState, event: PickerEvent): PickerState {
  switch (event.type) {
    case 'START':
      if (state.mode === 'picking' && state.intent === event.intent) return IDLE;
      return { mode: 'picking', intent: event.intent };
    case 'PICKED':
      if (state.mode !== 'picking') return state;
      if (event.copy || state.intent === 'copy') return state;
      return { mode: 'composing', payload: event.payload };
    case 'ADDED':
    case 'CANCEL':
      return state.mode === 'composing' ? COMMENTING : state.mode === 'picking' ? IDLE : state;
    case 'ESC':
      if (state.mode === 'composing') return COMMENTING;
      return IDLE;
    case 'NAVIGATED':
      return state.mode === 'composing' ? COMMENTING : state;
    case 'SENT':
    case 'STOP':
      return IDLE;
  }
}
