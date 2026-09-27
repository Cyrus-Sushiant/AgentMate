import { describe, expect, it } from 'vitest';
import {
  bodyLanguage,
  formatBytes,
  formatDuration,
  methodLabel,
  methodTone,
  prettyBody,
  statusTone,
} from './format';

describe('methodTone and methodLabel', () => {
  it('gives each common method its own colour, and a neutral one for the rest', () => {
    const tones = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(methodTone);
    expect(new Set(tones).size).toBe(5);
    expect(methodTone('get')).toBe(methodTone('GET'));
    expect(methodTone('PROPFIND')).toBe(methodTone('OPTIONS'));
  });

  it('shortens long methods for the sidebar, like Postman', () => {
    expect(methodLabel('DELETE')).toBe('DEL');
    expect(methodLabel('OPTIONS')).toBe('OPT');
    expect(methodLabel('patch')).toBe('PATCH');
    expect(methodLabel('GET')).toBe('GET');
  });
});

describe('statusTone', () => {
  it('colours by status class', () => {
    expect(statusTone(204)).toBe('success');
    expect(statusTone(301)).toBe('info');
    expect(statusTone(404)).toBe('warning');
    expect(statusTone(503)).toBe('danger');
    expect(statusTone(101)).toBe('info');
  });
});

describe('formatBytes and formatDuration', () => {
  it('uses the smallest unit that reads well', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('shows milliseconds under a second and seconds above', () => {
    expect(formatDuration(0.4)).toBe('0 ms');
    expect(formatDuration(245.6)).toBe('246 ms');
    expect(formatDuration(1234)).toBe('1.23 s');
  });
});

describe('bodyLanguage', () => {
  it('maps media types to an editor language', () => {
    expect(bodyLanguage('application/json')).toBe('json');
    expect(bodyLanguage('application/vnd.api+json')).toBe('json');
    expect(bodyLanguage('application/xml')).toBe('xml');
    expect(bodyLanguage('text/html')).toBe('html');
    expect(bodyLanguage('application/javascript')).toBe('javascript');
    expect(bodyLanguage('text/css')).toBe('css');
    expect(bodyLanguage('text/plain')).toBe('plaintext');
    expect(bodyLanguage('')).toBe('plaintext');
  });
});

describe('prettyBody', () => {
  it('indents JSON', () => {
    expect(prettyBody('{"a":1,"b":[1,2]}', 'json')).toBe(
      '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}',
    );
  });

  it('leaves invalid JSON and other languages alone', () => {
    expect(prettyBody('{oops', 'json')).toBe('{oops');
    expect(prettyBody('<a><b/></a>', 'xml')).toBe('<a><b/></a>');
  });

  it('does not try to format very large bodies', () => {
    const big = `[${'1,'.repeat(3_000_000)}1]`;
    expect(prettyBody(big, 'json')).toBe(big);
  });
});
