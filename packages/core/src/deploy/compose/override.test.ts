import { describe, expect, it } from 'vitest';
import { parseDocument, YAMLSeq } from 'yaml';
import {
  composeSupportsOverride,
  type LoopbackOverride,
  renderLoopbackOverride,
} from './override.js';
import { parseComposeFile } from './parse.js';

const FILE = [
  'services:',
  '  web:',
  '    image: nginx:1.27',
  '    ports:',
  '      - "8080:80"',
  '      - "9000-9001:9000-9001/udp"',
  '      - target: 443',
  '        published: "8443"',
  '        host_ip: 0.0.0.0',
  '        name: https',
  '        app_protocol: https',
  '      - "3000"',
  '  db:',
  '    image: postgres:16',
  '    ports: ["5432:5432"]',
  '  worker:',
  '    image: worker:1',
].join('\n');

function override(
  text: string,
  services: string[],
  environment?: Record<string, string>,
): LoopbackOverride {
  const parsed = parseComposeFile(text, { environment });
  if (!parsed.ok) throw new Error(parsed.reason);
  const result = renderLoopbackOverride(parsed.project, services);
  if (!result.ok) throw new Error(result.reason);
  return result.override;
}

function refusal(text: string, services: string[]): string {
  const parsed = parseComposeFile(text);
  if (!parsed.ok) throw new Error(parsed.reason);
  const result = renderLoopbackOverride(parsed.project, services);
  if (result.ok) throw new Error('expected a refusal');
  return result.reason;
}

/** The override read back with Compose's tag, the way Compose reads it. */
function readBack(text: string) {
  const document = parseDocument(text, {
    customTags: [{ tag: '!override', collection: 'seq', nodeClass: YAMLSeq }],
  });
  expect(document.errors).toEqual([]);
  expect(document.warnings).toEqual([]);
  return document;
}

describe('renderLoopbackOverride', () => {
  it("replaces a proxied service's ports with loopback bindings, using !override", () => {
    const { text, rebound, unpublished } = override(FILE, ['web']);
    expect(text).toMatch(/^# /);
    expect(text).toContain('ports: !override');
    const document = readBack(text);
    expect(document.getIn(['services', 'web', 'ports'], true)).toHaveProperty('tag', '!override');
    expect(document.toJS()).toEqual({
      services: {
        web: {
          ports: [
            { target: 80, published: '8080', host_ip: '127.0.0.1', protocol: 'tcp' },
            { target: 9000, published: '9000', host_ip: '127.0.0.1', protocol: 'udp' },
            { target: 9001, published: '9001', host_ip: '127.0.0.1', protocol: 'udp' },
            {
              target: 443,
              published: '8443',
              host_ip: '127.0.0.1',
              protocol: 'tcp',
              name: 'https',
              app_protocol: 'https',
            },
            { target: 3000, host_ip: '127.0.0.1', protocol: 'tcp' },
          ],
        },
      },
    });
    expect(rebound).toHaveLength(5);
    expect(rebound.every((binding) => binding.hostIp === '127.0.0.1')).toBe(true);
    expect(rebound.every((binding) => binding.exposure === 'loopback')).toBe(true);
    expect(unpublished).toEqual([]);
  });

  it('leaves services that are not proxied alone, and notes proxied ones with no port', () => {
    const { text, unpublished } = override(FILE, ['worker', 'web', 'web']);
    expect(Object.keys(readBack(text).toJS().services)).toEqual(['web']);
    expect(unpublished).toEqual(['worker']);
    expect(readBack(override(FILE, []).text).toJS()).toEqual({ services: {} });
  });

  it('binds the port the environment resolves to', () => {
    const file = 'services:\n  web:\n    image: nginx:1.27\n    ports: ["${WEB_PORT:-8080}:80"]\n';
    expect(override(file, ['web'], { WEB_PORT: '9090' }).rebound[0]).toMatchObject({
      published: '9090',
      target: 80,
      hostIp: '127.0.0.1',
    });
    expect(override(file, ['web'], {}).rebound[0].published).toBe('8080');
  });

  it('keeps a $ in a port name from being read as a variable', () => {
    const file = [
      'services:',
      '  web:',
      '    image: nginx:1.27',
      '    ports:',
      '      - target: 80',
      '        name: "cost$$5"',
    ].join('\n');
    const { text } = override(file, ['web'], {});
    expect(readBack(text).toJS().services.web.ports[0].name).toBe('cost$$5');
  });

  it('refuses what it cannot bind to loopback, saying why', () => {
    expect(refusal(FILE, ['api'])).toMatch(/no service called api/);
    expect(
      refusal('services:\n  agent:\n    image: a:1\n    network_mode: host\n', ['agent']),
    ).toMatch(/network_mode: host/);
    expect(
      refusal('services:\n  web:\n    image: a:1\n    ports: ["${PORT}:80"]\n', ['web']),
    ).toMatch(/\$\{\.\.\.\}/);
  });
});

describe('composeSupportsOverride', () => {
  it.each([
    ['2.24.4', true],
    ['v2.24.4', true],
    ['2.24.5-desktop.1', true],
    ['Docker Compose version v2.29.1', true],
    ['v5.5.1', true],
    ['2.24.3', false],
    ['2.23.9', false],
    ['1.29.2', false],
    ['not a version', false],
  ])('%s gives %s', (version, supported) => {
    expect(composeSupportsOverride(version)).toBe(supported);
  });
});
