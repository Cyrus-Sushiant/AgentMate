/**
 * The Help articles are Markdown files with a small `key: value` header. This module turns one
 * into the shape the Help page, its search and the help chat's index all read, so the three
 * agree on titles, sections and anchors.
 */

/** The headed groups on the Help page, in the order they are shown. */
export const HELP_CATEGORIES = [
  'Getting started',
  'Workspace',
  'Build',
  'Agents',
  'Ship',
  'Deploy',
  'Connect',
  'Settings',
  'Troubleshooting',
] as const;

export interface HelpSection {
  /** The heading's anchor, unique within the article. Empty for the intro above the first heading. */
  id: string;
  heading: string;
  /** 2 or 3 for a heading, 0 for the intro. */
  level: 0 | 2 | 3;
  /** The `##` heading a `###` sits under, so a section can be named in full out of context. */
  parent?: string;
  /** The section's own Markdown, without its heading line. */
  markdown: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  category: string;
  order: number;
  summary: string;
  keywords: string[];
  /** The app route the article is about, when there is one. */
  route?: string;
  body: string;
  sections: HelpSection[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = FRONTMATTER.exec(raw);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return {
    meta,
    body: raw.slice(match[0].length).replace(/\r\n/g, '\n').replace(/^\n+/, ''),
  };
}

/** Inline Markdown down to its words: code ticks, emphasis and link targets go. */
function stripInline(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2');
}

/** The anchor for a heading: lowercase, with every run of other characters folded to one hyphen. */
export function slugifyHeading(heading: string): string {
  return stripInline(heading)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** Markdown as the plain text a reader would see, one line per block line. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) =>
      stripInline(
        line
          .replace(/^\s*>\s?/, '')
          .replace(/^\s*\[!(NOTE|TIP|WARNING)\]\s*$/i, '')
          .replace(/^\s*```.*$/, '')
          .replace(/^\s*\|?(\s*:?-{3,}:?\s*\|?)+\s*$/, '')
          .replace(/^\s*#{1,6}\s+/, '')
          .replace(/^\s*([-*+]|\d+\.)\s+/, ''),
      )
        .replace(/\s*\|\s*/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/;

export function splitSections(body: string): HelpSection[] {
  const sections: HelpSection[] = [];
  const used = new Map<string, number>();
  let current: HelpSection = { id: '', heading: '', level: 0, markdown: '' };
  let lines: string[] = [];
  let inFence = false;
  let parent: string | undefined;

  const flush = (): void => {
    current.markdown = lines.join('\n').trim();
    if (current.level !== 0 || current.markdown) sections.push(current);
  };

  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const match = inFence ? null : HEADING.exec(line);
    if (!match) {
      lines.push(line);
      continue;
    }
    flush();
    const level = match[1]!.length as 2 | 3;
    const heading = stripInline(match[2]!);
    const base = slugifyHeading(heading);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    if (level === 2) parent = heading;
    current = {
      id: seen === 0 ? base : `${base}-${seen}`,
      heading,
      level,
      ...(level === 3 && parent ? { parent } : {}),
      markdown: '',
    };
    lines = [];
  }
  flush();
  return sections;
}

export function parseArticle(slug: string, raw: string): HelpArticle {
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.title) throw new Error(`Help article ${slug}.md has no title in its header.`);
  const order = Number.parseInt(meta.order ?? '', 10);
  return {
    slug,
    title: meta.title,
    category: meta.category ?? 'Getting started',
    order: Number.isFinite(order) ? order : 999,
    summary: meta.summary ?? '',
    keywords: (meta.keywords ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    ...(meta.route ? { route: meta.route } : {}),
    body,
    sections: splitSections(body),
  };
}

/**
 * Where a link inside an article points, when it points at another article (`vault.md#unlock`)
 * or at a heading on the same one (`#tips`). Anything else is an outside link and gives null.
 */
export function resolveHelpLink(
  href: string | undefined,
  currentSlug: string,
): { slug: string; anchor: string } | null {
  if (!href) return null;
  if (href.startsWith('#')) return { slug: currentSlug, anchor: href.slice(1) };
  const match = /^(?:\.\/)?([a-z0-9-]+)\.md(?:#(.*))?$/i.exec(href);
  if (!match) return null;
  return { slug: match[1]!.toLowerCase(), anchor: match[2] ?? '' };
}
