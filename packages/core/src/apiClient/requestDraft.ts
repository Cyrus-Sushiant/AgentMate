import type {
  PostmanAuth,
  PostmanBody,
  PostmanEvent,
  PostmanFormParam,
  PostmanKeyValue,
  PostmanRequest,
  PostmanRequestItem,
  RawLanguage,
} from './types.js';
import { buildRawUrl, type ParamRow, parseQuery, parseRawUrl } from './url.js';

/**
 * What a request tab edits. Postman's own shape nests things in ways that are awkward to bind to
 * inputs (a URL can be a string or an object, form rows carry `src` arrays, auth is optional),
 * so the editor works on this flat draft and converts at the edges.
 */

export type KeyValueRow = ParamRow;

export type BodyMode = 'none' | 'raw' | 'urlencoded' | 'formdata' | 'binary' | 'graphql';

export const RAW_LANGUAGES: readonly RawLanguage[] = ['json', 'text', 'xml', 'html', 'javascript'];

export interface FormDataRow extends KeyValueRow {
  kind: 'text' | 'file';
  files: string[];
}

export interface DraftBody {
  mode: BodyMode;
  raw: string;
  language: RawLanguage;
  urlencoded: KeyValueRow[];
  formdata: FormDataRow[];
  binaryPath: string;
  graphqlQuery: string;
  graphqlVariables: string;
}

