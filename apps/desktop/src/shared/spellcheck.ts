/** Sent from main to a renderer when the user right-clicks a misspelled word. */
export interface SpellcheckMenuPayload {
  /** The word Chromium's spellchecker flagged. */
  word: string;
  /** Replacements Chromium suggests, best first. Can be empty for an unknown word. */
  suggestions: string[];
}
