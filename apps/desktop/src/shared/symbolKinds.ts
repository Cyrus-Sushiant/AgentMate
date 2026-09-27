/**
 * The kinds of declaration the workspace search finds. The index sends a kind as its position
 * in this list, so new kinds go on the end.
 */
export const SYMBOL_KINDS = [
  'class',
  'interface',
  'struct',
  'enum',
  'type',
  'record',
  'trait',
  'namespace',
  'function',
  'method',
  'constructor',
  'property',
  'field',
  'const',
] as const;

export type SymbolKind = (typeof SYMBOL_KINDS)[number];

const TYPE_KINDS: ReadonlySet<SymbolKind> = new Set([
  'class',
  'interface',
  'struct',
  'enum',
  'type',
  'record',
  'trait',
  'namespace',
]);

/** Which search filter a kind belongs to: `t:` for types, `m:` for members. */
export function symbolCategory(kind: SymbolKind): 'type' | 'member' {
  return TYPE_KINDS.has(kind) ? 'type' : 'member';
}

export function symbolKindCode(kind: SymbolKind): number {
  return SYMBOL_KINDS.indexOf(kind);
}
