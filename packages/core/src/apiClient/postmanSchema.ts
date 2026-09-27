import type {
  PostmanCollection,
  PostmanFolder,
  PostmanItem,
  PostmanRequest,
  PostmanRequestItem,
} from './types.js';
import { POSTMAN_SCHEMA_V21 } from './types.js';

export type ParseCollectionResult =
  | { ok: true; collection: PostmanCollection }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function normalizeRequest(value: unknown): PostmanRequest {
  // v2.1 allows a request to be nothing more than its URL.
  if (typeof value === 'string') return { method: 'GET', url: value };
  const request = isRecord(value) ? { ...value } : {};
  return {
    ...request,
    method: typeof request.method === 'string' && request.method ? request.method : 'GET',
  } as PostmanRequest;
}

function normalizeItem(value: unknown, path: string): PostmanItem {
  if (!isRecord(value)) throw new Error(`${path} is not an item.`);
  const id = typeof value.id === 'string' && value.id ? value.id : newId();
  const name = typeof value.name === 'string' ? value.name : '';

  if (Array.isArray(value.item)) {
    const folder: PostmanFolder = {
      ...value,
      id,
      name: name || 'New Folder',
      item: value.item.map((child, index) => normalizeItem(child, `${path}.item[${index}]`)),
    };
    return folder;
  }

  const item: PostmanRequestItem = {
    ...value,
    id,
    name: name || 'New Request',
    request: normalizeRequest(value.request),
  };
  return item;
}

/**
 * Checks that `input` is a Postman collection (v2.0 or v2.1 share this shape) and returns a copy
 * where every item has an id and every request a method. Unknown fields are kept, so the
 * collection can be exported again without losing anything Postman put in it.
 */
export function parseCollection(input: unknown): ParseCollectionResult {
  if (!isRecord(input)) {
    return { ok: false, error: 'That file is not a Postman collection.' };
  }
  if (Array.isArray(input.values) && !('item' in input)) {
    return {
      ok: false,
      error: 'That file is a Postman environment, not a collection. Import it as an environment.',
    };
  }
  if (Array.isArray(input.requests) && !('item' in input)) {
    return {
      ok: false,
      error:
        'That file uses the old Postman v1 format. Open it in Postman and export it again as Collection v2.1.',
    };
  }

  const info = isRecord(input.info) ? input.info : null;
  if (!info || typeof info.name !== 'string') {
    return { ok: false, error: 'That file is not a Postman collection: it has no info.name.' };
  }
  if (!Array.isArray(input.item)) {
    return { ok: false, error: 'That file is not a Postman collection: it has no item list.' };
  }

  try {
    const collection: PostmanCollection = {
      ...input,
      info: {
        ...info,
        name: info.name,
        schema: typeof info.schema === 'string' ? info.schema : POSTMAN_SCHEMA_V21,
      },
      item: input.item.map((child, index) => normalizeItem(child, `item[${index}]`)),
    };
    return { ok: true, collection };
  } catch (error) {
    return {
      ok: false,
      error: `That collection could not be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function createCollection(name: string): PostmanCollection {
  return {
    info: {
      _postman_id: newId(),
      name: name.trim() || 'New Collection',
      schema: POSTMAN_SCHEMA_V21,
    },
    item: [],
  };
}
