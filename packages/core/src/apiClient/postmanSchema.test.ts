import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isFolder } from './collectionTree.js';
import { createCollection, parseCollection } from './postmanSchema.js';
import { POSTMAN_SCHEMA_V21 } from './types.js';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8'));

describe('parseCollection', () => {
  it('reads a Postman v2.1 export', () => {
    const result = parseCollection(fixture('simple.postman_collection.json'));
    if (!result.ok) throw new Error(result.error);

    const { collection } = result;
    expect(collection.info.name).toBe('Sample API');
    expect(collection.item).toHaveLength(2);
    const folder = collection.item[1];
    expect(folder && isFolder(folder)).toBe(true);
  });

  it('gives every item an id, keeping the ones that were already there', () => {
    const result = parseCollection(fixture('simple.postman_collection.json'));
    if (!result.ok) throw new Error(result.error);

    const [first, folder] = result.collection.item;
    expect(first?.id).toBe('req-list-users');
    expect(folder?.id).toMatch(/[0-9a-f-]{36}/);
    if (!folder || !isFolder(folder)) throw new Error('expected a folder');
    expect(folder.item[0]?.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('keeps fields it does not know about, so nothing is lost on the way back out', () => {
    const result = parseCollection(fixture('simple.postman_collection.json'));
    if (!result.ok) throw new Error(result.error);

    expect(result.collection.info._exporter_id).toBe('123');
    expect(result.collection.item[0]?.protocolProfileBehavior).toEqual({
      disableBodyPruning: true,
    });
  });

  it('never changes the object it was given', () => {
    const input = fixture('simple.postman_collection.json') as { item: { id?: string }[] };
    parseCollection(input);
    expect(input.item[1]?.id).toBeUndefined();
  });

  it('turns a missing request method into GET', () => {
    const result = parseCollection({
      info: { name: 'x', schema: POSTMAN_SCHEMA_V21 },
      item: [{ name: 'r', request: { url: 'https://a.test' } }],
    });
    if (!result.ok) throw new Error(result.error);
    const [item] = result.collection.item;
    expect(item && !isFolder(item) && item.request.method).toBe('GET');
  });

  it('accepts the shorthand v2.1 allows, where request is just a URL string', () => {
    const result = parseCollection({
      info: { name: 'x', schema: POSTMAN_SCHEMA_V21 },
      item: [{ name: 'r', request: 'https://a.test/ping' }],
    });
    if (!result.ok) throw new Error(result.error);
    const [item] = result.collection.item;
    expect(item && !isFolder(item) && item.request).toEqual({
      method: 'GET',
      url: 'https://a.test/ping',
    });
  });

  it('explains what is wrong with something that is not a collection', () => {
    const notObject = parseCollection('hello');
    expect(notObject).toEqual({ ok: false, error: expect.stringContaining('collection') });

    const noItems = parseCollection({ info: { name: 'x', schema: POSTMAN_SCHEMA_V21 } });
    expect(noItems.ok).toBe(false);

    const environment = parseCollection({ name: 'Env', values: [] });
    expect(environment).toEqual({ ok: false, error: expect.stringMatching(/environment/i) });
  });

  it('points a Postman v1 file at the right fix instead of a schema error', () => {
    const result = parseCollection({ id: 'x', name: 'Old', requests: [], order: [] });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/v1/) });
  });
});

describe('createCollection', () => {
  it('makes an empty v2.1 collection with an id', () => {
    const collection = createCollection('  Billing  ');
    expect(collection.info.name).toBe('Billing');
    expect(collection.info.schema).toBe(POSTMAN_SCHEMA_V21);
    expect(collection.info._postman_id).toMatch(/[0-9a-f-]{36}/);
    expect(collection.item).toEqual([]);
  });

  it('falls back to a default name', () => {
    expect(createCollection('').info.name).toBe('New Collection');
  });
});
