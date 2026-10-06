/**
 * Merges ranked result lists (keyword search and vector search) into one ranking. Each item earns
 * 1 / (k + rank) from every list it appears in, so something both searches agree on rises to the
 * top without having to compare a BM25 score with a cosine distance. k = 60 is the usual constant
 * from the original paper; it keeps one list's top hit from drowning out everything else.
 */
export function reciprocalRankFusion(lists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  // Map keeps insertion order and sort is stable, so ties stay in order of first appearance.
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
