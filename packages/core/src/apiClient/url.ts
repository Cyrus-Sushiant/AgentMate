import type { PostmanKeyValue, PostmanUrl } from './types.js';

export interface QueryPair {
  key: string;
  value: string;
}

/** A row in the Params table. Disabled rows stay in the table but never reach the URL. */
export interface ParamRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description: string;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** Splits `url` into the part before the query, the query text and the fragment (with its #). */
function splitUrl(url: string): { base: string; query: string | null; hash: string } {
  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = beforeHash.indexOf('?');
  if (queryAt < 0) return { base: beforeHash, query: null, hash };
  return { base: beforeHash.slice(0, queryAt), query: beforeHash.slice(queryAt + 1), hash };
}

/**
 * Reads the query string as the user typed it. Nothing is decoded, so `{{var}}` and `%20` come
 * back exactly the same and the URL bar never rewrites what was typed.
 */
export function parseQuery(url: string): QueryPair[] {
  const { query } = splitUrl(url);
  if (!query) return [];
  const pairs: QueryPair[] = [];
  for (const piece of query.split('&')) {
    if (!piece) continue;
    const equals = piece.indexOf('=');
    pairs.push(
      equals < 0
        ? { key: piece, value: '' }
        : { key: piece.slice(0, equals), value: piece.slice(equals + 1) },
    );
  }
  return pairs;
}

/** Writes the enabled rows as the query of `url`, keeping the base and the fragment. */
export function replaceQuery(
  url: string,
  params: ReadonlyArray<Pick<ParamRow, 'key' | 'value' | 'enabled'>>,
): string {
  const { base, hash } = splitUrl(url);
  const query = params
    .filter((p) => p.enabled && (p.key !== '' || p.value !== ''))
    .map((p) => (p.value === '' ? p.key : `${p.key}=${p.value}`))
    .join('&');
  return `${base}${query ? `?${query}` : ''}${hash}`;
}

/**
 * Brings the Params table in line with an edited URL. Enabled rows are rewritten in order from
 * the URL's pairs, so a row keeps its id and description while its value changes; disabled rows
 * stay where they are; extra pairs become new rows.
 */
export function syncParamsFromUrl(url: string, previous: readonly ParamRow[]): ParamRow[] {
  const pairs = parseQuery(url);
  const next: ParamRow[] = [];
  let used = 0;
  for (const row of previous) {
    if (!row.enabled) {
      next.push(row);
      continue;
    }
    const pair = pairs[used];
    if (!pair) continue;
    used++;
    next.push({ ...row, key: pair.key, value: pair.value });
  }
  for (const pair of pairs.slice(used)) {
    next.push({ id: newId(), key: pair.key, value: pair.value, enabled: true, description: '' });
  }
  return next;
}

/**
 * Breaks a raw URL into Postman's parts. Hosts that are a variable stay one piece, `:name` path
 * segments become path variables, and a trailing slash leaves an empty last segment the way
 * Postman records it.
 */
export function parseRawUrl(raw: string): PostmanUrl {
  if (!raw) return { raw: '' };
  const result: PostmanUrl = { raw };
  const { base, hash } = splitUrl(raw);
  let rest = base;

  const protocol = /^([a-z][a-z0-9+.-]*):\/\//i.exec(rest);
  if (protocol) {
    result.protocol = protocol[1];
    rest = rest.slice(protocol[0].length);
  }

  const slash = rest.indexOf('/');
  let hostPart = slash >= 0 ? rest.slice(0, slash) : rest;
  const pathPart = slash >= 0 ? rest.slice(slash + 1) : null;

  const port = /:(\d+|\{\{[^}]+\}\})$/.exec(hostPart);
  if (port) {
    result.port = port[1];
    hostPart = hostPart.slice(0, -port[0].length);
  }
  if (hostPart) {
    result.host = /^\{\{[^}]+\}\}$/.test(hostPart) ? [hostPart] : hostPart.split('.');
  }

  if (pathPart !== null) {
    result.path = pathPart.split('/');
    const variables = result.path
      .filter((segment) => /^:[^/:]+$/.test(segment))
      .map((segment): PostmanKeyValue => ({ key: segment.slice(1), value: '' }));
    if (variables.length > 0) result.variable = variables;
  }

  const query = parseQuery(raw);
  if (query.length > 0) result.query = query.map((pair): PostmanKeyValue => ({ ...pair }));
  if (hash) result.hash = hash.slice(1);
  return result;
}

/** The URL as text. Uses `raw` when present, and otherwise rebuilds it from the parts. */
export function buildRawUrl(url: PostmanUrl | string | undefined | null): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (typeof url.raw === 'string') return url.raw;

  let text = url.protocol ? `${url.protocol}://` : '';
  text += (url.host ?? []).join('.');
  if (url.port) text += `:${url.port}`;
  if (url.path && url.path.length > 0) text += `/${url.path.join('/')}`;
  const query = (url.query ?? [])
    .filter((q) => !q.disabled)
    .map((q) => (q.value ? `${q.key}=${q.value}` : q.key));
  if (query.length > 0) text += `?${query.join('&')}`;
  if (url.hash) text += `#${url.hash}`;
  return text;
}
