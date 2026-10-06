import { type HelpArticle, stripMarkdown } from './parse';

/**
 * The Help page's search box. Everything runs in memory over the bundled articles: a few hundred
 * sections score in well under a millisecond, so there is no index to build or keep fresh.
 */

export interface HelpSearchHit {
  slug: string;
  articleTitle: string;
  category: string;
  /** The best matching section's anchor, empty when the article's intro matched best. */
  sectionId: string;
  heading: string;
  snippet: string;
  score: number;
}

/** Words that say nothing about what someone is looking for, dropped when better ones remain. */
const FILLER = new Set([
  'a',
  'an',
  'and',
  'are',
  'can',
  'do',
  'does',
  'for',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'where',
  'with',
  'you',
]);

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** The words of a query worth looking for: filler dropped (unless that is all there is), each once. */
export function searchTerms(query: string): string[] {
  const all = tokenize(query);
  const meaningful = all.filter((t) => !FILLER.has(t));
  return [...new Set(meaningful.length > 0 ? meaningful : all)];
}

interface SectionDoc {
  article: HelpArticle;
  sectionId: string;
  heading: string;
  plain: string;
  title: string[];
  keywords: string[];
  headingTokens: string[];
  body: string[];
  lowerTitle: string;
  lowerHeading: string;
  lowerPlain: string;
}

function fieldScore(tokens: string[], term: string, exact: number, prefix: number): number {
  let best = 0;
  for (const token of tokens) {
    if (token === term) return exact;
    if (token.startsWith(term)) best = prefix;
  }
  return best;
}

function bodyScore(tokens: string[], term: string): number {
  let count = 0;
  let prefixOnly = false;
  for (const token of tokens) {
    if (token === term) count++;
    else if (!prefixOnly && token.startsWith(term)) prefixOnly = true;
  }
  if (count > 0) return 2 + Math.min(count, 4) * 0.5;
  return prefixOnly ? 1 : 0;
}

function termScore(doc: SectionDoc, term: string): number {
  return (
    fieldScore(doc.title, term, 12, 8) +
    fieldScore(doc.keywords, term, 8, 5) +
    fieldScore(doc.headingTokens, term, 6, 4) +
    bodyScore(doc.body, term)
  );
}

function buildDocs(articles: HelpArticle[]): SectionDoc[] {
  return articles.flatMap((article) => {
    const title = tokenize(article.title);
    const keywords = tokenize(article.keywords.join(' '));
    return article.sections.map((section) => {
      const plain = stripMarkdown(section.markdown).replace(/\n+/g, ' ');
      const intro = section.level === 0;
      // The intro also carries the summary, so an article can be found by what it is for.
      const searchable = intro ? `${article.summary} ${plain}` : plain;
      return {
        article,
        sectionId: section.id,
        heading: section.heading,
        plain: intro && !plain ? article.summary : plain,
        title,
        keywords,
        headingTokens: tokenize(section.heading),
        body: tokenize(searchable),
        lowerTitle: article.title.toLowerCase(),
        lowerHeading: section.heading.toLowerCase(),
        lowerPlain: searchable.toLowerCase(),
      };
    });
  });
}

export function createHelpSearch(
  articles: HelpArticle[],
): (query: string, limit?: number) => HelpSearchHit[] {
  const docs = buildDocs(articles);

  return (query, limit = 8) => {
    const terms = searchTerms(query);
    if (terms.length === 0) return [];
    const phrase = terms.length > 1 ? query.trim().toLowerCase() : '';

    const score = (requireAll: boolean): Map<string, { doc: SectionDoc; score: number }> => {
      const best = new Map<string, { doc: SectionDoc; score: number }>();
      for (const doc of docs) {
        let total = 0;
        let matched = 0;
        for (const term of terms) {
          const s = termScore(doc, term);
          if (s > 0) matched++;
          total += s;
        }
        if (matched === 0 || (requireAll && matched < terms.length)) continue;
        total *= matched / terms.length;
        if (phrase) {
          if (doc.lowerTitle.includes(phrase) || doc.lowerHeading.includes(phrase)) total += 10;
          else if (doc.lowerPlain.includes(phrase)) total += 3;
        }
        const current = best.get(doc.article.slug);
        if (!current || total > current.score) best.set(doc.article.slug, { doc, score: total });
      }
      return best;
    };

    let ranked = score(true);
    if (ranked.size === 0) ranked = score(false);

    return [...ranked.values()]
      .sort((a, b) => b.score - a.score || a.doc.article.order - b.doc.article.order)
      .slice(0, limit)
      .map(({ doc, score: s }) => ({
        slug: doc.article.slug,
        articleTitle: doc.article.title,
        category: doc.article.category,
        sectionId: doc.sectionId,
        heading: doc.heading,
        snippet: makeSnippet(doc.plain, terms),
        score: s,
      }));
  };
}

/** A window of `text` around the first word that starts with one of `terms`. */
export function makeSnippet(text: string, terms: string[], width = 160): string {
  if (text.length <= width) return text;
  const lower = text.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const match = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}`, 'u').exec(lower);
    if (match && (at === -1 || match.index < at)) at = match.index + match[1]!.length;
  }
  if (at === -1) return `${text.slice(0, width).trimEnd()}…`;
  let start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  start = Math.max(0, end - width);
  // Begin and end on whole words so the snippet never opens mid-word.
  const from = start === 0 ? 0 : text.indexOf(' ', start) + 1 || start;
  const toSpace = end === text.length ? end : text.lastIndexOf(' ', end);
  const to = toSpace > from ? toSpace : end;
  return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
}

/** The spans of `text` to highlight: the start of every word that begins with a query term. */
export function highlightRanges(text: string, terms: string[]): Array<[number, number]> {
  if (terms.length === 0) return [];
  const ranges: Array<[number, number]> = [];
  const lower = text.toLowerCase();
  const word = /[\p{L}\p{N}]+/gu;
  for (let m = word.exec(lower); m; m = word.exec(lower)) {
    let longest = 0;
    for (const term of terms) {
      if (term.length > longest && m[0].startsWith(term)) longest = term.length;
    }
    if (longest > 0) ranges.push([m.index, m.index + longest]);
  }
  return ranges;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
