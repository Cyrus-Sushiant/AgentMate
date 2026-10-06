import { describe, expect, it } from 'vitest';
import {
  encodeWordPressError,
  isWordPressErrorCode,
  wordPressError,
  wordPressErrorCode,
  wordPressErrorMessage,
} from './wordpressErrors';

/** A WordPress call's failure keeps its code across IPC, so the renderer can say what to do. */
describe('WordPress error codes', () => {
  it('survive the trip through Electron IPC', () => {
    const crossed = new Error(
      `Error invoking remote method 'deployWordPress:deploy': Error: ${encodeWordPressError('syntaxError', 'functions.php has a parse error on line 12.')}`,
    );

    expect(wordPressErrorCode(crossed)).toBe('syntaxError');
    expect(wordPressErrorMessage(crossed)).toBe('functions.php has a parse error on line 12.');
  });

  it("carry the app's own reasons, like a reply that was not from the plugin", () => {
    for (const code of ['foreignResponse', 'vaultLocked', 'plainHttpRefused'] as const) {
      const error = wordPressError(code, 'No.');
      expect(wordPressErrorCode(error)).toBe(code);
      expect(isWordPressErrorCode(code)).toBe(true);
    }
  });

  it('read as nothing for errors without one, or with a code this app does not know', () => {
    expect(wordPressErrorCode(new Error('disk full'))).toBeNull();
    expect(wordPressErrorCode('[wp:launchRockets] no')).toBeNull();
    expect(isWordPressErrorCode(42)).toBe(false);
    expect(wordPressErrorMessage(new Error('disk full'))).toBe('disk full');
  });
});
