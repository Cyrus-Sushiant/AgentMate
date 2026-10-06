/// <reference types="vite/client" />
import { HELP_CATEGORIES, type HelpArticle, parseArticle } from './parse';

/**
 * Every Help article, bundled at build time. The renderer shows them and searches them, and main
 * indexes the very same text for the help chat, so the two can never drift apart.
 */
const sources = import.meta.glob<string>('./articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const HELP_ARTICLES: HelpArticle[] = Object.entries(sources)
  .map(([path, raw]) => parseArticle(path.replace(/^.*\/|\.md$/g, ''), raw))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

const bySlug = new Map(HELP_ARTICLES.map((a) => [a.slug, a]));

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return bySlug.get(slug);
}

export interface HelpCategoryGroup {
  category: string;
  articles: HelpArticle[];
}

/** The articles under their category headings, in the order the Help page lists them. */
export function helpArticlesByCategory(): HelpCategoryGroup[] {
  return HELP_CATEGORIES.map((category) => ({
    category,
    articles: HELP_ARTICLES.filter((a) => a.category === category),
  })).filter((g) => g.articles.length > 0);
}
