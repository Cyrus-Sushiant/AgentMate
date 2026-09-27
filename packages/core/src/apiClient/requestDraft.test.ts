import { describe, expect, it } from 'vitest';
import {
  applyDraftToItem,
  draftSignature,
  draftToRequest,
  emptyDraft,
  requestToDraft,
  syncPathVariables,
} from './requestDraft.js';
import type { PostmanRequest, PostmanRequestItem } from './types.js';

/**
 * A tab edits a draft: flat rows for the tables, one field per body mode, the URL as typed.
 * Converting back must give Postman the same request, keeping anything the editor does not show.
 */

const withoutIds = <T extends { id: string }>(rows: T[]) =>
  rows.map(({ id: _id, ...rest }) => rest);

describe('requestToDraft', () => {
  it('turns a full request into editor rows', () => {
    const draft = requestToDraft({
      method: 'post',
      url: {
        raw: '{{base}}/users/:id?page=1',
        host: ['{{base}}'],
        path: ['users', ':id'],
        query: [
          { key: 'page', value: '1' },
          { key: 'debug', value: 'true', disabled: true, description: 'verbose' },
        ],
        variable: [{ key: 'id', value: '42' }],
      },
      header: [{ key: 'X-Trace', value: 'on', disabled: true }],
      body: { mode: 'raw', raw: '{"a":1}', options: { raw: { language: 'json' } } },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: 't' }] },
      description: 'Creates a user',
    });

    expect(draft.method).toBe('POST');
    expect(draft.url).toBe('{{base}}/users/:id?page=1');
    expect(withoutIds(draft.params)).toEqual([
      { key: 'page', value: '1', enabled: true, description: '' },
      { key: 'debug', value: 'true', enabled: false, description: 'verbose' },
    ]);
    expect(withoutIds(draft.pathVariables)).toEqual([
      { key: 'id', value: '42', enabled: true, description: '' },
    ]);
    expect(withoutIds(draft.headers)).toEqual([
      { key: 'X-Trace', value: 'on', enabled: false, description: '' },
    ]);
    expect(draft.body).toMatchObject({ mode: 'raw', raw: '{"a":1}', language: 'json' });
    expect(draft.auth).toEqual({ type: 'bearer', bearer: [{ key: 'token', value: 't' }] });
    expect(draft.description).toBe('Creates a user');
  });

  it('reads a plain string URL and fills params from its query', () => {
    const draft = requestToDraft({ method: 'GET', url: 'https://a.test/x?q=1' });
    expect(withoutIds(draft.params)).toEqual([
      { key: 'q', value: '1', enabled: true, description: '' },
    ]);
  });

  it('treats a missing auth as inherit, which the draft writes as null', () => {
    expect(requestToDraft({ method: 'GET', url: '' }).auth).toBeNull();
    expect(requestToDraft({ method: 'GET', url: '', auth: { type: 'noauth' } }).auth).toEqual({
      type: 'noauth',
    });
  });

  it('reads every body mode', () => {
    expect(
      requestToDraft({ body: { mode: 'urlencoded', urlencoded: [{ key: 'a', value: '1' }] } }).body
        .urlencoded[0],
    ).toMatchObject({ key: 'a', value: '1', enabled: true });
    expect(
      requestToDraft({
        body: {
          mode: 'formdata',
          formdata: [
            { key: 'name', value: 'x', type: 'text' },
            { key: 'avatar', type: 'file', src: 'C:/pics/me.png' },
          ],
        },
      }).body.formdata.map(({ id: _id, ...row }) => row),
    ).toEqual([
      { key: 'name', value: 'x', enabled: true, description: '', kind: 'text', files: [] },
      {
        key: 'avatar',
        value: '',
        enabled: true,
        description: '',
        kind: 'file',
        files: ['C:/pics/me.png'],
      },
    ]);
    expect(
      requestToDraft({ body: { mode: 'file', file: { src: '/tmp/a.bin' } } }).body,
    ).toMatchObject({
      mode: 'binary',
      binaryPath: '/tmp/a.bin',
    });
    expect(
      requestToDraft({ body: { mode: 'graphql', graphql: { query: '{ me }', variables: '{}' } } })
        .body,
    ).toMatchObject({ mode: 'graphql', graphqlQuery: '{ me }', graphqlVariables: '{}' });
  });

  it('reads a headers string, which some old exports use', () => {
    const draft = requestToDraft({ header: 'Accept: text/plain\n// X-Off: 1' });
    expect(withoutIds(draft.headers)).toEqual([
      { key: 'Accept', value: 'text/plain', enabled: true, description: '' },
      { key: 'X-Off', value: '1', enabled: false, description: '' },
    ]);
  });
});

