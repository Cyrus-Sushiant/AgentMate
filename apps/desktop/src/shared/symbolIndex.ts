import type { SymbolIndex } from './apiTypes';
import { type SymbolKind, symbolKindCode } from './symbolKinds';

/** One declaration, the way the extractors find it before it is packed for IPC. */
export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  /** The type it sits in, or '' at the top level. */
  container: string;
  /** Relative to the project folder, with forward slashes. */
  path: string;
  line: number;
  column: number;
}

/** Packs declarations into the column layout `SymbolIndex` uses, sharing each file's path. */
export function packSymbolIndex(
  entries: readonly SymbolEntry[],
  meta: Pick<SymbolIndex, 'version' | 'root' | 'truncated' | 'unavailable'>,
): SymbolIndex {
  const files: string[] = [];
  const fileIds = new Map<string, number>();
  const count = entries.length;
  const index: SymbolIndex = {
    ...meta,
    files,
    names: new Array<string>(count),
    containers: new Array<string>(count),
    kinds: new Uint8Array(count),
    fileOf: new Uint32Array(count),
    lines: new Uint32Array(count),
    columns: new Uint32Array(count),
  };
  for (const [at, entry] of entries.entries()) {
    let file = fileIds.get(entry.path);
    if (file === undefined) {
      file = files.length;
      files.push(entry.path);
      fileIds.set(entry.path, file);
    }
    index.names[at] = entry.name;
    index.containers[at] = entry.container;
    index.kinds[at] = symbolKindCode(entry.kind);
    index.fileOf[at] = file;
    index.lines[at] = entry.line;
    index.columns[at] = entry.column;
  }
  return index;
}
