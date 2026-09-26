import type { AnnotationIntent, BrowserAnnotation, PickedElement, PickedPage } from './types';

/**
 * The text an agent CLI gets for the comments left on page elements in a browser tab. It is
 * markdown the agent reads as a prompt, so it names each element in every way the agent might
 * search for it in the source: component, selector, text and the JSX source when React gives it.
 */

const SECRET_PARAM =
  /token|secret|password|passwd|api[-_]?key|auth|session|code|sig|signature|credential/i;
const MAX_LABEL = 60;

const INTENT_TEXT: Record<AnnotationIntent, string> = {
  change: 'Change',
  fix: 'Fix (something is broken here)',
  question: 'Question (answer it, don’t change code)',
};

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** `Button button "Buy now"`: the innermost component, the tag and what the element says. */
export function elementLabel(element: PickedElement): string {
  const component = element.react?.components.at(-1);
  const name = element.name || element.text;
  return [component, element.tagName, name ? `"${clip(name, MAX_LABEL)}"` : null]
    .filter(Boolean)
    .join(' ');
}

/**
 * A page URL safe to hand to an agent: values of parameters that look like credentials are
 * replaced, and a fragment is dropped unless it is a hash route (`#/settings`).
 */
export function sanitizePageUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (!/^https?:$/.test(url.protocol)) return raw;
  for (const key of [...url.searchParams.keys()]) {
    if (SECRET_PARAM.test(key)) url.searchParams.set(key, 'redacted');
  }
  if (!url.hash.startsWith('#/')) url.hash = '';
  return url.href;
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + (parsed.hash.startsWith('#/') ? parsed.hash : '');
  } catch {
    return url;
  }
}

function quotePath(path: string): string {
  return /\s/.test(path) ? `"${path}"` : path;
}

/** A fenced block whose fence is longer than any backtick run in the content. */
function fence(lang: string, body: string): string {
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const marks = '`'.repeat(Math.max(3, longest + 1));
  return `${marks}${lang}\n${body}\n${marks}`;
}

function elementLines(element: PickedElement): string[] {
  const lines = [`**Selector:** \`${element.selector}\``];
  if (element.react?.components.length) {
    lines.push(`**Components:** ${element.react.components.join(' > ')}`);
  }
  if (element.react?.source) lines.push(`**Source:** ${element.react.source}`);
  if (element.text) lines.push(`**Text:** "${clip(element.text, 200)}"`);
  const styles = Object.entries(element.styles);
  if (styles.length) {
    lines.push(`**Styles:** ${styles.map(([name, value]) => `${name}: ${value}`).join('; ')}`);
  }
  return lines;
}

function pageLines(page: PickedPage, preset: string | null): string[] {
  const size = `${page.viewport.width}×${page.viewport.height}`;
  return [
    `**URL:** ${sanitizePageUrl(page.url)}`,
    `**Viewport:** ${preset ? `${size} (${preset})` : size}`,
  ];
}

export function formatAnnotationsPrompt(annotations: readonly BrowserAnnotation[]): string {
  const groups = new Map<string, BrowserAnnotation[]>();
  for (const annotation of annotations) {
    const key = sanitizePageUrl(annotation.page.url);
    groups.set(key, [...(groups.get(key) ?? []), annotation]);
  }

  const count = annotations.length;
  const out = [
    `I left ${count === 1 ? 'a comment' : `${count} comments`} on elements of the page open in my browser. ` +
      'Each one says which element it is about and how to find it in the code.',
  ];
  let n = 0;
  for (const group of groups.values()) {
    const first = group[0] as BrowserAnnotation;
    out.push(
      '',
      `## Page feedback: ${pathOf(first.page.url)}`,
      '',
      ...pageLines(first.page, first.preset),
    );
    for (const annotation of group) {
      n += 1;
      out.push(
        '',
        `### ${n}. ${elementLabel(annotation.element)}`,
        `**Intent:** ${INTENT_TEXT[annotation.intent]}`,
        `**Comment:** ${annotation.comment.trim().replace(/\n/g, '\n  ')}`,
        ...elementLines(annotation.element),
      );
      if (annotation.screenshotPath) {
        out.push(`**Screenshot:** ${quotePath(annotation.screenshotPath)}`);
      }
      if (annotation.element.html) out.push('**HTML:**', fence('html', annotation.element.html));
    }
  }
  return `${out.join('\n')}\n`;
}

/** One element's details without a comment, for the clipboard ("copy element"). */
export function formatElementContext({
  page,
  element,
}: {
  page: PickedPage;
  element: PickedElement;
}): string {
  const out = [
    `Element on ${sanitizePageUrl(page.url)}: ${elementLabel(element)}`,
    '',
    ...elementLines(element),
  ];
  if (element.html) out.push('**HTML:**', fence('html', element.html));
  return `${out.join('\n')}\n`;
}
