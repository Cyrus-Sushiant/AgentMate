import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseComposeFile } from '../compose/parse.js';
import { defineCatalogTemplate, identifierParam, portParam } from './define.js';
import { renderCatalogApp } from './render.js';
import type { PinnedImage } from './types.js';

const pin = (tag: string, digit: string): PinnedImage => ({
  repository: 'docker.io/library/example',
  tag,
  digest: `sha256:${digit.repeat(64)}`,
  platforms: ['linux/amd64', 'linux/arm64'],
  source: 'docker-official',
  publisher: 'Docker Official Images',
  resolvedAt: '2026-10-01',
});

const EXAMPLE = defineCatalogTemplate({
  id: 'example',
  name: 'Example',
  description: 'A made-up app for the tests.',
  category: 'developer',
  homepage: 'https://example.com',
  versions: [
    { id: '2', label: 'Example 2', images: { app: pin('2.1', 'a'), db: pin('16', 'b') } },
    { id: '1', label: 'Example 1', images: { app: pin('1.9', 'c'), db: pin('15', 'd') } },
  ],
  defaultVersion: '2',
  parameters: z.object({
    port: portParam(8080),
    database: identifierParam('example'),
    greeting: z.string().max(40).default('cost: $5'),
    gpu: z.boolean().default(false),
    network: z
      .string()
      .regex(/^[a-z_]+$/)
      .optional(),
  }),
  fields: {
    port: { label: 'Port', help: 'Where it listens.', input: 'port' },
    database: { label: 'Database name', help: 'Created on first start.', input: 'text' },
    greeting: { label: 'Greeting', help: 'Shown on the front page.', input: 'text' },
    gpu: { label: 'Use the GPU', help: 'Needs the NVIDIA toolkit.', input: 'toggle' },
    network: { label: 'Network', help: 'Another app to reach.', input: 'text' },
  },
  secrets: [
    { key: 'EXAMPLE_DB_PASSWORD', label: 'Database password', kind: 'password', length: 32 },
    { key: 'EXAMPLE_GPU_TOKEN', label: 'GPU token', kind: 'hex', length: 16 },
  ],
  secretInUse: (key, params) => key !== 'EXAMPLE_GPU_TOKEN' || params.gpu,
  minMemoryMb: 256,
  firstVisitorSetup: false,
  exposureNote: null,
  acknowledgments: [],
  build: ({ version, params, secret, publicUrl }) => ({
    services: {
      app: {
        image: 'app',
        command: ['serve', '--name', params.database],
        environment: {
          GREETING: params.greeting,
          DB_PASSWORD: { secret: 'EXAMPLE_DB_PASSWORD' },
          URL: publicUrl ?? `http://127.0.0.1:${params.port}`,
          ...(params.gpu ? { GPU_TOKEN: { secret: 'EXAMPLE_GPU_TOKEN' } } : {}),
        },
        ports: [{ label: 'Web', target: 80, published: params.port }],
        volumes: [{ volume: 'files', target: '/files' }],
        healthcheck: { test: ['CMD', 'true'], startPeriod: '10s' },
        dependsOn: ['db'],
        gpu: params.gpu,
        externalNetworks: params.network ? [params.network] : undefined,
      },
      db: {
        image: 'db',
        user: '999:999',
        environment: { POSTGRES_PASSWORD: { secret: 'EXAMPLE_DB_PASSWORD' } },
        volumes: [{ volume: 'db', target: '/var/lib/data' }],
        healthcheck: { test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER'] },
      },
    },
    web: { service: 'app', port: 80 },
    facts: [
      { id: 'version', label: 'Version', value: version.label, sensitive: false },
      {
        id: 'url',
        label: 'Connection string',
        value: `postgres://app:${secret('EXAMPLE_DB_PASSWORD')}@127.0.0.1/${params.database}`,
        sensitive: true,
      },
    ],
  }),
});

const SECRETS = {
  EXAMPLE_DB_PASSWORD: 'Tq8vYb2LmN4pXr6sZw0aCd3eFg5hJk7u',
  EXAMPLE_GPU_TOKEN: '00112233445566778899aabbccddeeff',
};

function rendered(input: Parameters<typeof renderCatalogApp>[1]) {
  const result = renderCatalogApp(EXAMPLE, input);
  if (!result.ok) throw new Error(result.reason);
  return result.render;
}

function compose(text: string, environment?: Record<string, string>) {
  const parsed = parseComposeFile(text, environment ? { environment } : {});
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.project;
}

describe('renderCatalogApp', () => {
  it('writes a hardened compose file with pinned images and loopback ports', () => {
    const { compose: text, images, ports, volumes } = rendered({ secrets: SECRETS });
    const app = compose(text).data.services as Record<string, Record<string, unknown>>;
    expect(app.app.image).toBe(`docker.io/library/example:2.1@sha256:${'a'.repeat(64)}`);
    expect(app.db.image).toBe(`docker.io/library/example:16@sha256:${'b'.repeat(64)}`);
    expect(app.app.restart).toBe('unless-stopped');
    expect(app.app.security_opt).toEqual(['no-new-privileges:true']);
    expect(app.app.ports).toEqual(['127.0.0.1:8080:80']);
    expect(app.app.depends_on).toEqual({ db: { condition: 'service_healthy' } });
    expect(app.db.user).toBe('999:999');
    expect(app.db.healthcheck).toMatchObject({
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER'],
      interval: '30s',
      retries: 5,
    });
    expect(app.app.healthcheck).toMatchObject({ start_period: '10s' });
    expect(app.app.deploy).toBeUndefined();
    expect(app.app.networks).toBeUndefined();
    expect(images).toEqual([
      { service: 'app', role: 'app', reference: app.app.image },
      { service: 'db', role: 'db', reference: app.db.image },
    ]);
    expect(ports).toEqual([
      {
        service: 'app',
        label: 'Web',
        hostIp: '127.0.0.1',
        published: 8080,
        target: 80,
        protocol: 'tcp',
      },
    ]);
    expect(volumes).toEqual(['files', 'db']);
  });

  it('keeps secrets in the env and only references in the compose file', () => {
    const result = rendered({ secrets: SECRETS, params: { gpu: true } });
    expect(result.compose).not.toContain(SECRETS.EXAMPLE_DB_PASSWORD);
    expect(result.compose).not.toContain(SECRETS.EXAMPLE_GPU_TOKEN);
    expect(result.compose).toContain('${EXAMPLE_DB_PASSWORD:?');
    expect(result.env).toEqual(SECRETS);
    expect(result.envFile).toContain(`EXAMPLE_DB_PASSWORD="${SECRETS.EXAMPLE_DB_PASSWORD}"`);
    const project = compose(result.compose, result.env);
    expect(project.missingVariables).toEqual([]);
    const services = project.data.services as Record<string, { environment: object }>;
    expect(services.app.environment).toMatchObject({
      DB_PASSWORD: SECRETS.EXAMPLE_DB_PASSWORD,
      GPU_TOKEN: SECRETS.EXAMPLE_GPU_TOKEN,
    });
  });

  it('leaves secrets the parameters do not use out of the env', () => {
    expect(Object.keys(rendered({ secrets: SECRETS }).env)).toEqual(['EXAMPLE_DB_PASSWORD']);
  });

  it('escapes $ in literal values so Compose passes them through', () => {
    const result = rendered({ secrets: SECRETS });
    expect(result.compose).toContain('cost: $$5');
    const services = compose(result.compose, result.env).data.services as Record<
      string,
      { environment: Record<string, string> }
    >;
    expect(services.app.environment.GREETING).toBe('cost: $5');
  });

  it('is byte for byte the same for the same inputs', () => {
    const input = { secrets: SECRETS, params: { gpu: true, port: 9000 } };
    const first = rendered(input);
    const second = rendered({ ...input, secrets: { ...SECRETS } });
    expect(second.compose).toBe(first.compose);
    expect(second.envFile).toBe(first.envFile);
  });

  it('picks the version, the GPU and an external network from the parameters', () => {
    const result = rendered({
      version: '1',
      secrets: SECRETS,
      params: { gpu: true, network: 'shared_net' },
    });
    const project = compose(result.compose);
    const app = (project.data.services as Record<string, Record<string, unknown>>).app;
    expect(app.image).toBe(`docker.io/library/example:1.9@sha256:${'c'.repeat(64)}`);
    expect(app.deploy).toEqual({
      resources: {
        reservations: { devices: [{ driver: 'nvidia', count: 'all', capabilities: ['gpu'] }] },
      },
    });
    expect(app.networks).toEqual(['default', 'shared_net']);
    expect(project.data.networks).toEqual({ shared_net: { name: 'shared_net', external: true } });
    expect(result.version.id).toBe('1');
  });

  it('points facts at the domain when there is one, and masks the sensitive ones', () => {
    const result = rendered({ secrets: SECRETS, domain: 'Example.COM' });
    const services = compose(result.compose).data.services as Record<
      string,
      { environment: Record<string, string> }
    >;
    expect(services.app.environment.URL).toBe('https://example.com');
    expect(result.publicUrl).toBe('https://example.com');
    const url = result.facts.find((fact) => fact.id === 'url');
    expect(url?.value).toContain(SECRETS.EXAMPLE_DB_PASSWORD);
    expect(url?.masked).toBe('postgres://app:********@127.0.0.1/example');
    expect(result.facts[0].masked).toBe('Example 2');
  });

  it('runs the risk linter and reports what is left unacknowledged', () => {
    const result = rendered({ secrets: SECRETS });
    expect(result.risks).toEqual([]);
    expect(result.unacknowledged).toEqual([]);
    expect(result.web).toEqual({ service: 'app', port: 80 });
  });

  it('refuses parameters that do not fit, naming the field', () => {
    const cases: [Record<string, unknown>, string, RegExp][] = [
      [{ port: 0 }, 'port', /^Port: /],
      [{ port: 70000 }, 'port', /65535/],
      [{ database: 'drop table;' }, 'database', /^Database name: /],
      [{ database: '' }, 'database', /Database name/],
      [{ gpu: 'yes' }, 'gpu', /Use the GPU/],
    ];
    for (const [params, field, reason] of cases) {
      const result = renderCatalogApp(EXAMPLE, { secrets: SECRETS, params });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.field).toBe(field);
      expect(result.reason).toMatch(reason);
    }
  });

  it('refuses a missing or weak secret without repeating it', () => {
    const missing = renderCatalogApp(EXAMPLE, { secrets: {} });
    expect(missing).toMatchObject({ ok: false, field: 'EXAMPLE_DB_PASSWORD' });
    const weak = renderCatalogApp(EXAMPLE, {
      secrets: { ...SECRETS, EXAMPLE_DB_PASSWORD: 'password' },
    });
    expect(weak.ok).toBe(false);
    if (!weak.ok) {
      expect(weak.reason).toMatch(/Database password/);
      expect(weak.reason).not.toContain('password"');
    }
    const unused = renderCatalogApp(EXAMPLE, {
      secrets: { EXAMPLE_DB_PASSWORD: SECRETS.EXAMPLE_DB_PASSWORD, EXAMPLE_GPU_TOKEN: 'x' },
    });
    expect(unused.ok).toBe(true);
  });

  it('refuses an unknown version and a bad domain', () => {
    expect(renderCatalogApp(EXAMPLE, { secrets: SECRETS, version: '0' })).toMatchObject({
      ok: false,
      field: 'version',
    });
    expect(renderCatalogApp(EXAMPLE, { secrets: SECRETS, domain: 'not a domain' })).toMatchObject({
      ok: false,
      field: 'domain',
    });
  });
});

describe('defineCatalogTemplate', () => {
  it('refuses a template whose default version is not listed', () => {
    expect(() => defineCatalogTemplate({ ...EXAMPLE, defaultVersion: '9' })).toThrow(/9/);
  });

  it('refuses two versions or two secrets with the same id', () => {
    expect(() =>
      defineCatalogTemplate({ ...EXAMPLE, versions: [EXAMPLE.versions[0], EXAMPLE.versions[0]] }),
    ).toThrow(/two versions/);
    expect(() =>
      defineCatalogTemplate({ ...EXAMPLE, secrets: [EXAMPLE.secrets[0], EXAMPLE.secrets[0]] }),
    ).toThrow(/two secrets/);
  });

  it('refuses a template whose fields do not match its parameters', () => {
    expect(() =>
      defineCatalogTemplate({
        ...EXAMPLE,
        fields: { port: EXAMPLE.fields.port } as typeof EXAMPLE.fields,
      }),
    ).toThrow(/database/);
  });
});
