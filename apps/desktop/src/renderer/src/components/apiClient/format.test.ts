import { describe, expect, it } from 'vitest';
import {
  bodyLanguage,
  canPreview,
  formatBytes,
  formatDuration,
  methodLabel,
  methodTone,
  prettyBody,
  previewDocument,
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

describe('canPreview', () => {
  it('offers a preview for HTML and SVG only', () => {
    expect(canPreview('text/html')).toBe(true);
    expect(canPreview('application/xhtml+xml')).toBe(true);
    expect(canPreview('image/svg+xml')).toBe(true);
    expect(canPreview('application/json')).toBe(false);
    expect(canPreview('text/plain')).toBe(false);
  });
});

describe('previewDocument', () => {
  it('adds a base tag inside head so relative links point at the server', () => {
    expect(
      previewDocument(
        '<html><head><title>x</title></head><body>hi</body></html>',
        'https://a.test/app/page',
      ),
    ).toBe(
      '<html><head><base href="https://a.test/app/page"><title>x</title></head><body>hi</body></html>',
    );
  });

  it('puts the base tag first when there is no head', () => {
    expect(previewDocument('<p>hi</p>', 'https://a.test/')).toBe(
      '<base href="https://a.test/"><p>hi</p>',
    );
  });

  it('escapes the URL and leaves the document alone without one', () => {
    expect(previewDocument('<head></head>', 'https://a.test/?q="x"&y')).toBe(
      '<head><base href="https://a.test/?q=&quot;x&quot;&amp;y"></head>',
    );
    expect(previewDocument('<p>hi</p>', null)).toBe('<p>hi</p>');
  });
});
