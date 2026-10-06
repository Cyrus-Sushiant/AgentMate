import { createHash } from 'node:crypto';
import { type HelpArticle, stripMarkdown } from '../../shared/help/parse';

/**
 * Cuts the Help articles into the passages the help chat retrieves. One passage per section, so
 * an answer can link to the exact heading, with long sections split further. Every passage opens
 * with the path to it ("Vault > Unlock the vault") because a passage is read on its own, away from
 * the article around it.
 */

export interface HelpChunk {
  /** `<slug>#<anchor or "intro">#<part>`, stable for as long as the heading keeps its name. */
  id: string;
  slug: string;
  articleTitle: string;
  heading: string;
  anchor: string;
  text: string;
  /** SHA-1 of `text`, so the index only re-embeds passages that actually changed. */
  hash: string;
}

/** About 400 tokens of English: one focused section, so several fit even a small local model. */
const DEFAULT_MAX_CHARS = 1600;

function hash(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

/** Groups lines into parts of at most `max` characters, each repeating the previous part's last line. */
function pack(lines: string[], max: number): string[][] {
  const parts: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (current.length > 0 && size + line.length > max) {
      parts.push(current);
      const overlap = current.at(-1)!;
      current = [overlap];
      size = overlap.length;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export function chunkArticles(articles: HelpArticle[], maxChars = DEFAULT_MAX_CHARS): HelpChunk[] {
  const chunks: HelpChunk[] = [];
  for (const article of articles) {
    for (const section of article.sections) {
      const plain = stripMarkdown(section.markdown);
      if (!plain) continue;
      const header =
        section.level === 0
          ? [article.title, article.summary].filter(Boolean).join('\n')
          : [article.title, section.parent, section.heading].filter(Boolean).join(' > ');
      const lines = plain.split('\n');
      pack(lines, Math.max(1, maxChars - header.length - 2)).forEach((part, i) => {
        const text = `${header}\n\n${part.join('\n')}`;
        chunks.push({
          id: `${article.slug}#${section.id || 'intro'}#${i}`,
          slug: article.slug,
          articleTitle: article.title,
          heading: section.heading,
          anchor: section.id,
          text,
          hash: hash(text),
        });
      });
    }
  }
  return chunks;
}
