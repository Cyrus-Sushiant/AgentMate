export type SecretCharKind = 'letter' | 'digit' | 'symbol' | 'space';

export interface SecretCharRun {
  kind: SecretCharKind;
  text: string;
}

function kindOf(char: string): SecretCharKind {
  if (/\p{L}/u.test(char)) return 'letter';
  if (/\p{Nd}/u.test(char)) return 'digit';
  if (/\s/.test(char)) return 'space';
  return 'symbol';
}

/**
 * Splits a secret into runs by character kind, so a revealed password can color digits and
 * symbols apart from letters. That is what makes "l1I|" or "O0" readable when typing it by hand.
 */
export function classifySecretChars(secret: string): SecretCharRun[] {
  const runs: SecretCharRun[] = [];
  for (const char of secret) {
    const kind = kindOf(char);
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += char;
    else runs.push({ kind, text: char });
  }
  return runs;
}
