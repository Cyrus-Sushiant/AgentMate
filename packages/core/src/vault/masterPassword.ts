import { estimateStrength } from './strength.js';

export const MASTER_PASSWORD_MIN_LENGTH = 10;

/** The same rule in the setup form and in main: at least 10 characters and a "Fair" score. */
export function masterPasswordProblem(password: string): string | null {
  if ([...password].length < MASTER_PASSWORD_MIN_LENGTH) {
    return `Use at least ${MASTER_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (estimateStrength(password).score < 2) {
    return 'This password is too easy to guess. Try a longer phrase of unrelated words.';
  }
  return null;
}
