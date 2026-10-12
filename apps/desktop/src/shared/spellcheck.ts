/** What Chromium says the field under the cursor can do right now. */
export interface SpellcheckEditFlags {
  /** False for a collapsed selection and for a password box. */
  canCut: boolean;
  canCopy: boolean;
  /** False when the clipboard holds nothing the field could take. */
  canPaste: boolean;
  canSelectAll: boolean;
}

/** Sent from main to a renderer on every right-click inside an editable field. */
export interface SpellcheckMenuPayload {
  /** The word Chromium's spellchecker flagged, or '' when the click wasn't on one. */
  word: string;
  /** Replacements Chromium suggests, best first. Can be empty for an unknown word. */
  suggestions: string[];
  /** Text selected in the field, which the writing menu checks in place of the whole value. */
  selectionText: string;
  editFlags: SpellcheckEditFlags;
}

/**
 * The editing commands the right-click menu can run. They are the names of the matching methods
 * on Electron's WebContents, which is how main runs them.
 */
export const EDIT_COMMANDS = ['cut', 'copy', 'paste', 'selectAll'] as const;

export type EditCommand = (typeof EDIT_COMMANDS)[number];

export function isEditCommand(value: unknown): value is EditCommand {
  return typeof value === 'string' && (EDIT_COMMANDS as readonly string[]).includes(value);
}
