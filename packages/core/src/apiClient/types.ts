/**
 * The API Client keeps collections in Postman's own Collection v2.1 format, so a file exported
 * from Postman comes in unchanged and anything saved here opens in Postman or Newman. These types
 * describe the parts the app reads and writes. Everything else a file carries is kept as-is,
 * which is why most of them allow unknown keys.
 */

export const POSTMAN_SCHEMA_V21 =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
export const POSTMAN_SCHEMA_V20 =
  'https://schema.getpostman.com/json/collection/v2.0.0/collection.json';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface PostmanKeyValue {
  key: string;
  value?: string;
  disabled?: boolean;
  description?: string | { content?: string; type?: string };
  type?: string;
  [extra: string]: unknown;
}

export interface PostmanFormParam extends PostmanKeyValue {
  /** 'text' or 'file'. A file row keeps its path in `src`. */
  type?: 'text' | 'file' | string;
  src?: string | string[] | null;
  contentType?: string;
}

export interface PostmanVariable {
  key: string;
  value?: unknown;
  type?: string;
  disabled?: boolean;
  description?: string;
  [extra: string]: unknown;
}

export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: PostmanKeyValue[];
  hash?: string;
  variable?: PostmanKeyValue[];
  [extra: string]: unknown;
}

export type RawLanguage = 'json' | 'text' | 'xml' | 'html' | 'javascript';

export interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql' | 'none' | string;
  raw?: string;
  urlencoded?: PostmanKeyValue[];
  formdata?: PostmanFormParam[];
  file?: { src?: string | null; [extra: string]: unknown };
  graphql?: { query?: string; variables?: string; [extra: string]: unknown };
  options?: { raw?: { language?: RawLanguage | string }; [extra: string]: unknown };
  disabled?: boolean;
  [extra: string]: unknown;
}

/** One auth helper, e.g. `{ type: 'bearer', bearer: [{ key: 'token', value: '...' }] }`. */
export interface PostmanAuth {
  type: string;
  [helper: string]: unknown;
}

export interface PostmanScript {
  type?: string;
  exec?: string[] | string;
  id?: string;
  [extra: string]: unknown;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test' | string;
  script?: PostmanScript;
  disabled?: boolean;
  [extra: string]: unknown;
}

export interface PostmanRequest {
  method?: string;
  url?: PostmanUrl | string;
  header?: PostmanKeyValue[] | string;
  body?: PostmanBody | null;
  /** Missing means "inherit from parent"; `{ type: 'noauth' }` means none. */
  auth?: PostmanAuth | null;
  description?: string | { content?: string; type?: string };
  [extra: string]: unknown;
}

/** A saved response ("example") under a request. */
export interface PostmanExample {
  id?: string;
  name?: string;
  originalRequest?: PostmanRequest;
  status?: string;
  code?: number;
  header?: PostmanKeyValue[];
  body?: string;
  _postman_previewlanguage?: string;
  [extra: string]: unknown;
}

export interface PostmanRequestItem {
  id: string;
  name: string;
  request: PostmanRequest;
  response?: PostmanExample[];
  event?: PostmanEvent[];
  description?: string | { content?: string; type?: string };
  [extra: string]: unknown;
}

export interface PostmanFolder {
  id: string;
  name: string;
  item: PostmanItem[];
  auth?: PostmanAuth | null;
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  description?: string | { content?: string; type?: string };
  [extra: string]: unknown;
}

export type PostmanItem = PostmanRequestItem | PostmanFolder;

export interface PostmanInfo {
  _postman_id?: string;
  name: string;
  schema: string;
  description?: string | { content?: string; type?: string };
  [extra: string]: unknown;
}

export interface PostmanCollection {
  info: PostmanInfo;
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth | null;
  event?: PostmanEvent[];
  [extra: string]: unknown;
}

/** The light outline of a collection the sidebar draws, without request bodies. */
export interface ApiTreeNode {
  id: string;
  name: string;
  kind: 'folder' | 'request';
  /** Upper-case method, only for requests. */
  method?: string;
  children?: ApiTreeNode[];
}
