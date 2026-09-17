/**
 * A small, forgiving XML reader for test reports (JUnit XML, TRX). Reports are machine written and
 * well formed, so this skips what they never use (DTD validation, mixed content ordering) and
 * tolerates a file cut short by a killed run.
 */

export interface XmlElement {
  /** Local name, with any namespace prefix removed. */
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** All text directly inside this element, entities decoded. */
  text: string;
}

export function parseXml(source: string): XmlElement | null {
  const text = source.replace(/^﻿/, '');
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  let i = 0;

  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) {
      appendText(stack, text.slice(i));
      break;
    }
    if (lt > i) appendText(stack, text.slice(i, lt));

    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      const stop = end < 0 ? text.length : end;
      const top = stack[stack.length - 1];
      if (top) top.text += text.slice(lt + 9, stop);
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text[lt + 1] === '/') {
      const end = text.indexOf('>', lt + 2);
      const name = localName(text.slice(lt + 2, end < 0 ? text.length : end).trim());
      // Pop back to the matching element; a mismatch closes whatever was left open.
      const index = findLastIndex(stack, (element) => element.name === name);
      if (index >= 0) stack.length = index;
      i = end < 0 ? text.length : end + 1;
      continue;
    }

    const end = findTagEnd(text, lt + 1);
    if (end < 0) break;
    const body = text.slice(lt + 1, end);
    const selfClosing = body.endsWith('/');
    const tag = selfClosing ? body.slice(0, -1) : body;
    const nameMatch = /^\s*([^\s/>]+)/.exec(tag);
    if (!nameMatch) {
      i = end + 1;
      continue;
    }
    const element: XmlElement = {
      name: localName(nameMatch[1]),
      attributes: readAttributes(tag.slice(nameMatch[0].length)),
      children: [],
      text: '',
    };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(element);
    else if (!root) root = element;
    if (!selfClosing) stack.push(element);
    i = end + 1;
  }

  return root;
}

/** Every descendant (and the element itself) with this local name, in document order. */
export function findAll(element: XmlElement | null, name: string): XmlElement[] {
  if (!element) return [];
  const out: XmlElement[] = [];
  const walk = (node: XmlElement): void => {
    if (node.name === name) out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(element);
  return out;
}

export function child(element: XmlElement | undefined, name: string): XmlElement | undefined {
  return element?.children.find((entry) => entry.name === name);
}

function appendText(stack: XmlElement[], raw: string): void {
  const top = stack[stack.length - 1];
  if (top) top.text += decodeEntities(raw);
}

function localName(name: string): string {
  const colon = name.indexOf(':');
  return colon < 0 ? name : name.slice(colon + 1);
}

function findTagEnd(text: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    }
  }
  return -1;
}

function readAttributes(text: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of text.matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    const name = match[1];
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    attributes[localName(name)] = decodeEntities(match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    const code = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
  });
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i -= 1) if (predicate(items[i])) return i;
  return -1;
}
