/** Longer than any name or command a person types for a run. Keeps a suggestion readable on screen. */
export const MAX_LABEL_LENGTH = 60;
export const MAX_COMMAND_LENGTH = 1000;

/** Every control character, tab included: a run command is one line that is typed as written. */
const CONTROL = /\p{Cc}/u;

export type RunProposalCheck =
  | { ok: true; label: string; command: string }
  | { ok: false; error: string };

/**
 * Checks a suggestion from an agent before it is shown to the user. The command is typed into the
 * terminal, so a line break or a control character would run or edit something the user never
 * read, and those are refused outright.
 */
export function validateRunProposal(
  input: { label?: unknown; command?: unknown },
  existing: { command: string }[],
): RunProposalCheck {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const command = typeof input.command === 'string' ? input.command.trim() : '';
  if (command === '') return { ok: false, error: 'The command is empty.' };
  if (CONTROL.test(command)) return { ok: false, error: 'The command must be one line of text.' };
  if (CONTROL.test(label)) return { ok: false, error: 'The label must be one line of text.' };
  if (command.length > MAX_COMMAND_LENGTH) {
    return { ok: false, error: `The command is longer than ${MAX_COMMAND_LENGTH} characters.` };
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return { ok: false, error: `The label is longer than ${MAX_LABEL_LENGTH} characters.` };
  }
  if (existing.some((entry) => entry.command.trim() === command)) {
    return { ok: false, error: 'This project already has that run command.' };
  }
  return { ok: true, label, command };
}
