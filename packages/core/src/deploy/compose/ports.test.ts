import { describe, expect, it } from 'vitest';
import { parseComposeFile } from './parse.js';
import { analyzeComposePorts, type ComposePortSpec, readComposePortEntry } from './ports.js';

function specs(entry: unknown): ComposePortSpec[] {
  const read = readComposePortEntry(entry);
  if (!read.ok) throw new Error(read.reason);
  return read.bindings;
}

function refusal(entry: unknown): string {
  const read = readComposePortEntry(entry);
  if (read.ok) throw new Error(`expected a refusal, got ${JSON.stringify(read.bindings)}`);
  return read.reason;
}

const spec = (overrides: Partial<ComposePortSpec>): ComposePortSpec => ({
  hostIp: null,
  published: null,
  target: 80,
  protocol: 'tcp',
  exposure: 'all-interfaces',
  name: null,
  appProtocol: null,
  ...overrides,
});

describe('readComposePortEntry, short syntax', () => {
  it('reads the forms in the Compose documentation', () => {
    expect(specs('3000')).toEqual([spec({ target: 3000 })]);
    expect(specs(3000)).toEqual([spec({ target: 3000 })]);
    expect(specs('3000-3002')).toEqual([
      spec({ target: 3000 }),
      spec({ target: 3001 }),
      spec({ target: 3002 }),
    ]);
    expect(specs('8000:8000')).toEqual([spec({ target: 8000, published: '8000' })]);
    expect(specs('9090-9091:8080-8081')).toEqual([
      spec({ target: 8080, published: '9090' }),
      spec({ target: 8081, published: '9091' }),
    ]);
    expect(specs('49100:22')).toEqual([spec({ target: 22, published: '49100' })]);
    // A host range for a single container port lets Docker pick a free one inside it.
    expect(specs('8000-9000:80')).toEqual([spec({ target: 80, published: '8000-9000' })]);
    expect(specs('6060:6060/udp')).toEqual([
      spec({ target: 6060, published: '6060', protocol: 'udp' }),
    ]);
    expect(specs('6060:6060/UDP')[0].protocol).toBe('udp');
  });

  it('tells loopback, every interface and one interface apart', () => {
    const loopback = { hostIp: '127.0.0.1', exposure: 'loopback' as const };
    expect(specs('127.0.0.1:8001:8001')).toEqual([
      spec({ ...loopback, target: 8001, published: '8001' }),
    ]);
    expect(specs('127.0.0.1:5000-5001:5000-5001')).toHaveLength(2);
    expect(specs('127.0.0.1::80')).toEqual([spec({ ...loopback })]);
    expect(specs('::1:6000:6000')).toEqual([
      spec({ hostIp: '::1', exposure: 'loopback', target: 6000, published: '6000' }),
    ]);
    expect(specs('[::1]:6001:6001')[0]).toMatchObject({ hostIp: '::1', exposure: 'loopback' });
    expect(specs('0.0.0.0:80:80')[0]).toMatchObject({
      hostIp: '0.0.0.0',
      exposure: 'all-interfaces',
    });
    expect(specs('[::]:443:443')[0]).toMatchObject({ hostIp: '::', exposure: 'all-interfaces' });
    expect(specs('10.0.0.5:8080:80')[0]).toMatchObject({
      hostIp: '10.0.0.5',
      exposure: 'specific',
    });
    expect(specs('127.0.0.2:80:80')[0].exposure).toBe('loopback');
  });

  it('explains entries it cannot read', () => {
    expect(refusal('${PORT}:80')).toMatch(/\$\{\.\.\.\}/);
    expect(refusal('80:80/icmp')).toMatch(/tcp, udp or sctp/);
    expect(refusal('1.2.3:80:80')).toMatch(/IP address/);
    expect(refusal('[::1:80:80')).toMatch(/IP address/);
    expect(refusal('8000-8001:80-82')).toMatch(/differ in size/);
    expect(refusal('70000:80')).toMatch(/1 to 65535/);
    expect(refusal('0:80')).toMatch(/1 to 65535/);
    expect(refusal('/udp')).toMatch(/no container port/);
    expect(refusal('')).toMatch(/no container port/);
    expect(refusal('web')).toMatch(/not a port/);
    expect(refusal('81-80')).toMatch(/backwards/);
    expect(refusal('1-2000')).toMatch(/more than 1000/);
    expect(refusal(80.5)).toMatch(/not a port/);
    expect(refusal(true)).toMatch(/not a port/);
  });
});

describe('readComposePortEntry, long syntax', () => {
  it('reads every field Compose defines', () => {
    expect(
      specs({
        target: 80,
        published: '8080',
        host_ip: '127.0.0.1',
        protocol: 'tcp',
        mode: 'host',
        name: 'web',
        app_protocol: 'http',
      }),
    ).toEqual([
      spec({
        hostIp: '127.0.0.1',
        exposure: 'loopback',
        published: '8080',
        name: 'web',
        appProtocol: 'http',
      }),
    ]);
    expect(specs({ target: 80 })).toEqual([spec({})]);
    expect(specs({ target: '80', published: 8080 })).toEqual([spec({ published: '8080' })]);
    expect(specs({ target: 80, published: '8000-8010' })[0].published).toBe('8000-8010');
    expect(specs({ target: 53, protocol: 'udp', host_ip: '::' })[0]).toMatchObject({
      protocol: 'udp',
      hostIp: '::',
      exposure: 'all-interfaces',
    });
    expect(specs({ target: 80, host_ip: '[::1]' })[0].hostIp).toBe('::1');
    expect(specs({ target: 80, published: '' })[0].published).toBeNull();
  });

  it('explains long entries it cannot read', () => {
    expect(refusal({ published: '8080' })).toMatch(/target/);
    expect(refusal({ target: '80-81' })).toMatch(/one container port/);
    expect(refusal({ target: 80, published: '${WEB}' })).toMatch(/\$\{\.\.\.\}/);
    expect(refusal({ target: 80, host_ip: 'localhost' })).toMatch(/IP address/);
    expect(refusal({ target: 80, protocol: 'http' })).toMatch(/tcp, udp or sctp/);
  });
});

describe('analyzeComposePorts', () => {
  it('lists what each service publishes, and what it cannot read', () => {
    const parsed = parseComposeFile(
      [
        'services:',
        '  web:',
        '    image: nginx',
        '    ports: ["8080:80", "127.0.0.1:8443:443", "${ADMIN}:9000"]',
        '    expose: ["9100", 9200]',
        '  cache:',
        '    image: redis',
        '  agent:',
        '    image: agent',
        '    network_mode: host',
        '  odd:',
        '    image: odd',
        '    ports: "8080:80"',
      ].join('\n'),
    );
    if (!parsed.ok) throw new Error(parsed.reason);
    const services = analyzeComposePorts(parsed.project);
    expect(services.map((service) => service.service)).toEqual(['web', 'cache', 'agent', 'odd']);
    const [web, cache, agent, odd] = services;
    expect(
      web.bindings.map((binding) => [binding.index, binding.published, binding.exposure]),
    ).toEqual([
      [0, '8080', 'all-interfaces'],
      [1, '8443', 'loopback'],
    ]);
    expect(web.bindings[0].service).toBe('web');
    expect(web.problems).toEqual([{ index: 2, reason: expect.stringMatching(/\$\{\.\.\.\}/) }]);
    expect(web.exposed).toEqual(['9100', '9200']);
    expect(cache).toMatchObject({ bindings: [], problems: [], hostNetwork: false });
    expect(agent.hostNetwork).toBe(true);
    expect(odd.problems[0].reason).toMatch(/must be a list/);
  });
});