export interface RequestDraft {
  method: string;
  url: string;
  params: KeyValueRow[];
  pathVariables: KeyValueRow[];
  headers: KeyValueRow[];
  body: DraftBody;
  /** null means "inherit auth from parent", which Postman writes as no auth key at all. */
  auth: PostmanAuth | null;
  /** Pre-request and test scripts. They belong to the item, but the tab edits them too. */
  events: PostmanEvent[];
  description: string;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function descriptionText(value: PostmanKeyValue['description']): string {
  if (typeof value === 'string') return value;
  return value?.content ?? '';
}

function toRow(entry: PostmanKeyValue): KeyValueRow {
  return {
    id: newId(),
    key: String(entry.key ?? ''),
    value: entry.value == null ? '' : String(entry.value),
    enabled: entry.disabled !== true,
    description: descriptionText(entry.description),
  };
}

/** Old exports sometimes keep headers as one "Key: value" block, with `//` for disabled lines. */
function parseHeaderBlock(block: string): KeyValueRow[] {
  const rows: KeyValueRow[] = [];
  for (const line of block.split(/\r?\n/)) {
    const disabled = /^\s*\/\//.test(line);
    const text = line.replace(/^\s*\/\/\s*/, '');
    const colon = text.indexOf(':');
    if (colon <= 0) continue;
    rows.push({
      id: newId(),
      key: text.slice(0, colon).trim(),
      value: text.slice(colon + 1).trim(),
      enabled: !disabled,
      description: '',
    });
  }
  return rows;
}

function fromRow(row: KeyValueRow): PostmanKeyValue {
  const entry: PostmanKeyValue = { key: row.key, value: row.value };
  if (!row.enabled) entry.disabled = true;
  if (row.description) entry.description = row.description;
  return entry;
}

function isBlank(row: KeyValueRow): boolean {
  return row.key === '' && row.value === '' && row.description === '';
}

function isRawLanguage(value: unknown): value is RawLanguage {
  return typeof value === 'string' && (RAW_LANGUAGES as readonly string[]).includes(value);
}

export function emptyBody(): DraftBody {
  return {
    mode: 'none',
    raw: '',
    language: 'json',
    urlencoded: [],
    formdata: [],
    binaryPath: '',
    graphqlQuery: '',
    graphqlVariables: '',
  };
}

export function emptyDraft(): RequestDraft {
  return {
    method: 'GET',
    url: '',
    params: [],
    pathVariables: [],
    headers: [],
    body: emptyBody(),
    auth: null,
    events: [],
    description: '',
  };
}

function bodyToDraft(body: PostmanBody | null | undefined): DraftBody {
  const draft = emptyBody();
  if (!body) return draft;
  draft.raw = body.raw ?? '';
  draft.language = isRawLanguage(body.options?.raw?.language) ? body.options.raw.language : 'json';
  draft.urlencoded = (body.urlencoded ?? []).map(toRow);
  draft.formdata = (body.formdata ?? []).map(
    (entry: PostmanFormParam): FormDataRow => ({
      ...toRow(entry),
      value: entry.type === 'file' ? '' : entry.value == null ? '' : String(entry.value),
      kind: entry.type === 'file' ? 'file' : 'text',
      files:
        entry.type === 'file'
          ? (Array.isArray(entry.src) ? entry.src : entry.src ? [entry.src] : []).map(String)
          : [],
    }),
  );
  draft.binaryPath = body.file?.src ?? '';
  draft.graphqlQuery = body.graphql?.query ?? '';
  draft.graphqlVariables = body.graphql?.variables ?? '';
  switch (body.mode) {
    case 'raw':
    case 'urlencoded':
    case 'formdata':
    case 'graphql':
      draft.mode = body.mode;
      break;
    case 'file':
      draft.mode = 'binary';
      break;
    default:
      draft.mode = 'none';
  }
  return draft;
}

export function requestToDraft(request: PostmanRequest, events: PostmanEvent[] = []): RequestDraft {
  const url = request.url;
  const raw = buildRawUrl(url);
  const query =
    typeof url === 'object' && url && Array.isArray(url.query)
      ? url.query
      : parseQuery(raw).map((pair): PostmanKeyValue => ({ ...pair }));
  const variables =
    typeof url === 'object' && url && Array.isArray(url.variable) ? url.variable : [];
  const pathVariables = syncPathVariables(raw, variables.map(toRow));

  return {
    method: (request.method || 'GET').toUpperCase(),
    url: raw,
    params: query.map(toRow),
    pathVariables,
    headers:
      typeof request.header === 'string'
        ? parseHeaderBlock(request.header)
        : (request.header ?? []).map(toRow),
    body: bodyToDraft(request.body),
    auth: request.auth ?? null,
    events,
    description: descriptionText(request.description),
  };
}

/** Path variables are the `:name` segments of the URL path, in order, with any typed values kept. */
export function syncPathVariables(url: string, previous: readonly KeyValueRow[]): KeyValueRow[] {
  const path = parseRawUrl(url).path ?? [];
  const names = path.filter((s) => /^:[^/:]+$/.test(s)).map((s) => s.slice(1));
  return names.map((key) => {
    const existing = previous.find((row) => row.key === key);
    return existing ?? { id: newId(), key, value: '', enabled: true, description: '' };
  });
}

function draftBodyToPostman(body: DraftBody): PostmanBody | undefined {
  switch (body.mode) {
    case 'raw':
      return { mode: 'raw', raw: body.raw, options: { raw: { language: body.language } } };
    case 'urlencoded':
      return {
        mode: 'urlencoded',
        urlencoded: body.urlencoded.filter((r) => !isBlank(r)).map(fromRow),
      };
    case 'formdata':
      return {
        mode: 'formdata',
        formdata: body.formdata
          .filter((r) => !(isBlank(r) && r.files.length === 0))
          .map((row): PostmanFormParam => {
            const entry: PostmanFormParam =
              row.kind === 'file'
                ? {
                    key: row.key,
                    type: 'file',
                    src: row.files.length === 1 ? row.files[0] : row.files,
                  }
                : { key: row.key, value: row.value, type: 'text' };
            if (!row.enabled) entry.disabled = true;
            if (row.description) entry.description = row.description;
            return entry;
          }),
      };
    case 'binary':
      return { mode: 'file', file: { src: body.binaryPath } };
    case 'graphql':
      return {
        mode: 'graphql',
        graphql: { query: body.graphqlQuery, variables: body.graphqlVariables },
      };
    default:
      return undefined;
  }
}

/**
 * Converts the draft back to a v2.1 request. `base` is the request the draft was opened from;
 * fields the editor does not show (a request-level proxy, certificates, and so on) are kept.
 */
export function draftToRequest(draft: RequestDraft, base: PostmanRequest = {}): PostmanRequest {
  const url = parseRawUrl(draft.url);
  const query = draft.params.filter((r) => !isBlank(r)).map(fromRow);
  if (query.length > 0) url.query = query;
  else delete url.query;
  if (draft.pathVariables.length > 0) {
    url.variable = draft.pathVariables.map((row) => {
      const entry: PostmanKeyValue = { key: row.key, value: row.value };
      if (row.description) entry.description = row.description;
      return entry;
    });
  } else {
    delete url.variable;
  }

  const request: PostmanRequest = {
    ...base,
    method: draft.method.toUpperCase(),
    header: draft.headers.filter((r) => !isBlank(r)).map(fromRow),
    url,
  };

  const body = draftBodyToPostman(draft.body);
  if (body) request.body = body;
  else delete request.body;

  if (draft.auth) request.auth = draft.auth;
  else delete request.auth;

  if (draft.description) request.description = draft.description;
  else delete request.description;
  return request;
}

/** Puts an edited draft back into its collection item, keeping the item's saved examples. */
export function applyDraftToItem(
  item: PostmanRequestItem,
  draft: RequestDraft,
): PostmanRequestItem {
  const next: PostmanRequestItem = { ...item, request: draftToRequest(draft, item.request) };
  if (draft.events.length > 0) next.event = draft.events;
  else delete next.event;
  return next;
}

/** A stable fingerprint of what the user can see, for telling whether a tab has unsaved changes. */
export function draftSignature(draft: RequestDraft): string {
  return JSON.stringify(draftToRequest(draft)) + JSON.stringify(draft.events);
}