describe('draftToRequest', () => {
  it('writes a v2.1 request with URL parts, disabled params kept', () => {
    const draft = requestToDraft({
      method: 'GET',
      url: {
        raw: 'https://a.test/v1?x=1',
        query: [
          { key: 'x', value: '1' },
          { key: 'y', value: '2', disabled: true },
        ],
      },
    });

    const request = draftToRequest(draft);
    expect(request.method).toBe('GET');
    expect(request.url).toMatchObject({
      raw: 'https://a.test/v1?x=1',
      protocol: 'https',
      host: ['a', 'test'],
      path: ['v1'],
      query: [
        { key: 'x', value: '1' },
        { key: 'y', value: '2', disabled: true },
      ],
    });
    expect(request).not.toHaveProperty('body');
    expect(request).not.toHaveProperty('auth');
  });

  it('leaves out empty table rows', () => {
    const draft = emptyDraft();
    draft.headers.push({ id: 'h', key: '', value: '', enabled: true, description: '' });
    expect(draftToRequest(draft).header).toEqual([]);
  });

  it('writes the raw body with its language', () => {
    const draft = emptyDraft();
    draft.method = 'POST';
    draft.body.mode = 'raw';
    draft.body.raw = '<a/>';
    draft.body.language = 'xml';
    expect(draftToRequest(draft).body).toEqual({
      mode: 'raw',
      raw: '<a/>',
      options: { raw: { language: 'xml' } },
    });
  });

  it('writes form-data text and file rows the way Postman does', () => {
    const draft = emptyDraft();
    draft.body.mode = 'formdata';
    draft.body.formdata = [
      { id: '1', key: 'n', value: 'v', enabled: true, description: '', kind: 'text', files: [] },
      {
        id: '2',
        key: 'f',
        value: '',
        enabled: false,
        description: '',
        kind: 'file',
        files: ['/a', '/b'],
      },
    ];
    expect(draftToRequest(draft).body).toEqual({
      mode: 'formdata',
      formdata: [
        { key: 'n', value: 'v', type: 'text' },
        { key: 'f', type: 'file', src: ['/a', '/b'], disabled: true },
      ],
    });
  });

  it('keeps fields the editor does not know about from the original request', () => {
    const original: PostmanRequest = {
      method: 'GET',
      url: 'https://a.test',
      proxy: { host: 'p' },
      body: { mode: 'raw', raw: 'x', disabled: true },
    };
    const request = draftToRequest(requestToDraft(original), original);
    expect(request.proxy).toEqual({ host: 'p' });
  });

  it('round-trips a request through the draft', () => {
    const original: PostmanRequest = {
      method: 'PUT',
      header: [{ key: 'A', value: '1' }],
      body: { mode: 'urlencoded', urlencoded: [{ key: 'k', value: 'v' }] },
      url: {
        raw: '{{base}}/items/:id',
        host: ['{{base}}'],
        path: ['items', ':id'],
        variable: [{ key: 'id', value: '7' }],
      },
      auth: { type: 'noauth' },
    };
    expect(draftToRequest(requestToDraft(original), original)).toEqual(original);
  });
});

describe('applyDraftToItem', () => {
  it('replaces the request and the item-level scripts, keeping saved examples', () => {
    const item: PostmanRequestItem = {
      id: 'r',
      name: 'Get',
      request: { method: 'GET', url: 'https://a.test' },
      response: [{ name: 'OK', code: 200 }],
    };
    const draft = requestToDraft(item.request);
    draft.url = 'https://b.test';
    draft.events = [{ listen: 'test', script: { exec: ['pm.test("x", () => {})'] } }];

    const next = applyDraftToItem(item, draft);
    expect(next.request.url).toMatchObject({ raw: 'https://b.test' });
    expect(next.response).toEqual([{ name: 'OK', code: 200 }]);
    expect(next.event).toHaveLength(1);
  });
});

describe('syncPathVariables', () => {
  it('lists :name segments in order, keeping values already typed', () => {
    const rows = syncPathVariables('{{base}}/orgs/:org/users/:id', [
      { id: '1', key: 'id', value: '42', enabled: true, description: 'user' },
    ]);
    expect(withoutIds(rows)).toEqual([
      { key: 'org', value: '', enabled: true, description: '' },
      { key: 'id', value: '42', enabled: true, description: 'user' },
    ]);
    expect(rows[1]?.id).toBe('1');
  });

  it('ignores a port and anything after the query', () => {
    expect(syncPathVariables('http://h:8080/a?x=:y', [])).toEqual([]);
  });
});

describe('draftSignature', () => {
  it('ignores row ids so two drafts of the same request compare equal', () => {
    const request: PostmanRequest = { method: 'GET', url: 'https://a.test?x=1' };
    expect(draftSignature(requestToDraft(request))).toBe(draftSignature(requestToDraft(request)));
  });

  it('changes when anything the user sees changes', () => {
    const a = requestToDraft({ method: 'GET', url: 'https://a.test' });
    const b = requestToDraft({ method: 'GET', url: 'https://a.test/' });
    expect(draftSignature(a)).not.toBe(draftSignature(b));
  });
});
