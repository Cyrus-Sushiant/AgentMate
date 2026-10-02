import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lintComposeProject } from './lint.js';
import { parseComposeFile } from './parse.js';

/**
 * The app and the core lint the same compose file, the app from the YAML and the core from
 * `docker compose config` (ComposeConfigLint.cs, checked against the same expected ids by
 * StackLintParityTests.cs). Every finding that needs an acknowledgment must carry the same id
 * on both sides, or a deploy the app let through would be refused on the server.
 */

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('lint parity with the core', () => {
  it('finds exactly the expected ids that need an acknowledgment', () => {
    const parsed = parseComposeFile(read('lint-parity.compose.yaml'));
    if (!parsed.ok) throw new Error(parsed.reason);
    const ids = lintComposeProject(parsed.project, { proxiedServices: ['proxied'] })
      .filter((risk) => risk.severity !== 'low')
      .map((risk) => risk.id);
    expect(ids).toEqual(JSON.parse(read('lint-parity.expected.json')));
  });
});
