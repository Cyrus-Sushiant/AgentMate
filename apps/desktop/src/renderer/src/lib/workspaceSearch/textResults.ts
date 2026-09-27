import type { TextSearchBatch, TextSearchFileMatches } from '@shared/apiTypes';

/** The text matches of one search, built up as ripgrep's batches arrive. */
export interface TextResults {
  requestId: string | null;
  files: TextSearchFileMatches[];
  matches: number;
}

export function emptyTextResults(requestId: string | null = null): TextResults {
  return { requestId, files: [], matches: 0 };
}

/**
 * Adds a batch, keeping files in the order they first arrived so rows already on screen never
 * move. A batch from a search that has since been replaced is dropped.
 */
export function mergeBatch(state: TextResults, batch: TextSearchBatch): TextResults {
  if (batch.requestId !== state.requestId || batch.files.length === 0) return state;
  const files = [...state.files];
  let matches = state.matches;
  for (const incoming of batch.files) {
    matches += incoming.matches.length;
    const at = files.findIndex((file) => file.path === incoming.path);
    if (at === -1) files.push(incoming);
    else files[at] = { path: incoming.path, matches: [...files[at].matches, ...incoming.matches] };
  }
  return { requestId: state.requestId, files, matches };
}
