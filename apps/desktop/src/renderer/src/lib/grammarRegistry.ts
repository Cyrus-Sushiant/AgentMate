import type { GrammarIssue } from '@shared/grammar';
import type { TextField } from './grammar';

/**
 * What a live-checked field currently knows about itself. The writing menu is
 * mounted once for the whole app and has no props from the field that was
 * right-clicked, so fields publish here instead and the menu looks them up by
 * element. A WeakMap means an unmounted field is collected with its entry.
 */
export interface FieldGrammar {
  issues: GrammarIssue[];
  /** Value the issues were found in, so a stale entry can be spotted. */
  value: string;
  /** Hides one issue until the text changes; the menu's "Ignore" runs this. */
  dismiss: (issue: GrammarIssue) => void;
  /** Re-checks the field now, ignoring the debounce. Resolves with fresh issues. */
  recheck: () => Promise<GrammarIssue[]>;
}

const registry = new WeakMap<TextField, FieldGrammar>();

export function registerFieldGrammar(field: TextField, entry: FieldGrammar): void {
  registry.set(field, entry);
}

export function unregisterFieldGrammar(field: TextField): void {
  registry.delete(field);
}

export function getFieldGrammar(field: TextField): FieldGrammar | null {
  return registry.get(field) ?? null;
}
