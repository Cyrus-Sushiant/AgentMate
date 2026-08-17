/** Sent from main to a renderer on every right-click inside an editable field. */
export interface SpellcheckMenuPayload {
  /** The word Chromium's spellchecker flagged, or '' when the click wasn't on one. */
  word: string;
  /** Replacements Chromium suggests, best first. Can be empty for an unknown word. */
  suggestions: string[];
  /** Text selected in the field, which the writing menu checks in place of the whole value. */
  selectionText: string;
}
