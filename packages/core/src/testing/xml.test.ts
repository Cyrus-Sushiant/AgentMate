import { describe, expect, it } from 'vitest';
import { parseXml } from './xml.js';

describe('parseXml', () => {
  it('reads nested elements, attributes and text with entities', () => {
    const root = parseXml(
      '<?xml version="1.0"?>\n<!-- note --><a x="1" y=\'two &amp; three\'><b>hi &lt;there&gt; &#10;&#x41;</b><c/><b>again</b></a>',
    );
    expect(root?.name).toBe('a');
    expect(root?.attributes).toEqual({ x: '1', y: 'two & three' });
    expect(root?.children.map((child) => child.name)).toEqual(['b', 'c', 'b']);
    expect(root?.children[0].text).toBe('hi <there> \nA');
  });

  it('keeps CDATA as text and strips namespaces from names', () => {
    const root = parseXml(
      '<t:TestRun xmlns:t="urn:x"><t:Message><![CDATA[a < b && "c"]]></t:Message></t:TestRun>',
    );
    expect(root?.name).toBe('TestRun');
    expect(root?.children[0].name).toBe('Message');
    expect(root?.children[0].text).toBe('a < b && "c"');
  });

  it('skips a byte order mark and a doctype', () => {
    expect(parseXml('﻿<!DOCTYPE x><x/>')?.name).toBe('x');
  });

  it('returns null for text that is not XML', () => {
    expect(parseXml('')).toBeNull();
    expect(parseXml('not xml at all')).toBeNull();
  });

  it('survives a truncated document by closing what is open', () => {
    const root = parseXml('<a><b n="1"/><b n="2">tex');
    expect(root?.children.map((child) => child.attributes.n)).toEqual(['1', '2']);
  });
});
