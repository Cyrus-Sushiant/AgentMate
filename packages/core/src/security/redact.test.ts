import { describe, expect, it } from 'vitest';
import { makeFinding } from './__fixtures__/findings.js';
import { maskKnownSecrets, maskSecrets, redactSecretFindings } from './redact.js';

/**
 * Two failures matter here and they pull in opposite directions. Leaving a live credential in a
 * finding turns the "copy for AI" button into an exfiltration path, and redacting ordinary prose
 * about keys and tokens hides the finding the user needs to read. Both directions get cases.
 */

const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET = 'wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEYAB';
const GITHUB_TOKEN = 'ghp_' + 'a'.repeat(36);
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';

describe('maskSecrets', () => {
  it('masks vendor-prefixed keys and reports that it changed something', () => {
    const cases: string[] = [
      'sk-' + 'A'.repeat(32),
      'pk-' + 'b1c2d3e4f5g6h7i8',
      GITHUB_TOKEN,
      'gho_' + 'Z'.repeat(20),
      'xoxb-1234567890-abcdefghij',
      AWS_KEY,
      'AIza' + 'a'.repeat(35),
    ];
    for (const secret of cases) {
      const result = maskSecrets('token = ' + secret);
      expect(result.changed, secret).toBe(true);
      expect(result.text, secret).not.toContain(secret);
      expect(result.text, secret).toContain('[redacted ');
    }
  });

  it('masks a JWT and a PEM private key block across lines', () => {
    expect(maskSecrets('Authorization: Bearer ' + JWT).text).toBe(
      'Authorization: Bearer [redacted ' + JWT.length + ' chars]',
    );

    const pem = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIBOgIBAAJBAKj34GkxFhD90vcNLYLI',
      '-----END RSA PRIVATE KEY-----',
    ].join('\n');
    const masked = maskSecrets('key = """\n' + pem + '\n"""');
    expect(masked.changed).toBe(true);
    expect(masked.text).not.toContain('BEGIN RSA PRIVATE KEY');
  });

  it('masks a credential embedded in a URL', () => {
    const masked = maskSecrets(
      'git remote add origin https://user:' + GITHUB_TOKEN + '@github.com',
    );
    expect(masked.text).toBe('git remote add origin https://user:[redacted 40 chars]@github.com');
  });

  it('masks a long value on a .env style line', () => {
    const masked = maskSecrets('AWS_SECRET_ACCESS_KEY=' + AWS_SECRET);
    expect(masked.text).toBe('AWS_SECRET_ACCESS_KEY=[redacted 40 chars]');
  });

  it('keeps the length hint so the user can tell which secret it was', () => {
    expect(maskSecrets(AWS_KEY).text).toBe('[redacted 20 chars]');
  });

  it('lets the specific patterns win over the generic high-entropy one', () => {
    // A long sk- key also matches the bare 40-character run. If the generic pattern went first it
    // would mask only the tail, and the reported length would be wrong.
    const key = 'sk-' + 'a'.repeat(48);
    expect(maskSecrets(key).text).toBe('[redacted 51 chars]');
  });

  it('leaves ordinary prose about keys and tokens alone', () => {
    const innocent: string[] = [
      'Store the API key in an environment variable instead of in the repo.',
      'The auth token expires after one hour, so refresh it before the next call.',
      'process.env.GITHUB_TOKEN is read at startup',
      'Set SECRET_KEY_BASE in your shell profile.',
      'password = getPassword(user)',
      'Ask the user for their credit card number',
      // Short placeholder values are what a fixture or a doc actually contains.
      'API_KEY=changeme',
      'sk-test',
      'https://user:hunter2@example.test/repo.git',
    ];
    for (const text of innocent) {
      expect(maskSecrets(text), text).toEqual({ text, changed: false });
    }
  });

  it('does not treat a prefix inside a longer word as a key', () => {
    // "ask-" and "risk-" both end in a pattern prefix, and over-redaction here would eat prose.
    const text = 'Do not ask-questions-like-this-one-in-a-single-token';
    expect(maskSecrets(text).changed).toBe(false);
  });
});

describe('maskKnownSecrets', () => {
  it('masks every occurrence of a literal secret we already hold', () => {
    const text = 'ANTHROPIC_API_KEY=' + AWS_SECRET + ' and again ' + AWS_SECRET;
    expect(maskKnownSecrets(text, [AWS_SECRET])).toBe(
      'ANTHROPIC_API_KEY=[redacted] and again [redacted]',
    );
  });

  it('ignores empty, missing and implausibly short entries', () => {
    // A three-character "secret" would match half the log, so the floor matters more than it looks.
    const text = 'the cat sat on the mat';
    expect(maskKnownSecrets(text, [null, undefined, '', 'cat', 'mat'])).toBe(text);
  });
});

describe('redactSecretFindings', () => {
  it('masks the title of a secret-kind finding, where the scanner puts the credential', () => {
    const [redacted] = redactSecretFindings([
      makeFinding({
        kind: 'secret',
        title: 'aws-access-key-id ' + AWS_KEY,
        detail: 'Found ' + AWS_KEY + ' in the file.',
        excerpt: 'AWS_ACCESS_KEY_ID=' + AWS_KEY,
      }),
    ]);
    expect(redacted.title).toBe('aws-access-key-id [redacted 20 chars]');
    expect(redacted.detail).not.toContain(AWS_KEY);
    expect(redacted.excerpt).not.toContain(AWS_KEY);
    expect(redacted.redacted).toBe(true);
  });

  it('scrubs the excerpt of a SAST finding too, since a rule will quote the token it matched', () => {
    const [redacted] = redactSecretFindings([
      makeFinding({
        kind: 'sast',
        title: 'Hardcoded credential',
        detail: 'A credential is hardcoded here.',
        excerpt: 'const token = "' + GITHUB_TOKEN + '";',
      }),
    ]);
    expect(redacted.excerpt).toBe('const token = "[redacted 40 chars]";');
    expect(redacted.redacted).toBe(true);
  });

  it('leaves a non-secret title untouched even when it looks like a credential', () => {
    // Only secret-kind titles are scrubbed: a SAST rule title is the rule's own words, and
    // rewriting it would lose the one line that says what the finding is.
    const [redacted] = redactSecretFindings([
      makeFinding({ kind: 'sast', title: 'Do not commit ' + AWS_KEY, detail: 'See the file.' }),
    ]);
    expect(redacted.title).toBe('Do not commit ' + AWS_KEY);
    expect(redacted.redacted).toBe(false);
  });

  it('returns untouched findings as the same object', () => {
    const finding = makeFinding({ detail: 'Use a parameterized query.', excerpt: 'db.query(sql)' });
    const [result] = redactSecretFindings([finding]);
    expect(result).toBe(finding);
    expect(result.redacted).toBe(false);
  });

  it('handles a null excerpt without inventing one', () => {
    const [result] = redactSecretFindings([
      makeFinding({ kind: 'secret', title: 'token', detail: AWS_KEY, excerpt: null }),
    ]);
    expect(result.excerpt).toBeNull();
    expect(result.redacted).toBe(true);
  });
});
